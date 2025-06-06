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
  RefreshCw
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

// ===== INTERFACES & TYPES =====
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
  make?: string;
  model?: string;
  year?: number;
  status: 'moving' | 'parked' | 'offline';
  isOnline: boolean;
  location: string;
  latestData?: VehicleData;
}

interface Alert {
  id: string;
  vehicle_id: string;
  alert_type: string | null;
  alert_message: string | null;
  timestamp: string;
  lokasi?: string;
}

interface UserData {
  id?: string;
  user_id?: string;
  full_name?: string;
  username?: string;
  email?: string;
}

interface DashboardStats {
  totalVehicles: number;
  activeTracking: number;
  activeAlerts: number;
  geofences: number;
}

// ===== CONSTANTS =====
import { API_BASE_URL } from '../api/file';

const REFRESH_INTERVALS = {
  VEHICLES: 30000,      // 30 seconds
  VEHICLE_DATA: 15000,  // 15 seconds
  GEOFENCES: 60000,     // 1 minute
  ALERTS: 20000         // 20 seconds
} as const;

const JAKARTA_BOUNDS = {
  lat: { min: -6.3, max: -6.1 },
  lng: { min: 106.7, max: 106.9 }
} as const;

const BANDUNG_BOUNDS = {
  lat: { min: -6.95, max: -6.85 },
  lng: { min: 107.55, max: 107.75 }
} as const;

// ===== UTILITY FUNCTIONS =====
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const parseFloat_ = (value: string | null | undefined): number => {
  if (!value || typeof value !== 'string') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const getLocationName = (lat: string, lng: string): string => {
  const latitude = parseFloat_(lat);
  const longitude = parseFloat_(lng);
  
  // Bandung area check
  if (latitude >= BANDUNG_BOUNDS.lat.min && latitude <= BANDUNG_BOUNDS.lat.max && 
      longitude >= BANDUNG_BOUNDS.lng.min && longitude <= BANDUNG_BOUNDS.lng.max) {
    if (latitude <= -6.89 && longitude >= 107.69) return "Jl. Dago, Bandung";
    return "Bandung, Jawa Barat";
  }
  
  // Jakarta area check
  if (latitude >= JAKARTA_BOUNDS.lat.min && latitude <= JAKARTA_BOUNDS.lat.max && 
      longitude >= JAKARTA_BOUNDS.lng.min && longitude <= JAKARTA_BOUNDS.lng.max) {
    return "Jakarta";
  }
  
  return `${lat}, ${lng}`;
};

const getVehicleStatus = (data: VehicleData | undefined): 'moving' | 'parked' | 'offline' => {
  if (!data?.timestamp) return 'offline';
  
  const lastUpdate = new Date(data.timestamp);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  if (diffMinutes > 15) return 'offline';
  return (data.speed ?? 0) > 0 ? 'moving' : 'parked';
};

const isVehicleOnline = (data: VehicleData | undefined): boolean => {
  if (!data?.timestamp) return false;
  
  const lastUpdate = new Date(data.timestamp);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  return diffMinutes <= 15;
};

const isMotorVehicle = (vehicle: Vehicle): boolean => {
  const checkStrings = [vehicle.make, vehicle.model, vehicle.name].map(s => s?.toLowerCase() || '');
  return checkStrings.some(str => str.includes('motor'));
};

const getAlertType = (alertType: string | null): string => {
  if (!alertType) return 'alert';
  
  const lower = alertType.toLowerCase();
  if (lower.includes('geofence')) return 'geofence';
  if (lower.includes('command')) return 'command';
  return 'alert';
};

const getRelativeTime = (date: Date): string => {
  try {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  } catch {
    return 'Unknown time';
  }
};

// ===== CUSTOM HOOKS =====
const useUser = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return { userData: null, userId: undefined };
    
    const userDataFromStorage = sessionStorage.getItem('user');
    if (!userDataFromStorage) return { userData: null, userId: undefined };
    
    try {
      const parsedUser: UserData = JSON.parse(userDataFromStorage);
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
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.VEHICLES,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (err) => {
        console.error('Error fetching vehicles:', err);
        toast.error('Failed to load vehicles data');
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
  const gpsIds = useMemo(() => {
    return vehicles
      .map(v => v.gps_id)
      .filter(id => id?.trim())
      .join(',');
  }, [vehicles]);

  const { data, error, isLoading, mutate } = useSWR(
    gpsIds ? `${API_BASE_URL}/items/vehicle_datas?filter[gps_id][_in]=${gpsIds}&limit=1000&sort=-timestamp` : null,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.VEHICLE_DATA,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      onError: (err) => {
        console.error('Error fetching vehicle data:', err);
      }
    }
  );

  return {
    vehicleData: (data?.data || []) as VehicleData[],
    vehicleDataLoading: isLoading,
    vehicleDataError: error,
    mutateVehicleData: mutate
  };
};

const useGeofences = (userId?: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `${API_BASE_URL}/items/geofence?filter[user_id][_eq]=${userId}` : null,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.GEOFENCES,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      errorRetryInterval: 10000,
      onError: (err) => {
        console.error('Error fetching geofences:', err);
      }
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
      dedupingInterval: 10000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (err) => {
        console.error('Error fetching alerts:', err);
      }
    }
  );

  const processedAlerts = useMemo((): Alert[] => {
    if (!Array.isArray(data)) return [];
    
    return data.map((alert: any): Alert => ({
      id: alert.id || `alert-${Date.now()}-${Math.random()}`,
      vehicle_id: alert.vehicle_id || 'unknown',
      alert_type: alert.alert_type || null,
      alert_message: alert.alert_message || 'No message',
      timestamp: alert.timestamp || new Date().toISOString(),
      lokasi: alert.lokasi || 'Unknown location'
    }));
  }, [data]);

  return {
    alerts: processedAlerts,
    alertsLoading: isLoading,
    alertsError: error,
    mutateAlerts: mutate
  };
};

