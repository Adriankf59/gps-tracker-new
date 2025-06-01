"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Shield 
} from "lucide-react";
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

import { 
    useProjectGeofenceDetection, 
    setVehiclesDetailForDetection,
    saveGeofenceEventToApi,
    GeofenceEvent as DetectorGeofenceEvent,
    ProjectCoordinate
} from '@/lib/geofenceDetector';
import { saveAlert } from '@/lib/alertService';

const MapComponent = dynamic(() => import('./MapComponent'), { // Pastikan path ini benar
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
});

interface ProjectGeofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][]; 
    center?: [number, number];   
    radius?: number;            
    type: string;               
  };
  date_created: string;
}

interface Vehicle {
  vehicle_id: string; 
  user_id: string;
  gps_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at: string; 
  updated_at: string | null; 
  vehicle_photo: string | null;
  geofence_id?: number | string | null; 
}

interface VehicleData {
  vehicle_datas_id: string;
  gps_id: string | null;
  vehicle_id?: string; 
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
  lastUpdateString: string; 
  isOnline: boolean;
}

interface ProcessedVehicleForMap {
  id: string;
  name: string;
  licensePlate: string;
  position: [number, number]; 
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
  const [allUserGeofences, setAllUserGeofences] = useState<ProjectGeofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null); 
  const [assignedGeofenceForDisplay, setAssignedGeofenceForDisplay] = useState<ProjectGeofence | null>(null);
  
  const { 
    detectVehicleEvents, 
    addOrUpdateGeofence, 
    clearAllLoadedGeofencesInDetector 
  } = useProjectGeofenceDetection();

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

  const validateGeofenceCoordinates = useCallback((geofence: ProjectGeofence): boolean => {
    try {
      if (!geofence.definition) { console.warn('Validasi: Geofence tidak memiliki definisi.', geofence.name); return false; }
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
  }, []);
  
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

  const processedGeofenceForMapDisplay = useMemo((): ProjectGeofence[] => {
    if (assignedGeofenceForDisplay && validateGeofenceCoordinates(assignedGeofenceForDisplay)) {
      return [assignedGeofenceForDisplay];
    }
    return [];
  }, [assignedGeofenceForDisplay, validateGeofenceCoordinates]);

  const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    try { return sessionStorage.getItem('authToken') || localStorage.getItem('authToken'); } 
    catch (e) { console.warn("Gagal akses sessionStorage/localStorage:", e); return null; }
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
    if (diffSeconds < 60) return `${diffSeconds} dtk lalu`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} mnt lalu`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} jam lalu`;
    return `${Math.floor(diffSeconds / 86400)} hari lalu`;
  };

  const fetchVehiclesFromApi = useCallback(async (currentUserId?: string | null): Promise<Vehicle[]> => {
    if (!currentUserId) return [];
    console.log("Fetching vehicles for user:", currentUserId);
    try {
      const token = getAuthToken();
      const url = `${VEHICLE_API_ENDPOINT_BASE}?filter[user_id][_eq]=${currentUserId}`;
      const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) { 
        console.error('Gagal mengambil daftar kendaraan:', response.status, await response.text()); 
        setError(`Gagal memuat kendaraan: ${response.status}`);
        return []; 
      }
      const data = await response.json();
      return (data.data || []) as Vehicle[];
    } catch (error) { 
      console.error('Error mengambil daftar kendaraan:', error); 
      setError("Terjadi kesalahan saat memuat kendaraan.");
      return []; 
    }
  }, []);

  const fetchAllVehicleData = useCallback(async (vehicleList: Vehicle[]): Promise<VehicleData[]> => {
    if (!vehicleList || vehicleList.length === 0) return [];
    console.log("Fetching vehicle data for GPS IDs...");
    try {
      const gpsIds = vehicleList.map(v => v.gps_id).filter(id => id != null && id.trim() !== '');
      if (gpsIds.length === 0) return [];
      
      const url = `${VEHICLE_DATA_API_ENDPOINT_BASE}?filter[gps_id][_in]=${gpsIds.join(',')}&limit=${gpsIds.length * 10}&sort=-timestamp`; // Ambil lebih banyak data per GPS ID untuk mencari yang terbaru
      
      const token = getAuthToken();
      const response = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!response.ok) { 
        console.error('Gagal mengambil data posisi kendaraan:', response.status, await response.text()); 
        setError(`Gagal memuat data posisi: ${response.status}`);
        return []; 
      }
      const data = await response.json();
      // Pastikan data yang diambil adalah yang paling baru untuk setiap gps_id
      const latestDataMap = new Map<string, VehicleData>();
      (data.data || []).forEach((vd: VehicleData) => {
        if (vd.gps_id && vd.timestamp) {
          if (!latestDataMap.has(vd.gps_id) || new Date(vd.timestamp) > new Date(latestDataMap.get(vd.gps_id)!.timestamp!)) {
            latestDataMap.set(vd.gps_id, vd);
          }
        }
      });
      return Array.from(latestDataMap.values());
    } catch (error) { 
      console.error('Error mengambil data posisi kendaraan:', error); 
      setError("Terjadi kesalahan saat memuat data posisi.");
      return []; 
    }
  }, []);
  
  const fetchAllUserGeofencesApi = useCallback(async (currentUserId?: string | null): Promise<ProjectGeofence[]> => {
    if (!currentUserId) return [];
    console.log('Memuat semua geofence untuk pengguna:', currentUserId);
    try {
      const token = getAuthToken();
      const response = await fetch(`${GEOFENCE_API_BASE_URL}?filter[user_id][_eq]=${currentUserId}&limit=-1&sort=-date_created`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        console.error('Gagal mengambil semua geofence pengguna:', response.status, await response.text());
        setError(`Gagal memuat geofence: ${response.status}`);
        return [];
      }
      const result = await response.json();
      const fetchedData = (result.data || []) as ProjectGeofence[];
      const validGeofences = fetchedData.filter(validateGeofenceCoordinates);
      console.log(`Total ${validGeofences.length} geofence valid dimuat ke detector.`);
      return validGeofences;
    } catch (error) { 
      console.error('Error mengambil semua geofence pengguna:', error); 
      setError("Terjadi kesalahan saat memuat geofence.");
      return []; 
    }
  }, [validateGeofenceCoordinates]); 
  
  const fetchGeofenceDetailsForDisplay = useCallback(async (geofenceId: string | number | null): Promise<ProjectGeofence | null> => {
    if (!geofenceId) return null;
    const cachedGeofence = allUserGeofences.find(gf => gf.geofence_id.toString() === geofenceId.toString());
    if (cachedGeofence) { // Tidak perlu validasi lagi jika sudah dari allUserGeofences (sudah divalidasi)
      return cachedGeofence;
    }
    console.log(`Geofence ${geofenceId} tidak ada di cache, fetch ulang untuk display...`);
    try {
      const token = getAuthToken();
      const response = await fetch(`${GEOFENCE_API_BASE_URL}/${geofenceId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) { console.error(`Gagal mengambil detail geofence ${geofenceId}:`, response.status, await response.text()); return null; }
      const result = await response.json();
      if (result.data && validateGeofenceCoordinates(result.data as ProjectGeofence)) {
        return result.data as ProjectGeofence;
      } else { console.warn("Data geofence tidak valid setelah fetch individual:", result.data); return null; }
    } catch (error) { console.error('Error mengambil detail geofence individual:', error); return null; }
  }, [allUserGeofences, validateGeofenceCoordinates]);

  const mergeAndProcessData = useCallback((fetchedVehicles: Vehicle[], allVehicleData: VehicleData[]): VehicleWithTracking[] => {
    return fetchedVehicles.map(vehicle => {
      const latestData = allVehicleData.find(data => data.gps_id && vehicle.gps_id && data.gps_id === vehicle.gps_id); // fetchAllVehicleData sudah ambil yang terbaru
      return { 
        ...vehicle, 
        latestData, 
        status: getVehicleStatus(latestData), 
        location: latestData?.latitude && latestData?.longitude ? getLocationName(latestData.latitude, latestData.longitude) : 'Tidak ada data GPS', 
        lastUpdateString: latestData?.timestamp ? getRelativeTime(latestData.timestamp) : 'Belum ada data', 
        isOnline: isVehicleOnline(latestData)
      };
    });
  }, []); // Dependensi bisa ditambahkan jika fungsi helper di luar di-memoize atau berubah

  const loadTrackingData = useCallback(async (isRefresh = false) => {
    if (!userId) {
      if (!isRefresh) setError("User ID tidak ditemukan. Silakan login kembali."); // Hanya set error jika bukan refresh otomatis
      setLoading(false); setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true); else if (vehicles.length === 0) setLoading(true);
    if (!isRefresh) setError(null); // Bersihkan error lama saat load manual

    try {
      const fetchedUserVehicles = await fetchVehiclesFromApi(userId);
      if (fetchedUserVehicles.length === 0) {
        setVehicles([]); setSelectedVehicleId(null); setSelectedVehicleName(null); setSelectedVehicleCoords(null); setAssignedGeofenceForDisplay(null);
        if (!isRefresh) setLoading(false); setRefreshing(false);
        console.log("Tidak ada kendaraan ditemukan untuk pengguna ini.");
        return;
      }
      setVehiclesDetailForDetection(fetchedUserVehicles);

      if (allUserGeofences.length === 0 || isRefresh) {
        const userGeofences = await fetchAllUserGeofencesApi(userId);
        setAllUserGeofences(userGeofences);
        clearAllLoadedGeofencesInDetector();
        userGeofences.forEach(gf => addOrUpdateGeofence(gf));
      }
      
      const allVehicleDataPoints = await fetchAllVehicleData(fetchedUserVehicles);
      const combinedData = mergeAndProcessData(fetchedUserVehicles, allVehicleDataPoints);
      const sortedVehicles = combinedData.sort((a, b) => (parseInt(a.vehicle_id) || 0) - (parseInt(b.vehicle_id) || 0));
      setVehicles(sortedVehicles);

      for (const vehicle of sortedVehicles) {
        if (vehicle.latestData?.latitude && vehicle.latestData?.longitude && vehicle.latestData.timestamp) {
          const currentPosition: ProjectCoordinate = [parseFloat(vehicle.latestData.longitude), parseFloat(vehicle.latestData.latitude)];
          const timestamp = new Date(vehicle.latestData.timestamp);
          const detectionResult = detectVehicleEvents(vehicle.vehicle_id, currentPosition, timestamp);
          if (detectionResult.events.length > 0) {
            for (const event of detectionResult.events) {
              console.log(`EVENT: ${event.vehicle_name} ${event.event_type} geofence ${event.geofence_name}`);
              await saveGeofenceEventToApi(event);
            }
          }
          if (detectionResult.triggeredAlert) {
            detectionResult.events.filter(e => e.event_type.startsWith('violation_')).forEach(event => {
              toast.error(
                `PELANGGARAN: ${event.vehicle_name} ${event.event_type === 'violation_enter' ? 'MEMASUKI' : 'MENINGGALKAN'} ${event.geofence_name} (${event.rule_triggered})`,
                { duration: 7000, description: `Posisi: ${event.position[1].toFixed(4)}, ${event.position[0].toFixed(4)} pada ${event.timestamp.toLocaleTimeString('id-ID')}` }
              );
            });
          }
        }
      }

      let vehicleToDisplay = sortedVehicles.find(v => v.vehicle_id === selectedVehicleId);
      if (!vehicleToDisplay && sortedVehicles.length > 0) vehicleToDisplay = sortedVehicles[0];
      
      if (vehicleToDisplay) {
        if (selectedVehicleId !== vehicleToDisplay.vehicle_id) { // Hanya update jika benar-benar berubah
            setSelectedVehicleId(vehicleToDisplay.vehicle_id);
            setSelectedVehicleName(vehicleToDisplay.name);
        }
        if (vehicleToDisplay.latestData?.latitude && vehicleToDisplay.latestData?.longitude) {
          const newCoords: [number, number] = [parseFloat(vehicleToDisplay.latestData.latitude), parseFloat(vehicleToDisplay.latestData.longitude)];
          if(!selectedVehicleCoords || selectedVehicleCoords[0] !== newCoords[0] || selectedVehicleCoords[1] !== newCoords[1]) {
            setSelectedVehicleCoords(newCoords);
          }
        } else setSelectedVehicleCoords(null);
        
        if (vehicleToDisplay.geofence_id) {
           if (!assignedGeofenceForDisplay || assignedGeofenceForDisplay.geofence_id?.toString() !== vehicleToDisplay.geofence_id?.toString()) {
             const geofenceData = await fetchGeofenceDetailsForDisplay(vehicleToDisplay.geofence_id);
             setAssignedGeofenceForDisplay(geofenceData);
           }
        } else setAssignedGeofenceForDisplay(null);
      } else {
        setSelectedVehicleId(null); setSelectedVehicleName(null); setSelectedVehicleCoords(null); setAssignedGeofenceForDisplay(null);
      }
    } catch (err) {
      console.error('Error memuat data tracking:', err);
      setError('Gagal memuat data tracking komprehensif. Silakan coba lagi.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [
      userId, 
      selectedVehicleId, // Untuk re-evaluasi pilihan vehicle
      // vehicles.length, // Hapus vehicles.length karena menyebabkan loop, gunakan useCallback untuk fungsi fetch
      fetchVehiclesFromApi, 
      fetchAllVehicleData, 
      mergeAndProcessData, 
      fetchAllUserGeofencesApi, 
      clearAllLoadedGeofencesInDetector, 
      addOrUpdateGeofence, 
      detectVehicleEvents, 
      fetchGeofenceDetailsForDisplay
    ]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const userData = sessionStorage.getItem('user');
        if (userData) {
            try { setCurrentUser(JSON.parse(userData)); } 
            catch (e) { console.error('Gagal parsing user data dari session:', e); }
        }
        const trackVehicleId = sessionStorage.getItem('trackVehicleId');
        const trackVehicleName = sessionStorage.getItem('trackVehicleName');
        // Hanya set jika selectedVehicleId belum ada, untuk menghindari override oleh auto-selection
        if (trackVehicleId && !selectedVehicleId) setSelectedVehicleId(trackVehicleId); 
        if (trackVehicleName && !selectedVehicleName) setSelectedVehicleName(trackVehicleName);
    }
  }, []); // Jalankan sekali saat mount

  useEffect(() => {
    if (userId) {
        loadTrackingData(); // Load data awal
        const interval = setInterval(() => loadTrackingData(true), 20000); // Refresh setiap 20 detik
        return () => clearInterval(interval);
    } else if (currentUser === null && typeof window !== 'undefined' && !sessionStorage.getItem('user')) {
        setError("Sesi pengguna tidak ditemukan. Silakan login.");
        setLoading(false);
    }
  }, [userId, loadTrackingData]);

  // useEffect untuk memuat ulang geofence jika kendaraan terpilih berubah (jika geofence_id ada)
  // Ini sudah ditangani dalam loadTrackingData, jadi tidak perlu useEffect terpisah ini.
  // useEffect(() => { ... }, [selectedVehicleId, vehicles, fetchGeofenceDetailsForDisplay, allUserGeofences]);

  const handleVehicleSelect = (vehicle: VehicleWithTracking) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);
    if (vehicle.latestData?.latitude && vehicle.latestData?.longitude) {
      setSelectedVehicleCoords([parseFloat(vehicle.latestData.latitude), parseFloat(vehicle.latestData.longitude)]);
    } else {
      setSelectedVehicleCoords(null);
    }
    // Fetch geofence untuk kendaraan yang baru dipilih akan ditangani oleh useEffect yang memantau selectedVehicleId
  };
  
  const handleMapVehicleClick = (clickedVehicle: ProcessedVehicleForMap) => {
    const fullVehicleData = vehicles.find(v => v.vehicle_id === clickedVehicle.id);
    if(fullVehicleData) handleVehicleSelect(fullVehicleData);
  };

  const handleMapClick = () => { /* Implementasi sama */ };
  const getStatusColorClass = (status: VehicleWithTracking['status']): string => { /* Implementasi sama */ };
  const onlineVehicles = useMemo(() => vehicles.filter(v => v.isOnline), [vehicles]);
  const movingVehiclesCount = useMemo(() => onlineVehicles.filter(v => v.status === 'moving').length, [onlineVehicles]);
  const parkedVehiclesCount = useMemo(() => onlineVehicles.filter(v => v.status === 'parked').length, [onlineVehicles]);
  const avgSpeed = useMemo(() => {
    const movingOnlineVehicles = onlineVehicles.filter(v => v.status === 'moving' && v.latestData?.speed != null);
    if (movingOnlineVehicles.length === 0) return 0;
    const totalSpeed = movingOnlineVehicles.reduce((acc, v) => acc + (v.latestData?.speed || 0), 0);
    return Math.round(totalSpeed / movingOnlineVehicles.length);
  }, [onlineVehicles]);
  const avgFuel = useMemo(() => {
    const vehiclesWithFuel = onlineVehicles.filter(v => v.latestData?.fuel_level != null && !isNaN(parseFloat(v.latestData.fuel_level)));
    if (vehiclesWithFuel.length === 0) return 0;
    const totalFuel = vehiclesWithFuel.reduce((acc, v) => acc + parseFloat(v.latestData!.fuel_level!), 0);
    return Math.round(totalFuel / vehiclesWithFuel.length);
  }, [onlineVehicles]);

  if (loading && vehicles.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 text-lg">Memuat data pelacakan...</p>
        </div>
      </div>
    );
  }

  if (error && vehicles.length === 0) { // Hanya tampilkan error besar jika tidak ada data kendaraan sama sekali
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Gagal Memuat Data</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <Button 
              onClick={() => { 
                setError(null); 
                if (userId) loadTrackingData(); 
                else { // Coba ambil ulang user dari session jika userId null
                    const userSessionData = sessionStorage.getItem('user');
                    if(userSessionData) setCurrentUser(JSON.parse(userSessionData));
                }
              }} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-4 sm:p-6 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
            <Navigation className="w-8 h-8 text-blue-600"/>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Pelacakan Langsung</h1>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-600">
                        Status armada Anda ({vehicles.length} kendaraan)
                        {currentUser && currentUser.name && ` - Pengguna: ${currentUser.name}`}
                        {currentUser && !currentUser.name && currentUser.email && ` - Pengguna: ${currentUser.email}`}
                    </p>
                </div>
            </div>
        </div>
        <Button 
          variant="outline"
          onClick={() => loadTrackingData(true)}
          disabled={refreshing || (loading && vehicles.length === 0)}
          className="text-sm w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${(refreshing || (loading && vehicles.length > 0 && !error)) ? 'animate-spin' : ''}`} />
          {(refreshing || (loading && vehicles.length > 0 && !error)) ? 'Menyegarkan...' : 'Segarkan Data'}
        </Button>
      </div>
      
      {/* Main content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden shadow-lg border rounded-xl">
            <CardHeader className="pb-2 pt-4 px-4 border-b bg-slate-50 rounded-t-xl">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Peta Lokasi {selectedVehicleName ? `- ${selectedVehicleName}` : (vehicles.length > 0 ? 'Semua Kendaraan' : 'Kendaraan')}
                </span>
                {selectedVehicleId && processedVehicleForMap.length > 0 && (
                  <Badge variant="outline" className="text-sm font-normal text-green-700 border-green-300 bg-green-50 py-1 px-2.5">
                     <Satellite className="w-3.5 h-3.5 mr-1.5 text-green-600"/> Posisi Live
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-b-xl overflow-hidden" style={{height: 'calc(100vh - 370px)', minHeight: '450px'}}>
                <MapComponent 
                  vehicles={processedVehicleForMap} // Hanya kirim kendaraan terpilih (atau semua jika logic map diubah)
                  selectedVehicleId={selectedVehicleId}
                  centerCoordinates={selectedVehicleCoords} 
                  zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : (vehicles.length > 0 && vehicles[0]?.latestData ? 6 : 5)}
                  onVehicleClick={handleMapVehicleClick}
                  onMapClick={handleMapClick}
                  displayGeofences={processedGeofenceForMapDisplay}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-4 md:max-h-[calc(100vh-180px)] md:overflow-y-auto custom-scrollbar pr-1">
          <Card className="shadow-md border rounded-xl">
            <CardHeader className="py-3 px-4 border-b bg-slate-50 rounded-t-xl sticky top-0 z-10">
              <CardTitle className="text-base font-semibold text-slate-700">Daftar Kendaraan ({vehicles.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2.5 max-h-[calc(100vh - 280px)] md:max-h-none overflow-y-auto md:overflow-visible custom-scrollbar-inner">
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
                        {vehicle.isOnline ? vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1) : 'Offline'}
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
                        <span>{vehicle.latestData?.fuel_level ? `${parseFloat(vehicle.latestData.fuel_level).toFixed(0)}%` : 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Baterai">
                        <Zap className="w-3 h-3 text-green-500 shrink-0" />
                        <span>{vehicle.latestData?.battery_level ? `${parseFloat(vehicle.latestData.battery_level).toFixed(1)}V` : 'N/A'}</span>
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Quick Stats Section */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-green-600">{movingVehiclesCount}</p> <p className="text-xs text-slate-500 uppercase">Bergerak</p> </div>
                    <div className="p-2 bg-green-100 rounded-full"><Navigation className="w-4 h-4 text-green-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-yellow-600">{parkedVehiclesCount}</p> <p className="text-xs text-slate-500 uppercase">Parkir</p> </div>
                    <div className="p-2 bg-yellow-100 rounded-full"><Car className="w-4 h-4 text-yellow-600" /></div>
                </div>
                </CardContent>
            </Card>
             <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-blue-600">{avgSpeed}</p> <p className="text-xs text-slate-500 uppercase">Kecepatan Rata² (km/j)</p> </div>
                    <div className="p-2 bg-blue-100 rounded-full"><Gauge className="w-4 h-4 text-blue-600" /></div>
                </div>
                </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div> <p className="text-2xl font-bold text-orange-600">{avgFuel}</p> <p className="text-xs text-slate-500 uppercase">BBM Rata² (%)</p> </div>
                    <div className="p-2 bg-orange-100 rounded-full"><Fuel className="w-4 h-4 text-orange-600" /></div>
                </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}