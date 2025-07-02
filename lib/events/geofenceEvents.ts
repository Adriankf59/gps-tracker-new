// lib/events/geofenceEvents.ts
import { EventEmitter } from 'events';

class GeofenceEventEmitter extends EventEmitter {
  private static instance: GeofenceEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(20); // Increase max listeners to prevent warnings
  }

  static getInstance(): GeofenceEventEmitter {
    if (!GeofenceEventEmitter.instance) {
      GeofenceEventEmitter.instance = new GeofenceEventEmitter();
    }
    return GeofenceEventEmitter.instance;
  }

  // Emit geofence deleted event
  emitGeofenceDeleted(geofenceId: number) {
    console.log('🗑️ Emitting geofence deleted event:', geofenceId);
    this.emit('geofence:deleted', geofenceId);
  }

  // Emit geofence created event
  emitGeofenceCreated(geofence: any) {
    console.log('✨ Emitting geofence created event:', geofence);
    this.emit('geofence:created', geofence);
  }

  // Emit geofence updated event
  emitGeofenceUpdated(geofence: any) {
    console.log('🔄 Emitting geofence updated event:', geofence);
    this.emit('geofence:updated', geofence);
  }

  // Subscribe to geofence events
  onGeofenceDeleted(callback: (geofenceId: number) => void) {
    this.on('geofence:deleted', callback);
    return () => this.off('geofence:deleted', callback);
  }

  onGeofenceCreated(callback: (geofence: any) => void) {
    this.on('geofence:created', callback);
    return () => this.off('geofence:created', callback);
  }

  onGeofenceUpdated(callback: (geofence: any) => void) {
    this.on('geofence:updated', callback);
    return () => this.off('geofence:updated', callback);
  }
}

export const geofenceEvents = GeofenceEventEmitter.getInstance();