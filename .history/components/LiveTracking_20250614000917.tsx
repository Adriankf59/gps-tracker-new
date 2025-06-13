"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  WifiOff
} from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import useSWR from 'swr';
import { API_BASE_URL } from '../api/file';

const MapComponent = dynamic(() => import('./MapComponent').catch(() => ({ default: () => <div>Map not available</div> })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

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

// Constants - Using same intervals as Dashboard
const INTERVALS = {
  VEHICLES: 60000,      // 60 seconds
  VEHICLE_DATA: 5000,   // 5 seconds (same as Dashboard)
  GEOFENCES: 300000,    // 5 minutes
  ALERTS: 15000         // 15 seconds
};

// API endpoints
const GEOFENCE_API = `${API_BASE_URL}/items/geofence`;
const VEHICLE_API = `${API_BASE_URL}/items/vehicle`;
const VEHICLE_DATA_API = `${API_BASE_URL}/items/vehicle_datas`;
const ALERTS_API = `${API_BASE_URL}/items/alerts`;

// Enhanced fetcher with same timeout as Dashboard
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

// Geofence detection utilities
const isPointInCircle = (point: [number, number], center: [number, number], radius: number): boolean => {
  const [pointLng, pointLat] = point;
  const [centerLng, centerLat] = center;
  
  const R = 6371000; // Earth's radius in meters
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

// Alert notification component with proper z-index
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
      className="fixed top-20 right-4 transition-all duration-300 ease-in-out"
      style={{ zIndex: 9999 }} // Ensure it's above everything including map
    >
      <Card className="w-96 shadow-2xl border-2 border-red-500 bg-red-50">
        <CardHeader className="pb-3 bg-red-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getAlertIcon(alert.alert_type)}
              <CardTitle className="text-lg font-bold text-slate-800">
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
        <CardContent className="pt-0">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
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

            <Button 
              size="sm" 
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              Tutup
            </Button>
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
  
  // State for geofence violation detection
  const [activeAlert, setActiveAlert] = useState<GeofenceAlert | null>(null);
  const [vehiclePositionHistory, setVehiclePositionHistory] = useState<Map<string, VehiclePositionHistory>>(new Map());
  const [recentAlerts, setRecentAlerts] = useState<GeofenceAlert[]>([]);
  const alertCooldownRef = useRef<Map<string, Date>>(new Map());

  const isOnline = useOnlineStatus();
  const { userData, userId } = useUser();

  // Vehicles hook with same config as Dashboard
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

  // Vehicle data hook with same config as Dashboard
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

  // Loading and error states
  const isLoadingInitial = vehiclesLoading && processedVehicles.length === 0;
  const isRefreshing = !isLoadingInitial && (vehiclesLoading || vehicleDataLoading || geofencesLoading);
  const hasError = !!(vehiclesError || vehicleDataError);
  const hasCriticalError = vehiclesError && processedVehicles.length === 0;

  // Loading state
  if (isLoadingInitial && !hasCriticalError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
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
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
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
    <div className="space-y-6 p-4 sm:p-6 bg-slate-50 min-h-screen">
      {/* Geofence Violation Notification */}
      {activeAlert && (
        <GeofenceViolationNotification
          alert={activeAlert}
          onDismiss={() => setActiveAlert(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Navigation className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Live Tracking</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Connected' : 'Offline'}
                </span>
              </div>
              
              {isOnline && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${vehicleDataLoading ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-600">
                    Last update: {lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
              )}
              
              <p className="text-sm text-slate-600">
                Fleet status ({processedVehicles.length} vehicles)
              </p>
              
              {selectedVehicleName && assignedGeofenceForDisplay && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                  <Shield className="w-3 h-3 mr-1" />
                  {assignedGeofenceForDisplay.name} ({assignedGeofenceForDisplay.rule_type})
                </Badge>
              )}
              
              {recentAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs bg-red-600 text-white">
                  <Bell className="w-3 h-3 mr-1" />
                  {recentAlerts.length} Alert{recentAlerts.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={vehicleDataLoading || !isOnline}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${vehicleDataLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Map with proper z-index */}
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden shadow-lg border rounded-xl">
            <CardContent className="p-0">
              <div 
                className="rounded-b-xl overflow-hidden m-4 border border-slate-200 relative" 
                style={{ height: 'calc(100vh - 370px)', minHeight: '450px', zIndex: 1 }}
              >
                <MapComponent
                  vehicles={processedVehicleForMap}
                  selectedVehicleId={selectedVehicleId}
                  centerCoordinates={selectedVehicleCoords}
                  zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : 6}
                  onVehicleClick={handleMapVehicleClick}
                  onMapClick={() => {}}
                  displayGeofences={processedGeofenceForMapDisplay}
                />
                
                {/* Status overlays with proper z-index */}
                {vehicleDataLoading && (
                  <div className="absolute top-4 left-4" style={{ zIndex: 1000 }}>
                    <Card className="bg-blue-50/95 backdrop-blur border-blue-200">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-sm text-blue-700">Updating...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {!isOnline && (
                  <div className="absolute top-4 left-4" style={{ zIndex: 1000 }}>
                    <Card className="bg-red-50/95 backdrop-blur border-red-200">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <WifiOff className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-700">Offline</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle List */}
        <div className="space-y-4 md:max-h-[calc(100vh-180px)] md:overflow-y-auto custom-scrollbar pr-1">
          <Card className="shadow-md border rounded-xl">
            <CardContent className="p-3 space-y-2.5 max-h-[calc(100vh-280px)] md:max-h-none overflow-y-auto md:overflow-visible custom-scrollbar-inner">
              {processedVehicles.length > 0 ? (
                processedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.vehicle_id}
                    className={`flex flex-col p-3 cursor-pointer rounded-lg transition-all duration-150 ease-in-out border hover:shadow-md
                      ${selectedVehicleId === vehicle.vehicle_id
                        ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500 shadow-lg'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    onClick={() => handleVehicleSelect(vehicle)}
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
                    {vehicle.geofence_id && selectedVehicleId === vehicle.vehicle_id && assignedGeofenceForDisplay && (
                      <div className="text-xs text-blue-600 mb-1.5 flex items-center gap-1 truncate">
                        <Shield className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate" title={`Geofence: ${assignedGeofenceForDisplay.name}`}>
                          Geofence: {assignedGeofenceForDisplay.name}
                        </span>
                      </div>
                    )}
                    
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-slate-600 mb-1.5">
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
                      <div className="flex items-center gap-1" title="Battery">
                        <Zap className="w-3 h-3 text-green-500 shrink-0" />
                        <span>
                          {vehicle.latestData?.battery_level 
                            ? `${parseFloat_(vehicle.latestData.battery_level).toFixed(1)}V` 
                            : 'N/A'
                          }
                        </span>
                      </div>
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
                ))
              ) : (
                <div className="text-center py-10">
                  <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    {hasError ? "Failed to load vehicles." : "No vehicles found."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Statistics Cards */}
      {processedVehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{movingVehiclesCount}</p>
                  <p className="text-xs text-slate-500 uppercase">Moving</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <Navigation className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{parkedVehiclesCount}</p>
                  <p className="text-xs text-slate-500 uppercase">Parked</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <Car className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{avgSpeed}</p>
                  <p className="text-xs text-slate-500 uppercase">Avg Speed (km/h)</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Gauge className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{avgFuel}</p>
                  <p className="text-xs text-slate-500 uppercase">Avg Fuel (%)</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-full">
                  <Fuel className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Real-time Status Indicator */}
      {!hasError && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
            <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-xs text-slate-600 font-medium">
              {isRefreshing ? 'Updating...' : 'Real-time active'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}