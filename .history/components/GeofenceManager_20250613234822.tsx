"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Plus, MapPin, Trash2, Circle as CircleIcon, Square, Save, X, Car, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import type { LatLngExpression } from 'leaflet';

// Dynamic import with proper typing
const MapWithDrawing = dynamic(() => import('./MapWithDrawing'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

// Import API configuration
import { API_BASE_URL } from '../api/file';

// Use proxy endpoints to avoid mixed content
const useProxy = typeof window !== 'undefined' && window.location.protocol === 'https:';

// API endpoints - use local proxy for vehicles, direct for geofence
const GEOFENCE_API = `${API_BASE_URL}/items/geofence`;
const VEHICLE_API = useProxy ? '/api/vehicles' : `${API_BASE_URL}/items/vehicle`;
const VEHICLE_API_SINGLE = useProxy ? '/api/vehicles' : `${API_BASE_URL}/items/vehicle`;

const DEFAULT_CENTER: LatLngExpression = [-2.5, 118.0];

// Type definitions
export type GeofenceDefinition = {
  type: 'Circle' | 'Polygon';
  center?: [number, number];
  radius?: number;
  coordinates?: [number, number][][];
};

export type Geofence = {
  id?: number; // Tambahan untuk handle kedua format
  geofence_id: number;
  name: string;
  status: 'active' | 'inactive';
  rule_type: 'FORBIDDEN' | 'STAY_IN' | 'STANDARD';
  type: 'circle' | 'polygon';
  date_created: string;
  definition: GeofenceDefinition;
  user_id: string;
};

export type Vehicle = {
  vehicle_id: string | number;
  name: string;
  license_plate: string;
  make: string;
  model: string;
  geofence_id?: string | number | null;
  user_id: string;
};

type NewGeofenceState = {
  name: string;
  ruleType: "FORBIDDEN" | "STAY_IN" | "STANDARD";
  type: "polygon" | "circle";
};

type User = {
  id?: string;
  user_id?: string;
  email?: string;
};

// Utility functions
const ensureArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value?.data && Array.isArray(value.data)) return value.data;
  return [];
};

// Normalize geofence ID - handle both 'id' and 'geofence_id'
const normalizeGeofenceId = (gf: any): number => {
  return Number(gf.geofence_id || gf.id || 0);
};

const validateGeofence = (gf: any): gf is Geofence => {
  if (!gf?.definition) return false;
  
  // Parse definition if it's a string
  let definition = gf.definition;
  if (typeof definition === 'string') {
    try {
      definition = JSON.parse(definition);
    } catch {
      return false;
    }
  }
  
  const { center, radius, coordinates } = definition;
  
  if (gf.type === 'circle') {
    return Array.isArray(center) && center.length === 2 && 
           typeof radius === 'number' && radius > 0;
  }
  
  if (gf.type === 'polygon') {
    return Array.isArray(coordinates) && 
           coordinates.length > 0 && 
           Array.isArray(coordinates[0]) && 
           coordinates[0].length >= 4;
  }
  
  return false;
};

const getGeofenceCenter = (geofence: Geofence | null): LatLngExpression => {
  if (!geofence || !validateGeofence(geofence)) return DEFAULT_CENTER;
  
  if (geofence.type === 'circle' && geofence.definition.center) {
    const [lng, lat] = geofence.definition.center;
    return [lat, lng];
  }

  if (geofence.type === 'polygon' && geofence.definition.coordinates) {
    const coords = geofence.definition.coordinates[0];
    if (coords && coords.length > 0) {
      const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
      const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      return [lat, lng];
    }
  }

  return DEFAULT_CENTER;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-slate-100 text-slate-700'
  };
  return colors[status] || 'bg-slate-100 text-slate-700';
};

const getRuleTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    FORBIDDEN: 'bg-rose-100 text-rose-800',
    STAY_IN: 'bg-indigo-100 text-indigo-800',
    STANDARD: 'bg-teal-100 text-teal-800'
  };
  return colors[type] || 'bg-gray-100 text-gray-700';
};

