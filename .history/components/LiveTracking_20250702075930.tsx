"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  MapPin,
  Navigation,
  Car,
  Fuel,
  Zap,
  Gauge,
  Clock,
  Satellite,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  Shield,
  Wifi,
  WifiOff,
  List,
  ChevronUp
} from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const MapComponent = dynamic(() => import('./MapComponent').catch(() => ({ default: () => <div>Map not available</div> })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

// Constants
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://vehitrack.my.id/websocket';
const RECONNECT_INTERVAL = 5000;
const PING_INTERVAL = 30000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://vehitrack.my.id/directus';

// Types
interface ProjectGeofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][];
    center?: [number, number];
    radius?: number;
    type: string;
  };
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
  created_at?: string;
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

interface ProcessedVehicleForMap {
  id: string;
  name: string;
  licensePlate: string;
  position: [number, number];
  speed: number;
  ignition: boolean;
  fuel: number | null;
  battery: number | null;
  timestamp: string | null;
  isMotor: boolean;
  make?: string;
  model?: string;
  year?: number;
  status: 'moving' | 'parked' | 'offline';
}

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

// Custom hooks
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

const useUser = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return { userData: null, userId: undefined };
    
    try {
      const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
      return {
        userData,
        userId: userData.id || userData.user_id
      };
    } catch {
      return { userData: null, userId: undefined };
    }
  }, []);
};

