// File: hooks/useRealTimeAlerts.ts

import { useState, useEffect, useCallback, useRef } from "react";
import {
  GeofenceEvent,
  DetectionResult,
  GeofenceDetector,
  setVehiclesDetailForDetection,
  Vehicle,
  Geofence,
} from "@/lib/geofenceDetector";
import { toast } from "sonner";

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
  simulateVehicleMovement = false,
}: UseRealTimeAlertsProps) {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  // Ref untuk menyimpan instance GeofenceDetector
  const detectorRef = useRef<GeofenceDetector | null>(null);

  // Inisialisasi GeofenceDetector saat hook pertama kali dipakai
  useEffect(() => {
    detectorRef.current = new GeofenceDetector();
    return () => {
      // Jika GeofenceDetector memerlukan cleanup, tambahkan di sini (misalnya: detectorRef.current?.dispose())
      detectorRef.current = null;
    };
  }, []);

  // Set detail kendaraan untuk deteksi
  useEffect(() => {
    if (vehicles.length > 0) {
      setVehiclesDetailForDetection(vehicles);
    }
  }, [vehicles]);

  // Set geofence aktif ke detector setiap kali daftar geofence berubah
  useEffect(() => {
    if (!detectorRef.current) return;
    if (geofences.length > 0) {
      const activeGeofences = geofences.filter((g) => g.status === "active");
      detectorRef.current.setAllGeofences(activeGeofences);
    }
  }, [geofences]);

  // Fungsi untuk memanggil deteksi event pada satu kendaraan
  const handleGeofenceEvent = useCallback(
    async (
      vehicleId: string,
      position: [number, number],
      timestamp: Date = new Date()
    ): Promise<DetectionResult | null> => {
      if (!detectorRef.current) return null;

      try {
        const result: DetectionResult = await detectorRef.current.detectVehicleEvents(
          vehicleId,
          position,
          timestamp
        );

        if (result.events.length > 0) {
          const newAlerts = result.events.map((event) => ({
            id: event.event_id,
            event,
            timestamp: event.timestamp,
            acknowledged: false,
          }));

          setAlerts((prev) => [...newAlerts, ...prev]);
          setLastEventTime(timestamp);

          newAlerts.forEach((alert) => {
            if (onNewAlert) {
              onNewAlert(alert);
            }

            // Jika tipe event adalah pelanggaran dan notifikasi diaktifkan
            if (
              alert.event.event_type.includes("violation") &&
              enableNotifications
            ) {
              toast.error(
                `🚨 Violation Alert: ${alert.event.vehicle_name} ${
                  alert.event.event_type === "violation_enter"
                    ? "entered"
                    : "exited"
                } ${alert.event.geofence_name}`,
                {
                  duration: 10000,
                  action: {
                    label: "View",
                    onClick: () => {
                      console.log("Navigate to alert details:", alert.id);
                    },
                  },
                }
              );
            } else if (enableNotifications) {
              // Notifikasi normal (enter / exit)
              toast(
                `📍 ${alert.event.vehicle_name} ${
                  alert.event.event_type === "enter" ? "entered" : "exited"
                } ${alert.event.geofence_name}`,
                {
                  duration: 5000,
                }
              );
            }
          });
        }

        return result;
      } catch (error) {
        console.error("Error handling geofence event:", error);
        return null;
      }
    },
    [onNewAlert, enableNotifications]
  );

  // Fungsi simulasi gerakan kendaraan (hanya untuk testing)
  const startSimulation = useCallback(() => {
    if (
      !simulateVehicleMovement ||
      vehicles.length === 0 ||
      geofences.length === 0
    ) {
      return;
    }

    console.log("🎯 Starting vehicle movement simulation...");
    setIsMonitoring(true);

    simulationInterval.current = setInterval(() => {
      // Pilih kendaraan secara acak
      const randomVehicle =
        vehicles[Math.floor(Math.random() * vehicles.length)];

      // Batas geografis Indonesia
      const indonesiaBounds = {
        north: 6.0,
        south: -11.0,
        east: 141.0,
        west: 95.0,
      };

      const randomLat =
        indonesiaBounds.south +
        Math.random() * (indonesiaBounds.north - indonesiaBounds.south);
      const randomLng =
        indonesiaBounds.west +
        Math.random() * (indonesiaBounds.east - indonesiaBounds.west);

      // 40% peluang untuk dekat salah satu geofence (agar event lebih sering muncul)
      if (Math.random() < 0.4 && geofences.length > 0) {
        const randomGeofence =
          geofences[Math.floor(Math.random() * geofences.length)];

        if (
          randomGeofence.type === "circle" &&
          randomGeofence.definition.center
        ) {
          // Koordinat dekat pusat lingkaran
          const [centerLng, centerLat] =
            randomGeofence.definition.center;
          const radius = randomGeofence.definition.radius || 1000;
          const offsetLat =
            (Math.random() - 0.5) * (radius / 111320) * 2; // Meter → derajat sekitar lat
          const offsetLng =
            (Math.random() - 0.5) *
            (radius / (111320 * Math.cos((centerLat * Math.PI) / 180))) *
            2;

          handleGeofenceEvent(
            randomVehicle.vehicle_id,
            [centerLng + offsetLng, centerLat + offsetLat]
          );
        } else if (
          randomGeofence.type === "polygon" &&
          randomGeofence.definition.coordinates
        ) {
          // Koordinat dekat titik tengah poligon
          const coords = randomGeofence.definition.coordinates[0];
          if (coords.length > 0) {
            const centerLat =
              coords.reduce((sum, coord) => sum + coord[1], 0) /
              coords.length;
            const centerLng =
              coords.reduce((sum, coord) => sum + coord[0], 0) /
              coords.length;
            const offsetLat = (Math.random() - 0.5) * 0.01; // sedikit offset
            const offsetLng = (Math.random() - 0.5) * 0.01;

            handleGeofenceEvent(
              randomVehicle.vehicle_id,
              [centerLng + offsetLng, centerLat + offsetLat]
            );
          }
        }
      } else {
        // Posisi acak di area Indonesia
        handleGeofenceEvent(randomVehicle.vehicle_id, [
          randomLng,
          randomLat,
        ]);
      }
    }, 5000); // Setiap 5 detik
  }, [vehicles, geofences, handleGeofenceEvent, simulateVehicleMovement]);

  const stopSimulation = useCallback(() => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    setIsMonitoring(false);
    console.log("🛑 Vehicle movement simulation stopped");
  }, []);

  // Jika simulateVehicleMovement berubah, restart/stop simulasi
  useEffect(() => {
    if (
      simulateVehicleMovement &&
      vehicles.length > 0 &&
      geofences.length > 0
    ) {
      startSimulation();
    } else {
      stopSimulation();
    }
    return () => {
      stopSimulation();
    };
  }, [
    simulateVehicleMovement,
    vehicles.length,
    geofences.length,
    startSimulation,
    stopSimulation,
  ]);

  // Acknowledge sebuah alert (menandai sudah dibaca)
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  }, []);

  // Hapus semua alert
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Filter alert yang belum di-acknowledge
  const unacknowledgedAlerts = alerts.filter(
    (alert) => !alert.acknowledged
  );

  // Ambil alert berdasarkan severity
  const getAlertsBySeverity = useCallback(
    (severity: "low" | "medium" | "high" | "critical") => {
      return alerts.filter((alert) => {
        const eventType = alert.event.event_type;
        const ruleType = alert.event.rule_triggered;

        if (
          eventType === "violation_enter" ||
          eventType === "violation_exit"
        ) {
          // Jika rule FORBIDDEN → critical, selainnya → high
          return ruleType === "FORBIDDEN"
            ? severity === "critical"
            : severity === "high";
        }
        if (eventType === "enter" || eventType === "exit") {
          return severity === "medium";
        }
        return severity === "low";
      });
    },
    [alerts]
  );

  // Dapatkan status dan fungsi retry dari API detector
  const apiStatus = detectorRef.current
    ? detectorRef.current.getApiStatus()
    : { healthy: false, lastChecked: null };
  const retryFailedApiCalls = detectorRef.current
    ? detectorRef.current.retryFailedApiCalls.bind(
        detectorRef.current
      )
    : () => Promise.resolve();

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
    apiStatus,
    retryFailedApiCalls,
  };
}
