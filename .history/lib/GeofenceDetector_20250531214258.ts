// lib/geofenceDetector.ts

import React from 'react'; // Diperlukan untuk React.useCallback dan React.useMemo di hook

// Tipe koordinat konsisten dengan proyek Anda [lng, lat]
export type ProjectCoordinate = [number, number]; // [longitude, latitude]

// Interface yang disesuaikan dengan GeofenceManager
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
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  geofence_id: string | null;
  position?: [number, number];
}

// Event yang disederhanakan berdasarkan kebutuhan proyek Anda
export interface GeofenceEvent {
  event_id: string; // ID event unik
  vehicle_id: string; // Menggunakan string sesuai Vehicle interface
  geofence_id: number; // ID Geofence (number)
  event_type: 'enter' | 'exit' | 'violation_enter' | 'violation_exit'; // Tipe event yang disesuaikan
  timestamp: Date;
  position: ProjectCoordinate; // [lng, lat]
  geofence_name: string;
  vehicle_name: string;
  rule_triggered: Geofence['rule_type'];
}

// Interface untuk API payload
interface ApiGeofenceEvent {
  event_id: string;
  vehicle_id: string;
  geofence_id: number;
  event: string;
  event_timestamp: string; // ISO string format
}

export interface DetectionResult {
  triggeredAlert: boolean;
  events: GeofenceEvent[];
  warnings: string[];
}

// API Configuration
const API_BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055';
const GEOFENCE_EVENTS_ENDPOINT = '/items/geofence_events';

// API Service untuk menyimpan events
class GeofenceEventApiService {
  private static instance: GeofenceEventApiService;
  private eventQueue: ApiGeofenceEvent[] = [];
  private isProcessing = false;

  public static getInstance(): GeofenceEventApiService {
    if (!GeofenceEventApiService.instance) {
      GeofenceEventApiService.instance = new GeofenceEventApiService();
    }
    return GeofenceEventApiService.instance;
  }

