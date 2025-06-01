// hooks/useRealTimeAlerts.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GeofenceEvent, 
  DetectionResult, 
  useGeofenceDetection,
  setVehiclesDetailForDetection,
  Vehicle,
  Geofence
} from '@/lib/geofenceDetector';
import { toast } from 'sonner';

interface AlertNotification {
  id: string;
  event: GeofenceEvent;
  timestamp: Date;
  acknowledged: boolean;
}

interface UseRealTimeAlertsProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  onNewAlert?: (alert: AlertNotification) => void;
  enableNotifications?: boolean;
  simulateVehicleMovement?: boolean;
}

export function useRealTimeAlerts({
  vehicles,
  geofences,
  onNewAlert,
  enableNotifications = true,
  simulateVehicleMovement = false
}: UseRealTimeAlertsProps) {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    detectVehicleEvents, 
    setAllGeofences, 
    getApiStatus,
    retryFailedApiCalls 
  } = useGeofenceDetection();

  // Initialize detector with vehicles and geofences
  useEffect(() => {
    if (vehicles.length > 0) {
      setVehiclesDetailForDetection(vehicles);
    }
  }, [vehicles]);

  useEffect(() => {
    if (geofences.length > 0) {
      const activeGeofences = geofences.filter(g => g.status === 'active');
      setAllGeofences(activeGeofences);
    }
  }, [geofences, setAllGeofences]);

  // Handle new geofence events
  const handleGeofenceEvent = useCallback(async (
    vehicleId: string,
    position: [number, number],
    timestamp: Date = new Date()
  ): Promise<DetectionResult | null> => {
    try {
      const result = await detectVehicleEvents(vehicleId, position, timestamp);
      
      if (result.events.length > 0) {
        const newAlerts = result.events.map(event => ({
          id: event.event_id,
          event,
          timestamp: event.timestamp,
          acknowledged: false
        }));

        setAlerts(prev => [...newAlerts, ...prev]);
        setLastEventTime(timestamp);

        // Notify about new alerts
        newAlerts.forEach(alert => {
          if (onNewAlert) {
            onNewAlert(alert);
          }

          // Show toast notifications for violations
          if (alert.event.event_type.includes('violation') && enableNotifications) {
            toast.error(
              `🚨 Violation Alert: ${alert.event.vehicle_name} ${
                alert.event.event_type === 'violation_enter' ? 'entered' : 'exited'
              } ${alert.event.geofence_name}`,
              {
                duration: 10000,
                action: {
                  label: 'View',
                  onClick: () => {
                    console.log('Navigate to alert details:', alert.id);
                  }
                }
              }
            );
          } else if (enableNotifications) {
            toast.info(
              `📍 ${alert.event.vehicle_name} ${
                alert.event.event_type === 'enter' ? 'entered' : 'exited'
              } ${alert.event.geofence_name}`,
              { duration: 5000 }
            );
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Error handling geofence event:', error);
      return null;
    }
  }, [detectVehicleEvents, onNewAlert, enableNotifications]);

  // Simulate vehicle movement for testing
  const startSimulation = useCallback(() => {
    if (!simulateVehicleMovement || vehicles.length === 0 || geofences.length === 0) {
      return;
    }

    console.log('🎯 Starting vehicle movement simulation...');
    setIsMonitoring(true);

    simulationInterval.current = setInterval(() => {
      // Randomly select a vehicle
      const randomVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
      
      // Generate random position within Indonesia bounds
      const indonesiaBounds = {
        north: 6.0,
        south: -11.0,
        east: 141.0,
        west: 95.0
      };

      const randomLat = indonesiaBounds.south + 
        Math.random() * (indonesiaBounds.north - indonesiaBounds.south);
      const randomLng = indonesiaBounds.west + 
        Math.random() * (indonesiaBounds.east - indonesiaBounds.west);

      // Sometimes generate positions near geofences for more interesting events
      if (Math.random() < 0.4 && geofences.length > 0) {
        const randomGeofence = geofences[Math.floor(Math.random() * geofences.length)];
        
        if (randomGeofence.type === 'circle' && randomGeofence.definition.center) {
          // Generate position near circle center
          const [centerLng, centerLat] = randomGeofence.definition.center;
          const radius = randomGeofence.definition.radius || 1000;
          const offsetLat = (Math.random() - 0.5) * (radius / 111320) * 2; // Convert meters to degrees
          const offsetLng = (Math.random() - 0.5) * (radius / (111320 * Math.cos(centerLat * Math.PI / 180))) * 2;
          
          handleGeofenceEvent(
            randomVehicle.vehicle_id,
            [centerLng + offsetLng, centerLat + offsetLat]
          );
        } else if (randomGeofence.type === 'polygon' && randomGeofence.definition.coordinates) {
          // Generate position near polygon center
          const coords = randomGeofence.definition.coordinates[0];
          if (coords.length > 0) {
            const centerLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
            const centerLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
            const offsetLat = (Math.random() - 0.5) * 0.01; // Small offset
            const offsetLng = (Math.random() - 0.5) * 0.01;
            
            handleGeofenceEvent(
              randomVehicle.vehicle_id,
              [centerLng + offsetLng, centerLat + offsetLat]
            );
          }
        }
      } else {
        // Regular random position
        handleGeofenceEvent(randomVehicle.vehicle_id, [randomLng, randomLat]);
      }
    }, 5000); // Check every 5 seconds

  }, [vehicles, geofences, handleGeofenceEvent, simulateVehicleMovement]);

  const stopSimulation = useCallback(() => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    setIsMonitoring(false);
    console.log('🛑 Vehicle movement simulation stopped');
  }, []);

  // Auto-start simulation if enabled
  useEffect(() => {
    if (simulateVehicleMovement && vehicles.length > 0 && geofences.length > 0) {
      startSimulation();
    } else {
      stopSimulation();
    }

    return () => {
      stopSimulation();
    };
  }, [simulateVehicleMovement, vehicles.length, geofences.length, startSimulation, stopSimulation]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true }
        : alert
    ));
  }, []);

  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Get unacknowledged alerts
  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);

  // Get alerts by severity
  const getAlertsBySeverity = useCallback((severity: 'low' | 'medium' | 'high' | 'critical') => {
    return alerts.filter(alert => {
      const eventType = alert.event.event_type;
      const ruleType = alert.event.rule_triggered;
      
      if (eventType === 'violation_enter' || eventType === 'violation_exit') {
        return ruleType === 'FORBIDDEN' ? severity === 'critical' : severity === 'high';
      }
      if (eventType === 'enter' || eventType === 'exit') {
        return severity === 'medium';
      }
      return severity === 'low';
    });
  }, [alerts]);

  return {
    alerts,
    unacknowledgedAlerts,
    isMonitoring,
    lastEventTime,
    handleGeofenceEvent,
    acknowledgeAlert,
    clearAllAlerts,
    getAlertsBySeverity,
    startSimulation,
    stopSimulation,
    apiStatus: getApiStatus(),
    retryFailedApiCalls
  };
}