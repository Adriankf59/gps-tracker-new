import { useState, useEffect, useMemo, useRef } from "react";
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

// Dynamically import MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

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

interface VehicleWithData extends Vehicle {
  latestData?: VehicleData;
  isOnline: boolean;
  location: string;
  status: 'moving' | 'parked' | 'offline';
}

// Processed vehicle interface for map
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
}

// Alert interface for type safety
interface Alert {
  id?: string;
  vehicle_id: string;
  alert_type: string | null;
  alert_message: string | null;
  timestamp: string;
  lokasi?: string;
}

// SWR Fetcher function
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Custom hook for vehicles data
const useVehicles = (userId?: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (err) => {
        console.error('Error fetching vehicles:', err);
        toast.error('Failed to load vehicles data');
      }
    }
  );

  return {
    vehicles: data?.data || [],
    vehiclesLoading: isLoading,
    vehiclesError: error,
    mutateVehicles: mutate
  };
};

// Custom hook for vehicle data - Fixed to avoid 403 error
const useVehicleData = (vehicles: Vehicle[]) => {
  // Extract GPS IDs from vehicles for filtering
  const gpsIds = useMemo(() => {
    return vehicles
      .map(v => v.gps_id)
      .filter(id => id && id.trim() !== '')
      .join(',');
  }, [vehicles]);

  const { data, error, isLoading, mutate } = useSWR(
    gpsIds ? `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?filter[gps_id][_in]=${gpsIds}&limit=1000&sort=-timestamp` : null,
    fetcher,
    {
      refreshInterval: 15000, // Refresh every 15 seconds for real-time tracking
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // More frequent for tracking data
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      onError: (err) => {
        console.error('Error fetching vehicle data:', err);
        // Don't show toast for vehicle data errors as they're more frequent
      }
    }
  );

  return {
    vehicleData: data?.data || [],
    vehicleDataLoading: isLoading,
    vehicleDataError: error,
    mutateVehicleData: mutate
  };
};

