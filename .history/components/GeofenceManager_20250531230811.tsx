"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Trash2,
  Circle,
  Square,
  Save,
  X,
  List,
  Car,
  AlertCircle // Untuk pesan error
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter, 
    DialogDescription, 
    DialogClose 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamic import for the drawing map component
const MapWithDrawing = dynamic(() => import('./MapWithDrawing'), { // Pastikan path ini benar
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
    center?: [number, number]; // Diperbarui menjadi tuple [number, number]
    radius?: number;
    type: string; // Misal "Polygon" atau "Circle"
  };
  date_created: string;
}

// Interface ini mungkin akan digunakan saat menyimpan/membuat geofence baru
interface GeofenceDataPayload {
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: Geofence['rule_type'];
  status: "active" | "inactive";
  date_created: string;
  definition: {
    type: "Polygon" | "Circle"; // Sesuai GeoJSON atau spesifikasi Anda
    coordinates?: number[][][]; // Untuk Polygon
    center?: [number, number];   // Untuk Circle [lng, lat]
    radius?: number;            // Untuk Circle
  };
}


interface User {
  id: string;
  user_id: string; // Atau salah satu dari ini adalah ID utama
  name: string;
  email: string;
  username?: string;
  full_name?: string;
}

interface Vehicle {
  vehicle_id: string; // Atau number, sesuaikan dengan API Anda
  user_id: string;
  gps_id: string;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  geofence_id: string | number | null; // Bisa string atau number
  position?: [number, number];
}

const DEFAULT_CENTER: [number, number] = [-2.5, 118.0]; // Indonesia
const API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';
const VEHICLE_API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';

