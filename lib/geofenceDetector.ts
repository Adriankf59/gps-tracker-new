// lib/geofenceDetector.ts

import React from 'react'; // Diperlukan untuk React.useCallback di hook
import {
  Geofence as ProjectGeofence,
  Vehicle as ProjectVehicle,
} from '@/components/GeofenceManager'; // Sesuaikan path jika tipe ini ada di file lain

// Tipe koordinat konsisten dengan proyek Anda [lng, lat]
export type ProjectCoordinate = [number, number]; // [longitude, latitude]

// Event yang dihasilkan oleh detector
export interface GeofenceEvent {
  event_id: string; // ID event unik (dibuat client-side)
  vehicle_id: ProjectVehicle['vehicle_id'];
  geofence_id: ProjectGeofence['geofence_id'];
  event_type: 'enter' | 'exit' | 'violation_enter' | 'violation_exit';
  timestamp: Date;
  position: ProjectCoordinate; // [lng, lat]
  geofence_name: string;
  vehicle_name: string;
  rule_triggered: ProjectGeofence['rule_type'];
}

// Hasil dari proses deteksi untuk satu pembaruan posisi kendaraan
export interface DetectionResult {
  triggeredAlert: boolean; // True jika ada event yang dianggap sebagai alert/pelanggaran
  events: GeofenceEvent[]; // Daftar semua event yang terdeteksi (termasuk enter/exit standar)
  warnings: string[]; // Peringatan internal dari proses deteksi
}

// Interface untuk payload saat POST ke API geofence_events
interface ApiGeofenceEventPayload {
  // event_id: di-handle oleh Directus (auto-increment atau UUID server-side)
  vehicle_id: ProjectVehicle['vehicle_id'];
  geofence_id: ProjectGeofence['geofence_id'];
  event: string; // Ini adalah 'event_type' dari GeofenceEvent kita
  event_timestamp: string; // ISO string format
  // Anda bisa menambahkan field lain di sini jika API Anda mendukungnya,
  // misalnya, details_json: JSON.stringify({ position: event.position, vehicle_name: event.vehicle_name })
}

// Variabel global sederhana untuk menyimpan detail kendaraan (nama) untuk event.
// Dalam aplikasi nyata, pertimbangkan state management yang lebih baik (Zustand, Redux, Context).
let vehiclesInMemory: Map<ProjectVehicle['vehicle_id'], Pick<ProjectVehicle, 'vehicle_id' | 'name'>> = new Map();

/**
 * Memperbarui daftar detail kendaraan yang diketahui oleh detector.
 * Ini digunakan untuk memperkaya GeofenceEvent dengan nama kendaraan.
 * @param vehicles Array dari objek ProjectVehicle.
 */
export const setVehiclesDetailForDetection = (vehicles: ProjectVehicle[]) => {
  vehiclesInMemory.clear();
  vehicles.forEach(v => {
    // Pastikan vehicle_id ada sebelum menambahkannya ke Map
    if (v.vehicle_id !== undefined && v.vehicle_id !== null) {
        vehiclesInMemory.set(v.vehicle_id, { vehicle_id: v.vehicle_id, name: v.name });
    }
  });
};

export class GeofenceDetector {
  private static instance: GeofenceDetector;
  private geofences: Map<ProjectGeofence['geofence_id'], ProjectGeofence> = new Map();
  private vehicleStates: Map<ProjectVehicle['vehicle_id'], { 
    isInside: Map<ProjectGeofence['geofence_id'], boolean>; 
    lastChecked: Date;
    lastPosition?: ProjectCoordinate;
  }> = new Map();

  public static getInstance(): GeofenceDetector {
    if (!GeofenceDetector.instance) {
      GeofenceDetector.instance = new GeofenceDetector();
    }
    return GeofenceDetector.instance;
  }

  public setGeofence(geofence: ProjectGeofence): void {
    if (geofence && typeof geofence.geofence_id === 'number') {
      this.geofences.set(geofence.geofence_id, geofence);
    } else {
      console.warn("Detector: Mencoba mengatur geofence tidak valid:", geofence);
    }
  }

  public removeGeofence(geofenceId: ProjectGeofence['geofence_id']): void {
    this.geofences.delete(geofenceId);
    this.vehicleStates.forEach(state => {
      state.isInside.delete(geofenceId);
    });
  }

  public getGeofences(): ProjectGeofence[] {
    return Array.from(this.geofences.values());
  }

