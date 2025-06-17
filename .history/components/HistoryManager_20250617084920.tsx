"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, MapPin, Clock, Car, Route, Loader2, RefreshCw, Calendar, AlertCircle } from "lucide-react";
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
import { API_BASE_URL } from '../api/file';
const VEHICLE_ENDPOINT = `${API_BASE_URL}/items/vehicle`;
const VEHICLE_DATA_ENDPOINT = `${API_BASE_URL}/items/vehicle_datas`;

// 🔧 Optimized SWR Configuration
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  keepPreviousData: true,
  shouldRetryOnError: (error: any) => {
    return error.status >= 500 || !error.status;
  }
};

// 🔧 Safe array utility
const ensureArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.data)) {
      return value.data;
    }
    if (value.data && typeof value.data === 'object') {
      return [value.data];
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return [value];
  }
  return [];
};

// 🔧 Enhanced fetcher with pagination support
const fetchAllPages = async (baseUrl: string, params: URLSearchParams) => {
  const allData: any[] = [];
  let page = 1;
  const pageSize = 1000; // Optimal page size for performance
  let hasMore = true;
  
  // Remove any existing limit from params
  params.delete('limit');
  params.delete('offset');
  
  while (hasMore) {
    const offset = (page - 1) * pageSize;
    const paginatedParams = new URLSearchParams(params);
    paginatedParams.set('limit', pageSize.toString());
    paginatedParams.set('offset', offset.toString());
    
    try {
      const response = await fetch(`${baseUrl}?${paginatedParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const pageData = ensureArray(data);
      
      if (pageData.length === 0) {
        hasMore = false;
      } else {
        allData.push(...pageData);
        
        // If we got less than pageSize, we've reached the end
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
          
          // Progress notification for large datasets
          if (page % 5 === 0) {
            console.log(`Loading data: ${allData.length} records loaded...`);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMore = false;
      if (allData.length === 0) {
        throw error;
      }
    }
  }
  
  console.log(`Total records loaded: ${allData.length}`);
  return allData;
};

// 🔧 Standard fetcher for non-paginated requests
const fetcher = async (url: string) => {
  console.log('Fetching:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('API Error:', response.status, errorText);
      
      const error = new Error(`HTTP ${response.status}: ${errorText}`);
      (error as any).status = response.status;
      throw error;
    }
    
    const data = await response.json();
    return ensureArray(data);
  } catch (error) {
    console.error('Fetch error for URL:', url, error);
    throw error;
  }
};

// 🔧 Custom hook for vehicle data with pagination
const useVehicleData = (gpsId: string | null, dateRange: { from: Date; to: Date } | undefined) => {
  const swrKey = useMemo(() => {
    if (!gpsId || !dateRange?.from || !dateRange?.to) {
      return null;
    }
    
    const trimmedGpsId = gpsId.trim();
    if (!trimmedGpsId) {
      return null;
    }
    
    // Return an object key for SWR to handle pagination
    return {
      endpoint: VEHICLE_DATA_ENDPOINT,
      gpsId: trimmedGpsId,
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString()
    };
  }, [gpsId, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);
  
  return useSWR(swrKey, async (key) => {
    if (!key) return [];
    
    const params = new URLSearchParams({
      'sort': '-timestamp', // Sort by newest first
      'filter[gps_id][_eq]': key.gpsId
    });
    
    params.append('filter[timestamp][_between]', `${key.from},${key.to}`);
    
    // Use pagination fetcher
    return fetchAllPages(key.endpoint, params);
  }, {
    ...swrConfig,
    refreshInterval: 0,
    onSuccess: (data) => {
      const dataArray = ensureArray(data);
      if (dataArray.length > 0) {
        console.log(`Vehicle tracking data loaded: ${dataArray.length} records`);
        if (dataArray.length > 10000) {
          toast.success(`Loaded ${dataArray.length.toLocaleString()} tracking points (large dataset)`);
        } else {
          toast.success(`Loaded ${dataArray.length.toLocaleString()} tracking points`);
        }
      } else {
        console.log('No vehicle tracking data found for the selected period');
        toast.info('No tracking data found for the selected period');
      }
    },
    onError: (error) => {
      console.error('Vehicle data error:', error);
      toast.error(`Failed to load tracking data: ${error.message}`);
    }
  });
};

// 🔧 Advanced route optimization algorithm
const optimizeRouteDataAdvanced = (data: VehicleData[], options: {
  maxPoints?: number;
  preserveStops?: boolean;
  minDistanceMeters?: number;
  minTimeDiffSeconds?: number;
} = {}) => {
  const {
    maxPoints = 2000,
    preserveStops = true,
    minDistanceMeters = 10,
    minTimeDiffSeconds = 30
  } = options;
  
  if (data.length <= maxPoints) return data;
  
  const optimized: VehicleData[] = [];
  
  // Always include first point
  optimized.push(data[0]);
  
  let lastIncludedIndex = 0;
  let lastLat = parseFloat(data[0].latitude!);
  let lastLng = parseFloat(data[0].longitude!);
  let lastTime = new Date(data[0].timestamp!).getTime();
  
  // Douglas-Peucker-like algorithm with time consideration
  for (let i = 1; i < data.length - 1; i++) {
    const current = data[i];
    const lat = parseFloat(current.latitude!);
    const lng = parseFloat(current.longitude!);
    const time = new Date(current.timestamp!).getTime();
    
    // Calculate distance from last included point
    const distance = calculateDistanceMeters(lastLat, lastLng, lat, lng);
    const timeDiff = (time - lastTime) / 1000; // seconds
    
    // Detect stops (low speed for extended time)
    const isStop = preserveStops && 
                   (current.speed || 0) < 5 && 
                   i > 0 && 
                   (data[i-1].speed || 0) < 5;
    
    // Include point if:
    // 1. It's a stop point
    // 2. Distance threshold exceeded
    // 3. Time threshold exceeded
    // 4. We need to maintain minimum sampling rate
    const shouldInclude = isStop ||
                         distance > minDistanceMeters ||
                         timeDiff > minTimeDiffSeconds ||
                         (optimized.length < maxPoints * 0.8 && 
                          i - lastIncludedIndex > Math.floor(data.length / maxPoints));
    
    if (shouldInclude && optimized.length < maxPoints - 1) {
      optimized.push(current);
      lastIncludedIndex = i;
      lastLat = lat;
      lastLng = lng;
      lastTime = time;
    }
  }
  
  // Always include last point
  optimized.push(data[data.length - 1]);
  
  console.log(`Route optimized: ${data.length} -> ${optimized.length} points (${((optimized.length/data.length)*100).toFixed(1)}% retained)`);
  
  return optimized;
};

// 🔧 Calculate distance in meters
const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export function HistoryManager() {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | undefined>(undefined);
  const [mapOptimizationLevel, setMapOptimizationLevel] = useState<'auto' | 'high' | 'medium' | 'low'>('auto');

  // 🔧 Optimized user retrieval with memoization
  const userId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const userStr = sessionStorage.getItem('user');
      if (!userStr) return null;
      
      const user = JSON.parse(userStr);
      return user?.id || user?.user_id || user?._id || user?.ID || null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }, []);

  // 🔧 Initialize date range on mount
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    setDateRange({
      from: yesterday,
      to: today
    });
  }, []);

  // 🔧 Enhanced SWR Hook for vehicles
  const { 
    data: vehiclesRaw, 
    error: vehiclesError, 
    isLoading: vehiclesLoading,
    mutate: mutateVehicles
  } = useSWR(
    userId ? `${VEHICLE_ENDPOINT}?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0,
      onSuccess: (data) => {
        const vehiclesArray = ensureArray<Vehicle>(data);
        console.log(`Vehicles loaded successfully: ${vehiclesArray.length} vehicles`);
        
        if (vehiclesArray.length > 0) {
          toast.success(`Loaded ${vehiclesArray.length} vehicles`);
        } else {
          toast.info('No vehicles found for your account');
        }
      },
      onError: (error) => {
        console.error('Vehicles fetch error:', error);
        toast.error(`Failed to load vehicles: ${error.message}`);
      }
    }
  );

  // 🔧 Safe vehicles array
  const vehicles = useMemo((): Vehicle[] => {
    return ensureArray<Vehicle>(vehiclesRaw);
  }, [vehiclesRaw]);

  // 🔧 Auto-select first vehicle with GPS
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicle) {
      const vehicleWithGPS = vehicles.find(v => v.gps_id && v.gps_id.trim() !== '');
      
      if (vehicleWithGPS) {
        console.log('Auto-selecting vehicle with GPS:', vehicleWithGPS.name);
        setSelectedVehicle(vehicleWithGPS.vehicle_id);
      } else if (vehicles.length > 0) {
        console.log('No vehicles with GPS found, selecting first vehicle:', vehicles[0].name);
        setSelectedVehicle(vehicles[0].vehicle_id);
      }
    }
  }, [vehicles, selectedVehicle]);

  // 🔧 Get selected vehicle info
  const selectedVehicleInfo = useMemo(() => {
    if (!Array.isArray(vehicles) || vehicles.length === 0) return null;
    return vehicles.find((v: Vehicle) => v.vehicle_id === selectedVehicle) || null;
  }, [vehicles, selectedVehicle]);

  // 🔧 SWR Hook for vehicle data with pagination
  const { 
    data: rawVehicleData, 
    error: vehicleDataError, 
    isLoading: vehicleDataLoading,
    mutate: mutateVehicleData
  } = useVehicleData(selectedVehicleInfo?.gps_id || null, dateRange);

  // 🔧 Process vehicle data with enhanced validation
  const processedVehicleData = useMemo((): VehicleData[] => {
    const dataArray = ensureArray<VehicleData>(rawVehicleData);
    
    if (dataArray.length === 0) {
      console.log('No raw vehicle data to process');
      return [];
    }
    
    console.log('Processing vehicle data:', dataArray.length, 'raw records');
    
    // Filter valid data
    const validData = dataArray.filter((item: VehicleData) => {
      if (!item.latitude || !item.longitude || !item.timestamp) {
        return false;
      }
      
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);
      
      return !isNaN(lat) && !isNaN(lng) && 
             isFinite(lat) && isFinite(lng) &&
             lat >= -90 && lat <= 90 &&
             lng >= -180 && lng <= 180;
    });
    
    // Sort by timestamp
    const sortedData = validData.sort((a: VehicleData, b: VehicleData) => 
      new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
    );
    
    console.log('Final processed data points:', sortedData.length);
    
    if (sortedData.length === 0 && dataArray.length > 0) {
      toast.warning('No valid GPS coordinates found in the data');
    } else if (sortedData.length > 10000) {
      toast.info(`Large dataset loaded (${sortedData.length.toLocaleString()} points). Map will show optimized route.`);
    }
    
    return sortedData;
  }, [rawVehicleData]);

  // 🔧 Dynamic optimization based on data size
  const optimizedData = useMemo(() => {
    const dataLength = processedVehicleData.length;
    
    // Determine optimization parameters based on data size and mode
    let maxPoints: number;
    let preserveStops: boolean;
    let minDistance: number;
    let minTime: number;
    
    switch (mapOptimizationLevel) {
      case 'high':
        maxPoints = 500;
        preserveStops = false;
        minDistance = 50;
        minTime = 120;
        break;
      case 'medium':
        maxPoints = 1500;
        preserveStops = true;
        minDistance = 20;
        minTime = 60;
        break;
      case 'low':
        maxPoints = 3000;
        preserveStops = true;
        minDistance = 5;
        minTime = 30;
        break;
      case 'auto':
      default:
        // Auto-adjust based on data size
        if (dataLength > 50000) {
          maxPoints = 1000;
          preserveStops = false;
          minDistance = 30;
          minTime = 90;
        } else if (dataLength > 20000) {
          maxPoints = 1500;
          preserveStops = true;
          minDistance = 20;
          minTime = 60;
        } else if (dataLength > 10000) {
          maxPoints = 2000;
          preserveStops = true;
          minDistance = 10;
          minTime = 45;
        } else if (dataLength > 5000) {
          maxPoints = 2500;
          preserveStops = true;
          minDistance = 5;
          minTime = 30;
        } else {
          return processedVehicleData; // No optimization needed
        }
    }
    
    return optimizeRouteDataAdvanced(processedVehicleData, {
      maxPoints,
      preserveStops,
      minDistanceMeters: minDistance,
      minTimeDiffSeconds: minTime
    });
  }, [processedVehicleData, mapOptimizationLevel]);

  // 🔧 Enhanced statistics calculation
  const calculateStats = useCallback(() => {
    if (!processedVehicleData.length) {
      return { distance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0, stops: 0 };
    }

    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let validSpeedCount = 0;
    let stops = 0;
    let currentStop = false;
    
    const startTime = new Date(processedVehicleData[0].timestamp!);
    const endTime = new Date(processedVehicleData[processedVehicleData.length - 1].timestamp!);

    // Calculate distance and speed statistics
    for (let i = 1; i < processedVehicleData.length; i++) {
      const prev = processedVehicleData[i - 1];
      const curr = processedVehicleData[i];
      
      try {
        const distance = calculateDistance(
          parseFloat(prev.latitude!),
          parseFloat(prev.longitude!),
          parseFloat(curr.latitude!),
          parseFloat(curr.longitude!)
        );
        
        if (isFinite(distance) && distance >= 0) {
          totalDistance += distance;
        }
        
        if (curr.speed !== null && curr.speed !== undefined && isFinite(curr.speed)) {
          totalSpeed += curr.speed;
          maxSpeed = Math.max(maxSpeed, curr.speed);
          validSpeedCount++;
          
          // Count stops
          if (curr.speed < 5 && !currentStop) {
            stops++;
            currentStop = true;
          } else if (curr.speed >= 5) {
            currentStop = false;
          }
        }
      } catch (error) {
        console.warn('Error calculating statistics for point:', i, error);
      }
    }

    const duration = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    const avgSpeed = validSpeedCount > 0 ? totalSpeed / validSpeedCount : 0;

    return {
      distance: Math.max(0, totalDistance).toFixed(2),
      duration: duration.toFixed(1),
      avgSpeed: Math.max(0, avgSpeed).toFixed(1),
      maxSpeed: Math.max(0, maxSpeed).toFixed(1),
      stops
    };
  }, [processedVehicleData]);

  // 🔧 Haversine distance calculation
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
      return 0;
    }
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return isFinite(distance) ? distance : 0;
  }, []);

  const stats = useMemo(() => calculateStats(), [calculateStats]);

  // 🔧 Prepare polyline data for map
  const routePolyline = useMemo(() => {
    return optimizedData
      .map(data => {
        if (!data.latitude || !data.longitude) return null;
        
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          return null;
        }
        
        return [lat, lng] as [number, number];
      })
      .filter((point): point is [number, number] => point !== null);
  }, [optimizedData]);

  // 🔧 Enhanced route markers preparation
  const routeMarkers = useMemo((): ProcessedVehicleForMap[] => {
    if (optimizedData.length === 0 || !selectedVehicleInfo) return [];
    
    const markers: ProcessedVehicleForMap[] = [];
    const isMotor = [selectedVehicleInfo.make, selectedVehicleInfo.model, selectedVehicleInfo.name]
      .some(field => field?.toLowerCase().includes('motor'));
    
    // Start marker
    const startData = optimizedData[0];
    const startLat = parseFloat(startData.latitude!);
    const startLng = parseFloat(startData.longitude!);
    
    if (isFinite(startLat) && isFinite(startLng)) {
      markers.push({
        id: `start-${selectedVehicle}`,
        name: `${selectedVehicleInfo.name} - Start`,
        licensePlate: selectedVehicleInfo.license_plate,
        position: [startLat, startLng],
        speed: startData.speed || 0,
        ignition: ['ON', 'true', '1'].includes(startData.ignition_status || ''),
        fuel: startData.fuel_level ? parseFloat(startData.fuel_level) : null,
        battery: startData.battery_level ? parseFloat(startData.battery_level) : null,
        timestamp: startData.timestamp,
        isMotor: isMotor,
        status: 'parked' as const
      });
    }
    
    // End marker (only if different from start)
    if (optimizedData.length > 1) {
      const endData = optimizedData[optimizedData.length - 1];
      const endLat = parseFloat(endData.latitude!);
      const endLng = parseFloat(endData.longitude!);
      
      if (isFinite(endLat) && isFinite(endLng)) {
        markers.push({
          id: `end-${selectedVehicle}`,
          name: `${selectedVehicleInfo.name} - End`,
          licensePlate: selectedVehicleInfo.license_plate,
          position: [endLat, endLng],
          speed: endData.speed || 0,
          ignition: ['ON', 'true', '1'].includes(endData.ignition_status || ''),
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

  // 🔧 Enhanced vehicle change handler
  const handleVehicleChange = useCallback((vehicleId: string) => {
    console.log('Vehicle selection changed to:', vehicleId);
    
    if (!vehicleId || vehicleId === '') {
      setSelectedVehicle(null);
      return;
    }
    
    if (!Array.isArray(vehicles)) {
      console.error('Vehicles is not an array:', typeof vehicles);
      toast.error('Error: Vehicle data is corrupted');
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
    } else {
      toast.info(`Selected vehicle: ${vehicleInfo.name}`);
    }
  }, [vehicles]);

  // 🔧 Enhanced refresh handler
  const handleRefresh = useCallback(() => {
    console.log('Manual refresh triggered');
    toast.info('Refreshing data...');
    
    const promises = [mutateVehicles()];
    
    if (selectedVehicleInfo?.gps_id && dateRange) {
      promises.push(mutateVehicleData());
    }
    
    Promise.all(promises)
      .then(() => {
        toast.success('Data refreshed successfully');
      })
      .catch((error) => {
        console.error('Refresh error:', error);
        toast.error('Failed to refresh data');
      });
  }, [mutateVehicles, mutateVehicleData, selectedVehicleInfo, dateRange]);

  // 🔧 Enhanced date range handlers
  const handleDateRangeChange = useCallback((field: 'from' | 'to', date: string) => {
    if (!date) return;
    
    const newDate = new Date(date);
    if (isNaN(newDate.getTime())) {
      toast.error('Invalid date selected');
      return;
    }
    
    setDateRange(prev => {
      const updated = {
        from: field === 'from' ? newDate : (prev?.from || new Date()),
        to: field === 'to' ? newDate : (prev?.to || new Date())
      };
      
      // Validate date range
      if (updated.from > updated.to) {
        toast.warning('Start date cannot be after end date');
        return prev;
      }
      
      const daysDiff = (updated.to.getTime() - updated.from.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        toast.warning('Date range cannot exceed 365 days');
        return prev;
      }
      
      return updated;
    });
  }, []);

  const setQuickDateRange = useCallback((days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    setDateRange({ from, to });
    toast.info(`Date range set to last ${days} day${days > 1 ? 's' : ''}`);
  }, []);

  // 🔧 Enhanced date formatting
  const formatDate = useCallback((dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return dateStr;
    }
  }, []);

  // 🔧 Loading and error states
  const isLoading = vehiclesLoading;
  const hasError = vehiclesError || vehicleDataError;
  const isLoadingData = vehicleDataLoading;
  const hasCriticalError = vehiclesError && vehicles.length === 0;

  // 🔧 Critical error state
  if (hasCriticalError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to Load Data</h3>
            <p className="text-slate-600 mb-6">
              {vehiclesError?.message || 'An error occurred while loading vehicles'}
            </p>
            <Button onClick={handleRefresh} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 🔧 Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-400 rounded-full animate-ping mx-auto"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Loading Vehicle History</h3>
          <p className="text-slate-600">Retrieving your vehicle data...</p>
        </div>
      </div>
    );
  }

  // 🔧 No vehicles state
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
          className="text-sm w-full sm:w-auto"
        >
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
                {Array.isArray(vehicles) && vehicles.map((vehicle: Vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {vehicle.name} ({vehicle.license_plate}) 
                    {vehicle.gps_id ? ` - GPS: ${vehicle.gps_id}` : ' - No GPS'}
                  </option>
                ))}
              </select>
              {selectedVehicle && selectedVehicleInfo && !selectedVehicleInfo.gps_id && (
                <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  This vehicle does not have GPS tracking enabled
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
            <Button size="sm" variant="outline" onClick={() => setQuickDateRange(90)}>
              Last 90 days
            </Button>
          </div>

          {/* Map optimization controls for large datasets */}
          {processedVehicleData.length > 5000 && (
            <div className="pt-2 border-t">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Map Detail Level ({processedVehicleData.length.toLocaleString()} total points)
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={mapOptimizationLevel === 'auto' ? 'default' : 'outline'}
                  onClick={() => setMapOptimizationLevel('auto')}
                >
                  Auto
                </Button>
                <Button
                  size="sm"
                  variant={mapOptimizationLevel === 'high' ? 'default' : 'outline'}
                  onClick={() => setMapOptimizationLevel('high')}
                >
                  High Performance
                </Button>
                <Button
                  size="sm"
                  variant={mapOptimizationLevel === 'medium' ? 'default' : 'outline'}
                  onClick={() => setMapOptimizationLevel('medium')}
                >
                  Balanced
                </Button>
                <Button
                  size="sm"
                  variant={mapOptimizationLevel === 'low' ? 'default' : 'outline'}
                  onClick={() => setMapOptimizationLevel('low')}
                >
                  High Detail
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedVehicle && processedVehicleData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
                  <p className="text-sm text-slate-500">Stops</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.stops}</p>
                </div>
                <MapPin className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Data Points</p>
                  <p className="text-2xl font-bold text-slate-800">{processedVehicleData.length.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Map: {optimizedData.length.toLocaleString()}</p>
                </div>
                <MapPin className="w-8 h-8 text-indigo-500" />
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
                Route: {routePolyline.length.toLocaleString()} points
              </Badge>
            )}
            {isLoadingData && (
              <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Loading {processedVehicleData.length > 0 ? `${processedVehicleData.length.toLocaleString()} points...` : '...'}
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
                  {processedVehicleData.length > 0 && (
                    <p className="text-sm text-slate-500 mt-1">
                      {processedVehicleData.length.toLocaleString()} points loaded
                    </p>
                  )}
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

      {/* Journey Details - Virtual scrolling for large datasets */}
      {selectedVehicle && processedVehicleData.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Journey Details
              <Badge variant="outline" className="ml-auto">
                {processedVehicleData.length.toLocaleString()} records
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {optimizedData.slice(0, 200).map((data, index) => (
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
              {processedVehicleData.length > 200 && (
                <div className="text-center py-3 text-sm text-slate-500 border-t">
                  Showing first 200 of {processedVehicleData.length.toLocaleString()} records
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Status Indicator */}
      {!hasError && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
            <div className={`w-2 h-2 rounded-full ${isLoadingData ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-xs text-slate-600 font-medium">
              {isLoadingData ? 
                `Loading ${processedVehicleData.length > 0 ? processedVehicleData.length.toLocaleString() + ' points' : 'data'}...` : 
                'Ready'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}