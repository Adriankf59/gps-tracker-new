"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, MapPin, Clock, Car, Route, Loader2, RefreshCw, Calendar } from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from "sonner";

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
  gps_id: string | null;
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
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
  status: 'moving' | 'parked' | 'offline';
}

export function HistoryManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | undefined>(undefined);

  // Initialize with today's date range
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    setDateRange({
      from: yesterday,
      to: today
    });
  }, []);

  // Get current user
  const getCurrentUser = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // Get auth token
  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    } catch (e) {
      console.warn("Failed to access sessionStorage/localStorage:", e);
      return null;
    }
  };

  // Fetch vehicles for current user
  const fetchVehicles = async (userId: string) => {
    try {
      console.log('Fetching vehicles for user:', userId);
      const token = getAuthToken();
      const url = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicles: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Vehicles received:', data.data?.length || 0);
      
      if (data.data && Array.isArray(data.data)) {
        setVehicles(data.data);
        if (!selectedVehicle && data.data.length > 0) {
          setSelectedVehicle(data.data[0].vehicle_id);
        }
      } else {
        setVehicles([]);
        toast.info('No vehicles found for your account');
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load vehicles';
      toast.error(errorMessage);
      setVehicles([]);
    }
  };

  // Fetch vehicle data
  const fetchVehicleData = async (vehicleId: string, from?: Date, to?: Date) => {
    if (!vehicleId) return;
    
    setLoadingData(true);
    try {
      console.log('Fetching vehicle data for:', vehicleId);
      
      const selectedVehicleData = vehicles.find(v => v.vehicle_id === vehicleId);
      const gpsId = selectedVehicleData?.gps_id;
      
      if (!gpsId) {
        console.warn('No GPS ID found for vehicle:', vehicleId);
        toast.error('Vehicle does not have GPS tracking enabled');
        setVehicleData([]);
        return;
      }
      
      const token = getAuthToken();
      const baseUrl = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas`;
      
      const params = new URLSearchParams({
        'limit': '5000',
        'sort': 'timestamp',
        'filter[gps_id][_eq]': gpsId
      });
      
      if (from && to) {
        params.append('filter[timestamp][_between]', `${from.toISOString()},${to.toISOString()}`);
      }
      
      const url = `${baseUrl}?${params.toString()}`;
      console.log('Fetching from URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicle data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Vehicle data received:', data.data?.length || 0, 'records');

      if (data.data && Array.isArray(data.data)) {
        processVehicleData(data.data);
      } else {
        console.warn('No vehicle data received');
        setVehicleData([]);
        toast.info('No tracking data available for the selected period');
      }
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load vehicle tracking data';
      toast.error(errorMessage);
      setVehicleData([]);
    } finally {
      setLoadingData(false);
    }
  };

  // Process vehicle data
  const processVehicleData = (rawData: VehicleData[]) => {
    console.log('Processing vehicle data:', rawData.length, 'raw records');
    
    const validData = rawData.filter((item: VehicleData) => 
      item.latitude && 
      item.longitude && 
      item.timestamp &&
      !isNaN(parseFloat(item.latitude)) &&
      !isNaN(parseFloat(item.longitude))
    );
    
    const sortedData = validData.sort((a: VehicleData, b: VehicleData) => 
      new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
    );
    
    console.log('Final processed data points:', sortedData.length);
    setVehicleData(sortedData);
    
    if (sortedData.length === 0) {
      toast.info('No tracking data found for the selected period');
    } else if (sortedData.length > 1000) {
      toast.info(`Large dataset loaded (${sortedData.length} points). Map will show optimized route.`);
    } else {
      toast.success(`Loaded ${sortedData.length} tracking points successfully`);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        const user = getCurrentUser();
        
        if (!user) {
          console.error('No user found in session');
          toast.error('Please login to view history');
          return;
        }

        const userId = user.id || user.user_id;
        if (!userId) {
          console.error('No user ID found');
          toast.error('Invalid user session');
          return;
        }

        console.log('Loading vehicles for user:', userId);
        await fetchVehicles(userId);
        
      } catch (error) {
        console.error('Error in loadData:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
        toast.error(errorMessage);
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(loadData, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Fetch vehicle data when vehicle or date range changes
  useEffect(() => {
    if (selectedVehicle && dateRange?.from && dateRange?.to) {
      setVehicleData([]);
      fetchVehicleData(selectedVehicle, dateRange.from, dateRange.to);
    } else {
      setVehicleData([]);
    }
  }, [selectedVehicle, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return dateStr;
    }
  };

  // Calculate route statistics
  const calculateStats = () => {
    if (!vehicleData.length) return { distance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0 };

    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let validSpeedCount = 0;
    
    const startTime = new Date(vehicleData[0].timestamp!);
    const endTime = new Date(vehicleData[vehicleData.length - 1].timestamp!);

    for (let i = 1; i < vehicleData.length; i++) {
      const prev = vehicleData[i - 1];
      const curr = vehicleData[i];
      
      const distance = calculateDistance(
        parseFloat(prev.latitude!),
        parseFloat(prev.longitude!),
        parseFloat(curr.latitude!),
        parseFloat(curr.longitude!)
      );
      
      totalDistance += distance;
      
      if (curr.speed !== null && curr.speed !== undefined) {
        totalSpeed += curr.speed;
        maxSpeed = Math.max(maxSpeed, curr.speed);
        validSpeedCount++;
      }
    }

    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const avgSpeed = validSpeedCount > 0 ? totalSpeed / validSpeedCount : 0;

    return {
      distance: totalDistance.toFixed(2),
      duration: duration.toFixed(1),
      avgSpeed: avgSpeed.toFixed(1),
      maxSpeed: maxSpeed.toFixed(1)
    };
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const stats = calculateStats();

  // Data optimization
  const optimizeRouteData = (data: VehicleData[], maxPoints: number = 1000) => {
    if (data.length <= maxPoints) return data;
    
    const step = Math.floor(data.length / (maxPoints - 2));
    const optimized = [data[0]];
    
    for (let i = step; i < data.length - 1; i += step) {
      optimized.push(data[i]);
    }
    
    optimized.push(data[data.length - 1]);
    return optimized;
  };

  const optimizedData = optimizeRouteData(vehicleData);

  // Prepare polyline data for map
  const routePolyline = optimizedData
    .filter(data => data.latitude && data.longitude)
    .map(data => {
      const lat = parseFloat(data.latitude!);
      const lng = parseFloat(data.longitude!);
      if (isNaN(lat) || isNaN(lng)) return null;
      return [lat, lng] as [number, number];
    })
    .filter((point): point is [number, number] => point !== null);

  // Prepare start and end markers
  const routeMarkers: ProcessedVehicleForMap[] = [];
  
  if (optimizedData.length > 0) {
    const selectedVehicleInfo = vehicles.find(v => v.vehicle_id === selectedVehicle);
    const isMotor = selectedVehicleInfo?.make?.toLowerCase().includes('motor') || 
                   selectedVehicleInfo?.model?.toLowerCase().includes('motor') ||
                   selectedVehicleInfo?.name?.toLowerCase().includes('motor');
    
    const startData = optimizedData[0];
    const startLat = parseFloat(startData.latitude!);
    const startLng = parseFloat(startData.longitude!);
    
    if (!isNaN(startLat) && !isNaN(startLng)) {
      routeMarkers.push({
        id: `start-${selectedVehicle}`,
        name: `${selectedVehicleInfo?.name || 'Vehicle'} - Start`,
        licensePlate: selectedVehicleInfo?.license_plate || '',
        position: [startLat, startLng],
        speed: startData.speed || 0,
        ignition: startData.ignition_status === 'ON' || startData.ignition_status === 'true' || startData.ignition_status === '1',
        fuel: startData.fuel_level ? parseFloat(startData.fuel_level) : null,
        battery: startData.battery_level ? parseFloat(startData.battery_level) : null,
        timestamp: startData.timestamp,
        isMotor: isMotor || false,
        status: 'parked' as const
      });
    }
    
    if (optimizedData.length > 1) {
      const endData = optimizedData[optimizedData.length - 1];
      const endLat = parseFloat(endData.latitude!);
      const endLng = parseFloat(endData.longitude!);
      
      if (!isNaN(endLat) && !isNaN(endLng)) {
        routeMarkers.push({
          id: `end-${selectedVehicle}`,
          name: `${selectedVehicleInfo?.name || 'Vehicle'} - End`,
          licensePlate: selectedVehicleInfo?.license_plate || '',
          position: [endLat, endLng],
          speed: endData.speed || 0,
          ignition: endData.ignition_status === 'ON' || endData.ignition_status === 'true' || endData.ignition_status === '1',
          fuel: endData.fuel_level ? parseFloat(endData.fuel_level) : null,
          battery: endData.battery_level ? parseFloat(endData.battery_level) : null,
          timestamp: endData.timestamp,
          isMotor: isMotor || false,
          status: 'parked' as const
        });
      }
    }
  }

  // Enhanced vehicle change handler
  const handleVehicleChange = (vehicleId: string) => {
    console.log('Vehicle changed to:', vehicleId);
    setVehicleData([]);
    setLoadingData(false);
    setSelectedVehicle(vehicleId);
    
    if (vehicleId && dateRange?.from && dateRange?.to) {
      const selectedVehicleInfo = vehicles.find(v => v.vehicle_id === vehicleId);
      if (selectedVehicleInfo?.gps_id) {
        console.log('Fetching data for vehicle:', selectedVehicleInfo.name, 'GPS:', selectedVehicleInfo.gps_id);
        fetchVehicleData(vehicleId, dateRange.from, dateRange.to);
      } else {
        console.warn('Selected vehicle has no GPS ID:', selectedVehicleInfo);
        toast.warning('Selected vehicle does not have GPS tracking enabled');
      }
    }
  };

  const handleRefresh = () => {
    if (selectedVehicle && dateRange?.from && dateRange?.to) {
      console.log('Refreshing data for vehicle:', selectedVehicle);
      setVehicleData([]);
      fetchVehicleData(selectedVehicle, dateRange.from, dateRange.to);
    }
  };

  const handleDateRangeChange = (field: 'from' | 'to', date: string) => {
    const newDate = new Date(date);
    
    setDateRange(prev => {
      const updated = {
        from: field === 'from' ? newDate : (prev?.from || new Date()),
        to: field === 'to' ? newDate : (prev?.to || new Date())
      };
      
      setVehicleData([]);
      return updated;
    });
  };

  const setQuickDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    setVehicleData([]);
    setDateRange({ from, to });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 text-lg">Loading vehicles...</p>
          <p className="text-slate-500 text-sm mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!loading && vehicles.length === 0) {
    return (
      <div className="space-y-6 p-4 sm:p-6 bg-slate-50 min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <History className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Travel History</h2>
              <p className="text-slate-600">View and analyze vehicle travel routes and statistics</p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-8 text-center">
            <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No Vehicles Available</h3>
            <p className="text-slate-600 mb-6">
              No vehicles found for your account. Please ensure you have vehicles registered and try again.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => {
                  const user = getCurrentUser();
                  if (user) {
                    const userId = user.id || user.user_id;
                    if (userId) {
                      fetchVehicles(userId);
                    }
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <p className="text-xs text-slate-500">
                If the problem persists, please contact support
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <History className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Travel History</h2>
            <p className="text-slate-600">View and analyze vehicle travel routes and statistics</p>
          </div>
        </div>
        <Button 
          variant="outline"
          onClick={handleRefresh}
          disabled={loadingData || !selectedVehicle}
          className="text-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
          {loadingData ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Controls */}
      <Card className="shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
            Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Select Vehicle
              </label>
              <select
                className="w-full rounded-md border border-slate-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={selectedVehicle || ''}
                onChange={(e) => handleVehicleChange(e.target.value)}
              >
                <option value="">Choose a vehicle...</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {vehicle.name} ({vehicle.license_plate}) 
                    {vehicle.gps_id ? ` - GPS: ${vehicle.gps_id}` : ' - No GPS'}
                  </option>
                ))}
              </select>
              {selectedVehicle && !vehicles.find(v => v.vehicle_id === selectedVehicle)?.gps_id && (
                <p className="text-sm text-amber-600 mt-1">
                  ⚠️ This vehicle does not have GPS tracking enabled
                </p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 rounded-md border border-slate-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={dateRange?.from?.toISOString().split('T')[0] || ''}
                  onChange={(e) => handleDateRangeChange('from', e.target.value)}
                />
                <input
                  type="date"
                  className="flex-1 rounded-md border border-slate-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={dateRange?.to?.toISOString().split('T')[0] || ''}
                  onChange={(e) => handleDateRangeChange('to', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Quick date range buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setQuickDateRange(1)}>
              Today
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickDateRange(7)}>
              Last 7 days
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickDateRange(30)}>
              Last 30 days
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedVehicle && vehicleData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Distance</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.distance} km</p>
                </div>
                <Route className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Duration</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.duration} hours</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Average Speed</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.avgSpeed} km/h</p>
                </div>
                <Car className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Max Speed</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.maxSpeed} km/h</p>
                </div>
                <Car className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Data Points</p>
                  <p className="text-2xl font-bold text-slate-800">{vehicleData.length}</p>
                  <p className="text-xs text-slate-400">Optimized: {optimizedData.length}</p>
                </div>
                <MapPin className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Route Map
            {selectedVehicle && vehicleData.length > 0 && (
              <Badge variant="outline" className="ml-auto">
                Route: {routePolyline.length} points
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] rounded-b-xl overflow-hidden m-4">
            {loadingData ? (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-slate-600">Loading route data...</p>
                </div>
              </div>
            ) : !selectedVehicle ? (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="text-center">
                  <Car className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">Select a vehicle to view its route</p>
                </div>
              </div>
            ) : vehicleData.length === 0 ? (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="text-center">
                  <History className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">No route data available</p>
                  <p className="text-sm text-slate-500">Try selecting a different date range</p>
                </div>
              </div>
            ) : (
              <MapComponent
                vehicles={routeMarkers}
                selectedVehicleId={null}
                onVehicleClick={() => {}}
                onMapClick={() => {}}
                routePolyline={routePolyline}
                centerCoordinates={routePolyline.length > 0 ? routePolyline[0] : undefined}
                zoomLevel={routePolyline.length > 1 ? 12 : 16}
                height="500px"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Journey Details */}
      {selectedVehicle && vehicleData.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Journey Details
              <Badge variant="outline" className="ml-auto">
                {vehicleData.length} records
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {optimizedData.slice(0, 100).map((data, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100"
                >
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${
                    (data.speed || 0) > 5 ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">
                        {formatDate(data.timestamp!)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {data.speed || 0} km/h
                      </Badge>
                      {data.fuel_level && (
                        <Badge variant="outline" className="text-xs bg-blue-50">
                          Fuel: {parseFloat(data.fuel_level).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      Location: {parseFloat(data.latitude!).toFixed(5)}, {parseFloat(data.longitude!).toFixed(5)}
                    </p>
                    {data.ignition_status && (
                      <p className="text-xs text-slate-500">
                        Ignition: {data.ignition_status}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {vehicleData.length > 100 && (
                <div className="text-center py-3 text-sm text-slate-500 border-t">
                  Showing first 100 of {vehicleData.length} records for performance
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}