  public updateVehicleData(
    vehicleId: ProjectVehicle['vehicle_id'],
    currentPosition: ProjectCoordinate,
    timestamp: Date,
  ): DetectionResult {
    const result: DetectionResult = {
      triggeredAlert: false,
      events: [],
      warnings: []
    };

    if (!currentPosition || currentPosition.length !== 2 || typeof currentPosition[0] !== 'number' || typeof currentPosition[1] !== 'number') {
      result.warnings.push(`Detector: Posisi kendaraan ${vehicleId} hilang atau tidak valid.`);
      return result;
    }

    const vehicleDetail = vehiclesInMemory.get(vehicleId);

    if (!this.vehicleStates.has(vehicleId)) {
      this.vehicleStates.set(vehicleId, {
        isInside: new Map(),
        lastChecked: timestamp,
        lastPosition: currentPosition,
      });
    }

    const vehicleState = this.vehicleStates.get(vehicleId)!;
    vehicleState.lastPosition = currentPosition; // Selalu perbarui posisi terakhir

    for (const geofence of this.geofences.values()) {
      if (!geofence || geofence.status !== 'active' || !geofence.definition) {
        if (geofence && geofence.status !== 'active') {
             // console.log(`Detector: Geofence ${geofence.name} tidak aktif, dilewati.`);
        } else if (geofence && !geofence.definition) {
             result.warnings.push(`Detector: Geofence ${geofence.name} tidak memiliki definisi, dilewati.`);
        }
        continue;
      }

      const isCurrentlyInside = this.isPointInProjectGeofence(currentPosition, geofence);
      const wasInside = vehicleState.isInside.get(geofence.geofence_id) ?? false; // Default false jika belum ada state

      let eventType: GeofenceEvent['event_type'] | null = null;

      if (isCurrentlyInside && !wasInside) { // Kendaraan baru saja MASUK
        switch (geofence.rule_type) {
          case 'STANDARD': eventType = 'enter'; break;
          case 'FORBIDDEN': eventType = 'violation_enter'; result.triggeredAlert = true; break;
          case 'STAY_IN': eventType = 'enter'; break; // Masuk STAY_IN adalah normal
        }
      } else if (!isCurrentlyInside && wasInside) { // Kendaraan baru saja KELUAR
        switch (geofence.rule_type) {
          case 'STANDARD': eventType = 'exit'; break;
          case 'FORBIDDEN': eventType = 'exit'; break; // Keluar FORBIDDEN mungkin tidak perlu alert khusus
          case 'STAY_IN': eventType = 'violation_exit'; result.triggeredAlert = true; break;
        }
      }

      if (eventType) {
        const event: GeofenceEvent = {
          event_id: `${vehicleId}-${geofence.geofence_id}-${eventType}-${timestamp.getTime()}`,
          vehicle_id: vehicleId,
          geofence_id: geofence.geofence_id,
          event_type: eventType,
          timestamp: timestamp,
          position: currentPosition,
          geofence_name: geofence.name,
          vehicle_name: vehicleDetail?.name || `Kendaraan (ID: ${vehicleId})`,
          rule_triggered: geofence.rule_type,
        };
        result.events.push(event);
      }
      vehicleState.isInside.set(geofence.geofence_id, isCurrentlyInside);
    }

    vehicleState.lastChecked = timestamp;
    return result;
  }

  private isPointInProjectGeofence(point: ProjectCoordinate, geofence: ProjectGeofence): boolean {
    // Validasi definisi sudah dilakukan di loop updateVehicleData
    const { type, definition } = geofence;
    const currentPt = { longitude: point[0], latitude: point[1] }; // Konversi ke {lng, lat} untuk fungsi internal

    switch (type) {
      case 'circle':
        if (definition!.center && definition!.center.length === 2 && typeof definition!.radius === 'number') {
          const centerPt = { longitude: definition!.center[0], latitude: definition!.center[1] };
          return this.isPointInCircle(currentPt, centerPt, definition!.radius);
        }
        console.warn(`Detector: Definisi lingkaran tidak lengkap untuk Geofence ID: ${geofence.geofence_id}`);
        return false;
      case 'polygon':
        if (definition!.coordinates && definition!.coordinates[0] && definition!.coordinates[0].length >= 3) {
          const polygonPoints: { latitude: number; longitude: number }[] = definition!.coordinates[0].map(p => {
            if (p && p.length === 2) return { longitude: p[0], latitude: p[1] };
            console.warn(`Detector: Koordinat poligon tidak valid pada Geofence ID: ${geofence.geofence_id}`, p);
            return null; 
          }).filter(p => p !== null) as { latitude: number; longitude: number }[];

          if (polygonPoints.length < 3) {
            console.warn(`Detector: Poligon tidak memiliki cukup titik valid (<3) pada Geofence ID: ${geofence.geofence_id}`);
            return false;
          }
          return this.isPointInPolygon(currentPt, polygonPoints);
        }
        console.warn(`Detector: Definisi poligon tidak lengkap atau tidak valid untuk Geofence ID: ${geofence.geofence_id}`);
        return false;
      default:
        console.warn(`Detector: Tipe geofence tidak dikenal: ${type} untuk Geofence ID: ${geofence.geofence_id}`);
        return false;
    }
  }

