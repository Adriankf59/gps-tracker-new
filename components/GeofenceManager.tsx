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
    status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200';

  const getRuleTypeColor = (ruleType: string) => {
    const colors = {
      FORBIDDEN: 'bg-rose-100 text-rose-800 border-rose-200',
      STAY_IN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      STANDARD: 'bg-teal-100 text-teal-800 border-teal-200'
    };
    return colors[ruleType as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-200';
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
      console.log(`🔄 Removing geofence ${geofenceId} from all assigned vehicles...`);
      
      // Find all vehicles assigned to this geofence
      const assignedVehicles = vehicles.filter(v => {
        // Handle both string and number comparison for geofence_id
        return v.geofence_id && (
          v.geofence_id.toString() === geofenceId.toString() ||
          parseInt(v.geofence_id.toString()) === geofenceId
        );
      });
      
      console.log(`📋 Found ${assignedVehicles.length} vehicles assigned to geofence ${geofenceId}:`, 
        assignedVehicles.map(v => `${v.name} (ID: ${v.vehicle_id})`));

      if (assignedVehicles.length === 0) {
        console.log('ℹ️ No vehicles assigned to this geofence');
        return true;
      }

      // Remove geofence assignment from each vehicle
      const unassignPromises = assignedVehicles.map(async (vehicle) => {
        console.log(`🔄 Removing geofence from vehicle: ${vehicle.name} (ID: ${vehicle.vehicle_id})`);
        const success = await updateVehicleGeofence(vehicle.vehicle_id, null);
        if (success) {
          console.log(`✅ Successfully removed geofence from ${vehicle.name}`);
        } else {
          console.error(`❌ Failed to remove geofence from ${vehicle.name}`);
        }
        return success;
      });

      const results = await Promise.all(unassignPromises);
      const successCount = results.filter(Boolean).length;
      
      console.log(`📊 Removed geofence from ${successCount}/${assignedVehicles.length} vehicles`);
      
      if (successCount === assignedVehicles.length) {
        toast.success(`Berhasil menghapus assignment dari ${successCount} kendaraan`);
        return true;
      } else {
        toast.warning(`Hanya berhasil menghapus assignment dari ${successCount}/${assignedVehicles.length} kendaraan`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error removing geofence from vehicles:', error);
      toast.error('Gagal menghapus assignment kendaraan');
      return false;
    }
  };

  const handleRemoveAllAssignments = async (geofence: Geofence) => {
    const assignedVehicles = vehicles.filter(v => 
      v.geofence_id && v.geofence_id.toString() === geofence.geofence_id.toString()
    );

    if (assignedVehicles.length === 0) {
      toast.info('Tidak ada kendaraan yang ter-assign ke geofence ini');
      return;
    }

    const vehicleNames = assignedVehicles.map(v => v.name).join(', ');
    
    if (!confirm(`Apakah Anda yakin ingin menghapus semua assignment kendaraan dari geofence "${geofence.name}"?\n\nKendaraan yang akan di-unassign: ${vehicleNames}`)) {
      return;
    }

    setLoading(true);
    try {
      const success = await removeGeofenceFromVehicles(geofence.geofence_id);
      
      if (success) {
        // Refresh vehicle data
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          await fetchVehicles(userId);
        }
        toast.success(`Berhasil menghapus semua assignment dari geofence "${geofence.name}"`);
      }
    } catch (error) {
      console.error('Error removing all assignments:', error);
      toast.error('Gagal menghapus assignment kendaraan');
    } finally {
      setLoading(false);
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

  const updateVehicleGeofence = async (vehicleId: string | number, geofenceId: string | number | null) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geofence_id: geofenceId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to update vehicle ${vehicleId}:`, errorData);
        throw new Error(`Failed to update vehicle: ${response.status}`);
      }
      
      console.log(`✅ Vehicle ${vehicleId} geofence updated to ${geofenceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating vehicle ${vehicleId}:`, error);
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
      .filter(v => v.geofence_id && (
        v.geofence_id.toString() === geofence.geofence_id.toString() ||
        parseInt(v.geofence_id.toString()) === geofence.geofence_id
      ))
      .map(v => v.vehicle_id.toString());
    setSelectedVehicles(assignedIds);
    setAssignDialogOpen(true);
  };

  const saveVehicleAssignments = async () => {
    if (!currentGeofence) return;

    setLoading(true);
    try {
      const geofenceIdStr = currentGeofence.geofence_id.toString();
      const currentlyAssigned = vehicles
        .filter(v => v.geofence_id && (
          v.geofence_id.toString() === geofenceIdStr ||
          parseInt(v.geofence_id.toString()) === currentGeofence.geofence_id
        ))
        .map(v => v.vehicle_id.toString());

      const toAdd = selectedVehicles.filter(id => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter(id => !selectedVehicles.includes(id));

      console.log('🔄 Vehicle assignment changes:', {
        geofenceId: currentGeofence.geofence_id,
        currentlyAssigned,
        selectedVehicles,
        toAdd,
        toRemove
      });

      const promises = [
        ...toAdd.map(id => updateVehicleGeofence(id, currentGeofence.geofence_id)),
        ...toRemove.map(id => updateVehicleGeofence(id, null))
      ];

      const results = await Promise.all(promises);
      
      if (results.every(Boolean)) {
        toast.success('Assignment berhasil diperbarui');
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
        setAssignDialogOpen(false);
        
        console.log('✅ All vehicle assignments updated successfully');
      } else {
        toast.error('Gagal memperbarui beberapa assignment');
        console.error('❌ Some vehicle assignments failed to update');
      }
    } catch (error) {
      console.error('❌ Error updating assignments:', error);
      toast.error('Gagal memperbarui assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVehicleAssignment = async (vehicleId: string | number, vehicleName: string) => {
    if (!confirm(`Apakah Anda yakin ingin melepas assignment kendaraan "${vehicleName}" dari geofence ini?`)) return;

    setLoading(true);
    try {
      console.log(`🔄 Removing assignment for vehicle: ${vehicleName} (ID: ${vehicleId})`);
      
      const success = await updateVehicleGeofence(vehicleId, null);
      
      if (success) {
        toast.success(`Assignment kendaraan "${vehicleName}" berhasil dihapus`);
        
        // Refresh vehicle data
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          await fetchVehicles(userId);
        }
        
        // Update selected vehicles in dialog if open
        setSelectedVehicles(prev => prev.filter(id => id !== vehicleId.toString()));
        
        console.log(`✅ Successfully removed assignment for ${vehicleName}`);
      } else {
        toast.error(`Gagal menghapus assignment kendaraan "${vehicleName}"`);
        console.error(`❌ Failed to remove assignment for ${vehicleName}`);
      }
    } catch (error) {
      console.error('❌ Error removing vehicle assignment:', error);
      toast.error('Gagal menghapus assignment kendaraan');
    } finally {
      setLoading(false);
    }
  };

  // Computed values
  const filteredGeofences = geofences.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validGeofences = useMemo(() => 
    geofences.filter(validateGeofence), [geofences]
  );

  // Get assigned vehicles count for each geofence
  const getAssignedVehiclesCount = (geofenceId: number) => {
    return vehicles.filter(v => 
      v.geofence_id && (
        v.geofence_id.toString() === geofenceId.toString() ||
        parseInt(v.geofence_id.toString()) === geofenceId
      )
    ).length;
  };

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
    <div className="p-6 max-w-full mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Manajemen Geofence
            </h1>
            <p className="text-slate-600">Kelola area geografis untuk monitoring kendaraan</p>
          </div>
        </div>
        
        {!isCreating && (
          <Button 
            onClick={handleStartCreating} 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Geofence
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <div className="lg:col-span-1 flex flex-col bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/20">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                placeholder="Cari geofence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 bg-white/70 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
              />
            </div>
          </div>

          {/* Create Form */}
          {isCreating && (
            <Card className="mb-4 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-t-lg">
                <CardTitle className="text-lg font-semibold">✨ Buat Geofence Baru</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Nama geofence"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                  className="border-blue-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                
                <Select
                  value={newGeofence.ruleType}
                  onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value})}
                >
                  <SelectTrigger className="border-blue-200 focus:ring-2 focus:ring-blue-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORBIDDEN">🚫 Terlarang</SelectItem>
                    <SelectItem value="STAY_IN">🏠 Tetap di Dalam</SelectItem>
                    <SelectItem value="STANDARD">📍 Standar</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    variant={newGeofence.type === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({...newGeofence, type: "polygon"})}
                    className={`flex-1 transition-all duration-200 ${
                      newGeofence.type === "polygon" 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
                        : 'border-blue-200 text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    <Square className="h-4 w-4 mr-2" /> Poligon
                  </Button>
                  <Button
                    variant={newGeofence.type === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({...newGeofence, type: "circle"})}
                    className={`flex-1 transition-all duration-200 ${
                      newGeofence.type === "circle" 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
                        : 'border-blue-200 text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    <CircleIcon className="h-4 w-4 mr-2" /> Lingkaran
                  </Button>
                </div>

                <div className="flex gap-2 pt-3 border-t border-blue-200">
                  <Button 
                    onClick={handleSaveGeofence} 
                    disabled={!newGeofence.name.trim() || drawnLayers.length === 0 || loading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelCreating} 
                    className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4 mr-2" /> Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Geofence List */}
          <div className="flex-1 overflow-auto space-y-2">
            {filteredGeofences.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <MapPin className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {searchTerm ? "Tidak ditemukan" : "Belum ada geofence"}
                  </h3>
                  <p className="text-slate-500 mb-4">
                    {searchTerm ? `Tidak ada geofence yang cocok dengan "${searchTerm}"` : "Mulai dengan membuat geofence baru"}
                  </p>
                  {!searchTerm && (
                    <Button 
                      onClick={handleStartCreating} 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
                    >
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
                  className={`cursor-pointer transition-all duration-300 ease-out hover:shadow-xl border rounded-xl overflow-hidden transform hover:scale-[1.02] ${
                    currentGeofence?.geofence_id === geofence.geofence_id
                      ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-lg'
                      : 'bg-white/80 backdrop-blur-sm border-slate-200 hover:border-blue-300 shadow-md'
                  }`}
                  onClick={() => {
                    setIsCreating(false);
                    setCurrentGeofence(geofence);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-800 truncate text-lg" title={geofence.name}>
                        {geofence.name}
                      </h3>
                      <Badge className={`${getStatusColor(geofence.status)} px-2 py-1 text-xs font-medium`}>
                        {geofence.status === 'active' ? '✅ Aktif' : '⏸️ Nonaktif'}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className={`${getRuleTypeColor(geofence.rule_type)} px-2 py-1 text-xs font-medium`}>
                        {geofence.rule_type === 'FORBIDDEN' && '🚫'} 
                        {geofence.rule_type === 'STAY_IN' && '🏠'} 
                        {geofence.rule_type === 'STANDARD' && '📍'} 
                        {formatRuleType(geofence.rule_type)}
                      </Badge>
                      <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white/70 px-2 py-1 text-xs">
                        {geofence.type === 'circle' ? '⭕ Lingkaran' : '⬜ Poligon'}
                      </Badge>
                      {getAssignedVehiclesCount(geofence.geofence_id) > 0 && (
                        <Badge className="bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-800 border-cyan-200 px-2 py-1 text-xs">
                          🚗 {getAssignedVehiclesCount(geofence.geofence_id)} kendaraan
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded px-2 py-1">
                      📅 {new Date(geofence.date_created).toLocaleDateString('id-ID', {
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
                        className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignVehicles(geofence);
                        }}
                      >
                        <Car className="h-4 w-4 mr-1" /> Assign
                      </Button>
                      
                      {getAssignedVehiclesCount(geofence.geofence_id) > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 hover:bg-orange-50 border-orange-200 hover:border-orange-300 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAllAssignments(geofence);
                          }}
                          title="Hapus semua assignment"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
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
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm">
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
                  const isAssignedToCurrentGeofence = vehicle.geofence_id && (
                    vehicle.geofence_id.toString() === currentGeofence?.geofence_id.toString() ||
                    parseInt(vehicle.geofence_id.toString()) === currentGeofence?.geofence_id
                  );
                  const isAssignedElsewhere = vehicle.geofence_id && !isAssignedToCurrentGeofence;
                  const otherGeofence = isAssignedElsewhere ? 
                    geofences.find(g => 
                      g.geofence_id.toString() === vehicle.geofence_id?.toString() ||
                      g.geofence_id === parseInt(vehicle.geofence_id?.toString() || '0')
                    ) : null;
                  
                  return (
                    <div 
                      key={vehicle.vehicle_id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border ${
                        selectedVehicles.includes(vehicle.vehicle_id.toString()) 
                          ? 'bg-blue-50 border-blue-400' 
                          : 'bg-gray-50 border-gray-200'
                      } ${isAssignedElsewhere ? 'opacity-60' : ''}`}
                    >
                      <Checkbox 
                        checked={selectedVehicles.includes(vehicle.vehicle_id.toString())}
                        onCheckedChange={() => {
                          if (isAssignedElsewhere) {
                            toast.error(`${vehicle.name} sudah di-assign ke geofence ${otherGeofence?.name || 'lain'}`);
                            return;
                          }
                          setSelectedVehicles(prev => 
                            prev.includes(vehicle.vehicle_id.toString())
                              ? prev.filter(id => id !== vehicle.vehicle_id.toString())
                              : [...prev, vehicle.vehicle_id.toString()]
                          );
                        }}
                        disabled={isAssignedElsewhere}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{vehicle.name}</div>
                        <div className="text-xs text-gray-500">
                          {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Vehicle ID: {vehicle.vehicle_id} | GPS ID: {vehicle.gps_id}
                        </div>
                        {isAssignedElsewhere && (
                          <Badge variant="outline" className="mt-1 text-xs bg-yellow-100 text-yellow-800">
                            Di geofence: {otherGeofence?.name || `ID ${vehicle.geofence_id}`}
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