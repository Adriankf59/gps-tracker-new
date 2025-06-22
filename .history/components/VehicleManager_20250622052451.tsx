"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Copy,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ===== INTERFACES & TYPES =====
interface User {
  id?: string;
  user_id?: string;
  _id?: string;
  ID?: string;
  email?: string;
  name?: string;
  full_name?: string;
}

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

interface EnhancedVehicle extends ApiVehicle {
  status: 'online' | 'moving' | 'parked' | 'offline';
  location: string;
  speed: string;
  fuel: number;
  battery: number;
  lastUpdate: string;
  latestData?: VehicleData;
}

interface NewVehicleForm {
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  gps_id: string;
}

interface VehicleManagerState {
  vehicles: EnhancedVehicle[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

// ===== CONSTANTS =====
const ONLINE_THRESHOLD_MINUTES = 30;
const SEARCH_DEBOUNCE_MS = 300;
const CACHE_DURATION_MS = 60000; // 1 minute

// ===== UTILITY FUNCTIONS =====
const getCurrentUser = (): User | null => {
  try {
    if (typeof window === 'undefined') return null;
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

const getUserId = (user: User | null): string | null => {
  if (!user) return null;
  return user.id || user.user_id || user._id || user.ID || null;
};

const determineVehicleStatus = (vehicleData?: VehicleData): 'online' | 'moving' | 'parked' | 'offline' => {
  if (!vehicleData?.timestamp) return 'offline';
  
  const lastUpdate = new Date(vehicleData.timestamp);
  const now = new Date();
  const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  if (minutesAgo > ONLINE_THRESHOLD_MINUTES) return 'offline';
  
  const speed = vehicleData.speed || 0;
  const ignitionOn = vehicleData.ignition_status === 'true';
  
  if (speed > 0) return 'moving';
  if (ignitionOn && speed === 0) return 'online';
  if (!ignitionOn && speed === 0) return 'parked';
  
  return 'online';
};

const getLocationString = (lat: string, lng: string): string => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

const getRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const updateTime = new Date(timestamp);
  const diffMs = now.getTime() - updateTime.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

const copyToClipboard = async (text: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert(successMessage);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert(successMessage);
  }
};

// ===== CUSTOM HOOKS =====
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const useVehicleData = (userId: string | null) => {
  const [state, setState] = useState<VehicleManagerState>({
    vehicles: [],
    loading: true,
    error: null,
    refreshing: false
  });

  const cacheRef = useRef<{
    vehicles: ApiVehicle[];
    vehicleData: VehicleData[];
    timestamp: number;
  } | null>(null);

  const fetchVehicles = useCallback(async (userId: string): Promise<ApiVehicle[]> => {
    const response = await fetch(`/api/vehicles?user_id=${userId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch vehicles: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  }, []);

  const fetchVehicleData = useCallback(async (userId: string): Promise<VehicleData[]> => {
    try {
      const response = await fetch(`/api/vehicle-data?user_id=${userId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.warn('Failed to fetch vehicle data:', error);
      return [];
    }
  }, []);

  const mergeVehicleData = useCallback((vehicles: ApiVehicle[], vehicleDataList: VehicleData[]): EnhancedVehicle[] => {
    return vehicles.map(vehicle => {
      const vehicleDataItems = vehicleDataList
        .filter(data => vehicle.gps_id && data.gps_id === vehicle.gps_id)
        .filter(data => data.timestamp)
        .sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

      const latestData = vehicleDataItems[0];
      const status = determineVehicleStatus(latestData);
      
      const location = latestData?.latitude && latestData?.longitude
        ? getLocationString(latestData.latitude, latestData.longitude)
        : 'No GPS data';
        
      const speed = latestData?.speed ? `${latestData.speed} km/h` : '0 km/h';
      const fuel = latestData?.fuel_level ? Math.round(latestData.fuel_level) : 0;
      const battery = latestData?.battery_level ? Math.round(latestData.battery_level) : 0;
      const lastUpdate = latestData?.timestamp ? getRelativeTime(latestData.timestamp) : 'No data';

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
  }, []);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setState(prev => ({ ...prev, loading: false, error: 'No user ID' }));
      return;
    }

    // Check cache
    const now = Date.now();
    const cacheAge = cacheRef.current ? now - cacheRef.current.timestamp : Infinity;
    const shouldUseCache = !forceRefresh && cacheRef.current && cacheAge < CACHE_DURATION_MS;

    if (shouldUseCache && cacheRef.current) {
      const { vehicles, vehicleData } = cacheRef.current;
      const mergedData = mergeVehicleData(vehicles, vehicleData);
      setState(prev => ({
        ...prev,
        vehicles: mergedData,
        loading: false,
        refreshing: false,
        error: null
      }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      loading: !forceRefresh, 
      refreshing: forceRefresh,
      error: null 
    }));

    try {
      const [vehiclesData, vehicleDataList] = await Promise.all([
        fetchVehicles(userId),
        fetchVehicleData(userId)
      ]);

      // Cache the results
      cacheRef.current = {
        vehicles: vehiclesData,
        vehicleData: vehicleDataList,
        timestamp: now
      };

      const mergedData = mergeVehicleData(vehiclesData, vehicleDataList);
      
      setState({
        vehicles: mergedData,
        loading: false,
        refreshing: false,
        error: null
      });

      console.log('✅ Loaded vehicles:', mergedData.length);
    } catch (error) {
      console.error('Error loading vehicle data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load vehicle data'
      }));
    }
  }, [userId, fetchVehicles, fetchVehicleData, mergeVehicleData]);

  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return {
    ...state,
    loadData,
    refreshData: () => loadData(true),
    invalidateCache
  };
};

const useVehicleForm = () => {
  const [formData, setFormData] = useState<NewVehicleForm>({
    name: '',
    license_plate: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    sim_card_number: '',
    gps_id: ''
  });

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const resetForm = useCallback(() => {
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
  }, []);

  const handlePhotoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation
    if (file.size > 5 * 1024 * 1024) {
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
  }, []);

