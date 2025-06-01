"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Search,
  Plus,
  MapPin,
  // Edit, // Tidak digunakan lagi jika tidak ada edit detail
  Trash2,
  // Eye, // Dihapus karena tombol lihat detail dihapus
  Circle,
  Square,
  Save,
  X,
  // Layers, // Tidak digunakan secara eksplisit di JSX ini
  List,
  Car
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamic import for the drawing map component
const MapWithDrawing = dynamic(() => import('./MapWithDrawing'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat peta...</p>
      </div>
    </div>
  )
});

interface Geofence {
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

// Interface GeofenceData mungkin tidak terlalu relevan jika tidak ada form edit detail
// interface GeofenceData { ... }

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  username?: string;
  full_name?: string;
}

interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  geofence_id: string | null; // Atau number jika ID geofence adalah number
  position?: [number, number];
}

const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';
const VEHICLE_API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';

export function GeofenceManager() {
  const [searchTerm, setSearchTerm] = useState("");
  // State untuk View Dialog dihapus
  // const [isViewDialogOpen, setIsViewDialogOpen] = useState(false); 
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    description: "", // Deskripsi bisa dihilangkan jika tidak ada lagi form detail
    ruleType: "FORBIDDEN",
    type: "polygon"
  });
  const [drawMode, setDrawMode] = useState<"polygon" | "circle">("polygon");
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false);
  // const [savedGeofenceForAssign, setSavedGeofenceForAssign] = useState<Geofence | null>(null); // Mungkin tidak perlu jika alur berubah

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [data-radix-popper-content-wrapper] { z-index: 50000 !important; }
      .leaflet-container { z-index: 1 !important; }
      [role="dialog"] { z-index: 50000 !important; }
      .fixed[role="dialog"] { z-index: 50000 !important; }
      [data-state="open"][data-overlay] { z-index: 49999 !important; }
      [data-radix-select-content] { z-index: 50001 !important; }
      [data-sonner-toaster] { z-index: 50002 !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 1024);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const validateGeofenceCoordinates = (geofence: Geofence): boolean => {
    try {
      if (!geofence.definition) { console.warn('Validasi: Geofence tanpa definisi.', geofence.name); return false; }
      if (geofence.type === 'circle') {
        if (!geofence.definition.center || geofence.definition.center.length < 2) return false;
        const [lng, lat] = geofence.definition.center;
        if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) return false;
        if (geofence.definition.radius === undefined || isNaN(geofence.definition.radius) || geofence.definition.radius <=0) return false;
        return true;
      }
      if (geofence.type === 'polygon') {
        if (!geofence.definition.coordinates || !geofence.definition.coordinates[0] || geofence.definition.coordinates[0].length < 3) return false;
        for (const point of geofence.definition.coordinates[0]) {
            if (!point || point.length < 2 || isNaN(point[0]) || isNaN(point[1]) || !isFinite(point[0]) || !isFinite(point[1])) return false;
        }
        return true;
      }
      return false;
    } catch (error) { console.error('Error validasi koordinat:', error, geofence); return false; }
  };

  // Fungsi validatePolygonCoords tidak diperlukan lagi jika validasi disederhanakan di atas
  // const validatePolygonCoords = (coordinates: number[][][] | undefined): boolean => { ... };

  const zoomToGeofence = (geofence: Geofence | null) => {
    if (!geofence) { console.log('Tidak bisa zoom: geofence tidak disediakan'); return; }
    if (!validateGeofenceCoordinates(geofence)) {
        toast.error(`Data geofence "${geofence.name}" tidak valid untuk ditampilkan di peta.`);
        setCurrentGeofence(null); // Jangan tampilkan geofence tidak valid
        setMapKey(prev => prev + 1); // Refresh peta ke view default mungkin
        return;
    }
    console.log('Zoom ke geofence:', geofence.name);
    setCurrentGeofence(geofence);
    setIsCreatingGeofence(false);
    setMapKey(prev => prev + 1);
    if (isMobile && activeTab !== "map") setActiveTab("map"); // Pindah ke tab peta di mobile
  };

  useEffect(() => {
    if (mapReady && currentGeofence) console.log('Peta siap dengan geofence saat ini:', currentGeofence.name);
  }, [mapReady, currentGeofence]);

  const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
    if (!geofence || !geofence.definition) return DEFAULT_CENTER;
    if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.center.length === 2) {
      return geofence.definition.center as [number, number];
    } else if (geofence.type === 'polygon' && geofence.definition.coordinates && geofence.definition.coordinates[0]?.length > 0) {
      const coords = geofence.definition.coordinates[0];
      if (coords.length === 0) return DEFAULT_CENTER;
      const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
      const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
      return [sumLat / coords.length, sumLng / coords.length]; // Ini adalah centroid kasar
    }
    return DEFAULT_CENTER;
  };
  
  const prepareGeofenceForMap = (geofence: Geofence | null) => {
    if (!geofence || !validateGeofenceCoordinates(geofence)) return null;
    // Fungsi ini sekarang lebih sederhana karena MapWithDrawing akan menerima Geofence[]
    // dan selectedGeofence adalah salah satu dari array tersebut.
    return geofence; 
  };

  const mapGeofences = useMemo(() => {
    return geofences.filter(validateGeofenceCoordinates); // Hanya geofence valid yang disiapkan
  }, [geofences]);

  const currentMapGeofence = useMemo(() => {
    if (!currentGeofence || !validateGeofenceCoordinates(currentGeofence)) return null;
    return currentGeofence; // Langsung gunakan currentGeofence jika valid
  }, [currentGeofence]);

  useEffect(() => {
    const loadUserAndData = async () => {
      console.log('GeofenceManager: Komponen dimuat');
      setLoading(true);
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const id = user.id || user.user_id;
          if (id) {
            await fetchGeofences(id); // Tunggu geofence dimuat
            await fetchVehicles(id);
          } else {
            console.log('GeofenceManager: User ID tidak ditemukan.');
            setError("User tidak teridentifikasi.");
          }
        } else {
          console.log('GeofenceManager: User tidak ditemukan di session storage.');
          setError("Sesi pengguna tidak ditemukan.");
        }
      } catch (error) {
        console.error('GeofenceManager: Error memuat data user:', error);
        setError("Gagal memuat data pengguna.");
      } finally {
        setLoading(false);
      }
    };
    loadUserAndData();
    const timer = setTimeout(() => setMapReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const fetchGeofences = async (userId: string): Promise<Geofence[]> => {
    // setLoading(true) tidak perlu di sini jika sudah di loadUserAndData
    try {
      console.log('Memuat geofence untuk user:', userId);
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const fetchedData = (result.data || []) as Geofence[];
        const validGeofences = fetchedData.filter(geo => {
            const isValid = validateGeofenceCoordinates(geo);
            if(!isValid) console.warn(`Geofence tidak valid dilewati: ${geo.name}`, geo.definition);
            return isValid;
        });
        setGeofences(validGeofences);
        return validGeofences;
      } else {
        console.error('Gagal memuat geofences:', response.statusText);
        toast.error("Gagal memuat data geofence"); return [];
      }
    } catch (error) {
      console.error('Error memuat geofences:', error);
      toast.error("Terjadi kesalahan saat memuat geofence"); return [];
    }
    // setLoading(false) tidak perlu di sini
  };

  const fetchVehicles = async (userId: string) => {
    try {
      console.log('Memuat kendaraan untuk user:', userId);
      const response = await fetch(`${VEHICLE_API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (!response.ok) throw new Error('Gagal mengambil kendaraan');
      const result = await response.json();
      setVehicles(result.data || []);
    } catch (error) {
      console.error('Error memuat kendaraan:', error);
      toast.error('Gagal memuat data kendaraan');
    }
  };
  
  useEffect(() => { // Auto-select first geofence
    if (geofences.length > 0 && !currentGeofence && !isCreatingGeofence && mapReady) {
      const firstValidGeofence = geofences.find(validateGeofenceCoordinates);
      if (firstValidGeofence) {
        console.log('Auto-select geofence pertama yang valid:', firstValidGeofence.name);
        // setCurrentGeofence(firstValidGeofence); // zoomToGeofence akan melakukannya
        zoomToGeofence(firstValidGeofence);
      } else {
        console.warn('Tidak ada geofence valid untuk auto-select.');
      }
    }
  }, [geofences, currentGeofence, isCreatingGeofence, mapReady]);


  const handleAssignGeofence = (geofence: Geofence) => {
    if (!validateGeofenceCoordinates(geofence)) {
        toast.error("Tidak dapat assign: data geofence tidak valid.");
        return;
    }
    setCurrentGeofence(geofence);
    const assignedVehicleIds = vehicles
      .filter(v => v.geofence_id === geofence.geofence_id.toString())
      .map(v => v.vehicle_id);
    setSelectedVehicles(assignedVehicleIds);
    setAssignDialogOpen(true);
  };
  
  const handleVehicleSelectionChange = (vehicleId: string) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicleId) ? prev.filter(id => id !== vehicleId) : [...prev, vehicleId]
    );
  };
  
  const updateVehicleGeofence = async (vehicleId: string, geofenceId: string | number | null) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geofence_id: geofenceId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Gagal update kendaraan ${vehicleId}:`, errorData);
        throw new Error(`Gagal update kendaraan ${vehicleId}`);
      }
      return true;
    } catch (error) { console.error(`Error update kendaraan ${vehicleId}:`, error); return false; }
  };

  const assignGeofenceToVehicles = async () => {
    if (!currentGeofence) { toast.error("Tidak ada geofence dipilih."); return; }
    setLoading(true);
    try {
      const geofenceIdToAssign = currentGeofence.geofence_id.toString();
      const initiallyAssigned = vehicles.filter(v => v.geofence_id === geofenceIdToAssign).map(v => v.vehicle_id);
      const vehiclesToAdd = selectedVehicles.filter(vId => !initiallyAssigned.includes(vId));
      const vehiclesToRemove = initiallyAssigned.filter(vId => !selectedVehicles.includes(vId));
      
      const promises = [
        ...vehiclesToAdd.map(vId => updateVehicleGeofence(vId, geofenceIdToAssign)),
        ...vehiclesToRemove.map(vId => updateVehicleGeofence(vId, null))
      ];
      const results = await Promise.all(promises);
      
      if (results.some(r => !r)) toast.error('Gagal memperbarui beberapa assignment.');
      else toast.success('Assignment kendaraan berhasil diperbarui.');
      
      if (currentUser?.id || currentUser?.user_id) await fetchVehicles(currentUser.id || currentUser.user_id);
      setAssignDialogOpen(false);
    } catch (error) {
      console.error('Error update assignment kendaraan:', error);
      toast.error('Gagal memperbarui assignment kendaraan.');
    } finally { setLoading(false); }
  };

  const filteredGeofences = useMemo(() => {
    return geofences.filter(geofence =>
      geofence.name.toLowerCase().includes(searchTerm.toLowerCase()) && validateGeofenceCoordinates(geofence)
    );
  }, [geofences, searchTerm]);

  const getStatusColor = (status: string) => status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200';
  const getRuleTypeColor = (ruleType: string) => { /* ... (implementasi sama) ... */ };
  const formatRuleType = (ruleType: string) => { /* ... (implementasi sama) ... */ };


  const handleStartCreatingGeofence = () => {
    setDrawnLayers([]); setCurrentGeofence(null);
    setNewGeofence({ name: "", description: "", ruleType: "FORBIDDEN", type: "polygon" });
    setDrawMode("polygon"); setIsCreatingGeofence(true);
    setMapKey(prev => prev + 1);
    if (isMobile) setActiveTab("map");
  };

  const handleCancelCreatingGeofence = () => {
    setIsCreatingGeofence(false); setDrawnLayers([]);
    if (geofences.length > 0) {
        const firstValid = geofences.find(validateGeofenceCoordinates);
        if (firstValid) zoomToGeofence(firstValid);
        else { setCurrentGeofence(null); setMapKey(prev => prev + 1); }
    } else { setCurrentGeofence(null); setMapKey(prev => prev + 1); }
  };
  
  // Fungsi handleViewGeofence dihapus

  const handleDrawModeChange = (mode: "polygon" | "circle") => { /* ... (implementasi sama) ... */ };
  const handleDrawCreated = (e: any) => { /* ... (implementasi sama) ... */ };
  const handleDrawEdited = (e: any) => { /* ... (implementasi sama) ... */ };
  const handleDrawDeleted = (e: any) => { /* ... (implementasi sama) ... */ };

  const handleSaveGeofence = async () => { /* ... (implementasi sama, pastikan validasi data sebelum POST) ... */ };

  const handleDeleteGeofence = async (geofenceId: number) => { /* ... (implementasi sama) ... */ };


  if (loading && !currentUser && geofences.length === 0) { // Kondisi loading awal yang lebih spesifik
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <p className="text-xl text-gray-700 font-semibold">Memuat data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Terjadi Kesalahan</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <Button onClick={() => {setError(null); if(currentUser?.id || currentUser?.user_id) fetchGeofences(currentUser.id || currentUser.user_id)}} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Geofence</h1>
            <p className="text-sm text-gray-600">Kelola area geografis untuk monitoring kendaraan.</p>
          </div>
        </div>
        {(!isCreatingGeofence && mapReady) && ( // Tampilkan jika tidak sedang membuat & map siap
          <Button 
            onClick={handleStartCreatingGeofence}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-md transition-all w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Geofence Baru
          </Button>
        )}
      </div>

      {isMobile ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sticky top-0 bg-gray-50 z-10 shadow-sm">
                <TabsTrigger value="list" className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm py-2.5">
                    <List className="h-5 w-5" /> Daftar
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm py-2.5">
                    <MapPin className="h-5 w-5" /> Peta & Buat Baru
                </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-2">
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <Input placeholder="Cari nama geofence..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 py-2.5 text-base"/>
                    </div>
                </div>
                {loading && geofences.length === 0 && (<div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div><p className="text-gray-600">Memuat geofence...</p></div>)}
                {!loading && filteredGeofences.length === 0 && (
                    <Card className="shadow-sm"><CardContent className="p-6 text-center"><MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-semibold text-gray-700 mb-2">{searchTerm ? "Geofence tidak ditemukan" : "Belum ada geofence"}</h3><p className="text-gray-500 mb-6">{searchTerm ? `Tidak ada geofence cocok "${searchTerm}".` : "Buat geofence pertama Anda di tab Peta."}</p>{!searchTerm && (<Button onClick={() => { handleStartCreatingGeofence(); setActiveTab("map"); }} className="bg-green-500 hover:bg-green-600"><Plus className="h-5 w-5 mr-2" />Buat Geofence</Button>)}</CardContent></Card>
                )}
                <div className="space-y-3">
                    {filteredGeofences.map((geofence) => (
                        <Card key={geofence.geofence_id} className={`hover:shadow-lg tc border rounded-lg overflow-hidden ${currentGeofence?.geofence_id === geofence.geofence_id ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`} onClick={() => zoomToGeofence(geofence)}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2"><div className="flex-1 min-w-0"><h3 className="font-semibold text-gray-800 text-lg truncate" title={geofence.name}>{geofence.name}</h3></div><Badge className={`${getStatusColor(geofence.status)} ml-2 text-xs px-1.5 py-0.5`}>{geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></div>
                            <div className="flex flex-wrap gap-2 mb-3"><Badge className={`${getRuleTypeColor(geofence.rule_type)} text-xs px-1.5 py-0.5`}>{formatRuleType(geofence.rule_type)}</Badge><Badge variant="outline" className="text-xs px-1.5 py-0.5 border-gray-300 text-gray-600">{geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}</Badge></div>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-3"><span>Dibuat: {new Date(geofence.date_created).toLocaleDateString('id-ID')}</span><span>ID: {geofence.geofence_id}</span></div>
                            <div className="flex gap-2 mt-2">
                                {/* Tombol Lihat Detail Dihapus */}
                                <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleAssignGeofence(geofence);}} title="Assign kendaraan"><Car className="h-4 w-4 mr-1.5" /> Assign</Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={(e) => {e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id);}}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </CardContent>
                        </Card>
                    ))}
                </div>
            </TabsContent>
            <TabsContent value="map" className="mt-1">
                {/* Konten Tab Peta (sama seperti sebelumnya) */}
                 <Card className="shadow-md">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MapPin className="h-5 w-5 text-blue-600" />
                            {isCreatingGeofence ? 'Gambar Geofence Baru di Peta' : (currentGeofence ? `Peta: ${currentGeofence.name}` : 'Peta Geofence')}
                        </CardTitle>
                         {!isCreatingGeofence && (
                            <Button onClick={handleStartCreatingGeofence} size="sm" className="mt-2 w-full bg-green-500 hover:bg-green-600" disabled={!mapReady}>
                                <Plus className="h-4 w-4 mr-2" /> Buat Geofence Baru di Peta Ini
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4">
                        {isCreatingGeofence && (
                            <div className="mb-4 space-y-3 p-3 bg-gray-50 rounded-lg border">
                                {/* Form Buat Geofence */}
                            </div>
                        )}
                        <div className={`h-80 sm:h-96 border rounded-lg overflow-hidden shadow-inner ${isCreatingGeofence ? 'ring-2 ring-blue-500' : ''}`}>
                            {!mapReady && (<div className="h-full fic jic bg-gray-100"><div className="tc"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div><p>Memuat peta...</p></div></div>)}
                            {mapReady && (
                                <MapWithDrawing
                                    key={`mobile-map-${mapKey}-${currentGeofence?.geofence_id || 'new'}-${isCreatingGeofence}`}
                                    center={getGeofenceCenter(isCreatingGeofence ? null : currentGeofence)}
                                    zoom={isCreatingGeofence ? 5 : (currentGeofence ? 13 : 5)}
                                    drawMode={isCreatingGeofence ? drawMode : undefined}
                                    onDrawCreated={isCreatingGeofence ? handleDrawCreated : undefined}
                                    onDrawEdited={isCreatingGeofence ? handleDrawEdited : undefined}
                                    onDrawDeleted={isCreatingGeofence ? handleDrawDeleted : undefined}
                                    viewOnly={!isCreatingGeofence}
                                    geofences={isCreatingGeofence ? [] : (currentGeofence ? [currentMapGeofence].filter(Boolean) as ProjectGeofence[] : mapGeofences as ProjectGeofence[])}
                                    selectedGeofence={isCreatingGeofence ? null : currentMapGeofence}
                                    isCreating={isCreatingGeofence}
                                    drawnLayersForEditing={isCreatingGeofence ? drawnLayers : undefined}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] xl:h-[calc(100vh-160px)]">
          <div className="lg:col-span-1 flex flex-col bg-white p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input placeholder="Cari nama geofence..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-2.5 text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"/>
              </div>
            </div>
            {isCreatingGeofence && ( /* Form Buat Geofence untuk Desktop */ )}
            {loading && geofences.length === 0 && !isCreatingGeofence && (<div className="flex-1 fic jic"><div className="tc py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div><p>Memuat...</p></div></div>)}
            {!loading && filteredGeofences.length === 0 && !isCreatingGeofence && ( /* Pesan Belum Ada Geofence */ )}
            {filteredGeofences.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredGeofences.map((geofence) => (
                  <Card key={geofence.geofence_id} className={`cursor-pointer t-all dur-150 ease-in-out hover:shadow-md border rounded-lg overflow-hidden ${currentGeofence?.geofence_id === geofence.geofence_id ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-400 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300'}`} onClick={() => zoomToGeofence(geofence)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-1.5"><div className="flex-1 min-w-0"><h3 className="font-semibold text-gray-800 text-sm truncate" title={geofence.name}>{geofence.name}</h3></div><Badge className={`${getStatusColor(geofence.status)} ml-2 text-xs px-1.5 py-0.5`}>{geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></div>
                      <div className="flex flex-wrap gap-1 mb-2"><Badge className={`${getRuleTypeColor(geofence.rule_type)} text-xs px-1.5 py-0.5`}>{formatRuleType(geofence.rule_type)}</Badge><Badge variant="outline" className="text-xs px-1.5 py-0.5 border-gray-300 text-gray-600">{geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}</Badge></div>
                       <p className="text-xs text-gray-500 mb-2">Dibuat: {new Date(geofence.date_created).toLocaleDateString('id-ID')}</p>
                      <div className="flex gap-1.5 items-center justify-end">
                        {/* Tombol Lihat Detail Dihapus */}
                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleAssignGeofence(geofence); }} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-gray-300 h-7 w-7" title="Assign Kendaraan"><Car className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id); }} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-300 h-7 w-7" title="Hapus Geofence"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            )}
          </div>
          <div className={`lg:col-span-2 h-full min-h-[400px] border rounded-xl overflow-hidden shadow-xl ${isCreatingGeofence ? 'ring-2 ring-offset-2 ring-blue-500' : 'border-gray-200'}`}>
             {!mapReady && (<div className="h-full fic jic bg-gray-100 rounded-xl"><div className="tc"><div className="animate-spin rounded-full h-10 w-10 border-b-2 brc-blue-600 mx-auto mb-5"></div><p>Memuat Peta...</p></div></div>)}
            {mapReady && (
              <MapWithDrawing
                key={`desktop-map-${mapKey}-${currentGeofence?.geofence_id || 'new'}-${isCreatingGeofence}`}
                center={getGeofenceCenter(isCreatingGeofence && !currentGeofence ? null : currentGeofence)}
                zoom={isCreatingGeofence && !currentGeofence ? 5 : (currentGeofence ? 13 : 5)}
                drawMode={isCreatingGeofence ? drawMode : undefined}
                onDrawCreated={isCreatingGeofence ? handleDrawCreated : undefined}
                onDrawEdited={isCreatingGeofence ? handleDrawEdited : undefined}
                onDrawDeleted={isCreatingGeofence ? handleDrawDeleted : undefined}
                viewOnly={!isCreatingGeofence}
                geofences={isCreatingGeofence ? [] : (currentGeofence ? [currentMapGeofence].filter(Boolean) as ProjectGeofence[] : mapGeofences as ProjectGeofence[])}
                selectedGeofence={isCreatingGeofence ? null : currentMapGeofence}
                isCreating={isCreatingGeofence}
                drawnLayersForEditing={isCreatingGeofence ? drawnLayers : undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* Dialog View Geofence Dihapus Sepenuhnya */}
      
      {/* Vehicle Assignment Dialog (tetap ada) */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        {/* ... (Konten Dialog Assignment Kendaraan tetap sama) ... */}
         <DialogContent className="sm:max-w-md fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[50000] bg-white border shadow-2xl rounded-lg p-0">
            <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Car className="h-5 w-5 text-blue-600" />
                Assign Kendaraan ke "{currentGeofence?.name}"
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
                Pilih kendaraan yang akan dipantau dalam geofence ini. Kendaraan hanya bisa terhubung ke satu geofence.
            </DialogDescription>
            </DialogHeader>
            <div className="p-5">
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {loading && vehicles.length === 0 && (<div className="text-center py-8 text-gray-500"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div><p>Memuat...</p></div>)}
                {!loading && vehicles.length === 0 ? ( <div className="text-center py-8 text-gray-500"> <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" /> <p className="font-medium">Tidak ada kendaraan</p> </div> ) : (
                <div className="space-y-2.5">
                    {vehicles.map((vehicle) => { /* ... (render vehicle item) ... */ })}
                </div>
                )}
            </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-lg">
                {/* ... (Konten Footer Dialog) ... */}
            </DialogFooter>
        </DialogContent>
        </Dialog>
    </div>
  );
}