  private isPointInCircle(point: { latitude: number; longitude: number }, center: { latitude: number; longitude: number }, radius: number): boolean {
    const distance = this.calculateDistance(point, center);
    return distance <= radius;
  }

  private isPointInPolygon(point: { latitude: number; longitude: number }, polygon: { latitude: number; longitude: number }[]): boolean {
    const x = point.longitude; const y = point.latitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude; const yi = polygon[i].latitude;
      const xj = polygon[j].longitude; const yj = polygon[j].latitude;
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private calculateDistance(point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number {
    const R = 6371e3; 
    const φ1 = (point1.latitude * Math.PI) / 180; const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  public getVehicleGeofenceStatus(vehicleId: ProjectVehicle['vehicle_id']): Map<number, boolean> {
    const vehicleState = this.vehicleStates.get(vehicleId);
    return vehicleState?.isInside || new Map();
  }
  
  public clearAllGeofences(): void {
    this.geofences.clear();
    this.vehicleStates.forEach(state => state.isInside.clear());
    console.log("Detector: Semua geofence dan state terkait telah dibersihkan.");
  }

  public clearAllVehicleStates(): void {
    this.vehicleStates.clear();
    console.log("Detector: Semua state kendaraan telah dibersihkan.");
  }

  public resetVehicleState(vehicleId: ProjectVehicle['vehicle_id']): void {
    this.vehicleStates.delete(vehicleId);
    console.log(`Detector: State untuk kendaraan ID ${vehicleId} telah direset.`);
  }
}

// --- Fungsi untuk menyimpan event ke API ---
const GEOFENCE_EVENTS_API_ENDPOINT = '/api/geofence-events';

export async function saveGeofenceEventToApi(event: GeofenceEvent): Promise<boolean> {
  const payload: ApiGeofenceEventPayload = {
    vehicle_id: event.vehicle_id,
    geofence_id: event.geofence_id,
    event: event.event_type, 
    event_timestamp: event.timestamp.toISOString(),
  };

  console.log('📤 Mengirim event ke API:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(GEOFENCE_EVENTS_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer YOUR_API_TOKEN` // Tambahkan jika perlu
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Geofence event berhasil disimpan:', responseData.data); // Directus biasanya mengembalikan item dalam 'data'
      return true;
    } else {
      const errorBody = await response.text();
      console.error(`❌ Gagal menyimpan geofence event: ${response.status} ${response.statusText}. Response: ${errorBody}`);
      // Anda bisa menambahkan toast error di sini, misalnya dari errorBody jika itu JSON
      return false;
    }
  } catch (error) {
    console.error('❌ Network error atau error lain saat mengirim geofence event:', error);
    return false;
  }
}

// --- React Hook untuk menggunakan GeofenceDetector ---
const geofenceDetectorInstance = GeofenceDetector.getInstance();

export const useProjectGeofenceDetection = () => {
  const detectVehicleEvents = React.useCallback((
    vehicleId: ProjectVehicle['vehicle_id'],
    currentPosition: ProjectCoordinate,
    timestamp: Date,
  ) => {
    return geofenceDetectorInstance.updateVehicleData(vehicleId, currentPosition, timestamp);
  }, []); // Instance stabil, dependensi tidak diperlukan

  const addOrUpdateGeofence = React.useCallback((geofence: ProjectGeofence) => {
    geofenceDetectorInstance.setGeofence(geofence);
  }, []);

  const removeGeofenceById = React.useCallback((geofenceId: number) => {
    geofenceDetectorInstance.removeGeofence(geofenceId);
  }, []);
  
  const clearAllLoadedGeofencesInDetector = React.useCallback(() => {
    geofenceDetectorInstance.clearAllGeofences();
  }, []);

  const getVehicleStatusInGeofences = React.useCallback((vehicleId: ProjectVehicle['vehicle_id']) => {
    return geofenceDetectorInstance.getVehicleGeofenceStatus(vehicleId);
  }, []);

  const resetVehicleStateInDetector = React.useCallback((vehicleId: ProjectVehicle['vehicle_id']) => {
    geofenceDetectorInstance.resetVehicleState(vehicleId);
  }, []);

  return {
    detectVehicleEvents,
    addOrUpdateGeofence,
    removeGeofenceById,
    clearAllLoadedGeofencesInDetector,
    getVehicleStatusInGeofences,
    resetVehicleStateInDetector,
    // Mengekspos instance jika diperlukan akses langsung ke metode lain
    detector: geofenceDetectorInstance 
  };
};