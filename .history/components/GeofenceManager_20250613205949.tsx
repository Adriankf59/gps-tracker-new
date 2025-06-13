"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Plus, MapPin, Trash2, Circle as CircleIcon, Square, Save, X, Car, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';

const MapWithDrawing = dynamic(() => import('./MapWithDrawing'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
});

import { API_BASE_URL } from '../api/file';

const GEOFENCE_API = `${API_BASE_URL}/items/geofence`;
const VEHICLE_API = `${API_BASE_URL}/items/vehicle`;
const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];

// FIX: 'type' dibutuhkan di level atas DAN di dalam 'definition'
export type Geofence = {
  geofence_id: number;
  name: string;
  status: 'active' | 'inactive';
  rule_type: 'FORBIDDEN' | 'STAY_IN' | 'STANDARD';
  type: 'circle' | 'polygon'; // Kembalikan properti ini
  date_created: string;
  definition: {
    type: 'Circle' | 'Polygon';
    center?: [number, number];
    radius?: number;
    coordinates?: [number, number][][];
  };
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

// Utility functions
const ensureArray = (value: any): any[] => Array.isArray(value) ? value : (value?.data || []);

// FIX: Kembalikan pembacaan 'type' dari level atas
const validateGeofence = (gf: Geofence): boolean => {
  if (!gf?.definition) return false;
  const { center, radius, coordinates } = gf.definition;
  return gf.type === 'circle'
    ? center?.length === 2 && radius != null && radius > 0
    : coordinates?.[0]?.length != null && coordinates[0].length >= 4;
};

// FIX: Kembalikan pembacaan 'type' dari level atas
const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
  if (!geofence || !validateGeofence(geofence)) return DEFAULT_CENTER;
  
  if (geofence.type === 'circle' && geofence.definition.center) {
    const [lng, lat] = geofence.definition.center;
    return [lat, lng];
  }

  if (geofence.type === 'polygon' && geofence.definition.coordinates) {
    const coords = geofence.definition.coordinates[0];
    if (coords && coords.length > 0) {
      const lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
      const lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      return [lat, lng];
    }
  }

  return DEFAULT_CENTER;
};


const getStatusColor = (status: string): string => ({
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-700'
}[status] || 'bg-slate-100 text-slate-700');

const getRuleTypeColor = (type: string): string => ({
  FORBIDDEN: 'bg-rose-100 text-rose-800',
  STAY_IN: 'bg-indigo-100 text-indigo-800',
  STANDARD: 'bg-teal-100 text-teal-800'
}[type] || 'bg-gray-100 text-gray-700');

