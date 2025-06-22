import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car, MapPin, AlertTriangle, Shield, Fuel, Zap, Clock, TrendingUp,
  Loader2, RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp, Maximize2, Minimize2
} from "lucide-react";
import { toast } from "sonner";
import dynamic from 'next/dynamic';

// Dynamic imports
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 md:h-96 bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-sm text-gray-600 mt-2">Loading map...</p>
    </div>
  )
});

// Import type from MapComponent if available, otherwise define compatible type
import type { ProcessedVehicle as MapVehicle } from './MapComponent';

// Types
interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at?: string;
  updated_at: string | null;
  vehicle_photo: string | null;
  geofence_id?: number | string | null;
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

interface ProjectGeofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][];
    center?: [number, number];
    radius?: number;
    type: string;
  };
  date_created: string;
}

interface ProcessedVehicle extends MapVehicle {
  isOnline: boolean;
  location: string;
}

// Props interface
interface DashboardProps {
  isConnected: boolean;
  vehicles: Vehicle[];
  vehicleData: VehicleData[];
  geofences: ProjectGeofence[];
  alerts?: any[];
  onRefresh?: () => void;
}

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const getLocationName = (lat: string, lng: string): string => {
  const latitude = parseFloat_(lat);
  const longitude = parseFloat_(lng);
  
  if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
    return "Bandung, Jawa Barat";
  }
  if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
    return "Jakarta";
  }
  return `${lat}, ${lng}`;
};

const getVehicleStatus = (data: VehicleData | undefined): 'moving' | 'parked' | 'offline' => {
  if (!data?.timestamp) return 'offline';
  
  const diffMinutes = (Date.now() - new Date(data.timestamp).getTime()) / 60000;
  if (diffMinutes > 10) return 'offline';
  return (data.speed ?? 0) > 0 ? 'moving' : 'parked';
};

const isVehicleOnline = (data: VehicleData | undefined): boolean => {
  if (!data?.timestamp) return false;
  return (Date.now() - new Date(data.timestamp).getTime()) / 60000 <= 10;
};

const isMotorVehicle = (vehicle: Vehicle): boolean => {
  const checkStrings = [vehicle.make, vehicle.model, vehicle.name].map(s => s?.toLowerCase() || '');
  return checkStrings.some(str => str.includes('motor'));
};

// Custom hooks
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
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

