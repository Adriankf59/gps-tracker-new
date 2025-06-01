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
  Shield // Ditambahkan untuk ikon geofence jika perlu
} from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamically import MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), { // Pastikan path ini benar
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

// Interface Geofence (adaptasi dari GeofenceManager)
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
  vehicle_id: string; // Mungkin lebih baik number jika ID dari API adalah number
  user_id: string;
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at: string; // Sesuai API Anda 'create_at' atau 'created_at'?
  updated_at: string | null; // Sesuai API Anda 'update_at' atau 'updated_at'?
  vehicle_photo: string | null; // Di API Anda null, jadi string | null
  geofence_id?: number | string | null; // Ditambahkan untuk menyimpan ID geofence terkait
}

interface VehicleData {
  vehicle_datas_id: string;
  gps_id: string | null;
  vehicle_id?: string; // Opsional jika data utama ada di Vehicle
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used: number | null;
}

interface VehicleWithTracking extends Vehicle {
  latestData?: VehicleData;
  status: "moving" | "parked" | "offline";
  location: string;
  // coordinates: string; // Ini duplikat dengan latestData, mungkin bisa dihilangkan
  lastUpdateString: string; // Mengganti nama dari lastUpdate
  isOnline: boolean;
}

interface ProcessedVehicle {
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

const GEOFENCE_API_BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';
const VEHICLE_API_ENDPOINT_BASE = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';
const VEHICLE_DATA_API_ENDPOINT_BASE = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas';


export function LiveTracking() {
  const [vehicles, setVehicles] = useState<VehicleWithTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null);
  
  const [assignedGeofence, setAssignedGeofence] = useState<ProjectGeofence | null>(null);


