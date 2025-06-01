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
import useSWR from 'swr';

import {
    useProjectGeofenceDetection,
    setVehiclesDetailForDetection,
    saveGeofenceEventToApi,
    GeofenceEvent as DetectorGeofenceEvent,
    ProjectCoordinate
} from '@/lib/geofenceDetector'; // Pastikan path ini benar
import { saveAlert } from '@/lib/alertService'; // Pastikan path ini benar

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

const swrConfig = {
  refreshInterval: 15000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};

const fetcher = async (url: string) => {
  const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    }
    catch (e) {
      console.warn("Gagal akses sessionStorage/localStorage:", e);
      return null;
    }
  };

  const token = getAuthToken();
  const response = await fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data; // Menangani kasus di mana data ada di dalam properti 'data' atau langsung
};

export function LiveTracking() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(null);
  const [selectedVehicleCoords, setSelectedVehicleCoords] = useState<[number, number] | null>(null);
  const [assignedGeofenceForDisplay, setAssignedGeofenceForDisplay] = useState<ProjectGeofence | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  const {
    data: vehicles = [],
    error: vehiclesError,
    isLoading: vehiclesLoading,
    mutate: mutateVehicles
  } = useSWR<Vehicle[]>( // Menambahkan tipe eksplisit untuk data
    userId ? `${VEHICLE_API_ENDPOINT_BASE}?filter[user_id][_eq]=${userId}&limit=-1` : null, // Tambahkan limit=-1 untuk semua kendaraan
    fetcher,
    swrConfig
  );

  const {
    data: geofences = [],
    error: geofencesError,
    isLoading: geofencesLoading,
    mutate: mutateGeofences
  } = useSWR<ProjectGeofence[]>( // Menambahkan tipe eksplisit untuk data
    userId ? `${GEOFENCE_API_BASE_URL}?filter[user_id][_eq]=${userId}&limit=-1&sort=-date_created` : null,
    fetcher,
    swrConfig
  );

  const gpsIds = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    return vehicles.map((v: Vehicle) => v.gps_id).filter((id): id is string => id != null && id.trim() !== ''); // Type guard
  }, [vehicles]);

  const {
    data: vehicleDataPoints = [],
    error: vehicleDataError,
    isLoading: vehicleDataLoading,
    mutate: mutateVehicleData
  } = useSWR<VehicleData[]>( // Menambahkan tipe eksplisit untuk data
    gpsIds.length > 0 ?
      `${VEHICLE_DATA_API_ENDPOINT_BASE}?filter[gps_id][_in]=${gpsIds.join(',')}&limit=${gpsIds.length * 10}&sort=-timestamp` :
      null,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 10000,
    }
  );

  const {
    data: selectedGeofenceDetail,
    error: selectedGeofenceError
  } = useSWR<ProjectGeofence | null>( // Menambahkan tipe eksplisit untuk data
    selectedVehicleId && vehicles.length > 0 ? (() => {
      const selectedVehicle = vehicles.find((v: Vehicle) => v.vehicle_id === selectedVehicleId);
      return selectedVehicle?.geofence_id ?
        `${GEOFENCE_API_BASE_URL}/${selectedVehicle.geofence_id}` :
        null;
    })() : null,
    async (url: string) => { // Menambahkan tipe untuk url
      const data = await fetcher(url);
      // Memastikan 'definition' di-parse jika berupa string JSON
      if (data && typeof data.definition === 'string') {
        try {
          data.definition = JSON.parse(data.definition);
        } catch (e) {
          console.error("Gagal parse 'definition' untuk geofence detail:", e, data.definition);
          data.definition = {}; // Atau handle error dengan cara lain
        }
      }
      return data;
    },
    {
      refreshInterval: 60000,
      revalidateOnFocus: false
    }
  );

  const validateGeofenceCoordinates = useCallback((geofence: ProjectGeofence): boolean => {
    try {
      if (!geofence.definition) {
        console.warn('Validasi: Geofence tidak memiliki definisi.', geofence.name);
        return false;
      }
      if (geofence.type === 'circle') {
        if (!geofence.definition.center || geofence.definition.center.length < 2) {
          console.warn('Validasi: Pusat lingkaran tidak valid.', geofence.name);
          return false;
        }
        const [lng, lat] = geofence.definition.center;
        if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
          console.warn('Validasi: Koordinat pusat lingkaran tidak valid.', geofence.name);
          return false;
        }
        if (geofence.definition.radius === undefined || isNaN(geofence.definition.radius) || geofence.definition.radius <= 0) {
          console.warn('Validasi: Radius lingkaran tidak valid.', geofence.name);
          return false;
        }
        return true;
      }
      if (geofence.type === 'polygon') {
        if (!geofence.definition.coordinates || !geofence.definition.coordinates[0] || geofence.definition.coordinates[0].length < 3) {
          console.warn('Validasi: Koordinat poligon tidak cukup (minimal 3 titik).', geofence.name);
          return false;
        }
        for (const point of geofence.definition.coordinates[0]) {
          if (!point || point.length < 2 || isNaN(point[0]) || isNaN(point[1]) || !isFinite(point[0]) || !isFinite(point[1])) {
            console.warn('Validasi: Titik koordinat poligon tidak valid.', geofence.name, point);
            return false;
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
  }, []);

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

  const processedVehicles = useMemo((): VehicleWithTracking[] => {
    if (!vehicles || vehicles.length === 0 || !vehicleDataPoints) return [];
    const latestDataMap = new Map<string, VehicleData>();
    vehicleDataPoints.forEach((vd: VehicleData) => {
      if (vd.gps_id && vd.timestamp) {
        if (!latestDataMap.has(vd.gps_id) || new Date(vd.timestamp) > new Date(latestDataMap.get(vd.gps_id)!.timestamp!)) {
          latestDataMap.set(vd.gps_id, vd);
        }
      }
    });
    return vehicles.map((vehicle: Vehicle) => {
      const latestData = vehicle.gps_id ? latestDataMap.get(vehicle.gps_id) : undefined;
      return {
        ...vehicle,
        latestData,
        status: getVehicleStatus(latestData),
        location: latestData?.latitude && latestData?.longitude ? getLocationName(latestData.latitude, latestData.longitude) : 'Tidak ada data GPS',
        lastUpdateString: latestData?.timestamp ? getRelativeTime(latestData.timestamp) : 'Belum ada data',
        isOnline: isVehicleOnline(latestData)
      };
      // PERBAIKAN DI SINI
    }).sort((a: VehicleWithTracking, b: VehicleWithTracking) => {
        const idA = parseInt(a.vehicle_id, 10) || 0;
        const idB = parseInt(b.vehicle_id, 10) || 0;
        return idA - idB;
    });
  }, [vehicles, vehicleDataPoints]);

  const processedVehicleForMap = useMemo((): ProcessedVehicleForMap[] => {
    if (!selectedVehicleId) return [];
    const selectedVehicle = processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
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
  }, [processedVehicles, selectedVehicleId]);

  const processedGeofenceForMapDisplay = useMemo((): ProjectGeofence[] => {
    if (!assignedGeofenceForDisplay || !validateGeofenceCoordinates(assignedGeofenceForDisplay)) {
      return [];
    }
    console.log('Menampilkan geofence ter-assign:', assignedGeofenceForDisplay.name);
    return [assignedGeofenceForDisplay];
  }, [assignedGeofenceForDisplay, validateGeofenceCoordinates]);

  const handleVehicleSelect = useCallback(async (vehicle: VehicleWithTracking) => {
    console.log('Memilih kendaraan:', vehicle.name, 'Geofence ID:', vehicle.geofence_id);
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicleName(vehicle.name);

    if (vehicle.latestData?.latitude && vehicle.latestData?.longitude) {
      setSelectedVehicleCoords([parseFloat(vehicle.latestData.latitude), parseFloat(vehicle.latestData.longitude)]);
    } else {
      setSelectedVehicleCoords(null);
    }

    // Coba ambil detail geofence jika ada geofence_id
    if (vehicle.geofence_id) {
        try {
            const geofenceUrl = `${GEOFENCE_API_BASE_URL}/${vehicle.geofence_id}`;
            const geofenceDetailData = await fetcher(geofenceUrl); // Menggunakan fetcher SWR

            if (geofenceDetailData && typeof geofenceDetailData.definition === 'string') {
                 try {
                    geofenceDetailData.definition = JSON.parse(geofenceDetailData.definition);
                } catch (e) {
                    console.error("Gagal parse 'definition' untuk geofence yang dipilih:", e, geofenceDetailData.definition);
                    geofenceDetailData.definition = {};
                }
            }

            if (geofenceDetailData && validateGeofenceCoordinates(geofenceDetailData as ProjectGeofence)) {
                setAssignedGeofenceForDisplay(geofenceDetailData as ProjectGeofence);
            } else {
                console.warn("Geofence yang dipilih tidak valid atau tidak ditemukan:", vehicle.geofence_id);
                setAssignedGeofenceForDisplay(null);
            }
        } catch (error) {
            console.error("Gagal mengambil detail geofence yang dipilih:", error);
            setAssignedGeofenceForDisplay(null);
        }
    } else {
        setAssignedGeofenceForDisplay(null); // Tidak ada geofence_id, jadi set null
    }
  }, [validateGeofenceCoordinates]); // selectedGeofenceDetail dihapus dari dependensi


  useEffect(() => {
    if (vehicles && vehicles.length > 0) {
      setVehiclesDetailForDetection(vehicles.map(v => ({
          id: v.vehicle_id,
          name: v.name,
          assignedGeofenceId: v.geofence_id ? Number(v.geofence_id) : undefined,
      })));
    }
  }, [vehicles]);

  useEffect(() => {
    if (geofences && geofences.length > 0) {
      const validGeofences = geofences.filter(validateGeofenceCoordinates);
      clearAllLoadedGeofencesInDetector();
      validGeofences.forEach(gf => addOrUpdateGeofence(gf));
      console.log(`Total ${validGeofences.length} geofence valid dimuat ke detector.`);
    }
  }, [geofences, validateGeofenceCoordinates, clearAllLoadedGeofencesInDetector, addOrUpdateGeofence]);

  useEffect(() => {
    if (processedVehicles.length === 0) return;
    const processGeofenceEvents = async () => {
      for (const vehicle of processedVehicles) {
        if (vehicle.latestData?.latitude && vehicle.latestData?.longitude && vehicle.latestData.timestamp) {
          const currentPosition: ProjectCoordinate = [parseFloat(vehicle.latestData.longitude), parseFloat(vehicle.latestData.latitude)];
          const timestamp = new Date(vehicle.latestData.timestamp);
          const detectionResult = detectVehicleEvents(vehicle.vehicle_id, currentPosition, timestamp);

          if (detectionResult.events.length > 0) {
            for (const event of detectionResult.events) {
              console.log(`EVENT: ${event.vehicle_name} ${event.event_type} geofence ${event.geofence_name}`);
              if (event.event_type.startsWith('violation_')) {
                try {
                  const alertData = {
                    vehicle_id: event.vehicle_id,
                    alert_type: event.event_type,
                    alert_message: `PELANGGARAN: Kendaraan ${event.vehicle_name} ${event.event_type.includes('enter') ? 'memasuki' : 'meninggalkan'} geofence ${event.geofence_name} (${event.rule_triggered})`,
                    lokasi: `${event.position[1].toFixed(4)}, ${event.position[0].toFixed(4)}`,
                    timestamp: event.timestamp.toISOString()
                  };
                  await saveAlert(alertData);
                } catch (error) {
                  console.error('Error saving alert:', error);
                }
              }
              await saveGeofenceEventToApi(event);
            }
          }

          if (detectionResult.triggeredAlert) {
            detectionResult.events.filter(e => e.event_type.startsWith('violation_')).forEach(event => {
              toast.error(
                `PELANGGARAN: ${event.vehicle_name} ${event.event_type === 'violation_enter' ? 'MEMASUKI' : 'MENINGGALKAN'} ${event.geofence_name} (${event.rule_triggered})`,
                {
                  duration: 7000,
                  description: `Posisi: ${event.position[1].toFixed(4)}, ${event.position[0].toFixed(4)} pada ${event.timestamp.toLocaleTimeString('id-ID')}`
                }
              );
            });
          }
        }
      }
    };
    processGeofenceEvents();
  }, [processedVehicles, detectVehicleEvents]);

  useEffect(() => {
    if (processedVehicles.length > 0) {
      let vehicleToSelect = processedVehicles.find(v => v.vehicle_id === selectedVehicleId);
      if (!vehicleToSelect) {
        vehicleToSelect = processedVehicles[0];
      }
      if (vehicleToSelect) {
        handleVehicleSelect(vehicleToSelect);
      }
    } else {
      setSelectedVehicleId(null);
      setSelectedVehicleName(null);
      setSelectedVehicleCoords(null);
      setAssignedGeofenceForDisplay(null);
    }
  }, [processedVehicles, selectedVehicleId, handleVehicleSelect]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userData = sessionStorage.getItem('user');
      if (userData) {
        try {
          setCurrentUser(JSON.parse(userData));
        }
        catch (e) {
          console.error('Gagal parsing user data dari session:', e);
        }
      }
      const trackVehicleId = sessionStorage.getItem('trackVehicleId');
      const trackVehicleName = sessionStorage.getItem('trackVehicleName');
      if (trackVehicleId && !selectedVehicleId) setSelectedVehicleId(trackVehicleId);
      if (trackVehicleName && !selectedVehicleName) setSelectedVehicleName(trackVehicleName);
    }
  }, [selectedVehicleId, selectedVehicleName]); // Tambahkan dependensi jika ingin re-run saat berubah

  const handleMapVehicleClick = (clickedVehicle: ProcessedVehicleForMap) => {
    const fullVehicleData = processedVehicles.find(v => v.vehicle_id === clickedVehicle.id);
    if (fullVehicleData) handleVehicleSelect(fullVehicleData);
  };

  const handleMapClick = () => {
    // setSelectedVehicleId(null); // Atau logika lain jika diperlukan
    // setSelectedVehicleName(null);
    // setSelectedVehicleCoords(null);
    // setAssignedGeofenceForDisplay(null);
  };

  const handleRefresh = () => {
    mutateVehicles();
    mutateVehicleData();
    mutateGeofences();
    toast.success('Data sedang diperbarui...');
  };

  const getStatusColorClass = (status: VehicleWithTracking['status']): string => {
    switch (status) {
      case 'moving': return 'bg-green-100 text-green-800 border-green-200';
      case 'parked': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'offline': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const onlineVehicles = useMemo(() => processedVehicles.filter(v => v.isOnline), [processedVehicles]);
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

  const isLoadingInitial = vehiclesLoading && vehicleDataLoading && geofencesLoading && processedVehicles.length === 0;
  const isRefreshing = !isLoadingInitial && (vehiclesLoading || vehicleDataLoading || geofencesLoading);
  const hasError = vehiclesError || vehicleDataError || geofencesError;


  if (isLoadingInitial && !hasError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 text-lg">Memuat data pelacakan...</p>
        </div>
      </div>
    );
  }

  if (hasError && processedVehicles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Gagal Memuat Data</h3>
            <p className="text-slate-600 mb-6">
              {vehiclesError?.message || vehicleDataError?.message || geofencesError?.message || 'Terjadi kesalahan saat memuat data'}
            </p>
            <Button
              onClick={handleRefresh}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Navigation className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pelacakan Langsung</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-slate-600">
                Status armada Anda ({processedVehicles.length} kendaraan)
                {currentUser && currentUser.full_name && ` - Pengguna: ${currentUser.full_name}`}
                {currentUser && !currentUser.full_name && currentUser.email && ` - Pengguna: ${currentUser.email}`}
              </p>
              {selectedVehicleName && assignedGeofenceForDisplay && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                  <Shield className="w-3 h-3 mr-1" />
                  {assignedGeofenceForDisplay.name} ({assignedGeofenceForDisplay.rule_type})
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-sm w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Menyegarkan...' : 'Segarkan Data'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden shadow-lg border rounded-xl">
            <CardContent className="p-0">
              <div className="rounded-b-xl overflow-hidden m-4 border border-slate-200" style={{ height: 'calc(100vh - 370px)', minHeight: '450px' }}>
                <MapComponent
                  vehicles={processedVehicleForMap}
                  selectedVehicleId={selectedVehicleId}
                  centerCoordinates={selectedVehicleCoords}
                  zoomLevel={selectedVehicleId && selectedVehicleCoords ? 16 : (processedVehicles.length > 0 && processedVehicles[0]?.latestData ? 6 : 5)}
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
            <CardContent className="p-3 space-y-2.5 max-h-[calc(100vh - 280px)] md:max-h-none overflow-y-auto md:overflow-visible custom-scrollbar-inner">
              {processedVehicles.length > 0 ? (
                processedVehicles.map((vehicle) => (
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
                        {vehicle.geofence_id && (
                          <Shield className="w-3.5 h-3.5 text-green-600 shrink-0" title="Memiliki geofence ter-assign" />
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
                    {vehicle.geofence_id && selectedVehicleId === vehicle.vehicle_id && assignedGeofenceForDisplay && (
                      <div className="text-xs text-blue-600 mb-1.5 flex items-center gap-1 truncate">
                        <Shield className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate" title={`Geofence: ${assignedGeofenceForDisplay.name}`}>
                          Geofence: {assignedGeofenceForDisplay.name}
                        </span>
                      </div>
                    )}
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
                  <p className="text-slate-500 text-sm">
                    {hasError ? "Gagal memuat data kendaraan." : "Tidak ada kendaraan ditemukan."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {processedVehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{movingVehiclesCount}</p>
                  <p className="text-xs text-slate-500 uppercase">Bergerak</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <Navigation className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{parkedVehiclesCount}</p>
                  <p className="text-xs text-slate-500 uppercase">Parkir</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <Car className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{avgSpeed}</p>
                  <p className="text-xs text-slate-500 uppercase">Kecepatan Rata² (km/j)</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Gauge className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{avgFuel}</p>
                  <p className="text-xs text-slate-500 uppercase">BBM Rata² (%)</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-full">
                  <Fuel className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasError && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-white shadow-lg border border-slate-200 rounded-full px-3 py-2">
            <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500' : 'bg-green-500'} ${isRefreshing ? 'animate-pulse' : ''}`}></div>
            <span className="text-xs text-slate-600 font-medium">
              {isRefreshing ? 'Memperbarui...' : 'Real-time aktif'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}