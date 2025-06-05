"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Layer } from 'leaflet';
import type { Circle, Polygon, LatLng } from 'leaflet';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Plus, MapPin, Trash2, Circle as CircleIcon, Square, Save, X, Car, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';

// 🔧 Optimized dynamic import with better fallback
const MapWithDrawing = dynamic(
  () => import('./MapWithDrawing').catch(() => ({ 
    default: () => (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Map component not available</p>
        </div>
      </div>
    ) 
  })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">Loading map...</p>
        </div>
      </div>
    )
  }
);

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
  lastSavedGeofenceId: number | null; // 🆕 Track last saved geofence
  dataLoadTimestamp: number; // 🆕 Track when data was loaded
}

// 🔧 Constants with environment support
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055';
const GEOFENCE_API_ENDPOINT = `${API_BASE_URL}/items/geofence`;
const VEHICLE_API_ENDPOINT = `${API_BASE_URL}/items/vehicle`;

const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const SEARCH_DEBOUNCE_DELAY = 300;
const DATA_REFRESH_INTERVAL = 30000; // 🆕 Auto refresh every 30 seconds
const MAP_ZOOM_LEVELS = {
  overview: 5,
  detail: 13,
  creating: 5
} as const;

// 🔧 Enhanced utility functions
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

export function GeofenceManager() {
  // 🔧 Enhanced state management
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [uiState, setUIState] = useState<UIState>({
    isCreating: false,
    loading: true,
    assignDialogOpen: false,
    searchTerm: "",
    lastSavedGeofenceId: null, // 🆕
    dataLoadTimestamp: 0 // 🆕
  });
  
  const [newGeofence, setNewGeofence] = useState<GeofenceFormState>({
    name: "",
    ruleType: "FORBIDDEN",
    type: "polygon"
  });
  
  const [drawnLayers, setDrawnLayers] = useState<Layer[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  
  // 🔧 Enhanced refs for optimization
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const fetchAbortControllerRef = useRef<AbortController>();
  const refreshIntervalRef = useRef<NodeJS.Timeout>(); // 🆕 Auto refresh interval
  const isInitialLoadRef = useRef(true); // 🆕 Track initial load

  // 🔧 Enhanced API functions with better error handling and data persistence
  const fetchWithErrorHandling = useCallback(async (url: string, options?: RequestInit) => {
    try {
      // Cancel previous request if still pending
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      
      fetchAbortControllerRef.current = new AbortController();
      
      const response = await fetch(url, {
        ...options,
        signal: fetchAbortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache', // 🆕 Ensure fresh data
          ...options?.headers
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return null;
      }
      throw error;
    }
  }, []);

  // 🆕 Enhanced fetchGeofences with better persistence and tracking
  const fetchGeofences = useCallback(async (userId: string, options: { silent?: boolean; forceRefresh?: boolean } = {}) => {
    try {
      if (!options.silent) {
        setUIState(prev => ({ ...prev, loading: true }));
      }
      
      console.log('🔄 Fetching geofences...', { userId, options });
      
      // Add timestamp to force fresh data
      const timestamp = options.forceRefresh ? `&t=${Date.now()}` : '';
      const result = await fetchWithErrorHandling(
        `${GEOFENCE_API_ENDPOINT}?filter[user_id][_eq]=${userId}&limit=-1&sort=-date_created${timestamp}`
      );
      
      if (!result) return []; // Request was aborted
      
      const fetchedGeofences = ensureArray(result.data || result);
      
      console.log('📥 Raw geofences from API:', fetchedGeofences.length);
      
      // 🔧 Enhanced parsing with better error handling
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
      
      const validGeofences = parsedGeofences.filter(validateGeofence);
      
      // 🆕 Sort by date created (newest first) and ensure consistency
      const sortedGeofences = validGeofences.sort((a, b) => 
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      );
      
      setGeofences(sortedGeofences);
      
      // 🆕 Update data load timestamp
      setUIState(prev => ({ 
        ...prev, 
        dataLoadTimestamp: Date.now()
      }));
      
      console.log(`✅ Successfully loaded ${sortedGeofences.length} valid geofences`);
      
      // 🆕 If this is after a save operation, try to select the newly saved geofence
      if (uiState.lastSavedGeofenceId) {
        const newlyCreated = sortedGeofences.find(g => g.geofence_id === uiState.lastSavedGeofenceId);
        if (newlyCreated) {
          console.log('🎯 Found and selecting newly created geofence:', newlyCreated.name);
          setCurrentGeofence(newlyCreated);
          setUIState(prev => ({ ...prev, lastSavedGeofenceId: null })); // Clear the flag
        }
      }
      
      return sortedGeofences;
    } catch (error: any) {
      console.error('❌ Error fetching geofences:', error);
      if (!options.silent) {
        toast.error("Failed to load geofences");
      }
      return [];
    } finally {
      if (!options.silent) {
        setUIState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [fetchWithErrorHandling, uiState.lastSavedGeofenceId]);

  const fetchVehicles = useCallback(async (userId: string, options: { silent?: boolean } = {}) => {
    try {
      console.log('🚗 Fetching vehicles...', { userId, options });
      
      const result = await fetchWithErrorHandling(
        `${VEHICLE_API_ENDPOINT}?filter[user_id][_eq]=${userId}&limit=-1`
      );
      
      if (!result) return []; // Request was aborted
      
      const fetchedVehicles = ensureArray(result.data || result);
      setVehicles(fetchedVehicles);
      
      console.log(`✅ Successfully loaded ${fetchedVehicles.length} vehicles`);
      return fetchedVehicles;
    } catch (error: any) {
      console.error('❌ Error fetching vehicles:', error);
      if (!options.silent) {
        toast.error('Failed to load vehicles');
      }
      return [];
    }
  }, [fetchWithErrorHandling]);

  // 🆕 Function to refresh all data
  const refreshAllData = useCallback(async (userId: string, options: { silent?: boolean; forceRefresh?: boolean } = {}) => {
    console.log('🔄 Refreshing all data...', { userId, options });
    
    try {
      const [fetchedGeofences, fetchedVehicles] = await Promise.all([
        fetchGeofences(userId, options),
        fetchVehicles(userId, options)
      ]);
      
      console.log('✅ Data refresh completed', {
        geofences: fetchedGeofences?.length || 0,
        vehicles: fetchedVehicles?.length || 0
      });
      
      return { geofences: fetchedGeofences, vehicles: fetchedVehicles };
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      if (!options.silent) {
        toast.error('Failed to refresh data');
      }
      return { geofences: [], vehicles: [] };
    }
  }, [fetchGeofences, fetchVehicles]);

  const updateVehicleGeofence = useCallback(async (vehicleId: string | number, geofenceId: string | number | null) => {
    try {
      const result = await fetchWithErrorHandling(`${VEHICLE_API_ENDPOINT}/${vehicleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          geofence_id: geofenceId === null ? null : Number(geofenceId) 
        })
      });
      
      return !!result;
    } catch (error: any) {
      console.error(`❌ Error updating vehicle ${vehicleId}:`, error);
      return false;
    }
  }, [fetchWithErrorHandling]);

  // 🔧 Enhanced geofence operations
  const removeGeofenceFromVehicles = useCallback(async (geofenceId: number) => {
    try {
      const assignedVehicles = vehicles.filter(v =>
        v.geofence_id && (
          v.geofence_id.toString() === geofenceId.toString() ||
          parseInt(v.geofence_id.toString(), 10) === geofenceId
        )
      );
      
      if (assignedVehicles.length === 0) return true;
      
      // 🔧 Batch update with Promise.allSettled for better error handling
      const results = await Promise.allSettled(
        assignedVehicles.map(vehicle => updateVehicleGeofence(vehicle.vehicle_id, null))
      );
      
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value
      ).length;
      
      if (successCount === assignedVehicles.length) {
        toast.success(`Successfully removed assignment from ${successCount} vehicles`);
        return true;
      } else {
        toast.warning(`Only successfully removed assignment from ${successCount}/${assignedVehicles.length} vehicles`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error removing geofence from vehicles:', error);
      toast.error('Failed to remove vehicle assignments');
      return false;
    }
  }, [vehicles, updateVehicleGeofence]);

  // 🔧 Enhanced filtering with memoization and debouncing
  const filteredGeofences = useMemo(() => {
    if (!uiState.searchTerm.trim()) return geofences.filter(validateGeofence);
    
    const searchLower = uiState.searchTerm.toLowerCase();
    return geofences.filter(g => 
      validateGeofence(g) && 
      g.name.toLowerCase().includes(searchLower)
    );
  }, [geofences, uiState.searchTerm]);

  const validGeofences = useMemo(() => 
    geofences.filter(validateGeofence), 
    [geofences]
  );

  // 🔧 Enhanced vehicle assignment functions
  const getAssignedVehiclesCount = useCallback((geofenceId: number) => {
    return vehicles.filter(v =>
      v.geofence_id && (
        v.geofence_id.toString() === geofenceId.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofenceId
      )
    ).length;
  }, [vehicles]);

  // 🔧 Enhanced event handlers
  const handleSearchChange = useCallback((value: string) => {
    // Clear previous debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Immediate UI update
    setUIState(prev => ({ ...prev, searchTerm: value }));
    
    // Debounced search logic (if needed for API calls)
    debounceTimeoutRef.current = setTimeout(() => {
      console.log('🔍 Debounced search:', value);
    }, SEARCH_DEBOUNCE_DELAY);
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
    
    if (validGeofences.length > 0) {
      setCurrentGeofence(validGeofences[0]);
    } else {
      setCurrentGeofence(null);
    }
  }, [validGeofences]);

  // 🔧 Enhanced drawing handlers
  const handleDrawCreated = useCallback((e: { layerType: string; layer: Layer }) => {
    console.log('✏️ Draw created:', e.layerType);
    setDrawnLayers([e.layer]);
    setNewGeofence(prev => ({
      ...prev,
      type: e.layerType === 'circle' ? 'circle' : 'polygon'
    }));
    
    toast.success(`${e.layerType === 'circle' ? 'Circle' : 'Polygon'} drawn successfully`);
  }, []);

  const handleDrawDeleted = useCallback(() => {
    console.log('🗑️ Draw deleted');
    setDrawnLayers([]);
    toast.info('Drawing removed');
  }, []);

  // 🆕 Enhanced save geofence with improved persistence and immediate display
  const handleSaveGeofence = useCallback(async () => {
    if (!currentUser || !newGeofence.name.trim() || drawnLayers.length === 0) {
      toast.error("Please complete all fields and draw a geofence area");
      return;
    }
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      const layer = drawnLayers[0];
      const userId = currentUser.id || currentUser.user_id;
      let definitionData: any;
      let geofenceTypeForPayload: "circle" | "polygon" = newGeofence.type;

      // 🔧 Enhanced layer processing
      if (typeof (layer as any).getRadius === 'function') {
        const circleLayer = layer as Circle;
        const center = circleLayer.getLatLng();
        const radius = circleLayer.getRadius();
        
        if (!center || !radius || radius <= 0) {
          throw new Error('Invalid circle parameters');
        }
        
        definitionData = { 
          type: "Circle", 
          center: [center.lng, center.lat], 
          radius: radius 
        };
        geofenceTypeForPayload = "circle";
        
        console.log('💾 Saving circle:', { center: [center.lng, center.lat], radius });
      } else if (typeof (layer as any).getLatLngs === 'function') {
        const polygonLayer = layer as Polygon;
        const latlngsArray = polygonLayer.getLatLngs();
        
        let outerRing: LatLng[];

        // 🔧 Improved polygon processing
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
        date_created: new Date().toISOString()
      };

      console.log('📤 Sending geofence payload:', payload);

      const result = await fetchWithErrorHandling(GEOFENCE_API_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (result) {
        const savedGeofence = result.data || result;
        console.log('✅ Geofence saved successfully:', savedGeofence);
        
        toast.success("Geofence saved successfully!");
        
        // 🆕 Set the saved geofence ID for tracking
        if (savedGeofence?.geofence_id) {
          setUIState(prev => ({ 
            ...prev, 
            isCreating: false,
            lastSavedGeofenceId: savedGeofence.geofence_id
          }));
        } else {
          setUIState(prev => ({ ...prev, isCreating: false }));
        }
        
        setDrawnLayers([]);
        
        // 🆕 Enhanced data refresh with force refresh to ensure latest data
        console.log('🔄 Refreshing data after save...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay to ensure server processing
        
        const refreshResult = await refreshAllData(userId, { forceRefresh: true });
        
        // 🆕 Fallback selection if automatic selection doesn't work
        if (refreshResult.geofences && refreshResult.geofences.length > 0) {
          if (savedGeofence?.geofence_id) {
            const found = refreshResult.geofences.find(g => g.geofence_id === savedGeofence.geofence_id);
            if (found) {
              console.log('🎯 Setting newly saved geofence as current:', found.name);
              setCurrentGeofence(found);
            } else {
              console.log('⚠️ Could not find saved geofence, selecting first available');
              setCurrentGeofence(refreshResult.geofences[0]);
            }
          } else {
            setCurrentGeofence(refreshResult.geofences[0]);
          }
        }
        
        console.log('✅ Save operation completed successfully');
      }
    } catch (error: any) {
      console.error('❌ Error saving geofence:', error);
      toast.error(`Failed to save geofence: ${error.message}`);
    } finally {
      setUIState(prev => ({ ...prev, loading: false }));
    }
  }, [currentUser, newGeofence, drawnLayers, fetchWithErrorHandling, refreshAllData]);

  // 🔧 Enhanced delete geofence
  const handleDeleteGeofence = useCallback(async (geofenceId: number) => {
    if (!confirm("Are you sure you want to delete this geofence? All vehicle assignments will be removed.")) {
      return;
    }
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      await removeGeofenceFromVehicles(geofenceId);
      
      const result = await fetchWithErrorHandling(`${GEOFENCE_API_ENDPOINT}/${geofenceId}`, {
        method: 'DELETE'
      });
      
      if (result !== null) { // null means aborted, otherwise success
        toast.success("Geofence deleted successfully");
        
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          const refreshResult = await refreshAllData(userId, { forceRefresh: true });
          
          if (currentGeofence?.geofence_id === geofenceId) {
            setCurrentGeofence(refreshResult.geofences?.length > 0 ? refreshResult.geofences[0] : null);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Error deleting geofence:', error);
      toast.error(`Failed to delete geofence: ${error.message}`);
    } finally {
      setUIState(prev => ({ ...prev, loading: false }));
    }
  }, [removeGeofenceFromVehicles, fetchWithErrorHandling, refreshAllData, currentUser, currentGeofence]);

  // 🔧 Vehicle assignment handlers
  const handleAssignVehicles = useCallback((geofence: Geofence) => {
    setCurrentGeofence(geofence);
    
    const assignedIds = vehicles
      .filter(v => v.geofence_id && (
        v.geofence_id.toString() === geofence.geofence_id.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofence.geofence_id
      ))
      .map(v => v.vehicle_id.toString());
    
    setSelectedVehicles(assignedIds);
    setUIState(prev => ({ ...prev, assignDialogOpen: true }));
  }, [vehicles]);

  const saveVehicleAssignments = useCallback(async () => {
    if (!currentGeofence) return;
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      const geofenceIdNum = currentGeofence.geofence_id;
      const currentlyAssigned = vehicles
        .filter(v => v.geofence_id && (
          v.geofence_id.toString() === geofenceIdNum.toString() ||
          parseInt(v.geofence_id.toString(), 10) === geofenceIdNum
        ))
        .map(v => v.vehicle_id.toString());
      
      const toAdd = selectedVehicles.filter(id => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter(id => !selectedVehicles.includes(id));
      
      const promises = [
        ...toAdd.map(id => updateVehicleGeofence(id, geofenceIdNum)),
        ...toRemove.map(id => updateVehicleGeofence(id, null))
      ];
      
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      if (successCount === promises.length) {
        toast.success('Vehicle assignments updated successfully');
        
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
        
        setUIState(prev => ({ ...prev, assignDialogOpen: false }));
      } else {
        toast.error('Failed to update some vehicle assignments');
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
      }
    } catch (error: any) {
      console.error('❌ Error updating assignments:', error);
      toast.error('Failed to update vehicle assignments');
    } finally {
      setUIState(prev => ({ ...prev, loading: false }));
    }
  }, [currentGeofence, vehicles, selectedVehicles, updateVehicleGeofence, fetchVehicles, currentUser]);

  // 🆕 Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    if (!currentUser) return;
    
    const userId = currentUser.id || currentUser.user_id;
    if (!userId) return;
    
    setUIState(prev => ({ ...prev, loading: true }));
    
    try {
      console.log('🔄 Manual refresh triggered');
      await refreshAllData(userId, { forceRefresh: true });
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      toast.error('Failed to refresh data');
    } finally {
      setUIState(prev => ({ ...prev, loading: false }));
    }
  }, [currentUser, refreshAllData]);

  // 🆕 Enhanced initialization effect with better data persistence
  useEffect(() => {
    const loadUserAndData = async () => {
      console.log('🚀 Initializing GeofenceManager...');
      setUIState(prev => ({ ...prev, loading: true }));
      
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          
          console.log('👤 User loaded:', { userId, name: user.full_name || user.email });
          
          if (userId) {
            console.log('📥 Loading initial data...');
            await refreshAllData(userId, { forceRefresh: true });
            console.log('✅ Initial data loading completed');
          } else {
            toast.error("User ID not found. Failed to load data.");
          }
        } else {
          toast.error("User session not found. Please login again.");
        }
      } catch (error) {
        console.error('❌ Error loading user and initial data:', error);
        toast.error("An error occurred while loading initial data.");
      } finally {
        setUIState(prev => ({ ...prev, loading: false }));
        isInitialLoadRef.current = false;
      }
    };
    
    if (isInitialLoadRef.current) {
      loadUserAndData();
    }
    
    // 🆕 Setup auto-refresh interval
    const setupAutoRefresh = () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      refreshIntervalRef.current = setInterval(() => {
        if (currentUser) {
          const userId = currentUser.id || currentUser.user_id;
          if (userId) {
            console.log('🔄 Auto-refresh triggered');
            refreshAllData(userId, { silent: true });
          }
        }
      }, DATA_REFRESH_INTERVAL);
    };
    
    if (currentUser) {
      setupAutoRefresh();
    }
    
    // Cleanup function
    return () => {
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
  }, [currentUser, refreshAllData]);

  // 🔧 Enhanced auto-select first geofence effect
  useEffect(() => {
    if (!uiState.loading && geofences.length > 0 && !currentGeofence && !uiState.isCreating) {
      const firstValid = geofences.find(validateGeofence);
      if (firstValid) {
        console.log('🎯 Auto-selecting first valid geofence:', firstValid.name);
        setCurrentGeofence(firstValid);
      }
    }
  }, [geofences, currentGeofence, uiState.isCreating, uiState.loading]);

  // 🔧 Enhanced loading state
  if (uiState.loading && !currentUser && geofences.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-400 rounded-full animate-ping mx-auto"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Loading Geofence Manager</h3>
          <p className="text-slate-600">Initializing geofence management system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Enhanced Header with Refresh Button */}
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
              Manage geographic areas for vehicle monitoring
              {currentUser && ` - ${currentUser.full_name || currentUser.email}`}
            </p>
            {/* 🆕 Data status indicator */}
            {uiState.dataLoadTimestamp > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Last updated: {new Date(uiState.dataLoadTimestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {/* 🆕 Manual refresh button */}
          <Button
            onClick={handleManualRefresh}
            disabled={uiState.loading}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${uiState.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!uiState.isCreating && (
            <Button
              onClick={handleStartCreating}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0 flex-1 sm:flex-none"
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
          {/* Search Bar */}
          {!uiState.isCreating && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search geofences..."
                  value={uiState.searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-slate-200 bg-white/70 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                />
              </div>
            </div>
          )}

          {/* Creation Form */}
          {uiState.isCreating && (
            <Card className="mb-4 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <CircleIcon className="w-5 h-5 mr-2" />
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

                {/* Drawing Instructions */}
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
                  {drawnLayers.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ {newGeofence.type === "circle" ? "Circle" : "Polygon"} drawn successfully!
                    </p>
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
                        Save
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

          {/* Geofence List */}
          <div className="flex-1 overflow-auto space-y-2 pr-1">
            {uiState.loading && geofences.length === 0 && !uiState.isCreating ? (
              <div className="text-center py-8 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p>Loading geofences...</p>
              </div>
            ) : filteredGeofences.length === 0 && !uiState.isCreating ? (
              <Card className="border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <MapPin className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {uiState.searchTerm ? "No results found" : "No geofences yet"}
                  </h3>
                  <p className="text-slate-500 mb-4 text-sm">
                    {uiState.searchTerm 
                      ? `No geofences match "${uiState.searchTerm}"` 
                      : "Start by creating your first geofence"
                    }
                  </p>
                  {!uiState.searchTerm && (
                    <Button
                      onClick={handleStartCreating}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Geofence
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredGeofences.map((geofence) => (
                <Card
                  key={geofence.geofence_id}
                  className={`cursor-pointer transition-all duration-300 ease-out hover:shadow-xl border rounded-xl overflow-hidden transform hover:scale-[1.02] ${
                    currentGeofence?.geofence_id === geofence.geofence_id
                      ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-lg'
                      : 'bg-white/80 backdrop-blur-sm border-slate-200 hover:border-blue-300 shadow-md'
                  }`}
                  onClick={() => {
                    if (validateGeofence(geofence)) {
                      setUIState(prev => ({ ...prev, isCreating: false }));
                      setCurrentGeofence(geofence);
                    } else {
                      toast.error("Invalid geofence data");
                    }
                  }}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <h3 className="font-semibold text-slate-800 truncate text-base sm:text-lg" title={geofence.name}>
                        {geofence.name}
                      </h3>
                      <Badge className={`${getStatusColor(geofence.status)} px-2 py-1 text-xs font-medium`}>
                        {geofence.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2 sm:mb-3">
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
                    
                    <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded px-2 py-1">
                      📅 {new Date(geofence.date_created).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
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
                        <Car className="h-4 w-4 mr-1" /> Assign
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 p-2"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleDeleteGeofence(geofence.geofence_id); 
                        }}
                        title="Delete geofence"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm min-h-[300px] lg:min-h-0">
          <MapWithDrawing
            center={getGeofenceCenter(uiState.isCreating ? null : currentGeofence)}
            zoom={uiState.isCreating 
              ? MAP_ZOOM_LEVELS.creating 
              : (currentGeofence ? MAP_ZOOM_LEVELS.detail : MAP_ZOOM_LEVELS.overview)
            }
            drawMode={uiState.isCreating ? newGeofence.type : undefined}
            onDrawCreated={uiState.isCreating ? handleDrawCreated : undefined}
            onDrawDeleted={uiState.isCreating ? handleDrawDeleted : undefined}
            viewOnly={!uiState.isCreating}
            geofences={uiState.isCreating 
              ? [] 
              : (currentGeofence && validateGeofence(currentGeofence) 
                  ? [currentGeofence] 
                  : validGeofences.filter(gf => 
                      currentGeofence ? gf.geofence_id === currentGeofence.geofence_id : true
                    )
                )
            }
            selectedGeofence={uiState.isCreating || !currentGeofence || !validateGeofence(currentGeofence) 
              ? null 
              : currentGeofence
            }
            isCreating={uiState.isCreating}
            drawnLayersForEditing={uiState.isCreating ? drawnLayers : undefined}
          />
        </div>
      </div>

      {/* Vehicle Assignment Dialog */}
      <Dialog open={uiState.assignDialogOpen} onOpenChange={(open) => 
        setUIState(prev => ({ ...prev, assignDialogOpen: open }))
      }>
        <DialogContent className="sm:max-w-md fixed top-[50%] sm:top-[10%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 sm:translate-y-0 z-[50000] bg-white border shadow-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Car className="h-5 w-5 text-blue-600" />
              Assign Vehicles to "{currentGeofence?.name}"
            </DialogTitle>
          </DialogHeader>
          
          <div className="max-h-[60vh] sm:max-h-[300px] overflow-y-auto p-1 pr-2">
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No vehicles available</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        isChecked ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
                      } ${
                        isAssignedElsewhere && !isChecked 
                          ? 'opacity-60 cursor-not-allowed' 
                          : 'cursor-pointer hover:bg-blue-50'
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
                        <div className="font-medium text-gray-800">{vehicle.name}</div>
                        <div className="text-xs text-gray-500">
                          {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Vehicle ID: {vehicle.vehicle_id} 
                          {vehicle.gps_id ? ` | GPS ID: ${vehicle.gps_id}` : ''}
                        </div>
                        {isAssignedElsewhere && (
                          <Badge variant="outline" className="mt-1 text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                            In geofence: {otherGeofence?.name || `ID ${vehicle.geofence_id}`}
                          </Badge>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setUIState(prev => ({ ...prev, assignDialogOpen: false }))}
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
                'Save Assignment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}