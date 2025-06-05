"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Plus, MapPin, Trash2, Circle, Square, Save, X, Car, Loader2, AlertCircle, Filter, SortAsc, Download, Upload, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

// 🔧 Enhanced type definitions
export interface Geofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][];
    center?: number[];
    radius?: number;
    type: string;
  };
  date_created: string;
}

export interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string;
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  geofence_id: string | null;
}

interface GeofenceFormState {
  name: string;
  ruleType: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  type: "polygon" | "circle";
}

interface UIState {
  isCreating: boolean;
  loading: boolean;
  assignDialogOpen: boolean;
  searchTerm: string;
  filterStatus: "all" | "active" | "inactive";
  filterRuleType: "all" | "STANDARD" | "FORBIDDEN" | "STAY_IN";
  sortBy: "name" | "date" | "type" | "vehicles";
  sortOrder: "asc" | "desc";
  showFilters: boolean;
}

// 🔧 Constants
const API_BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055';
const GEOFENCE_API_ENDPOINT = `${API_BASE_URL}/items/geofence`;
const VEHICLE_API_ENDPOINT = `${API_BASE_URL}/items/vehicle`;
const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];

// 🔧 Utility functions
const ensureArray = <T>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (value?.data && Array.isArray(value.data)) return value.data;
  return [];
};

const validateGeofence = (geofence: Geofence | null | undefined): geofence is Geofence => {
  if (!geofence?.definition) return false;
  
  try {
    if (geofence.type === 'circle') {
      const { center, radius } = geofence.definition;
      return !!(center?.length === 2 && 
               typeof radius === 'number' && 
               radius > 0 &&
               center.every(coord => typeof coord === 'number' && isFinite(coord)));
    }
    
    if (geofence.type === 'polygon') {
      const { coordinates } = geofence.definition;
      return !!(coordinates?.[0]?.length >= 4 &&
               coordinates[0].every(coord => 
                 Array.isArray(coord) && 
                 coord.length === 2 && 
                 coord.every(c => typeof c === 'number' && isFinite(c))
               ));
    }
    
    return false;
  } catch (error) {
    console.error('Geofence validation error:', error);
    return false;
  }
};

const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
  if (!geofence || !validateGeofence(geofence)) return DEFAULT_CENTER;
  
  if (geofence.type === 'circle' && geofence.definition.center) {
    const [lng, lat] = geofence.definition.center;
    return [lat, lng];
  }
  
  if (geofence.type === 'polygon' && geofence.definition.coordinates?.[0]) {
    const coords = geofence.definition.coordinates[0];
    if (coords.length === 0) return DEFAULT_CENTER;
    
    const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
    const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
    return [sumLat / coords.length, sumLng / coords.length];
  }
  
  return DEFAULT_CENTER;
};

// 🔧 Style helper functions
const getStatusColor = (status: string): string => {
  const statusColors = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  return statusColors[status as keyof typeof statusColors] || statusColors.inactive;
};

const getRuleTypeColor = (ruleType: string): string => {
  const ruleColors = {
    FORBIDDEN: 'bg-rose-100 text-rose-800 border-rose-200',
    STAY_IN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    STANDARD: 'bg-teal-100 text-teal-800 border-teal-200'
  };
  return ruleColors[ruleType as keyof typeof ruleColors] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const formatRuleType = (ruleType: string): string => {
  const formats = {
    FORBIDDEN: 'Terlarang',
    STAY_IN: 'Tetap di Dalam',
    STANDARD: 'Standar'
  };
  return formats[ruleType as keyof typeof formats] || ruleType;
};

// 🎨 Mock Map Component (since we can't import the actual one)
const MockMapComponent = ({ center, zoom, isCreating, currentGeofence, geofences }: any) => {
  return (
    <div className="h-full bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex items-center justify-center relative overflow-hidden">
      {/* Mock map background */}
      <div className="absolute inset-0 opacity-20">
        <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="border border-blue-200"></div>
          ))}
        </div>
      </div>
      
      {/* Map content */}
      <div className="text-center z-10 bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg">
        <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Interactive Map</h3>
        {isCreating ? (
          <div className="space-y-2">
            <p className="text-slate-600">Drawing Mode Active</p>
            <Badge className="bg-blue-100 text-blue-800">Click to draw geofence</Badge>
          </div>
        ) : currentGeofence ? (
          <div className="space-y-2">
            <p className="text-slate-600">Viewing: <strong>{currentGeofence.name}</strong></p>
            <Badge className={getRuleTypeColor(currentGeofence.rule_type)}>
              {formatRuleType(currentGeofence.rule_type)}
            </Badge>
          </div>
        ) : (
          <p className="text-slate-600">
            {geofences?.length > 0 ? `${geofences.length} geofences available` : 'No geofences to display'}
          </p>
        )}
      </div>
    </div>
  );
};

