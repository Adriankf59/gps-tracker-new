"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, MapPin, Clock, Car, Route, Loader2, RefreshCw, Calendar, AlertCircle, Navigation, Wifi, WifiOff } from "lucide-react";
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

// Constants
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://vehitrack.my.id/websocket';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://vehitrack.my.id/directus';
const RECONNECT_INTERVAL = 5000;
const PING_INTERVAL = 30000;

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
  vehicle_datas_id?: string;
  gps_id: string | null;
  vehicle_id?: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm?: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used?: number | null;
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
  make?: string;
  model?: string;
  year?: number;
}

// Custom hooks
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

const useUser = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return { userData: null, userId: undefined };
    
    try {
      const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
      return {
        userData,
        userId: userData.id || userData.user_id
      };
    } catch {
      return { userData: null, userId: undefined };
    }
  }, []);
};

// WebSocket Hook for Live Data
const useWebSocket = (userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const isOnline = useOnlineStatus();

  // Load initial data
  useEffect(() => {
    if (!userId) return;
    
    const loadData = async () => {
      console.log('Loading initial data...');
      try {
        // Load vehicles
        const vehiclesRes = await fetch(`${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1`);
        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json();
          setVehicles(data.data || []);
        }

        // Load recent vehicle data (last 24 hours for all vehicles)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const vehicleDataRes = await fetch(
          `${API_BASE_URL}/items/vehicle_datas?filter[timestamp][_gte]=${yesterday.toISOString()}&limit=5000&sort=-timestamp`
        );
        if (vehicleDataRes.ok) {
          const data = await vehicleDataRes.json();
          setVehicleData(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // WebSocket connection
  useEffect(() => {
    if (!userId || !isOnline) return;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      console.log('Connecting to WebSocket...');
      const ws = new WebSocket(`${WS_URL}?userId=${userId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        
        // Subscribe to collections
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle' }));
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle_datas' }));
        
        // Ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'subscription' && message.data) {
            const { event: eventType, data } = message;
            
            if (eventType === 'init' && Array.isArray(data) && data.length > 0) {
              const firstItem = data[0];
              
              if (firstItem.vehicle_id && firstItem.license_plate) {
                setVehicles(data.filter((v: Vehicle) => v.user_id === userId));
              } else if (firstItem.gps_id && firstItem.latitude) {
                // Keep all data for history
                setVehicleData(prev => {
                  const newData = [...data, ...prev];
                  // Keep unique entries based on timestamp and gps_id
                  const uniqueMap = new Map();
                  newData.forEach(item => {
                    const key = `${item.gps_id}_${item.timestamp}`;
                    if (!uniqueMap.has(key)) {
                      uniqueMap.set(key, item);
                    }
                  });
                  return Array.from(uniqueMap.values()).slice(0, 10000); // Keep last 10k records
                });
                setLastUpdate(new Date());
              }
            } else if ((eventType === 'create' || eventType === 'update') && data[0]) {
              const item = data[0];
              
              if (item.vehicle_id && item.license_plate) {
                setVehicles(prev => {
                  const index = prev.findIndex(v => v.vehicle_id === item.vehicle_id);
                  if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = item;
                    return updated;
                  }
                  return item.user_id === userId ? [...prev, item] : prev;
                });
              } else if (item.gps_id && item.latitude) {
                setVehicleData(prev => {
                  const newData = [item, ...prev];
                  // Keep unique entries
                  const uniqueMap = new Map();
                  newData.forEach(d => {
                    const key = `${d.gps_id}_${d.timestamp}`;
                    if (!uniqueMap.has(key)) {
                      uniqueMap.set(key, d);
                    }
                  });
                  return Array.from(uniqueMap.values()).slice(0, 10000);
                });
                setLastUpdate(new Date());
              }
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setConnectionError('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Reconnect
        if (isOnline) {
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_INTERVAL);
        }
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [userId, isOnline]);

  return {
    isConnected,
    vehicles,
    vehicleData,
    lastUpdate,
    connectionError,
    isInitialLoading
  };
};

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

export function HistoryManager() {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | undefined>(undefined);
  const [showAllVehicles, setShowAllVehicles] = useState(true);
  const [autoCenter, setAutoCenter] = useState(false);

  const { userId } = useUser();
  const isOnline = useOnlineStatus();

  // Use WebSocket hook
  const {
    isConnected,
    vehicles,
    vehicleData,
    lastUpdate,
    connectionError,
    isInitialLoading
  } = useWebSocket(userId);

  // Initialize date range
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    setDateRange({
      from: yesterday,
      to: today
    });
  }, []);

  // Get location name
  const getLocationName = useCallback((latStr: string | null, lngStr: string | null): string => {
    if (!latStr || !lngStr) return 'Location unknown';
    
    const latitude = parseFloat_(latStr);
    const longitude = parseFloat_(lngStr);
    
    if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
      return "Bandung, Jawa Barat";
    }
    if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
      return "Jakarta";
    }
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }, []);

  // Filter vehicle data by date range and selected vehicle
  const filteredVehicleData = useMemo(() => {
    if (!dateRange) return [];
    
    let filtered = vehicleData.filter(data => {
      if (!data.timestamp) return false;
      const dataDate = new Date(data.timestamp);
      return dataDate >= dateRange.from && dataDate <= dateRange.to;
    });

    // If a specific vehicle is selected and not showing all vehicles
    if (selectedVehicle && !showAllVehicles) {
      const vehicle = vehicles.find(v => v.vehicle_id === selectedVehicle);
      if (vehicle?.gps_id) {
        filtered = filtered.filter(data => data.gps_id === vehicle.gps_id);
      }
    }

    // Sort by timestamp
    return filtered.sort((a, b) => 
      new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
    );
  }, [vehicleData, dateRange, selectedVehicle, showAllVehicles, vehicles]);

  // Process vehicles for current positions on map
  const processedVehiclesForMap = useMemo((): ProcessedVehicleForMap[] => {
    const vehiclesToShow = showAllVehicles ? vehicles : 
      selectedVehicle ? vehicles.filter(v => v.vehicle_id === selectedVehicle) : [];

    return vehiclesToShow.map(vehicle => {
      // Find latest data for this vehicle
      const latestData = vehicleData
        .filter(data => data.gps_id === vehicle.gps_id)
        .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())[0];

      if (!latestData?.latitude || !latestData?.longitude) {
        return null;
      }

      const lat = parseFloat_(latestData.latitude);
      const lng = parseFloat_(latestData.longitude);
      if (!lat || !lng) return null;

      const isMotor = [vehicle.make, vehicle.model, vehicle.name]
        .some(field => field?.toLowerCase().includes('motor'));

      // Check if vehicle is online (data within last 10 minutes)
      const isOnlineVehicle = latestData.timestamp ? 
        (Date.now() - new Date(latestData.timestamp).getTime()) / 60000 <= 10 : false;
      
      const status = !isOnlineVehicle ? 'offline' : 
        (latestData.speed ?? 0) > 0 ? 'moving' : 'parked';

      return {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        licensePlate: vehicle.license_plate,
        position: [lat, lng],
        speed: latestData.speed ?? 0,
        ignition: ['ON', 'true', '1'].includes(latestData.ignition_status || ''),
        fuel: latestData.fuel_level ? parseFloat_(latestData.fuel_level) : null,
        battery: latestData.battery_level ? parseFloat_(latestData.battery_level) : null,
        timestamp: latestData.timestamp,
        isMotor,
        status,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year
      };
    }).filter((v): v is ProcessedVehicleForMap => v !== null);
  }, [vehicles, vehicleData, showAllVehicles, selectedVehicle]);

  // Calculate route polyline for selected vehicle
  const routePolyline = useMemo(() => {
    if (showAllVehicles || !selectedVehicle) return [];

    return filteredVehicleData
      .map(data => {
        if (!data.latitude || !data.longitude) return null;
        
        const lat = parseFloat_(data.latitude);
        const lng = parseFloat_(data.longitude);
        
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          return null;
        }
        
        return [lat, lng] as [number, number];
      })
      .filter((point): point is [number, number] => point !== null);
  }, [filteredVehicleData, showAllVehicles, selectedVehicle]);

  // Haversine distance calculation
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

  // Calculate statistics
  const stats = useMemo(() => {
    const dataToAnalyze = filteredVehicleData;
    
    if (dataToAnalyze.length === 0) {
      return { distance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0, vehicleCount: 0 };
    }

    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let validSpeedCount = 0;
    const uniqueVehicles = new Set<string>();
    
    // Group by vehicle for distance calculation
    const vehicleGroups = new Map<string, VehicleData[]>();
    dataToAnalyze.forEach(data => {
      const key = data.gps_id || data.vehicle_id || 'unknown';
      uniqueVehicles.add(key);
      if (!vehicleGroups.has(key)) {
        vehicleGroups.set(key, []);
      }
      vehicleGroups.get(key)!.push(data);
    });

    // Calculate distance for each vehicle
    vehicleGroups.forEach((vehicleData) => {
      const sorted = vehicleData.sort((a, b) => 
        new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
      );

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        
        if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
          const distance = calculateDistance(
            parseFloat_(prev.latitude),
            parseFloat_(prev.longitude),
            parseFloat_(curr.latitude),
            parseFloat_(curr.longitude)
          );
          
          if (isFinite(distance) && distance >= 0 && distance < 100) { // Filter out unrealistic jumps
            totalDistance += distance;
          }
        }
        
        if (curr.speed !== null && curr.speed !== undefined && isFinite(curr.speed)) {
          totalSpeed += curr.speed;
          maxSpeed = Math.max(maxSpeed, curr.speed);
          validSpeedCount++;
        }
      }
    });

    const startTime = new Date(dataToAnalyze[0].timestamp!);
    const endTime = new Date(dataToAnalyze[dataToAnalyze.length - 1].timestamp!);
    const duration = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    const avgSpeed = validSpeedCount > 0 ? totalSpeed / validSpeedCount : 0;

    return {
      distance: totalDistance.toFixed(2),
      duration: duration.toFixed(1),
      avgSpeed: avgSpeed.toFixed(1),
      maxSpeed: maxSpeed.toFixed(1),
      vehicleCount: uniqueVehicles.size
    };
  }, [filteredVehicleData, calculateDistance]);

  // Handlers
  const handleVehicleChange = useCallback((vehicleId: string) => {
    setSelectedVehicle(vehicleId || null);
    if (vehicleId) {
      const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
      if (vehicle) {
        toast.info(`Selected: ${vehicle.name}`);
      }
    }
  }, [vehicles]);

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
      
      if (updated.from > updated.to) {
        toast.warning('Start date cannot be after end date');
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

  const handleRefresh = useCallback(() => {
    // Force update by changing lastUpdate
    toast.info('Data refreshed');
  }, []);

  // Calculate center coordinates
  const centerCoordinates = useMemo((): [number, number] | undefined => {
    if (processedVehiclesForMap.length > 0) {
      // If only one vehicle or auto-center is on, center on first/selected vehicle
      if (processedVehiclesForMap.length === 1 || (autoCenter && selectedVehicle)) {
        const targetVehicle = selectedVehicle ? 
          processedVehiclesForMap.find(v => v.id === selectedVehicle) : 
          processedVehiclesForMap[0];
        
        if (targetVehicle) {
          return targetVehicle.position;
        }
      }
      
      // Otherwise calculate center of all vehicles
      const sumLat = processedVehiclesForMap.reduce((sum, v) => sum + v.position[0], 0);
      const sumLng = processedVehiclesForMap.reduce((sum, v) => sum + v.position[1], 0);
      return [
        sumLat / processedVehiclesForMap.length,
        sumLng / processedVehiclesForMap.length
      ];
    }
    
    // Default center (Jakarta)
    return [-6.2088, 106.8456];
  }, [processedVehiclesForMap, autoCenter, selectedVehicle]);

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading vehicle history...</p>
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
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="text-green-600">
              <Wifi className="w-3 h-3 mr-1" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-600">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          )}
          <Button 
            variant="outline"
            onClick={handleRefresh}
            className="text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
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
                Vehicle Filter
              </label>
              <div className="space-y-2">
                <select
                  className="w-full rounded-md border border-slate-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={selectedVehicle || ''}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                >
                  <option value="">All vehicles</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      {vehicle.name} ({vehicle.license_plate})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showAll"
                    checked={showAllVehicles}
                    onChange={(e) => setShowAllVehicles(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="showAll" className="text-sm text-slate-600">
                    Show all vehicles on map
                  </label>
                </div>
              </div>
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
                <p className="text-sm text-slate-500">Active Vehicles</p>
                <p className="text-2xl font-bold text-slate-800">{stats.vehicleCount}</p>
                <p className="text-xs text-slate-400">of {vehicles.length} total</p>
              </div>
              <MapPin className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              {showAllVehicles ? 'All Vehicles' : 'Route Map'}
              {processedVehiclesForMap.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {processedVehiclesForMap.length} vehicle{processedVehiclesForMap.length > 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {selectedVehicle && !showAllVehicles && (
              <Button
                variant={autoCenter ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoCenter(!autoCenter)}
                className={autoCenter ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                <Navigation className={`w-4 h-4 ${autoCenter ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline ml-1">
                  {autoCenter ? 'Following' : 'Free'}
                </span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[600px] rounded-b-xl overflow-hidden m-4">
            {vehicles.length === 0 ? (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="text-center">
                  <Car className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">No vehicles available</p>
                </div>
              </div>
            ) : processedVehiclesForMap.length === 0 && filteredVehicleData.length === 0 ? (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="text-center">
                  <History className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">No data available for selected period</p>
                  <p className="text-sm text-slate-500">Try selecting a different date range</p>
                </div>
              </div>
            ) : (
              <MapComponent
                vehicles={processedVehiclesForMap}
                selectedVehicleId={selectedVehicle}
                onVehicleClick={(vehicle) => handleVehicleChange(vehicle.id)}
                onMapClick={() => {}}
                routePolyline={routePolyline}
                centerCoordinates={centerCoordinates}
                zoomLevel={showAllVehicles && processedVehiclesForMap.length > 1 ? 10 : 14}
                height="600px"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Journey Details - Only show when specific vehicle is selected */}
      {selectedVehicle && !showAllVehicles && filteredVehicleData.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Journey Details
              <Badge variant="outline" className="ml-auto">
                {filteredVehicleData.length} records
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredVehicleData.slice(0, 100).map((data, index) => (
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
                        {new Date(data.timestamp!).toLocaleString('id-ID')}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {data.speed || 0} km/h
                      </Badge>
                      {data.fuel_level && (
                        <Badge variant="outline" className="text-xs bg-blue-50">
                          Fuel: {parseFloat_(data.fuel_level).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {getLocationName(data.latitude, data.longitude)}
                    </p>
                  </div>
                </div>
              ))}
              {filteredVehicleData.length > 100 && (
                <div className="text-center py-3 text-sm text-slate-500 border-t">
                  Showing first 100 of {filteredVehicleData.length} records
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-600 font-medium">
            {isConnected ? 'Real-time active' : connectionError || 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}