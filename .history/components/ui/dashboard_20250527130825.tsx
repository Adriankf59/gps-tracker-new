'use client';

import { useState, useEffect } from "react";
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
  Loader2
} from "lucide-react";
import { toast } from "sonner";

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
}

export function Dashboard() {
  const [vehicles, setVehicles] = useState<VehicleWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeTracking: 0,
    activeAlerts: 0,
    geofences: 8 // Static for now
  });

  // Fungsi untuk reverse geocoding (simulasi)
  const getLocationName = (lat: string, lng: string): string => {
    // Dalam implementasi nyata, gunakan service seperti Google Maps Geocoding API
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Area Bandung (simulasi)
    if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
      return "Bandung, Jawa Barat";
    }
    return `${lat}, ${lng}`;
  };

  // Fungsi untuk menentukan status kendaraan
  const getVehicleStatus = (data: VehicleData | undefined): string => {
    if (!data || !data.speed) return 'offline';
    return data.speed > 0 ? 'moving' : 'parked';
  };

  // Fungsi untuk mengecek apakah kendaraan online
  const isVehicleOnline = (data: VehicleData | undefined): boolean => {
    if (!data || !data.timestamp) return false;
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes <= 15; // Online jika update dalam 15 menit terakhir
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch vehicles and vehicle data
      const [vehiclesResponse, vehicleDataResponse] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/vehicle-data')
      ]);

      if (!vehiclesResponse.ok || !vehicleDataResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const vehiclesData = await vehiclesResponse.json();
      const vehicleDataData = await vehicleDataResponse.json();

      const vehiclesList: Vehicle[] = vehiclesData.data || [];
      const vehicleDataList: VehicleData[] = vehicleDataData.data || [];

      // Combine vehicle data with latest tracking data
      const combinedData: VehicleWithData[] = vehiclesList.map(vehicle => {
        // Get latest data for this vehicle
        const vehicleTrackingData = vehicleDataList
          .filter(data => data.vehicle_id === vehicle.vehicle_id)
          .sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });

        const latestData = vehicleTrackingData[0];
        const online = isVehicleOnline(latestData);
        
        let location = 'Location unknown';
        if (latestData && latestData.latitude && latestData.longitude) {
          location = getLocationName(latestData.latitude, latestData.longitude);
        }

        return {
          ...vehicle,
          latestData,
          isOnline: online,
          location
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
        geofences: 8
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Generate recent activity from vehicle data
  const generateRecentActivity = () => {
    const activities = [];
    let id = 1;

    vehicles.forEach(vehicle => {
      if (vehicle.latestData) {
        const data = vehicle.latestData;
        const fuelLevel = parseFloat(data.fuel_level || '0');
        const speed = data.speed || 0;
        
        if (fuelLevel < 20) {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: `Low fuel warning (${fuelLevel.toFixed(1)}%)`,
            time: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown',
            type: 'alert'
          });
        }
        
        if (speed > 80) {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: `Speed limit exceeded (${speed} km/h)`,
            time: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown',
            type: 'alert'
          });
        }
        
        if (data.ignition_status === 'false') {
          activities.push({
            id: id++,
            vehicle: vehicle.name,
            event: 'Engine turned off',
            time: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown',
            type: 'command'
          });
        }
      }
    });

    return activities.slice(0, 4); // Show only 4 recent activities
  };

  const recentActivity = generateRecentActivity();

  const dashboardStats = [
    {
      title: "Total Vehicles",
      value: stats.totalVehicles.toString(),
      change: `${vehicles.filter(v => v.isOnline).length} online`,
      icon: Car,
      color: "blue"
    },
    {
      title: "Active Tracking",
      value: stats.activeTracking.toString(),
      change: `${stats.totalVehicles - stats.activeTracking} offline`,
      icon: MapPin,
      color: "green"
    },
    {
      title: "Active Alerts",
      value: stats.activeAlerts.toString(),
      change: "Fuel & Speed alerts",
      icon: AlertTriangle,
      color: "red"
    },
    {
      title: "Geofences",
      value: stats.geofences.toString(),
      change: "All active",
      icon: Shield,
      color: "purple"
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
                          variant={getVehicleStatus(vehicle.latestData) === 'moving' ? 'default' : 'secondary'}
                          className={`text-xs ${
                            getVehicleStatus(vehicle.latestData) === 'moving'
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {getVehicleStatus(vehicle.latestData)}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {vehicle.latestData?.speed || 0} km/h
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{vehicle.location}</p>
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

      {/* Map Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Fleet Overview Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-200">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-blue-600 mb-2">Interactive Map</h3>
              <p className="text-blue-500">Real-time vehicle locations will be displayed here</p>
              <p className="text-sm text-blue-400 mt-2">
                {vehicles.filter(v => v.latestData?.latitude && v.latestData?.longitude).length} vehicles with GPS data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}