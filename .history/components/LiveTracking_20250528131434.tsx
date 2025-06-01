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
  X // Added X import here
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
  gps_device_id: string | null;
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

interface VehicleWithTracking extends Vehicle {
  latestData?: VehicleData;
  status: "moving" | "parked" | "offline";
  location: string;
  coordinates: string;
  lastUpdate: string;
  isOnline: boolean;
}

export function LiveTracking() {
  const [vehicles, setVehicles] = useState<VehicleWithTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);

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
    
    // Area Bandung (simulasi berdasarkan koordinat)
    if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
      if (latitude <= -6.89 && longitude >= 107.69) {
        return "Jl. Dago, Bandung";
      }
      return "Bandung, Jawa Barat";
    }
    
    // Area Jakarta (simulasi)
    if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
      return "Jakarta";
    }
    
    return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
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
    const ignitionStatus = data.ignition_status;
    
    // If speed > 0, vehicle is moving
    if (speed > 0) return 'moving';
    
    // If ignition is off and speed is 0, vehicle is parked
    if (ignitionStatus === 'false' && speed === 0) return 'parked';
    
    // If ignition is on but speed is 0, consider it parked (engine running)
    return 'parked';
  };

  // Fungsi untuk mengecek apakah kendaraan online
  const isVehicleOnline = (data: VehicleData | undefined): boolean => {
    if (!data || !data.timestamp) return false;
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes <= 15; // Online jika update dalam 15 menit terakhir
  };

  // Fungsi untuk menghitung waktu relatif
  const getRelativeTime = (timestamp: string | null): string => {
    if (!timestamp) return 'No data';
    
    const now = new Date();
    const updateTime = new Date(timestamp);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Fungsi untuk mendapatkan heading berdasarkan koordinat (simulasi)
  const getHeading = (lat: string | null, lng: string | null): string => {
    if (!lat || !lng) return 'N';
    
    // Simulasi heading berdasarkan koordinat
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (latitude > -6.9 && longitude > 107.6) return 'NE';
    if (latitude > -6.9 && longitude < 107.6) return 'NW';
    if (latitude < -6.9 && longitude > 107.6) return 'SE';
    return 'SW';
  };

  // Fetch vehicles data
  const fetchVehicles = async (userId?: string) => {
    try {
      const authToken = getAuthToken();
      const response = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicles',
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicles: ${response.status} ${response.statusText}`);
      }
      
      const vehiclesData = await response.json();
      const allVehicles = vehiclesData.data || [];
      
      // Filter vehicles by user if userId is provided
      const userVehicles = userId 
        ? allVehicles.filter((vehicle: Vehicle) => vehicle.user_id === userId)
        : allVehicles;
      
      console.log('🚗 LiveTracking: All vehicles:', allVehicles.length);
      console.log('🔒 LiveTracking: User vehicles:', userVehicles.length);
      
      return userVehicles;
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  };

  // Fetch vehicle data
  const fetchVehicleData = async () => {
    try {
      const authToken = getAuthToken();
      const response = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_data?limit=-1',
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        }
      );
      
      if (!response.ok) {
        console.warn('Failed to fetch vehicle data, continuing without tracking data');
        return [];
      }
      
      const vehicleDataResponse = await response.json();
      return vehicleDataResponse.data || [];
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      return [];
    }
  };

  // Combine vehicle data with tracking data
  const mergeVehicleData = (vehicles: Vehicle[], vehicleDataList: VehicleData[]): VehicleWithTracking[] => {
    let filteredVehicles = vehicles;
    
    // Filter by specific vehicle if selectedVehicleId is set
    if (selectedVehicleId) {
      filteredVehicles = vehicles.filter(vehicle => vehicle.vehicle_id === selectedVehicleId);
      console.log('🔍 Filtered to specific vehicle:', filteredVehicles.length);
    }
    
    return filteredVehicles.map(vehicle => {
      // Get latest data for this vehicle
      const vehicleTrackingData = vehicleDataList
        .filter(data => data.vehicle_id === vehicle.vehicle_id)
        .sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
      const latestData = vehicleTrackingData[0];
      const status = getVehicleStatus(latestData);
      const isOnline = isVehicleOnline(latestData);
      
      let location = 'Location unknown';
      let coordinates = 'N/A';
      
      if (latestData && latestData.latitude && latestData.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
        coordinates = `${parseFloat(latestData.latitude).toFixed(6)}, ${parseFloat(latestData.longitude).toFixed(6)}`;
      }
      
      const lastUpdate = getRelativeTime(latestData?.timestamp || null);
      return {
        ...vehicle,
        latestData,
        status,
        location,
        coordinates,
        lastUpdate: isOnline ? (lastUpdate === 'Just now' ? 'Real-time' : lastUpdate) : 'Offline',
        isOnline
      };
    });
  };

  // Main data loading function
  const loadTrackingData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      console.log('🔍 LiveTracking: Loading data for user:', userId);
      const [vehiclesData, vehicleDataList] = await Promise.all([
        fetchVehicles(userId || undefined),
        fetchVehicleData()
      ]);
      const combinedData = mergeVehicleData(vehiclesData, vehicleDataList);
      setVehicles(combinedData);
      
      console.log('✅ LiveTracking: Loaded vehicles with tracking:', combinedData.length);
    } catch (error) {
      console.error('Error loading tracking data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tracking data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      console.log('🎯 Tracking specific vehicle:', trackVehicleName, trackVehicleId);
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
  }, [userId, selectedVehicleId]); // Add selectedVehicleId as dependency

  // Function to clear vehicle filter and show all vehicles
  const clearVehicleFilter = () => {
    setSelectedVehicleId(null);
    setSelectedVehicleName(null);
    sessionStorage.removeItem('trackVehicleId');
    sessionStorage.removeItem('trackVehicleName');
    console.log('🔄 Cleared vehicle filter, showing all vehicles');
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
      {/* Background refresh indicator */}
      {refreshing && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Updating tracking data...</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Live Tracking</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-600">
              Real-time monitoring of your vehicle fleet ({vehicles.length} vehicles)
              {currentUser && ` - ${currentUser.name || currentUser.email}`}
            </p>
            {selectedVehicleName && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Tracking: {selectedVehicleName}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearVehicleFilter}
                  className="text-blue-600 hover:text-blue-700 p-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
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
          <Button variant="outline">
            <Navigation className="w-4 h-4 mr-2" />
            Center Map
          </Button>
          <Button className="bg-green-600 hover:bg-green-700">
            <MapPin className="w-4 h-4 mr-2" />
            Track All
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Live Map View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MapComponent
                userId={userId}
                refreshInterval={30000}
                height="400px"
              />
            </CardContent>
          </Card>
        </div>
        {/* Vehicle List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {selectedVehicleId ? 'Tracking Vehicle' : 'Active Vehicles'}
                </CardTitle>
                {selectedVehicleId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearVehicleFilter}
                                        className="text-slate-600 "
                  >
                    Show All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <div key={vehicle.vehicle_id} className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-slate-800">{vehicle.name}</span>
                      </div>
                      <Badge className={getStatusColor(vehicle.status)}>
                        {vehicle.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-slate-500">License Plate</p>
                        <p className="font-medium">{vehicle.license_plate}</p>
                      </div>
                      
                      <div>
                        <p className="text-slate-500">Location</p>
                        <p className="text-slate-700">{vehicle.location}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-blue-500" />
                          <span>{vehicle.latestData?.speed || 0} km/h</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-green-500" />
                          <span>{getHeading(vehicle.latestData?.latitude || null, vehicle.latestData?.longitude || null)}</span>
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
      {/* Quick Stats */}
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
    </div>
  );
}