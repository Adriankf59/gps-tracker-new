import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, MapPin, Clock, Car, Route } from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamically import MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false
});

interface Vehicle {
  vehicle_id: string;
  user_id: string;
  name: string;
  license_plate: string;
}

interface VehicleData {
  vehicle_id: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  speed: number;
}

export function HistoryManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | undefined>(undefined);

  // Get current user
  const getCurrentUser = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // Fetch vehicles
  const fetchVehicles = async (userId: string) => {
    try {
      const response = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      
      const data = await response.json();
      const userVehicles = data.data.filter((v: Vehicle) => v.user_id === userId);
      setVehicles(userVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // Fetch vehicle data with date range filter
  const fetchVehicleData = async (vehicleId: string, from?: Date, to?: Date) => {
    try {
      let url = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?limit=-1';
      
      // Add filters
      const filters = [];
      if (vehicleId) {
        filters.push(`filter[vehicle_id][_eq]=${vehicleId}`);
      }
      if (from && to) {
        filters.push(`filter[timestamp][_between]=${from.toISOString()},${to.toISOString()}`);
      }
      
      if (filters.length > 0) {
        url += '&' + filters.join('&');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicle data');
      }

      const data = await response.json();
      // Sort data by timestamp
      const sortedData = data.data.sort((a: VehicleData, b: VehicleData) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setVehicleData(sortedData);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const user = getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const userId = user.id || user.user_id;
      if (!userId) {
        setLoading(false);
        return;
      }

      await fetchVehicles(userId);
      setLoading(false);
    };

    loadData();
  }, []);

  // Fetch vehicle data when vehicle or date range changes
  useEffect(() => {
    if (selectedVehicle) {
      fetchVehicleData(selectedVehicle, dateRange?.from, dateRange?.to);
    }
  }, [selectedVehicle, dateRange]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate route statistics
  const calculateStats = () => {
    if (!vehicleData.length) return { distance: 0, duration: 0, avgSpeed: 0 };

    let totalDistance = 0;
    let totalSpeed = 0;
    const startTime = new Date(vehicleData[0].timestamp);
    const endTime = new Date(vehicleData[vehicleData.length - 1].timestamp);

    // Calculate distance and average speed
    for (let i = 1; i < vehicleData.length; i++) {
      const prev = vehicleData[i - 1];
      const curr = vehicleData[i];
      
      // Calculate distance between points using Haversine formula
      const distance = calculateDistance(
        parseFloat(prev.latitude),
        parseFloat(prev.longitude),
        parseFloat(curr.latitude),
        parseFloat(curr.longitude)
      );
      
      totalDistance += distance;
      totalSpeed += curr.speed;
    }

    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours
    const avgSpeed = totalSpeed / vehicleData.length;

    return {
      distance: totalDistance.toFixed(2),
      duration: duration.toFixed(1),
      avgSpeed: avgSpeed.toFixed(1)
    };
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const stats = calculateStats();

  // Prepare route data for map
  const routeData = vehicleData.map(data => ({
    position: [parseFloat(data.latitude), parseFloat(data.longitude)] as [number, number],
    timestamp: data.timestamp,
    speed: data.speed
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Travel History</h2>
          <p className="text-slate-600">View and analyze vehicle travel routes</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Select Vehicle
              </label>
              <select
                className="w-full rounded-md border border-slate-200 p-2"
                value={selectedVehicle || ''}
                onChange={(e) => setSelectedVehicle(e.target.value)}
              >
                <option value="">Choose a vehicle...</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {vehicle.name} ({vehicle.license_plate})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="rounded-md border border-slate-200 p-2"
                  value={dateRange?.from?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setDateRange(prev => ({
                    from: new Date(e.target.value),
                    to: prev?.to || new Date()
                  }))}
                />
                <input
                  type="date"
                  className="rounded-md border border-slate-200 p-2"
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedVehicle && vehicleData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Distance</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.distance} km</p>
                </div>
                <Route className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Duration</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.duration} hours</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Average Speed</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.avgSpeed} km/h</p>
                </div>
                <Car className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Route Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[500px] flex items-center justify-center bg-slate-50 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !selectedVehicle ? (
            <div className="h-[500px] flex items-center justify-center bg-slate-50 rounded-lg">
              <div className="text-center">
                <Car className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600">Select a vehicle to view its route</p>
              </div>
            </div>
          ) : vehicleData.length === 0 ? (
            <div className="h-[500px] flex items-center justify-center bg-slate-50 rounded-lg">
              <div className="text-center">
                <History className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600">No route data available</p>
                <p className="text-sm text-slate-500">Try selecting a different date range</p>
              </div>
            </div>
          ) : (
            <div className="h-[500px]">
              <MapComponent
                route={routeData}
                height="500px"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journey Details */}
      {selectedVehicle && vehicleData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Journey Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehicleData.map((data, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50"
                >
                  <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-slate-800">
                        {formatDate(data.timestamp)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {data.speed} km/h
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      Location: {data.latitude}, {data.longitude}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
