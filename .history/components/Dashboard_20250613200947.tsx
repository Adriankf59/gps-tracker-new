import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import useSWR from 'swr';
import { getAlerts } from "@/lib/alertService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  MapPin,
  AlertTriangle,
  Shield,
  Fuel,
  Zap,
  Clock,
  TrendingUp,
  Loader2,
  RefreshCw,
  Navigation,
  Wifi,
  WifiOff
} from "lucide-react";
import { toast } from "sonner";
import dynamic from 'next/dynamic';

// Dynamically import MapComponent with better loading state
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

// Types
interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at: string;
  updated_at: string;
  vehicle_photo: string;
}

interface VehicleData {
  vehicle_datas_id: string;
  gps_id: string | null;
  vehicle_id?: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used: number | null;
}

interface ProcessedVehicle {
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
  make: string;
  model: string;
  year: number;
  status: 'moving' | 'parked' | 'offline';
  isOnline: boolean;
  location: string;
  latestData?: VehicleData;
}

// Constants - OPTIMIZED for real-time
import { API_BASE_URL } from '../api/file';

const REFRESH_INTERVALS = {
  VEHICLES: 60000,      // 1 minute (vehicles don't change often)
  VEHICLE_DATA: 5000,   // 5 seconds (MUCH MORE FREQUENT for real-time tracking)
  GEOFENCES: 300000,    // 5 minutes (geofences rarely change)
  ALERTS: 10000         // 10 seconds (alerts need to be timely)
} as const;

// Network status tracking
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);
  
  return isOnline;
};

// Enhanced fetcher with better error handling
const fetcher = async (url: string) => {
  try {
    const response = await fetch(url, {
      // Add cache busting for real-time data
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value || typeof value !== 'string') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const getLocationName = (lat: string, lng: string): string => {
  const latitude = parseFloat_(lat);
  const longitude = parseFloat_(lng);
  
  // Bandung area check
  if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
    return "Bandung, Jawa Barat";
  }
  
  // Jakarta area check  
  if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
    return "Jakarta";
  }
  
  return `${lat}, ${lng}`;
};

const getVehicleStatus = (data: VehicleData | undefined): 'moving' | 'parked' | 'offline' => {
  if (!data?.timestamp) return 'offline';
  
  const lastUpdate = new Date(data.timestamp);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  // Reduced offline threshold for more responsive status
  if (diffMinutes > 5) return 'offline';
  return (data.speed ?? 0) > 0 ? 'moving' : 'parked';
};

const isVehicleOnline = (data: VehicleData | undefined): boolean => {
  if (!data?.timestamp) return false;
  
  const lastUpdate = new Date(data.timestamp);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  // Reduced threshold for more responsive online status
  return diffMinutes <= 5;
};

// Custom hooks with enhanced real-time capabilities
const useUser = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return { userData: null, userId: undefined };
    
    const userDataFromStorage = sessionStorage.getItem('user');
    if (!userDataFromStorage) return { userData: null, userId: undefined };
    
    try {
      const parsedUser = JSON.parse(userDataFromStorage);
      return {
        userData: parsedUser,
        userId: parsedUser.id || parsedUser.user_id
      };
    } catch {
      return { userData: null, userId: undefined };
    }
  }, []);
};

const useVehicles = (userId?: string) => {
  const isOnline = useOnlineStatus();
  
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.VEHICLES,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      // Enhanced error handling
      errorRetryCount: 5,
      errorRetryInterval: 3000,
      dedupingInterval: 5000,
      // Continue polling when offline for immediate reconnection
      refreshWhenOffline: true,
      refreshWhenHidden: false,
      onError: (err) => {
        console.error('Error fetching vehicles:', err);
        if (isOnline) {
          toast.error('Failed to load vehicles data');
        }
      },
      onSuccess: () => {
        // Clear any previous error toasts when successful
        if (isOnline) {
          console.log('Vehicles data loaded successfully');
        }
      }
    }
  );

  return {
    vehicles: (data?.data || []) as Vehicle[],
    vehiclesLoading: isLoading,
    vehiclesError: error,
    mutateVehicles: mutate
  };
};

const useVehicleData = (vehicles: Vehicle[]) => {
  const isOnline = useOnlineStatus();
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  
  const gpsIds = useMemo(() => {
    return vehicles
      .map(v => v.gps_id)
      .filter(id => id?.trim())
      .join(',');
  }, [vehicles]);

  const { data, error, isLoading, mutate } = useSWR(
    gpsIds ? `${API_BASE_URL}/items/vehicle_datas?filter[gps_id][_in]=${gpsIds}&limit=1000&sort=-timestamp&t=${Date.now()}` : null,
    fetcher,
    {
      // MUCH MORE FREQUENT updates for real-time tracking
      refreshInterval: REFRESH_INTERVALS.VEHICLE_DATA,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      // Aggressive revalidation for real-time data
      dedupingInterval: 1000, // Very short deduping
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      // Continue trying even when offline
      refreshWhenOffline: true,
      refreshWhenHidden: true, // Continue updating even when hidden
      focusThrottleInterval: 1000, // Reduce throttling
      onError: (err) => {
        console.error('Error fetching vehicle data:', err);
        // Don't show toast for every error to avoid spam
      },
      onSuccess: (data) => {
        setLastUpdateTime(new Date());
        console.log(`Vehicle data updated: ${data?.data?.length || 0} records`);
      }
    }
  );

  return {
    vehicleData: (data?.data || []) as VehicleData[],
    vehicleDataLoading: isLoading,
    vehicleDataError: error,
    mutateVehicleData: mutate,
    lastUpdateTime
  };
};