export function GeofenceManager() {
  // State management
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newGeofence, setNewGeofence] = useState<NewGeofenceState>({ 
    name: "", 
    ruleType: "FORBIDDEN", 
    type: "polygon" 
  });
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // Debug logging function
  const debugLog = (message: string, data?: any) => {
    console.log(`[GeofenceManager] ${message}`, data || '');
  };

  // API functions with better error handling
  const fetchData = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      debugLog('fetchData called with URL:', url);
      debugLog('fetchData options:', options);

      const response = await fetch(url, {
        ...options,
        signal: abortRef.current.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers 
        }
      });

      const responseText = await response.text();
      debugLog('Response status:', response.status);
      debugLog('Response headers:', response.headers);
      debugLog('Response text (first 500 chars):', responseText.substring(0, 500));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }
      
      try {
        const parsed = JSON.parse(responseText);
        debugLog('Parsed response:', parsed);
        return parsed;
      } catch (e) {
        debugLog('Failed to parse JSON:', e);
        debugLog('Raw text was:', responseText);
        return null;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        debugLog('Request aborted');
        return null;
      }
      debugLog('Fetch error:', error);
      throw error;
    }
  }, []);

  const fetchGeofences = useCallback(async (userId: string) => {
    try {
      setFetchError(null);
      debugLog('Fetching geofences for user:', userId);
      
      // Try multiple query formats to ensure compatibility
      const queries = [
        `${GEOFENCE_API}?filter[user_id][_eq]=${userId}&limit=-1&sort=-date_created`,
        `${GEOFENCE_API}?filter[user_id]=${userId}&limit=-1&sort=-date_created`,
        `${GEOFENCE_API}?user_id=${userId}&limit=-1&sort=-date_created`
      ];

      let result = null;
      let successfulQuery = '';

      for (const query of queries) {
        try {
          debugLog('Trying query:', query);
          result = await fetchData(query);
          if (result) {
            successfulQuery = query;
            break;
          }
        } catch (e) {
          debugLog('Query failed, trying next:', e);
          continue;
        }
      }
      
      if (!result) {
        // If all queries fail, try to get all geofences and filter client-side
        debugLog('All queries failed, fetching all geofences');
        result = await fetchData(`${GEOFENCE_API}?limit=-1`);
      }

      debugLog('Raw API response:', result);

      const geofenceArray = ensureArray(result);
      debugLog('Geofence array:', geofenceArray);

      // Parse and normalize geofences
      const parsed: Geofence[] = geofenceArray.map((gf: any) => {
        const normalized = {
          ...gf,
          geofence_id: normalizeGeofenceId(gf),
          definition: typeof gf.definition === 'string' 
            ? JSON.parse(gf.definition) 
            : gf.definition
        };
        debugLog('Normalized geofence:', normalized);
        return normalized;
      });

      // Filter by user_id if we fetched all
      const userGeofences = successfulQuery 
        ? parsed 
        : parsed.filter(gf => gf.user_id === userId);

      debugLog('User geofences:', userGeofences);

      const valid = userGeofences.filter(validateGeofence);
      debugLog('Valid geofences:', valid);

      setGeofences(valid);
      return valid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debugLog('Error fetching geofences:', errorMessage);
      setFetchError(`Failed to load geofences: ${errorMessage}`);
      toast.error("Failed to load geofences. Please check console for details.");
      return [];
    }
  }, [fetchData]);

  const fetchVehicles = useCallback(async (userId: string) => {
    try {
      debugLog('=== FETCHING VEHICLES ===');
      debugLog('User ID:', userId);
      
      // Try different query formats since the API might expect different parameter formats
      const queries = [
        `${VEHICLE_API}?filter[user_id][_eq]=${userId}`,
        `${VEHICLE_API}?filter[user_id]=${userId}`,
        `${VEHICLE_API}?user_id=${userId}`,
        VEHICLE_API // Fallback: get all vehicles
      ];
      
      let result = null;
      let successfulUrl = '';
      
      for (const url of queries) {
        try {
          debugLog(`Trying URL: ${url}`);
          const response = await fetch(url, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          const responseText = await response.text();
          debugLog(`Response status: ${response.status}`);
          debugLog(`Response text preview: ${responseText.substring(0, 200)}...`);
          
          if (response.ok && responseText) {
            result = JSON.parse(responseText);
            successfulUrl = url;
            debugLog(`Success with URL: ${url}`);
            break;
          }
        } catch (e) {
          debugLog(`Failed with URL ${url}:`, e);
          continue;
        }
      }
      
      if (!result) {
        throw new Error('Failed to fetch vehicles from all URLs');
      }
      
      debugLog('Raw API response:', result);

      // Handle the response format from the API
      let vehicleArray: Vehicle[] = [];
      
      if (result?.data && Array.isArray(result.data)) {
        // Format: { data: [...] }
        vehicleArray = result.data;
        debugLog(`Found ${vehicleArray.length} vehicles in 'data' property`);
      } else if (Array.isArray(result)) {
        // Format: [...]
        vehicleArray = result;
        debugLog(`Found ${vehicleArray.length} vehicles as direct array`);
      } else {
        debugLog('Unexpected response format:', typeof result, result);
      }

      // Log all vehicles before filtering
      debugLog('All vehicles before filtering:', vehicleArray.map(v => ({
        vehicle_id: v.vehicle_id,
        name: v.name,
        user_id: v.user_id
      })));

      // Filter vehicles for current user
      const userVehicles = vehicleArray.filter(v => {
        const vehicleUserId = v.user_id?.toString().toLowerCase().trim();
        const currentUserId = userId.toString().toLowerCase().trim();
        const matches = vehicleUserId === currentUserId;
        
        debugLog(`Vehicle ${v.vehicle_id} (${v.name}): user_id="${v.user_id}" ${matches ? 'MATCHES' : 'does not match'} current="${userId}"`);
        
        return matches;
      });

      debugLog(`=== RESULT: Found ${userVehicles.length} vehicles for user ${userId} ===`);
      
      // If no vehicles found for user but we have vehicles in array, show warning
      if (userVehicles.length === 0 && vehicleArray.length > 0) {
        debugLog('WARNING: No vehicles found for current user, but found vehicles for other users');
        debugLog('Current user ID:', userId);
        debugLog('Vehicle user IDs:', [...new Set(vehicleArray.map(v => v.user_id))]);
      }
      
      setVehicles(userVehicles);
      return userVehicles;
    } catch (error) {
      debugLog('ERROR fetching vehicles:', error);
      toast.error('Failed to load vehicles. Check console for details.');
      return [];
    }
  }, []);

  const refreshData = useCallback(async (userId: string) => {
    debugLog('Refreshing data for user:', userId);
    setLoading(true);
    try {
      await Promise.all([
        fetchGeofences(userId), 
        fetchVehicles(userId)
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchGeofences, fetchVehicles]);

  // Event handlers
  const handleStartCreating = () => {
    setIsCreating(true);
    setCurrentGeofence(null);
    setDrawnLayers([]);
    setNewGeofence({ name: "", ruleType: "FORBIDDEN", type: "polygon" });
  };

  const handleCancelCreating = () => {
    setIsCreating(false);
    setDrawnLayers([]);
    if (geofences.length > 0) {
      setCurrentGeofence(geofences[0]);
    }
  };

  const handleDrawCreated = (e: any) => {
    setDrawnLayers([e.layer]);
    const layerType = e.layerType === 'circle' ? 'circle' : 'polygon';
    setNewGeofence(prev => ({ ...prev, type: layerType }));
    toast.success(`${e.layerType === 'circle' ? 'Circle' : 'Polygon'} drawn successfully`);
  };

  const handleSaveGeofence = useCallback(async () => {
    if (!currentUser || !newGeofence.name.trim() || drawnLayers.length === 0) {
      toast.error("Please complete all fields and draw a geofence area");
      return;
    }

    setLoading(true);
    try {
      const layer = drawnLayers[0];
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        throw new Error("User ID not found");
      }

      // Prepare different payload formats to try
      const payloadFormats = [];

      if (typeof layer.getRadius === 'function') {
        // Circle
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
        debugLog('Circle data:', { center, radius });

        // Format 1: Definition as stringified object with exact structure
        payloadFormats.push({
          user_id: userId,
          name: newGeofence.name.trim(),
          type: newGeofence.type,
          rule_type: newGeofence.ruleType,
          status: "active",
          definition: JSON.stringify({
            type: "Circle",
            center: [center.lng, center.lat],
            radius: Math.round(radius)
          })
        });

        // Format 2: Definition as object
        payloadFormats.push({
          user_id: userId,
          name: newGeofence.name.trim(),
          type: newGeofence.type,
          rule_type: newGeofence.ruleType,
          status: "active",
          definition: {
            type: "Circle",
            center: [center.lng, center.lat],
            radius: Math.round(radius)
          }
        });

        // Format 3: Simplified circle format
        payloadFormats.push({
          user_id: userId,
          name: newGeofence.name.trim(),
          type: "circle",
          rule_type: newGeofence.ruleType,
          status: "active",
          definition: JSON.stringify({
            center: [center.lng, center.lat],
            radius: Math.round(radius)
          })
        });

        // Format 4: Alternative structure
        payloadFormats.push({
          user_id: userId,
          name: newGeofence.name.trim(),
          type: "circle",
          rule_type: newGeofence.ruleType,
          status: "active",
          definition: JSON.stringify({
            type: "circle",
            center: {
              lat: center.lat,
              lng: center.lng
            },
            radius: Math.round(radius)
          })
        });

      } else {
        // Polygon
        const latlngs = layer.getLatLngs();
        const coords = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs)
          .map((ll: any) => [ll.lng, ll.lat]);
        
        // Close the polygon if not already closed
        if (coords.length > 0 && 
            (coords[0][0] !== coords[coords.length - 1][0] || 
             coords[0][1] !== coords[coords.length - 1][1])) {
          coords.push([...coords[0]]);
        }

        // Format 1: Standard GeoJSON-like
        payloadFormats.push({
          user_id: userId,
          name: newGeofence.name.trim(),
          type: newGeofence.type,
          rule_type: newGeofence.ruleType,
          status: "active",
          definition: JSON.stringify({
            type: "Polygon",
            coordinates: [coords]
          })
        });

        // Format 2: Alternative
        payloadFormats.push({
          user_id: userId,
          name: newGeofence.name.trim(),
          type: "polygon",
          rule_type: newGeofence.ruleType,
          status: "active",
          definition: JSON.stringify({
            type: "polygon",
            coordinates: coords
          })
        });
      }

      // Try each format until one succeeds
      let saveSuccess = false;
      let lastError = null;

      for (let i = 0; i < payloadFormats.length; i++) {
        const payload = payloadFormats[i];
        
        // Remove date_created as it might be auto-generated
        // Some systems don't like client-provided timestamps
        const payloadWithoutDate = { ...payload };
        const payloadWithDate = { ...payload, date_created: new Date().toISOString() };

        debugLog(`Attempt ${i + 1}: Saving geofence with payload:`, JSON.stringify(payloadWithoutDate, null, 2));

        try {
          // Try without date first
          let result = await fetchData(GEOFENCE_API, { 
            method: 'POST', 
            body: JSON.stringify(payloadWithoutDate) 
          });

          if (result) {
            debugLog('Save successful without date:', result);
            saveSuccess = true;
            break;
          }
        } catch (error) {
          debugLog(`Attempt ${i + 1}a failed:`, error);
          
          // Try with date
          try {
            debugLog(`Attempt ${i + 1}b: Trying with date_created`);
            const result = await fetchData(GEOFENCE_API, { 
              method: 'POST', 
              body: JSON.stringify(payloadWithDate) 
            });

            if (result) {
              debugLog('Save successful with date:', result);
              saveSuccess = true;
              break;
            }
          } catch (error2) {
            debugLog(`Attempt ${i + 1}b failed:`, error2);
            lastError = error2;
          }
        }
      }

      if (saveSuccess) {
        toast.success("Geofence saved successfully!");
        setIsCreating(false);
        setDrawnLayers([]);
        
        // Force refresh data
        setTimeout(() => {
          refreshData(userId);
        }, 500);
      } else {
        throw lastError || new Error('All save attempts failed');
      }
      
    } catch (error: any) {
      debugLog('Error saving geofence:', error);
      
      // Parse error message for more details
      let errorMessage = 'Failed to save geofence';
      
      try {
        if (error.message && error.message.includes('errors')) {
          const errorData = JSON.parse(error.message.split('message: ')[1]);
          if (errorData.errors && errorData.errors[0]) {
            errorMessage = errorData.errors[0].message || errorMessage;
          }
        }
      } catch (e) {
        // Keep default error message
      }
      
      toast.error(errorMessage);
      
      // Provide helpful suggestions
      console.error('💡 Troubleshooting tips:');
      console.error('1. Check if the API expects a specific date format');
      console.error('2. Verify if definition should be a string or object');
      console.error('3. Check if there are any required fields missing');
      console.error('4. Try creating a geofence through the original interface to see the correct format');
      console.error('Raw error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, newGeofence, drawnLayers, fetchData, refreshData]);

  const handleDeleteGeofence = useCallback(async (geofenceId: number) => {
    if (!confirm("Are you sure you want to delete this geofence?")) return;

    setLoading(true);
    try {
      // Unassign vehicles first
      const assignedVehicles = vehicles.filter(v => 
        v.geofence_id?.toString() === geofenceId.toString()
      );
      
      await Promise.all(
        assignedVehicles.map(v =>
          fetchData(`${VEHICLE_API_SINGLE}/${v.vehicle_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ geofence_id: null })
          })
        )
      );

      // Delete geofence
      await fetchData(`${GEOFENCE_API}/${geofenceId}`, { 
        method: 'DELETE' 
      });
      
      toast.success("Geofence deleted successfully");

      const userId = currentUser?.id || currentUser?.user_id;
      if (userId) {
        await refreshData(userId);
      }
    } catch (error: any) {
      debugLog('Error deleting geofence:', error);
      toast.error(`Failed to delete geofence: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [vehicles, fetchData, refreshData, currentUser]);

  const handleAssignVehicles = (geofence: Geofence) => {
    setCurrentGeofence(geofence);
    const assignedIds = vehicles
      .filter(v => v.geofence_id?.toString() === geofence.geofence_id.toString())
      .map(v => v.vehicle_id.toString());
    setSelectedVehicles(assignedIds);
    setAssignDialogOpen(true);
  };

  const saveVehicleAssignments = useCallback(async () => {
    if (!currentGeofence) return;

    setLoading(true);
    try {
      const geofenceId = currentGeofence.geofence_id;
      const currentlyAssigned = vehicles
        .filter(v => v.geofence_id?.toString() === geofenceId.toString())
        .map(v => v.vehicle_id.toString());

      const toAdd = selectedVehicles.filter(id => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter(id => !selectedVehicles.includes(id));

      await Promise.all([
        ...toAdd.map(id => 
          fetchData(`${VEHICLE_API_SINGLE}/${id}`, {
            method: 'PATCH', 
            body: JSON.stringify({ geofence_id: geofenceId })
          })
        ),
        ...toRemove.map(id => 
          fetchData(`${VEHICLE_API_SINGLE}/${id}`, {
            method: 'PATCH', 
            body: JSON.stringify({ geofence_id: null })
          })
        )
      ]);

      toast.success('Vehicle assignments updated successfully');
      setAssignDialogOpen(false);

      const userId = currentUser?.id || currentUser?.user_id;
      if (userId) {
        await fetchVehicles(userId);
      }
    } catch (error) {
      debugLog('Error saving vehicle assignments:', error);
      toast.error('Failed to update vehicle assignments');
    } finally {
      setLoading(false);
    }
  }, [currentGeofence, vehicles, selectedVehicles, fetchData, fetchVehicles, currentUser]);

  // Computed values
  const filteredGeofences = useMemo(() => {
    if (!searchTerm.trim()) return geofences;
    return geofences.filter(g => 
      g.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [geofences, searchTerm]);

  const displayedGeofences = useMemo(() => {
    if (isCreating) return [];
    return currentGeofence ? [currentGeofence] : geofences;
  }, [isCreating, currentGeofence, geofences]);

  const getAssignedCount = useCallback((geofenceId: number) => {
    return vehicles.filter(v => 
      v.geofence_id?.toString() === geofenceId.toString()
    ).length;
  }, [vehicles]);

  // Effects
  useEffect(() => {
    const initializeData = async () => {
      try {
        const userJson = sessionStorage.getItem('user');
        debugLog('User from session:', userJson);
        
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          
          if (userId) {
            debugLog('Initializing with user ID:', userId);
            await refreshData(userId);
          } else {
            toast.error("User ID not found in session");
            setLoading(false);
          }
        } else {
          toast.error("User session not found. Please login again.");
          setLoading(false);
        }
      } catch (error) {
        debugLog('Error initializing data:', error);
        toast.error("An error occurred while loading initial data.");
        setLoading(false);
      }
    };

    initializeData();
  }, [refreshData]);

  useEffect(() => {
    if (!loading && geofences.length > 0 && !currentGeofence && !isCreating) {
      setCurrentGeofence(geofences[0]);
    }
  }, [geofences, currentGeofence, isCreating, loading]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Loading state
  if (loading && !currentUser && geofences.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Loading Geofence Manager
          </h3>
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
            <p className="text-slate-600 text-sm">
              Manage geographic areas for vehicle monitoring
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const userId = currentUser?.id || currentUser?.user_id;
              if (userId) refreshData(userId);
            }}
            disabled={loading}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!isCreating && (
            <Button 
              onClick={handleStartCreating} 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Geofence
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {fetchError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-800">Error Loading Data</h4>
            <p className="text-sm text-red-700 mt-1">{fetchError}</p>
            <p className="text-xs text-red-600 mt-2">Check browser console for more details</p>
          </div>
        </div>
      )}

      {/* Debug Info (always show in this case to debug vehicle issue) */}
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs font-mono">
        <p className="font-semibold text-yellow-800 mb-1">Debug Info:</p>
        <p>User ID: {currentUser?.id || currentUser?.user_id || 'Not found'}</p>
        <p>User Email: {currentUser?.email || 'Not found'}</p>
        <p>Geofences loaded: {geofences.length}</p>
        <p>Vehicles loaded: {vehicles.length}</p>
        <p>Vehicle API: {VEHICLE_API}</p>
        <p>Geofence API: {GEOFENCE_API}</p>
        <p>Using Proxy: {useProxy ? 'Yes' : 'No'}</p>
        {vehicles.length > 0 && (
          <>
            <details className="mt-2">
              <summary className="cursor-pointer text-yellow-700">Show Vehicles</summary>
              <pre className="mt-1 text-xxs overflow-auto max-h-32">
                {JSON.stringify(vehicles.map(v => ({
                  id: v.vehicle_id,
                  name: v.name,
                  user_id: v.user_id
                })), null, 2)}
              </pre>
            </details>
          </>
        )}
        <div className="mt-2">
          <button
            onClick={() => {
              const userId = currentUser?.id || currentUser?.user_id;
              if (userId) {
                debugLog('Manual refresh triggered');
                fetchVehicles(userId);
              }
            }}
            className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
          >
            Manual Fetch Vehicles
          </button>
          <button
            onClick={() => {
              // Test fetch without filter
              debugLog('Testing fetch all vehicles...');
              fetch(VEHICLE_API)
                .then(res => res.json())
                .then(data => {
                  debugLog('All vehicles response:', data);
                  if (data?.data) {
                    debugLog('Total vehicles in system:', data.data.length);
                    debugLog('All user IDs:', [...new Set(data.data.map((v: any) => v.user_id))]);
                  }
                })
                .catch(err => debugLog('Error fetching all vehicles:', err));
            }}
            className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Test Fetch All
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Sidebar */}
        <div className="lg:col-span-1 flex flex-col bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-xl">
          {/* Search */}
          {!isCreating && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                placeholder="Search geofences..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 bg-white/70"
              />
            </div>
          )}

          {/* Creation Form */}
          {isCreating && (
            <Card className="mb-4 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-t-lg">
                <CardTitle className="text-lg flex items-center">
                  <CircleIcon className="w-5 h-5 mr-2" />
                  Create New Geofence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Geofence name"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                />
                <Select
                  value={newGeofence.ruleType}
                  onValueChange={(value: "FORBIDDEN" | "STAY_IN" | "STANDARD") => 
                    setNewGeofence({ ...newGeofence, ruleType: value })
                  }
                >
                  <SelectTrigger>
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
                    <CircleIcon className="h-4 w-4 mr-2" /> Circle
                  </Button>
                </div>

                <div className="flex gap-2 pt-3 border-t border-blue-200">
                  <Button
                    onClick={handleSaveGeofence}
                    disabled={!newGeofence.name.trim() || drawnLayers.length === 0 || loading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelCreating} 
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Geofence List */}
          <div className="flex-1 overflow-auto space-y-2">
            {loading && geofences.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p>Loading geofences...</p>
              </div>
            ) : filteredGeofences.length === 0 ? (
              <Card className="border-dashed border-slate-300">
                <CardContent className="p-6 text-center">
                  <MapPin className="h-10 w-10 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {searchTerm ? "No results found" : "No geofences yet"}
                  </h3>
                  {!searchTerm && !isCreating && (
                    <Button 
                      onClick={handleStartCreating} 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
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
                  className={`cursor-pointer transition-all duration-300 ${
                    currentGeofence?.geofence_id === geofence.geofence_id
                      ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50'
                      : 'bg-white/80 hover:shadow-xl'
                  }`}
                  onClick={() => {
                    setIsCreating(false);
                    setCurrentGeofence(geofence);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {geofence.name}
                      </h3>
                      <Badge className={getStatusColor(geofence.status)}>
                        {geofence.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className={getRuleTypeColor(geofence.rule_type)}>
                        {geofence.rule_type}
                      </Badge>
                      <Badge variant="outline">
                        {geofence.type === 'circle' ? '⭕ Circle' : '⬜ Polygon'}
                      </Badge>
                      {getAssignedCount(geofence.geofence_id) > 0 && (
                        <Badge className="bg-cyan-100 text-cyan-800">
                          🚗 {getAssignedCount(geofence.geofence_id)} vehicles
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-3">
                      📅 {new Date(geofence.date_created).toLocaleDateString()}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-blue-700 hover:bg-blue-50"
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
                        className="text-red-500 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGeofence(geofence.geofence_id);
                        }}
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
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl bg-white/90 min-h-[300px]">
          <MapWithDrawing
            center={getGeofenceCenter(isCreating ? null : currentGeofence)}
            zoom={isCreating ? 5 : (currentGeofence ? 13 : 5)}
            drawMode={isCreating ? newGeofence.type : undefined}
            onDrawCreated={isCreating ? handleDrawCreated : undefined}
            onDrawDeleted={isCreating ? () => setDrawnLayers([]) : undefined}
            viewOnly={!isCreating}
            geofences={displayedGeofences}
            selectedGeofence={isCreating ? null : currentGeofence}
            isCreating={isCreating}
            drawnLayersForEditing={isCreating ? drawnLayers : undefined}
          />
        </div>
      </div>

      {/* Vehicle Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              Assign Vehicles to &quot;{currentGeofence?.name}&quot;
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[300px] overflow-y-auto">
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No vehicles available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicles.map((vehicle) => {
                  const isChecked = selectedVehicles.includes(vehicle.vehicle_id.toString());
                  return (
                    <div
                      key={vehicle.vehicle_id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer ${
                        isChecked 
                          ? 'bg-blue-50 border-blue-400' 
                          : 'bg-gray-50 border-gray-200 hover:bg-blue-50'
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
                        onCheckedChange={() => {}}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {vehicle.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {vehicle.license_plate} • {vehicle.make} {vehicle.model}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={saveVehicleAssignments} 
              disabled={loading} 
              className="bg-blue-600 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}