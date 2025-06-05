"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Layer } from 'leaflet';
import type { Circle, Polygon, LatLng } from 'leaflet';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Plus, MapPin, Trash2, Circle as CircleIcon, Square, Save, X, Car, Loader2, AlertCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';

// ✨ Optimized dynamic import with enhanced error boundary
const MapWithDrawing = dynamic(
  () => import('./MapWithDrawing').catch(() => ({ 
    default: () => (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">Map Component Unavailable</h3>
          <p className="text-red-500 text-sm">Please check your internet connection and refresh the page</p>
        </div>
      </div>
    ) 
  })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
        <div className="text-center p-6">
          <div className="relative mb-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-300 rounded-full animate-ping mx-auto"></div>
          </div>
          <h3 className="text-lg font-semibold text-blue-700 mb-2">Loading Interactive Map</h3>
          <p className="text-blue-600 text-sm">Preparing geofence visualization tools...</p>
        </div>
      </div>
    )
  }
);

// 🚀 Enhanced type definitions with better validation
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
  last_modified?: string;
  description?: string;
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
  status?: "active" | "inactive";
  last_update?: string;
}

interface GeofenceFormState {
  name: string;
  ruleType: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  type: "polygon" | "circle";
  description?: string;
}

interface UIState {
  isCreating: boolean;
  loading: boolean;
  assignDialogOpen: boolean;
  searchTerm: string;
  showInactiveGeofences: boolean;
  selectedViewMode: "list" | "grid";
  isRefreshing: boolean;
}

// 🎯 Enhanced constants with environment support
const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055',
  TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

const ENDPOINTS = {
  GEOFENCE: `${API_CONFIG.BASE_URL}/items/geofence`,
  VEHICLE: `${API_CONFIG.BASE_URL}/items/vehicle`,
} as const;

const MAP_CONFIG = {
  DEFAULT_CENTER: [-2.5, 118.0] as [number, number],
  ZOOM_LEVELS: {
    overview: 5,
    detail: 13,
    creating: 8,
    focused: 15,
  },
  BOUNDS_PADDING: [50, 50] as [number, number],
} as const;

const UI_CONFIG = {
  SEARCH_DEBOUNCE_DELAY: 300,
  REFRESH_INTERVAL: 30000, // 30 seconds
  ANIMATION_DURATION: 200,
} as const;

// 🛡️ Enhanced utility functions with better error handling
const safeArrayAccess = <T>(value: any): T[] => {
  try {
    if (Array.isArray(value)) return value;
    if (value?.data && Array.isArray(value.data)) return value.data;
    return [];
  } catch (error) {
    console.error('Error accessing array:', error);
    return [];
  }
};

const validateGeofenceStructure = (geofence: any): geofence is Geofence => {
  if (!geofence || typeof geofence !== 'object') return false;
  
  const required = ['geofence_id', 'name', 'type', 'rule_type', 'status', 'definition'];
  const hasRequiredFields = required.every(field => geofence.hasOwnProperty(field));
  
  if (!hasRequiredFields) return false;
  
  try {
    const { type, definition } = geofence;
    
    if (type === 'circle') {
      const { center, radius } = definition;
      return !!(
        Array.isArray(center) && 
        center.length === 2 && 
        center.every((coord: any) => typeof coord === 'number' && isFinite(coord)) &&
        typeof radius === 'number' && 
        radius > 0 && 
        isFinite(radius)
      );
    }
    
    if (type === 'polygon') {
      const { coordinates } = definition;
      return !!(
        Array.isArray(coordinates) &&
        coordinates[0] &&
        Array.isArray(coordinates[0]) &&
        coordinates[0].length >= 4 &&
        coordinates[0].every((coord: any) => 
          Array.isArray(coord) && 
          coord.length === 2 && 
          coord.every((c: any) => typeof c === 'number' && isFinite(c))
        )
      );
    }
    
    return false;
  } catch (error) {
    console.error('Geofence validation error:', error);
    return false;
  }
};

const calculateGeofenceCenter = (geofence: Geofence | null): [number, number] => {
  if (!geofence || !validateGeofenceStructure(geofence)) {
    return MAP_CONFIG.DEFAULT_CENTER;
  }
  
  try {
    if (geofence.type === 'circle' && geofence.definition.center) {
      const [lng, lat] = geofence.definition.center;
      return [lat, lng];
    }
    
    if (geofence.type === 'polygon' && geofence.definition.coordinates?.[0]) {
      const coords = geofence.definition.coordinates[0];
      if (coords.length === 0) return MAP_CONFIG.DEFAULT_CENTER;
      
      const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
      const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
      return [sumLat / coords.length, sumLng / coords.length];
    }
  } catch (error) {
    console.error('Error calculating geofence center:', error);
  }
  
  return MAP_CONFIG.DEFAULT_CENTER;
};

