"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Layer } from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Plus, MapPin, Trash2, Circle as CircleIcon, Square, Save, X, Car } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';

// Dynamic map import
const MapWithDrawing = dynamic(() => import('./MapWithDrawing'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center bg-gray-100">Loading map...</div>
});

// Types
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
  name: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  geofence_id: string | null;
}

// Constants
const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';
const VEHICLE_API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';

export function GeofenceManager() {
  // Core state
  const [searchTerm, setSearchTerm] = useState("");
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    ruleType: "FORBIDDEN",
    type: "polygon" as "polygon" | "circle"
  });
  const [drawnLayers, setDrawnLayers] = useState<Layer[]>([]);
  
  // Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  // Helper functions
  const validateGeofence = (geofence: Geofence): boolean => {
    if (!geofence.definition) return false;
    
    if (geofence.type === 'circle') {
      return !!(geofence.definition.center && 
               geofence.definition.center.length === 2 && 
               geofence.definition.radius);
    }
    
    if (geofence.type === 'polygon') {
      return !!(geofence.definition.coordinates && 
               geofence.definition.coordinates[0] && 
               geofence.definition.coordinates[0].length > 0);
    }
    
    return false;
  };

  const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
    if (!geofence) return DEFAULT_CENTER;
    
    if (geofence.type === 'circle' && geofence.definition.center) {
      return [geofence.definition.center[1], geofence.definition.center[0]];
    }
    
    if (geofence.type === 'polygon' && geofence.definition.coordinates?.[0]) {
      const coords = geofence.definition.coordinates[0];
      const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
      const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
      return [sumLat / coords.length, sumLng / coords.length];
    }
    
    return DEFAULT_CENTER;
  };

  const getStatusColor = (status: string) => 
    status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';

  const getRuleTypeColor = (ruleType: string) => {
    const colors = {
      FORBIDDEN: 'bg-red-100 text-red-700',
      STAY_IN: 'bg-blue-100 text-blue-700',
      STANDARD: 'bg-green-100 text-green-700'
    };
    return colors[ruleType as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const formatRuleType = (ruleType: string) => {
    const formats = {
      FORBIDDEN: 'Terlarang',
      STAY_IN: 'Tetap di Dalam',
      STANDARD: 'Standar'
    };
    return formats[ruleType as keyof typeof formats] || ruleType;
  };

  // API functions
  const fetchGeofences = async (userId: string) => {
    try {
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch geofences');
      
      const result = await response.json();
      const validGeofences = (result.data || []).filter(validateGeofence);
      setGeofences(validGeofences);
      return validGeofences;
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error("Gagal memuat data geofence");
      return [];
    }
  };

  const removeGeofenceFromVehicles = async (geofenceId: number) => {
    try {
      const assignedVehicles = vehicles.filter(v => v.geofence_id === geofenceId.toString());
      const unassignPromises = assignedVehicles.map(vehicle => 
        updateVehicleGeofence(vehicle.vehicle_id, null)
      );
      await Promise.all(unassignPromises);
      console.log(`Removed geofence assignment from ${assignedVehicles.length} vehicles`);
    } catch (error) {
      console.error('Error removing geofence from vehicles:', error);
    }
  };

  const fetchVehicles = async (userId: string) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      
      const result = await response.json();
      setVehicles(result.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    }
  };

  const updateVehicleGeofence = async (vehicleId: string, geofenceId: string | null) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geofence_id: geofenceId })
      });
      return response.ok;
    } catch (error) {
      console.error(`Error updating vehicle ${vehicleId}:`, error);
      return false;
    }
  };

  // Load user and data on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          if (userId) {
            fetchGeofences(userId);
            fetchVehicles(userId);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Auto-select first geofence
  useEffect(() => {
    if (geofences.length > 0 && !currentGeofence && !isCreating) {
      const firstValid = geofences.find(validateGeofence);
      if (firstValid) setCurrentGeofence(firstValid);
    }
  }, [geofences, currentGeofence, isCreating]);

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
      const firstValid = geofences.find(validateGeofence);
      if (firstValid) setCurrentGeofence(firstValid);
    }
  };

  const handleDrawCreated = (e: { layerType: string; layer: any }) => {
    setDrawnLayers([e.layer]);
    setNewGeofence(prev => ({
      ...prev,
      type: e.layerType === 'circle' ? 'circle' : 'polygon'
    }));
  };

  const handleSaveGeofence = async () => {
    if (!currentUser || !newGeofence.name.trim() || drawnLayers.length === 0) {
      toast.error("Mohon lengkapi semua field dan gambar area geofence");
      return;
    }

    setLoading(true);
    try {
      const layer = drawnLayers[0];
      const userId = currentUser.id || currentUser.user_id;
      
      let definition;
      if (layer.getRadius) { // Circle
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        definition = {
          type: "Circle",
          center: [center.lng, center.lat],
          radius: radius
        };
      } else { // Polygon
        const latlngs = layer.getLatLngs()[0];
        const coordinates = latlngs.map((ll: any) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]); // Close polygon
        definition = {
          type: "Polygon",
          coordinates: [coordinates]
        };
      }

      const payload = {
        user_id: userId,
        name: newGeofence.name,
        type: newGeofence.type,
        rule_type: newGeofence.ruleType,
        status: "active",
        definition,
        date_created: new Date().toISOString()
      };

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success("Geofence berhasil disimpan");
        setIsCreating(false);
        setDrawnLayers([]);
        await fetchGeofences(userId);
      } else {
        throw new Error('Failed to save geofence');
      }
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast.error("Gagal menyimpan geofence");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGeofence = async (geofenceId: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus geofence ini? Semua assignment kendaraan akan dihapus.")) return;

    setLoading(true);
    try {
      // First remove geofence assignment from all vehicles
      await removeGeofenceFromVehicles(geofenceId);

      // Then delete the geofence
      const response = await fetch(`${API_ENDPOINT}/${geofenceId}`, { method: 'DELETE' });
      
      if (response.ok) {
        toast.success("Geofence berhasil dihapus");
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          await fetchGeofences(userId);
          await fetchVehicles(userId);
        }
        if (currentGeofence?.geofence_id === geofenceId) {
          setCurrentGeofence(null);
        }
      } else {
        throw new Error('Failed to delete geofence');
      }
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast.error("Gagal menghapus geofence");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVehicles = (geofence: Geofence) => {
    setCurrentGeofence(geofence);
    const assignedIds = vehicles
      .filter(v => v.geofence_id === geofence.geofence_id.toString())
      .map(v => v.vehicle_id);
    setSelectedVehicles(assignedIds);
    setAssignDialogOpen(true);
  };

  const saveVehicleAssignments = async () => {
    if (!currentGeofence) return;

    setLoading(true);
    try {
      const geofenceIdStr = currentGeofence.geofence_id.toString();
      const currentlyAssigned = vehicles
        .filter(v => v.geofence_id === geofenceIdStr)
        .map(v => v.vehicle_id);

      const toAdd = selectedVehicles.filter(id => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter(id => !selectedVehicles.includes(id));

      const promises = [
        ...toAdd.map(id => updateVehicleGeofence(id, geofenceIdStr)),
        ...toRemove.map(id => updateVehicleGeofence(id, null))
      ];

      const results = await Promise.all(promises);
      
      if (results.every(Boolean)) {
        toast.success('Assignment berhasil diperbarui');
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
        setAssignDialogOpen(false);
      } else {
        toast.error('Gagal memperbarui beberapa assignment');
      }
    } catch (error) {
      console.error('Error updating assignments:', error);
      toast.error('Gagal memperbarui assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVehicleAssignment = async (vehicleId: string, vehicleName: string) => {
    if (!confirm(`Apakah Anda yakin ingin melepas assignment kendaraan ${vehicleName}?`)) return;

    try {
      const success = await updateVehicleGeofence(vehicleId, null);
      if (success) {
        toast.success(`Assignment kendaraan ${vehicleName} berhasil dihapus`);
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
        setSelectedVehicles(prev => prev.filter(id => id !== vehicleId));
      } else {
        toast.error(`Gagal menghapus assignment kendaraan ${vehicleName}`);
      }
    } catch (error) {
      console.error('Error removing vehicle assignment:', error);
      toast.error('Gagal menghapus assignment');
    }
  };

  // Computed values
  const filteredGeofences = geofences.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validGeofences = useMemo(() => 
    geofences.filter(validateGeofence), [geofences]
  );

  if (loading && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <Shield className="h-10 w-10 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Manajemen Geofence</h1>
            <p className="text-gray-600">Kelola area geografis untuk monitoring kendaraan</p>
          </div>
        </div>
        
        {!isCreating && (
          <Button onClick={handleStartCreating} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Geofence
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <div className="lg:col-span-1 flex flex-col bg-white p-4 rounded-xl shadow-lg">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Cari geofence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Create Form */}
          {isCreating && (
            <Card className="mb-4 border-blue-300">
              <CardHeader className="bg-blue-50 py-3">
                <CardTitle className="text-lg text-blue-700">Buat Geofence Baru</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Nama geofence"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                />
                
                <Select
                  value={newGeofence.ruleType}
                  onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORBIDDEN">Terlarang</SelectItem>
                    <SelectItem value="STAY_IN">Tetap di Dalam</SelectItem>
                    <SelectItem value="STANDARD">Standar</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    variant={newGeofence.type === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({...newGeofence, type: "polygon"})}
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" /> Poligon
                  </Button>
                  <Button
                    variant={newGeofence.type === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({...newGeofence, type: "circle"})}
                    className="flex-1"
                  >
                    <CircleIcon className="h-4 w-4 mr-2" /> Lingkaran
                  </Button>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button 
                    onClick={handleSaveGeofence} 
                    disabled={!newGeofence.name.trim() || drawnLayers.length === 0 || loading}
                    className="flex-1 bg-green-500 hover:bg-green-600"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelCreating} className="flex-1">
                    <X className="h-4 w-4 mr-2" /> Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Geofence List */}
          <div className="flex-1 overflow-auto space-y-2">
            {filteredGeofences.length === 0 ? (
              <Card className="border-dashed border-gray-300 bg-gray-50">
                <CardContent className="p-6 text-center">
                  <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    {searchTerm ? "Tidak ditemukan" : "Belum ada geofence"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm ? `Tidak ada geofence yang cocok dengan "${searchTerm}"` : "Mulai dengan membuat geofence baru"}
                  </p>
                  {!searchTerm && (
                    <Button onClick={handleStartCreating} className="bg-blue-500 hover:bg-blue-600">
                      <Plus className="h-4 w-4 mr-2" />
                      Buat Geofence
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredGeofences.map((geofence) => (
                <Card
                  key={geofence.geofence_id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    currentGeofence?.geofence_id === geofence.geofence_id
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setIsCreating(false);
                    setCurrentGeofence(geofence);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 truncate" title={geofence.name}>
                        {geofence.name}
                      </h3>
                      <Badge className={getStatusColor(geofence.status)}>
                        {geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2 mb-2">
                      <Badge className={getRuleTypeColor(geofence.rule_type)}>
                        {formatRuleType(geofence.rule_type)}
                      </Badge>
                      <Badge variant="outline">
                        {geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-2">
                      {new Date(geofence.date_created).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
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
        <div className="lg:col-span-2 border rounded-xl overflow-hidden shadow-xl">
          <MapWithDrawing
            center={getGeofenceCenter(isCreating ? null : currentGeofence)}
            zoom={isCreating ? 5 : (currentGeofence ? 13 : 5)}
            drawMode={isCreating ? newGeofence.type : undefined}
            onDrawCreated={isCreating ? handleDrawCreated : undefined}
            onDrawEdited={isCreating ? (e) => setDrawnLayers([...e.layers._layers]) : undefined}
            onDrawDeleted={isCreating ? () => setDrawnLayers([]) : undefined}
            viewOnly={!isCreating}
            geofences={isCreating ? [] : (currentGeofence ? [currentGeofence] : validGeofences)}
            selectedGeofence={isCreating ? null : currentGeofence}
            isCreating={isCreating}
            drawnLayersForEditing={isCreating ? drawnLayers : undefined}
          />
        </div>
      </div>

      {/* Vehicle Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md fixed top-[10%] left-1/2 transform -translate-x-1/2 z-[50000] bg-white border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              Assign Kendaraan - {currentGeofence?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto">
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Tidak ada kendaraan tersedia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicles.map((vehicle) => {
                  const isAssignedToCurrentGeofence = vehicle.geofence_id === currentGeofence?.geofence_id.toString();
                  const isAssignedElsewhere = vehicle.geofence_id && 
                    vehicle.geofence_id !== currentGeofence?.geofence_id.toString();
                  const otherGeofence = isAssignedElsewhere ? 
                    geofences.find(g => g.geofence_id.toString() === vehicle.geofence_id) : null;
                  
                  return (
                    <div 
                      key={vehicle.vehicle_id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border ${
                        selectedVehicles.includes(vehicle.vehicle_id) 
                          ? 'bg-blue-50 border-blue-400' 
                          : 'bg-gray-50 border-gray-200'
                      } ${isAssignedElsewhere ? 'opacity-60' : ''}`}
                    >
                      <Checkbox 
                        checked={selectedVehicles.includes(vehicle.vehicle_id)}
                        onCheckedChange={() => {
                          if (isAssignedElsewhere) {
                            toast.error(`${vehicle.name} sudah di-assign ke geofence ${otherGeofence?.name || 'lain'}`);
                            return;
                          }
                          setSelectedVehicles(prev => 
                            prev.includes(vehicle.vehicle_id)
                              ? prev.filter(id => id !== vehicle.vehicle_id)
                              : [...prev, vehicle.vehicle_id]
                          );
                        }}
                        disabled={isAssignedElsewhere}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{vehicle.name}</div>
                        <div className="text-xs text-gray-500">
                          {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                        {isAssignedElsewhere && (
                          <Badge variant="outline" className="mt-1 text-xs bg-yellow-100 text-yellow-800">
                            Di geofence: {otherGeofence?.name || 'lain'}
                          </Badge>
                        )}
                        {isAssignedToCurrentGeofence && (
                          <Badge className="mt-1 text-xs bg-green-100 text-green-800">
                            Sudah di-assign di sini
                          </Badge>
                        )}
                      </div>
                      {isAssignedToCurrentGeofence && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveVehicleAssignment(vehicle.vehicle_id, vehicle.name);
                          }}
                          title="Hapus assignment"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={saveVehicleAssignments} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}