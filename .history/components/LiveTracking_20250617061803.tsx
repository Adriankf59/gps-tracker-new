"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  MapPin, Navigation, Car, Fuel, Zap, Gauge, Clock, Satellite,
  RefreshCw, Loader2, AlertCircle, Eye, Shield, AlertTriangle,
  Bell, ShieldAlert, X, Wifi, WifiOff, List, ChevronUp, Activity
} from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { API_BASE_URL } from '../api/file';

// ==================== CONSTANTS ====================
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://vehitrack.my.id/websocket';
const RECONNECT_INTERVAL = 5000; // 5 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// ==================== TYPES ====================
interface GeofenceDefinition {
  coordinates?: number[][][];
  center?: [number, number];
  radius?: number;
  type: string;
}

interface ProjectGeofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: GeofenceDefinition;
  date_created: string;
}

interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  updated_at: string | null;
  vehicle_photo: string | null;
  geofence_id?: number | string | null;
}

interface VehicleData {
  vehicle_datas_id?: string;
  gps_id: string | null;
  vehicle_id?: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm?: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used?: number | null;
}

interface VehicleWithTracking extends Vehicle {
  latestData?: VehicleData;
  status: "moving" | "parked" | "offline";
  location: string;
  lastUpdateString: string;
  isOnline: boolean;
}

interface GeofenceAlert {
  alert_id?: number;
  vehicle_id: number;
  alert_type: "violation_enter" | "violation_exit" | "violation_stay_out";
  alert_message: string;
  lokasi: string;
  timestamp: string;
}

// WebSocket Message Types
interface WSMessage {
  type: 'vehicle_update' | 'vehicle_data' | 'geofence_update' | 'connection' | 'error' | 'pong';
  data?: any;
  userId?: string;
  timestamp?: string;
}

// ==================== UTILITIES ====================
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

// ==================== CUSTOM HOOKS ====================
const useUser = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return { userData: null, userId: undefined };
    
    try {
      const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
      const userId = userData.id || userData.user_id || undefined;
      return { userData, userId };
    } catch (error) {
      console.error('Error parsing user data:', error);
      return { userData: null, userId: undefined };
    }
  }, []);
};

// WebSocket Hook
const useWebSocket = (userId: string | undefined) => {
  const [isConnected, setIsConnected] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleDataMap, setVehicleDataMap] = useState<Map<string, VehicleData>>(new Map());
  const [geofences, setGeofences] = useState<ProjectGeofence[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!userId || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      console.log('Connecting to WebSocket:', WS_URL);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        toast.success('Real-time connection established');

        // Send authentication/subscription message
        ws.send(JSON.stringify({
          type: 'subscribe',
          userId: userId,
          channels: ['vehicles', 'vehicle_data', 'geofences']
        }));

        // Setup heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Attempt reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, RECONNECT_INTERVAL);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      toast.error('Failed to connect');
    }
  }, [userId]);

  // Handle incoming messages
  const handleMessage = useCallback((message: WSMessage) => {
    console.log('WebSocket message:', message);
    
    switch (message.type) {
      case 'vehicle_update':
        if (message.data) {
          setVehicles(prev => {
            const updated = [...prev];
            const index = updated.findIndex(v => v.vehicle_id === message.data.vehicle_id);
            if (index >= 0) {
              updated[index] = message.data;
            } else {
              updated.push(message.data);
            }
            return updated;
          });
        }
        break;

      case 'vehicle_data':
        if (message.data) {
          setVehicleDataMap(prev => {
            const newMap = new Map(prev);
            const key = message.data.gps_id || message.data.vehicle_id;
            if (key) {
              newMap.set(key, message.data);
            }
            return newMap;
          });
          setLastUpdate(new Date());
        }
        break;

      case 'geofence_update':
        if (message.data) {
          setGeofences(prev => {
            const updated = [...prev];
            const index = updated.findIndex(g => g.geofence_id === message.data.geofence_id);
            if (index >= 0) {
              updated[index] = message.data;
            } else {
              updated.push(message.data);
            }
            return updated;
          });
        }
        break;

      case 'connection':
        // Handle initial data load
        if (message.data) {
          if (message.data.vehicles) setVehicles(message.data.vehicles);
          if (message.data.geofences) setGeofences(message.data.geofences);
          if (message.data.vehicleData) {
            const dataMap = new Map<string, VehicleData>();
            message.data.vehicleData.forEach((data: VehicleData) => {
              const key = data.gps_id || data.vehicle_id;
              if (key) dataMap.set(key, data);
            });
            setVehicleDataMap(dataMap);
          }
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'error':
        console.error('WebSocket error message:', message.data);
        toast.error(message.data?.message || 'Server error');
        break;
    }
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    sendMessage({
      type: 'refresh',
      userId: userId,
      channels: ['vehicles', 'vehicle_data', 'geofences']
    });
  }, [userId, sendMessage]);

  // Connect on mount and disconnect on unmount
  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId, connect]);

  return {
    isConnected,
    vehicles,
    vehicleDataMap,
    geofences,
    lastUpdate,
    refresh,
    sendMessage
  };
};