// Simple WebSocket Hook
const useWebSocket = (userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [geofences, setGeofences] = useState<ProjectGeofence[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const isOnline = useOnlineStatus();

  // Load initial data
  useEffect(() => {
    if (!userId) return;
    
    const loadData = async () => {
      console.log('Loading initial data...');
      try {
        const [vehiclesRes, vehicleDataRes, geofencesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1`),
          fetch(`${API_BASE_URL}/items/vehicle_datas?limit=1000&sort=-timestamp`),
          fetch(`${API_BASE_URL}/items/geofence?filter[user_id][_eq]=${userId}`)
        ]);

        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json();
          setVehicles(data.data || []);
        }

        if (vehicleDataRes.ok) {
          const data = await vehicleDataRes.json();
          setVehicleData(data.data || []);
        }

        if (geofencesRes.ok) {
          const data = await geofencesRes.json();
          const processed = (data.data || []).map((gf: any) => ({
            ...gf,
            definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
          }));
          setGeofences(processed);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // WebSocket connection
  useEffect(() => {
    if (!userId || !isOnline) return;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      console.log('Connecting to WebSocket...');
      const ws = new WebSocket(`${WS_URL}?userId=${userId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        
        // Subscribe
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle' }));
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle_datas' }));
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'geofence' }));
        
        // Ping
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'subscription' && message.data) {
            const { event: eventType, data } = message;
            
            if (eventType === 'init' && Array.isArray(data) && data.length > 0) {
              const firstItem = data[0];
              
              if (firstItem.vehicle_id && firstItem.license_plate) {
                setVehicles(data.filter((v: Vehicle) => v.user_id === userId));
              } else if (firstItem.gps_id && firstItem.latitude) {
                setVehicleData(data);
                setLastUpdate(new Date());
              } else if (firstItem.geofence_id) {
                const processed = data
                  .filter((gf: any) => gf.user_id === userId)
                  .map((gf: any) => ({
                    ...gf,
                    definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
                  }));
                setGeofences(processed);
              }
            } else if ((eventType === 'create' || eventType === 'update') && data[0]) {
              const item = data[0];
              
              if (item.vehicle_id && item.license_plate) {
                setVehicles(prev => {
                  const index = prev.findIndex(v => v.vehicle_id === item.vehicle_id);
                  if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = item;
                    return updated;
                  }
                  return item.user_id === userId ? [...prev, item] : prev;
                });
              } else if (item.gps_id && item.latitude) {
                setVehicleData(prev => {
                  const updated = [item, ...prev.filter(d => d.gps_id !== item.gps_id)].slice(0, 1000);
                  return updated;
                });
                setLastUpdate(new Date());
              }
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setConnectionError('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Reconnect
        if (isOnline) {
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_INTERVAL);
        }
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [userId, isOnline]);

  const refresh = useCallback(async () => {
    toast.info('Refreshing data...');
    // Trigger re-fetch by updating a dependency
    setLastUpdate(new Date());
  }, []);

  return {
    isConnected,
    vehicles,
    vehicleData,
    geofences,
    lastUpdate,
    refresh,
    connectionError,
    isInitialLoading
  };
};

export function LiveTracking() {
  // State management
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null);
  const [assignedGeofenceForDisplay, setAssignedGeofenceForDisplay] = useState<ProjectGeofence | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [autoCenter, setAutoCenter] = useState(true); // Auto-center state
  
  // Mobile UI states
  const [showVehicleSheet, setShowVehicleSheet] = useState(false);
  const [showStatsSheet, setShowStatsSheet] = useState(false);

  const isOnline = useOnlineStatus();
  const { userId } = useUser();

  // Use WebSocket hook
  const {
    isConnected,
    vehicles,
    vehicleData,
    geofences,
    lastUpdate,
    refresh,
    connectionError,
    isInitialLoading
  } = useWebSocket(userId);

  // Utility functions
  const getLocationName = useCallback((latStr: string | null, lngStr: string | null): string => {
    if (!latStr || !lngStr) return 'Location unknown';
    
    const latitude = parseFloat_(latStr);
    const longitude = parseFloat_(lngStr);
    
    if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
      return "Bandung, Jawa Barat";
    }
    if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
      return "Jakarta";
    }
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }, []);

  const getVehicleStatus = useCallback((data: VehicleData | undefined): "moving" | "parked" | "offline" => {
    if (!data?.timestamp) return 'offline';
    
    const diffMinutes = (Date.now() - new Date(data.timestamp).getTime()) / 60000;
    if (diffMinutes > 10) return 'offline';
    return (data.speed ?? 0) > 0 ? 'moving' : 'parked';
  }, []);

  const isVehicleOnline = useCallback((data: VehicleData | undefined): boolean => {
    if (!data?.timestamp) return false;
    return (Date.now() - new Date(data.timestamp).getTime()) / 60000 <= 10;
  }, []);

  const getRelativeTime = useCallback((timestamp: string | null): string => {
    if (!timestamp) return 'No data';
    
    try {
      const now = new Date();
      const then = new Date(timestamp);
      const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
      
      if (diffSeconds < 5) return 'Just now';
      if (diffSeconds < 60) return `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
      return `${Math.floor(diffSeconds / 86400)}d ago`;
    } catch {
      return 'Invalid time';
    }
  }, []);

  const isMotorVehicle = (vehicle: Vehicle): boolean => {
    const checkStrings = [vehicle.make, vehicle.model, vehicle.name].map(s => s?.toLowerCase() || '');
    return checkStrings.some(str => str.includes('motor'));
  };

  const validateGeofenceCoordinates = useCallback((geofence: ProjectGeofence | null | undefined): geofence is ProjectGeofence => {
    if (!geofence?.definition) return false;
    
    try {
      if (geofence.type === 'circle') {
        const { center, radius } = geofence.definition;
        if (!center || center.length < 2) return false;
        
        const [lng, lat] = center;
        return !isNaN(lng) && !isNaN(lat) && 
               isFinite(lng) && isFinite(lat) && 
               radius != null && !isNaN(radius) && radius > 0;
      }
      
      if (geofence.type === 'polygon') {
        const { coordinates } = geofence.definition;
        if (!coordinates?.[0] || coordinates[0].length < 3) return false;
        
        return coordinates[0].every(point => 
          point?.length >= 2 && 
          !isNaN(point[0]) && !isNaN(point[1]) && 
          isFinite(point[0]) && isFinite(point[1])
        );
      }
      
      return false;
    } catch (error) {
      console.error('Geofence validation error:', error);
      return false;
    }
  }, []);

  // Process vehicles
  const processedVehicles = useMemo((): VehicleWithTracking[] => {
    if (!vehicles.length) return [];
    
    const dataMap = new Map<string, VehicleData>();
    
    vehicleData.forEach(data => {
      const key = data.gps_id || data.vehicle_id;
      if (!key) return;
      
      const existing = dataMap.get(key);
      if (!existing || (data.timestamp && existing.timestamp && 
          new Date(data.timestamp) > new Date(existing.timestamp))) {
        dataMap.set(key, data);
      }
    });

    return vehicles.map(vehicle => {
      const latestData = dataMap.get(vehicle.gps_id) || dataMap.get(vehicle.vehicle_id);
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      
      if (latestData?.latitude && latestData?.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
      }

      return {
        ...vehicle,
        latestData,
        status,
        location,
        lastUpdateString: getRelativeTime(latestData?.timestamp ?? null),
        isOnline: online
      };
    }).sort((a, b) => {
      const idA = parseInt(a.vehicle_id, 10) || 0;
      const idB = parseInt(b.vehicle_id, 10) || 0;
      return idA - idB;
    });
  }, [vehicles, vehicleData, getVehicleStatus, getLocationName, getRelativeTime, isVehicleOnline]);

  // Processed vehicle for map
  const processedVehicleForMap = useMemo((): ProcessedVehicleForMap[] => {
    if (!selectedVehicleId) return [];
    
    const selectedVehicle = processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
    if (!selectedVehicle?.latestData) return [];

    const { latestData } = selectedVehicle;
    if (!latestData.latitude || !latestData.longitude) return [];

    const lat = parseFloat_(latestData.latitude);
    const lng = parseFloat_(latestData.longitude);
    if (!lat || !lng) return [];

    return [{
      id: selectedVehicle.vehicle_id,
      name: selectedVehicle.name,
      licensePlate: selectedVehicle.license_plate,
      position: [lat, lng],
      speed: latestData.speed ?? 0,
      ignition: ['ON', 'true', '1'].includes(latestData.ignition_status || ''),
      fuel: latestData.fuel_level ? parseFloat_(latestData.fuel_level) : null,
      battery: latestData.battery_level ? parseFloat_(latestData.battery_level) : null,
      timestamp: latestData.timestamp,
      isMotor: isMotorVehicle(selectedVehicle),
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      year: selectedVehicle.year,
      status: selectedVehicle.status
    }];
  }, [processedVehicles, selectedVehicleId]);

  // Processed geofence for map
  const processedGeofenceForMapDisplay = useMemo((): ProjectGeofence[] => {
    return assignedGeofenceForDisplay && validateGeofenceCoordinates(assignedGeofenceForDisplay)
      ? [assignedGeofenceForDisplay]
      : [];
  }, [assignedGeofenceForDisplay, validateGeofenceCoordinates]);

  // Event handlers
  const handleVehicleSelect = useCallback((vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);
    setShowVehicleSheet(false);

    if (vehicle.latestData?.latitude && vehicle.latestData?.longitude) {
      const lat = parseFloat_(vehicle.latestData.latitude);
      const lng = parseFloat_(vehicle.latestData.longitude);
      
      if (lat && lng) {
        setSelectedVehicleCoords([lat, lng]);
      } else {
        setSelectedVehicleCoords(null);
      }
    } else {
      setSelectedVehicleCoords(null);
    }

    if (vehicle.geofence_id) {
      const assignedGeofence = geofences.find(gf => 
        gf.geofence_id.toString() === vehicle.geofence_id?.toString()
      );
      
      if (assignedGeofence && validateGeofenceCoordinates(assignedGeofence)) {
        setAssignedGeofenceForDisplay(assignedGeofence);
      } else {
        setAssignedGeofenceForDisplay(null);
      }
    } else {
      setAssignedGeofenceForDisplay(null);
    }
  }, [geofences, validateGeofenceCoordinates]);

  const handleMapVehicleClick = useCallback((clickedVehicle: ProcessedVehicleForMap) => {
    const fullVehicleData = processedVehicles.find(v => v.vehicle_id === clickedVehicle.id);
    if (fullVehicleData) {
      handleVehicleSelect(fullVehicleData);
    }
  }, [processedVehicles, handleVehicleSelect]);

  // Handle map interaction (disable auto-center when user interacts with map)
  const handleMapClick = useCallback(() => {
    // Optionally disable auto-center when user clicks on map
    // setAutoCenter(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline');
      return;
    }
    
    if (!isConnected) {
      toast.error('Not connected to real-time updates');
      return;
    }
    
    await refresh();
  }, [isOnline, isConnected, refresh]);

  // Initialize from session storage
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return;
    
    try {
      const trackVehicleId = sessionStorage.getItem('trackVehicleId');
      const trackVehicleName = sessionStorage.getItem('trackVehicleName');
      
      if (trackVehicleId && !selectedVehicleId) {
        setSelectedVehicleId(trackVehicleId);
      }
      if (trackVehicleName && !selectedVehicleName) {
        setSelectedVehicleName(trackVehicleName);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Initialization error:', error);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Auto-select first vehicle
  useEffect(() => {
    if (processedVehicles.length > 0 && !selectedVehicleId && isInitialized) {
      const vehicleToSelect = processedVehicles[0];
      if (vehicleToSelect) {
        handleVehicleSelect(vehicleToSelect);
      }
    }
  }, [processedVehicles.length, selectedVehicleId, isInitialized, handleVehicleSelect]);

  // Auto-center map when selected vehicle moves
  useEffect(() => {
    if (!autoCenter || !selectedVehicleId) return;

    const selectedVehicle = processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
    if (selectedVehicle?.latestData?.latitude && selectedVehicle?.latestData?.longitude) {
      const lat = parseFloat_(selectedVehicle.latestData.latitude);
      const lng = parseFloat_(selectedVehicle.latestData.longitude);
      
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        // Only update if coordinates have actually changed
        if (!selectedVehicleCoords || 
            Math.abs(selectedVehicleCoords[0] - lat) > 0.00001 || 
            Math.abs(selectedVehicleCoords[1] - lng) > 0.00001) {
          setSelectedVehicleCoords([lat, lng]);
        }
      }
    }
  }, [autoCenter, selectedVehicleId, processedVehicles, selectedVehicleCoords]);

  // Style helpers
  const getStatusColorClass = useCallback((status: VehicleWithTracking['status']): string => {
    const statusMap = {
      'moving': 'bg-green-100 text-green-800 border-green-200',
      'parked': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'offline': 'bg-red-100 text-red-800 border-red-200'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  }, []);

  // Statistics
  const { onlineVehicles, movingVehiclesCount, parkedVehiclesCount, avgSpeed, avgFuel } = useMemo(() => {
    const online = processedVehicles.filter(v => v.isOnline);
    const moving = online.filter(v => v.status === 'moving');
    const parked = online.filter(v => v.status === 'parked');
    
    const totalSpeed = moving.reduce((acc, v) => acc + (v.latestData?.speed || 0), 0);
    const calculatedAvgSpeed = moving.length > 0 ? Math.round(totalSpeed / moving.length) : 0;
    
    const vehiclesWithFuel = online.filter(v => 
      v.latestData?.fuel_level && !isNaN(parseFloat(v.latestData.fuel_level))
    );
    const totalFuel = vehiclesWithFuel.reduce((acc, v) => 
      acc + parseFloat(v.latestData!.fuel_level!), 0
    );
    const calculatedAvgFuel = vehiclesWithFuel.length > 0 ? Math.round(totalFuel / vehiclesWithFuel.length) : 0;
    
    return {
      onlineVehicles: online,
      movingVehiclesCount: moving.length,
      parkedVehiclesCount: parked.length,
      avgSpeed: calculatedAvgSpeed,
      avgFuel: calculatedAvgFuel
    };
  }, [processedVehicles]);

  // Get selected vehicle
  const selectedVehicle = useMemo(() => {
    return processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
  }, [processedVehicles, selectedVehicleId]);

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading live tracking...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!isOnline) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 text-center">
            <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">You're Offline</h3>
            <p className="text-slate-600 mb-6">
              Please check your internet connection
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Mobile-optimized Header */}
      <div className="bg-white border-b p-3 sm:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 truncate">Live Tracking</h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                {isOnline ? (
                  <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                )}
                <span className="truncate">{processedVehicles.length} vehicles</span>
                {isConnected && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1" />
                    Live
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={!isConnected || !isOnline}
              className="flex-1 sm:flex-initial border-slate-300 text-slate-600 bg-white hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
            
            {/* Mobile Vehicle List Button */}
            <Sheet open={showVehicleSheet} onOpenChange={setShowVehicleSheet}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="sm:hidden h-8 px-2">
                  <List className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[75vh]">
                <SheetHeader className="pb-4">
                  <SheetTitle>Select Vehicle ({processedVehicles.length})</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto -mx-6 px-6">
                  <VehicleList
                    vehicles={processedVehicles}
                    selectedVehicleId={selectedVehicleId}
                    onVehicleSelect={handleVehicleSelect}
                    getStatusColorClass={getStatusColorClass}
                    assignedGeofenceForDisplay={assignedGeofenceForDisplay}
                    compact={false}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile optimized grid */}
      <div className="flex-1 flex flex-col sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-0 sm:gap-4 sm:p-4 overflow-hidden">
        {/* Map - Full screen on mobile */}
        <div className="flex-1 sm:col-span-2 lg:col-span-3 relative">
          <div className="h-full sm:rounded-lg overflow-hidden">
            <MapComponent
              vehicles={processedVehicleForMap}
              selectedVehicleId={selectedVehicleId}
              centerCoordinates={selectedVehicleCoords}
              zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : 6}
              onVehicleClick={handleMapVehicleClick}
              onMapClick={handleMapClick}
              displayGeofences={processedGeofenceForMapDisplay}
            />
            
            {/* Status overlays */}
            {!isConnected && (
              <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
                <Card className="bg-red-50/95 backdrop-blur border-red-200">
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-center gap-2">
                      <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                      <span className="text-xs sm:text-sm text-red-700">No Real-time Data</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Auto-center toggle button */}
            {selectedVehicleId && (
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
                <Button
                  variant={autoCenter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoCenter(!autoCenter)}
                  className={`shadow-md ${autoCenter ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  title={autoCenter ? "Auto-center is ON" : "Auto-center is OFF"}
                >
                  <Navigation className={`w-4 h-4 ${autoCenter ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline ml-1">
                    {autoCenter ? 'Following' : 'Free'}
                  </span>
                </Button>
              </div>
            )}

            {/* Mobile Selected Vehicle Info Overlay */}
            {selectedVehicle && (
              <div className="absolute bottom-0 left-0 right-0 sm:hidden bg-white border-t shadow-lg">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Car className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{selectedVehicle.name}</span>
                    </div>
                    <Badge className={`text-xs ${getStatusColorClass(selectedVehicle.status)}`}>
                      {selectedVehicle.status}
                    </Badge>
                  </div>
                  
                  {assignedGeofenceForDisplay && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 mb-2">
                      <Shield className="w-3 h-3" />
                      <span className="truncate">{assignedGeofenceForDisplay.name}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <Gauge className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                      <p>{selectedVehicle.latestData?.speed || 0} km/h</p>
                    </div>
                    <div className="text-center">
                      <Fuel className="w-4 h-4 mx-auto text-orange-500 mb-1" />
                      <p>{selectedVehicle.latestData?.fuel_level ? 
                        `${parseFloat_(selectedVehicle.latestData.fuel_level).toFixed(0)}%` : 'N/A'}</p>
                    </div>
                    <div className="text-center">
                      <Clock className="w-4 h-4 mx-auto text-slate-500 mb-1" />
                      <p>{selectedVehicle.lastUpdateString}</p>
                    </div>
                  </div>
                  
                  {/* Auto-center toggle for mobile */}
                  <div className="mt-2 pt-2 border-t">
                    <Button
                      variant={autoCenter ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAutoCenter(!autoCenter)}
                      className={`w-full h-7 text-xs ${autoCenter ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    >
                      <Navigation className={`w-3 h-3 mr-1 ${autoCenter ? 'animate-pulse' : ''}`} />
                      {autoCenter ? 'Auto-center ON' : 'Auto-center OFF'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
                selectedVehicleId={selectedVehicleId}
                onVehicleSelect={handleVehicleSelect}
                getStatusColorClass={getStatusColorClass}
                assignedGeofenceForDisplay={assignedGeofenceForDisplay}
                compact={true}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Stats Button */}
      <div className={`sm:hidden ${selectedVehicle ? 'hidden' : ''}`}>
        <Sheet open={showStatsSheet} onOpenChange={setShowStatsSheet}>
          <SheetTrigger asChild>
            <Button 
              className="fixed bottom-20 right-4 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-10"
              size="sm"
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              Stats
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader className="pb-4">
              <SheetTitle>Fleet Statistics</SheetTitle>
            </SheetHeader>
            <StatsGrid
              movingVehiclesCount={movingVehiclesCount}
              parkedVehiclesCount={parkedVehiclesCount}
              avgSpeed={avgSpeed}
              avgFuel={avgFuel}
              mobile={true}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Stats */}
      <div className="hidden sm:block p-4 bg-white border-t">
        <StatsGrid
          movingVehiclesCount={movingVehiclesCount}
          parkedVehiclesCount={parkedVehiclesCount}
          avgSpeed={avgSpeed}
          avgFuel={avgFuel}
          mobile={false}
        />
      </div>

      {/* Real-time Status Indicator */}
      <div className={`fixed ${selectedVehicle ? 'bottom-32' : 'bottom-4'} right-4 sm:bottom-4 z-10`}>
        <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-600 font-medium">
            {isConnected ? 'Real-time active' : connectionError || 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Vehicle List Component
const VehicleList = ({ 
  vehicles, 
  selectedVehicleId, 
  onVehicleSelect, 
  getStatusColorClass, 
  assignedGeofenceForDisplay,
  compact 
}: {
  vehicles: VehicleWithTracking[];
  selectedVehicleId: string | null;
  onVehicleSelect: (vehicle: VehicleWithTracking) => void;
  getStatusColorClass: (status: VehicleWithTracking['status']) => string;
  assignedGeofenceForDisplay: ProjectGeofence | null;
  compact: boolean;
}) => {
  if (vehicles.length === 0) {
    return (
      <div className="text-center py-10">
        <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No vehicles found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {vehicles.map((vehicle) => (
        <div
          key={vehicle.vehicle_id}
          className={`flex flex-col p-3 cursor-pointer rounded-lg transition-all duration-150 ease-in-out border hover:shadow-md
            ${selectedVehicleId === vehicle.vehicle_id
              ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500 shadow-lg'
              : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          onClick={() => onVehicleSelect(vehicle)}
        >
          {/* Vehicle Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Car className={`w-4 h-4 shrink-0 ${selectedVehicleId === vehicle.vehicle_id ? 'text-blue-700' : 'text-slate-500'}`} />
              <span className="font-medium text-sm text-slate-800 truncate" title={vehicle.name}>
                {vehicle.name}
              </span>
              {selectedVehicleId === vehicle.vehicle_id && (
                <Eye className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              )}
              {vehicle.geofence_id && (
                <span title="Has assigned geofence">
                  <Shield className="w-3.5 h-3.5 text-green-600 shrink-0" />
                </span>
              )}
            </div>
            <Badge className={`text-xs px-1.5 py-0.5 font-medium ${getStatusColorClass(vehicle.isOnline ? vehicle.status : 'offline')}`}>
              {vehicle.isOnline ? vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1) : 'Offline'}
            </Badge>
          </div>
          
          {/* Location */}
          <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate" title={vehicle.location}>{vehicle.location}</span>
          </div>
          
          {/* Geofence Info */}
          {vehicle.geofence_id && selectedVehicleId === vehicle.vehicle_id && assignedGeofenceForDisplay && !compact && (
            <div className="text-xs text-blue-600 mb-1.5 flex items-center gap-1 truncate">
              <Shield className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="truncate" title={`Geofence: ${assignedGeofenceForDisplay.name}`}>
                Geofence: {assignedGeofenceForDisplay.name}
              </span>
            </div>
          )}
          
          {/* Metrics */}
          <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-x-2 gap-y-1 text-xs text-slate-600 mb-1.5`}>
            <div className="flex items-center gap-1" title="Speed">
              <Gauge className="w-3 h-3 text-blue-500 shrink-0" />
              <span>{vehicle.latestData?.speed ?? 0} km/h</span>
            </div>
            <div className="flex items-center gap-1" title="Fuel">
              <Fuel className="w-3 h-3 text-orange-500 shrink-0" />
              <span>
                {vehicle.latestData?.fuel_level 
                  ? `${parseFloat_(vehicle.latestData.fuel_level).toFixed(0)}%` 
                  : 'N/A'
                }
              </span>
            </div>
            {!compact && (
              <div className="flex items-center gap-1" title="Battery">
                <Zap className="w-3 h-3 text-green-500 shrink-0" />
                <span>
                  {vehicle.latestData?.battery_level 
                    ? `${parseFloat_(vehicle.latestData.battery_level).toFixed(1)}V` 
                    : 'N/A'
                  }
                </span>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 mt-1">
            <div className="flex items-center gap-1" title="Satellites">
              <Satellite className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{vehicle.latestData?.satellites_used ?? 0}</span>
            </div>
            <div className="flex items-center gap-1" title="Last Update">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{vehicle.lastUpdateString}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Stats Grid Component
const StatsGrid = ({ 
  movingVehiclesCount, 
  parkedVehiclesCount, 
  avgSpeed, 
  avgFuel,
  mobile 
}: {
  movingVehiclesCount: number;
  parkedVehiclesCount: number;
  avgSpeed: number;
  avgFuel: number;
  mobile: boolean;
}) => {
  return (
    <div className={`grid ${mobile ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-4'}`}>
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className={`${mobile ? 'pt-4 pb-3' : 'pt-5 pb-4'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${mobile ? 'text-xl' : 'text-2xl'} font-bold text-green-600`}>{movingVehiclesCount}</p>
              <p className="text-xs text-slate-500 uppercase">Moving</p>
            </div>
            <div className={`${mobile ? 'p-1.5' : 'p-2'} bg-green-100 rounded-full`}>
              <Navigation className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className={`${mobile ? 'pt-4 pb-3' : 'pt-5 pb-4'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${mobile ? 'text-xl' : 'text-2xl'} font-bold text-yellow-600`}>{parkedVehiclesCount}</p>
              <p className="text-xs text-slate-500 uppercase">Parked</p>
            </div>
            <div className={`${mobile ? 'p-1.5' : 'p-2'} bg-yellow-100 rounded-full`}>
              <Car className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className={`${mobile ? 'pt-4 pb-3' : 'pt-5 pb-4'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${mobile ? 'text-xl' : 'text-2xl'} font-bold text-blue-600`}>{avgSpeed}</p>
              <p className="text-xs text-slate-500 uppercase">Avg Speed</p>
            </div>
            <div className={`${mobile ? 'p-1.5' : 'p-2'} bg-blue-100 rounded-full`}>
              <Gauge className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className={`${mobile ? 'pt-4 pb-3' : 'pt-5 pb-4'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${mobile ? 'text-xl' : 'text-2xl'} font-bold text-orange-600`}>{avgFuel}</p>
              <p className="text-xs text-slate-500 uppercase">Avg Fuel</p>
            </div>
            <div className={`${mobile ? 'p-1.5' : 'p-2'} bg-orange-100 rounded-full`}>
              <Fuel className="w-4 h-4 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};