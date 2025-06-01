import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Settings
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
  gps_device_id: string;
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
  data_id: string;
  vehicle_id: string;
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

// Interface for MapComponent
interface MapVehicle {
  id: string;
  name: string;
  number: string;
  jenis_kendaraan: 'MOBIL' | 'MOTOR';
  positions: [number, number][];
  timestamps: string[];
  rawPositions?: [number, number][];
  filteredPositions?: [number, number][];
  filteredTimestamps?: string[];
  stationaryPeriods?: Array<{
    startTime: string;
    endTime: string | null;
    position: [number, number];
    duration: number | null;
  }>;
  filterStats?: {
    originalPoints: number;
    filteredPoints: number;
    reductionPercentage: number;
  };
}

export function Dashboard() {
  const [vehicles, setVehicles] = useState<VehicleWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [mapSettings, setMapSettings] = useState({
    useFilteredData: true,
    useStationaryFiltering: false,
    filterSettings: {
      distanceThreshold: 5,
      timeThreshold: 5 * 60 * 1000
    }
  });
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeTracking: 0,
    activeAlerts: 0,
    geofences: 8 // Static for now
  });

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

  // Convert vehicles data to MapComponent format
  const mapVehicles: MapVehicle[] = useMemo(() => {
    return vehicles
      .filter(vehicle => vehicle.latestData && vehicle.latestData.latitude && vehicle.latestData.longitude)
      .map(vehicle => {
        const lat = parseFloat(vehicle.latestData!.latitude!);
        const lng = parseFloat(vehicle.latestData!.longitude!);
        const position: [number, number] = [lat, lng];
        
        // Determine vehicle type based on make/model
        const vehicleType = vehicle.make?.toLowerCase().includes('motor') || 
                           vehicle.model?.toLowerCase().includes('motor') || 
                           vehicle.make?.toLowerCase().includes('honda') ||
                           vehicle.make?.toLowerCase().includes('yamaha') ||
                           vehicle.make?.toLowerCase().includes('kawasaki') ||
                           vehicle.make?.toLowerCase().includes('suzuki')
                           ? 'MOTOR' : 'MOBIL';

        // Create basic position data (for now just current position)
        // In a real application, you might fetch historical data for route tracking
        const positions: [number, number][] = [position];
        const timestamps = vehicle.latestData?.timestamp ? [vehicle.latestData.timestamp] : [];

        // Generate some sample historical data if needed
        const historicalPositions: [number, number][] = [];
        const historicalTimestamps: string[] = [];
        
        // Add some sample points around current position for demo
        if (vehicle.isOnline && vehicle.status === 'moving') {
          const baseTime = new Date(vehicle.latestData?.timestamp || new Date());
          for (let i = 5; i >= 1; i--) {
            const offsetLat = (Math.random() - 0.5) * 0.001; // Small random offset
            const offsetLng = (Math.random() - 0.5) * 0.001;
            historicalPositions.push([lat + offsetLat, lng + offsetLng]);
            const histTime = new Date(baseTime.getTime() - (i * 5 * 60 * 1000)); // 5 min intervals
            historicalTimestamps.push(histTime.toISOString());
          }
          historicalPositions.push(position);
          historicalTimestamps.push(vehicle.latestData?.timestamp || new Date().toISOString());
        }

        // Create stationary periods for parked vehicles
        const stationaryPeriods = vehicle.status === 'parked' ? [{
          startTime: vehicle.latestData?.timestamp || new Date().toISOString(),
          endTime: null,
          position,
          duration: null
        }] : [];

        return {
          id: vehicle.vehicle_id,
          name: vehicle.name,
          number: vehicle.license_plate,
          jenis_kendaraan: vehicleType,
          positions: historicalPositions.length > 0 ? historicalPositions : positions,
          timestamps: historicalTimestamps.length > 0 ? historicalTimestamps : timestamps,
          rawPositions: historicalPositions.length > 0 ? historicalPositions : positions,
          filteredPositions: positions, // Simplified for demo
          filteredTimestamps: timestamps,
          stationaryPeriods,
          filterStats: historicalPositions.length > 0 ? {
            originalPoints: historicalPositions.length,
            filteredPoints: positions.length,
            reductionPercentage: Math.round((1 - positions.length / historicalPositions.length) * 100)
          } : undefined
        };
      });
  }, [vehicles]);

  const fetchData = async (userId?: string) => {
    try {
      setLoading(true);
      
      console.log('Dashboard: Starting to fetch data for user:', userId);
      
      // Build URLs with user filter if provided
      let vehiclesUrl = '/api/vehicles';
      if (userId) {
        vehiclesUrl += `?user_id=${userId}`;
      }
      
      // Fetch vehicles and vehicle data
      const [vehiclesResponse, vehicleDataResponse] = await Promise.all([
        fetch(vehiclesUrl).catch(err => {
          console.error('Failed to fetch vehicles:', err);
          return { ok: false, json: () => Promise.resolve({ data: [] }) };
        }),
        fetch('/api/vehicle-data').catch(err => {
          console.error('Failed to fetch vehicle data:', err);
          return { ok: false, json: () => Promise.resolve({ data: [] }) };
        })
      ]);

      console.log('Dashboard: Vehicles response ok:', vehiclesResponse.ok);
      console.log('Dashboard: Vehicle data response ok:', vehicleDataResponse.ok);

      let vehiclesData = { data: [] };
      let vehicleDataData = { data: [] };

      if (vehiclesResponse.ok) {
        vehiclesData = await vehiclesResponse.json();
      } else {
        console.warn('Vehicles API failed, using empty data');
        toast.error('Failed to load vehicles data');
      }

      if (vehicleDataResponse.ok) {
        vehicleDataData = await vehicleDataResponse.json();
      } else {
        console.warn('Vehicle data API failed, using empty data');
      }

      const vehiclesList: Vehicle[] = vehiclesData.data || [];
      const vehicleDataList: VehicleData[] = vehicleDataData.data || [];

      console.log('Dashboard: Vehicles received:', vehiclesList.length);
      console.log('Dashboard: Vehicle data records received:', vehicleDataList.length);

      // Combine vehicle data with latest tracking data
      const combinedData: VehicleWithData[] = vehiclesList.map(vehicle => {
        // Get latest data for this vehicle
        const vehicleTrackingData = vehicleDataList
          .filter(data => data.vehicle_id === vehicle.vehicle_id)
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
      setLastRefresh(new Date());

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
        geofences: 8
      });

      console.log('Dashboard: Stats calculated:', { totalVehicles, activeTracking, activeAlerts });

    } catch (error) {
      console.error('Dashboard: Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setMapLoading(true);
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        await fetchData(parsedUser.user_id);
      } catch (error) {
        await fetchData();
      }
    } else {
      await fetchData();
    }
    setMapLoading(false);
    toast.success('Data refreshed successfully');
  };

  // Get user data from sessionStorage
  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log('Dashboard: User loaded:', parsedUser.user_id);
        // Fetch data with user_id filter
        fetchData(parsedUser.user_id);
        
        // Refresh data every 30 seconds
        const interval = setInterval(() => fetchData(parsedUser.user_id), 30000);
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Fallback: fetch without user filter
        fetchData();
        
        const interval = setInterval(() => fetchData(), 30000);
        return () => clearInterval(interval);
      }
    } else {
      // No user data, fetch all
      fetchData();
      
      const interval = setInterval(() => fetchData(), 30000);
      return () => clearInterval(interval);
    }
  }, []);

  // Generate recent activity from vehicle data
  const generateRecentActivity = () => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <p className="text-slate-500 text-center py-4">No recent activity</p>
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
                  <div key={vehicle.vehicle_id} className="p-4 border rounded-lg hover:bg-slate-50">
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
                <p className="text-slate-500 text-center py-4">No vehicles online</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Fleet Overview Map
              <Badge variant="outline" className="ml-2">
                {mapVehicles.length} vehicles
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500">
                Last update: {lastRefresh.toLocaleTimeString()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={mapLoading}
                className="flex items-center gap-1"
              >
                {mapLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Toggle settings or open settings modal
                  setMapSettings(prev => ({
                    ...prev,
                    useStationaryFiltering: !prev.useStationaryFiltering
                  }));
                }}
                className="flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mapVehicles.length > 0 ? (
            <div className="space-y-4">
              {/* Map Controls */}
              <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mapSettings.useFilteredData}
                    onChange={(e) => setMapSettings(prev => ({
                      ...prev,
                      useFilteredData: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Use Filtered Data
                </label>
                
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mapSettings.useStationaryFiltering}
                    onChange={(e) => setMapSettings(prev => ({
                      ...prev,
                      useStationaryFiltering: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Show Stationary Points
                </label>
                
                <div className="flex items-center gap-2 text-sm">
                  <span>Distance Threshold:</span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={mapSettings.filterSettings.distanceThreshold}
                    onChange={(e) => setMapSettings(prev => ({
                      ...prev,
                      filterSettings: {
                        ...prev.filterSettings,
                        distanceThreshold: parseInt(e.target.value)
                      }
                    }))}
                    className="w-20"
                  />
                  <span className="text-blue-600 font-medium">
                    {mapSettings.filterSettings.distanceThreshold}m
                  </span>
                </div>
              </div>
              
              {/* Map Component */}
              <div className="relative">
                {mapLoading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      <p className="text-sm text-slate-600">Updating map data...</p>
                    </div>
                  </div>
                )}
                <MapComponent
                  vehicles={mapVehicles}
                  useFilteredData={mapSettings.useFilteredData}
                  useStationaryFiltering={mapSettings.useStationaryFiltering}
                  filterSettings={mapSettings.filterSettings}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles with GPS data</h3>
                <p className="text-gray-500">
                  {vehicles.length === 0 
                    ? "No vehicles found. Add vehicles to see them on the map."
                    : "None of your vehicles have current GPS data available."
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}