// ==================== GEOFENCE UTILITIES ====================
const calculateDistance = (point1: [number, number], point2: [number, number]): number => {
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;
  
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
};

const isPointInCircle = (point: [number, number], center: [number, number], radius: number): boolean => {
  return calculateDistance(point, center) <= radius;
};

const isPointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
  const [lng, lat] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

// ==================== COMPONENTS ====================
// Map Component (Dynamic Import)
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

// Alert Notification Component
const GeofenceAlertNotification = ({ alert, onDismiss }: { alert: GeofenceAlert; onDismiss: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getAlertIcon = () => {
    switch (alert.alert_type) {
      case 'violation_enter': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'violation_exit': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Shield className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed top-16 left-2 right-2 sm:left-auto sm:right-4 sm:w-96 z-[9999]">
      <Card className="shadow-2xl border-2 border-red-500 bg-red-50">
        <CardHeader className="pb-3 bg-red-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getAlertIcon()}
              <CardTitle className="text-lg font-bold">🚨 Pelanggaran Geofence!</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-3">
          <p className="text-sm font-medium mb-2">{alert.alert_message}</p>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(alert.timestamp).toLocaleTimeString('id-ID')}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {alert.lokasi}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Vehicle List Component
const VehicleList = ({ vehicles, selectedId, onSelect, geofences }: {
  vehicles: VehicleWithTracking[];
  selectedId: string | null;
  onSelect: (vehicle: VehicleWithTracking) => void;
  geofences: ProjectGeofence[];
}) => {
  const getStatusColor = (status: string) => {
    const colors = {
      'moving': 'bg-green-100 text-green-800',
      'parked': 'bg-yellow-100 text-yellow-800',
      'offline': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (!vehicles.length) {
    return (
      <div className="text-center py-10">
        <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No vehicles found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vehicles.map(vehicle => {
        const geofence = geofences.find(g => g.geofence_id.toString() === vehicle.geofence_id?.toString());
        const isSelected = selectedId === vehicle.vehicle_id;
        
        return (
          <div
            key={vehicle.vehicle_id}
            onClick={() => onSelect(vehicle)}
            className={`p-3 rounded-lg cursor-pointer transition-all border ${
              isSelected ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Car className={`w-4 h-4 ${isSelected ? 'text-blue-700' : 'text-slate-500'}`} />
                <span className="font-medium truncate">{vehicle.name}</span>
                {isSelected && <Eye className="w-3.5 h-3.5 text-blue-700" />}
                {geofence && <Shield className="w-3.5 h-3.5 text-green-600" />}
              </div>
              <Badge className={`text-xs ${getStatusColor(vehicle.status)}`}>
                {vehicle.status}
              </Badge>
            </div>
            
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{vehicle.location}</span>
              </div>
              
              {geofence && isSelected && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Shield className="w-3 h-3" />
                  <span>Geofence: {geofence.name}</span>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-blue-500" />
                  <span>{vehicle.latestData?.speed ?? 0} km/h</span>
                </div>
                <div className="flex items-center gap-1">
                  <Fuel className="w-3 h-3 text-orange-500" />
                  <span>
                    {vehicle.latestData?.fuel_level 
                      ? `${parseFloat_(vehicle.latestData.fuel_level).toFixed(0)}%` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between pt-2 border-t">
                <span className="flex items-center gap-1">
                  <Satellite className="w-3 h-3" />
                  {vehicle.latestData?.satellites_used ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {vehicle.lastUpdateString}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Stats Component
const StatsGrid = ({ stats }: { stats: any }) => {
  const items = [
    { label: 'Moving', value: stats.moving, icon: Navigation, color: 'green' },
    { label: 'Parked', value: stats.parked, icon: Car, color: 'yellow' },
    { label: 'Avg Speed', value: stats.avgSpeed, icon: Gauge, color: 'blue' },
    { label: 'Avg Fuel', value: stats.avgFuel, icon: Fuel, color: 'orange' }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
              <div className={`p-2 bg-${color}-100 rounded-full`}>
                <Icon className={`w-4 h-4 text-${color}-600`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export function LiveTracking() {
  // States
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<GeofenceAlert | null>(null);
  const [showVehicleSheet, setShowVehicleSheet] = useState(false);
  const [showStatsSheet, setShowStatsSheet] = useState(false);
  
  // Refs
  const vehiclePositionHistoryRef = useRef<Map<string, any>>(new Map());
  const alertCooldownRef = useRef<Map<string, Date>>(new Map());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hooks
  const { userId } = useUser();
  const { 
    isConnected, 
    vehicles, 
    vehicleDataMap, 
    geofences, 
    lastUpdate, 
    refresh,
    sendMessage 
  } = useWebSocket(userId);

  // Process vehicles with tracking data
  const processedVehicles = useMemo((): VehicleWithTracking[] => {
    return vehicles.map(vehicle => {
      const latestData = vehicleDataMap.get(vehicle.gps_id || '') || vehicleDataMap.get(vehicle.vehicle_id);
      const isOnline = latestData?.timestamp && 
        (Date.now() - new Date(latestData.timestamp).getTime()) / 60000 <= 10;
      
      return {
        ...vehicle,
        latestData,
        status: !isOnline ? 'offline' : (latestData?.speed ?? 0) > 0 ? 'moving' : 'parked',
        location: latestData?.latitude && latestData?.longitude 
          ? `${parseFloat_(latestData.latitude).toFixed(5)}, ${parseFloat_(latestData.longitude).toFixed(5)}`
          : 'Location unknown',
        lastUpdateString: !latestData?.timestamp ? 'No data' : (() => {
          const seconds = Math.floor((Date.now() - new Date(latestData.timestamp).getTime()) / 1000);
          if (seconds < 60) return `${seconds}s ago`;
          if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
          if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
          return `${Math.floor(seconds / 86400)}d ago`;
        })(),
        isOnline: isOnline || false
      };
    });
  }, [vehicles, vehicleDataMap]);

  // Parse geofences
  const parsedGeofences = useMemo(() => {
    return geofences.map(gf => ({
      ...gf,
      definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
    }));
  }, [geofences]);

  // Check geofence violations
  const checkGeofenceViolations = useCallback(async (vehicle: VehicleWithTracking) => {
    if (!vehicle.latestData?.latitude || !vehicle.latestData?.longitude || !vehicle.isOnline) return;

    const currentPos: [number, number] = [
      parseFloat(vehicle.latestData.longitude),
      parseFloat(vehicle.latestData.latitude)
    ];

    const geofence = parsedGeofences.find(gf => 
      gf.geofence_id.toString() === vehicle.geofence_id?.toString() && 
      gf.status === 'active'
    );

    if (!geofence?.definition) return;

    const isInside = geofence.type === 'circle' 
      ? isPointInCircle(currentPos, geofence.definition.center!, geofence.definition.radius!)
      : isPointInPolygon(currentPos, geofence.definition.coordinates![0]);

    const history = vehiclePositionHistoryRef.current.get(vehicle.vehicle_id) || { wasInside: false };
    
    let violation = null;
    if (geofence.rule_type === 'FORBIDDEN' && !history.wasInside && isInside) {
      violation = { type: 'violation_enter', message: `memasuki geofence ${geofence.name} (FORBIDDEN)` };
    } else if (geofence.rule_type === 'STAY_IN' && history.wasInside && !isInside) {
      violation = { type: 'violation_exit', message: `keluar dari geofence ${geofence.name} (STAY_IN)` };
    }

    vehiclePositionHistoryRef.current.set(vehicle.vehicle_id, { wasInside: isInside });

    if (violation) {
      const cooldownKey = `${vehicle.vehicle_id}_${violation.type}`;
      const lastAlert = alertCooldownRef.current.get(cooldownKey);
      
      if (!lastAlert || Date.now() - lastAlert.getTime() > 300000) {
        const alert: GeofenceAlert = {
          vehicle_id: parseInt(vehicle.vehicle_id),
          alert_type: violation.type as any,
          alert_message: `PELANGGARAN: Kendaraan ${vehicle.name} ${violation.message}`,
          lokasi: `${currentPos[1].toFixed(4)}, ${currentPos[0].toFixed(4)}`,
          timestamp: new Date().toISOString()
        };

        alertCooldownRef.current.set(cooldownKey, new Date());
        setActiveAlert(alert);
        
        // Send alert through WebSocket
        sendMessage({
          type: 'alert',
          data: alert
        });

        toast.error(`🚨 ${alert.alert_message}`, { duration: 5000 });
      }
    }
  }, [parsedGeofences, sendMessage]);

  // Setup geofence checking on data updates
  useEffect(() => {
    // Check violations whenever vehicle data updates
    processedVehicles
      .filter(v => v.geofence_id && v.isOnline)
      .forEach(checkGeofenceViolations);
  }, [processedVehicles, checkGeofenceViolations]);

  // Auto select first vehicle
  useEffect(() => {
    if (!selectedVehicleId && processedVehicles.length > 0) {
      setSelectedVehicleId(processedVehicles[0].vehicle_id);
    }
  }, [selectedVehicleId, processedVehicles]);

  // Handlers
  const handleRefresh = () => {
    if (!isConnected) {
      toast.error('Not connected to real-time server');
      return;
    }
    refresh();
    toast.success('Refreshing data...');
  };

  const handleVehicleSelect = (vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setShowVehicleSheet(false);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const online = processedVehicles.filter(v => v.isOnline);
    const moving = online.filter(v => v.status === 'moving');
    const parked = online.filter(v => v.status === 'parked');
    
    return {
      moving: moving.length,
      parked: parked.length,
      avgSpeed: moving.length ? Math.round(moving.reduce((acc, v) => acc + (v.latestData?.speed || 0), 0) / moving.length) : 0,
      avgFuel: online.filter(v => v.latestData?.fuel_level).length ? 
        Math.round(online.filter(v => v.latestData?.fuel_level).reduce((acc, v) => acc + parseFloat_(v.latestData!.fuel_level!), 0) / 
        online.filter(v => v.latestData?.fuel_level).length) : 0
    };
  }, [processedVehicles]);

  // Get selected vehicle data
  const selectedVehicle = processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
  const selectedGeofence = parsedGeofences.find(g => g.geofence_id.toString() === selectedVehicle?.geofence_id?.toString());

  // Loading state
  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">User Not Found</h3>
            <p className="text-slate-600">Please login to view your vehicles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Alert Notification */}
      {activeAlert && (
        <GeofenceAlertNotification alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
      )}

      {/* Header */}
      <div className="bg-white border-b p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg sm:text-xl font-bold">Live Tracking</h1>
            <Badge variant="outline" className="text-xs">
              {isConnected ? (
                <>
                  <Activity className="w-3 h-3 text-green-600 mr-1" />
                  Real-time
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-600 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {processedVehicles.length} vehicles
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!isConnected}>
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
            
            <Sheet open={showVehicleSheet} onOpenChange={setShowVehicleSheet}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline" className="sm:hidden">
                  <List className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[75vh]">
                <SheetHeader>
                  <SheetTitle>Select Vehicle</SheetTitle>
                </SheetHeader>
                <div className="mt-4 overflow-y-auto">
                  <VehicleList
                    vehicles={processedVehicles}
                    selectedId={selectedVehicleId}
                    onSelect={handleVehicleSelect}
                    geofences={parsedGeofences}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col sm:grid sm:grid-cols-4 gap-0 sm:gap-4 sm:p-4">
        {/* Map */}
        <div className="flex-1 sm:col-span-3 relative">
          <div className="h-full sm:rounded-lg overflow-hidden">
            <MapComponent
              vehicles={selectedVehicle && selectedVehicle.latestData?.latitude ? [{
                id: selectedVehicle.vehicle_id,
                name: selectedVehicle.name,
                licensePlate: selectedVehicle.license_plate,
                position: [
                  parseFloat_(selectedVehicle.latestData.latitude),
                  parseFloat_(selectedVehicle.latestData.longitude)
                ],
                speed: selectedVehicle.latestData.speed || 0,
                ignition: ['ON', 'true', '1'].includes(selectedVehicle.latestData.ignition_status || ''),
                fuel: selectedVehicle.latestData.fuel_level ? parseFloat_(selectedVehicle.latestData.fuel_level) : null,
                battery: selectedVehicle.latestData.battery_level ? parseFloat_(selectedVehicle.latestData.battery_level) : null,
                timestamp: selectedVehicle.latestData.timestamp,
                isMotor: selectedVehicle.make?.toLowerCase().includes('motor') || false,
                status: selectedVehicle.status
              }] : []}
              selectedVehicleId={selectedVehicleId}
              centerCoordinates={selectedVehicle?.latestData?.latitude ? [
                parseFloat_(selectedVehicle.latestData.latitude),
                parseFloat_(selectedVehicle.latestData.longitude)
              ] : null}
              zoomLevel={selectedVehicle ? 16 : 6}
              onVehicleClick={() => {}}
              onMapClick={() => {}}
              displayGeofences={selectedGeofence ? [selectedGeofence] : []}
            />
          </div>

          {/* Status overlay */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
            <Card className="bg-white/95 backdrop-blur">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs sm:text-sm text-green-700">Live</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-xs sm:text-sm text-red-700">Offline</span>
                    </>
                  )}
                  <span className="text-xs text-slate-500">
                    {lastUpdate.toLocaleTimeString('id-ID')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Desktop Vehicle List */}
        <div className="hidden sm:block overflow-y-auto">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <VehicleList
                vehicles={processedVehicles}
                selectedId={selectedVehicleId}
                onSelect={handleVehicleSelect}
                geofences={parsedGeofences}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Stats Sheet */}
      <Sheet open={showStatsSheet} onOpenChange={setShowStatsSheet}>
        <SheetTrigger asChild>
          <Button className="fixed bottom-20 right-4 rounded-full shadow-lg sm:hidden" size="sm">
            <ChevronUp className="w-4 h-4 mr-1" />
            Stats
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Fleet Statistics</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <StatsGrid stats={stats} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Stats */}
      <div className="hidden sm:block p-4 bg-white border-t">
        <StatsGrid stats={stats} />
      </div>

      {/* Real-time Status Indicator */}
      <div className="fixed bottom-4 right-4 z-10">
        <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-600 font-medium">
            {isConnected ? 'Real-time active' : 'Reconnecting...'}
          </span>
        </div>
      </div>
    </div>
  );
}