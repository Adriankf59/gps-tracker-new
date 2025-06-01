"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Navigation, 
  Car,
  Fuel,
  Zap,
  Gauge,
  Clock,
  Satellite,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  Shield // Untuk ikon geofence
} from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamic import untuk MapComponent
const MapComponent = dynamic(() => import('./MapComponent'), { // Pastikan path ini benar
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

// Interface dari GeofenceManager untuk konsistensi
interface ProjectGeofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][]; // Untuk polygon [[[lng,lat], [lng,lat], ...]]
    center?: [number, number];   // Untuk circle [lng,lat]
    radius?: number;            // Untuk circle, dalam meter
    type: string;               // "Polygon" atau "Circle" (dari backend)
  };
  date_created: string;
}

interface Vehicle {
  vehicle_id: string; // Bisa string atau number tergantung API Anda, contoh dari API Anda menggunakan number
  user_id: string;
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at: string; // Dari API Directus Anda, nama fieldnya 'create_at' atau 'created_at'
  updated_at: string | null; // Dari API Directus Anda, nama fieldnya 'update_at' atau 'updated_at'
  vehicle_photo: string | null;
  geofence_id?: number | string | null; // Penting untuk link ke geofence
}

interface VehicleData {
  vehicle_datas_id: string;
  gps_id: string | null;
  vehicle_id?: string; // Opsional, karena data utama ada di Vehicle
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm: number | null;
  fuel_level: string | null; // Bisa string "15.0" atau number, perlu parsing
  ignition_status: string | null; // "ON", "OFF", atau boolean
  battery_level: string | null; // Bisa string "12.5" atau number, perlu parsing
  satellites_used: number | null;
}

interface VehicleWithTracking extends Vehicle {
  latestData?: VehicleData;
  status: "moving" | "parked" | "offline";
  location: string; // Hasil reverse geocoding atau koordinat
  lastUpdateString: string; // String relatif seperti "5 min ago"
  isOnline: boolean;
}

// Interface untuk kendaraan yang diproses dan dikirim ke MapComponent
interface ProcessedVehicleForMap {
  id: string;
  name: string;
  licensePlate: string;
  position: [number, number]; // [latitude, longitude] untuk Leaflet
  speed: number;
  ignition: boolean;
  fuel: number | null;
  battery: number | null;
  timestamp: string | null;
  isMotor: boolean;
  make?: string;
  model?: string;
  year?: number;
  status: 'moving' | 'parked' | 'offline';
}

// Endpoint API dari GeofenceManager (sesuaikan jika perlu)
const GEOFENCE_API_BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';

