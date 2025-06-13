"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  MapPin,
  Navigation,
  Car,
  Fuel,
  Zap,
  Gauge,
  Clock,
  Satellite,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  Shield,
  AlertTriangle,
  Bell,
  ShieldAlert,
  X,
  Wifi,
  WifiOff,
  List,
  ChevronUp
} from "lucide-react";
import { toast } from 'sonner';

// Mock Map Component
const MapComponent = ({ vehicles = [], selectedVehicleId = null, displayGeofences = [] }) => {
  return (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center relative">
      <div className="text-center">
        <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-2" />
        <p className="text-slate-600">Map View</p>
        {vehicles.length > 0 && (
          <p className="text-sm text-slate-500 mt-2">
            {vehicles.length} vehicle{vehicles.length > 1 ? 's' : ''} on map
          </p>
        )}
      </div>
    </div>
  );
};

// Types
interface Vehicle {
  vehicle_id: string;
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  relay_status: string | null;
  geofence_id?: number | string | null;
}

interface VehicleData {
  vehicle_id?: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used?: number | null;
}

interface VehicleWithTracking extends Vehicle {
  latestData?: VehicleData;
  status: "moving" | "parked" | "offline";
  location: string;
  lastUpdateString: string;
  isOnline: boolean;
}

interface GeofenceAlert {
  vehicle_id: number;
  alert_type: "violation_enter" | "violation_exit" | "violation_stay_out";
  alert_message: string;
  lokasi: string;
  timestamp: string;
}

// Mock data
const mockVehicles: VehicleWithTracking[] = [
  {
    vehicle_id: "1",
    name: "Truck Jakarta 01",
    license_plate: "B 1234 XYZ",
    make: "Toyota",
    model: "Dyna",
    year: 2020,
    relay_status: "ON",
    geofence_id: "1",
    latestData: {
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      latitude: "-6.2088",
      longitude: "106.8456",
      speed: 45,
      fuel_level: "75",
      ignition_status: "ON",
      battery_level: "13.8",
      satellites_used: 12
    },
    status: "moving",
    location: "Jakarta, Indonesia",
    lastUpdateString: "2m ago",
    isOnline: true
  },
  {
    vehicle_id: "2",
    name: "Van Delivery 05",
    license_plate: "B 5678 ABC",
    make: "Mitsubishi",
    model: "L300",
    year: 2019,
    relay_status: "OFF",
    latestData: {
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      latitude: "-6.3021",
      longitude: "106.8951",
      speed: 0,
      fuel_level: "15",
      ignition_status: "OFF",
      battery_level: "12.5",
      satellites_used: 8
    },
    status: "parked",
    location: "Bekasi, Jawa Barat",
    lastUpdateString: "30m ago",
    isOnline: true
  },
  {
    vehicle_id: "3",
    name: "Motor Kurir 02",
    license_plate: "B 9012 DEF",
    make: "Honda",
    model: "Beat",
    year: 2021,
    relay_status: "OFF",
    status: "offline",
    location: "Last: Depok",
    lastUpdateString: "2h ago",
    isOnline: false
  }
];

