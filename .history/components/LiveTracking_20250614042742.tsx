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
  AlertTriangle,
  Bell,
  ShieldAlert,
  X,
  Wifi,
  WifiOff,
  ChevronUp,
  Maximize2,
  Minimize2,
  List
} from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import useSWR from 'swr';
import { API_BASE_URL } from '../api/file';

const MapComponent = dynamic(() => import('./MapComponent').catch(() => ({ default: () => <div>Map not available</div> })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

// Types (sama seperti sebelumnya)
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

interface GeofenceAlert {
  alert_id?: number;
  vehicle_id: number;
  alert_type: "violation_enter" | "violation_exit" | "violation_stay_out";
  alert_message: string;
  lokasi: string;
  timestamp: string;
}

interface VehiclePositionHistory {
  vehicleId: string;
  previousPosition: [number, number] | null;
  currentPosition: [number, number] | null;
  wasInsideGeofence: boolean;
  lastChecked: Date;
}

// Constants
const INTERVALS = {
  VEHICLES: 60000,
  VEHICLE_DATA: 5000,
  GEOFENCES: 300000,
  ALERTS: 15000
};

// API endpoints
const GEOFENCE_API = `${API_BASE_URL}/items/geofence`;
const VEHICLE_API = `${API_BASE_URL}/items/vehicle`;
const VEHICLE_DATA_API = `${API_BASE_URL}/items/vehicle_datas`;
const ALERTS_API = `${API_BASE_URL}/items/alerts`;

// Enhanced fetcher
const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const ensureArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value?.data && Array.isArray(value.data)) return value.data;
  return [];
};

// Custom hooks
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
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