export function LiveTracking() {
  const [vehicles, setVehicles] = useState<VehicleWithTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null); // Sebaiknya ganti 'any' dengan interface User yang lebih spesifik
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null); // [lat, lng]

  const [assignedGeofence, setAssignedGeofence] = useState<ProjectGeofence | null>(null);

  const userId = useMemo(() => {
    if (typeof window === 'undefined') return null; // Hindari error SSR
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        return parsedUser.id || parsedUser.user_id || parsedUser._id || parsedUser.ID;
      } catch (e) { console.error('Gagal parsing user data:', e); return null; }
    }
    return null;
  }, []);

  // Helper dari GeofenceManager untuk validasi koordinat geofence
  const validateGeofenceCoordinates = (geofence: ProjectGeofence): boolean => {
    try {
      if (!geofence.definition) return false;
      if (geofence.type === 'circle') {
        if (!geofence.definition.center || geofence.definition.center.length < 2) return false;
        const [lng, lat] = geofence.definition.center;
        if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) return false;
        if (geofence.definition.radius === undefined || isNaN(geofence.definition.radius)) return false;
        return true;
      }
      if (geofence.type === 'polygon') {
        if (!geofence.definition.coordinates || !geofence.definition.coordinates[0] || geofence.definition.coordinates[0].length < 3) return false;
        // Validasi setiap titik koordinat
        for (const point of geofence.definition.coordinates[0]) {
            if (!point || point.length < 2 || isNaN(point[0]) || isNaN(point[1]) || !isFinite(point[0]) || !isFinite(point[1])) return false;
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error validasi koordinat geofence:', error, geofence);
      return false;
    }
  };
  
  const processedVehicleForMap = useMemo((): ProcessedVehicleForMap[] => {
    if (!selectedVehicleId) return [];
    const selectedVehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId);
    if (!selectedVehicle || !selectedVehicle.latestData?.latitude || !selectedVehicle.latestData?.longitude) return [];

    const data = selectedVehicle.latestData;
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    if (isNaN(lat) || isNaN(lng)) return [];
    
    const isMotor = selectedVehicle.make?.toLowerCase().includes('motor') || 
                    selectedVehicle.model?.toLowerCase().includes('motor') ||
                    selectedVehicle.name?.toLowerCase().includes('motor');
    
    return [{
      id: selectedVehicle.vehicle_id,
      name: selectedVehicle.name,
      licensePlate: selectedVehicle.license_plate,
      position: [lat, lng], // MapComponent (Leaflet) biasanya mengharapkan [lat, lng]
      speed: data.speed ?? 0,
      ignition: data.ignition_status === 'ON' || data.ignition_status === 'true',
      fuel: data.fuel_level ? parseFloat(data.fuel_level) : null,
      battery: data.battery_level ? parseFloat(data.battery_level) : null,
      timestamp: data.timestamp,
      isMotor,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      year: selectedVehicle.year,
      status: selectedVehicle.status
    }];
  }, [vehicles, selectedVehicleId]);

  // Geofence yang diproses untuk ditampilkan di peta
  const processedGeofenceForMap = useMemo((): ProjectGeofence[] => {
    if (assignedGeofence && validateGeofenceCoordinates(assignedGeofence)) {
      // Langsung return geofence yang sudah divalidasi, dalam array
      // MapComponent akan bertanggung jawab untuk merendernya
      return [assignedGeofence];
    }
    return [];
  }, [assignedGeofence]);


  const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    try { return sessionStorage.getItem('authToken') || localStorage.getItem('authToken'); } 
    catch (e) { return null; }
  };

  const getLocationName = (latStr: string | null, lngStr: string | null): string => {
    if (!latStr || !lngStr) return 'N/A';
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);
    if (isNaN(latitude) || isNaN(longitude)) return 'Invalid Coords';
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const getVehicleStatus = (data: VehicleData | undefined): "moving" | "parked" | "offline" => {
    if (!data || !data.timestamp) return 'offline';
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    if (diffMinutes > 15) return 'offline'; // Dianggap offline jika data lebih dari 15 menit
    return (data.speed ?? 0) > 2 ? 'moving' : 'parked'; // Anggap bergerak jika kecepatan > 2 km/h
  };

  const isVehicleOnline = (data: VehicleData | undefined): boolean => {
    if (!data || !data.timestamp) return false;
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    return (now.getTime() - lastUpdate.getTime()) < (15 * 60 * 1000);
  };

  const getRelativeTime = (timestamp: string | null): string => {
    if (!timestamp) return 'Belum ada data';
    const now = new Date();
    const then = new Date(timestamp);
    const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diffSeconds < 5) return 'Baru saja';
    if (diffSeconds < 60) return `${diffSeconds} detik lalu`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} menit lalu`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} jam lalu`;
    return `${Math.floor(diffSeconds / 86400)} hari lalu`;
  };

  const fetchVehiclesFromApi = async (currentUserId?: string) => {
    // Menggunakan endpoint dari GeofenceManager.tsx sebagai referensi
    const VEHICLE_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';
    try {
      const token = getAuthToken(); // Jika diperlukan
      const url = currentUserId ? `${VEHICLE_ENDPOINT}?filter[user_id][_eq]=${currentUserId}` : VEHICLE_ENDPOINT;
      
      const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) {
        console.error('Gagal mengambil daftar kendaraan:', response.status, await response.text());
        return [];
      }
      const data = await response.json();
      return (data.data || []) as Vehicle[]; // Pastikan casting ke tipe Vehicle yang benar
    } catch (error) {
      console.error('Error mengambil daftar kendaraan:', error);
      return [];
    }
  };

  const fetchVehicleDataFromApi = async (vehicleList: Vehicle[]) => {
     // Menggunakan endpoint dari GeofenceManager.tsx sebagai referensi
    const VEHICLE_DATA_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas';
    if (!vehicleList || vehicleList.length === 0) return [];
    try {
      // Ambil data terbaru untuk semua gps_id yang ada di daftar kendaraan
      const gpsIds = vehicleList.map(v => v.gps_id).filter(id => id != null);
      if (gpsIds.length === 0) return [];

      // Idealnya, API mendukung pengambilan data terbaru untuk multiple gps_id dalam 1 request.
      // Jika tidak, Anda mungkin perlu melakukan multiple request atau menyesuaikan query.
      // Contoh: Ambil semua data dalam rentang waktu tertentu, lalu filter di client (kurang efisien).
      // Untuk sekarang, kita asumsikan endpoint bisa difilter atau kita ambil semua dan proses.
      // Contoh ambil semua data lalu filter (untuk demo, batasi dengan limit)
      // "&sort=-timestamp" untuk mendapatkan yang terbaru dulu per grup jika API mendukung
      const url = `${VEHICLE_DATA_ENDPOINT}?filter[gps_id][_in]=${gpsIds.join(',')}&limit=${gpsIds.length * 5}&sort=-timestamp`;
      
      const token = getAuthToken();
      const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) {
        console.error('Gagal mengambil data kendaraan:', response.status, await response.text());
        return [];
      }
      const data = await response.json();
      return (data.data || []) as VehicleData[];
    } catch (error) {
      console.error('Error mengambil data kendaraan:', error);
      return [];
    }
  };

  const fetchGeofenceDetails = async (geofenceId: string | number): Promise<ProjectGeofence | null> => {
    if (!geofenceId) return null;
    try {
      const token = getAuthToken();
      const response = await fetch(`${GEOFENCE_API_BASE_URL}/${geofenceId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        console.error(`Gagal mengambil detail geofence ${geofenceId}:`, response.status, await response.text());
        setAssignedGeofence(null); // Bersihkan jika gagal
        return null;
      }
      const result = await response.json();
      return result.data as ProjectGeofence;
    } catch (error) {
      console.error('Error mengambil detail geofence:', error);
      setAssignedGeofence(null);
      return null;
    }
  };

  const mergeAndProcessData = (fetchedVehicles: Vehicle[], allVehicleData: VehicleData[]): VehicleWithTracking[] => {
    return fetchedVehicles.map(vehicle => {
      const latestData = allVehicleData
        .filter(data => data.gps_id === vehicle.gps_id)
        .sort((a, b) => {
          if (!a.timestamp) return 1; if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })[0];

      const status = getVehicleStatus(latestData);
      const isOnline = isVehicleOnline(latestData);
      const lastUpdateString = latestData?.timestamp ? getRelativeTime(latestData.timestamp) : 'Belum ada data';
      const location = latestData?.latitude && latestData?.longitude ? getLocationName(latestData.latitude, latestData.longitude) : 'Tidak ada data GPS';
      
      return { ...vehicle, latestData, status, location, lastUpdateString, isOnline };
    });
  };

  const loadTrackingData = async (isRefresh = false) => {
    if (!userId) {
        setError("User ID tidak ditemukan. Silakan login kembali.");
        setLoading(false);
        return;
    }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    try {
      const fetchedUserVehicles = await fetchVehiclesFromApi(userId);
      if (fetchedUserVehicles.length === 0) {
          setVehicles([]);
          setSelectedVehicleId(null); setSelectedVehicleName(null); setSelectedVehicleCoords(null); setAssignedGeofence(null);
          if (isRefresh) setRefreshing(false); else setLoading(false);
          return;
      }
      const allVehicleDataPoints = await fetchVehicleDataFromApi(fetchedUserVehicles);
      const combinedData = mergeAndProcessData(fetchedUserVehicles, allVehicleDataPoints);
      const sortedVehicles = combinedData.sort((a, b) => (parseInt(a.vehicle_id) || 0) - (parseInt(b.vehicle_id) || 0));
      
      setVehicles(sortedVehicles);

      let currentSelectedVehicle = sortedVehicles.find(v => v.vehicle_id === selectedVehicleId);

      if (!currentSelectedVehicle && sortedVehicles.length > 0) {
        currentSelectedVehicle = sortedVehicles[0]; // Pilih yang pertama jika pilihan lama hilang atau belum ada
      }
      
      if (currentSelectedVehicle) {
        if (selectedVehicleId !== currentSelectedVehicle.vehicle_id) { // Hanya update jika berbeda atau belum ada
            setSelectedVehicleId(currentSelectedVehicle.vehicle_id);
            setSelectedVehicleName(currentSelectedVehicle.name);
        }
        if (currentSelectedVehicle.latestData?.latitude && currentSelectedVehicle.latestData?.longitude) {
          const newCoords: [number, number] = [
            parseFloat(currentSelectedVehicle.latestData.latitude),
            parseFloat(currentSelectedVehicle.latestData.longitude)
          ];
          // Hanya update jika koordinat berbeda untuk menghindari re-render map yang tidak perlu
          if (!selectedVehicleCoords || selectedVehicleCoords[0] !== newCoords[0] || selectedVehicleCoords[1] !== newCoords[1]) {
            setSelectedVehicleCoords(newCoords);
          }
        } else {
          setSelectedVehicleCoords(null);
        }
        // Muat geofence untuk kendaraan yang baru dipilih (atau yang sama jika datanya baru)
        if (currentSelectedVehicle.geofence_id) {
          const geofenceData = await fetchGeofenceDetails(currentSelectedVehicle.geofence_id);
          setAssignedGeofence(geofenceData); // Akan null jika gagal atau tidak valid
        } else {
          setAssignedGeofence(null);
        }

      } else { // Tidak ada kendaraan
        setSelectedVehicleId(null); setSelectedVehicleName(null); setSelectedVehicleCoords(null); setAssignedGeofence(null);
      }

    } catch (err) {
      console.error('Error memuat data tracking:', err);
      setError('Gagal memuat data tracking. Silakan coba lagi.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  };
  
  useEffect(() => {
    const userSessionData = sessionStorage.getItem('user');
    if (userSessionData) {
      try { setCurrentUser(JSON.parse(userSessionData)); } 
      catch (e) { console.error('Gagal parsing user data dari session:', e); }
    }
    const trackVehicleId = sessionStorage.getItem('trackVehicleId');
    const trackVehicleName = sessionStorage.getItem('trackVehicleName');
    if (trackVehicleId) setSelectedVehicleId(trackVehicleId);
    if (trackVehicleName) setSelectedVehicleName(trackVehicleName);
  }, []);

  useEffect(() => {
    if (userId) { // Hanya muat data jika userId sudah ada
        loadTrackingData();
        const interval = setInterval(() => loadTrackingData(true), 30000); // Refresh tiap 30 detik
        return () => clearInterval(interval);
    } else if (loading && !userId && currentUser === null) { // Masih menunggu user dari session
        // Jangan lakukan apa-apa, tunggu userId terisi
    } else if (!userId && !loading) { // userId tidak ada setelah pengecekan awal
        setError("User tidak teridentifikasi. Tidak dapat memuat data kendaraan.");
        setLoading(false);
    }
  }, [userId]); // Hanya bergantung pada userId untuk trigger awal dan interval


  // Efek untuk memuat geofence ketika kendaraan yang dipilih berubah
  // atau ketika daftar kendaraan (yang mungkin mengandung geofence_id baru) berubah
  useEffect(() => {
    const updateAssignedGeofence = async () => {
      if (selectedVehicleId) {
        const vehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId);
        if (vehicle && vehicle.geofence_id) {
          if (assignedGeofence?.geofence_id?.toString() !== vehicle.geofence_id.toString()) { // Hanya fetch jika geofence ID berbeda
            setRefreshing(true); // Tampilkan loader kecil saat ganti geofence
            const geofenceData = await fetchGeofenceDetails(vehicle.geofence_id);
            setAssignedGeofence(geofenceData);
            setRefreshing(false);
          }
        } else {
          setAssignedGeofence(null); // Tidak ada geofence_id atau kendaraan tidak ditemukan
        }
      } else {
        setAssignedGeofence(null); // Tidak ada kendaraan yang dipilih
      }
    };
    updateAssignedGeofence();
  }, [selectedVehicleId, vehicles]);


  const handleVehicleSelect = (vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);
    if (vehicle.latestData?.latitude && vehicle.latestData?.longitude) {
      setSelectedVehicleCoords([parseFloat(vehicle.latestData.latitude), parseFloat(vehicle.latestData.longitude)]);
    } else {
      setSelectedVehicleCoords(null);
    }
    // Pengambilan geofence akan ditangani oleh useEffect di atas
  };
  
  // Map handlers (disesuaikan)
  const handleMapVehicleClick = (clickedVehicle: ProcessedVehicleForMap) => {
    // Jika kendaraan yang diklik di peta berbeda dari yang dipilih, update pilihan
    if(clickedVehicle.id !== selectedVehicleId) {
        const fullVehicleData = vehicles.find(v => v.vehicle_id === clickedVehicle.id);
        if(fullVehicleData) {
            handleVehicleSelect(fullVehicleData);
        }
    }
    // Jika sama, biarkan (atau mungkin ada aksi lain seperti buka detail popup)
    console.log('Kendaraan diklik di peta:', clickedVehicle.name);
  };

  const handleMapClick = () => {
    // Pertimbangkan apakah ingin menghapus pilihan kendaraan saat peta diklik
    // Untuk saat ini, kita biarkan fokus pada kendaraan yang dipilih
    // setSelectedVehicleId(null); 
    // setSelectedVehicleName(null);
    // setSelectedVehicleCoords(null);
    // setAssignedGeofence(null);
    console.log('Peta diklik');
  };

  const getStatusColorClass = (status: VehicleWithTracking['status']): string => {
    switch (status) {
      case 'moving': return 'bg-green-100 text-green-700 border-green-300';
      case 'parked': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'offline': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 text-lg">Memuat data pelacakan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Gagal Memuat Data</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <Button onClick={() => { setError(null); loadTrackingData(); }} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
            <Navigation className="w-8 h-8 text-blue-600"/>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Pelacakan Langsung</h1>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-600">
                        Status armada Anda ({vehicles.length} kendaraan)
                        {currentUser && currentUser.name && ` - Pengguna: ${currentUser.name}`}
                    </p>
                </div>
            </div>
        </div>
        <Button 
          variant="outline"
          onClick={() => loadTrackingData(true)}
          disabled={refreshing}
          className="text-sm w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Menyegarkan...' : 'Segarkan Data'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden shadow-lg border rounded-xl">
            <CardHeader className="pb-2 pt-4 px-4 border-b bg-slate-50">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Peta Lokasi Kendaraan
                </span>
                {selectedVehicleName && (
                  <Badge variant="outline" className="text-sm font-normal text-blue-700 border-blue-300 bg-blue-50 py-1 px-2.5">
                     <Eye className="w-3.5 h-3.5 mr-1.5" /> Terpilih: <span className="font-semibold ml-1">{selectedVehicleName}</span>
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0"> {/* Hapus padding jika map mengisi penuh */}
              <div className="rounded-b-xl overflow-hidden"> {/* Pastikan map mengikuti border radius */}
                <MapComponent 
                  vehicles={processedVehicleForMap} // Hanya kendaraan terpilih yang dikirim ke map
                  selectedVehicleId={selectedVehicleId}
                  centerCoordinates={selectedVehicleCoords} // Prop baru untuk mengatur pusat peta
                  onVehicleClick={handleMapVehicleClick}
                  onMapClick={handleMapClick} // Untuk interaksi klik peta umum
                  height="calc(100vh - 300px)" // Tinggi dinamis
                  minHeight="450px" // Tinggi minimal
                  defaultCenter={selectedVehicleCoords || [-2.5, 118.0]}
                  zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : 5} // Zoom lebih dekat jika kendaraan dipilih
                  displayGeofences={processedGeofenceForMap} // Kirim geofence yang akan ditampilkan
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-4 md:max-h-[calc(100vh-150px)] md:overflow-y-auto custom-scrollbar pr-1">
          <Card className="shadow-md border rounded-xl">
            <CardHeader className="py-3 px-4 border-b bg-slate-50 rounded-t-xl">
              <CardTitle className="text-base font-semibold text-slate-700">Daftar Kendaraan ({vehicles.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2.5 max-h-[400px] md:max-h-none overflow-y-auto md:overflow-visible custom-scrollbar">
              {vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <div 
                    key={vehicle.vehicle_id} 
                    className={`flex flex-col p-3 cursor-pointer rounded-lg transition-all duration-150 ease-in-out border hover:shadow-md
                                ${selectedVehicleId === vehicle.vehicle_id 
                                  ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-md' 
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                    onClick={() => handleVehicleSelect(vehicle)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Car className={`w-4 h-4 shrink-0 ${selectedVehicleId === vehicle.vehicle_id ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="font-medium text-sm text-slate-800 truncate" title={vehicle.name}>{vehicle.name}</span>
                        {selectedVehicleId === vehicle.vehicle_id && (
                          <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <Badge className={`text-xs px-1.5 py-0.5 font-normal ${getStatusColorClass(vehicle.status)}`}>
                        {vehicle.isOnline ? vehicle.status : 'offline'}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate" title={vehicle.location}>{vehicle.location}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-slate-600 mb-1.5">
                      <div className="flex items-center gap-1" title="Kecepatan">
                        <Gauge className="w-3 h-3 text-blue-500 shrink-0" />
                        <span>{vehicle.latestData?.speed ?? 0} km/j</span>
                      </div>
                      <div className="flex items-center gap-1" title="Bahan Bakar">
                        <Fuel className="w-3 h-3 text-orange-500 shrink-0" />
                        <span>{parseFloat(vehicle.latestData?.fuel_level || '0').toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-1" title="Baterai">
                        <Zap className="w-3 h-3 text-green-500 shrink-0" />
                        <span>{parseFloat(vehicle.latestData?.battery_level || '0').toFixed(1)}V</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 mt-1">
                      <div className="flex items-center gap-1" title="Satelit">
                        <Satellite className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{vehicle.latestData?.satellites_used ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Update Terakhir">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{vehicle.lastUpdateString}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Tidak ada kendaraan ditemukan.</p>
                  <p className="text-xs text-slate-400 mt-1">Pastikan kendaraan sudah ditambahkan dan mengirim data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {vehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.status === 'moving').length}</p> <p className="text-xs text-slate-500 uppercase">Bergerak</p> </div>
                    <div className="p-2 bg-green-100 rounded-full"><Navigation className="w-4 h-4 text-green-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-yellow-600">{vehicles.filter(v => v.status === 'parked').length}</p> <p className="text-xs text-slate-500 uppercase">Parkir</p> </div>
                    <div className="p-2 bg-yellow-100 rounded-full"><Car className="w-4 h-4 text-yellow-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-red-600">{vehicles.filter(v => v.status === 'offline').length}</p> <p className="text-xs text-slate-500 uppercase">Offline</p> </div>
                    <div className="p-2 bg-red-100 rounded-full"><Zap className="w-4 h-4 text-red-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-blue-600">{vehicles.length}</p> <p className="text-xs text-slate-500 uppercase">Total Kendaraan</p> </div>
                    <div className="p-2 bg-blue-100 rounded-full"><Shield className="w-4 h-4 text-blue-600" /></div>
                </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}