export default function GeofenceManager() {
  // 🔧 State management
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [uiState, setUIState] = useState<UIState>({
    isCreating: false,
    loading: true,
    assignDialogOpen: false,
    searchTerm: "",
    filterStatus: "all",
    filterRuleType: "all",
    sortBy: "date",
    sortOrder: "desc",
    showFilters: false
  });
  
  const [newGeofence, setNewGeofence] = useState<GeofenceFormState>({
    name: "",
    ruleType: "FORBIDDEN",
    type: "polygon"
  });
  
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  
  // 🔧 Refs
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const fetchAbortControllerRef = useRef<AbortController>();

  // 🔧 Mock data for demonstration
  useEffect(() => {
    const initializeMockData = () => {
      const mockUser = {
        id: "user123",
        full_name: "Demo User",
        email: "demo@example.com"
      };
      
      const mockGeofences: Geofence[] = [
        {
          geofence_id: 1,
          user_id: "user123",
          name: "Jakarta Area",
          type: "circle",
          rule_type: "FORBIDDEN",
          status: "active",
          definition: {
            type: "Circle",
            center: [106.8456, -6.2088],
            radius: 5000
          },
          date_created: "2024-01-15T10:30:00Z"
        },
        {
          geofence_id: 2,
          user_id: "user123",
          name: "Surabaya Industrial Zone",
          type: "polygon",
          rule_type: "STAY_IN",
          status: "active",
          definition: {
            type: "Polygon",
            coordinates: [[[112.7378, -7.2504], [112.7678, -7.2504], [112.7678, -7.2204], [112.7378, -7.2204], [112.7378, -7.2504]]]
          },
          date_created: "2024-01-20T14:15:00Z"
        },
        {
          geofence_id: 3,
          user_id: "user123",
          name: "Bandung Safe Zone",
          type: "circle",
          rule_type: "STANDARD",
          status: "inactive",
          definition: {
            type: "Circle",
            center: [107.6191, -6.9175],
            radius: 3000
          },
          date_created: "2024-02-01T09:45:00Z"
        },
        {
          geofence_id: 4,
          user_id: "user123",
          name: "Medan Warehouse District",
          type: "polygon",
          rule_type: "FORBIDDEN",
          status: "active",
          definition: {
            type: "Polygon",
            coordinates: [[[98.6748, 3.5952], [98.7048, 3.5952], [98.7048, 3.6252], [98.6748, 3.6252], [98.6748, 3.5952]]]
          },
          date_created: "2024-02-10T16:20:00Z"
        }
      ];

      const mockVehicles: Vehicle[] = [
        {
          vehicle_id: "1",
          user_id: "user123",
          gps_id: "GPS001",
          name: "Truck Alpha",
          license_plate: "B 1234 XYZ",
          make: "Mitsubishi",
          model: "Fuso",
          year: 2020,
          geofence_id: "1"
        },
        {
          vehicle_id: "2",
          user_id: "user123",
          gps_id: "GPS002",
          name: "Van Beta",
          license_plate: "L 5678 ABC",
          make: "Toyota",
          model: "HiAce",
          year: 2021,
          geofence_id: "2"
        },
        {
          vehicle_id: "3",
          user_id: "user123",
          gps_id: "GPS003",
          name: "Pickup Gamma",
          license_plate: "D 9012 DEF",
          make: "Isuzu",
          model: "D-Max",
          year: 2019,
          geofence_id: null
        }
      ];

      setCurrentUser(mockUser);
      setGeofences(mockGeofences);
      setVehicles(mockVehicles);
      setCurrentGeofence(mockGeofences[0]);
      setUIState(prev => ({ ...prev, loading: false }));
    };

    // Simulate loading delay
    const timer = setTimeout(initializeMockData, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 🔧 Filtering and sorting logic
  const filteredAndSortedGeofences = useMemo(() => {
    let filtered = geofences.filter(gf => {
      if (!validateGeofence(gf)) return false;
      
      // Search filter
      if (uiState.searchTerm) {
        const searchLower = uiState.searchTerm.toLowerCase();
        if (!gf.name.toLowerCase().includes(searchLower)) return false;
      }
      
      // Status filter
      if (uiState.filterStatus !== "all" && gf.status !== uiState.filterStatus) return false;
      
      // Rule type filter
      if (uiState.filterRuleType !== "all" && gf.rule_type !== uiState.filterRuleType) return false;
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (uiState.sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          comparison = new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "vehicles":
          const aCount = getAssignedVehiclesCount(a.geofence_id);
          const bCount = getAssignedVehiclesCount(b.geofence_id);
          comparison = aCount - bCount;
          break;
      }
      
      return uiState.sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [geofences, uiState.searchTerm, uiState.filterStatus, uiState.filterRuleType, uiState.sortBy, uiState.sortOrder]);

  // 🔧 Vehicle assignment functions
  const getAssignedVehiclesCount = useCallback((geofenceId: number) => {
    return vehicles.filter(v =>
      v.geofence_id && (
        v.geofence_id.toString() === geofenceId.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofenceId
      )
    ).length;
  }, [vehicles]);

  // 🔧 Event handlers
  const handleSearchChange = useCallback((value: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    setUIState(prev => ({ ...prev, searchTerm: value }));
  }, []);

  const handleStartCreating = useCallback(() => {
    setUIState(prev => ({ ...prev, isCreating: true }));
    setCurrentGeofence(null);
    setDrawnLayers([]);
    setNewGeofence({ name: "", ruleType: "FORBIDDEN", type: "polygon" });
  }, []);

  const handleCancelCreating = useCallback(() => {
    setUIState(prev => ({ ...prev, isCreating: false }));
    setDrawnLayers([]);
    
    if (geofences.length > 0) {
      setCurrentGeofence(geofences[0]);
    }
  }, [geofences]);

  const handleSaveGeofence = useCallback(() => {
    if (!newGeofence.name.trim()) {
      alert("Please enter a geofence name");
      return;
    }

    // Simulate save
    const newGf: Geofence = {
      geofence_id: Date.now(),
      user_id: currentUser.id,
      name: newGeofence.name,
      type: newGeofence.type,
      rule_type: newGeofence.ruleType,
      status: "active",
      definition: {
        type: newGeofence.type === "circle" ? "Circle" : "Polygon",
        center: newGeofence.type === "circle" ? [106.8456, -6.2088] : undefined,
        radius: newGeofence.type === "circle" ? 1000 : undefined,
        coordinates: newGeofence.type === "polygon" ? [[[106.8456, -6.2088], [106.8556, -6.2088], [106.8556, -6.1988], [106.8456, -6.1988], [106.8456, -6.2088]]] : undefined
      },
      date_created: new Date().toISOString()
    };

    setGeofences(prev => [newGf, ...prev]);
    setCurrentGeofence(newGf);
    setUIState(prev => ({ ...prev, isCreating: false }));
    alert("Geofence created successfully!");
  }, [newGeofence, currentUser]);

  const handleDeleteGeofence = useCallback((geofenceId: number) => {
    if (!confirm("Are you sure you want to delete this geofence?")) return;
    
    setGeofences(prev => prev.filter(gf => gf.geofence_id !== geofenceId));
    
    if (currentGeofence?.geofence_id === geofenceId) {
      const remaining = geofences.filter(gf => gf.geofence_id !== geofenceId);
      setCurrentGeofence(remaining.length > 0 ? remaining[0] : null);
    }
    
    alert("Geofence deleted successfully!");
  }, [currentGeofence, geofences]);

  const handleAssignVehicles = useCallback((geofence: Geofence) => {
    setCurrentGeofence(geofence);
    
    const assignedIds = vehicles
      .filter(v => v.geofence_id && (
        v.geofence_id.toString() === geofence.geofence_id.toString()
      ))
      .map(v => v.vehicle_id.toString());
    
    setSelectedVehicles(assignedIds);
    setUIState(prev => ({ ...prev, assignDialogOpen: true }));
  }, [vehicles]);

  const saveVehicleAssignments = useCallback(() => {
    if (!currentGeofence) return;
    
    // Simulate assignment update
    const updatedVehicles = vehicles.map(v => {
      if (selectedVehicles.includes(v.vehicle_id.toString())) {
        return { ...v, geofence_id: currentGeofence.geofence_id.toString() };
      } else if (v.geofence_id === currentGeofence.geofence_id.toString()) {
        return { ...v, geofence_id: null };
      }
      return v;
    });
    
    setVehicles(updatedVehicles);
    setUIState(prev => ({ ...prev, assignDialogOpen: false }));
    alert("Vehicle assignments updated successfully!");
  }, [currentGeofence, selectedVehicles, vehicles]);

  // 🔧 Export/Import functions
  const handleExportGeofences = useCallback(() => {
    const dataStr = JSON.stringify(geofences, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geofences_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [geofences]);

  // 🔧 Loading state
  if (uiState.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 animate-spin mx-auto text-blue-600" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-ping mx-auto opacity-75"></div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Loading Geofence Manager</h3>
            <p className="text-slate-600">Initializing geographic management system...</p>
            <div className="flex justify-center mt-4">
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Geofence Management
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">
              Manage geographic boundaries for vehicle monitoring
              {currentUser && ` - ${currentUser.full_name}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportGeofences}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          {!uiState.isCreating && (
            <Button
              onClick={handleStartCreating}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Geofence
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Sidebar */}
        <div className="lg:col-span-1 flex flex-col bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/20">
          {/* Search and Filters */}
          {!uiState.isCreating && (
            <div className="space-y-3 mb-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search geofences..."
                  value={uiState.searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-slate-200 bg-white/70 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>

              {/* Filter Toggle */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUIState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
                  className="text-slate-600 hover:text-slate-800"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters {uiState.showFilters ? <EyeOff className="h-4 w-4 ml-2" /> : <Eye className="h-4 w-4 ml-2" />}
                </Button>
                
                <div className="text-sm text-slate-500">
                  {filteredAndSortedGeofences.length} of {geofences.length}
                </div>
              </div>

              {/* Filters */}
              {uiState.showFilters && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={uiState.filterStatus}
                      onValueChange={(value) => setUIState(prev => ({ ...prev, filterStatus: value as any }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={uiState.filterRuleType}
                      onValueChange={(value) => setUIState(prev => ({ ...prev, filterRuleType: value as any }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Rule Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Rules</SelectItem>
                        <SelectItem value="FORBIDDEN">Forbidden</SelectItem>
                        <SelectItem value="STAY_IN">Stay In</SelectItem>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={uiState.sortBy}
                      onValueChange={(value) => setUIState(prev => ({ ...prev, sortBy: value as any }))}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="date">Date Created</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="vehicles">Vehicle Count</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setUIState(prev => ({ ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }))}
                    >
                      <SortAsc className={`h-4 w-4 transition-transform ${uiState.sortOrder === "desc" ? "rotate-180" : ""}`} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Creation Form */}
          {uiState.isCreating && (
            <Card className="mb-4 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Circle className="w-5 h-5 mr-2" />
                  Create New Geofence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Geofence name"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                  className="border-blue-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                
                <Select
                  value={newGeofence.ruleType}
                  onValueChange={(value) => setNewGeofence({ 
                    ...newGeofence, 
                    ruleType: value as "STANDARD" | "FORBIDDEN" | "STAY_IN" 
                  })}
                >
                  <SelectTrigger className="border-blue-200 focus:ring-2 focus:ring-blue-500/20">
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORBIDDEN">🚫 Forbidden</SelectItem>
                    <SelectItem value="STAY_IN">🏠 Stay Inside</SelectItem>
                    <SelectItem value="STANDARD">📍 Standard</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex gap-2">
                  <Button
                    variant={newGeofence.type === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({ ...newGeofence, type: "polygon" })}
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" /> Polygon
                  </Button>
                  <Button
                    variant={newGeofence.type === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({ ...newGeofence, type: "circle" })}
                    className="flex-1"
                  >
                    <Circle className="h-4 w-4 mr-2" /> Circle
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700 font-medium mb-1">
                    ✏️ Drawing Instructions:
                  </p>
                  <p className="text-xs text-blue-600">
                    {newGeofence.type === "circle" 
                      ? "Click and drag on the map to create a circle" 
                      : "Click on the map to add points, then close the polygon"
                    }
                  </p>
                </div>
                
                <div className="flex gap-2 pt-3 border-t border-blue-200">
                  <Button
                    onClick={handleSaveGeofence}
                    disabled={!newGeofence.name.trim()}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelCreating}
                    className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics Summary */}
          {!uiState.isCreating && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 mb-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{geofences.length}</div>
                  <div className="text-xs text-slate-600">Total Geofences</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {vehicles.filter(v => v.geofence_id).length}
                  </div>
                  <div className="text-xs text-slate-600">Assigned Vehicles</div>
                </div>
              </div>
            </div>
          )}

          {/* Geofence List */}
          <div className="flex-1 overflow-auto space-y-2 pr-1">
            {filteredAndSortedGeofences.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50">
                <CardContent className="p-6 text-center">
                  <MapPin className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {uiState.searchTerm || uiState.filterStatus !== "all" || uiState.filterRuleType !== "all" 
                      ? "No matching geofences" 
                      : "No geofences yet"
                    }
                  </h3>
                  <p className="text-slate-500 text-sm mb-4">
                    {uiState.searchTerm || uiState.filterStatus !== "all" || uiState.filterRuleType !== "all"
                      ? "Try adjusting your search or filter criteria"
                      : "Create your first geofence to get started"
                    }
                  </p>
                  {(!uiState.searchTerm && uiState.filterStatus === "all" && uiState.filterRuleType === "all") && (
                    <Button
                      onClick={handleStartCreating}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Geofence
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredAndSortedGeofences.map((geofence, index) => (
                <Card
                  key={geofence.geofence_id}
                  className={`cursor-pointer transition-all duration-300 ease-out hover:shadow-xl border rounded-xl overflow-hidden group ${
                    currentGeofence?.geofence_id === geofence.geofence_id
                      ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-lg transform scale-[1.02]'
                      : 'bg-white/90 backdrop-blur-sm border-slate-200 hover:border-blue-300 shadow-md hover:transform hover:scale-[1.01]'
                  }`}
                  onClick={() => {
                    setUIState(prev => ({ ...prev, isCreating: false }));
                    setCurrentGeofence(geofence);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate text-lg group-hover:text-blue-700 transition-colors" 
                            title={geofence.name}>
                          {geofence.name}
                        </h3>
                        <p className="text-xs text-slate-500">ID: {geofence.geofence_id}</p>
                      </div>
                      
                      <Badge className={`${getStatusColor(geofence.status)} px-2 py-1 text-xs font-medium shadow-sm`}>
                        {geofence.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`${getRuleTypeColor(geofence.rule_type)} px-2 py-1 text-xs font-medium`}>
                          {geofence.rule_type === 'FORBIDDEN' && '🚫 '}
                          {geofence.rule_type === 'STAY_IN' && '🏠 '}
                          {geofence.rule_type === 'STANDARD' && '📍 '}
                          {formatRuleType(geofence.rule_type)}
                        </Badge>
                        
                        <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white/70 px-2 py-1 text-xs">
                          {geofence.type === 'circle' ? '⭕ Circle' : '⬜ Polygon'}
                        </Badge>
                        
                        {getAssignedVehiclesCount(geofence.geofence_id) > 0 && (
                          <Badge className="bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-800 border-cyan-200 px-2 py-1 text-xs">
                            🚗 {getAssignedVehiclesCount(geofence.geofence_id)} vehicles
                          </Badge>
                        )}
                      </div>
                      
                      <div className="bg-slate-50 rounded p-2">
                        <p className="text-xs text-slate-600">
                          📅 {new Date(geofence.date_created).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleAssignVehicles(geofence); 
                          }}
                        >
                          <Car className="h-4 w-4 mr-1" /> Assign
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 p-2"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDeleteGeofence(geofence.geofence_id); 
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm min-h-[400px] lg:min-h-0">
          <MockMapComponent
            center={getGeofenceCenter(uiState.isCreating ? null : currentGeofence)}
            zoom={uiState.isCreating ? 5 : (currentGeofence ? 13 : 5)}
            isCreating={uiState.isCreating}
            currentGeofence={currentGeofence}
            geofences={geofences}
          />
        </div>
      </div>

      {/* Vehicle Assignment Dialog */}
      <Dialog open={uiState.assignDialogOpen} onOpenChange={(open) => 
        setUIState(prev => ({ ...prev, assignDialogOpen: open }))
      }>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              Assign Vehicles to "{currentGeofence?.name}"
            </DialogTitle>
          </DialogHeader>
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {vehicles.map((vehicle) => {
              const isChecked = selectedVehicles.includes(vehicle.vehicle_id.toString());
              
              return (
                <div
                  key={vehicle.vehicle_id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isChecked ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-blue-50'
                  }`}
                  onClick={() => {
                    setSelectedVehicles(prev =>
                      prev.includes(vehicle.vehicle_id.toString())
                        ? prev.filter(id => id !== vehicle.vehicle_id.toString())
                        : [...prev, vehicle.vehicle_id.toString()]
                    );
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    readOnly
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{vehicle.name}</div>
                    <div className="text-xs text-gray-500">
                      {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setUIState(prev => ({ ...prev, assignDialogOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={saveVehicleAssignments}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}