import { useState, useEffect, useMemo, useRef } from "react";
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

export function Dashboard() {
  const [vehicles, setVehicles] = useState<VehicleWithData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeTracking: 0,
    activeAlerts: 0,
    geofences: 0
  });
  
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
  const previousAlerts = useRef<Set<string>>(new Set());
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

  // Process vehicles data for map component
  const processedVehiclesForMap = useMemo((): ProcessedVehicle[] => {
    return vehicles
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
  }, [vehicles]);

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

  const fetchData = async (userId?: string) => {
    try {
      // Show refreshing indicator only for background updates
      if (hasInitialLoad) {
        setIsRefreshing(true);
      }
      
      console.log('Dashboard: Starting to fetch data for user:', userId);
      
      if (!userId) {
        console.warn('Dashboard: fetchData called without userId');
        return;
      }
      
      // Build URLs with user filter
      let vehiclesUrl = '/api/vehicles';
      vehiclesUrl += `?user_id=${userId}`;
      
      // Build vehicle-data URL with user filter if possible
      let vehicleDataUrl = '/api/vehicle-data';
      vehicleDataUrl += `?user_id=${userId}`;

      // Build geofence URL with user filter
      const geofenceUrl = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence?filter[user_id][_eq]=${userId}`;
      
      // Fetch vehicles, vehicle data, and geofences
      const [vehiclesResponse, vehicleDataResponse, geofenceResponse] = await Promise.all([
        fetch(vehiclesUrl).catch(err => {
          console.error('Failed to fetch vehicles:', err);
          return { ok: false, json: () => Promise.resolve({ data: [] }) };
        }),
        fetch(vehicleDataUrl).catch(err => {
          console.error('Failed to fetch vehicle data:', err);
          return { ok: false, json: () => Promise.resolve({ data: [] }) };
        }),
        fetch(geofenceUrl).catch(err => {
          console.error('Failed to fetch geofences:', err);
          return { ok: false, json: () => Promise.resolve({ data: [] }) };
        })
      ]);

      console.log('Dashboard: Vehicles response ok:', vehiclesResponse.ok);
      console.log('Dashboard: Vehicle data response ok:', vehicleDataResponse.ok);

      let vehiclesData = { data: [] };
      let vehicleDataData = { data: [] };
      let geofenceData = { data: [] };

      if (vehiclesResponse.ok) {
        vehiclesData = await vehiclesResponse.json();
      } else {
        console.warn('Vehicles API failed, using empty data');
        // Only show error toast on initial load or if no data exists
        if (!hasInitialLoad || vehicles.length === 0) {
          toast.error('Failed to load vehicles data');
        }
      }

      if (vehicleDataResponse.ok) {
        vehicleDataData = await vehicleDataResponse.json();
      } else {
        console.warn('Vehicle data API failed, using empty data');
      }

      if (geofenceResponse.ok) {
        geofenceData = await geofenceResponse.json();
      } else {
        console.warn('Geofence API failed, using empty data');
      }

      const vehiclesList: Vehicle[] = vehiclesData.data || [];
      const vehicleDataList: VehicleData[] = vehicleDataData.data || [];

      console.log('Dashboard: Vehicles received:', vehiclesList.length);
      console.log('Dashboard: Vehicle data records received:', vehicleDataList.length);

      // Combine vehicle data with latest tracking data
      const combinedData: VehicleWithData[] = vehiclesList.map(vehicle => {
        // Get latest data for this vehicle - match by gps_id first, then fall back to vehicle_id
        const vehicleTrackingData = vehicleDataList
          .filter(data =>
            (vehicle.gps_id && data.gps_id === vehicle.gps_id) ||
            data.vehicle_id === vehicle.vehicle_id
          )
          .sort((a, b) => {
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

      setVehicles(combinedData);

      // Calculate stats
      const totalVehicles = combinedData.length;
      const activeTracking = combinedData.filter(v => v.isOnline).length;
      const activeAlerts = combinedData.filter(v => {
        if (!v.latestData) return false;
        const fuelLevel = parseFloat(v.latestData.fuel_level || '0');
        const speed = v.latestData.speed || 0;
        return fuelLevel < 20 || speed > 80; // Low fuel or speeding
      }).length;

      setStats({
        totalVehicles,
        activeTracking,
        activeAlerts,
        geofences: geofenceData.data.length
      });

      console.log('Dashboard: Stats calculated:', { totalVehicles, activeTracking, activeAlerts });

      // Mark as loaded
      if (!hasInitialLoad) {
        setHasInitialLoad(true);
      }

    } catch (error) {
      console.error('Dashboard: Error fetching data:', error);
      // Only show error toast on initial load or critical failures
      if (!hasInitialLoad) {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch initial data and set up refresh interval
  useEffect(() => {
    if (userId) {
      console.log('Dashboard: Initial data fetch for user ID:', userId);
      fetchData(userId);

      // Set up polling interval
      const intervalId = setInterval(() => {
        fetchData(userId);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(intervalId);
    } else {
      console.warn('Dashboard: No user ID available, cannot fetch data');
      toast.error('User authentication error. Please login again.');
    }
  }, [userId]);

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

  useEffect(() => {
    // Skip showing alerts on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
  }, []);

  // Generate recent activity from vehicle data
  const generateRecentActivity = () => {
    // Clear previous alerts at the start of each generation
    const currentAlerts = new Set<string>();
    const activities: Array<{
      id: number;
      vehicle: string;
      event: string;
      time: string;
      type: 'alert' | 'geofence' | 'command';
    }> = [];
    let id = 1;

    vehicles.forEach(vehicle => {
      if (vehicle.latestData) {
        const data = vehicle.latestData;
        const fuelLevel = parseFloat(data.fuel_level || '0');
        const speed = data.speed || 0;
        const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        
        // Low fuel alert
        if (fuelLevel > 0 && fuelLevel < 20) {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: `Low fuel warning (${fuelLevel.toFixed(1)}%)`,
            time: getRelativeTime(timestamp),
            type: 'alert'
          });
          toast.error(`${vehicle.name}: Low fuel warning (${fuelLevel.toFixed(1)}%)`);
        }
        
        // Speed alert
        if (speed > 80) {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: `Speed limit exceeded (${speed} km/h)`,
            time: getRelativeTime(timestamp),
            type: 'alert'
          });
          toast.error(`${vehicle.name}: Speed limit exceeded (${speed} km/h)`);
        }
        
        // Engine status
        if (data.ignition_status === 'false') {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: 'Engine turned off',
            time: getRelativeTime(timestamp),
            type: 'command'
          });
        } else if (data.ignition_status === 'true' && speed === 0) {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: 'Vehicle parked (engine on)',
            time: getRelativeTime(timestamp),
            type: 'geofence'
          });
        }
      }
    });

    // Sort by most recent and limit to 4
    // Update previous alerts for next comparison
        if (data.ignition_status === 'false') {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: 'Engine turned off',
            time: getRelativeTime(timestamp),
            type: 'command'
          });
        } else if (data.ignition_status === 'true' && speed === 0) {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: 'Vehicle parked (engine on)',
            time: getRelativeTime(timestamp),
            type: 'geofence'
          });
        }
      }
    });

    // Sort by most recent and limit to 4
    // Update previous alerts for next comparison
    previousAlerts.current = currentAlerts;
    
    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 4);
  };

  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

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
          onClick={() => fetchData(userId)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md cursor-pointer hover:bg-slate-50"
          style={{ opacity: isRefreshing ? 0.7 : 1 }}
        >
          {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </div>
      </div>

      {/* Background refresh indicator */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Updating data...</span>
        </div>
      )}

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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehicles.filter(v => v.isOnline).length > 0 ? (
                vehicles.filter(v => v.isOnline).slice(0, 3).map((vehicle) => (
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
                      Coordinates: {vehicle.latestData?.latitude}, {vehicle.latestData?.longitude}
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