const useGeofences = (userId?: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `${API_BASE_URL}/items/geofence?filter[user_id][_eq]=${userId}` : null,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.GEOFENCES,
      revalidateOnFocus: false, // Geofences don't change often
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      errorRetryInterval: 10000
    }
  );

  return {
    geofences: data?.data || [],
    geofencesLoading: isLoading,
    geofencesError: error,
    mutateGeofences: mutate
  };
};

const useAlerts = () => {
  const { data, error, isLoading, mutate } = useSWR(
    'alerts',
    async () => {
      const response = await getAlerts();
      return response.data || [];
    },
    {
      refreshInterval: REFRESH_INTERVALS.ALERTS,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      refreshWhenHidden: true // Keep updating alerts even when hidden
    }
  );

  return {
    alerts: data || [],
    alertsLoading: isLoading,
    alertsError: error,
    mutateAlerts: mutate
  };
};

export function Dashboard() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const isOnline = useOnlineStatus();
  
  // Get user data and hooks
  const { userData, userId } = useUser();
  const { vehicles, vehiclesLoading, vehiclesError, mutateVehicles } = useVehicles(userId);
  const { vehicleData, vehicleDataLoading, vehicleDataError, mutateVehicleData, lastUpdateTime } = useVehicleData(vehicles);
  const { geofences, geofencesLoading, geofencesError, mutateGeofences } = useGeofences(userId);
  const { alerts, alertsLoading, alertsError, mutateAlerts } = useAlerts();

  // Auto-refresh mechanism with visual feedback
  useEffect(() => {
    if (!isFirstLoad && !vehicleDataLoading) {
      // Show subtle update notification
      const updateMessage = `Data updated at ${lastUpdateTime.toLocaleTimeString()}`;
      console.log(updateMessage);
    }
  }, [lastUpdateTime, vehicleDataLoading, isFirstLoad]);

  useEffect(() => {
    if (isFirstLoad && vehicleData.length > 0) {
      setIsFirstLoad(false);
    }
  }, [vehicleData, isFirstLoad]);

  // Enhanced vehicle processing with better optimization
  const processedVehicles = useMemo((): ProcessedVehicle[] => {
    if (!vehicles.length) return [];

    // Create optimized lookup map
    const vehicleDataMap = new Map<string, VehicleData>();
    
    // Use latest data for each vehicle
    vehicleData.forEach((data) => {
      const key = data.gps_id || data.vehicle_id;
      if (!key) return;
      
      const existing = vehicleDataMap.get(key);
      if (!existing || !data.timestamp || !existing.timestamp || 
          new Date(data.timestamp) > new Date(existing.timestamp)) {
        vehicleDataMap.set(key, data);
      }
    });

    return vehicles.map((vehicle): ProcessedVehicle => {
      const latestData = vehicleDataMap.get(vehicle.gps_id) || vehicleDataMap.get(vehicle.vehicle_id);
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      let position: [number, number] = [0, 0];
      
      if (latestData?.latitude && latestData?.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
        const lat = parseFloat_(latestData.latitude);
        const lng = parseFloat_(latestData.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          position = [lat, lng];
        }
      }

      return {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        licensePlate: vehicle.license_plate,
        position,
        speed: latestData?.speed ?? 0,
        ignition: latestData?.ignition_status === 'ON' || latestData?.ignition_status === 'true',
        fuel: latestData?.fuel_level ? parseFloat_(latestData.fuel_level) : null,
        battery: latestData?.battery_level ? parseFloat_(latestData.battery_level) : null,
        timestamp: latestData?.timestamp || null,
        isMotor: vehicle.make?.toLowerCase().includes('motor') || vehicle.model?.toLowerCase().includes('motor'),
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || 0,
        status,
        isOnline: online,
        location,
        latestData
      };
    });
  }, [vehicles, vehicleData]);

  // Filter vehicles for map
  const vehiclesForMap = useMemo((): ProcessedVehicle[] => {
    return processedVehicles.filter(vehicle => 
      vehicle.position[0] !== 0 && vehicle.position[1] !== 0
    );
  }, [processedVehicles]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalVehicles = processedVehicles.length;
    const activeTracking = processedVehicles.filter(v => v.isOnline).length;
    const alertCount = processedVehicles.filter(v => {
      const fuelLevel = v.fuel ?? 0;
      const speed = v.speed ?? 0;
      return fuelLevel < 20 || speed > 80;
    }).length;
    
    return {
      totalVehicles,
      activeTracking,
      activeAlerts: Math.max(alertCount, alerts.length),
      geofences: geofences.length
    };
  }, [processedVehicles, alerts.length, geofences.length]);

  // Event handlers
  const handleVehicleClick = useCallback((vehicle: ProcessedVehicle) => {
    setSelectedVehicleId(vehicle.id);
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedVehicleId(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    console.log('Manual refresh triggered');
    const promises = [
      mutateVehicles(),
      mutateVehicleData(),
      mutateGeofences(),
      mutateAlerts()
    ];
    
    try {
      await Promise.all(promises);
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    }
  }, [mutateVehicles, mutateVehicleData, mutateGeofences, mutateAlerts]);

  // Force refresh every 30 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (userId && isOnline) {
        mutateVehicleData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, isOnline, mutateVehicleData]);

  // Loading state
  if ((vehiclesLoading || vehicleDataLoading) && !processedVehicles.length) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 text-lg">Loading dashboard...</p>
          <p className="text-slate-500 text-sm mt-2">Fetching real-time data</p>
        </div>
      </div>
    );
  }

  const dashboardStats = [
    { 
      title: "Total Vehicles", 
      value: stats.totalVehicles.toString(), 
      change: `${stats.activeTracking} online`, 
      icon: Car, 
      color: "blue" as const 
    },
    { 
      title: "Active Tracking", 
      value: stats.activeTracking.toString(), 
      change: `${stats.totalVehicles - stats.activeTracking} offline`, 
      icon: MapPin, 
      color: "green" as const 
    },
    { 
      title: "Active Alerts", 
      value: stats.activeAlerts.toString(), 
      change: "Fuel & Speed alerts", 
      icon: AlertTriangle, 
      color: "red" as const 
    },
    { 
      title: "Geofences", 
      value: stats.geofences.toString(), 
      change: "All active", 
      icon: Shield, 
      color: "purple" as const 
    }
  ];

  return (
    <div className="space-y-6">
      {/* Connection Status & Real-time Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${vehicleDataLoading ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-600">
              Last update: {lastUpdateTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={vehicleDataLoading}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${vehicleDataLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Full Screen Map */}
      <div className="relative h-[calc(100vh-16rem)] w-full rounded-lg overflow-hidden bg-gray-100">
        <div className="absolute inset-0 z-0">
          <MapComponent
            vehicles={vehiclesForMap}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleClick}
            onMapClick={handleMapClick}
            height="100%"
            // Force re-render when vehicle data changes
            key={`map-${lastUpdateTime.getTime()}`}
          />
        </div>

        {/* Real-time update indicator */}
        {vehicleDataLoading && (
          <div className="absolute top-4 left-4 z-50">
            <Card className="bg-blue-50/95 backdrop-blur-sm border-blue-200 shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700">Updating positions...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${
                  stat.color === 'blue' ? 'bg-blue-100' : 
                  stat.color === 'green' ? 'bg-green-100' : 
                  stat.color === 'red' ? 'bg-red-100' : 
                  'bg-purple-100'
                }`}>
                  <stat.icon className={`w-6 h-6 ${
                    stat.color === 'blue' ? 'text-blue-600' : 
                    stat.color === 'green' ? 'text-green-600' : 
                    stat.color === 'red' ? 'text-red-600' : 
                    'text-purple-600'
                  }`} />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-600">{stat.title}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
                </div>
                <p className="text-xs text-slate-500">{stat.change}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section - Vehicle List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-green-600" /> 
            Live Vehicle Status ({processedVehicles.filter(v => v.isOnline).length} online)
            {vehicleDataLoading && (
              <Loader2 className="w-4 h-4 animate-spin ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {processedVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className={`p-3 border rounded cursor-pointer transition-all ${
                    selectedVehicleId === vehicle.id 
                      ? 'bg-blue-50 border-blue-200 shadow-md' 
                      : vehicle.isOnline 
                        ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleVehicleClick(vehicle)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-slate-800">{vehicle.name}</h4>
                    <Badge 
                      variant={vehicle.status === 'moving' ? 'default' : 'secondary'} 
                      className={`text-xs ${
                        vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 
                        vehicle.status === 'parked' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}
                    >
                      {vehicle.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mb-2 truncate">{vehicle.location}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-blue-600">{vehicle.speed} km/h</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-blue-500" />
                        <span>{(vehicle.fuel ?? 0).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-green-500" />
                        <span>{(vehicle.battery ?? 0).toFixed(1)}V</span>
                      </div>
                    </div>
                  </div>
                  {vehicle.timestamp && (
                    <p className="text-xs text-gray-400 mt-1">
                      Updated: {new Date(vehicle.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}