// ===== MAIN COMPONENT =====
export function Dashboard() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  // Get user data and hooks
  const { userData, userId } = useUser();
  const { vehicles, vehiclesLoading, vehiclesError, mutateVehicles } = useVehicles(userId);
  const { vehicleData, vehicleDataLoading, vehicleDataError, mutateVehicleData } = useVehicleData(vehicles);
  const { geofences, geofencesLoading, geofencesError, mutateGeofences } = useGeofences(userId);
  const { alerts, alertsLoading, alertsError, mutateAlerts } = useAlerts();

  // Process vehicles with their latest data - OPTIMIZED
  const processedVehicles = useMemo((): ProcessedVehicle[] => {
    if (!vehicles.length || !vehicleData.length) return [];

    // Create a map for faster lookup of vehicle data
    const vehicleDataMap = new Map<string, VehicleData[]>();
    
    vehicleData.forEach((data) => {
      const key = data.gps_id || data.vehicle_id;
      if (!key) return;
      
      if (!vehicleDataMap.has(key)) {
        vehicleDataMap.set(key, []);
      }
      vehicleDataMap.get(key)!.push(data);
    });

    // Sort data for each vehicle once
    vehicleDataMap.forEach((dataArray) => {
      dataArray.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    });

    return vehicles.map((vehicle): ProcessedVehicle => {
      // Get latest data for this vehicle
      const vehicleTrackingData = vehicleDataMap.get(vehicle.gps_id) || 
                                  vehicleDataMap.get(vehicle.vehicle_id) || 
                                  [];
      
      const latestData = vehicleTrackingData[0];
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
        isMotor: isMotorVehicle(vehicle),
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

  // Filter vehicles for map (only those with valid coordinates)
  const vehiclesForMap = useMemo((): ProcessedVehicle[] => {
    return processedVehicles.filter(vehicle => 
      vehicle.position[0] !== 0 && vehicle.position[1] !== 0
    );
  }, [processedVehicles]);

  // Calculate stats - OPTIMIZED
  const stats = useMemo((): DashboardStats => {
    const totalVehicles = processedVehicles.length;
    const activeTracking = processedVehicles.filter(v => v.isOnline).length;
    
    // Count alerts from vehicle data and external alerts
    const vehicleAlerts = processedVehicles.filter(v => {
      if (!v.latestData) return false;
      const fuelLevel = v.fuel ?? 0;
      const speed = v.speed ?? 0;
      return fuelLevel < 20 || speed > 80;
    }).length;
    
    return {
      totalVehicles,
      activeTracking,
      activeAlerts: Math.max(vehicleAlerts, alerts.length),
      geofences: geofences.length
    };
  }, [processedVehicles, alerts.length, geofences.length]);

  // Generate recent activity - OPTIMIZED
  const recentActivity = useMemo(() => {
    return alerts
      .filter(alert => alert.timestamp)
      .map((alert) => {
        const timestamp = new Date(alert.timestamp);
        return {
          id: alert.id,
          vehicle: `Vehicle ${alert.vehicle_id}`,
          event: alert.alert_message || 'No message available',
          time: timestamp.toISOString(),
          timeDisplay: getRelativeTime(timestamp),
          type: getAlertType(alert.alert_type)
        };
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 4);
  }, [alerts]);

  // Online vehicles for display - OPTIMIZED
  const onlineVehicles = useMemo(() => {
    return processedVehicles.filter(v => v.isOnline).slice(0, 3);
  }, [processedVehicles]);

  // Event handlers
  const handleVehicleClick = useCallback((vehicle: ProcessedVehicle) => {
    console.log('Dashboard: Vehicle selected from map:', vehicle.name);
    setSelectedVehicleId(vehicle.id);
  }, []);

  const handleMapClick = useCallback(() => {
    if (selectedVehicleId) {
      console.log('Dashboard: Resetting map selection');
      setSelectedVehicleId(null);
    }
  }, [selectedVehicleId]);

  const handleVehicleSelectFromList = useCallback((vehicleId: string) => {
    setSelectedVehicleId(prevId => prevId === vehicleId ? null : vehicleId);
  }, []);

  const handleRefresh = useCallback(async () => {
    console.log('Manual refresh triggered');
    await Promise.all([
      mutateVehicles(),
      mutateVehicleData(),
      mutateGeofences(),
      mutateAlerts()
    ]);
    toast.success('Data refreshed successfully');
  }, [mutateVehicles, mutateVehicleData, mutateGeofences, mutateAlerts]);

  // Loading and error states
  const isLoadingOverall = vehiclesLoading || vehicleDataLoading;
  const hasErrorOverall = vehiclesError || vehicleDataError;

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
  }, []);

  // Loading state
  if (isLoadingOverall && !processedVehicles.length) {
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

  // Error state
  if (hasErrorOverall && !processedVehicles.length) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to Load Data</h3>
          <p className="text-slate-600 mb-6">Unable to fetch dashboard data. Please try again.</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" /> Retry
          </button>
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
      {/* Stats Cards - Direct start without headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${
                stat.color === 'blue' ? 'bg-blue-100' : 
                stat.color === 'green' ? 'bg-green-100' : 
                stat.color === 'red' ? 'bg-red-100' : 
                'bg-purple-100'
              }`}>
                <stat.icon className={`w-4 h-4 ${
                  stat.color === 'blue' ? 'text-blue-600' : 
                  stat.color === 'green' ? 'text-green-600' : 
                  stat.color === 'red' ? 'text-red-600' : 
                  'text-purple-600'
                }`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
              <p className="text-xs text-slate-500 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity and Online Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> Recent Activity
              {alertsLoading && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === 'alert' ? 'bg-red-500' : 
                      activity.type === 'geofence' ? 'bg-blue-500' : 
                      'bg-green-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-slate-800">
                          {activity.vehicle}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {activity.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{activity.event}</p>
                      <p className="text-xs text-slate-400">{activity.timeDisplay}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-slate-500">No recent activity</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Activity will appear here when vehicles are active
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Online Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" /> Online Vehicles
              {vehicleDataLoading && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {onlineVehicles.length > 0 ? (
                onlineVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedVehicleId === vehicle.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => handleVehicleSelectFromList(vehicle.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-800">{vehicle.name}</h4>
                        <Badge 
                          variant={vehicle.status === 'moving' ? 'default' : 'secondary'} 
                          className={`text-xs ${
                            vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 
                            vehicle.status === 'parked' ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {vehicle.speed} km/h
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{vehicle.location}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-blue-500" />
                        <span>{(vehicle.fuel ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-green-500" />
                        <span>{(vehicle.battery ?? 0).toFixed(1)}V</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-slate-500">No vehicles online</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Online vehicles will appear here when active
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" /> Fleet Overview Map
            {selectedVehicleId && (
              <Badge variant="outline" className="ml-auto">Vehicle Selected</Badge>
            )}
            {vehicleDataLoading && (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MapComponent
            vehicles={vehiclesForMap}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleClick}
            onMapClick={handleMapClick}
            height="500px"
          />
        </CardContent>
      </Card>
    </div>
  );
}