export function GeofenceManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [mapKey, setMapKey] = useState(Date.now()); // Key unik untuk re-render peta
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    // description: "", // Deskripsi bisa ditambahkan jika field ada di backend
    ruleType: "STANDARD" as Geofence['rule_type'],
    type: "polygon" as "circle" | "polygon",
  });
  const [drawMode, setDrawMode] = useState<"polygon" | "circle">("polygon");
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]); // Untuk menyimpan layer yang digambar
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]); // Menyimpan vehicle_id
  const [assignDialogOpen, setAssignDialogOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(true); // Loading utama untuk data awal
  const [isSubmitting, setIsSubmitting] = useState(false); // Untuk proses simpan/update
  const [mapReady, setMapReady] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [data-radix-popper-content-wrapper] { z-index: 50000 !important; }
      .leaflet-container { z-index: 1 !important; } /* Pastikan peta di bawah dialog */
      [role="dialog"] { z-index: 50000 !important; }
      .fixed[role="dialog"] { z-index: 50000 !important; }
      [data-state="open"][data-overlay] { z-index: 49999 !important; }
      [data-radix-select-content] { z-index: 50001 !important; }
      [data-sonner-toaster] { z-index: 60000 !important; } /* Sonner di atas segalanya */
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 1024);
    if (typeof window !== "undefined") {
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }
  }, []);

  const validateGeofenceCoordinates = (geofence: Geofence): boolean => {
    // ... implementasi validateGeofenceCoordinates yang sudah ada ...
    // (Sama seperti yang Anda berikan sebelumnya, pastikan valid)
    try {
        if (!geofence.definition) { console.warn('Validasi: Geofence tanpa definisi.', geofence.name); return false; }
        if (geofence.type === 'circle') {
          if (!geofence.definition.center || geofence.definition.center.length < 2) { console.warn('Validasi: Pusat lingkaran tidak valid.', geofence.name); return false; }
          const [lng, lat] = geofence.definition.center;
          if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) { console.warn('Validasi: Koordinat pusat lingkaran tidak valid.', geofence.name); return false; }
          if (geofence.definition.radius === undefined || isNaN(geofence.definition.radius) || geofence.definition.radius <= 0) { console.warn('Validasi: Radius lingkaran tidak valid.', geofence.name); return false; }
          return true;
        }
        if (geofence.type === 'polygon') {
          if (!geofence.definition.coordinates || !geofence.definition.coordinates[0] || geofence.definition.coordinates[0].length < 3) { console.warn('Validasi: Koordinat poligon tidak cukup (minimal 3 titik).', geofence.name); return false; }
          for (const point of geofence.definition.coordinates[0]) {
              if (!point || point.length < 2 || isNaN(point[0]) || isNaN(point[1]) || !isFinite(point[0]) || !isFinite(point[1])) { console.warn('Validasi: Titik koordinat poligon tidak valid.', geofence.name, point); return false; }
          }
          return true;
        }
        console.warn('Validasi: Tipe geofence tidak diketahui.', geofence.name, geofence.type);
        return false;
      } catch (error) { console.error('Error validasi koordinat geofence:', error, geofence); return false; }
  };


  const zoomToGeofence = (geofence: Geofence | null) => {
    if (!geofence) { console.log('Tidak bisa zoom: geofence tidak disediakan'); return; }
    if (!validateGeofenceCoordinates(geofence)) {
        toast.error(`Data geofence "${geofence.name}" tidak valid untuk ditampilkan di peta.`);
        // setCurrentGeofence(null); // Jangan set jika tidak valid
        // setMapKey(Date.now()); 
        return;
    }
    console.log('Zoom ke geofence:', geofence.name);
    setCurrentGeofence(geofence);
    setIsCreatingGeofence(false);
    setMapKey(Date.now()); // Gunakan Date.now() untuk key yang selalu unik
    if (isMobile && activeTab !== "map") setActiveTab("map");
  };

  useEffect(() => {
    if (mapReady && currentGeofence) console.log('Peta siap dengan geofence:', currentGeofence.name);
  }, [mapReady, currentGeofence]);

  const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
    // ... (implementasi sama seperti sebelumnya, pastikan return [lng, lat] atau [lat, lng] konsisten dengan peta)
    // MapWithDrawing mungkin mengharapkan [lat, lng] untuk center prop
    if (!geofence || !geofence.definition) return [DEFAULT_CENTER[0], DEFAULT_CENTER[1]]; // Default ke [lat, lng]
    if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.center.length === 2) {
      // Asumsi center di DB adalah [lng, lat], Leaflet butuh [lat, lng]
      return [geofence.definition.center[1], geofence.definition.center[0]]; 
    } else if (geofence.type === 'polygon' && geofence.definition.coordinates && geofence.definition.coordinates[0]?.length > 0) {
      const coords = geofence.definition.coordinates[0]; // array of [lng, lat]
      if (coords.length === 0) return [DEFAULT_CENTER[0], DEFAULT_CENTER[1]];
      const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
      const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
      // Kembalikan centroid sebagai [lat, lng]
      return [sumLat / coords.length, sumLng / coords.length];
    }
    return [DEFAULT_CENTER[0], DEFAULT_CENTER[1]];
  };
  
  // mapGeofences sekarang adalah array Geofence yang sudah divalidasi
  const mapGeofences = useMemo(() => {
    return geofences.filter(validateGeofenceCoordinates);
  }, [geofences]);

  // currentMapGeofence adalah objek Geofence tunggal yang valid, atau null
  const currentMapGeofence = useMemo(() => {
    if (!currentGeofence || !validateGeofenceCoordinates(currentGeofence)) return null;
    return currentGeofence;
  }, [currentGeofence]);

  useEffect(() => {
    const loadInitialData = async () => {
      console.log('GeofenceManager: Memuat data awal...');
      setLoading(true);
      setError(null);
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson) as User;
          setCurrentUser(user);
          const idForApi = user.id || user.user_id; // Konsistensi ID pengguna
          if (idForApi) {
            await fetchGeofences(idForApi); 
            await fetchVehicles(idForApi);
          } else {
            console.error('GeofenceManager: User ID tidak ditemukan di objek user.');
            setError("User ID tidak valid.");
          }
        } else {
          console.log('GeofenceManager: Pengguna tidak ditemukan di session storage.');
          setError("Sesi pengguna tidak ditemukan. Silakan login kembali.");
        }
      } catch (e) {
        console.error('GeofenceManager: Error saat memuat data awal:', e);
        setError("Gagal memuat data awal.");
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
    const mapTimer = setTimeout(() => setMapReady(true), 1200); // Sedikit lebih lama untuk map
    return () => clearTimeout(mapTimer);
  }, []);

  const fetchGeofences = async (userId: string): Promise<void> => {
    // setLoading(true) sudah dihandle di loadInitialData
    try {
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}&sort=-date_created`);
      if (response.ok) {
        const result = await response.json();
        const fetchedData = (result.data || []) as Geofence[];
        const validGeofences = fetchedData.filter(validateGeofenceCoordinates);
        setGeofences(validGeofences);
        // Auto-select geofence pertama setelah fetch jika belum ada yang dipilih
        if (validGeofences.length > 0 && !currentGeofence && !isCreatingGeofence) {
            // zoomToGeofence(validGeofences[0]); // Akan ditangani oleh useEffect auto-select
        } else if (validGeofences.length === 0 && !isCreatingGeofence) {
            setCurrentGeofence(null); // Jika tidak ada geofence, bersihkan pilihan
        }
      } else {
        toast.error("Gagal memuat data geofence.");
        console.error('Gagal memuat geofences:', response.statusText);
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat memuat geofence.");
      console.error('Error memuat geofences:', error);
    }
    // setLoading(false) sudah dihandle di loadInitialData
  };

  useEffect(() => { // Auto-select first valid geofence
    if (geofences.length > 0 && !currentGeofence && !isCreatingGeofence && mapReady) {
      const firstValid = geofences[0]; // geofences sudah difilter yang valid saat fetch
      if (firstValid) {
        console.log('Auto-select geofence pertama:', firstValid.name);
        zoomToGeofence(firstValid);
      }
    }
  }, [geofences, currentGeofence, isCreatingGeofence, mapReady]);


  const fetchVehicles = async (userId: string) => { /* ... (implementasi sama) ... */ };
  const handleAssignGeofence = (geofence: Geofence) => { /* ... (implementasi sama) ... */ };
  const handleVehicleSelectionChange = (vehicleId: string) => { /* ... (implementasi sama) ... */ };
  const updateVehicleGeofence = async (vehicleId: string, geofenceId: string | number | null) => { /* ... (implementasi sama) ... */ };
  const assignGeofenceToVehicles = async () => { /* ... (implementasi sama) ... */ };
  
  const filteredGeofences = useMemo(() => {
    return geofences.filter(geofence =>
      geofence.name.toLowerCase().includes(searchTerm.toLowerCase())
      // Validasi sudah terjadi saat setGeofences
    );
  }, [geofences, searchTerm]);

  const getStatusColor = (status: string): string => status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200';
  const getRuleTypeColor = (ruleType: Geofence['rule_type']): string => {
    switch (ruleType) {
      case 'FORBIDDEN': return 'bg-red-100 text-red-700 border-red-200';
      case 'STAY_IN': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'STANDARD': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };
  const formatRuleType = (ruleType: Geofence['rule_type']): string => {
    switch (ruleType) {
      case 'FORBIDDEN': return 'Terlarang';
      case 'STAY_IN': return 'Wajib Di Dalam';
      case 'STANDARD': return 'Standar';
      default: return ruleType;
    }
  };

  const handleStartCreatingGeofence = () => { /* ... (implementasi sama) ... */ };
  const handleCancelCreatingGeofence = () => { /* ... (implementasi sama) ... */ };
  const handleDrawModeChange = (mode: "polygon" | "circle") => { /* ... (implementasi sama) ... */ };
  const handleDrawCreated = (e: any) => { /* ... (implementasi sama) ... */ };
  const handleDrawEdited = (e: any) => { /* ... (implementasi sama) ... */ };
  const handleDrawDeleted = (e: any) => { /* ... (implementasi sama) ... */ };

  const handleSaveGeofence = async () => {
    if (!currentUser) { toast.error("Anda harus login."); return; }
    if (!newGeofence.name.trim()) { toast.error("Nama geofence harus diisi."); return; }
    if (drawnLayers.length === 0) { toast.error("Gambar area geofence terlebih dahulu."); return; }

    setIsSubmitting(true);
    try {
      const layer = drawnLayers[0]; // Asumsi hanya satu layer yang digambar
      let definitionPayload: GeofenceDataPayload['definition'];
      const currentUserId = currentUser.id || currentUser.user_id;
      const currentDate = new Date().toISOString();

      if (newGeofence.type === "polygon") {
        const latlngs = layer.getLatLngs()[0]; // Untuk simple polygon
        const coordinates = latlngs.map((latLng: any) => [latLng.lng, latLng.lat]);
        if (coordinates.length > 0 && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
            coordinates.push(coordinates[0]); // Tutup poligon jika belum
        }
        definitionPayload = { type: "Polygon", coordinates: [coordinates] };
      } else { // Circle
        const centerLatLng = layer.getLatLng(); // Ini adalah L.LatLng object
        const radius = layer.getRadius(); // Meter
        // Backend Anda mungkin menyimpan circle sebagai center [lng, lat] dan radius
        definitionPayload = { 
            type: "Circle", 
            center: [centerLatLng.lng, centerLatLng.lat], 
            radius: radius 
            // Jika backend butuh 'coordinates' juga untuk circle (misal representasi polygon dari circle):
            // Anda perlu fungsi untuk generate polygon dari circle seperti sebelumnya
        };
      }
      
      const geofenceToSave: GeofenceDataPayload = {
        user_id: currentUserId!,
        name: newGeofence.name,
        type: newGeofence.type,
        rule_type: newGeofence.ruleType,
        status: "active",
        date_created: currentDate,
        definition: definitionPayload,
      };

      console.log("💾 Menyimpan Geofence:", JSON.stringify(geofenceToSave, null, 2));
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geofenceToSave),
      });

      if (response.ok) {
        const savedData = await response.json();
        toast.success("Geofence berhasil disimpan!");
        setIsCreatingGeofence(false); setDrawnLayers([]); 
        setNewGeofence({ name: "", ruleType: "STANDARD", type: "polygon" });
        
        await fetchGeofences(currentUserId!); // Muat ulang daftar geofence

        // Auto-select dan assign jika ada data yang kembali
        const newlyCreatedGeofence = savedData.data as Geofence;
        if (newlyCreatedGeofence && validateGeofenceCoordinates(newlyCreatedGeofence)) {
            setCurrentGeofence(newlyCreatedGeofence);
            zoomToGeofence(newlyCreatedGeofence);
            // setSavedGeofenceForAssign(newlyCreatedGeofence); // Tidak perlu lagi jika dialog assign langsung muncul
            setTimeout(() => {
                handleAssignGeofence(newlyCreatedGeofence);
            }, 500);
        }
        if (isMobile) setActiveTab("list");

      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        toast.error(`Gagal menyimpan geofence: ${errorData?.errors?.[0]?.message || 'Silakan coba lagi.'}`);
      }
    } catch (error) {
      console.error('Error menyimpan geofence:', error);
      toast.error("Terjadi kesalahan. Gagal menyimpan geofence.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGeofence = async (geofenceId: number) => { /* ... (implementasi sama) ... */ };

  // Kondisi loading awal yang lebih baik
  if (loading && !currentUser && geofences.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <p className="text-xl text-gray-700 font-semibold">Memuat data...</p>
        </div>
      </div>
    );
  }
  
  // Tampilan error jika ada
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Terjadi Kesalahan</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <Button 
              onClick={() => { 
                setError(null); 
                // Coba muat ulang data user jika itu masalahnya
                if (!currentUser && typeof window !== 'undefined') {
                    const userJson = sessionStorage.getItem('user');
                    if (userJson) {
                        const user = JSON.parse(userJson);
                        if (user.id || user.user_id) {
                            setCurrentUser(user); // Ini akan memicu useEffect load data
                        } else {
                             window.location.reload(); // Fallback jika user ID tetap tidak ada
                        }
                    } else {
                         window.location.reload(); // Fallback jika user session tidak ada
                    }
                } else if (currentUser?.id || currentUser?.user_id) {
                    loadInitialData(); // Fungsi load data awal
                }
              }} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  // --- MAIN RETURN JSX ---
  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Manajemen Geofence</h1>
            <p className="text-sm text-slate-600">Kelola area geografis untuk monitoring kendaraan Anda.</p>
          </div>
        </div>
        {(!isCreatingGeofence && mapReady && geofences.length > 0) && ( // Tampilkan jika tidak sedang membuat & map siap & ada geofence
          <Button 
            onClick={handleStartCreatingGeofence}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-md transition-all w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Geofence Baru
          </Button>
        )}
      </div>

      {/* Mobile: Tabs Layout */}
      {isMobile ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sticky top-0 bg-slate-50 z-10 shadow-sm">
                <TabsTrigger value="list" className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm py-2.5">
                    <List className="h-5 w-5" /> Daftar ({filteredGeofences.length})
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm py-2.5">
                    <MapPin className="h-5 w-5" /> {isCreatingGeofence ? 'Buat Area' : 'Peta Geofence'}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-2">
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                        <Input placeholder="Cari nama geofence..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 text-sm rounded-md"/>
                    </div>
                </div>
                {loading && geofences.length === 0 && (<div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div><p className="text-slate-600">Memuat geofence...</p></div>)}
                {!loading && filteredGeofences.length === 0 && (
                    <Card className="shadow-sm border-dashed border-slate-300 bg-slate-100/50">
                        <CardContent className="p-6 text-center">
                            <MapPin className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-slate-700 mb-2">{searchTerm ? "Geofence tidak ditemukan" : "Belum ada geofence"}</h3>
                            <p className="text-slate-500 mb-6">{searchTerm ? `Tidak ada geofence yang cocok dengan pencarian "${searchTerm}".` : "Mulai dengan membuat geofence pertama Anda di tab Peta."}</p>
                            {!searchTerm && (<Button onClick={() => { handleStartCreatingGeofence(); setActiveTab("map"); }} className="bg-green-500 hover:bg-green-600"><Plus className="h-5 w-5 mr-2" />Buat Geofence</Button>)}
                        </CardContent>
                    </Card>
                )}
                <div className="space-y-3">
                    {filteredGeofences.map((geofence) => (
                        <Card 
                            key={geofence.geofence_id} 
                            className={`hover:shadow-lg transition-shadow border rounded-lg overflow-hidden cursor-pointer ${currentGeofence?.geofence_id === geofence.geofence_id ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`} 
                            onClick={() => zoomToGeofence(geofence)}
                        >
                        <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-1.5">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-800 text-md truncate" title={geofence.name}>{geofence.name}</h3>
                                </div>
                                <Badge className={`${getStatusColor(geofence.status)} ml-2 text-xs px-1.5 py-0.5 font-medium`}>{geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                <Badge className={`${getRuleTypeColor(geofence.rule_type)} text-xs px-1.5 py-0.5 font-medium`}>{formatRuleType(geofence.rule_type)}</Badge>
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-slate-300 text-slate-600 font-medium">{geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
                                <span>Dibuat: {new Date(geofence.date_created).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</span>
                                <span>ID: {geofence.geofence_id}</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={(e) => { e.stopPropagation(); handleAssignGeofence(geofence);}} title="Assign kendaraan"><Car className="h-3.5 w-3.5 mr-1.5" /> Assign Kendaraan</Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 h-8 w-8" onClick={(e) => {e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id);}}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </CardContent>
                        </Card>
                    ))}
                </div>
            </TabsContent>

            <TabsContent value="map" className="mt-1">
                 <Card className="shadow-md rounded-xl overflow-hidden">
                    <CardHeader className="pb-3 pt-4 px-4 border-b bg-slate-50">
                        <CardTitle className="flex items-center justify-between text-lg text-slate-700">
                            <span className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-blue-600" />
                                {isCreatingGeofence ? 'Gambar Area Geofence' : (currentGeofence ? `Peta: ${currentGeofence.name}` : 'Peta Geofence')}
                            </span>
                             {!isCreatingGeofence && (
                                <Button onClick={handleStartCreatingGeofence} size="sm" className="bg-green-500 hover:bg-green-600 h-8 text-xs px-3" disabled={!mapReady}>
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Baru
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-3">
                        {isCreatingGeofence && (
                            <div className="mb-3 space-y-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                                {/* Form Buat Geofence untuk Mobile */}
                                 <div>
                                    <label className="block text-xs font-medium mb-1 text-gray-700">Nama Geofence</label>
                                    <Input placeholder="Contoh: Area Gudang" value={newGeofence.name} onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})} className="text-sm h-9"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-gray-700">Jenis Aturan</label>
                                    <Select value={newGeofence.ruleType} onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value as Geofence['rule_type']})}>
                                        <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="STANDARD">Standar</SelectItem><SelectItem value="FORBIDDEN">Terlarang</SelectItem><SelectItem value="STAY_IN">Wajib Di Dalam</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-gray-700">Mode Gambar</label>
                                    <div className="flex gap-2">
                                        <Button variant={drawMode === "polygon" ? "default" : "outline"} size="sm" onClick={() => handleDrawModeChange("polygon")} className={`flex-1 text-xs h-8 ${drawMode === "polygon" ? 'bg-blue-600 text-white' : ''}`}><Square className="h-3.5 w-3.5 mr-1.5" /> Poligon</Button>
                                        <Button variant={drawMode === "circle" ? "default" : "outline"} size="sm" onClick={() => handleDrawModeChange("circle")} className={`flex-1 text-xs h-8 ${drawMode === "circle" ? 'bg-blue-600 text-white' : ''}`}><Circle className="h-3.5 w-3.5 mr-1.5" /> Lingkaran</Button>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2 border-t mt-2">
                                    <Button onClick={handleSaveGeofence} disabled={drawnLayers.length === 0 || !newGeofence.name.trim() || isSubmitting} className="bg-green-500 hover:bg-green-600 flex-1 h-9 text-sm">{isSubmitting ? 'Menyimpan...' : <><Save className="h-4 w-4 mr-2" /> Simpan</>}</Button>
                                    <Button variant="outline" onClick={handleCancelCreatingGeofence} className="flex-1 h-9 text-sm"><X className="h-4 w-4 mr-2" /> Batal</Button>
                                </div>
                            </div>
                        )}
                        <div className={`h-[350px] sm:h-[450px] border rounded-lg overflow-hidden shadow-inner ${isCreatingGeofence ? 'ring-2 ring-blue-500' : 'border-slate-200'}`}>
                            {!mapReady && (<div className="h-full fic jic bg-slate-100"><div className="tc"><div className="animate-spin rounded-full h-8 w-8 border-b-2 brd-blue-600 mx-auto mb-4"></div><p className="text-slate-600">Memuat peta...</p></div></div>)}
                            {mapReady && (
                                <MapWithDrawing
                                    key={`map-main-${mapKey}`} // Key yang lebih sederhana, update mapKey untuk re-render
                                    center={getGeofenceCenter(currentGeofence)}
                                    zoom={currentGeofence ? 13 : (geofences.length > 0 ? 6 : 5)}
                                    drawMode={isCreatingGeofence ? drawMode : undefined}
                                    onDrawCreated={isCreatingGeofence ? handleDrawCreated : undefined}
                                    onDrawEdited={isCreatingGeofence ? handleDrawEdited : undefined}
                                    onDrawDeleted={isCreatingGeofence ? handleDrawDeleted : undefined}
                                    viewOnly={!isCreatingGeofence}
                                    geofencesToDisplay={isCreatingGeofence ? [] : mapGeofences} // Prop baru untuk geofence yang ada
                                    selectedGeofenceId={isCreatingGeofence || !currentMapGeofence ? undefined : currentMapGeofence.geofence_id} // Kirim ID geofence terpilih
                                    drawnGeoJSONLayers={isCreatingGeofence ? drawnLayers : []} // Untuk menampilkan layer yang sedang digambar
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      ) : (
        // Desktop Layout
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] xl:h-[calc(100vh-180px)]">
          <div className="lg:col-span-1 flex flex-col bg-white p-4 rounded-xl shadow-lg border border-slate-200">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input placeholder="Cari nama geofence..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-2.5 text-sm rounded-md border-slate-300 focus:ring-blue-500 focus:border-blue-500"/>
              </div>
            </div>
            {isCreatingGeofence && (
              <Card className="mb-4 border-blue-300 shadow-md rounded-lg">
                <CardHeader className="bg-blue-50 py-3 px-4 rounded-t-lg">
                  <CardTitle className="text-lg font-semibold text-blue-700">Buat Geofence Baru</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <div><label className="block text-xs font-medium mb-1 text-slate-600">Nama Geofence</label><Input placeholder="Contoh: Kantor Pusat" value={newGeofence.name} onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})} className="text-sm h-9"/></div>
                    <div><label className="block text-xs font-medium mb-1 text-slate-600">Jenis Aturan</label><Select value={newGeofence.ruleType} onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value as Geofence['rule_type']})}><SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="STANDARD">Standar</SelectItem><SelectItem value="FORBIDDEN">Terlarang</SelectItem><SelectItem value="STAY_IN">Wajib Di Dalam</SelectItem></SelectContent></Select></div>
                    <div><label className="block text-xs font-medium mb-1 text-slate-600">Mode Gambar Area</label><div className="flex gap-2"><Button variant={drawMode === "polygon" ? "default" : "outline"} size="sm" onClick={() => handleDrawModeChange("polygon")} className={`flex-1 text-xs h-8 ${drawMode === "polygon" ? 'bg-blue-600 text-white' : 'border-slate-300 text-slate-700'}`}><Square className="h-3.5 w-3.5 mr-1.5" /> Poligon</Button><Button variant={drawMode === "circle" ? "default" : "outline"} size="sm" onClick={() => handleDrawModeChange("circle")} className={`flex-1 text-xs h-8 ${drawMode === "circle" ? 'bg-blue-600 text-white' : 'border-slate-300 text-slate-700'}`}><Circle className="h-3.5 w-3.5 mr-1.5" /> Lingkaran</Button></div>{drawnLayers.length > 0 && <p className="text-xs text-green-600 mt-1.5">Area digambar. Edit/hapus di peta.</p>}{drawnLayers.length === 0 && <p className="text-xs text-orange-600 mt-1.5">Pilih tool gambar di peta.</p>}</div>
                    <div className="flex gap-2 pt-3 border-t mt-3"><Button onClick={handleSaveGeofence} disabled={drawnLayers.length === 0 || !newGeofence.name.trim() || isSubmitting} size="sm" className="bg-green-500 hover:bg-green-600 text-white flex-1 text-sm h-9">{isSubmitting ? 'Menyimpan...' : <><Save className="h-4 w-4 mr-1.5" /> Simpan</>}</Button><Button variant="outline" onClick={handleCancelCreatingGeofence} size="sm" className="border-slate-300 text-slate-700 flex-1 text-sm h-9"><X className="h-4 w-4 mr-1.5" /> Batal</Button></div>
                </CardContent>
              </Card>
            )}
            {(loading && geofences.length === 0 && !isCreatingGeofence) && (<div className="flex-1 fic jic"><div className="tc py-10"><div className="animate-spin rounded-full h-8 w-8 brd-b-2 brd-blue-500 mx-auto mb-4"></div><p className="text-slate-600">Memuat daftar geofence...</p></div></div>)}
            {(!loading && filteredGeofences.length === 0 && !isCreatingGeofence) && ( <Card className="flex-1 border-dashed border-slate-300 bg-slate-50 shadow-none"><CardContent className="p-6 tc fic jic h-full"><MapPin className="h-16 w-16 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-700 mb-2">{searchTerm ? "Tidak Ditemukan" : "Belum Ada Geofence"}</h3><p className="text-sm text-slate-500 mb-4">{searchTerm ? `Tidak ada geofence cocok "${searchTerm}".` : "Buat geofence baru."}</p><Button onClick={handleStartCreatingGeofence} className="bg-blue-500 hover:bg-blue-600 text-sm" disabled={!mapReady}><Plus className="h-4 w-4 mr-2" />Buat Geofence</Button></CardContent></Card> )}
            {filteredGeofences.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredGeofences.map((geofence) => (
                  <Card key={geofence.geofence_id} className={`cursor-pointer t-all dur-150 ease-in-out hover:shadow-xl border rounded-lg overflow-hidden ${currentGeofence?.geofence_id === geofence.geofence_id ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-400 shadow-lg' : 'bg-white border-slate-200 hover:border-slate-300'}`} onClick={() => zoomToGeofence(geofence)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-1.5"><div className="flex-1 min-w-0"><h3 className="font-semibold text-slate-800 text-sm truncate" title={geofence.name}>{geofence.name}</h3></div><Badge className={`${getStatusColor(geofence.status)} ml-2 text-xs px-1.5 py-0.5 font-medium`}>{geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></div>
                      <div className="flex flex-wrap gap-1 mb-2"><Badge className={`${getRuleTypeColor(geofence.rule_type)} text-xs px-1.5 py-0.5 font-medium`}>{formatRuleType(geofence.rule_type)}</Badge><Badge variant="outline" className="text-xs px-1.5 py-0.5 border-slate-300 text-slate-600 font-medium">{geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}</Badge></div>
                       <p className="text-xs text-slate-500 mb-2">Dibuat: {new Date(geofence.date_created).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})}</p>
                      <div className="flex gap-1.5 items-center justify-end mt-1">
                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleAssignGeofence(geofence); }} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-slate-300 h-7 w-7" title="Assign Kendaraan"><Car className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id); }} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-300 h-7 w-7" title="Hapus Geofence"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            )}
          </div>
          <div className={`lg:col-span-2 h-full min-h-[400px] border rounded-xl overflow-hidden shadow-xl ${isCreatingGeofence ? 'ring-2 ring-offset-2 ring-blue-500' : 'border-slate-200'}`}>
             {!mapReady && (<div className="h-full fic jic bg-slate-100 rounded-xl"><div className="tc"><div className="animate-spin rounded-full h-10 w-10 border-b-2 brc-blue-600 mx-auto mb-5"></div><p className="text-slate-700 text-lg">Memuat Peta Interaktif...</p></div></div>)}
            {mapReady && (
              <MapWithDrawing
                key={`map-main-desktop-${mapKey}`}
                center={getGeofenceCenter(isCreatingGeofence && !currentGeofence ? null : currentGeofence)}
                zoom={isCreatingGeofence && !currentGeofence ? 5 : (currentGeofence ? 13 : (geofences.length > 0 ? 6: 5))}
                drawMode={isCreatingGeofence ? drawMode : undefined}
                onDrawCreated={isCreatingGeofence ? handleDrawCreated : undefined}
                onDrawEdited={isCreatingGeofence ? handleDrawEdited : undefined}
                onDrawDeleted={isCreatingGeofence ? handleDrawDeleted : undefined}
                viewOnly={!isCreatingGeofence}
                geofencesToDisplay={isCreatingGeofence ? [] : mapGeofences}
                selectedGeofenceId={isCreatingGeofence || !currentMapGeofence ? undefined : currentMapGeofence.geofence_id}
                drawnGeoJSONLayers={isCreatingGeofence ? drawnLayers : []} 
              />
            )}
          </div>
        </div>
      )}
      
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
         <DialogContent className="sm:max-w-md fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[50000] bg-white border shadow-2xl rounded-lg p-0">
            <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Car className="h-5 w-5 text-blue-600" /> Assign Kendaraan ke "{currentGeofence?.name}"
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
                Pilih kendaraan untuk dipantau. Kendaraan hanya bisa terhubung ke satu geofence.
            </DialogDescription>
            </DialogHeader>
            <div className="p-5">
                <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading && vehicles.length === 0 && (<div className="tc py-8 text-gray-500"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div><p>Memuat...</p></div>)}
                    {!loading && vehicles.length === 0 ? ( <div className="tc py-8 text-gray-500"> <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" /> <p className="font-medium">Tidak ada kendaraan.</p> </div> ) : (
                    <div className="space-y-2.5">
                        {vehicles.map((vehicle) => {
                            const isCurrentlyAssignedToThisGeofence = vehicle.geofence_id === currentGeofence?.geofence_id?.toString();
                            const isAssignedToOtherGeofence = vehicle.geofence_id && vehicle.geofence_id !== currentGeofence?.geofence_id?.toString();
                            const geofenceThisVehicleIsAssignedTo = isAssignedToOtherGeofence ? geofences.find(g => g.geofence_id.toString() === vehicle.geofence_id) : null;
                            return (
                                <div key={vehicle.vehicle_id} className={`flex items-center space-x-3 p-3 rounded-lg border transition-all dur-150 ease-in-out ${selectedVehicles.includes(vehicle.vehicle_id) ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'} ${isAssignedToOtherGeofence ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                    onClick={isAssignedToOtherGeofence ? (e) => { e.preventDefault(); toast.error(`${vehicle.name} sudah di-assign ke geofence "${geofenceThisVehicleIsAssignedTo?.name || 'lain'}".`); } : () => handleVehicleSelectionChange(vehicle.vehicle_id)}>
                                    <Checkbox id={`vehicle-assign-${vehicle.vehicle_id}`} checked={selectedVehicles.includes(vehicle.vehicle_id)} onCheckedChange={isAssignedToOtherGeofence ? undefined : () => handleVehicleSelectionChange(vehicle.vehicle_id)} className="data-[state=checked]:bg-blue-600 shrink-0" disabled={isAssignedToOtherGeofence} />
                                    <label htmlFor={`vehicle-assign-${vehicle.vehicle_id}`} className={`flex-1 ${isAssignedToOtherGeofence ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <div className="font-medium text-gray-800 text-sm">{vehicle.name}</div>
                                        <div className="text-xs text-gray-500">{vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})</div>
                                        {vehicle.gps_id && (<div className="text-xs text-gray-400 mt-0.5">GPS ID: {vehicle.gps_id}</div>)}
                                    </label>
                                    <div className="flex flex-col items-end gap-1">
                                        {isCurrentlyAssignedToThisGeofence && (<Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-1.5 py-0.5">Terassign</Badge> )}
                                        {isAssignedToOtherGeofence && (<Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-1.5 py-0.5 ws-nowrap">Di Geofence Lain {geofenceThisVehicleIsAssignedTo && <span className="font-semibold ml-1">({geofenceThisVehicleIsAssignedTo.name})</span>}</Badge> )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    )}
                </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t bg-gray-50 rounded-b-lg">
                <div className="text-sm text-gray-600 mb-2 sm:mb-0">{selectedVehicles.length} kendaraan dipilih</div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <DialogClose asChild><Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none border-gray-300 text-gray-700">Batal</Button></DialogClose>
                    <Button type="button" onClick={assignGeofenceToVehicles} disabled={isSubmitting} size="sm" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-md">
                        {isSubmitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Menyimpan...</> : <><Save className="h-4 w-4 mr-2" /> Simpan Assignment</>}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function di luar komponen jika tidak bergantung pada state komponen
// atau bisa dijadikan method statis di kelas jika relevan
const loadInitialData = async (
    setCurrentUser: Function, 
    setError: Function, 
    fetchGeofences: Function, 
    fetchVehicles: Function,
    setLoadingGlobal: Function
) => {
  console.log('GeofenceManager: Memuat data awal...');
  setLoadingGlobal(true); // Menggunakan setLoading global
  setError(null);
  try {
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson) as User;
      setCurrentUser(user);
      const idForApi = user.id || user.user_id;
      if (idForApi) {
        await fetchGeofences(idForApi); 
        await fetchVehicles(idForApi);
      } else {
        console.error('GeofenceManager: User ID tidak ditemukan di objek user.');
        setError("User ID tidak valid.");
      }
    } else {
      console.log('GeofenceManager: Pengguna tidak ditemukan di session storage.');
      setError("Sesi pengguna tidak ditemukan. Silakan login kembali.");
    }
  } catch (e) {
    console.error('GeofenceManager: Error saat memuat data awal:', e);
    setError("Gagal memuat data awal.");
  } finally {
    setLoadingGlobal(false); // Menggunakan setLoading global
  }
};