export function GeofenceManager() {
  // State
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newGeofence, setNewGeofence] = useState<NewGeofenceState>({ name: "", ruleType: "FORBIDDEN", type: "polygon" });
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // API functions
  const fetchData = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const response = await fetch(url, {
        ...options,
        signal: abortRef.current.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error: any) {
      if (error.name !== 'AbortError') throw error;
      return null;
    }
  }, []);

  const fetchGeofences = useCallback(async (userId: string) => {
    try {
      const result = await fetchData(`${GEOFENCE_API}?filter[user_id][_eq]=${userId}&limit=-1&sort=-date_created`);
      if (!result) return [];

      const parsed: Geofence[] = ensureArray(result).map((gf: any) => ({
        ...gf,
        geofence_id: Number(gf.geofence_id), 
        definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
      }));

      const valid = parsed.filter(validateGeofence);
      setGeofences(valid);
      return valid;
    } catch (error) {
      toast.error("Failed to load geofences");
      return [];
    }
  }, [fetchData]);

  const fetchVehicles = useCallback(async (userId: string) => {
    try {
      const result = await fetchData(`${VEHICLE_API}?filter[user_id][_eq]=${userId}&limit=-1`);
      if (!result) return [];

      const fetched: Vehicle[] = ensureArray(result);
      setVehicles(fetched);
      return fetched;
    } catch (error) {
      toast.error('Failed to load vehicles');
      return [];
    }
  }, [fetchData]);

  const refreshData = useCallback(async (userId: string) => {
    setLoading(true);
    await Promise.all([fetchGeofences(userId), fetchVehicles(userId)]);
    setLoading(false);
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
    if (geofences.length > 0) setCurrentGeofence(geofences[0]);
  };

  const handleDrawCreated = (e: any) => {
    setDrawnLayers([e.layer]);
    setNewGeofence(prev => ({ ...prev, type: e.layerType === 'circle' ? 'circle' : 'polygon' }));
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
      let definition;

      if (typeof layer.getRadius === 'function') {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        definition = { type: "Circle", center: [center.lng, center.lat], radius };
      } else {
        const latlngs = layer.getLatLngs();
        const coords = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs).map((ll: any) => [ll.lng, ll.lat]);
        if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
          coords.push([...coords[0]]);
        }
        definition = { type: "Polygon", coordinates: [coords] };
      }

      const payload = {
        user_id: userId,
        name: newGeofence.name.trim(),
        type: newGeofence.type, 
        rule_type: newGeofence.ruleType,
        status: "active",
        definition,
        date_created: new Date().toISOString()
      };

      await fetchData(GEOFENCE_API, { method: 'POST', body: JSON.stringify(payload) });
      toast.success("Geofence saved successfully!");

      setIsCreating(false);
      setDrawnLayers([]);
      await refreshData(userId);
    } catch (error: any) {
      toast.error(`Failed to save geofence: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser, newGeofence, drawnLayers, fetchData, refreshData]);

  const handleDeleteGeofence = useCallback(async (geofenceId: number) => {
    if (!confirm("Are you sure you want to delete this geofence?")) return;

    setLoading(true);
    try {
      const assignedVehicles = vehicles.filter(v => v.geofence_id?.toString() === geofenceId.toString());
      await Promise.all(assignedVehicles.map(v =>
        fetchData(`${VEHICLE_API}/${v.vehicle_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ geofence_id: null })
        })
      ));

      await fetchData(`${GEOFENCE_API}/${geofenceId}`, { method: 'DELETE' });
      toast.success("Geofence deleted successfully");

      const userId = currentUser?.id || currentUser?.user_id;
      if (userId) await refreshData(userId);
    } catch (error: any) {
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
        ...toAdd.map(id => fetchData(`${VEHICLE_API}/${id}`, {
          method: 'PATCH', body: JSON.stringify({ geofence_id: geofenceId })
        })),
        ...toRemove.map(id => fetchData(`${VEHICLE_API}/${id}`, {
          method: 'PATCH', body: JSON.stringify({ geofence_id: null })
        }))
      ]);

      toast.success('Vehicle assignments updated successfully');
      setAssignDialogOpen(false);

      const userId = currentUser?.id || currentUser?.user_id;
      if (userId) await fetchVehicles(userId);
    } catch (error) {
      toast.error('Failed to update vehicle assignments');
    } finally {
      setLoading(false);
    }
  }, [currentGeofence, vehicles, selectedVehicles, fetchData, fetchVehicles, currentUser]);

  // Computed values
  const filteredGeofences = useMemo(() => {
    if (!searchTerm.trim()) return geofences;
    return geofences.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [geofences, searchTerm]);

  const displayedGeofences = useMemo(() => {
    if (isCreating) return [];
    return currentGeofence ? [currentGeofence] : geofences;
  }, [isCreating, currentGeofence, geofences]);

  const getAssignedCount = useCallback((geofenceId: number) => {
    return vehicles.filter(v => v.geofence_id?.toString() === geofenceId.toString()).length;
  }, [vehicles]);

  // Effects
  useEffect(() => {
    const initializeData = async () => {
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          if (userId) await refreshData(userId);
        } else {
          toast.error("User session not found. Please login again.");
        }
      } catch (error) {
        toast.error("An error occurred while loading initial data.");
      }
    };

    initializeData();
  }, [refreshData]);

  useEffect(() => {
    if (!loading && geofences.length > 0 && !currentGeofence && !isCreating) {
      setCurrentGeofence(geofences[0]);
    }
  }, [geofences, currentGeofence, isCreating, loading]);

  if (loading && !currentUser && geofences.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Loading Geofence Manager</h3>
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
            onClick={() => currentUser && refreshData(currentUser.id || currentUser.user_id)}
            disabled={loading}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!isCreating && (
            <Button onClick={handleStartCreating} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Geofence
            </Button>
          )}
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
                  onValueChange={(value: "FORBIDDEN" | "STAY_IN" | "STANDARD") => setNewGeofence({ ...newGeofence, ruleType: value })}
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
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancelCreating} className="flex-1">
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
                  {!searchTerm && (
                    <Button onClick={handleStartCreating} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
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
                      <h3 className="font-semibold text-slate-800 truncate">{geofence.name}</h3>
                      <Badge className={getStatusColor(geofence.status)}>
                        {geofence.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className={getRuleTypeColor(geofence.rule_type)}>
                        {geofence.rule_type}
                      </Badge>
                      {/* FIX: Kembalikan pembacaan 'type' dari level atas */}
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
              Assign Vehicles to "{currentGeofence?.name}"
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
                      <Checkbox checked={isChecked} />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{vehicle.name}</div>
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
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveVehicleAssignments} disabled={loading} className="bg-blue-600 text-white">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}