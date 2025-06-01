"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Layer } from 'leaflet';
import type { Circle, Polygon, LatLng } from 'leaflet';

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
  loading: () => <div className="h-full flex items-center justify-center bg-gray-100">Memuat peta...</div>
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
  gps_id: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    ruleType: "FORBIDDEN" as "STANDARD" | "FORBIDDEN" | "STAY_IN",
    type: "polygon" as "polygon" | "circle"
  });
  const [drawnLayers, setDrawnLayers] = useState<Layer[]>([]);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  const validateGeofence = (geofence: Geofence): boolean => {
    if (!geofence.definition) return false;
    if (geofence.type === 'circle') {
      return !!(geofence.definition.center &&
        geofence.definition.center.length === 2 &&
        typeof geofence.definition.radius === 'number' && geofence.definition.radius > 0);
    }
    if (geofence.type === 'polygon') {
      return !!(geofence.definition.coordinates &&
        Array.isArray(geofence.definition.coordinates) &&
        geofence.definition.coordinates.length > 0 &&
        Array.isArray(geofence.definition.coordinates[0]) &&
        geofence.definition.coordinates[0].length >= 4 &&
        geofence.definition.coordinates[0].every(coordPair =>
          Array.isArray(coordPair) && coordPair.length === 2 &&
          typeof coordPair[0] === 'number' && typeof coordPair[1] === 'number'
        )
      );
    }
    return false;
  };

  const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
    if (!geofence || !validateGeofence(geofence)) return DEFAULT_CENTER;
    if (geofence.type === 'circle' && geofence.definition.center) {
      return [geofence.definition.center[1], geofence.definition.center[0]];
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

  const getStatusColor = (status: string) =>
    status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200';

  const getRuleTypeColor = (ruleType: string) => {
    const colors: Record<string, string> = {
      FORBIDDEN: 'bg-rose-100 text-rose-800 border-rose-200',
      STAY_IN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      STANDARD: 'bg-teal-100 text-teal-800 border-teal-200'
    };
    return colors[ruleType] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatRuleType = (ruleType: string) => {
    const formats: Record<string, string> = {
      FORBIDDEN: 'Terlarang',
      STAY_IN: 'Tetap di Dalam',
      STANDARD: 'Standar'
    };
    return formats[ruleType] || ruleType;
  };

  const fetchGeofences = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}&limit=-1`);
      if (!response.ok) throw new Error('Failed to fetch geofences');
      const result = await response.json();
      const fetchedGeofences = result.data || [];
      const parsedGeofences = fetchedGeofences.map((gf: any) => {
        if (typeof gf.definition === 'string') {
          try {
            return { ...gf, definition: JSON.parse(gf.definition) };
          } catch (e) {
            console.error(`Failed to parse definition for geofence ${gf.geofence_id}:`, gf.definition, e);
            return { ...gf, definition: {} };
          }
        }
        return gf;
      });
      const validGeofences = parsedGeofences.filter(validateGeofence);
      setGeofences(validGeofences);
      return validGeofences;
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error("Gagal memuat data geofence");
      setGeofences([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const removeGeofenceFromVehicles = async (geofenceId: number) => {
    try {
      const assignedVehicles = vehicles.filter(v =>
        v.geofence_id && (
          v.geofence_id.toString() === geofenceId.toString() ||
          parseInt(v.geofence_id.toString(), 10) === geofenceId
        )
      );
      if (assignedVehicles.length === 0) return true;
      const unassignPromises = assignedVehicles.map(vehicle => updateVehicleGeofence(vehicle.vehicle_id, null));
      const results = await Promise.all(unassignPromises);
      const successCount = results.filter(Boolean).length;
      if (successCount === assignedVehicles.length) {
        toast.success(`Berhasil menghapus assignment dari ${successCount} kendaraan`);
        return true;
      } else {
        toast.warning(`Hanya berhasil menghapus assignment dari ${successCount}/${assignedVehicles.length} kendaraan`);
        return false;
      }
    } catch (error) {
      console.error('Error removing geofence from vehicles:', error);
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
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
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
      const response = await fetch(`${VEHICLE_API_ENDPOINT}?filter[user_id][_eq]=${userId}&limit=-1`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      const result = await response.json();
      setVehicles(result.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Gagal memuat data kendaraan');
    }
  };

  const updateVehicleGeofence = async (vehicleId: string | number, geofenceId: string | number | null) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geofence_id: geofenceId === null ? null : Number(geofenceId) })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to update vehicle ${vehicleId}:`, errorData);
        throw new Error(`Failed to update vehicle: ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error(`Error updating vehicle ${vehicleId}:`, error);
      return false;
    }
  };

  useEffect(() => {
    const loadUserAndData = async () => {
      setLoading(true);
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          if (userId) {
            await Promise.all([fetchGeofences(userId), fetchVehicles(userId)]);
          } else {
            toast.error("User ID tidak ditemukan. Gagal memuat data.");
            setLoading(false);
          }
        } else {
          toast.error("Sesi pengguna tidak ditemukan. Harap login ulang.");
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading user and initial data:', error);
        toast.error("Terjadi kesalahan saat memuat data awal.");
        setLoading(false);
      }
    };
    loadUserAndData();
  }, []);

  useEffect(() => {
    if (!loading && geofences.length > 0 && !currentGeofence && !isCreating) {
      const firstValid = geofences.find(validateGeofence);
      if (firstValid) setCurrentGeofence(firstValid);
    }
  }, [geofences, currentGeofence, isCreating, loading]);

  const handleStartCreating = () => {
    setIsCreating(true);
    setCurrentGeofence(null);
    setDrawnLayers([]);
    setNewGeofence({ name: "", ruleType: "FORBIDDEN", type: "polygon" });
  };

  const handleCancelCreating = () => {
    setIsCreating(false);
    setDrawnLayers([]);
    if (validGeofences.length > 0) {
      setCurrentGeofence(validGeofences[0]);
    } else {
      setCurrentGeofence(null);
    }
  };

  const handleDrawCreated = (e: { layerType: string; layer: Layer }) => {
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
      let definitionData;
      let geofenceTypeForPayload: "circle" | "polygon" = newGeofence.type;

      if (typeof (layer as any).getRadius === 'function') {
        const circleLayer = layer as Circle;
        const center = circleLayer.getLatLng();
        const radius = circleLayer.getRadius();
        definitionData = { type: "Circle", center: [center.lng, center.lat], radius: radius };
        geofenceTypeForPayload = "circle";
      } else if (typeof (layer as any).getLatLngs === 'function') {
        const polygonLayer = layer as Polygon;
        const latlngsArray = polygonLayer.getLatLngs();
        
        let outerRing: LatLng[];

        if (Array.isArray(latlngsArray) && latlngsArray.length > 0) {
          if (Array.isArray(latlngsArray[0]) && (latlngsArray[0] as LatLng[])[0] instanceof Object && 'lat' in (latlngsArray[0] as LatLng[])[0]) {
            outerRing = latlngsArray[0] as LatLng[];
          } else if (latlngsArray[0] instanceof Object && 'lat' in latlngsArray[0]) {
            outerRing = latlngsArray as LatLng[];
          } else {
            toast.error("Format koordinat poligon tidak dikenali.");
            setLoading(false);
            return;
          }
        } else {
          toast.error("Koordinat poligon tidak valid.");
          setLoading(false);
          return;
        }
        
        const coordinates = outerRing.map(ll => [ll.lng, ll.lat]);
        if (coordinates.length > 0 && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
          coordinates.push([...coordinates[0]]);
        }
        definitionData = { type: "Polygon", coordinates: [coordinates] };
        geofenceTypeForPayload = "polygon";
      } else {
        toast.error("Tipe layer tidak dikenali untuk disimpan.");
        setLoading(false);
        return;
      }

      const payload = {
        user_id: userId,
        name: newGeofence.name,
        type: geofenceTypeForPayload,
        rule_type: newGeofence.ruleType,
        status: "active",
        definition: definitionData,
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
        const fetchedGeofencesList = await fetchGeofences(userId);
        const savedGeofenceResponse = await response.json();
        const newGeo = savedGeofenceResponse.data;

        if (newGeo && validateGeofence(newGeo)) {
            setCurrentGeofence(newGeo);
        } else if (fetchedGeofencesList && fetchedGeofencesList.length > 0) {
            setCurrentGeofence(fetchedGeofencesList[0]);
        } else {
            setCurrentGeofence(null);
        }
      } else {
        const errorData = await response.json();
        toast.error(`Gagal menyimpan geofence: ${errorData.errors?.[0]?.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast.error("Gagal menyimpan geofence. Lihat konsol untuk detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGeofence = async (geofenceId: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus geofence ini? Semua assignment kendaraan dari geofence ini akan dihapus.")) return;
    setLoading(true);
    try {
      await removeGeofenceFromVehicles(geofenceId);
      const response = await fetch(`${API_ENDPOINT}/${geofenceId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success("Geofence berhasil dihapus");
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          const updatedGeofences = await fetchGeofences(userId);
          await fetchVehicles(userId);
          if (currentGeofence?.geofence_id === geofenceId) {
            setCurrentGeofence(updatedGeofences && updatedGeofences.length > 0 ? updatedGeofences[0] : null);
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(`Gagal menghapus geofence: ${errorData.errors?.[0]?.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast.error("Gagal menghapus geofence. Lihat konsol untuk detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVehicles = (geofence: Geofence) => {
    setCurrentGeofence(geofence);
    const assignedIds = vehicles
      .filter(v => v.geofence_id && (
        v.geofence_id.toString() === geofence.geofence_id.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofence.geofence_id
      ))
      .map(v => v.vehicle_id.toString());
    setSelectedVehicles(assignedIds);
    setAssignDialogOpen(true);
  };

  const saveVehicleAssignments = async () => {
    if (!currentGeofence) return;
    setLoading(true);
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
      const results = await Promise.all(promises);
      if (results.every(Boolean)) {
        toast.success('Assignment kendaraan berhasil diperbarui');
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
        setAssignDialogOpen(false);
      } else {
        toast.error('Gagal memperbarui beberapa assignment kendaraan');
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
      }
    } catch (error) {
      console.error('Error updating assignments:', error);
      toast.error('Gagal memperbarui assignment kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVehicleAssignment = async (vehicleId: string | number, vehicleName: string) => {
    if (!confirm(`Apakah Anda yakin ingin melepas assignment kendaraan "${vehicleName}" dari geofence ini?`)) return;
    setLoading(true);
    try {
      const success = await updateVehicleGeofence(vehicleId, null);
      if (success) {
        toast.success(`Assignment kendaraan "${vehicleName}" berhasil dihapus`);
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) await fetchVehicles(userId);
        setSelectedVehicles(prev => prev.filter(id => id !== vehicleId.toString()));
      } else {
        toast.error(`Gagal menghapus assignment kendaraan "${vehicleName}"`);
      }
    } catch (error) {
      console.error('Error removing vehicle assignment:', error);
      toast.error('Gagal menghapus assignment kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const filteredGeofences = useMemo(() =>
    geofences.filter(g =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) && validateGeofence(g)
    ), [geofences, searchTerm]
  );

  const validGeofences = useMemo(() =>
    geofences.filter(validateGeofence), [geofences]
  );

  const getAssignedVehiclesCount = (geofenceId: number) => {
    return vehicles.filter(v =>
      v.geofence_id && (
        v.geofence_id.toString() === geofenceId.toString() ||
        parseInt(v.geofence_id.toString(), 10) === geofenceId
      )
    ).length;
  };

  if (loading && !currentUser && geofences.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-slate-700">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Manajemen Geofence
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">Kelola area geografis untuk monitoring kendaraan</p>
          </div>
        </div>
        {!isCreating && (
          <Button
            onClick={handleStartCreating}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Geofence
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="lg:col-span-1 flex flex-col bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/20">
          {!isCreating && (
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
          )}
          {isCreating && (
            <Card className="mb-4 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-t-lg">
                <CardTitle className="text-lg font-semibold">✨ Buat Geofence Baru</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Nama geofence"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                  className="border-blue-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <Select
                  value={newGeofence.ruleType}
                  onValueChange={(value) => setNewGeofence({ ...newGeofence, ruleType: value as "STANDARD" | "FORBIDDEN" | "STAY_IN" })}
                >
                  <SelectTrigger className="border-blue-200 focus:ring-2 focus:ring-blue-500/20">
                    <SelectValue placeholder="Pilih tipe aturan" />
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
                    onClick={() => setNewGeofence({ ...newGeofence, type: "polygon" })}
                    className={`flex-1 transition-all duration-200 ${newGeofence.type === "polygon"
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'border-blue-200 text-slate-700 hover:bg-blue-50'
                      }`}
                  >
                    <Square className="h-4 w-4 mr-2" /> Poligon
                  </Button>
                  <Button
                    variant={newGeofence.type === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewGeofence({ ...newGeofence, type: "circle" })}
                    className={`flex-1 transition-all duration-200 ${newGeofence.type === "circle"
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
          <div className="flex-1 overflow-auto space-y-2 pr-1">
            {loading && geofences.length === 0 && !isCreating ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p>Memuat geofence...</p>
              </div>
            ) : filteredGeofences.length === 0 && !isCreating ? (
              <Card className="border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <MapPin className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {searchTerm ? "Tidak ditemukan" : "Belum ada geofence"}
                  </h3>
                  <p className="text-slate-500 mb-4 text-sm">
                    {searchTerm ? `Tidak ada geofence yang cocok dengan "${searchTerm}"` : "Mulai dengan membuat geofence baru atau periksa koneksi Anda."}
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
                  className={`cursor-pointer transition-all duration-300 ease-out hover:shadow-xl border rounded-xl overflow-hidden transform hover:scale-[1.02] ${currentGeofence?.geofence_id === geofence.geofence_id
                      ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-lg'
                      : 'bg-white/80 backdrop-blur-sm border-slate-200 hover:border-blue-300 shadow-md'
                    }`}
                  onClick={() => {
                    if (validateGeofence(geofence)) {
                      setIsCreating(false);
                      setCurrentGeofence(geofence);
                    } else {
                      toast.error("Data geofence tidak valid untuk ditampilkan di peta.");
                    }
                  }}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <h3 className="font-semibold text-slate-800 truncate text-base sm:text-lg" title={geofence.name}>
                        {geofence.name}
                      </h3>
                      <Badge className={`${getStatusColor(geofence.status)} px-2 py-1 text-xs font-medium`}>
                        {geofence.status === 'active' ? '✅ Aktif' : '⏸️ Nonaktif'}
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
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                        onClick={(e) => { e.stopPropagation(); handleAssignVehicles(geofence); }}
                      >
                        <Car className="h-4 w-4 mr-1" /> Assign
                      </Button>
                      {getAssignedVehiclesCount(geofence.geofence_id) > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-orange-600 hover:bg-orange-50 border-orange-200 hover:border-orange-300 transition-all duration-200 p-2"
                          onClick={(e) => { e.stopPropagation(); handleRemoveAllAssignments(geofence); }}
                          title="Hapus semua assignment"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 p-2"
                        onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id); }}
                        title="Hapus geofence"
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

        <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm min-h-[300px] lg:min-h-0">
          <MapWithDrawing
            center={getGeofenceCenter(isCreating ? null : currentGeofence)}
            zoom={isCreating ? 5 : (currentGeofence ? 13 : 5)}
            drawMode={isCreating ? newGeofence.type : undefined}
            onDrawCreated={isCreating ? handleDrawCreated : undefined}
            onDrawDeleted={isCreating ? () => setDrawnLayers([]) : undefined}
            viewOnly={!isCreating}
            geofences={isCreating ? [] : (currentGeofence && validateGeofence(currentGeofence) ? [currentGeofence] : validGeofences.filter(gf => currentGeofence ? gf.geofence_id === currentGeofence.geofence_id : true))}
            selectedGeofence={isCreating || !currentGeofence || !validateGeofence(currentGeofence) ? null : currentGeofence}
            isCreating={isCreating}
            drawnLayersForEditing={isCreating ? drawnLayers : undefined}
          />
        </div>
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md fixed top-[50%] sm:top-[10%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 sm:translate-y-0 z-[50000] bg-white border shadow-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Car className="h-5 w-5 text-blue-600" />
              Assign Kendaraan ke "{currentGeofence?.name}"
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] sm:max-h-[300px] overflow-y-auto p-1 pr-2">
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Tidak ada kendaraan tersedia</p>
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
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${isChecked ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
                        } ${isAssignedElsewhere && !isChecked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'}`}
                      onClick={() => {
                        if (isAssignedElsewhere && !isChecked) {
                          toast.error(`${vehicle.name} sudah di-assign ke geofence ${otherGeofence?.name || 'lain'}. Lepas dulu assignment tersebut untuk memilih.`);
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
                        // PERBAIKAN DI SINI
                        disabled={Boolean(isAssignedElsewhere && !isChecked)}
                        className={isAssignedElsewhere && !isChecked ? "cursor-not-allowed" : ""}
                      />
                      <label htmlFor={`vehicle-${vehicle.vehicle_id}`} className="flex-1 cursor-pointer">
                        <div className="font-medium text-gray-800">{vehicle.name}</div>
                        <div className="text-xs text-gray-500">
                          {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Vehicle ID: {vehicle.vehicle_id} {vehicle.gps_id ? `| GPS ID: ${vehicle.gps_id}` : ''}
                        </div>
                        {isAssignedElsewhere && (
                          <Badge variant="outline" className="mt-1 text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                            Di geofence: {otherGeofence?.name || `ID ${vehicle.geofence_id}`}
                          </Badge>
                        )}
                      </label>
                      {isAssignedToThisGeofence && !isChecked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveVehicleAssignment(vehicle.vehicle_id, vehicle.name);
                          }}
                          title="Hapus assignment dari geofence ini"
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
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={saveVehicleAssignments}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Menyimpan...' : 'Simpan Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}