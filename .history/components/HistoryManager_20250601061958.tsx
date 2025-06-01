"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, MapPin, Clock, Car, Route, Loader2, RefreshCw, Calendar } from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from "sonner";
import useSWR from 'swr';

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

// API Configuration
const API_BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items';
const VEHICLE_ENDPOINT = `${API_BASE_URL}/vehicle`;
const VEHICLE_DATA_ENDPOINT = `${API_BASE_URL}/vehicle_datas`;

// SWR Configuration
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};

// Enhanced fetcher with better error handling
const fetcher = async (url: string) => {
  console.log('Fetching:', url);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(15000)
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('API Error:', response.status, errorText);
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('Fetcher response:', {
    url: url.split('?')[0],
    hasData: !!data.data,
    dataLength: Array.isArray(data.data) ? data.data.length : 'Not array'
  });
  
  return data.data || data;
};

// Custom hook untuk vehicle data dengan date filtering
const useVehicleData = (gpsId: string | null, dateRange: { from: Date; to: Date } | undefined) => {
  // Create SWR key with date range
  const swrKey = useMemo(() => {
    if (!gpsId || !dateRange?.from || !dateRange?.to) return null;
    
    const params = new URLSearchParams({
      'limit': '5000',
      'sort': 'timestamp',
      'filter[gps_id][_eq]': gpsId.trim()
    });
    
    const fromISO = dateRange.from.toISOString();
    const toISO = dateRange.to.toISOString();
    params.append('filter[timestamp][_between]', `${fromISO},${toISO}`);
    
    return `${VEHICLE_DATA_ENDPOINT}?${params.toString()}`;
  }, [gpsId, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);
  
  return useSWR(swrKey, fetcher, {
    ...swrConfig,
    refreshInterval: 0, // History data doesn't need auto-refresh
    onSuccess: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Vehicle data loaded: ${data.length} records`);
        toast.success(`Loaded ${data.length} tracking points`);
      } else if (Array.isArray(data) && data.length === 0) {
        console.log('No vehicle data found for the selected period');
        toast.info('No tracking data found for the selected period');
      }
    },
    onError: (error) => {
      console.error('Vehicle data fetch error:', error);
      toast.error(`Failed to load vehicle data: ${error.message}`);
    }
  });
};

export function HistoryManager() {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | undefined>(undefined);

  // Get current user
  const getCurrentUser = useCallback(() => {
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
  }, []);

  // Get user ID
  const userId = useMemo(() => {
    const user = getCurrentUser();
    return user?.id || user?.user_id || null;
  }, [getCurrentUser]);

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

  // SWR Hook for vehicles
  const { 
    data: vehicles = [], 
    error: vehiclesError, 
    isLoading: vehiclesLoading,
    mutate: mutateVehicles
  } = useSWR(
    userId ? `${VEHICLE_ENDPOINT}?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // Vehicles don't change frequently
      onSuccess: (data: Vehicle[]) => {
        if (Array.isArray(data) && data.length > 0) {
          console.log(`Vehicles loaded: ${data.length} vehicles`);
          toast.success(`Loaded ${data.length} vehicles`);
          
          // Auto-select first vehicle with GPS
          if (!selectedVehicle) {
            const vehicleWithGPS = data.find(v => v.gps_id && v.gps_id.trim() !== '');
            if (vehicleWithGPS) {
              console.log('Auto-selecting vehicle with GPS:', vehicleWithGPS.name);
              setSelectedVehicle(vehicleWithGPS.vehicle_id);
            } else if (data.length > 0) {
              console.log('No vehicles with GPS found, selecting first vehicle:', data[0].name);
              setSelectedVehicle(data[0].vehicle_id);
            }
          }
        } else {
          console.log('No vehicles found');
          toast.info('No vehicles found for your account');
        }
      },
      onError: (error) => {
        console.error('Vehicles fetch error:', error);
        toast.error(`Failed to load vehicles: ${error.message}`);
      }
    }
  );

  // Get selected vehicle info
  const selectedVehicleInfo = useMemo(() => {
    if (!Array.isArray(vehicles)) return null;
    return vehicles.find((v: Vehicle) => v.vehicle_id === selectedVehicle) || null;
  }, [vehicles, selectedVehicle]);


  // SWR Hook for vehicle data using custom hook
  const { 
    data: rawVehicleData = [], 
    error: vehicleDataError, 
    isLoading: vehicleDataLoading,
    mutate: mutateVehicleData
  } = useVehicleData(selectedVehicleInfo?.gps_id || null, dateRange);

  // Process vehicle data
  const processedVehicleData = useMemo((): VehicleData[] => {
    if (!Array.isArray(rawVehicleData) || rawVehicleData.length === 0) return [];
    
    console.log('Processing vehicle data:', rawVehicleData.length, 'raw records');
    
    const validData = rawVehicleData.filter((item: VehicleData) => 
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
    
    if (sortedData.length === 0) {
      toast.info('No valid tracking data found');
    } else if (sortedData.length > 1000) {
      toast.info(`Large dataset loaded (${sortedData.length} points). Map will show optimized route.`);
    }
    
    return sortedData;
  }, [rawVehicleData]);

  // Data optimization for map rendering
  const optimizeRouteData = useCallback((data: VehicleData[], maxPoints: number = 1000) => {
    if (data.length <= maxPoints) return data;
    
    const step = Math.floor(data.length / (maxPoints - 2));
    const optimized = [data[0]];
    
    for (let i = step; i < data.length - 1; i += step) {
      optimized.push(data[i]);
    }
    
    optimized.push(data[data.length - 1]);
    return optimized;
  }, []);

  const optimizedData = useMemo(() => optimizeRouteData(processedVehicleData), [processedVehicleData, optimizeRouteData]);

  // Calculate route statistics
  const calculateStats = useCallback(() => {
    if (!processedVehicleData.length) return { distance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0 };

    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let validSpeedCount = 0;
    
    const startTime = new Date(processedVehicleData[0].timestamp!);
    const endTime = new Date(processedVehicleData[processedVehicleData.length - 1].timestamp!);

    for (let i = 1; i < processedVehicleData.length; i++) {
      const prev = processedVehicleData[i - 1];
      const curr = processedVehicleData[i];
      
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
  }, [processedVehicleData]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  const stats = useMemo(() => calculateStats(), [calculateStats]);

  // Prepare polyline data for map
  const routePolyline = useMemo(() => {
    return optimizedData
      .filter(data => data.latitude && data.longitude)
      .map(data => {
        const lat = parseFloat(data.latitude!);
        const lng = parseFloat(data.longitude!);
        if (isNaN(lat) || isNaN(lng)) return null;
        return [lat, lng] as [number, number];
      })
      .filter((point): point is [number, number] => point !== null);
  }, [optimizedData]);

  // Prepare start and end markers
  const routeMarkers = useMemo((): ProcessedVehicleForMap[] => {
    if (optimizedData.length === 0 || !selectedVehicleInfo) return [];
    
    const markers: ProcessedVehicleForMap[] = [];
    const isMotor = selectedVehicleInfo.make?.toLowerCase().includes('motor') || 
                   selectedVehicleInfo.model?.toLowerCase().includes('motor') ||
                   selectedVehicleInfo.name?.toLowerCase().includes('motor');
    
    const startData = optimizedData[0];
    const startLat = parseFloat(startData.latitude!);
    const startLng = parseFloat(startData.longitude!);
    
    if (!isNaN(startLat) && !isNaN(startLng)) {
      markers.push({
        id: `start-${selectedVehicle}`,
        name: `${selectedVehicleInfo.name} - Start`,
        licensePlate: selectedVehicleInfo.license_plate,
        position: [startLat, startLng],
        speed: startData.speed || 0,
        ignition: startData.ignition_status === 'ON' || startData.ignition_status === 'true' || startData.ignition_status === '1',
        fuel: startData.fuel_level ? parseFloat(startData.fuel_level) : null,
        battery: startData.battery_level ? parseFloat(startData.battery_level) : null,
        timestamp: startData.timestamp,
        isMotor: isMotor,
        status: 'parked' as const
      });
    }
    
    if (optimizedData.length > 1) {
      const endData = optimizedData[optimizedData.length - 1];
      const endLat = parseFloat(endData.latitude!);
      const endLng = parseFloat(endData.longitude!);
      
      if (!isNaN(endLat) && !isNaN(endLng)) {
        markers.push({
          id: `end-${selectedVehicle}`,
          name: `${selectedVehicleInfo.name} - End`,
          licensePlate: selectedVehicleInfo.license_plate,
          position: [endLat, endLng],
          speed: endData.speed || 0,
          ignition: endData.ignition_status === 'ON' || endData.ignition_status === 'true' || endData.ignition_status === '1',
          fuel: endData.fuel_level ? parseFloat(endData.fuel_level) : null,
          battery: endData.battery_level ? parseFloat(endData.battery_level) : null,
          timestamp: endData.timestamp,
          isMotor: isMotor,
          status: 'parked' as const
        });
      }
    }
    
    return markers;
  }, [optimizedData, selectedVehicleInfo, selectedVehicle]);

  // Enhanced vehicle change handler
  const handleVehicleChange = useCallback((vehicleId: string) => {
    console.log('Vehicle changed to:', vehicleId);
    
    if (!vehicleId || vehicleId === '') {
      setSelectedVehicle(null);
      return;
    }
    
    const vehicleInfo = vehicles.find((v: Vehicle) => v.vehicle_id === vehicleId);
    if (!vehicleInfo) {
      console.error('Vehicle not found:', vehicleId);
      toast.error('Selected vehicle not found');
      return;
    }
    
    setSelectedVehicle(vehicleId);
    
    if (!vehicleInfo.gps_id || vehicleInfo.gps_id.trim() === '') {
      toast.warning(`Vehicle "${vehicleInfo.name}" does not have GPS tracking enabled`);
    }
  }, [vehicles]);

  // Manual refresh handlers
  const handleRefresh = useCallback(() => {
    console.log('Manual refresh triggered');
    mutateVehicles();
    if (selectedVehicleInfo?.gps_id && dateRange) {
      mutateVehicleData();
    }
    toast.success('Data refreshed');
  }, [mutateVehicles, mutateVehicleData, selectedVehicleInfo, dateRange]);

  // Date range handlers
  const handleDateRangeChange = useCallback((field: 'from' | 'to', date: string) => {
    const newDate = new Date(date);
    
    setDateRange(prev => {
      const updated = {
        from: field === 'from' ? newDate : (prev?.from || new Date()),
        to: field === 'to' ? newDate : (prev?.to || new Date())
      };
      
      return updated;
    });
  }, []);

  const setQuickDateRange = useCallback((days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    setDateRange({ from, to });
  }, []);

  // Format date for display
  const formatDate = useCallback((dateStr: string) => {
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
  }, []);

  // Loading and error states
  const isLoading = vehiclesLoading;
  const hasError = vehiclesError || vehicleDataError;
  const isLoadingData = vehicleDataLoading;

  if (isLoading) {
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

  if (!isLoading && vehicles.length === 0) {
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
              {hasError ? `Error: ${vehiclesError?.message || 'Failed to load vehicles'}` : 
               'No vehicles found for your account. Please ensure you have vehicles registered and try again.'}
            </p>
            <Button 
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
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
          disabled={isLoadingData}
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
          {isLoadingData ? 'Loading...' : 'Refresh'}
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
                {vehicles.map((vehicle: Vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {vehicle.name} ({vehicle.license_plate}) 
                    {vehicle.gps_id ? ` - GPS: ${vehicle.gps_id}` : ' - No GPS'}
                  </option>
                ))}
              </select>
              {selectedVehicle && selectedVehicleInfo && !selectedVehicleInfo.gps_id && (
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
      {selectedVehicle && processedVehicleData.length > 0 && (
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
                  <p className="text-2xl font-bold text-slate-800">{processedVehicleData.length}</p>
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
            {selectedVehicle && processedVehicleData.length > 0 && (
              <Badge variant="outline" className="ml-auto">
                Route: {routePolyline.length} points
              </Badge>
            )}
            {isLoadingData && (
              <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Loading...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] rounded-b-xl overflow-hidden m-4">
            {isLoadingData ? (
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
            ) : processedVehicleData.length === 0 ? (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="text-center">
                  <History className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">No route data available</p>
                  <p className="text-sm text-slate-500">Try selecting a different date range</p>
                  {vehicleDataError && (
                    <p className="text-sm text-red-500 mt-2">Error: {vehicleDataError.message}</p>
                  )}
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
      {selectedVehicle && processedVehicleData.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Journey Details
              <Badge variant="outline" className="ml-auto">
                {processedVehicleData.length} records
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
              {processedVehicleData.length > 100 && (
                <div className="text-center py-3 text-sm text-slate-500 border-t">
                  Showing first 100 of {processedVehicleData.length} records for performance
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Indicator */}
      {(isLoadingData || vehiclesLoading) && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-xs text-slate-600 font-medium">
              {vehiclesLoading ? 'Loading vehicles...' : 'Loading route data...'}
            </span>
          </div>
        </div>
      )}

      {/* Error Toast for SWR errors */}
      {hasError && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 shadow-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-xs font-medium">
              {vehiclesError?.message || vehicleDataError?.message || 'An error occurred'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}