// Mobile Vehicle Card Component
const MobileVehicleCard = ({ 
  vehicle, 
  isSelected,
  onClick,
  assignedGeofence 
}: { 
  vehicle: VehicleWithTracking;
  isSelected: boolean;
  onClick: () => void;
  assignedGeofence?: ProjectGeofence | null;
}) => {
  const getStatusColor = (status: string, isOnline: boolean) => {
    if (!isOnline) return 'bg-gray-100 text-gray-600';
    
    switch (status) {
      case 'moving': return 'bg-green-100 text-green-700';
      case 'parked': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border transition-all cursor-pointer ${
        isSelected 
          ? 'bg-blue-50 border-blue-500 shadow-md' 
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Car className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
          <span className="font-medium text-sm truncate">{vehicle.name}</span>
          {isSelected && <Eye className="w-3 h-3 text-blue-600 flex-shrink-0" />}
          {vehicle.geofence_id && <Shield className="w-3 h-3 text-green-600 flex-shrink-0" />}
        </div>
        <Badge className={`text-xs ${getStatusColor(vehicle.status, vehicle.isOnline)}`}>
          {vehicle.isOnline ? vehicle.status : 'offline'}
        </Badge>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1 mb-2">
        <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-600 truncate">{vehicle.location}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Gauge className="w-3 h-3 text-blue-500" />
          <span>{vehicle.latestData?.speed ?? 0} km/h</span>
        </div>
        <div className="flex items-center gap-1">
          <Fuel className="w-3 h-3 text-orange-500" />
          <span>{vehicle.latestData?.fuel_level ? `${parseFloat_(vehicle.latestData.fuel_level).toFixed(0)}%` : 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-gray-400" />
          <span>{vehicle.lastUpdateString}</span>
        </div>
      </div>

      {/* Geofence info if selected */}
      {isSelected && assignedGeofence && (
        <div className="mt-2 pt-2 border-t">
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <Shield className="w-3 h-3" />
            <span>{assignedGeofence.name} ({assignedGeofence.rule_type})</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Geofence detection utilities (sama seperti sebelumnya)
const isPointInCircle = (point: [number, number], center: [number, number], radius: number): boolean => {
  const [pointLng, pointLat] = point;
  const [centerLng, centerLat] = center;
  
  const R = 6371000;
  const dLat = (centerLat - pointLat) * Math.PI / 180;
  const dLng = (centerLng - pointLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(pointLat * Math.PI / 180) * Math.cos(centerLat * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance <= radius;
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

const isVehicleInsideGeofence = (vehiclePos: [number, number], geofence: ProjectGeofence): boolean => {
  if (!geofence || !geofence.definition) return false;
  
  try {
    if (geofence.type === 'circle') {
      const { center, radius } = geofence.definition;
      if (!center || !radius) return false;
      return isPointInCircle(vehiclePos, center, radius);
    }
    
    if (geofence.type === 'polygon') {
      const { coordinates } = geofence.definition;
      if (!coordinates || !coordinates[0]) return false;
      return isPointInPolygon(vehiclePos, coordinates[0]);
    }
  } catch (error) {
    console.error('Error checking geofence:', error);
  }
  
  return false;
};

// Alert notification component
const GeofenceViolationNotification = ({ 
  alert, 
  onDismiss 
}: { 
  alert: GeofenceAlert;
  onDismiss: () => void;
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 8000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'violation_enter': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'violation_exit': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Shield className="w-5 h-5 text-blue-500" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 transition-all duration-300 ease-in-out z-[9999]"
    >
      <Card className="shadow-2xl border-2 border-red-500 bg-red-50">
        <CardHeader className="pb-3 bg-red-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getAlertIcon(alert.alert_type)}
              <CardTitle className="text-base sm:text-lg font-bold text-slate-800">
                🚨 Pelanggaran Geofence!
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="h-6 w-6 p-0 hover:bg-red-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="text-sm font-medium text-slate-700 mb-2">
            {alert.alert_message}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(alert.timestamp).toLocaleTimeString('id-ID')}
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {alert.lokasi}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export function LiveTracking() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null);
  const [assignedGeofenceForDisplay, setAssignedGeofenceForDisplay] = useState<ProjectGeofence | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [vehicleListOpen, setVehicleListOpen] = useState(false);
  
  // State for geofence violation detection
  const [activeAlert, setActiveAlert] = useState<GeofenceAlert | null>(null);
  const [vehiclePositionHistory, setVehiclePositionHistory] = useState<Map<string, VehiclePositionHistory>>(new Map());
  const [recentAlerts, setRecentAlerts] = useState<GeofenceAlert[]>([]);
  const alertCooldownRef = useRef<Map<string, Date>>(new Map());

  const isOnline = useOnlineStatus();
  const { userData, userId } = useUser();

  // Vehicles hook
  const {
    data: vehiclesData,
    error: vehiclesError,
    isLoading: vehiclesLoading,
    mutate: mutateVehicles
  } = useSWR(
    userId && isOnline ? `${VEHICLE_API}?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      refreshInterval: isOnline ? INTERVALS.VEHICLES : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 1,
      errorRetryInterval: 5000,
      onError: (err: unknown) => {
        if (isOnline && err instanceof Error && !err.message?.includes('timeout')) {
          toast.error('Failed to load vehicles');
        }
      }
    }
  );

  const vehicles = useMemo(() => ensureArray(vehiclesData?.data || vehiclesData), [vehiclesData]);

  // Extract GPS IDs
  const gpsIds = useMemo(() => {
    return vehicles
      .map(v => v.gps_id)
      .filter(Boolean)
      .join(',');
  }, [vehicles]);

  // Vehicle data hook
  const {
    data: vehicleDataData,
    error: vehicleDataError,
    isLoading: vehicleDataLoading,
    mutate: mutateVehicleData
  } = useSWR(
    gpsIds && isOnline ? `${VEHICLE_DATA_API}?filter[gps_id][_in]=${gpsIds}&limit=1000&sort=-timestamp` : null,
    fetcher,
    {
      refreshInterval: isOnline ? INTERVALS.VEHICLE_DATA : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 1,
      onSuccess: () => setLastUpdate(new Date())
    }
  );

  const vehicleDataPoints = useMemo(() => ensureArray(vehicleDataData?.data || vehicleDataData), [vehicleDataData]);

  // Geofences hook
  const {
    data: geofencesData,
    error: geofencesError,
    isLoading: geofencesLoading,
    mutate: mutateGeofences
  } = useSWR(
    userId && isOnline ? `${GEOFENCE_API}?filter[user_id][_eq]=${userId}` : null,
    fetcher,
    {
      refreshInterval: isOnline ? INTERVALS.GEOFENCES : 0,
      revalidateOnFocus: false,
      errorRetryCount: 1
    }
  );

  const geofences = useMemo(() => {
    const data = ensureArray(geofencesData?.data || geofencesData);
    return data.map((gf: any) => ({
      ...gf,
      definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
    }));
  }, [geofencesData]);

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

  // Save alert to API
  const saveAlertToAPI = useCallback(async (alert: GeofenceAlert) => {
    try {
      const response = await fetch(ALERTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        throw new Error(`Failed to save alert: ${response.status}`);
      }

      const result = await response.json();
      console.log('Alert saved successfully:', result);
      
      setRecentAlerts(prev => [alert, ...prev.slice(0, 9)]);
      
      return result;
    } catch (error) {
      console.error('Error saving alert:', error);
      toast.error('Failed to save violation alert');
    }
  }, []);

  // Geofence violation detection
  const checkGeofenceViolations = useCallback(async (vehicle: VehicleWithTracking) => {
    if (!vehicle.latestData?.latitude || !vehicle.latestData?.longitude || !vehicle.isOnline) {
      return;
    }

    const currentPos: [number, number] = [
      parseFloat(vehicle.latestData.longitude),
      parseFloat(vehicle.latestData.latitude)
    ];

    if (isNaN(currentPos[0]) || isNaN(currentPos[1])) return;

    const assignedGeofence = geofences.find(gf => 
      gf.geofence_id.toString() === vehicle.geofence_id?.toString() && 
      gf.status === 'active' &&
      validateGeofenceCoordinates(gf)
    );

    if (!assignedGeofence) return;

    const historyKey = vehicle.vehicle_id;
    const history = vehiclePositionHistory.get(historyKey) || {
      vehicleId: vehicle.vehicle_id,
      previousPosition: null,
      currentPosition: null,
      wasInsideGeofence: false,
      lastChecked: new Date()
    };

    history.previousPosition = history.currentPosition;
    history.currentPosition = currentPos;

    const isCurrentlyInside = isVehicleInsideGeofence(currentPos, assignedGeofence);
    const wasInside = history.wasInsideGeofence;

    let violationDetected = false;
    let alertType: GeofenceAlert['alert_type'] | null = null;
    let alertMessage = '';

    switch (assignedGeofence.rule_type) {
      case 'FORBIDDEN':
        if (!wasInside && isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_enter';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} memasuki geofence ${assignedGeofence.name} (FORBIDDEN)`;
        }
        break;

      case 'STAY_IN':
        if (wasInside && !isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_exit';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} keluar dari geofence ${assignedGeofence.name} (STAY_IN)`;
        }
        break;

      case 'STANDARD':
        if (!wasInside && isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_enter';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} memasuki geofence ${assignedGeofence.name} (STANDARD)`;
        } else if (wasInside && !isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_exit';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} keluar dari geofence ${assignedGeofence.name} (STANDARD)`;
        }
        break;
    }

    history.wasInsideGeofence = isCurrentlyInside;
    history.lastChecked = new Date();
    
    setVehiclePositionHistory(prev => new Map(prev.set(historyKey, history)));

    if (violationDetected && alertType) {
      const cooldownKey = `${vehicle.vehicle_id}_${alertType}`;
      const lastAlert = alertCooldownRef.current.get(cooldownKey);
      const now = new Date();
      
      if (!lastAlert || (now.getTime() - lastAlert.getTime()) > 5 * 60 * 1000) {
        const alert: GeofenceAlert = {
          vehicle_id: parseInt(vehicle.vehicle_id),
          alert_type: alertType,
          alert_message: alertMessage,
          lokasi: `${currentPos[1].toFixed(4)}, ${currentPos[0].toFixed(4)}`,
          timestamp: new Date().toISOString()
        };

        alertCooldownRef.current.set(cooldownKey, now);
        setActiveAlert(alert);
        await saveAlertToAPI(alert);

        toast.error(`🚨 ${alertMessage}`, {
          duration: 5000,
        });

        console.log('Geofence violation detected:', alert);
      }
    }
  }, [geofences, vehiclePositionHistory, validateGeofenceCoordinates, saveAlertToAPI]);

  // Process vehicles
  const processedVehicles = useMemo((): VehicleWithTracking[] => {
    if (!vehicles.length) return [];
    
    const dataMap = new Map<string, VehicleData>();
    
    vehicleDataPoints.forEach(data => {
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
  }, [vehicles, vehicleDataPoints, getVehicleStatus, getLocationName, getRelativeTime, isVehicleOnline]);

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

  // Selected geofence detail
  const {
    data: selectedGeofenceDetailSWR,
    error: selectedGeofenceError
  } = useSWR(
    selectedVehicleId && vehicles.length > 0 ? (() => {
      const selectedVehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId);
      return selectedVehicle?.geofence_id 
        ? `${GEOFENCE_API}/${selectedVehicle.geofence_id}` 
        : null;
    })() : null,
    async (url: string) => {
      try {
        const data = await fetcher(url);
        if (data && typeof data.definition === 'string') {
          data.definition = JSON.parse(data.definition);
        }
        return data;
      } catch (error) {
        console.error("Failed to parse geofence definition:", error);
        return null;
      }
    },
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      onSuccess: (data) => {
        setAssignedGeofenceForDisplay(
          data && validateGeofenceCoordinates(data) ? data : null
        );
      }
    }
  );

  // Processed geofence for map
  const processedGeofenceForMapDisplay = useMemo((): ProjectGeofence[] => {
    return assignedGeofenceForDisplay && validateGeofenceCoordinates(assignedGeofenceForDisplay)
      ? [assignedGeofenceForDisplay]
      : [];
  }, [assignedGeofenceForDisplay, validateGeofenceCoordinates]);

  // Event handlers
  const handleVehicleSelect = useCallback(async (vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);

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
      const cachedGeofence = geofences.find(gf => 
        gf.geofence_id.toString() === vehicle.geofence_id?.toString()
      );
      
      if (cachedGeofence && validateGeofenceCoordinates(cachedGeofence)) {
        setAssignedGeofenceForDisplay(cachedGeofence);
      } else if (selectedGeofenceDetailSWR?.geofence_id.toString() === vehicle.geofence_id.toString() 
                 && validateGeofenceCoordinates(selectedGeofenceDetailSWR)) {
        setAssignedGeofenceForDisplay(selectedGeofenceDetailSWR);
      } else {
        setAssignedGeofenceForDisplay(null);
      }
    } else {
      setAssignedGeofenceForDisplay(null);
    }

    // Close vehicle list on mobile after selection
    if (window.innerWidth < 768) {
      setVehicleListOpen(false);
    }
  }, [geofences, validateGeofenceCoordinates, selectedGeofenceDetailSWR]);

  const handleMapVehicleClick = useCallback((clickedVehicle: ProcessedVehicleForMap) => {
    const fullVehicleData = processedVehicles.find(v => v.vehicle_id === clickedVehicle.id);
    if (fullVehicleData) {
      handleVehicleSelect(fullVehicleData);
    }
  }, [processedVehicles, handleVehicleSelect]);

  const handleRefresh = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline');
      return;
    }
    
    try {
      await Promise.allSettled([
        mutateVehicles(),
        mutateVehicleData(),
        mutateGeofences()
      ]);
      toast.success('Data refreshed');
    } catch (error: unknown) {
      console.error('Refresh error:', error);
      toast.error('Refresh failed');
    }
  }, [isOnline, mutateVehicles, mutateVehicleData, mutateGeofences]);

  // Initialize
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
    }
  }, [selectedVehicleId, selectedVehicleName, isInitialized]);

  // Auto-select first vehicle
  useEffect(() => {
    if (processedVehicles.length > 0 && !selectedVehicleId && isInitialized) {
      const vehicleToSelect = processedVehicles[0];
      if (vehicleToSelect) {
        handleVehicleSelect(vehicleToSelect);
      }
    }
  }, [processedVehicles, selectedVehicleId, handleVehicleSelect, isInitialized]);

  // Check geofence violations
  useEffect(() => {
    if (processedVehicles.length > 0 && geofences.length > 0) {
      const vehiclesWithGeofences = processedVehicles.filter(v => 
        v.geofence_id && v.isOnline && v.latestData?.latitude && v.latestData?.longitude
      );

      vehiclesWithGeofences.forEach(vehicle => {
        checkGeofenceViolations(vehicle);
      });
    }
  }, [processedVehicles, geofences, checkGeofenceViolations]);

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

  // Loading and error states
  const isLoadingInitial = vehiclesLoading && processedVehicles.length === 0;
  const isRefreshing = !isLoadingInitial && (vehiclesLoading || vehicleDataLoading || geofencesLoading);
  const hasError = !!(vehiclesError || vehicleDataError);
  const hasCriticalError = vehiclesError && processedVehicles.length === 0;

  // Loading state
  if (isLoadingInitial && !hasCriticalError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading live tracking...</p>
        </div>
      </div>
    );
  }

  // Critical error state
  if (hasCriticalError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to Load Data</h3>
            <p className="text-slate-600 mb-6">
              {vehiclesError?.message || 'An error occurred while loading data'}
            </p>
            <Button onClick={handleRefresh} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen Map Overlay */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black">
          <div className="relative w-full h-full">
            <MapComponent
              vehicles={processedVehicleForMap}
              selectedVehicleId={selectedVehicleId}
              centerCoordinates={selectedVehicleCoords}
              zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : 6}
              onVehicleClick={handleMapVehicleClick}
              onMapClick={() => {}}
              displayGeofences={processedGeofenceForMapDisplay}
              height="100%"
            />
            
            <button
              onClick={() => setMapFullscreen(false)}
              className="absolute top-4 right-4 z-50 p-3 bg-white/90 backdrop-blur rounded-lg shadow-lg hover:bg-white transition-colors"
            >
              <Minimize2 className="w-5 h-5 text-gray-700" />
            </button>

            {/* Vehicle Info Overlay in Fullscreen */}
            {selectedVehicleId && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 max-h-48 overflow-y-auto">
                {(() => {
                  const vehicle = processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
                  if (!vehicle) return null;
                  
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{vehicle.name}</h3>
                        <Badge 
                          className={`${
                            vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 
                            vehicle.status === 'parked' ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{vehicle.location}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Speed</span>
                          <p className="font-semibold">{vehicle.latestData?.speed ?? 0} km/h</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Fuel</span>
                          <p className="font-semibold">{vehicle.latestData?.fuel_level ? `${parseFloat_(vehicle.latestData.fuel_level).toFixed(0)}%` : 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Battery</span>
                          <p className="font-semibold">{vehicle.latestData?.battery_level ? `${parseFloat_(vehicle.latestData.battery_level).toFixed(1)}V` : 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4 p-4 pb-20 md:pb-4">
        {/* Geofence Violation Notification */}
        {activeAlert && (
          <GeofenceViolationNotification
            alert={activeAlert}
            onDismiss={() => setActiveAlert(null)}
          />
        )}

        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Navigation className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Live Tracking</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs sm:text-sm text-slate-600">
                  {processedVehicles.length} vehicles
                </p>
                {recentAlerts.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <Bell className="w-3 h-3 mr-1" />
                    {recentAlerts.length} Alert{recentAlerts.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Status & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
            
            <Button
              onClick={handleRefresh}
              disabled={vehicleDataLoading || !isOnline}
              size="sm"
              className="px-3 py-1"
            >
              <RefreshCw className={`w-4 h-4 ${vehicleDataLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Map - Enhanced and More Prominent */}
        <Card className="overflow-hidden shadow-lg">
          <CardContent className="p-0">
            <div className="relative h-[60vh] sm:h-[70vh] md:h-[75vh] lg:h-[calc(100vh-16rem)]">
              <MapComponent
                vehicles={processedVehicleForMap}
                selectedVehicleId={selectedVehicleId}
                centerCoordinates={selectedVehicleCoords}
                zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : 6}
                onVehicleClick={handleMapVehicleClick}
                onMapClick={() => {}}
                displayGeofences={processedGeofenceForMapDisplay}
                height="100%"
              />

              {/* Fullscreen Toggle */}
              <button
                onClick={() => setMapFullscreen(!mapFullscreen)}
                className="absolute top-4 right-4 z-50 p-2 bg-white/90 backdrop-blur rounded-lg shadow-md hover:bg-white transition-colors"
                title="Toggle fullscreen"
              >
                <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
              </button>

              {/* Mobile Vehicle List Toggle */}
              <div className="md:hidden absolute bottom-4 left-4 right-4 z-50">
                <Sheet open={vehicleListOpen} onOpenChange={setVehicleListOpen}>
                  <SheetTrigger asChild>
                    <Button className="w-full bg-white/90 backdrop-blur text-slate-800 hover:bg-white shadow-lg">
                      <List className="w-4 h-4 mr-2" />
                      {selectedVehicleName || 'Select Vehicle'} ({processedVehicles.filter(v => v.isOnline).length} online)
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh]">
                    <SheetHeader>
                      <SheetTitle>Select Vehicle</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(70vh-80px)]">
                      {processedVehicles.map((vehicle) => (
                        <MobileVehicleCard
                          key={vehicle.vehicle_id}
                          vehicle={vehicle}
                          isSelected={selectedVehicleId === vehicle.vehicle_id}
                          onClick={() => handleVehicleSelect(vehicle)}
                          assignedGeofence={selectedVehicleId === vehicle.vehicle_id ? assignedGeofenceForDisplay : undefined}
                        />
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Status overlays */}
              {vehicleDataLoading && (
                <div className="absolute top-4 left-4 z-40">
                  <Card className="bg-blue-50/95 backdrop-blur border-blue-200">
                    <CardContent className="p-2 sm:p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-blue-600" />
                        <span className="text-xs sm:text-sm text-blue-700">Updating...</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Desktop Vehicle List - Hidden on Mobile */}
        <div className="hidden md:block">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Vehicles ({processedVehicles.filter(v => v.isOnline).length} online)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {processedVehicles.map((vehicle) => (
                  <MobileVehicleCard
                    key={vehicle.vehicle_id}
                    vehicle={vehicle}
                    isSelected={selectedVehicleId === vehicle.vehicle_id}
                    onClick={() => handleVehicleSelect(vehicle)}
                    assignedGeofence={selectedVehicleId === vehicle.vehicle_id ? assignedGeofenceForDisplay : undefined}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{movingVehiclesCount}</p>
                  <p className="text-xs text-slate-500">Moving</p>
                </div>
                <Navigation className="w-5 h-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">{parkedVehiclesCount}</p>
                  <p className="text-xs text-slate-500">Parked</p>
                </div>
                <Car className="w-5 h-5 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{avgSpeed}</p>
                  <p className="text-xs text-slate-500">Avg km/h</p>
                </div>
                <Gauge className="w-5 h-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">{avgFuel}%</p>
                  <p className="text-xs text-slate-500">Avg Fuel</p>
                </div>
                <Fuel className="w-5 h-5 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}