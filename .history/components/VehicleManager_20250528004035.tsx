"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Car, 
  Search, 
  Plus, 
  MapPin, 
  Fuel, 
  Zap,
  Settings,
  Eye,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw
} from "lucide-react";

// Interface untuk data kendaraan dari API
interface ApiVehicle {
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

// Interface untuk data status kendaraan
interface VehicleData {
  data_id: string;
  vehicle_id: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  speed: number;
  rpm: number;
  fuel_level: string;
  ignition_status: string;
  battery_level: string;
  satellites_used: number;
}

// Interface untuk kendaraan yang sudah digabung dengan data status
interface EnhancedVehicle extends ApiVehicle {
  status: string;
  location: string;
  speed: string;
  fuel: number;
  battery: number;
  lastUpdate: string;
  latestData?: VehicleData;
}

export function VehicleManager() {
  const [vehicles, setVehicles] = useState<EnhancedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fungsi untuk mendapatkan user yang sedang login
  const getCurrentUser = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('👤 Current logged in user:', user);
        return user;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // Fungsi untuk menentukan status berdasarkan data kendaraan
  const determineVehicleStatus = (vehicleData?: VehicleData): string => {
    if (!vehicleData) return 'offline';
    
    const lastUpdate = new Date(vehicleData.timestamp);
    const now = new Date();
    const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Jika data lebih dari 30 menit, anggap offline
    if (minutesAgo > 30) return 'offline';
    
    // Jika ignition off dan speed 0, statusnya parked
    if (vehicleData.ignition_status === 'false' && vehicleData.speed === 0) {
      return 'parked';
    }
    
    // Jika speed > 0, statusnya moving
    if (vehicleData.speed > 0) return 'moving';
    
    // Jika ignition on tapi speed 0, statusnya online
    if (vehicleData.ignition_status === 'true' && vehicleData.speed === 0) {
      return 'online';
    }
    
    return 'online';
  };

  // Fungsi untuk mengkonversi koordinat ke alamat (simplified)
  const getLocationString = (lat: string, lng: string): string => {
    // Dalam implementasi nyata, Anda bisa menggunakan reverse geocoding API
    return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
  };

  // Fungsi untuk menghitung waktu relatif
  const getRelativeTime = (timestamp: string): string => {
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

  // Fungsi untuk fetch data kendaraan milik user yang login
  const fetchVehicles = async (userId: string) => {
    try {
      const vehiclesResponse = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicles'
      );
      
      if (!vehiclesResponse.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      
      const vehiclesData = await vehiclesResponse.json();
      const allVehicles = vehiclesData.data || [];
      
      // Filter kendaraan berdasarkan user_id yang sedang login
      const userVehicles = allVehicles.filter((vehicle: ApiVehicle) => 
        vehicle.user_id === userId
      );
      
      console.log('🚗 All vehicles:', allVehicles.length);
      console.log('🔒 User vehicles:', userVehicles.length);
      console.log('👤 Filtering for user ID:', userId);
      
      return userVehicles;
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  };

  // Fungsi untuk fetch data status kendaraan
  const fetchVehicleData = async () => {
    try {
      const dataResponse = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_data?limit=-1'
      );
      
      if (!dataResponse.ok) {
        throw new Error('Failed to fetch vehicle data');
      }
      
      const vehicleDataResponse = await dataResponse.json();
      return vehicleDataResponse.data || [];
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      throw error;
    }
  };

  // Fungsi untuk menggabungkan data kendaraan dengan status terbaru
  const mergeVehicleData = (vehicles: ApiVehicle[], vehicleDataList: VehicleData[]): EnhancedVehicle[] => {
    return vehicles.map(vehicle => {
      // Cari data terbaru untuk kendaraan ini
      const vehicleDataItems = vehicleDataList
        .filter(data => data.vehicle_id === vehicle.vehicle_id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const latestData = vehicleDataItems[0];
      
      const status = determineVehicleStatus(latestData);
      const location = latestData 
        ? getLocationString(latestData.latitude, latestData.longitude)
        : 'Location unknown';
      const speed = latestData ? `${latestData.speed} km/h` : '0 km/h';
      const fuel = latestData ? Math.round(parseFloat(latestData.fuel_level)) : 0;
      const battery = latestData ? Math.round(parseFloat(latestData.battery_level)) : 0;
      const lastUpdate = latestData ? getRelativeTime(latestData.timestamp) : 'No data';

      return {
        ...vehicle,
        status,
        location,
        speed,
        fuel,
        battery,
        lastUpdate,
        latestData
      };
    });
  };

  // Fungsi untuk load semua data
  const loadData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Cek user yang sedang login
      const user = getCurrentUser();
      if (!user) {
        throw new Error('No user logged in. Please login first.');
      }

      setCurrentUser(user);

      // Dapatkan user_id - cek berbagai kemungkinan field name
      const userId = user.id || user.user_id || user._id || user.ID;
      if (!userId) {
        throw new Error('User ID not found. Please login again.');
      }

      console.log('🔍 Loading vehicles for user:', userId);

      const [vehiclesData, vehicleStatusData] = await Promise.all([
        fetchVehicles(userId),
        fetchVehicleData()
      ]);

      const mergedData = mergeVehicleData(vehiclesData, vehicleStatusData);
      setVehicles(mergedData);
      
      console.log('✅ Loaded vehicles:', mergedData.length);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load vehicle data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data saat komponen mount
  useEffect(() => {
    loadData();
  }, []);

  // Filter kendaraan berdasarkan pencarian
  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fungsi untuk menentukan warna status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'moving':
        return 'bg-blue-100 text-blue-700 border-blue-200';
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
          <p className="text-slate-600">Loading vehicles...</p>
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
            <Button onClick={() => loadData()} className="w-full">
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
          <h1 className="text-2xl font-bold text-slate-800">My Vehicles</h1>
          <p className="text-slate-600">
            {currentUser ? (
              <>Manage your vehicle fleet ({vehicles.length} vehicles) - {currentUser.name || currentUser.email}</>
            ) : (
              <>Manage and monitor your vehicle fleet ({vehicles.length} vehicles)</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search vehicles by name, license plate, make, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.vehicle_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Car className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{vehicle.name}</CardTitle>
                    <p className="text-sm text-slate-500">{vehicle.license_plate}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(vehicle.status)}>
                  {vehicle.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vehicle Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Make & Model</p>
                  <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                </div>
                <div>
                  <p className="text-slate-500">Year</p>
                  <p className="font-medium">{vehicle.year}</p>
                </div>
              </div>
              
              {/* Location */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <MapPin className="w-4 h-4 text-slate-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{vehicle.location}</p>
                  <p className="text-xs text-slate-500">Speed: {vehicle.speed}</p>
                </div>
              </div>
              
              {/* Status Indicators */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Fuel className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{vehicle.fuel}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{vehicle.battery}%</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{vehicle.lastUpdate}</p>
              </div>
              
              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 border-t pt-3">
                <div>
                  <p>SIM Card: {vehicle.sim_card_number}</p>
                </div>
                <div>
                  <p>GPS Device: {vehicle.gps_device_id || 'Not assigned'}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2 bg-sl">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-3 h-3 mr-1" />
                  Track
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredVehicles.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              {searchTerm ? 'No vehicles found' : 'No vehicles registered'}
            </h3>
            <p className="text-slate-500">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'You haven\'t registered any vehicles yet. Add your first vehicle to get started.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}