// Alert notification component
const GeofenceViolationNotification = ({ 
  alert, 
  onDismiss 
}: { 
  alert: GeofenceAlert;
  onDismiss: () => void;
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 8000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!isVisible) return null;

  // Mobile-optimized notification
  return (
    <div 
      className="fixed top-16 left-2 right-2 sm:left-auto sm:right-4 sm:w-96 transition-all duration-300 ease-in-out z-50"
    >
      <Card className="shadow-2xl border-2 border-red-500 bg-red-50">
        <CardHeader className="pb-2 bg-red-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
              <CardTitle className="text-base sm:text-lg font-bold text-slate-800">
                🚨 Geofence Violation!
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="h-6 w-6 p-0 hover:bg-red-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-3">
          <p className="text-sm font-medium text-slate-700 mb-2">
            {alert.alert_message}
          </p>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(alert.timestamp).toLocaleTimeString('id-ID')}
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {alert.lokasi}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function LiveTracking() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeAlert, setActiveAlert] = useState<GeofenceAlert | null>(null);
  const [showVehicleSheet, setShowVehicleSheet] = useState(false);
  const [showStatsSheet, setShowStatsSheet] = useState(false);
  
  // Sample recent alerts
  const recentAlerts = 2;

  // Get selected vehicle details
  const selectedVehicle = useMemo(() => {
    return mockVehicles.find(v => v.vehicle_id === selectedVehicleId) || null;
  }, [selectedVehicleId]);

  // Calculate statistics
  const stats = useMemo(() => {
    const online = mockVehicles.filter(v => v.isOnline);
    const moving = online.filter(v => v.status === 'moving');
    const parked = online.filter(v => v.status === 'parked');
    
    return {
      moving: moving.length,
      parked: parked.length,
      offline: mockVehicles.filter(v => !v.isOnline).length,
      avgSpeed: moving.length > 0 ? 45 : 0,
      avgFuel: 45
    };
  }, []);

  // Mock processedVehicleForMap
  const processedVehicleForMap = useMemo(() => {
    if (!selectedVehicle?.latestData) return [];
    
    return [{
      id: selectedVehicle.vehicle_id,
      name: selectedVehicle.name,
      position: [
        parseFloat(selectedVehicle.latestData.latitude || "0"),
        parseFloat(selectedVehicle.latestData.longitude || "0")
      ]
    }];
  }, [selectedVehicle]);

  const handleVehicleSelect = (vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setShowVehicleSheet(false); // Close sheet on mobile after selection
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('Data refreshed');
    }, 1000);
  };

  const getStatusColorClass = (status: VehicleWithTracking['status']): string => {
    const statusMap = {
      'moving': 'bg-green-100 text-green-800 border-green-200',
      'parked': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'offline': 'bg-red-100 text-red-800 border-red-200'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Auto-select first vehicle
  useEffect(() => {
    if (!selectedVehicleId && mockVehicles.length > 0) {
      setSelectedVehicleId(mockVehicles[0].vehicle_id);
    }
  }, [selectedVehicleId]);

  // Simulate a sample alert
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveAlert({
        vehicle_id: 1,
        alert_type: "violation_enter",
        alert_message: "Vehicle entered forbidden zone",
        lokasi: "-6.2088, 106.8456",
        timestamp: new Date().toISOString()
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Alert Notification */}
      {activeAlert && (
        <GeofenceViolationNotification
          alert={activeAlert}
          onDismiss={() => setActiveAlert(null)}
        />
      )}

      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">Live Tracking</h1>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {isOnline ? (
                  <Wifi className="w-3 h-3 text-green-600" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-600" />
                )}
                <span>{mockVehicles.length} vehicles</span>
                {recentAlerts > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    <Bell className="w-3 h-3 mr-0.5" />
                    {recentAlerts}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            
            {/* Mobile Menu Button */}
            <Sheet open={showVehicleSheet} onOpenChange={setShowVehicleSheet}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="sm:hidden h-8 px-2">
                  <List className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh]">
                <SheetHeader>
                  <SheetTitle>Select Vehicle</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2 overflow-y-auto">
                  {mockVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.vehicle_id}
                      vehicle={vehicle}
                      isSelected={selectedVehicleId === vehicle.vehicle_id}
                      onSelect={handleVehicleSelect}
                      compact={false}
                    />
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-4 p-3 sm:p-4 overflow-hidden">
        {/* Map - Full screen on mobile */}
        <div className="flex-1 sm:col-span-2 lg:col-span-3 order-2 sm:order-1">
          <Card className="h-full shadow-lg">
            <CardContent className="p-0 h-full">
              <div className="h-full relative">
                <MapComponent
                  vehicles={processedVehicleForMap}
                  selectedVehicleId={selectedVehicleId}
                  displayGeofences={[]}
                />
                
                {/* Selected Vehicle Info Overlay - Mobile */}
                {selectedVehicle && (
                  <div className="absolute bottom-0 left-0 right-0 sm:hidden bg-white border-t shadow-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-sm">{selectedVehicle.name}</span>
                      </div>
                      <Badge className={`text-xs ${getStatusColorClass(selectedVehicle.status)}`}>
                        {selectedVehicle.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <Gauge className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                        <p>{selectedVehicle.latestData?.speed || 0} km/h</p>
                      </div>
                      <div className="text-center">
                        <Fuel className="w-4 h-4 mx-auto text-orange-500 mb-1" />
                        <p>{selectedVehicle.latestData?.fuel_level || 0}%</p>
                      </div>
                      <div className="text-center">
                        <Clock className="w-4 h-4 mx-auto text-slate-500 mb-1" />
                        <p>{selectedVehicle.lastUpdateString}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Vehicle List */}
        <div className="hidden sm:block order-1 sm:order-2 overflow-y-auto">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.vehicle_id}
                  vehicle={vehicle}
                  isSelected={selectedVehicleId === vehicle.vehicle_id}
                  onSelect={handleVehicleSelect}
                  compact={true}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Stats Button */}
      <div className="sm:hidden">
        <Sheet open={showStatsSheet} onOpenChange={setShowStatsSheet}>
          <SheetTrigger asChild>
            <Button 
              className="fixed bottom-20 right-4 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              Stats
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader>
              <SheetTitle>Fleet Statistics</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <StatsCard title="Moving" value={stats.moving} icon={Navigation} color="green" />
              <StatsCard title="Parked" value={stats.parked} icon={Car} color="yellow" />
              <StatsCard title="Avg Speed" value={`${stats.avgSpeed} km/h`} icon={Gauge} color="blue" />
              <StatsCard title="Avg Fuel" value={`${stats.avgFuel}%`} icon={Fuel} color="orange" />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Stats */}
      <div className="hidden sm:grid grid-cols-4 gap-4 p-4 bg-white border-t">
        <StatsCard title="Moving" value={stats.moving} icon={Navigation} color="green" />
        <StatsCard title="Parked" value={stats.parked} icon={Car} color="yellow" />
        <StatsCard title="Avg Speed" value={`${stats.avgSpeed} km/h`} icon={Gauge} color="blue" />
        <StatsCard title="Avg Fuel" value={`${stats.avgFuel}%`} icon={Fuel} color="orange" />
      </div>

      {/* Real-time Status Indicator */}
      <div className="fixed bottom-4 right-4 sm:bottom-auto sm:top-20 sm:right-4 z-40">
        <div className="flex items-center gap-2 bg-white shadow-lg border rounded-full px-3 py-1.5">
          <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-xs text-slate-600 font-medium">
            {refreshing ? 'Updating...' : 'Live'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Vehicle Card Component
const VehicleCard = ({ 
  vehicle, 
  isSelected, 
  onSelect, 
  compact 
}: { 
  vehicle: VehicleWithTracking;
  isSelected: boolean;
  onSelect: (vehicle: VehicleWithTracking) => void;
  compact: boolean;
}) => {
  const getStatusColorClass = (status: VehicleWithTracking['status']): string => {
    const statusMap = {
      'moving': 'bg-green-100 text-green-800 border-green-200',
      'parked': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'offline': 'bg-red-100 text-red-800 border-red-200'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div
      className={`p-3 cursor-pointer rounded-lg transition-all duration-150 border
        ${isSelected
          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
          : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      onClick={() => onSelect(vehicle)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Car className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-700' : 'text-slate-500'}`} />
          <span className={`font-medium text-sm truncate ${compact ? '' : 'text-base'}`}>
            {vehicle.name}
          </span>
          {isSelected && <Eye className="w-3.5 h-3.5 text-blue-700 shrink-0" />}
          {vehicle.geofence_id && <Shield className="w-3.5 h-3.5 text-green-600 shrink-0" />}
        </div>
        <Badge className={`text-xs ${getStatusColorClass(vehicle.isOnline ? vehicle.status : 'offline')}`}>
          {vehicle.isOnline ? vehicle.status : 'offline'}
        </Badge>
      </div>
      
      {/* Location */}
      <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="truncate">{vehicle.location}</span>
      </div>
      
      {/* Metrics */}
      {vehicle.latestData && (
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-xs`}>
          <div className="flex items-center gap-1">
            <Gauge className="w-3 h-3 text-blue-500" />
            <span>{vehicle.latestData.speed || 0} km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <Fuel className="w-3 h-3 text-orange-500" />
            <span>{vehicle.latestData.fuel_level || 0}%</span>
          </div>
          {!compact && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{vehicle.lastUpdateString}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color 
}: { 
  title: string;
  value: string | number;
  icon: any;
  color: string;
}) => {
  const colorMap = {
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    blue: 'text-blue-600 bg-blue-100',
    orange: 'text-orange-600 bg-orange-100'
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xl sm:text-2xl font-bold ${colorMap[color].split(' ')[0]}`}>
              {value}
            </p>
            <p className="text-xs text-slate-500">{title}</p>
          </div>
          <div className={`p-2 rounded-full ${colorMap[color].split(' ')[1]}`}>
            <Icon className={`w-4 h-4 ${colorMap[color].split(' ')[0]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};