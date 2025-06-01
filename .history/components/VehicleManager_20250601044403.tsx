"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
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
  RefreshCw,
  X,
  Camera,
  Copy
} from "lucide-react";

// Interface untuk data kendaraan dari API
interface ApiVehicle {
  vehicle_id: number;
  user_id: string;
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  create_at: string;
  update_at: string | null;
  vehicle_photo: string | null;
}

// Interface untuk data status kendaraan
interface VehicleData {
  vehicle_datas_id: string;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm: number | null;
  fuel_level: number | null;
  ignition_status: string | null;
  battery_level: number | null;
  satellites_used: number | null;
  timestamp: string | null;
  gps_id: string | null;
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

// Interface untuk form data kendaraan baru
interface NewVehicleForm {
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  gps_id: string;
}

export function VehicleManager() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<EnhancedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<EnhancedVehicle | null>(null);

  // Form state untuk kendaraan baru
  const [formData, setFormData] = useState<NewVehicleForm>({
    name: '',
    license_plate: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    sim_card_number: '',
    gps_id: ''
  });

  // Helper function untuk generate vehicle ID yang unik
  const generateVehicleId = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 9);
    return `VH-${timestamp}-${random}`;
  };

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
    if (!vehicleData || !vehicleData.timestamp) return 'offline';
    
    const lastUpdate = new Date(vehicleData.timestamp);
    const now = new Date();
    const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Jika data lebih dari 30 menit, anggap offline
    if (minutesAgo > 30) return 'offline';
    
    // Jika ignition off dan speed 0, statusnya parked
    if (vehicleData.ignition_status === 'false' && (vehicleData.speed === 0 || vehicleData.speed === null)) {
      return 'parked';
    }
    
    // Jika speed > 0, statusnya moving
    if (vehicleData.speed && vehicleData.speed > 0) return 'moving';
    
    // Jika ignition on tapi speed 0, statusnya online
    if (vehicleData.ignition_status === 'true' && (vehicleData.speed === 0 || vehicleData.speed === null)) {
      return 'online';
    }
    
    return 'online';
  };

  // Fungsi untuk copy coordinates ke clipboard
  const copyCoordinates = async (lat: string, lng: string, vehicleName: string) => {
    try {
      const coordinates = `${lat}, ${lng}`;
      await navigator.clipboard.writeText(coordinates);
      alert(`Coordinates copied for ${vehicleName}:\n${coordinates}`);
    } catch (error) {
      console.error('Failed to copy coordinates:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = `${lat}, ${lng}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Coordinates copied for ${vehicleName}:\n${lat}, ${lng}`);
    }
  };

  // Fungsi untuk mengkonversi koordinat ke format yang readable
  const getLocationString = (lat: string, lng: string): string => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Tampilkan koordinat dengan 6 decimal places untuk presisi GPS
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
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

  // Fungsi untuk fetch data kendaraan menggunakan Next.js API routes
  const fetchVehicles = async (userId: string) => {
    try {
      console.log('🚗 Fetching vehicles for user:', userId);
      const response = await fetch(`/api/vehicles?user_id=${userId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Fetch vehicles error:', errorData);
        throw new Error(errorData.message || `Failed to fetch vehicles: ${response.status}`);
      }
      
      const vehiclesData = await response.json();
      console.log('✅ Vehicles received:', vehiclesData.data?.length || 0);
      
      return vehiclesData.data || [];
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  };

  // Fungsi untuk fetch data status kendaraan menggunakan Next.js API routes
  const fetchVehicleData = async (userId: string) => {
    try {
      console.log('📊 Fetching vehicle data for user:', userId);
      const response = await fetch(`/api/vehicle-data?user_id=${userId}`);
      
      if (!response.ok) {
        console.warn('Failed to fetch vehicle data, continuing without status data');
        return [];
      }
      
      const vehicleDataResponse = await response.json();
      console.log('✅ Vehicle data received:', vehicleDataResponse.data?.length || 0);
      
      return vehicleDataResponse.data || [];
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      return []; // Return empty array instead of throwing
    }
  };

  // Fungsi untuk menggabungkan data kendaraan dengan status terbaru
  const mergeVehicleData = (vehicles: ApiVehicle[], vehicleDataList: VehicleData[]): EnhancedVehicle[] => {
    return vehicles.map(vehicle => {
      // Cari data terbaru untuk kendaraan ini - match by gps_id
      const vehicleDataItems = vehicleDataList
        .filter(data => vehicle.gps_id && data.gps_id === vehicle.gps_id)
        .filter(data => data.timestamp) // Only include data with valid timestamp
        .sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
      
      const latestData = vehicleDataItems[0];
      
      const status = determineVehicleStatus(latestData);
      
      // Use coordinates if available, otherwise show no location
      const location = latestData && latestData.latitude && latestData.longitude
        ? getLocationString(latestData.latitude, latestData.longitude)
        : 'No GPS data available';
        
      const speed = latestData && latestData.speed ? `${latestData.speed} km/h` : '0 km/h';
      const fuel = latestData && latestData.fuel_level ? Math.round(latestData.fuel_level) : 0;
      const battery = latestData && latestData.battery_level ? Math.round(latestData.battery_level) : 0;
      const lastUpdate = latestData && latestData.timestamp ? getRelativeTime(latestData.timestamp) : 'No data';

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

  // Fungsi untuk upload foto (disabled for now - requires formidable package)
  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      console.log('📤 Photo upload temporarily disabled - skipping upload');
      // Return null for now - photo upload will be implemented later
      return null;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  // Fungsi untuk menghapus kendaraan menggunakan Next.js API routes
  const deleteVehicle = async (vehicleId: number) => {
    if (!currentUser) {
      alert('Please login first');
      return;
    }

    setDeletingVehicleId(vehicleId);
    
    try {
      console.log('🗑️ Deleting vehicle:', vehicleId);

      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Delete response:', {
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete error response:', errorData);
        
        let errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      console.log('✅ Vehicle deleted successfully');
      
      // Close confirmation modal
      setShowDeleteConfirm(false);
      setVehicleToDelete(null);
      
      // Refresh data
      await loadData(true);
      
      alert('Vehicle deleted successfully!');

    } catch (error) {
      console.error('❌ Error deleting vehicle:', error);
      
      let userMessage = 'Failed to delete vehicle. ';
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          userMessage += 'Vehicle not found or already deleted.';
        } else if (error.message.includes('403')) {
          userMessage += 'You don\'t have permission to delete this vehicle.';
        } else if (error.message.includes('401')) {
          userMessage += 'Authentication failed. Please login again.';
        } else if (error.message.includes('500')) {
          userMessage += 'Server error. Please try again later.';
        } else {
          userMessage += error.message;
        }
      } else {
        userMessage += 'Unknown error occurred.';
      }
      
      alert(userMessage);
    } finally {
      setDeletingVehicleId(null);
    }
  };

  // Fungsi untuk menampilkan konfirmasi hapus
  const confirmDeleteVehicle = (vehicle: EnhancedVehicle) => {
    setVehicleToDelete(vehicle);
    setShowDeleteConfirm(true);
  };

  // Fungsi untuk membatalkan hapus
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setVehicleToDelete(null);
  };

  // Fungsi untuk navigate ke live tracking dengan filter kendaraan tertentu
  const trackVehicle = (vehicle: EnhancedVehicle) => {
    // Set vehicle filter in sessionStorage untuk digunakan di LiveTracking
    sessionStorage.setItem('trackVehicleId', vehicle.vehicle_id.toString());
    sessionStorage.setItem('trackVehicleName', vehicle.name);
    // Set active view indicator for dashboard
    sessionStorage.setItem('activeView', 'tracking');
    

  // Fungsi untuk menambahkan kendaraan menggunakan Next.js API routes
  const addVehicle = async () => {
    if (!currentUser) {
      alert('Please login first');
      return;
    }

    setAddingVehicle(true);
    
    try {
      const userId = currentUser.id || currentUser.user_id || currentUser._id || currentUser.ID;
      console.log('👤 Current user ID:', userId);
      
      if (!userId) {
        throw new Error('User ID not found. Please login again.');
      }

      // Upload foto jika ada (skip if fails)
      let photoId = null;
      if (selectedPhoto) {
        console.log('📸 Attempting to upload photo...');
        try {
          photoId = await uploadPhoto(selectedPhoto);
          if (photoId) {
            console.log('✅ Photo uploaded successfully:', photoId);
          }
        } catch (photoError) {
          console.log('⚠️ Photo upload failed, continuing without photo:', photoError);
        }
      }

      // Siapkan data kendaraan
      const vehicleData = {
        user_id: userId,
        name: formData.name.trim(),
        license_plate: formData.license_plate.trim(),
        make: formData.make.trim(),
        model: formData.model.trim(),
        year: formData.year,
        sim_card_number: formData.sim_card_number.trim(),
        gps_id: formData.gps_id.trim() || null,
        vehicle_photo: photoId,
        relay_status: null
      };

      console.log('📤 Sending vehicle data:', vehicleData);

      // Validasi data sebelum dikirim
      const requiredFields = ['name', 'license_plate', 'make', 'model', 'sim_card_number'];
      const missingFields = requiredFields.filter(field => !vehicleData[field as keyof typeof vehicleData]);
      
      if (missingFields.length > 0) {
        throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      }

      // Submit ke API menggunakan Next.js API route
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vehicleData),
      });

      console.log('📡 API Response:', {
        status: response.status,
        statusText: response.statusText
      });

      // Get response text first for better error handling
      const responseText = await response.text();
      console.log('📡 Response body:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(responseText);
          console.log('❌ Parsed error:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          console.log('❌ Raw error response:', responseText);
        }
        
        throw new Error(errorMessage);
      }

      // Parse successful response
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ Vehicle added successfully:', result);
      } catch (e) {
        console.log('✅ Vehicle added (non-JSON response):', responseText);
        result = { success: true };
      }

      // Reset form dan tutup modal
      resetForm();
      setShowAddForm(false);
      
      // Refresh data kendaraan
      console.log('🔄 Refreshing vehicle list...');
      await loadData(true);

      // Success message
      if (selectedPhoto && !photoId) {
        alert('Vehicle added successfully!\n(Note: Photo upload failed, but vehicle was created without photo)');
      } else {
        alert('Vehicle added successfully!');
      }

    } catch (error) {
      console.error('❌ Error adding vehicle:', error);
      
      // User-friendly error message
      let userMessage = 'Failed to add vehicle. ';
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
          userMessage += 'Please check your internet connection.';
        } else if (error.message.includes('400') || error.message.includes('validation')) {
          userMessage += 'Please check that all information is correct.\n\n' + error.message;
        } else if (error.message.includes('500')) {
          userMessage += 'Server error. Please try again later.';
        } else if (error.message.includes('403') || error.message.includes('permission')) {
          userMessage += 'You don\'t have permission to perform this action. Please check your login status.';
        } else if (error.message.includes('401')) {
          userMessage += 'Authentication failed. Please login again.';
        } else {
          userMessage += error.message;
        }
      } else {
        userMessage += 'Unknown error occurred.';
      }
      
      alert(userMessage);
    } finally {
      setAddingVehicle(false);
    }
  };

  // Fungsi untuk reset form
  const resetForm = () => {
    setFormData({
      name: '',
      license_plate: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      sim_card_number: '',
      gps_id: ''
    });
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  // Fungsi handle file selection
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validasi file
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File size must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      setSelectedPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
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
        fetchVehicleData(userId)
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
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowAddForm(true)}
          >
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
              
              {/* Location with GPS Coordinates */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{vehicle.location}</p>
                      {vehicle.latestData?.latitude && vehicle.latestData?.longitude && (
                        <button
                          onClick={() => copyCoordinates(
                            vehicle.latestData!.latitude!, 
                            vehicle.latestData!.longitude!, 
                            vehicle.name
                          )}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          title="Copy coordinates to clipboard"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-500">Speed: {vehicle.speed}</p>
                      {vehicle.latestData?.satellites_used && (
                        <p className="text-xs text-slate-500">
                          🛰️ {vehicle.latestData.satellites_used} satellites
                        </p>
                      )}
                    </div>
                    {vehicle.latestData?.timestamp && (
                      <p className="text-xs text-slate-400 mt-1">
                        📍 Last seen: {new Date(vehicle.latestData.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
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
                  <p>GPS Device: {vehicle.gps_id || 'Not assigned'}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2 ">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600"
                  onClick={() => trackVehicle(vehicle)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Track
                </Button>
                <Button variant="outline" size="sm" className="flex-1 bg-slate-50">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="bg-slate-50">
                  <Settings className="w-3 h-3 " />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-slate-50"
                  onClick={() => confirmDeleteVehicle(vehicle)}
                  disabled={deletingVehicleId === vehicle.vehicle_id}
                >
                  {deletingVehicleId === vehicle.vehicle_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
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

      {/* Add Vehicle Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="p-6 pb-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-black">Add New Vehicle</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="hover:bg-slate-100"
                >
                  <X className="w-4 h-4 text-black" />
                </Button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 pt-4">
                <div className="space-y-4">
                  {/* Vehicle Photo */}
                  <div>
                    <Label htmlFor="photo" className="text-black font-medium">Vehicle Photo (Optional)</Label>
                    <div className="mt-2">
                      {photoPreview ? (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                          <img 
                            src={photoPreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                            onClick={() => {
                              setSelectedPhoto(null);
                              setPhotoPreview(null);
                            }}
                          >
                            <X className="w-3 h-3 text-black" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
                          <Camera className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-sm text-slate-500">Click to upload photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Vehicle Name */}
                  <div>
                    <Label htmlFor="name" className="text-black font-medium">Vehicle Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Company Truck 01"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  {/* License Plate */}
                  <div>
                    <Label htmlFor="license_plate" className="text-black font-medium">License Plate *</Label>
                    <Input
                      id="license_plate"
                      placeholder="e.g., B 1234 ABC"
                      value={formData.license_plate}
                      onChange={(e) => setFormData({...formData, license_plate: e.target.value.toUpperCase()})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  {/* Make and Model */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="make" className="text-black font-medium">Make *</Label>
                      <Input
                        id="make"
                        placeholder="e.g., Toyota"
                        value={formData.make}
                        onChange={(e) => setFormData({...formData, make: e.target.value})}
                        required
                        className="mt-1 text-black placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <Label htmlFor="model" className="text-black font-medium">Model *</Label>
                      <Input
                        id="model"
                        placeholder="e.g., Avanza"
                        value={formData.model}
                        onChange={(e) => setFormData({...formData, model: e.target.value})}
                        required
                        className="mt-1 text-black placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Year */}
                  <div>
                    <Label htmlFor="year" className="text-black font-medium">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  {/* SIM Card Number */}
                  <div>
                    <Label htmlFor="sim_card_number" className="text-black font-medium">SIM Card Number *</Label>
                    <Input
                      id="sim_card_number"
                      placeholder="e.g., 081234567890"
                      value={formData.sim_card_number}
                      onChange={(e) => setFormData({...formData, sim_card_number: e.target.value})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  {/* GPS Device ID */}
                  <div>
                    <Label htmlFor="gps_device_id" className="text-black font-medium">GPS Device ID (Optional)</Label>
                    <Input
                      id="gps_device_id"
                      placeholder="e.g., GPS001"
                      value={formData.gps_id}
                      onChange={(e) => setFormData({...formData, gps_id: e.target.value})}
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                    <p className="text-xs text-slate-600 mt-1">Leave empty if not assigned yet</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Fixed */}
            <div className="p-6 pt-4 border-t border-slate-200 flex-shrink-0">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="flex-1 border-slate-300 text-black hover:bg-slate-50"
                  disabled={addingVehicle}
                >
                  Cancel
                </Button>
                <Button
                  onClick={addVehicle}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={addingVehicle || !formData.name || !formData.license_plate || !formData.make || !formData.model || !formData.sim_card_number}
                >
                  {addingVehicle && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {addingVehicle ? 'Adding Vehicle...' : 'Add Vehicle'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && vehicleToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-red-100">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Delete Vehicle</h3>
                  <p className="text-sm text-slate-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-slate-700 mb-2">
                  Are you sure you want to delete this vehicle?
                </p>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-slate-600" />
                    <div>
                      <p className="font-medium text-slate-800">{vehicleToDelete.name}</p>
                      <p className="text-sm text-slate-600">
                        {vehicleToDelete.license_plate} • {vehicleToDelete.make} {vehicleToDelete.model}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  All vehicle data and history will be permanently deleted.
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={cancelDelete}
                  className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                  disabled={deletingVehicleId !== null}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteVehicle(vehicleToDelete.vehicle_id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={deletingVehicleId !== null}
                >
                  {deletingVehicleId === vehicleToDelete.vehicle_id && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {deletingVehicleId === vehicleToDelete.vehicle_id ? 'Deleting...' : 'Delete Vehicle'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}