// Custom hook for geofences
const useGeofences = (userId?: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence?filter[user_id][_eq]=${userId}` : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute (geofences change less frequently)
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

// Custom hook for alerts
const useAlerts = () => {
  const { data, error, isLoading, mutate } = useSWR(
    'alerts',
    async () => {
      const response = await getAlerts();
      return response.data || [];
    },
    {
      refreshInterval: 20000, // Refresh every 20 seconds for alerts
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

  // Process alerts with null safety
  const processedAlerts = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map((alert: any) => ({
      id: alert.id || `alert-${Date.now()}-${Math.random()}`,
      vehicle_id: alert.vehicle_id || 'unknown',
      alert_type: alert.alert_type || null,
      alert_message: alert.alert_message || 'No message',
      timestamp: alert.timestamp || new Date().toISOString(),
      lokasi: alert.lokasi || undefined
    }));
  }, [data]);

  return {
    alerts: processedAlerts,
    alertsLoading: isLoading,
    alertsError: error,
    mutateAlerts: mutate
  };
};

export function Dashboard() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Get current user data
  interface UserData {
    id?: string;
    user_id?: string;
    full_name?: string;
    username?: string;
    email?: string;
  }
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const isInitialLoad = useRef(true);
  
  const userId = useMemo(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUserData(parsedUser);
        return parsedUser.id || parsedUser.user_id;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return undefined;
      }
    }
    return undefined;
  }, []);

  // Use SWR hooks for real-time data
  const { vehicles, vehiclesLoading, vehiclesError, mutateVehicles } = useVehicles(userId);
  const { vehicleData, vehicleDataLoading, vehicleDataError, mutateVehicleData } = useVehicleData(vehicles);
  const { geofences, geofencesLoading, geofencesError, mutateGeofences } = useGeofences(userId);
  const { alerts, alertsLoading, alertsError, mutateAlerts } = useAlerts();

  // Check if any data is loading
  const isLoading = vehiclesLoading || vehicleDataLoading;
  const hasError = vehiclesError || vehicleDataError;

  // Fungsi untuk reverse geocoding (simulasi)
  const getLocationName = (lat: string, lng: string): string => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Area Bandung (simulasi berdasarkan koordinat di data)
    if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
      if (latitude <= -6.89 && longitude >= 107.69) {
        return "Jl. Dago, Bandung";
      }
      return "Bandung, Jawa Barat";
    }
    
    // Area Jakarta (simulasi)
    if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
      return "Jakarta";
    }
    
    return `${lat}, ${lng}`;
  };

  // Fungsi untuk menentukan status kendaraan
  const getVehicleStatus = (data: VehicleData | undefined): 'moving' | 'parked' | 'offline' => {
    if (!data || !data.timestamp) return 'offline';
    
    // Check if data is recent (within last 15 minutes)
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes > 15) return 'offline';
    
    const speed = data.speed || 0;
    return speed > 0 ? 'moving' : 'parked';
  };

  // Fungsi untuk mengecek apakah kendaraan online
  const isVehicleOnline = (data: VehicleData | undefined): boolean => {
    if (!data || !data.timestamp) return false;
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes <= 15; // Online jika update dalam 15 menit terakhir
  };

  // Combine vehicles with their latest data
  const vehiclesWithData: VehicleWithData[] = useMemo(() => {
    if (!vehicles.length) return [];

    return vehicles.map((vehicle: Vehicle) => {
      // Get latest data for this vehicle - match by gps_id first, then fall back to vehicle_id
      const vehicleTrackingData = vehicleData
        .filter((data: VehicleData) =>
          (vehicle.gps_id && data.gps_id === vehicle.gps_id) ||
          data.vehicle_id === vehicle.vehicle_id
        )
        .sort((a: VehicleData, b: VehicleData) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

      const latestData = vehicleTrackingData[0];
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      if (latestData && latestData.latitude && latestData.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
      }

      return {
        ...vehicle,
        latestData,
        isOnline: online,
        location,
        status
      };
    });
  }, [vehicles, vehicleData]);

  // Process vehicles data for map component
  const processedVehiclesForMap = useMemo((): ProcessedVehicle[] => {
    return vehiclesWithData
      .filter(vehicle => vehicle.latestData && vehicle.latestData.latitude && vehicle.latestData.longitude)
      .map(vehicle => {
        const data = vehicle.latestData!;
        const lat = parseFloat(data.latitude!);
        const lng = parseFloat(data.longitude!);
        
        if (isNaN(lat) || isNaN(lng)) return null;
        
        // Determine if this is a motor/motorcycle
        const isMotor = vehicle.make?.toLowerCase().includes('motor') || 
                       vehicle.model?.toLowerCase().includes('motor') ||
                       vehicle.name?.toLowerCase().includes('motor');
        
        return {
          id: vehicle.vehicle_id,
          name: vehicle.name,
          licensePlate: vehicle.license_plate,
          position: [lat, lng] as [number, number],
          speed: data.speed || 0,
          ignition: data.ignition_status === 'ON' || data.ignition_status === 'true',
          fuel: data.fuel_level ? parseFloat(data.fuel_level) : null,
          battery: data.battery_level ? parseFloat(data.battery_level) : null,
          timestamp: data.timestamp,
          isMotor,
          make: vehicle.make || '',
          model: vehicle.model || '',
          year: vehicle.year || 0,
          status: vehicle.status
        };
      })
      .filter((vehicle): vehicle is ProcessedVehicle => vehicle !== null);
  }, [vehiclesWithData]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalVehicles = vehiclesWithData.length;
    const activeTracking = vehiclesWithData.filter(v => v.isOnline).length;
    const activeAlerts = vehiclesWithData.filter(v => {
      if (!v.latestData) return false;
      const fuelLevel = parseFloat(v.latestData.fuel_level || '0');
      const speed = v.latestData.speed || 0;
      return fuelLevel < 20 || speed > 80; // Low fuel or speeding
    }).length;

    return {
      totalVehicles,
      activeTracking,
      activeAlerts: Math.max(activeAlerts, alerts.length), // Use the higher count
      geofences: geofences.length
    };
  }, [vehiclesWithData, alerts.length, geofences.length]);

  // Handle vehicle selection from map
  const handleVehicleClick = (vehicle: ProcessedVehicle) => {
    console.log('Dashboard: Vehicle selected from map:', vehicle.name);
    setSelectedVehicleId(vehicle.id);
  };

  // Handle map reset
  const handleMapClick = () => {
    if (selectedVehicleId) {
      console.log('Dashboard: Resetting map selection');
      setSelectedVehicleId(null);
    }
  };

  // Handle vehicle selection from list
  const handleVehicleSelectFromList = (vehicleId: string) => {
    setSelectedVehicleId(prevId => prevId === vehicleId ? null : vehicleId);
  };

  // Manual refresh function
  const handleRefresh = async () => {
    console.log('Manual refresh triggered');
    await Promise.all([
      mutateVehicles(),
      mutateVehicleData(),
      mutateGeofences(),
      mutateAlerts()
    ]);
    toast.success('Data refreshed successfully');
  };

  // Helper function to safely determine alert type
  const getAlertType = (alertType: string | null): string => {
    if (!alertType || typeof alertType !== 'string') {
      return 'alert'; // default type
    }
    
    const lowerType = alertType.toLowerCase();
    if (lowerType.includes('geofence')) return 'geofence';
    if (lowerType.includes('command')) return 'command';
    return 'alert';
  };

  // Generate recent activity from alerts with proper null safety
  const generateRecentActivity = () => {
    return alerts
      .filter(alert => alert && alert.timestamp) // Filter out invalid alerts
      .map((alert, index) => ({
        id: alert.id || index + 1,
        vehicle: `Vehicle ${alert.vehicle_id || 'Unknown'}`,
        event: alert.alert_message || 'No message available',
        time: getRelativeTime(new Date(alert.timestamp)),
        type: getAlertType(alert.alert_type)
      }))
      .sort((a, b) => {
        try {
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        } catch {
          return 0; // If date parsing fails, maintain order
        }
      })
      .slice(0, 4);
  };

  const getRelativeTime = (date: Date): string => {
    try {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      return `${diffDays} days ago`;
    } catch (error) {
      console.error('Error calculating relative time:', error);
      return 'Unknown time';
    }
  };

  useEffect(() => {
    // Skip showing alerts on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
  }, []);

  // Show loading state
  if (isLoading && !vehiclesWithData.length) {
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

  // Show error state
  if (hasError && !vehiclesWithData.length) {
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
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const recentActivity = generateRecentActivity();

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
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
          <p className="text-slate-600">
            {userData ? 
              `Welcome, ${userData.full_name || userData.username || userData.email}. Here's your fleet status.` : 
              'Loading your personal dashboard...'}
          </p>
        </div>
        <div 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
          style={{ opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </div>
      </div>

      {/* Real-time indicator */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Real-time data • Last updated: {new Date().toLocaleTimeString()}</span>
        {(vehicleDataLoading || alertsLoading) && (
          <Loader2 className="w-3 h-3 animate-spin ml-2" />
        )}
      </div>

      {/* Stats Grid */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Recent Activity
              {alertsLoading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
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
                      <p className="text-xs text-slate-400">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-slate-500">No recent activity</p>
                  <p className="text-xs text-slate-400 mt-1">Activity will appear here when vehicles are active</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Online Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Online Vehicles
              {vehicleDataLoading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehiclesWithData.filter(v => v.isOnline).length > 0 ? (
                vehiclesWithData.filter(v => v.isOnline).slice(0, 3).map((vehicle) => (
                  <div 
                    key={vehicle.vehicle_id} 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedVehicleId === vehicle.vehicle_id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => handleVehicleSelectFromList(vehicle.vehicle_id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-800">{vehicle.name}</h4>
                        <Badge 
                          variant={vehicle.status === 'moving' ? 'default' : 'secondary'}
                          className={`text-xs ${
                            vehicle.status === 'moving'
                              ? 'bg-green-100 text-green-700' 
                              : vehicle.status === 'parked'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {vehicle.latestData?.speed || 0} km/h
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {vehicle.location}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-blue-500" />
                        <span>{parseFloat(vehicle.latestData?.fuel_level || '0').toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-green-500" />
                        <span>{parseFloat(vehicle.latestData?.battery_level || '0').toFixed(1)}V</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-slate-500">No vehicles online</p>
                  <p className="text-xs text-slate-400 mt-1">Online vehicles will appear here when active</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Fleet Overview Map
            {selectedVehicleId && (
              <Badge variant="outline" className="ml-auto">
                Vehicle Selected
              </Badge>
            )}
            {vehicleDataLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MapComponent
            vehicles={processedVehiclesForMap}
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