  const userId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        return parsedUser.id || parsedUser.user_id || parsedUser._id || parsedUser.ID;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }, []);

  // Fungsi validasi koordinat geofence (adaptasi dari GeofenceManager)
  const validateGeofenceCoordinates = (geofence: ProjectGeofence): boolean => {
    try {
      if (!geofence.definition) {
        console.warn('Validasi: Geofence tidak memiliki definisi.', geofence.name);
        return false;
      }
      if (geofence.type === 'circle') {
        if (!geofence.definition.center || geofence.definition.center.length < 2) {
          console.warn('Validasi: Pusat lingkaran tidak valid.', geofence.name); return false;
        }
        const [lng, lat] = geofence.definition.center;
        if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
          console.warn('Validasi: Koordinat pusat lingkaran tidak valid.', geofence.name); return false;
        }
        if (geofence.definition.radius === undefined || isNaN(geofence.definition.radius) || geofence.definition.radius <= 0) {
          console.warn('Validasi: Radius lingkaran tidak valid.', geofence.name); return false;
        }
        return true;
      }
      if (geofence.type === 'polygon') {
        if (!geofence.definition.coordinates || !geofence.definition.coordinates[0] || geofence.definition.coordinates[0].length < 3) {
          console.warn('Validasi: Koordinat poligon tidak cukup (minimal 3 titik).', geofence.name); return false;
        }
        for (const point of geofence.definition.coordinates[0]) {
            if (!point || point.length < 2 || isNaN(point[0]) || isNaN(point[1]) || !isFinite(point[0]) || !isFinite(point[1])) {
              console.warn('Validasi: Titik koordinat poligon tidak valid.', geofence.name, point); return false;
            }
        }
        return true;
      }
      console.warn('Validasi: Tipe geofence tidak diketahui.', geofence.name, geofence.type);
      return false;
    } catch (error) {
      console.error('Error validasi koordinat geofence:', error, geofence);
      return false;
    }
  };
  
  const processedVehicleForMap = useMemo((): ProcessedVehicle[] => {
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
      position: [lat, lng],
      speed: data.speed ?? 0,
      ignition: data.ignition_status === 'ON' || data.ignition_status === 'true' || data.ignition_status === '1',
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

  const processedGeofenceForMap = useMemo((): ProjectGeofence[] => {
    if (assignedGeofence && validateGeofenceCoordinates(assignedGeofence)) {
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
    if (isNaN(latitude) || isNaN(longitude)) return 'Koordinat Tidak Valid';
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const getVehicleStatus = (data: VehicleData | undefined): "moving" | "parked" | "offline" => {
    if (!data || !data.timestamp) return 'offline';
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    if (diffMinutes > 15) return 'offline';
    return (data.speed ?? 0) > 2 ? 'moving' : 'parked';
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

  const fetchVehiclesFromApi = async (currentUserId?: string | null) => {
    if (!currentUserId) return [];
    try {
      const token = getAuthToken();
      const url = `${VEHICLE_API_ENDPOINT_BASE}?filter[user_id][_eq]=${currentUserId}`;
      const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) {
        console.error('Gagal mengambil daftar kendaraan:', response.status, await response.text());
        return [];
      }
      const data = await response.json();
      return (data.data || []) as Vehicle[];
    } catch (error) {
      console.error('Error mengambil daftar kendaraan:', error);
      return [];
    }
  };

  const fetchAllVehicleData = async (vehicleList: Vehicle[]) => {
    if (!vehicleList || vehicleList.length === 0) return [];
    try {
      const gpsIds = vehicleList.map(v => v.gps_id).filter(id => id != null && id.trim() !== '');
      if (gpsIds.length === 0) return [];
      
      // Ambil data terbaru untuk semua gps_id yang ada
      // Directus: &groupBy=gps_id&aggregate[max]=timestamp -> tidak bisa langsung ambil row utuh
      // Jadi, ambil semua data dalam rentang waktu tertentu atau limit besar lalu proses di client.
      // Atau, jika Anda memiliki endpoint khusus untuk "latest data per gps_id" akan lebih baik.
      // Untuk demo, kita ambil N data terbaru dan filter.
      const url = `${VEHICLE_DATA_API_ENDPOINT_BASE}?filter[gps_id][_in]=${gpsIds.join(',')}&limit=${gpsIds.length * 5}&sort=-timestamp`;
      
      const token = getAuthToken();
      const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) {
        console.error('Gagal mengambil data posisi kendaraan:', response.status, await response.text());
        return [];
      }
      const data = await response.json();
      return (data.data || []) as VehicleData[];
    } catch (error) {
      console.error('Error mengambil data posisi kendaraan:', error);
      return [];
    }
  };
  
  const fetchGeofenceDetails = async (geofenceId: string | number): Promise<ProjectGeofence | null> => {
    if (!geofenceId) return null;
    console.log(`Fetching geofence details for ID: ${geofenceId}`);
    try {
      const token = getAuthToken();
      const response = await fetch(`${GEOFENCE_API_BASE_URL}/${geofenceId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        console.error(`Gagal mengambil detail geofence ${geofenceId}:`, response.status, await response.text());
        return null;
      }
      const result = await response.json();
      console.log("Geofence data fetched: ", result.data);
      if (result.data && validateGeofenceCoordinates(result.data as ProjectGeofence)) {
        return result.data as ProjectGeofence;
      } else {
        console.warn("Data geofence tidak valid atau tidak ditemukan:", result.data);
        return null;
      }
    } catch (error) {
      console.error('Error mengambil detail geofence:', error);
      return null;
    }
  };


  const mergeAndProcessData = (fetchedVehicles: Vehicle[], allVehicleData: VehicleData[]): VehicleWithTracking[] => {
    return fetchedVehicles.map(vehicle => {
      const latestData = allVehicleData
        .filter(data => data.gps_id && data.gps_id === vehicle.gps_id) // Pastikan gps_id ada
        .sort((a, b) => {
          if (!a.timestamp) return 1; if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })[0];

      const status = getVehicleStatus(latestData);
      const isOnline = isVehicleOnline(latestData);
      const lastUpdateString = latestData?.timestamp ? getRelativeTime(latestData.timestamp) : 'Belum ada data';
      const location = latestData?.latitude && latestData?.longitude ? getLocationName(latestData.latitude, latestData.longitude) : 'Tidak ada data GPS';
      
      return { 
        ...vehicle, 
        latestData, 
        status, 
        location, 
        lastUpdateString, // Ganti nama variabel
        isOnline,
        // geofence_id sudah ada dari tipe Vehicle
      };
    });
  };

  const loadTrackingData = async (isRefresh = false) => {
    if (!userId) {
      setError("User ID tidak ditemukan. Silakan login kembali.");
      setLoading(!isRefresh); // Hanya set loading utama jika bukan refresh
      if(isRefresh) setRefreshing(false);
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

      const allVehicleDataPoints = await fetchAllVehicleData(fetchedUserVehicles);
      const combinedData = mergeAndProcessData(fetchedUserVehicles, allVehicleDataPoints);
      const sortedVehicles = combinedData.sort((a, b) => (parseInt(a.vehicle_id) || 0) - (parseInt(b.vehicle_id) || 0));
      
      setVehicles(sortedVehicles);

      let vehicleToSelect = sortedVehicles.find(v => v.vehicle_id === selectedVehicleId);
      if (!vehicleToSelect && sortedVehicles.length > 0) {
        vehicleToSelect = sortedVehicles[0]; // Default ke kendaraan pertama jika pilihan lama tidak ada
      }
      
      if (vehicleToSelect) {
        setSelectedVehicleId(vehicleToSelect.vehicle_id);
        setSelectedVehicleName(vehicleToSelect.name);

        if (vehicleToSelect.latestData?.latitude && vehicleToSelect.latestData?.longitude) {
          const newCoords: [number, number] = [
            parseFloat(vehicleToSelect.latestData.latitude),
            parseFloat(vehicleToSelect.latestData.longitude)
          ];
          setSelectedVehicleCoords(newCoords);
        } else {
          setSelectedVehicleCoords(null);
        }
        
        // Muat geofence untuk kendaraan yang dipilih
        if (vehicleToSelect.geofence_id) {
          const geofenceData = await fetchGeofenceDetails(vehicleToSelect.geofence_id);
          setAssignedGeofence(geofenceData);
        } else {
          setAssignedGeofence(null);
        }
      } else {
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
    if (typeof window !== 'undefined') {
        const userData = sessionStorage.getItem('user');
        if (userData) {
            try { setCurrentUser(JSON.parse(userData)); } 
            catch (e) { console.error('Gagal parsing user data dari session:', e); }
        }
        const trackVehicleId = sessionStorage.getItem('trackVehicleId');
        const trackVehicleName = sessionStorage.getItem('trackVehicleName');
        if (trackVehicleId) setSelectedVehicleId(trackVehicleId);
        if (trackVehicleName) setSelectedVehicleName(trackVehicleName);
    }
  }, []);

  useEffect(() => {
    if (userId) {
        loadTrackingData();
        const interval = setInterval(() => loadTrackingData(true), 30000);
        return () => clearInterval(interval);
    } else if (!loading && currentUser === null) {
        // setLoading(true); // Untuk menunjukkan bahwa kita masih menunggu user ID dari useMemo
    } else if (!userId && !loading && currentUser !== null) { // currentUser sudah dicek, tapi userId tetap null
        setError("User tidak teridentifikasi. Tidak dapat memuat data kendaraan.");
        setLoading(false);
    }
  }, [userId]);


  useEffect(() => {
    const updateGeofenceForSelectedVehicle = async () => {
      if (selectedVehicleId) {
        const vehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId);
        if (vehicle && vehicle.geofence_id) {
          // Hanya fetch jika geofence_id berubah atau belum ada assignedGeofence
          if (!assignedGeofence || assignedGeofence.geofence_id?.toString() !== vehicle.geofence_id?.toString()) {
            setRefreshing(true);
            const geofenceData = await fetchGeofenceDetails(vehicle.geofence_id);
            setAssignedGeofence(geofenceData);
            setRefreshing(false);
          }
        } else {
          setAssignedGeofence(null);
        }
      } else {
        setAssignedGeofence(null);
      }
    };
    updateGeofenceForSelectedVehicle();
  }, [selectedVehicleId, vehicles]); // vehicles ditambahkan sebagai dependency


  const handleVehicleSelect = (vehicle: VehicleWithTracking) => {
    // Jika kendaraan yang sama diklik lagi, jangan lakukan apa-apa (atau toggle detail?)
    // if (vehicle.vehicle_id === selectedVehicleId) return;

    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);
    if (vehicle.latestData?.latitude && vehicle.latestData?.longitude) {
      setSelectedVehicleCoords([parseFloat(vehicle.latestData.latitude), parseFloat(vehicle.latestData.longitude)]);
    } else {
      setSelectedVehicleCoords(null);
    }
    // Pengambilan geofence akan ditangani oleh useEffect di atas yang bergantung pada selectedVehicleId
  };
  
  const handleMapVehicleClick = (clickedVehicle: ProcessedVehicle) => {
    const fullVehicleData = vehicles.find(v => v.vehicle_id === clickedVehicle.id);
    if(fullVehicleData) {
        handleVehicleSelect(fullVehicleData);
    }
    console.log('Kendaraan diklik di peta:', clickedVehicle.name);
  };

  const handleMapClick = () => {
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

  if (loading && vehicles.length === 0) { // Tampilkan loading utama hanya jika belum ada data sama sekali
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
          disabled={refreshing || loading} // Disable juga saat loading awal
          className="text-sm w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${(refreshing || (loading && vehicles.length > 0)) ? 'animate-spin' : ''}`} />
          {(refreshing || (loading && vehicles.length > 0)) ? 'Menyegarkan...' : 'Segarkan Data'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden shadow-lg border rounded-xl">
            <CardHeader className="pb-2 pt-4 px-4 border-b bg-slate-50 rounded-t-xl">
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
            <CardContent className="p-0">
              <div className="rounded-b-xl overflow-hidden" style={{height: 'calc(100vh - 330px)', minHeight: '450px'}}>
                <MapComponent 
                  vehicles={processedVehicleForMap}
                  selectedVehicleId={selectedVehicleId}
                  centerCoordinates={selectedVehicleCoords} 
                  zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : (vehicles.length > 0 ? 6 : 5)}
                  onVehicleClick={handleMapVehicleClick}
                  onMapClick={handleMapClick}
                  displayGeofences={processedGeofenceForMap}
                  // Hapus height dan minHeight dari sini karena sudah diatur di div pembungkus
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
                                  ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500 shadow-lg' 
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                    onClick={() => handleVehicleSelect(vehicle)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Car className={`w-4 h-4 shrink-0 ${selectedVehicleId === vehicle.vehicle_id ? 'text-blue-700' : 'text-slate-500'}`} />
                        <span className="font-medium text-sm text-slate-800 truncate" title={vehicle.name}>{vehicle.name}</span>
                        {selectedVehicleId === vehicle.vehicle_id && (
                          <Eye className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        )}
                      </div>
                      <Badge className={`text-xs px-1.5 py-0.5 font-medium ${getStatusColorClass(vehicle.isOnline ? vehicle.status : 'offline')}`}>
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
            <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.isOnline && v.status === 'moving').length}</p> <p className="text-xs text-slate-500 uppercase">Bergerak</p> </div>
                    <div className="p-2 bg-green-100 rounded-full"><Navigation className="w-4 h-4 text-green-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-yellow-600">{vehicles.filter(v => v.isOnline && v.status === 'parked').length}</p> <p className="text-xs text-slate-500 uppercase">Parkir</p> </div>
                    <div className="p-2 bg-yellow-100 rounded-full"><Car className="w-4 h-4 text-yellow-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-red-600">{vehicles.filter(v => !v.isOnline || v.status === 'offline').length}</p> <p className="text-xs text-slate-500 uppercase">Offline</p> </div>
                    <div className="p-2 bg-red-100 rounded-full"><Zap className="w-4 h-4 text-red-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
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