// Main component
export function Dashboard({ 
  isConnected, 
  vehicles, 
  vehicleData, 
  geofences, 
  alerts = [],
  onRefresh 
}: DashboardProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [expandedVehicleList, setExpandedVehicleList] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [lastUpdate] = useState(new Date());
  const isOnline = useOnlineStatus();

  // Process vehicles
  const processedVehicles = useMemo((): ProcessedVehicle[] => {
    if (!vehicles.length) return [];

    const dataMap = new Map<string, VehicleData>();
    
    vehicleData.forEach(data => {
      const key = data.gps_id || data.vehicle_id;
      if (!key) return;
      
      const existing = dataMap.get(key);
      if (!existing || (data.timestamp && existing.timestamp && 
          new Date(data.timestamp) > new Date(existing.timestamp))) {
        dataMap.set(key, data);
      }
    });

    return vehicles.map(vehicle => {
      const latestData = dataMap.get(vehicle.gps_id || '') || dataMap.get(vehicle.vehicle_id);
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      let position: [number, number] = [0, 0];
      
      if (latestData?.latitude && latestData?.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
        const lat = parseFloat_(latestData.latitude);
        const lng = parseFloat_(latestData.longitude);
        if (lat && lng) position = [lat, lng];
      }

      return {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        licensePlate: vehicle.license_plate,
        position,
        speed: latestData?.speed ?? 0,
        ignition: latestData?.ignition_status === 'ON',
        fuel: latestData?.fuel_level ? parseFloat_(latestData.fuel_level) : null,
        battery: latestData?.battery_level ? parseFloat_(latestData.battery_level) : null,
        timestamp: latestData?.timestamp || null,
        isMotor: isMotorVehicle(vehicle),
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || 0,
        status,
        isOnline: online,
        location
      };
    });
  }, [vehicles, vehicleData]);

  const vehiclesForMap = useMemo(() => {
    return processedVehicles.filter(v => v.position[0] !== 0 && v.position[1] !== 0);
  }, [processedVehicles]);

  // Stats
  const stats = useMemo(() => {
    const total = processedVehicles.length;
    const online = processedVehicles.filter(v => v.isOnline).length;
    const alertCount = processedVehicles.filter(v => 
      (v.fuel ?? 0) < 20 || (v.speed ?? 0) > 80
    ).length;
    
    return {
      totalVehicles: total,
      activeTracking: online,
      activeAlerts: Math.max(alertCount, alerts.length),
      geofences: geofences.length
    };
  }, [processedVehicles, alerts.length, geofences.length]);

  // Handlers
  const handleVehicleClick = useCallback((vehicle: MapVehicle) => {
    setSelectedVehicleId(prev => prev === vehicle.id ? null : vehicle.id);
  }, []);

  const handleRefresh = useCallback(() => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline');
      return;
    }
    
    if (!isConnected) {
      toast.error('Not connected to real-time updates');
      return;
    }
    
    // Call parent's refresh function if provided
    if (onRefresh) {
      onRefresh();
    }
  }, [isConnected, isOnline, onRefresh]);

  const dashboardStats = [
    { 
      title: "Total", 
      value: stats.totalVehicles.toString(), 
      change: `${stats.activeTracking} online`, 
      icon: Car, 
      color: "blue" 
    },
    { 
      title: "Active", 
      value: stats.activeTracking.toString(), 
      change: `${stats.totalVehicles - stats.activeTracking} offline`, 
      icon: MapPin, 
      color: "green" 
    },
    { 
      title: "Alerts", 
      value: stats.activeAlerts.toString(), 
      change: "Active", 
      icon: AlertTriangle, 
      color: "red" 
    },
    { 
      title: "Zones", 
      value: stats.geofences.toString(), 
      change: "Active", 
      icon: Shield, 
      color: "purple" 
    }
  ];

  const getStatColors = (color: string) => ({
    bg: `bg-${color}-100`,
    text: `text-${color}-600`
  });

  return (
    <div className="relative">
      {/* Fullscreen Map Overlay */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black">
          <div className="relative w-full h-full">
            <MapComponent
              vehicles={vehiclesForMap}
              selectedVehicleId={selectedVehicleId}
              onVehicleClick={handleVehicleClick}
              onMapClick={() => setSelectedVehicleId(null)}
              height="100%"
            />
            
            <button
              onClick={() => setMapFullscreen(false)}
              className="absolute top-4 right-4 z-50 p-3 bg-white/90 backdrop-blur rounded-lg shadow-lg hover:bg-white transition-colors"
            >
              <Minimize2 className="w-5 h-5 text-gray-700" />
            </button>

            {/* Vehicle Info Overlay in Fullscreen */}
            {selectedVehicleId && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 max-h-48 overflow-y-auto">
                {(() => {
                  const vehicle = processedVehicles.find(v => v.id === selectedVehicleId);
                  if (!vehicle) return null;
                  
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{vehicle.name}</h3>
                        <Badge 
                          className={`${
                            vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 
                            vehicle.status === 'parked' ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{vehicle.location}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Speed</span>
                          <p className="font-semibold">{vehicle.speed} km/h</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Fuel</span>
                          <p className="font-semibold">{(vehicle.fuel ?? 0).toFixed(0)}%</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Battery</span>
                          <p className="font-semibold">{(vehicle.battery ?? 0).toFixed(1)}V</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4 p-4 pb-20 md:pb-4 max-w-full overflow-x-hidden">
        {/* Status Bar - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-xs sm:text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {isOnline && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-600">
                  {isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
                </span>
              </div>
            )}
            
            <span className="text-xs text-gray-600">
              {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={!isConnected}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Grid - Compact for Mobile */}
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {dashboardStats.map((stat, index) => {
            const colors = getStatColors(stat.color);
            return (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-2 sm:p-3 md:p-6">
                  <div className="flex flex-col items-center text-center">
                    <div className={`p-1.5 sm:p-2 md:p-3 rounded-lg ${colors.bg} mb-1 sm:mb-2`}>
                      <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 ${colors.text}`} />
                    </div>
                    <span className="text-base sm:text-lg md:text-2xl font-bold text-slate-800">{stat.value}</span>
                    <h3 className="text-xs font-medium text-slate-600 mt-0.5">{stat.title}</h3>
                    <p className="text-xs text-slate-500 hidden sm:block">{stat.change}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Map - Enhanced and More Prominent */}
        <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[calc(100vh-20rem)] w-full rounded-lg overflow-hidden bg-gray-100 shadow-lg">
          <MapComponent
            vehicles={vehiclesForMap}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleClick}
            onMapClick={() => setSelectedVehicleId(null)}
            height="100%"
          />

          {/* Fullscreen Toggle Button */}
          <button
            onClick={() => setMapFullscreen(!mapFullscreen)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50 p-2 bg-white/90 backdrop-blur rounded-lg shadow-md hover:bg-white transition-colors"
            title={mapFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {mapFullscreen ? (
              <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            ) : (
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            )}
          </button>

          {/* Connection Status Overlay */}
          {!isConnected && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-50">
              <Card className="bg-red-50/95 backdrop-blur border-red-200">
                <CardContent className="p-2 sm:p-3">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                    <span className="text-xs sm:text-sm text-red-700">No Real-time Data</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Vehicle List - Mobile Optimized with Collapsible */}
        <Card>
          <CardHeader 
            className="pb-3 cursor-pointer md:cursor-default"
            onClick={() => setExpandedVehicleList(!expandedVehicleList)}
          >
            <CardTitle className="flex items-center justify-between gap-2 text-sm sm:text-base">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" /> 
                <span>Live Vehicles ({stats.activeTracking} online)</span>
              </div>
              <div className="md:hidden">
                {expandedVehicleList ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
          
          <CardContent className={`transition-all duration-300 ${expandedVehicleList || 'md:block hidden'}`}>
            <div className="max-h-64 md:max-h-96 overflow-y-auto">
              {processedVehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Car className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No vehicles available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {processedVehicles.map(vehicle => (
                    <div
                      key={vehicle.id}
                      className={`p-3 border rounded cursor-pointer transition-all ${
                        selectedVehicleId === vehicle.id 
                          ? 'bg-blue-50 border-blue-200 shadow-md' 
                          : vehicle.isOnline 
                            ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => handleVehicleClick(vehicle)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-xs sm:text-sm text-slate-800 truncate pr-2">{vehicle.name}</h4>
                        <Badge 
                          className={`text-xs ${
                            vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 
                            vehicle.status === 'parked' ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-slate-600 mb-2 truncate">{vehicle.location}</p>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-blue-600">{vehicle.speed} km/h</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Fuel className="w-3 h-3 text-blue-500" />
                            <span>{(vehicle.fuel ?? 0).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-green-500" />
                            <span>{(vehicle.battery ?? 0).toFixed(1)}V</span>
                          </div>
                        </div>
                      </div>
                      
                      {vehicle.timestamp && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(vehicle.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}