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

interface RoutePoint {
  position: [number, number];
  timestamp: string;
  speed: number;
  fuel?: number;
  battery?: number;
  ignition?: boolean;
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
  const getAuthToken = (): string | null => {
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
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch vehicles:', response.status, errorText);
        throw new Error(`Failed to fetch vehicles: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Vehicles received:', data.data?.length || 0);
      
      if (data.data && Array.isArray(data.data)) {
        setVehicles(data.data);
        // Auto-select first vehicle if none selected
        if (!selectedVehicle && data.data.length > 0) {
          setSelectedVehicle(data.data[0].vehicle_id);
        }
      } else {
        console.warn('No vehicles data received');
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
      setVehicles([]);
    }
  };

  // Fetch vehicle data with improved filtering
  const fetchVehicleData = async (vehicleId: string, from?: Date, to?: Date) => {
    if (!vehicleId) return;
    
    setLoadingData(true);
    try {
      console.log('Fetching vehicle data for:', vehicleId, 'from:', from, 'to:', to);
      
      // Find the selected vehicle to get GPS ID
      const selectedVehicleData = vehicles.find(v => v.vehicle_id === vehicleId);
      const gpsId = selectedVehicleData?.gps_id;
      
      const token = getAuthToken();
      let url = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?limit=-1&sort=timestamp`;
      
      // Build filter for vehicle data
      const filters = [];
      
      // Filter by GPS ID if available, otherwise by vehicle_id
      if (gpsId) {
        filters.push(`filter[gps_id][_eq]=${gpsId}`);
      } else {
        filters.push(`filter[vehicle_id][_eq]=${vehicleId}`);
      }
      
      // Add date range filter if provided
      if (from && to) {
        const fromISO = from.toISOString();
        const toISO = to.toISOString();
        filters.push(`filter[timestamp][_between]=${fromISO},${toISO}`);
      }
      
      if (filters.length > 0) {
        url += '&' + filters.join('&');
      }
      
      console.log('Fetching from URL:', url);

      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch vehicle data:', response.status, errorText);
        throw new Error(`Failed to fetch vehicle data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Vehicle data received:', data.data?.length || 0, 'records');

      if (data.data && Array.isArray(data.data)) {
        // Filter and validate data
        const validData = data.data.filter((item: VehicleData) => 
          item.latitude && 
          item.longitude && 
          item.timestamp &&
          !isNaN(parseFloat(item.latitude)) &&
          !isNaN(parseFloat(item.longitude))
        );
        
        // Sort by timestamp
        const sortedData = validData.sort((a: VehicleData, b: VehicleData) => 
          new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
        );
        
        console.log('Valid vehicle data points:', sortedData.length);
        setVehicleData(sortedData);
        
        if (sortedData.length === 0) {
          toast.info('No tracking data found for the selected period');
        }
      } else {
        console.warn('No vehicle data received');
        setVehicleData([]);
      }
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      toast.error('Failed to load vehicle tracking data');
      setVehicleData([]);
    } finally {
      setLoadingData(false);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const user = getCurrentUser();
      
      if (!user) {
        console.error('No user found in session');
        toast.error('Please login to view history');
        setLoading(false);
        return;
      }

      const userId = user.id || user.user_id;
      if (!userId) {
        console.error('No user ID found');
        toast.error('Invalid user session');
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
    if (selectedVehicle && dateRange?.from && dateRange?.to) {
      fetchVehicleData(selectedVehicle, dateRange.from, dateRange.to);
    }
  }, [selectedVehicle, dateRange, vehicles]);

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

    // Calculate distance and speed statistics
    for (let i = 1; i < vehicleData.length; i++) {
      const prev = vehicleData[i - 1];
      const curr = vehicleData[i];
      
      // Calculate distance between points using Haversine formula
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

    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours
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
  const processedVehiclesForMap: ProcessedVehicleForMap[] = vehicleData
    .filter(data => data.latitude && data.longitude)
    .map((data, index) => {
      const lat = parseFloat(data.latitude!);
      const lng = parseFloat(data.longitude!);
      
      if (isNaN(lat) || isNaN(lng)) return null;
      
      const selectedVehicleInfo = vehicles.find(v => v.vehicle_id === selectedVehicle);
      const isMotor = selectedVehicleInfo?.make?.toLowerCase().includes('motor') || 
                     selectedVehicleInfo?.model?.toLowerCase().includes('motor') ||
                     selectedVehicleInfo?.name?.toLowerCase().includes('motor');
      
      return {
        id: `${selectedVehicle}-${index}`,
        name: selectedVehicleInfo?.name || `Point ${index + 1}`,
        licensePlate: selectedVehicleInfo?.license_plate || '',
        position: [lat, lng] as [number, number],
        speed: data.speed || 0,
        ignition: data.ignition_status === 'ON' || data.ignition_status === 'true' || data.ignition_status === '1',
        fuel: data.fuel_level ? parseFloat(data.fuel_level) : null,
        battery: data.battery_level ? parseFloat(data.battery_level) : null,
        timestamp: data.timestamp,
        isMotor: isMotor || false,
        status: (data.speed || 0) > 2 ? 'moving' : 'parked' as 'moving' | 'parked' | 'offline'
      };
    })
    .filter((item): item is ProcessedVehicleForMap => item !== null);

  // Handle refresh
  const handleRefresh = () => {
    if (selectedVehicle && dateRange?.from && dateRange?.to) {
      fetchVehicleData(selectedVehicle, dateRange.from, dateRange.to);
    }
  };

  // Set quick date ranges
  const setQuickDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 text-lg">Loading vehicles...</p>
        </div>
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
                onChange={(e) => setSelectedVehicle(e.target.value)}
              >
                <option value="">Choose a vehicle...</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {vehicle.name} ({vehicle.license_plate}) - {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
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
                  onChange={(e) => setDateRange(prev => ({
                    from: new Date(e.target.value),
                    to: prev?.to || new Date()
                  }))}
                />
                <input
                  type="date"
                  className="flex-1 rounded-md border border-slate-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={dateRange?.to?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setDateRange(prev => ({
                    from: prev?.from || new Date(),
                    to: new Date(e.target.value)
                  }))}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {vehicleData.length} tracking points
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
                vehicles={processedVehiclesForMap}
                selectedVehicleId={null}
                onVehicleClick={() => {}}
                onMapClick={() => {}}
                showRoute={true}
                centerCoordinates={processedVehiclesForMap.length > 0 ? processedVehiclesForMap[0].position : undefined}
                zoomLevel={processedVehiclesForMap.length > 1 ? 12 : 16}
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
              {vehicleData.map((data, index) => (
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}