I can see the error in your code. The issue is that you're using the `X` component in the `clearVehicleFilter` function, but you haven't imported it from Lucide React. Let me fix that for you and provide the complete code:

```jsx
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
          <p className="text-slate-600">Loading tracking data...</p