  public async saveEvent(event: GeofenceEvent): Promise<void> {
    const apiEvent: ApiGeofenceEvent = {
      event_id: event.event_id,
      vehicle_id: event.vehicle_id,
      geofence_id: event.geofence_id,
      event: event.event_type,
      event_timestamp: event.timestamp.toISOString(),
    };

    // Add to queue
    this.eventQueue.push(apiEvent);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  public async saveEvents(events: GeofenceEvent[]): Promise<void> {
    if (events.length === 0) return;

    const apiEvents: ApiGeofenceEvent[] = events.map(event => ({
      event_id: event.event_id,
      vehicle_id: event.vehicle_id,
      geofence_id: event.geofence_id,
      event: event.event_type,
      event_timestamp: event.timestamp.toISOString(),
    }));

    // Add all events to queue
    this.eventQueue.push(...apiEvents);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // Process events in batches to avoid overwhelming the API
      const batchSize = 10;
      
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, batchSize);
        await this.sendEventsToApi(batch);
      }
    } catch (error) {
      console.error('Error processing geofence events queue:', error);
      // Re-add failed events back to queue for retry
      // this.eventQueue.unshift(...failedEvents);
    } finally {
      this.isProcessing = false;
    }
  }

  private async sendEventsToApi(events: ApiGeofenceEvent[]): Promise<void> {
    try {
      const payload = {
        data: events
      };

      const response = await fetch(`${API_BASE_URL}${GEOFENCE_EVENTS_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Geofence events saved successfully:', result);
      
    } catch (error) {
      console.error('Failed to save geofence events to API:', error);
      
      // Optionally implement retry logic here
      // For now, we'll just log the error
      throw error;
    }
  }

  // Method untuk retry failed events
  public async retryFailedEvents(): Promise<void> {
    if (this.eventQueue.length > 0) {
      await this.processQueue();
    }
  }

  // Method untuk mendapatkan jumlah events yang belum terkirim
  public getPendingEventsCount(): number {
    return this.eventQueue.length;
  }
}

// Untuk menyimpan detail kendaraan (nama, dll.) agar bisa ditambahkan ke event
// Ini adalah placeholder; dalam aplikasi nyata, ini akan dikelola oleh state management Anda (misalnya, Zustand, Redux, Context API)
let vehiclesInMemory: Map<string, Pick<Vehicle, 'vehicle_id' | 'name'>> = new Map();

export const setVehiclesDetailForDetection = (vehicles: Vehicle[]) => {
  vehiclesInMemory.clear();
  vehicles.forEach(v => {
    vehiclesInMemory.set(v.vehicle_id, { vehicle_id: v.vehicle_id, name: v.name });
  });
};

export class GeofenceDetector {
  private static instance: GeofenceDetector;
  private geofences: Map<number, Geofence> = new Map(); // Key: geofence_id (number)
  // Menyimpan { geofenceId: boolean (isInside) } untuk setiap kendaraan
  private vehicleStates: Map<string, { isInside: Map<number, boolean>; lastChecked: Date, lastPosition?: ProjectCoordinate }> = new Map();
  private apiService: GeofenceEventApiService;

  constructor() {
    this.apiService = GeofenceEventApiService.getInstance();
  }

  public static getInstance(): GeofenceDetector {
    if (!GeofenceDetector.instance) {
      GeofenceDetector.instance = new GeofenceDetector();
    }
    return GeofenceDetector.instance;
  }

  public setGeofence(geofence: Geofence): void {
    if (geofence && typeof geofence.geofence_id === 'number') {
      this.geofences.set(geofence.geofence_id, geofence);
    } else {
      console.warn("Mencoba mengatur geofence tidak valid:", geofence);
    }
  }

  public setGeofences(geofences: Geofence[]): void {
    this.geofences.clear();
    geofences.forEach(geofence => {
      if (geofence && typeof geofence.geofence_id === 'number') {
        this.geofences.set(geofence.geofence_id, geofence);
      }
    });
  }

  public removeGeofence(geofenceId: number): void {
    this.geofences.delete(geofenceId);
    this.vehicleStates.forEach(state => {
      state.isInside.delete(geofenceId);
    });
  }

  public getGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  public async updateVehicleData(
    vehicleId: Vehicle['vehicle_id'], // Menggunakan tipe dari Vehicle
    currentPosition: ProjectCoordinate, // [lng, lat]
    timestamp: Date,
    // speedKph?: number // Kecepatan bisa dihitung jika diperlukan atau diambil dari data
  ): Promise<DetectionResult> {
    const result: DetectionResult = {
      triggeredAlert: false,
      events: [],
      warnings: []
    };

    if (!currentPosition || currentPosition.length !== 2 || typeof currentPosition[0] !== 'number' || typeof currentPosition[1] !== 'number') {
      result.warnings.push(`Posisi kendaraan ${vehicleId} hilang atau tidak valid`);
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
    // const previousPosition = vehicleState.lastPosition; // Bisa digunakan untuk deteksi lain jika perlu
    vehicleState.lastPosition = currentPosition; // Perbarui posisi terakhir untuk siklus berikutnya

    for (const geofence of this.geofences.values()) {
      if (!geofence || geofence.status !== 'active') continue;

      const isCurrentlyInside = this.isPointInGeofence(currentPosition, geofence);
      const wasInside = vehicleState.isInside.get(geofence.geofence_id) ?? false;

      let eventType: GeofenceEvent['event_type'] | null = null;

      if (isCurrentlyInside && !wasInside) { // Masuk
        switch (geofence.rule_type) {
          case 'STANDARD':
            eventType = 'enter';
            break;
          case 'FORBIDDEN':
            eventType = 'violation_enter';
            result.triggeredAlert = true;
            break;
          case 'STAY_IN':
            eventType = 'enter'; // Masuk ke zona "STAY_IN" adalah normal
            break;
        }
      } else if (!isCurrentlyInside && wasInside) { // Keluar
        switch (geofence.rule_type) {
          case 'STANDARD':
            eventType = 'exit';
            break;
          case 'FORBIDDEN':
            eventType = 'exit'; // Keluar dari zona "FORBIDDEN" mungkin bukan alert
            break;
          case 'STAY_IN':
            eventType = 'violation_exit'; // Keluar dari zona "STAY_IN" adalah pelanggaran
            result.triggeredAlert = true;
            break;
        }
      }

      if (eventType) {
        const event: GeofenceEvent = {
          event_id: `${vehicleId}-${geofence.geofence_id}-${eventType}-${Date.now()}`,
          vehicle_id: vehicleId,
          geofence_id: geofence.geofence_id,
          event_type: eventType,
          timestamp: timestamp,
          position: currentPosition,
          geofence_name: geofence.name,
          vehicle_name: vehicleDetail?.name || `Kendaraan ${vehicleId}`,
          rule_triggered: geofence.rule_type,
        };
        result.events.push(event);
      }
      vehicleState.isInside.set(geofence.geofence_id, isCurrentlyInside);
    }

    // Save events to API if any events were generated
    if (result.events.length > 0) {
      try {
        await this.apiService.saveEvents(result.events);
      } catch (error) {
        console.error('Failed to save events to API:', error);
        result.warnings.push('Failed to save events to server');
      }
    }

    vehicleState.lastChecked = timestamp;
    return result;
  }

  private isPointInGeofence(point: ProjectCoordinate, geofence: Geofence): boolean {
    if (!geofence.definition) {
        console.warn(`Geofence ${geofence.name} (ID: ${geofence.geofence_id}) tidak memiliki definisi.`);
        return false;
    }
    const { type, definition } = geofence;

    // Konversi ke format { longitude, latitude } untuk fungsi internal
    const currentPt = { longitude: point[0], latitude: point[1] };

    switch (type) {
      case 'circle':
        if (definition.center && definition.center.length === 2 && typeof definition.radius === 'number') {
          const centerPt = { longitude: definition.center[0], latitude: definition.center[1] };
          return this.isPointInCircle(currentPt, centerPt, definition.radius);
        }
        console.warn(`Definisi lingkaran tidak lengkap untuk Geofence ID: ${geofence.geofence_id}`);
        return false;
      case 'polygon':
        if (definition.coordinates && definition.coordinates[0] && definition.coordinates[0].length > 0) {
          const polygonPoints: { latitude: number; longitude: number }[] = definition.coordinates[0].map(p => {
            if (p && p.length === 2) {
              return { longitude: p[0], latitude: p[1] };
            }
            // Handle kasus p tidak valid jika perlu, atau filter out
            console.warn(`Koordinat poligon tidak valid pada Geofence ID: ${geofence.geofence_id}`, p);
            return { longitude: 0, latitude: 0 }; // atau throw error / skip
          }).filter(p => p.latitude !== 0 || p.longitude !== 0); // contoh filter

          if (polygonPoints.length < 3) { // Poligon valid minimal 3 titik
            console.warn(`Poligon tidak memiliki cukup titik valid pada Geofence ID: ${geofence.geofence_id}`);
            return false;
          }
          return this.isPointInPolygon(currentPt, polygonPoints);
        }
        console.warn(`Definisi poligon tidak lengkap atau tidak valid untuk Geofence ID: ${geofence.geofence_id}`);
        return false;
      default:
        console.warn(`Tipe geofence tidak dikenal: ${type} untuk Geofence ID: ${geofence.geofence_id}`);
        return false;
    }
  }

  private isPointInCircle(point: { latitude: number; longitude: number }, center: { latitude: number; longitude: number }, radius: number): boolean {
    const distance = this.calculateDistance(point, center);
    return distance <= radius; // distance dalam meter
  }

  private isPointInPolygon(point: { latitude: number; longitude: number }, polygon: { latitude: number; longitude: number }[]): boolean {
    const x = point.longitude;
    const y = point.latitude;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;

      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private calculateDistance(point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number {
    const R = 6371e3; // Radius Bumi dalam meter
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Jarak dalam meter
  }
 
  public getVehicleGeofenceStatus(vehicleId: Vehicle['vehicle_id']): Map<number, boolean> {
    const vehicleState = this.vehicleStates.get(vehicleId);
    return vehicleState?.isInside || new Map();
  }
 
  public clearAllGeofences(): void {
    this.geofences.clear();
    // Mungkin juga ingin membersihkan state kendaraan terkait geofence yang dihapus
    this.vehicleStates.forEach(state => state.isInside.clear());
  }

  public clearVehicleStates(): void {
    this.vehicleStates.clear();
  }

  public resetVehicleState(vehicleId: Vehicle['vehicle_id']): void {
    this.vehicleStates.delete(vehicleId);
  }

  // Method untuk mendapatkan informasi API service
  public getApiServiceInfo(): { pendingEvents: number; isProcessing: boolean } {
    return {
      pendingEvents: this.apiService.getPendingEventsCount(),
      isProcessing: false // You might want to expose this from the API service
    };
  }

  // Method untuk retry failed API calls
  public async retryFailedApiCalls(): Promise<void> {
    await this.apiService.retryFailedEvents();
  }
}

const geofenceDetectorInstance = GeofenceDetector.getInstance();

export const useGeofenceDetection = () => {

  const detectVehicleEvents = React.useCallback(async (
    vehicleId: Vehicle['vehicle_id'],
    currentPosition: ProjectCoordinate,
    timestamp: Date,
    // speedKph?: number // Jika Anda memutuskan untuk mengirim kecepatan
  ) => {
    return await geofenceDetectorInstance.updateVehicleData(vehicleId, currentPosition, timestamp /*, speedKph*/);
  }, []);

  const addOrUpdateGeofence = React.useCallback((geofence: Geofence) => {
    geofenceDetectorInstance.setGeofence(geofence);
  }, []);

  const setAllGeofences = React.useCallback((geofences: Geofence[]) => {
    geofenceDetectorInstance.setGeofences(geofences);
  }, []);

  const removeGeofenceById = React.useCallback((geofenceId: number) => {
    geofenceDetectorInstance.removeGeofence(geofenceId);
  }, []);
 
  const clearAllLoadedGeofences = React.useCallback(() => {
    geofenceDetectorInstance.clearAllGeofences();
  }, []);

  const getVehicleStatusInGeofences = React.useCallback((vehicleId: Vehicle['vehicle_id']) => {
    return geofenceDetectorInstance.getVehicleGeofenceStatus(vehicleId);
  }, []);

  const getApiStatus = React.useCallback(() => {
    return geofenceDetectorInstance.getApiServiceInfo();
  }, []);

  const retryFailedApiCalls = React.useCallback(async () => {
    await geofenceDetectorInstance.retryFailedApiCalls();
  }, []);

  return {
    detectVehicleEvents,
    addOrUpdateGeofence,
    setAllGeofences,
    removeGeofenceById,
    clearAllLoadedGeofences,
    getVehicleStatusInGeofences,
    getApiStatus,
    retryFailedApiCalls,
    detector: geofenceDetectorInstance
  };
};

// Ekspor default mungkin tidak diperlukan jika Anda hanya menggunakan hook atau instance secara langsung.
// export default GeofenceDetector;