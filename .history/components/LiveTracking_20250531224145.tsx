"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Eye
} from "lucide-react";
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
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at: string;
  updated_at: string | null;
  vehicle_photo: string;
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

interface VehicleWithTracking extends Vehicle {
  latestData?: VehicleData;
  status: "moving" | "parked" | "offline";
  location: string;
  coordinates: string;
  lastUpdate: string;
  isOnline: boolean;
}

// Processed vehicle interface for map
interface ProcessedVehicle {
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
  make?: string;
  model?: string;
  year?: number;
  status: 'moving' | 'parked' | 'offline';
}

export function LiveTracking() {
  const [vehicles, setVehicles] = useState<VehicleWithTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null);

  // Get user ID for filtering
  const userId = useMemo(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        return parsedUser.id || parsedUser.user_id || parsedUser._id || parsedUser.ID;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }, []);

  // Process selected vehicle for map display only
  const processedVehicleForMap = useMemo((): ProcessedVehicle[] => {
    // If no vehicle selected but vehicles available, return empty (will auto-select in loadTrackingData)
    if (!selectedVehicleId) return [];
    
    const selectedVehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId);
    if (!selectedVehicle || !selectedVehicle.latestData?.latitude || !selectedVehicle.latestData?.longitude) {
      return [];
    }

    const data = selectedVehicle.latestData;
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    
    if (isNaN(lat) || isNaN(lng)) return [];
    
    // Determine if this is a motor/motorcycle
    const isMotor = selectedVehicle.make?.toLowerCase().includes('motor') || 
                   selectedVehicle.model?.toLowerCase().includes('motor') ||
                   selectedVehicle.name?.toLowerCase().includes('motor');
    
    return [{
      id: selectedVehicle.vehicle_id,
      name: selectedVehicle.name,
      licensePlate: selectedVehicle.license_plate,
      position: [lat, lng] as [number, number],
      speed: data.speed || 0,
      ignition: data.ignition_status === 'ON' || data.ignition_status === 'true',
      fuel: data.fuel_level ? parseFloat(data.fuel_level) : null,
      battery: data.battery_level ? parseFloat(data.battery_level) : null,
      timestamp: data.timestamp,
      isMotor,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      year: selectedVehicle.year,
      status: selectedVehicle.status
    }];
  }, [vehicles, selectedVehicleId]);

  // Helper function to get auth token
  const getAuthToken = (): string | null => {
    try {
      return sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    } catch (error) {
      return null;
    }
  };

  // Fungsi untuk reverse geocoding (simulasi)
  const getLocationName = (lat: string, lng: string): string => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Tampilkan koordinat dengan format yang baik
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  };

  // Fungsi untuk menentukan status kendaraan
  const getVehicleStatus = (data: VehicleData | undefined): "moving" | "parked" | "offline" => {
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
    return (now.getTime() - lastUpdate.getTime()) < (15 * 60 * 1000); // Less than 15 minutes
  };

  // Fungsi untuk menghitung waktu relatif
  const getRelativeTime = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
    return `${Math.floor(diffSeconds / 86400)} days ago`;
  };

  // Fetch vehicles data
  const fetchVehicles = async (userId?: string) => {
    try {
      const token = getAuthToken();
      const url = userId ? `/api/vehicles?user_id=${userId}` : '/api/vehicles';
      
      const response = await fetch(url, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (!response.ok) {
        console.error('Failed to fetch vehicles:', response.status);
        return [];
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }
  };

  // Fetch vehicle data
  const fetchVehicleData = async () => {
    try {
      const token = getAuthToken();
      const url = userId ? `/api/vehicle-data?user_id=${userId}` : '/api/vehicle-data';
      
      const response = await fetch(url, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (!response.ok) {
        console.error('Failed to fetch vehicle data:', response.status);
        return [];
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      return [];
    }
  };

  // Combine vehicle data with tracking data
  const mergeVehicleData = (vehicles: Vehicle[], vehicleDataList: VehicleData[]): VehicleWithTracking[] => {
    const mergedVehicles = vehicles.map(vehicle => {
      // Find latest data for this vehicle
      const latestData = vehicleDataList
        .filter(data => data.gps_id === vehicle.gps_id)
        .sort((a, b) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })[0];

      const status = getVehicleStatus(latestData);
      const isOnline = isVehicleOnline(latestData);
      const lastUpdate = latestData?.timestamp ? getRelativeTime(latestData.timestamp) : 'Never';
      
      // Add the location and calculated values
      const location = latestData?.latitude && latestData?.longitude
        ? getLocationName(latestData.latitude, latestData.longitude)
        : 'No GPS data';
        
      const coordinates = latestData?.latitude && latestData?.longitude
        ? `${parseFloat(latestData.latitude).toFixed(6)}, ${parseFloat(latestData.longitude).toFixed(6)}`
        : '0, 0';
      
      return {
        ...vehicle,
        latestData,
        status,
        location,
        coordinates,
        lastUpdate,
        isOnline
      };
    });
    
    // Update selected vehicle coordinates if we have a selected vehicle
    if (selectedVehicleId) {
      const selectedVehicle = mergedVehicles.find(v => v.vehicle_id === selectedVehicleId);
      if (selectedVehicle?.latestData?.latitude && selectedVehicle?.latestData?.longitude) {
        setSelectedVehicleCoords([
          parseFloat(selectedVehicle.latestData.latitude),
          parseFloat(selectedVehicle.latestData.longitude)
        ]);
      }
    }
    
    return mergedVehicles;
  };

  // Main data loading function
  const loadTrackingData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      const vehiclesData = await fetchVehicles(userId);
      const vehicleDataList = await fetchVehicleData();
      
      const combinedData = mergeVehicleData(vehiclesData, vehicleDataList);
      
      // Sort vehicles by vehicle_id to ensure consistent ordering (earliest ID first)
      const sortedVehicles = combinedData.sort((a, b) => {
        const idA = parseInt(a.vehicle_id) || 0;
        const idB = parseInt(b.vehicle_id) || 0;
        return idA - idB;
      });
      
      setVehicles(sortedVehicles);
      
      // Always ensure a vehicle is selected if vehicles are available
      if (sortedVehicles.length > 0) {
        // Check if currently selected vehicle still exists
        const currentlySelected = sortedVehicles.find(v => v.vehicle_id === selectedVehicleId);
        
        if (!currentlySelected) {
          // If current selection doesn't exist, select the first vehicle (earliest ID)
          const firstVehicle = sortedVehicles[0];
          setSelectedVehicleId(firstVehicle.vehicle_id);
          setSelectedVehicleName(firstVehicle.name);
          
          // Set coordinates for the map to zoom to
          if (firstVehicle.latestData?.latitude && firstVehicle.latestData?.longitude) {
            setSelectedVehicleCoords([
              parseFloat(firstVehicle.latestData.latitude),
              parseFloat(firstVehicle.latestData.longitude)
            ]);
          }
        }
        
        // If no vehicle is selected at all, select the first one (earliest ID)
        if (!selectedVehicleId) {
          const firstVehicle = sortedVehicles[0];
          setSelectedVehicleId(firstVehicle.vehicle_id);
          setSelectedVehicleName(firstVehicle.name);
          
          // Set coordinates for the map to zoom to
          if (firstVehicle.latestData?.latitude && firstVehicle.latestData?.longitude) {
            setSelectedVehicleCoords([
              parseFloat(firstVehicle.latestData.latitude),
              parseFloat(firstVehicle.latestData.longitude)
            ]);
          }
        }
      } else {
        // No vehicles available, clear selection
        setSelectedVehicleId(null);
        setSelectedVehicleName(null);
        setSelectedVehicleCoords(null);
      }
      
      if (showRefreshing) setRefreshing(false);
      setLoading(false);
    } catch (err) {
      console.error('Error loading tracking data:', err);
      setError('Failed to load tracking data. Please try again.');
      if (showRefreshing) setRefreshing(false);
      setLoading(false);
    }
  };

  // Get current user and check for vehicle filter
  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // Check if there's a specific vehicle to track
    const trackVehicleId = sessionStorage.getItem('trackVehicleId');
    const trackVehicleName = sessionStorage.getItem('trackVehicleName');
    
    if (trackVehicleId && trackVehicleName) {
      setSelectedVehicleId(trackVehicleId);
      setSelectedVehicleName(trackVehicleName);
    }
  }, []);

  // Load data on mount and set up refresh interval
  useEffect(() => {
    loadTrackingData();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      loadTrackingData(true);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [userId, selectedVehicleId]);

  // Function to handle vehicle selection
  const handleVehicleSelect = (vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);
    
    // Set coordinates for map to zoom to
    if (vehicle.latestData?.latitude && vehicle.latestData?.longitude) {
      setSelectedVehicleCoords([
        parseFloat(vehicle.latestData.latitude),
        parseFloat(vehicle.latestData.longitude)
      ]);
    }
  };

  // Handle map vehicle click (from MapComponent)
  const handleMapVehicleClick = (vehicle: ProcessedVehicle) => {
    // Vehicle already selected, just focus on it
    console.log('Vehicle clicked on map:', vehicle.name);
  };

  // Handle map click (reset view)
  const handleMapClick = () => {
    // Keep focused on selected vehicle
    console.log('Map clicked - keeping focus on selected vehicle');
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'moving':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'parked':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'offline':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Error Loading Data</h3>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => loadTrackingData()} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Live Tracking</h1>
          <div className="flex items-center gap-2">
            <p className="text-slate-600">
              Real-time monitoring of your vehicle fleet ({vehicles.length} vehicles)
              {currentUser && ` - ${currentUser.name || currentUser.email}`}
            </p>
            {selectedVehicleName && (
              <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                <Eye className="w-3 h-3 mr-1" />
                Tracking: {selectedVehicleName}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => loadTrackingData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden shadow-sm border rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  {selectedVehicleName ? `Tracking: ${selectedVehicleName}` : 'Vehicle Map'}
                </span>
                {selectedVehicleId && (
                  <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                    Live Position
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="rounded-lg overflow-hidden border shadow-inner">
                <MapComponent 
                  vehicles={processedVehicleForMap}
                  selectedVehicleId={selectedVehicleId}
                  selectedCoordinates={selectedVehicleCoords}
                  onVehicleClick={handleMapVehicleClick}
                  onMapClick={handleMapClick}
                  height="500px"
                  defaultCenter={selectedVehicleCoords || [-2.5, 118.0]}
                  defaultZoom={selectedVehicleId && selectedVehicleCoords ? 16 : 5}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Vehicle List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <div 
                    key={vehicle.vehicle_id} 
                    className={`flex p-3 cursor-pointer rounded-lg transition-colors hover:bg-gray-50 border ${
                      selectedVehicleId === vehicle.vehicle_id 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                    onClick={() => handleVehicleSelect(vehicle)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{vehicle.name}</span>
                          {selectedVehicleId === vehicle.vehicle_id && (
                            <Eye className="w-3 h-3 text-blue-500" />
                          )}
                        </div>
                        <Badge className={`text-xs ${getStatusColor(vehicle.status)}`}>
                          {vehicle.status}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-slate-500 mb-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[180px]" title={vehicle.location}>
                            {vehicle.location}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-blue-500" />
                          <span>{vehicle.latestData?.speed || 0} km/h</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-orange-500" />
                          <span>{parseFloat(vehicle.latestData?.fuel_level || '0').toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-green-500" />
                          <span>{parseFloat(vehicle.latestData?.battery_level || '0').toFixed(1)}V</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Satellite className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {vehicle.latestData?.satellites_used || 0} satellites
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{vehicle.lastUpdate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Car className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-slate-500">No vehicles found</p>
                  <p className="text-xs text-slate-400 mt-1">Add vehicles to start tracking</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Quick Stats - Only show if vehicles are available */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {vehicles.filter(v => v.status === 'moving').length}
                  </p>
                  <p className="text-sm text-slate-600">Moving</p>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {vehicles.filter(v => v.status === 'parked').length}
                  </p>
                  <p className="text-sm text-slate-600">Parked</p>
                </div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {vehicles.length > 0 
                      ? Math.round(vehicles.reduce((acc, v) => acc + (v.latestData?.speed || 0), 0) / vehicles.length)
                      : 0
                    }
                  </p>
                  <p className="text-sm text-slate-600">Avg Speed (km/h)</p>
                </div>
                <Gauge className="w-6 h-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {vehicles.length > 0
                      ? Math.round(vehicles.reduce((acc, v) => acc + parseFloat(v.latestData?.fuel_level || '0'), 0) / vehicles.length)
                      : 0
                    }
                  </p>
                  <p className="text-sm text-slate-600">Avg Fuel (%)</p>
                </div>
                <Fuel className="w-6 h-6 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}