  const isFormValid = useMemo(() => {
    return !!(formData.name && formData.license_plate && formData.make && 
             formData.model && formData.sim_card_number);
  }, [formData]);

  return {
    formData,
    setFormData,
    selectedPhoto,
    photoPreview,
    resetForm,
    handlePhotoSelect,
    isFormValid
  };
};

// ===== MAIN COMPONENT =====
export function VehicleManager() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<EnhancedVehicle | null>(null);

  const userId = useMemo(() => getUserId(currentUser), [currentUser]);
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS);
  
  const { vehicles, loading, error, refreshing, loadData, refreshData, invalidateCache } = useVehicleData(userId);
  const { 
    formData, 
    setFormData, 
    selectedPhoto, 
    photoPreview, 
    resetForm, 
    handlePhotoSelect, 
    isFormValid 
  } = useVehicleForm();

  // Initialize user on mount
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  // Load data when user is available
  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // Filtered vehicles with memoization
  const filteredVehicles = useMemo(() => {
    if (!debouncedSearch) return vehicles;
    
    const searchLower = debouncedSearch.toLowerCase();
    return vehicles.filter(vehicle =>
      vehicle.name.toLowerCase().includes(searchLower) ||
      vehicle.license_plate.toLowerCase().includes(searchLower) ||
      vehicle.make.toLowerCase().includes(searchLower) ||
      vehicle.model.toLowerCase().includes(searchLower)
    );
  }, [vehicles, debouncedSearch]);

  // Status color mapping
  const getStatusColor = useCallback((status: string) => {
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
  }, []);

  // Copy coordinates handler
  const handleCopyCoordinates = useCallback((lat: string, lng: string, vehicleName: string) => {
    const coordinates = `${lat}, ${lng}`;
    copyToClipboard(
      coordinates,
      `Coordinates copied for ${vehicleName}:\n${coordinates}`
    );
  }, []);

  // Track vehicle handler
  const trackVehicle = useCallback((vehicle: EnhancedVehicle) => {
    sessionStorage.setItem('trackVehicleId', vehicle.vehicle_id.toString());
    sessionStorage.setItem('trackVehicleName', vehicle.name);
    sessionStorage.setItem('activeView', 'tracking');
    router.push('/dashboard');
  }, [router]);

  // Add vehicle handler
  const addVehicle = useCallback(async () => {
    if (!currentUser || !isFormValid) return;

    setAddingVehicle(true);
    
    try {
      const userId = getUserId(currentUser);
      if (!userId) {
        throw new Error('User ID not found. Please login again.');
      }

      // TODO: Upload photo if selected (implement later)
      let photoId = null;

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

      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      // Success - cleanup and refresh
      resetForm();
      setShowAddForm(false);
      invalidateCache();
      await loadData(true);

      alert('Vehicle added successfully!');

    } catch (error) {
      console.error('Error adding vehicle:', error);
      let userMessage = 'Failed to add vehicle. ';
      
      if (error instanceof Error) {
        if (error.message.includes('400')) {
          userMessage += 'Please check that all information is correct.';
        } else if (error.message.includes('500')) {
          userMessage += 'Server error. Please try again later.';
        } else {
          userMessage += error.message;
        }
      }
      
      alert(userMessage);
    } finally {
      setAddingVehicle(false);
    }
  }, [currentUser, formData, isFormValid, resetForm, invalidateCache, loadData]);

  // Delete vehicle handlers
  const confirmDeleteVehicle = useCallback((vehicle: EnhancedVehicle) => {
    setVehicleToDelete(vehicle);
    setShowDeleteConfirm(true);
  }, []);

  const deleteVehicle = useCallback(async (vehicleId: number) => {
    if (!currentUser) return;

    setDeletingVehicleId(vehicleId);
    
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      // Success - cleanup and refresh
      setShowDeleteConfirm(false);
      setVehicleToDelete(null);
      invalidateCache();
      await loadData(true);
      
      alert('Vehicle deleted successfully!');

    } catch (error) {
      console.error('Error deleting vehicle:', error);
      let userMessage = 'Failed to delete vehicle. ';
      
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          userMessage += 'Vehicle not found or already deleted.';
        } else if (error.message.includes('403')) {
          userMessage += 'You don\'t have permission to delete this vehicle.';
        } else {
          userMessage += error.message;
        }
      }
      
      alert(userMessage);
    } finally {
      setDeletingVehicleId(null);
    }
  }, [currentUser, invalidateCache, loadData]);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setVehicleToDelete(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
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
    <div className="space-y-4 p-4 pb-20 md:pb-4">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Vehicles</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={refreshing}
            className="flex-1 sm:flex-initial border-slate-300 text-slate-600 bg-white hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-initial"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>
      
      {/* Search - Mobile Optimized */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search vehicles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4"
        />
      </div>
      
      {/* Vehicle List - Mobile Optimized */}
      <div className="grid grid-cols-1 gap-4">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.vehicle_id} className="hover:shadow-lg transition-shadow overflow-hidden">
            <CardContent className="p-4">
              {/* Mobile Layout */}
              <div className="space-y-3">
                {/* Header with Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                      <Car className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg text-slate-800 truncate">
                        {vehicle.name}
                      </h3>
                      <p className="text-sm text-slate-600">{vehicle.license_plate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getStatusColor(vehicle.status)}`}>
                      {vehicle.status}
                    </Badge>
                    {/* Mobile Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => trackVehicle(vehicle)}
                          className="bg-white hover:bg-slate-100"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Track
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="bg-white hover:bg-slate-100"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="bg-white hover:bg-slate-100"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => confirmDeleteVehicle(vehicle)}
                          className="text-red-600 bg-white hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div className="text-sm text-slate-600">
                  {vehicle.make} {vehicle.model} • {vehicle.year}
                </div>

                {/* Location */}
                <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 break-words">
                      {vehicle.location}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {vehicle.speed} • {vehicle.lastUpdate}
                    </p>
                  </div>
                  {vehicle.latestData?.latitude && vehicle.latestData?.longitude && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCoordinates(
                        vehicle.latestData!.latitude!, 
                        vehicle.latestData!.longitude!, 
                        vehicle.name
                      )}
                      className="h-8 px-2"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-slate-700">Fuel: {vehicle.fuel}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-slate-700">Battery: {vehicle.battery}%</span>
                  </div>
                </div>

                {/* Desktop Actions - Hidden on Mobile */}
                <div className="hidden sm:flex gap-2 pt-2 border-t ">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 bg-white hover:bg-slate-100"
                    onClick={() => trackVehicle(vehicle)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Track
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 bg-white hover:bg-slate-100">
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="bg-white hover:bg-slate-100">
                    <Settings className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 bg- hover:bg-red-50"
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Empty State */}
      {filteredVehicles.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              {searchTerm ? 'No vehicles found' : 'No vehicles registered'}
            </h3>
            <p className="text-sm text-slate-500">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'Add your first vehicle to get started.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Vehicle Modal - Mobile Optimized */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
            {/* Header */}
            <div className="p-4 sm:p-6 pb-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-black">Add New Vehicle</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="hover:bg-slate-100 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4 text-black" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 pt-4">
                <div className="space-y-4">
                  {/* Vehicle Photo */}
                  <div>
                    <Label htmlFor="photo" className="text-black font-medium text-sm">
                      Vehicle Photo (Optional)
                    </Label>
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
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white h-8 w-8 p-0"
                            onClick={() => {
                              resetForm();
                            }}
                          >
                            <X className="w-3 h-3 text-black" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
                          <Camera className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-sm text-slate-500">Tap to upload photo</span>
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

                  {/* Form Fields */}
                  <div>
                    <Label htmlFor="name" className="text-black font-medium text-sm">
                      Vehicle Name *
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g., Company Truck 01"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="license_plate" className="text-black font-medium text-sm">
                      License Plate *
                    </Label>
                    <Input
                      id="license_plate"
                      placeholder="e.g., B 1234 ABC"
                      value={formData.license_plate}
                      onChange={(e) => setFormData({...formData, license_plate: e.target.value.toUpperCase()})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="make" className="text-black font-medium text-sm">
                        Make *
                      </Label>
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
                      <Label htmlFor="model" className="text-black font-medium text-sm">
                        Model *
                      </Label>
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

                  <div>
                    <Label htmlFor="year" className="text-black font-medium text-sm">
                      Year *
                    </Label>
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

                  <div>
                    <Label htmlFor="sim_card_number" className="text-black font-medium text-sm">
                      SIM Card Number *
                    </Label>
                    <Input
                      id="sim_card_number"
                      placeholder="e.g., 081234567890"
                      value={formData.sim_card_number}
                      onChange={(e) => setFormData({...formData, sim_card_number: e.target.value})}
                      required
                      className="mt-1 text-black placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gps_device_id" className="text-black font-medium text-sm">
                      GPS Device ID (Optional)
                    </Label>
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

            {/* Footer */}
            <div className="p-4 sm:p-6 pt-4 border-t border-slate-200 flex-shrink-0 bg-gray-50">
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
                  disabled={addingVehicle || !isFormValid}
                >
                  {addingVehicle && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {addingVehicle ? 'Adding...' : 'Add Vehicle'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Mobile Optimized */}
      {showDeleteConfirm && vehicleToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
            <div className="p-4 sm:p-6">
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
                  {deletingVehicleId === vehicleToDelete.vehicle_id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}