// 🎨 Enhanced styling functions
const getStatusStyles = (status: string) => {
  const styles = {
    active: {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      indicator: 'bg-emerald-500',
      icon: '✅'
    },
    inactive: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      indicator: 'bg-slate-400',
      icon: '⏸️'
    }
  };
  return styles[status as keyof typeof styles] || styles.inactive;
};

const getRuleTypeStyles = (ruleType: string) => {
  const styles = {
    FORBIDDEN: {
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      color: '#ef4444',
      icon: '🚫',
      label: 'Terlarang'
    },
    STAY_IN: {
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      color: '#3b82f6',
      icon: '🏠',
      label: 'Tetap di Dalam'
    },
    STANDARD: {
      badge: 'bg-teal-100 text-teal-800 border-teal-200',
      color: '#10b981',
      icon: '📍',
      label: 'Standar'
    }
  };
  return styles[ruleType as keyof typeof styles] || {
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    color: '#6b7280',
    icon: '📍',
    label: ruleType
  };
};

const formatDateTime = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// 🚀 Main component with enhanced optimization
export function GeofenceManager() {
  // 📊 State management with better organization
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [uiState, setUIState] = useState<UIState>({
    isCreating: false,
    loading: true,
    assignDialogOpen: false,
    searchTerm: "",
    showInactiveGeofences: false,
    selectedViewMode: "list",
    isRefreshing: false,
  });
  
  const [newGeofence, setNewGeofence] = useState<GeofenceFormState>({
    name: "",
    ruleType: "FORBIDDEN",
    type: "polygon",
    description: "",
  });
  
  const [drawnLayers, setDrawnLayers] = useState<Layer[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  
  // 🎯 Refs for performance optimization
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const fetchAbortControllerRef = useRef<AbortController>();
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // 🌐 Enhanced API functions with retry logic and better error handling
  const createFetchWithRetry = useCallback(() => {
    return async (url: string, options?: RequestInit, retries = API_CONFIG.RETRY_ATTEMPTS): Promise<any> => {
      // Cancel previous request if still pending
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      
      fetchAbortControllerRef.current = new AbortController();
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url, {
            ...options,
            signal: fetchAbortControllerRef.current.signal,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...options?.headers
            },
            timeout: API_CONFIG.TIMEOUT,
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ 
              message: `HTTP ${response.status}: ${response.statusText}` 
            }));
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`✅ API Success (attempt ${attempt}):`, url, data);
          return data;
          
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('Request was aborted');
            return null;
          }
          
          console.error(`❌ API Error (attempt ${attempt}/${retries}):`, url, error);
          
          if (attempt === retries) {
            throw new Error(`Failed after ${retries} attempts: ${error.message}`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * attempt));
        }
      }
    };
  }, []);

  const fetchAPI = useMemo(() => createFetchWithRetry(), [createFetchWithRetry]);

  // 📥 Enhanced data fetching functions
  const fetchGeofences = useCallback(async (userId: string, showProgress = true) => {
    if (!isMountedRef.current) return [];
    
    try {
      if (showProgress) {
        setUIState(prev => ({ ...prev, loading: true }));
      }
      
      const result = await fetchAPI(
        `${ENDPOINTS.GEOFENCE}?filter[user_id][_eq]=${userId}&limit=-1&sort=-date_created`
      );
      
      if (!result || !isMountedRef.current) return [];
      
      const fetchedGeofences = safeArrayAccess(result.data || result);
      
      // 🔄 Enhanced parsing with batch processing
      const parsedGeofences = fetchedGeofences.map((gf: any) => {
        if (typeof gf.definition === 'string') {
          try {
            return { ...gf, definition: JSON.parse(gf.definition) };
          } catch (e) {
            console.error(`Failed to parse definition for geofence ${gf.geofence_id}:`, e);
            return { ...gf, definition: {} };
          }
        }
        return gf;
      });
      
      const validGeofences = parsedGeofences.filter(validateGeofenceStructure);
      
      if (isMountedRef.current) {
        setGeofences(validGeofences);
        console.log(`✅ Loaded ${validGeofences.length} valid geofences out of ${fetchedGeofences.length} total`);
      }
      
      return validGeofences;
    } catch (error: any) {
      console.error('Error fetching geofences:', error);
      if (isMountedRef.current) {
        toast.error(`Failed to load geofences: ${error.message}`);
        setGeofences([]);
      }
      return [];
    } finally {
      if (isMountedRef.current && showProgress) {
        setUIState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [fetchAPI]);

  const fetchVehicles = useCallback(async (userId: string, showProgress = false) => {
    if (!isMountedRef.current) return [];
    
    try {
      if (showProgress) {
        setUIState(prev => ({ ...prev, loading: true }));
      }
      
      const result = await fetchAPI(
        `${ENDPOINTS.VEHICLE}?filter[user_id][_eq]=${userId}&limit=-1&sort=name`
      );
      
      if (!result || !isMountedRef.current) return [];
      
      const fetchedVehicles = safeArrayAccess(result.data || result);
      
      if (isMountedRef.current) {
        setVehicles(fetchedVehicles);
        console.log(`✅ Loaded ${fetchedVehicles.length} vehicles`);
      }
      
      return fetchedVehicles;
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      if (isMountedRef.current) {
        toast.error(`Failed to load vehicles: ${error.message}`);
        setVehicles([]);
      }
      return [];
    } finally {
      if (isMountedRef.current && showProgress) {
        setUIState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [fetchAPI]);

  // 🔄 Auto-refresh functionality
  const refreshData = useCallback(async (silent = false) => {
    if (!currentUser || !isMountedRef.current) return;
    
    const userId = currentUser.id || currentUser.user_id;
    if (!userId) return;
    
    try {
      if (!silent) {
        setUIState(prev => ({ ...prev, isRefreshing: true }));
      }
      
      await Promise.all([
        fetchGeofences(userId, false),
        fetchVehicles(userId, false)
      ]);
      
      if (!silent) {
        toast.success('Data refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      if (!silent) {
        toast.error('Failed to refresh data');
      }
    } finally {
      if (isMountedRef.current && !silent) {
        setUIState(prev => ({ ...prev, isRefreshing: false }));
      }
    }
  }, [currentUser, fetchGeofences, fetchVehicles]);

  // 🎯 Enhanced filtering with performance optimization
  const filteredGeofences = useMemo(() => {
    const validGeofences = geofences.filter(validateGeofenceStructure);
    
    let filtered = validGeofences;
    
    // Status filter
    if (!uiState.showInactiveGeofences) {
      filtered = filtered.filter(g => g.status === 'active');
    }
    
    // Search filter
    if (uiState.searchTerm.trim()) {
      const searchLower = uiState.searchTerm.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(searchLower) ||
        g.rule_type.toLowerCase().includes(searchLower) ||
        g.type.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [geofences, uiState.searchTerm, uiState.showInactiveGeofences]);

  // 📊 Enhanced statistics
  const geofenceStats = useMemo(() => {
    const valid = geofences.filter(validateGeofenceStructure);
    const active = valid.filter(g => g.status === 'active');
    const byType = valid.reduce((acc, g) => {
      acc[g.type] = (acc[g.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const byRule = valid.reduce((acc, g) => {
      acc[g.rule_type] = (acc[g.rule_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: valid.length,
      active: active.length,
      inactive: valid.length - active.length,
      types: byType,
      rules: byRule,
      withVehicles: valid.filter(g => getAssignedVehiclesCount(g.geofence_id) > 0).length
    };
  }, [geofences]);

  // 🚗 Vehicle assignment utilities
  const getAssignedVehiclesCount = useCallback((geofenceId: number) => {
    return vehicles.filter(v =>
      v.geofence_id && (
        v.geofence_id.toString() === geofenceId.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofenceId
      )
    ).length;
  }, [vehicles]);

  const getAssignedVehicles = useCallback((geofenceId: number) => {
    return vehicles.filter(v =>
      v.geofence_id && (
        v.geofence_id.toString() === geofenceId.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofenceId
      )
    );
  }, [vehicles]);

  // 🎨 Event handlers with enhanced UX
  const handleSearchChange = useCallback((value: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    setUIState(prev => ({ ...prev, searchTerm: value }));
    
    debounceTimeoutRef.current = setTimeout(() => {
      console.log('Debounced search:', value);
    }, UI_CONFIG.SEARCH_DEBOUNCE_DELAY);
  }, []);

  const handleStartCreating = useCallback(() => {
    setUIState(prev => ({ ...prev, isCreating: true }));
    setCurrentGeofence(null);
    setDrawnLayers([]);
    setNewGeofence({ 
      name: "", 
      ruleType: "FORBIDDEN", 
      type: "polygon", 
      description: "" 
    });
  }, []);

  const handleCancelCreating = useCallback(() => {
    setUIState(prev => ({ ...prev, isCreating: false }));
    setDrawnLayers([]);
    
    const validGeofences = geofences.filter(validateGeofenceStructure);
    if (validGeofences.length > 0) {
      setCurrentGeofence(validGeofences[0]);
    } else {
      setCurrentGeofence(null);
    }
  }, [geofences]);

  // 🎨 Enhanced drawing handlers
  const handleDrawCreated = useCallback((e: { layerType: string; layer: Layer }) => {
    console.log('✏️ Draw created:', e.layerType);
    setDrawnLayers([e.layer]);
    setNewGeofence(prev => ({
      ...prev,
      type: e.layerType === 'circle' ? 'circle' : 'polygon'
    }));
    
    toast.success(`${e.layerType === 'circle' ? 'Circle' : 'Polygon'} drawn successfully! You can now save the geofence.`);
  }, []);

  const handleDrawDeleted = useCallback(() => {
    console.log('🗑️ Draw deleted');
    setDrawnLayers([]);
    toast.info('Drawing removed. Draw a new area to continue.');
  }, []);

  // 💾 Enhanced save geofence with comprehensive validation
  const handleSaveGeofence = useCallback(async () => {
    if (!currentUser || !newGeofence.name.trim() || drawnLayers.length === 0) {
      toast.error("Please complete all required fields and draw a geofence area");
      return;
    }
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      const layer = drawnLayers[0];
      const userId = currentUser.id || currentUser.user_id;
      let definitionData: any;
      let geofenceTypeForPayload: "circle" | "polygon" = newGeofence.type;

      // Enhanced layer processing with validation
      if (typeof (layer as any).getRadius === 'function') {
        const circleLayer = layer as Circle;
        const center = circleLayer.getLatLng();
        const radius = circleLayer.getRadius();
        
        if (!center || !radius || radius <= 0) {
          throw new Error('Invalid circle parameters - center or radius is missing');
        }
        
        if (radius > 1000000) { // 1000km limit
          throw new Error('Circle radius is too large (maximum 1000km)');
        }
        
        definitionData = { 
          type: "Circle", 
          center: [center.lng, center.lat], 
          radius: Math.round(radius) 
        };
        geofenceTypeForPayload = "circle";
        
        console.log('💾 Saving circle:', { center: [center.lng, center.lat], radius: Math.round(radius) });
      } else if (typeof (layer as any).getLatLngs === 'function') {
        const polygonLayer = layer as Polygon;
        const latlngsArray = polygonLayer.getLatLngs();
        
        let outerRing: LatLng[];

        if (Array.isArray(latlngsArray) && latlngsArray.length > 0) {
          if (Array.isArray(latlngsArray[0]) && 
              (latlngsArray[0] as LatLng[])[0] && 
              'lat' in (latlngsArray[0] as LatLng[])[0]) {
            outerRing = latlngsArray[0] as LatLng[];
          } else if (latlngsArray[0] && 'lat' in latlngsArray[0]) {
            outerRing = latlngsArray as LatLng[];
          } else {
            throw new Error("Unrecognized polygon coordinate format");
          }
        } else {
          throw new Error("Invalid polygon coordinates");
        }
        
        const coordinates = outerRing.map(ll => [ll.lng, ll.lat]);
        
        // Ensure polygon is closed
        if (coordinates.length > 0) {
          const first = coordinates[0];
          const last = coordinates[coordinates.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coordinates.push([...first]);
          }
        }
        
        if (coordinates.length < 4) {
          throw new Error('Polygon must have at least 3 unique points');
        }
        
        definitionData = { 
          type: "Polygon", 
          coordinates: [coordinates] 
        };
        geofenceTypeForPayload = "polygon";
        
        console.log('💾 Saving polygon:', { coordinates: coordinates.length, points: coordinates });
      } else {
        throw new Error("Unrecognized layer type for saving");
      }

      const payload = {
        user_id: userId,
        name: newGeofence.name.trim(),
        type: geofenceTypeForPayload,
        rule_type: newGeofence.ruleType,
        status: "active",
        definition: definitionData,
        description: newGeofence.description?.trim() || null,
        date_created: new Date().toISOString()
      };

      console.log('📤 Sending geofence payload:', payload);

      const result = await fetchAPI(ENDPOINTS.GEOFENCE, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (result && isMountedRef.current) {
        toast.success(`Geofence "${newGeofence.name}" saved successfully!`);
        setUIState(prev => ({ ...prev, isCreating: false }));
        setDrawnLayers([]);
        
        // Refresh data and set new geofence as current
        const fetchedGeofencesList = await fetchGeofences(userId, false);
        const newGeo = result.data || result;

        if (newGeo && validateGeofenceStructure(newGeo)) {
          setCurrentGeofence(newGeo);
        } else if (fetchedGeofencesList?.length > 0) {
          setCurrentGeofence(fetchedGeofencesList[0]);
        } else {
          setCurrentGeofence(null);
        }
      }
    } catch (error: any) {
      console.error('Error saving geofence:', error);
      toast.error(`Failed to save geofence: ${error.message}`);
    } finally {
      if (isMountedRef.current) {
        setUIState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [currentUser, newGeofence, drawnLayers, fetchAPI, fetchGeofences]);

  // 🗑️ Enhanced delete with confirmation and cleanup
  const handleDeleteGeofence = useCallback(async (geofence: Geofence) => {
    const assignedCount = getAssignedVehiclesCount(geofence.geofence_id);
    const confirmMessage = assignedCount > 0 
      ? `Are you sure you want to delete "${geofence.name}"? This will also remove assignments from ${assignedCount} vehicle(s).`
      : `Are you sure you want to delete "${geofence.name}"?`;
    
    if (!confirm(confirmMessage)) return;
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      // Remove vehicle assignments first
      if (assignedCount > 0) {
        const assignedVehicles = getAssignedVehicles(geofence.geofence_id);
        await Promise.all(
          assignedVehicles.map(vehicle => 
            fetchAPI(`${ENDPOINTS.VEHICLE}/${vehicle.vehicle_id}`, {
              method: 'PATCH',
              body: JSON.stringify({ geofence_id: null })
            })
          )
        );
      }
      
      // Delete geofence
      await fetchAPI(`${ENDPOINTS.GEOFENCE}/${geofence.geofence_id}`, {
        method: 'DELETE'
      });
      
      if (isMountedRef.current) {
        toast.success(`Geofence "${geofence.name}" deleted successfully`);
        
        // Refresh data
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          const [updatedGeofences] = await Promise.all([
            fetchGeofences(userId, false),
            fetchVehicles(userId, false)
          ]);
          
          // Update current geofence selection
          if (currentGeofence?.geofence_id === geofence.geofence_id) {
            setCurrentGeofence(updatedGeofences?.length > 0 ? updatedGeofences[0] : null);
          }
        }
      }
    } catch (error: any) {
      console.error('Error deleting geofence:', error);
      toast.error(`Failed to delete geofence: ${error.message}`);
    } finally {
      if (isMountedRef.current) {
        setUIState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [getAssignedVehiclesCount, getAssignedVehicles, fetchAPI, fetchGeofences, fetchVehicles, currentUser, currentGeofence]);

  // 🚗 Enhanced vehicle assignment
  const handleAssignVehicles = useCallback((geofence: Geofence) => {
    setCurrentGeofence(geofence);
    
    const assignedIds = getAssignedVehicles(geofence.geofence_id)
      .map(v => v.vehicle_id.toString());
    
    setSelectedVehicles(assignedIds);
    setUIState(prev => ({ ...prev, assignDialogOpen: true }));
  }, [getAssignedVehicles]);

  const saveVehicleAssignments = useCallback(async () => {
    if (!currentGeofence || !isMountedRef.current) return;
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      const geofenceIdNum = currentGeofence.geofence_id;
      const currentlyAssigned = getAssignedVehicles(geofenceIdNum)
        .map(v => v.vehicle_id.toString());
      
      const toAdd = selectedVehicles.filter(id => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter(id => !selectedVehicles.includes(id));
      
      const updatePromises = [
        ...toAdd.map(id => 
          fetchAPI(`${ENDPOINTS.VEHICLE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ geofence_id: geofenceIdNum })
          })
        ),
        ...toRemove.map(id => 
          fetchAPI(`${ENDPOINTS.VEHICLE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ geofence_id: null })
          })
        )
      ];
      
      const results = await Promise.allSettled(updatePromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      if (successCount === updatePromises.length) {
        toast.success(`Vehicle assignments updated successfully! Added: ${toAdd.length}, Removed: ${toRemove.length}`);
        
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId, false);
        
        setUIState(prev => ({ ...prev, assignDialogOpen: false }));
      } else {
        toast.warning(`Partially updated: ${successCount}/${updatePromises.length} assignments successful`);
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId, false);
      }
    } catch (error: any) {
      console.error('Error updating assignments:', error);
      toast.error(`Failed to update vehicle assignments: ${error.message}`);
    } finally {
      if (isMountedRef.current) {
        setUIState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [currentGeofence, selectedVehicles, getAssignedVehicles, fetchAPI, fetchVehicles, currentUser]);

  // 🚀 Initialization effect with enhanced error handling
  useEffect(() => {
    const initializeApp = async () => {
      if (!isMountedRef.current) return;
      
      setUIState(prev => ({ ...prev, loading: true }));
      
      try {
        const userJson = sessionStorage.getItem('user');
        if (!userJson) {
          toast.error("User session not found. Please login again.");
          return;
        }
        
        const user = JSON.parse(userJson);
        const userId = user.id || user.user_id;
        
        if (!userId) {
          toast.error("Invalid user data. Please login again.");
          return;
        }
        
        if (isMountedRef.current) {
          setCurrentUser(user);
          console.log('👤 User loaded:', user.full_name || user.email);
        }
        
        // Load data in parallel
        await Promise.all([
          fetchGeofences(userId, false),
          fetchVehicles(userId, false)
        ]);
        
        // Setup auto-refresh
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
        
        refreshIntervalRef.current = setInterval(() => {
          refreshData(true);
        }, UI_CONFIG.REFRESH_INTERVAL);
        
        console.log('✅ App initialized successfully');
        
      } catch (error: any) {
        console.error('❌ Error during app initialization:', error);
        toast.error(`Failed to initialize app: ${error.message}`);
      } finally {
        if (isMountedRef.current) {
          setUIState(prev => ({ ...prev, loading: false }));
        }
      }
    };
    
    initializeApp();
    
    return () => {
      isMountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchGeofences, fetchVehicles, refreshData]);

  // 🎯 Auto-select first geofence effect
  useEffect(() => {
    if (!uiState.loading && geofences.length > 0 && !currentGeofence && !uiState.isCreating) {
      const firstValid = geofences.find(validateGeofenceStructure);
      if (firstValid) {
        setCurrentGeofence(firstValid);
        console.log('🎯 Auto-selected first geofence:', firstValid.name);
      }
    }
  }, [geofences, currentGeofence, uiState.isCreating, uiState.loading]);

  // 🔄 Loading state for initial app load
  if (uiState.loading && !currentUser && geofences.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20">
          <div className="relative mb-6">
            <Loader2 className="w-16 h-16 animate-spin mx-auto text-blue-600" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-ping mx-auto"></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">Initializing Geofence Manager</h3>
          <p className="text-slate-600 mb-4">Loading your geofence data and setting up the interface...</p>
          <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      {/* ✨ Enhanced Header with Statistics */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 pb-6 border-b border-slate-200/60">
        <div className="flex items-center gap-4 mb-4 lg:mb-0">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Geofence Management
            </h1>
            <p className="text-slate-600 text-sm lg:text-base">
              Kelola area geografis untuk monitoring kendaraan
              {currentUser && ` • ${currentUser.full_name || currentUser.email}`}
            </p>
            {/* Statistics */}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                📊 {geofenceStats.total} total
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                ✅ {geofenceStats.active} active
              </Badge>
              {geofenceStats.withVehicles > 0 && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                  🚗 {geofenceStats.withVehicles} with vehicles
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <Button
            onClick={() => refreshData(false)}
            disabled={uiState.isRefreshing}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${uiState.isRefreshing ? 'animate-spin' : ''}`} />
            {uiState.isRefreshing ? 'Refreshing...' : 'Refresh'}
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

      {/* 📱 Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 240px)' }}>
        {/* 📋 Enhanced Sidebar */}
        <div className="lg:col-span-1 flex flex-col bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
          {/* Search and Filters */}
          {!uiState.isCreating && (
            <div className="space-y-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search geofences..."
                  value={uiState.searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-slate-200 bg-white/70 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-inactive"
                    checked={uiState.showInactiveGeofences}
                    onCheckedChange={(checked) => 
                      setUIState(prev => ({ ...prev, showInactiveGeofences: Boolean(checked) }))
                    }
                  />
                  <label htmlFor="show-inactive" className="text-sm text-slate-600 cursor-pointer">
                    Show inactive
                  </label>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Button
                    variant={uiState.selectedViewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUIState(prev => ({ ...prev, selectedViewMode: 'list' }))}
                    className="p-2"
                  >
                    📋
                  </Button>
                  <Button
                    variant={uiState.selectedViewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUIState(prev => ({ ...prev, selectedViewMode: 'grid' }))}
                    className="p-2"
                  >
                    ⊞
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 📝 Creation Form */}
          {uiState.isCreating && (
            <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <CircleIcon className="w-5 h-5 mr-2" />
                  Create New Geofence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Input
                  placeholder="Geofence name *"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                  className="border-blue-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                
                <Input
                  placeholder="Description (optional)"
                  value={newGeofence.description || ''}
                  onChange={(e) => setNewGeofence({ ...newGeofence, description: e.target.value })}
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
                    <SelectItem value="FORBIDDEN">🚫 Forbidden Zone</SelectItem>
                    <SelectItem value="STAY_IN">🏠 Stay Inside</SelectItem>
                    <SelectItem value="STANDARD">📍 Standard Zone</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Drawing Type Selection */}
                <div className="flex gap-2">
                  <Button
                    variant={newGeofence.type === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({ ...newGeofence, type: "polygon" })}
                    className={`flex-1 transition-all duration-200 ${
                      newGeofence.type === "polygon"
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'border-blue-200 text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    <Square className="h-4 w-4 mr-2" /> Polygon
                  </Button>
                  <Button
                    variant={newGeofence.type === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({ ...newGeofence, type: "circle" })}
                    className={`flex-1 transition-all duration-200 ${
                      newGeofence.type === "circle"
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'border-blue-200 text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    <CircleIcon className="h-4 w-4 mr-2" /> Circle
                  </Button>
                </div>

                {/* Enhanced Drawing Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700 font-medium mb-2">
                    ✏️ Drawing Instructions:
                  </p>
                  <p className="text-xs text-blue-600 mb-2">
                    {newGeofence.type === "circle" 
                      ? "Click and drag on the map to create a circle. The center will be where you start dragging." 
                      : "Click on the map to add points. Click the first point again to close the polygon."
                    }
                  </p>
                  {drawnLayers.length > 0 ? (
                    <div className="flex items-center text-xs text-green-600 bg-green-50 p-2 rounded">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      ✅ {newGeofence.type === "circle" ? "Circle" : "Polygon"} drawn successfully! Ready to save.
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-orange-600 bg-orange-50 p-2 rounded">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></div>
                      ⏳ Waiting for drawing...
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-blue-200">
                  <Button
                    onClick={handleSaveGeofence}
                    disabled={!newGeofence.name.trim() || drawnLayers.length === 0 || uiState.loading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uiState.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Geofence
                      </>
                    )}
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

          {/* 📋 Enhanced Geofence List */}
          <div className="flex-1 overflow-auto space-y-3 pr-1">
            {uiState.loading && geofences.length === 0 && !uiState.isCreating ? (
              <div className="text-center py-12 text-gray-500">
                <div className="relative mb-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500" />
                  <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-300 rounded-full animate-ping mx-auto"></div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Loading Geofences</h3>
                <p className="text-sm">Fetching your saved geofence data...</p>
              </div>
            ) : filteredGeofences.length === 0 && !uiState.isCreating ? (
              <Card className="border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                <CardContent className="p-8 text-center">
                  <div className="p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 mb-3">
                    {uiState.searchTerm ? "No Results Found" : geofenceStats.total > 0 ? "No Active Geofences" : "No Geofences Yet"}
                  </h3>
                  <p className="text-slate-500 mb-6 text-sm">
                    {uiState.searchTerm 
                      ? `No geofences match "${uiState.searchTerm}". Try a different search term.`
                      : geofenceStats.total > 0
                        ? "All your geofences are currently inactive. Toggle 'Show inactive' to see them."
                        : "Start by creating your first geofence to monitor vehicle locations."
                    }
                  </p>
                  {!uiState.searchTerm && geofenceStats.total === 0 && (
                    <Button
                      onClick={handleStartCreating}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Geofence
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className={uiState.selectedViewMode === 'grid' ? 'grid grid-cols-1 gap-3' : 'space-y-3'}>
                {filteredGeofences.map((geofence) => {
                  const statusStyle = getStatusStyles(geofence.status);
                  const ruleStyle = getRuleTypeStyles(geofence.rule_type);
                  const assignedCount = getAssignedVehiclesCount(geofence.geofence_id);
                  const isSelected = currentGeofence?.geofence_id === geofence.geofence_id;
                  
                  return (
                    <Card
                      key={geofence.geofence_id}
                      className={`cursor-pointer transition-all duration-300 ease-out hover:shadow-xl border rounded-xl overflow-hidden transform hover:scale-[1.02] ${
                        isSelected
                          ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-lg'
                          : 'bg-white/90 backdrop-blur-sm border-slate-200 hover:border-blue-300 shadow-md'
                      }`}
                      onClick={() => {
                        if (validateGeofenceStructure(geofence)) {
                          setUIState(prev => ({ ...prev, isCreating: false }));
                          setCurrentGeofence(geofence);
                        } else {
                          toast.error("Invalid geofence data structure");
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-800 truncate text-base lg:text-lg mb-1" title={geofence.name}>
                              {geofence.name}
                            </h3>
                            {geofence.description && (
                              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{geofence.description}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            <div className={`w-3 h-3 rounded-full ${statusStyle.indicator}`}></div>
                            <Badge className={`${statusStyle.badge} px-2 py-1 text-xs font-medium`}>
                              {statusStyle.icon} {geofence.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge className={`${ruleStyle.badge} px-2 py-1 text-xs font-medium`}>
                            {ruleStyle.icon} {ruleStyle.label}
                          </Badge>
                          <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white/70 px-2 py-1 text-xs">
                            {geofence.type === 'circle' ? '⭕ Circle' : '⬜ Polygon'}
                          </Badge>
                          {assignedCount > 0 && (
                            <Badge className="bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-800 border-cyan-200 px-2 py-1 text-xs">
                              🚗 {assignedCount} vehicle{assignedCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-xs text-slate-500 mb-4 bg-slate-50 rounded px-2 py-1">
                          📅 Created: {formatDateTime(geofence.date_created)}
                        </p>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleAssignVehicles(geofence); 
                            }}
                          >
                            <Car className="h-4 w-4 mr-1" /> 
                            {assignedCount > 0 ? `Manage (${assignedCount})` : 'Assign'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 px-3"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeleteGeofence(geofence); 
                            }}
                            title="Delete geofence"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 🗺️ Enhanced Map */}
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl bg-white/95 backdrop-blur-sm min-h-[400px] lg:min-h-0 relative">
          {/* Map Header */}
          {currentGeofence && !uiState.isCreating && (
            <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-white/20">
              <h4 className="font-semibold text-slate-800 mb-1">{currentGeofence.name}</h4>
              <div className="flex items-center space-x-2 text-xs">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRuleTypeStyles(currentGeofence.rule_type).badge}`}>
                  {getRuleTypeStyles(currentGeofence.rule_type).icon} {getRuleTypeStyles(currentGeofence.rule_type).label}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-600">{currentGeofence.type === 'circle' ? 'Circle' : 'Polygon'}</span>
              </div>
            </div>
          )}
          
          <MapWithDrawing
            center={calculateGeofenceCenter(uiState.isCreating ? null : currentGeofence)}
            zoom={uiState.isCreating 
              ? MAP_CONFIG.ZOOM_LEVELS.creating 
              : (currentGeofence ? MAP_CONFIG.ZOOM_LEVELS.detail : MAP_CONFIG.ZOOM_LEVELS.overview)
            }
            drawMode={uiState.isCreating ? newGeofence.type : undefined}
            onDrawCreated={uiState.isCreating ? handleDrawCreated : undefined}
            onDrawDeleted={uiState.isCreating ? handleDrawDeleted : undefined}
            viewOnly={!uiState.isCreating}
            geofences={uiState.isCreating 
              ? [] 
              : (currentGeofence && validateGeofenceStructure(currentGeofence) 
                  ? [currentGeofence] 
                  : filteredGeofences.filter(gf => 
                      currentGeofence ? gf.geofence_id === currentGeofence.geofence_id : true
                    )
                )
            }
            selectedGeofence={uiState.isCreating || !currentGeofence || !validateGeofenceStructure(currentGeofence) 
              ? null 
              : currentGeofence
            }
            isCreating={uiState.isCreating}
            drawnLayersForEditing={uiState.isCreating ? drawnLayers : undefined}
          />
        </div>
      </div>

      {/* 🚗 Enhanced Vehicle Assignment Dialog */}
      <Dialog open={uiState.assignDialogOpen} onOpenChange={(open) => 
        setUIState(prev => ({ ...prev, assignDialogOpen: open }))
      }>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden fixed top-[50%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[50000] bg-white border shadow-2xl rounded-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Car className="h-6 w-6 text-blue-600" />
              Assign Vehicles to "{currentGeofence?.name}"
            </DialogTitle>
            <p className="text-sm text-slate-600 mt-1">
              Select vehicles to monitor within this geofence area
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-1 pr-3 max-h-[50vh]">
            {vehicles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Car className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">No Vehicles Available</h3>
                <p className="text-sm">Add vehicles to your account to assign them to geofences.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((vehicle) => {
                  const isChecked = selectedVehicles.includes(vehicle.vehicle_id.toString());
                  const isAssignedToThisGeofence = vehicle.geofence_id?.toString() === currentGeofence?.geofence_id.toString();
                  const isAssignedElsewhere = vehicle.geofence_id && vehicle.geofence_id.toString() !== currentGeofence?.geofence_id.toString();
                  const otherGeofence = isAssignedElsewhere ?
                    geofences.find(g => g.geofence_id.toString() === vehicle.geofence_id?.toString())
                    : null;
                    
                  return (
                    <div
                      key={vehicle.vehicle_id}
                      className={`flex items-center space-x-3 p-4 rounded-lg border transition-all duration-200 ${
                        isChecked 
                          ? 'bg-blue-50 border-blue-400 shadow-sm' 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      } ${
                        isAssignedElsewhere && !isChecked 
                          ? 'opacity-60 cursor-not-allowed' 
                          : 'cursor-pointer'
                      }`}
                      onClick={() => {
                        if (isAssignedElsewhere && !isChecked) {
                          toast.error(`${vehicle.name} is already assigned to ${otherGeofence?.name || 'another geofence'}`);
                          return;
                        }
                        setSelectedVehicles(prev =>
                          prev.includes(vehicle.vehicle_id.toString())
                            ? prev.filter(id => id !== vehicle.vehicle_id.toString())
                            : [...prev, vehicle.vehicle_id.toString()]
                        );
                      }}
                    >
                      <Checkbox
                        id={`vehicle-${vehicle.vehicle_id}`}
                        checked={isChecked}
                        onCheckedChange={() => { /* Handled by div onClick */ }}
                        disabled={Boolean(isAssignedElsewhere && !isChecked)}
                        className={isAssignedElsewhere && !isChecked ? "cursor-not-allowed" : ""}
                      />
                      <label htmlFor={`vehicle-${vehicle.vehicle_id}`} className="flex-1 cursor-pointer">
                        <div className="font-medium text-gray-800 flex items-center gap-2">
                          🚗 {vehicle.name}
                          {vehicle.status === 'active' && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          📄 {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          🆔 Vehicle: {vehicle.vehicle_id}
                          {vehicle.gps_id && ` | GPS: ${vehicle.gps_id}`}
                        </div>
                        {isAssignedElsewhere && (
                          <Badge variant="outline" className="mt-2 text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                            📍 Currently in: {otherGeofence?.name || `Geofence ${vehicle.geofence_id}`}
                          </Badge>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-6 pt-4 border-t flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setUIState(prev => ({ ...prev, assignDialogOpen: false }))}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={saveVehicleAssignments}
              disabled={uiState.loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uiState.loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Assignments ({selectedVehicles.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}