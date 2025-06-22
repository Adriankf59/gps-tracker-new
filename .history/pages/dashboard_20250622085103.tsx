import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CleanMainContent } from "@/components/MainContent";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Menu, 
  LogOut, 
  Settings, 
  User, 
  Bell, 
  MapPin, 
  Loader2,
  ChevronDown,
  Clock,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  Car,
  BarChart3,
  Command,
  History,
  ShieldAlert,
  X
} from "lucide-react";

// Import GeofenceDetector dan utilities
import { 
  GeofenceDetector,
  setVehiclesDetailForDetection,
  useProjectGeofenceDetection,
  saveGeofenceEventToApi,
  GeofenceEvent
} from "@/lib/geofenceDetector";

// Constants
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://vehitrack.my.id/websocket';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://vehitrack.my.id/directus';
const RECONNECT_INTERVAL = 5000;
const PING_INTERVAL = 30000;

// Types
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
  created_at?: string;
  updated_at: string | null;
  vehicle_photo: string | null;
  geofence_id?: number | string | null;
}

interface VehicleData {
  vehicle_datas_id?: string;
  gps_id: string | null;
  vehicle_id?: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm?: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used?: number | null;
}

interface GeofenceAlert {
  alert_id?: number;
  vehicle_id: number;
  alert_type: "violation_enter" | "violation_exit" | "violation_stay_out";
  alert_message: string;
  lokasi: string;
  timestamp: string;
}

// Enhanced User interface
interface User {
  id?: string;
  user_id?: string;
  full_name?: string;
  username?: string;
  email: string;
  phone_number?: string;
  status?: string;
  email_verified?: boolean;
  created_at?: string;
  login_time?: string;
  last_activity?: string;
  permissions?: string[];
  subscription_type?: 'free' | 'premium' | 'enterprise';
}

// Alert/Notification interface
interface Alert {
  alert_id: number;
  vehicle_id: number;
  alert_type: string | null;
  alert_message: string | null;
  lokasi: string | null;
  timestamp: string | null;
}

// Mobile Bottom Navigation Component
const MobileBottomNav = ({ activeView, setActiveView }: { activeView: string; setActiveView: (view: string) => void }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'vehicles', label: 'Vehicles', icon: Car },
    { id: 'tracking', label: 'Tracking', icon: MapPin },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'commands', label: 'Commands', icon: Command },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeView === item.id
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
    );
};

export default DashboardPage;
    </div>
  );
};

// Geofence Violation Notification Component
const GeofenceViolationNotification = ({ 
  alert, 
  onDismiss 
}: { 
  alert: GeofenceAlert;
  onDismiss: () => void;
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 8000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'violation_enter': return <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />;
      case 'violation_exit': return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />;
      default: return <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-16 left-2 right-2 sm:left-auto sm:right-4 sm:w-96 transition-all duration-300 ease-in-out z-[9999]"
    >
      <Card className="shadow-2xl border-2 border-red-500 bg-red-50">
        <CardHeader className="pb-2 sm:pb-3 bg-red-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getAlertIcon(alert.alert_type)}
              <CardTitle className="text-base sm:text-lg font-bold text-slate-800">
                🚨 Pelanggaran Geofence!
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="h-6 w-6 p-0 hover:bg-red-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-3">
          <div className="space-y-2 sm:space-y-3">
            <p className="text-xs sm:text-sm font-medium text-slate-700">
              {alert.alert_message}
            </p>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(alert.timestamp).toLocaleTimeString('id-ID')}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {alert.lokasi}
              </div>
            </div>

            <Button 
              size="sm" 
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="w-full bg-red-600 hover:bg-red-700 h-8 text-xs sm:text-sm"
            >
              Tutup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

// WebSocket Hook with NEW GeofenceDetector Integration
const useWebSocketWithGeofence = (userId?: string, user?: User | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [geofences, setGeofences] = useState<ProjectGeofence[]>([]);
  const [activeGeofenceAlert, setActiveGeofenceAlert] = useState<GeofenceAlert | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const alertCooldownRef = useRef<Map<string, Date>>(new Map());

  // Use the GeofenceDetector hook
  const {
    detectVehicleEvents,
    addOrUpdateGeofence,
    removeGeofenceById,
    clearAllLoadedGeofencesInDetector,
    getVehicleStatusInGeofences,
    resetVehicleStateInDetector
  } = useProjectGeofenceDetection();

  // Load initial data from API and check for violations
  const loadInitialData = useCallback(async () => {
    if (!userId) return;
    
    console.log('📥 Loading initial data from API...');
    try {
      // Fetch vehicles
      const vehiclesResponse = await fetch(`${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1`);
      if (vehiclesResponse.ok) {
        const vehiclesData = await vehiclesResponse.json();
        const vehiclesArray = vehiclesData.data || [];
        setVehicles(vehiclesArray);
        
        // Update vehicle details for detector
        setVehiclesDetailForDetection(vehiclesArray);
      }
      
      // Fetch vehicle data
      const vehicleDataResponse = await fetch(`${API_BASE_URL}/items/vehicle_datas?limit=1000&sort=-timestamp`);
      if (vehicleDataResponse.ok) {
        const vData = await vehicleDataResponse.json();
        const vehicleDataArray = vData.data || [];
        setVehicleData(vehicleDataArray);
        
        // After loading vehicle data, check for initial violations
        console.log('🔍 Checking for initial geofence violations...');
        setTimeout(() => {
          setVehicles(currentVehicles => {
            currentVehicles.forEach(vehicle => {
              if (vehicle.geofence_id) {
                const latestData = vehicleDataArray.find((d: VehicleData) => d.gps_id === vehicle.gps_id);
                if (latestData && latestData.latitude && latestData.longitude) {
                  console.log(`Checking initial state for ${vehicle.name}...`);
                  checkGeofenceViolations(vehicle, latestData);
                }
              }
            });
            return currentVehicles;
          });
        }, 1000); // Give time for geofences to load
      }
      
      // Fetch geofences and load them into detector
      const geofencesResponse = await fetch(`${API_BASE_URL}/items/geofence?filter[user_id][_eq]=${userId}`);
      if (geofencesResponse.ok) {
        const geoData = await geofencesResponse.json();
        const processedGeofences = (geoData.data || []).map((gf: any) => ({
          ...gf,
          definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
        }));
        
        setGeofences(processedGeofences);
        
        // Clear and reload all geofences in detector
        clearAllLoadedGeofencesInDetector();
        processedGeofences.forEach((gf: ProjectGeofence) => {
          addOrUpdateGeofence(gf);
        });
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, [userId, addOrUpdateGeofence, clearAllLoadedGeofencesInDetector, checkGeofenceViolations]);

  // Save alert to API
  const saveAlertToAPI = useCallback(async (alert: GeofenceAlert) => {
    try {
      const response = await fetch(`${API_BASE_URL}/items/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        throw new Error(`Failed to save alert: ${response.status}`);
      }

      const result = await response.json();
      console.log('Alert saved successfully:', result);
      return result;
    } catch (error) {
      console.error('Error saving alert:', error);
      toast.error('Failed to save violation alert');
    }
  }, []);

  // Send email notification function
  const sendEmailNotification = useCallback(async (
    alert: GeofenceAlert,
    vehicle: Vehicle,
    geofence: ProjectGeofence,
    userEmail: string,
    userName?: string
  ) => {
    try {
      console.log('📧 Sending email notification to:', userEmail);
      
      const response = await fetch('/api/send-geofence-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userEmail,
          vehicleName: vehicle.name,
          licensePlate: vehicle.license_plate,
          geofenceName: geofence.name,
          violationType: alert.alert_type,
          location: alert.lokasi,
          timestamp: alert.timestamp,
          userName: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to send email: ${response.status} - ${errorData.details || errorData.error}`);
      }

      const result = await response.json();
      console.log('✅ Email notification sent successfully:', result);
      
      toast.success('Email notification sent', {
        description: `Alert sent to ${userEmail}`,
        duration: 3000,
      });
      
    } catch (error) {
      console.error('❌ Error sending email notification:', error);
      toast.error('Failed to send email notification', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    }
  }, []);

  // Handle geofence events from detector
  const handleGeofenceEvents = useCallback(async (events: GeofenceEvent[], vehicle: Vehicle) => {
    console.log('🎯 Handling geofence events:', events);
    
    for (const event of events) {
      // Only process violation events for alerts
      if (event.event_type === 'violation_enter' || event.event_type === 'violation_exit') {
        // Check cooldown
        const cooldownKey = `${event.vehicle_id}_${event.event_type}_${event.geofence_id}`;
        const lastAlert = alertCooldownRef.current.get(cooldownKey);
        const now = new Date();
        
        if (lastAlert) {
          const timeSinceLastAlert = now.getTime() - lastAlert.getTime();
          if (timeSinceLastAlert <= 5 * 60 * 1000) { // 5 minutes cooldown
            console.log('⏰ Alert in cooldown period, skipping...');
            continue;
          }
        }

        // Find the geofence details
        const geofence = geofences.find(gf => gf.geofence_id === event.geofence_id);
        if (!geofence) {
          console.error('Geofence not found for event:', event);
          continue;
        }

        // Create alert
        const alertMessage = event.event_type === 'violation_enter' 
          ? `PELANGGARAN: Kendaraan ${vehicle.name} memasuki geofence ${geofence.name} (${geofence.rule_type})`
          : `PELANGGARAN: Kendaraan ${vehicle.name} keluar dari geofence ${geofence.name} (${geofence.rule_type})`;

        const alert: GeofenceAlert = {
          vehicle_id: parseInt(vehicle.vehicle_id),
          alert_type: event.event_type,
          alert_message: alertMessage,
          lokasi: `${event.position[1].toFixed(4)}, ${event.position[0].toFixed(4)}`,
          timestamp: event.timestamp.toISOString()
        };

        // Update cooldown
        alertCooldownRef.current.set(cooldownKey, now);
        
        // Show notification
        console.log('📢 Showing notification...');
        setActiveGeofenceAlert(alert);
        
        // Save to database
        console.log('💾 Saving alert to database...');
        await saveAlertToAPI(alert);

        // Save geofence event
        console.log('💾 Saving geofence event...');
        await saveGeofenceEventToApi(event);

        // Show toast
        toast.error(`🚨 ${alertMessage}`, {
          duration: 5000,
        });

        // Send email notification
        if (user?.email) {
          console.log('📧 Sending email notification...');
          await sendEmailNotification(
            alert,
            vehicle,
            geofence,
            user.email,
            user.full_name || user.username
          );
        } else {
          console.log('❌ No user email available for notification');
        }

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pelanggaran Geofence!', {
            body: alertMessage,
            icon: '/icon-192x192.png',
            tag: `geofence-${vehicle.vehicle_id}-${event.event_type}`,
            requireInteraction: true
          });
        }
      }
    }
  }, [geofences, saveAlertToAPI, sendEmailNotification, user]);

  // Enhanced checkGeofenceViolations with more logging
  const checkGeofenceViolations = useCallback((vehicle: Vehicle, latestData: VehicleData) => {
    console.group(`🔍 Geofence Check for ${vehicle.name}`);
    console.log('Vehicle:', vehicle);
    console.log('Latest GPS Data:', latestData);
    console.log('Vehicle geofence_id:', vehicle.geofence_id);
    
    if (!latestData?.latitude || !latestData?.longitude) {
      console.log('❌ No GPS data available');
      console.groupEnd();
      return;
    }
    
    if (!vehicle.geofence_id) {
      console.log('❌ No geofence assigned to vehicle');
      console.groupEnd();
      return;
    }

    const currentPos: [number, number] = [
      parseFloat_(latestData.longitude),
      parseFloat_(latestData.latitude)
    ];

    if (isNaN(currentPos[0]) || isNaN(currentPos[1])) {
      console.log('❌ Invalid GPS coordinates:', currentPos);
      console.groupEnd();
      return;
    }

    console.log('📍 Current position:', currentPos);
    
    // Get current geofences from state
    setGeofences(currentGeofences => {
      console.log('🗺️ Available geofences:', currentGeofences);
      
      // Find assigned geofence
      const assignedGeofence = currentGeofences.find(gf => {
        const matches = gf.geofence_id.toString() === vehicle.geofence_id?.toString();
        console.log(`Checking geofence ${gf.geofence_id} === ${vehicle.geofence_id}: ${matches}`);
        return matches;
      });
      
      if (!assignedGeofence) {
        console.log('❌ Assigned geofence not found in geofences list');
        console.log('Looking for geofence_id:', vehicle.geofence_id);
        console.log('Available geofence IDs:', currentGeofences.map(g => g.geofence_id));
        console.groupEnd();
        return currentGeofences;
      }
      
      console.log('✅ Found assigned geofence:', assignedGeofence);

      // Use detector to check for events
      const result = detectVehicleEvents(
        vehicle.vehicle_id,
        currentPos,
        new Date(latestData.timestamp || Date.now()),
        true // Force initial check for violations
      );

      console.log('🎯 Detection result:', result);

      if (result.triggeredAlert && result.events.length > 0) {
        console.log('🚨 VIOLATIONS DETECTED!');
        handleGeofenceEvents(result.events, vehicle);
      } else {
        console.log('✅ No violations detected');
      }

      if (result.warnings.length > 0) {
        console.warn('⚠️ Detector warnings:', result.warnings);
      }
      
      console.groupEnd();
      return currentGeofences;
    });
  }, [detectVehicleEvents, handleGeofenceEvents]);

  const connect = useCallback(() => {
    if (!userId || !navigator.onLine) return;
    
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('🔌 Attempting WebSocket connection...');

    try {
      const ws = new WebSocket(`${WS_URL}?userId=${userId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Subscribe to collections in order - vehicles first
        console.log('📡 Subscribing to collections...');
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle' }));
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'geofence' }));
        
        // Delay vehicle_datas subscription to ensure vehicles are loaded first
        setTimeout(() => {
          console.log('📡 Subscribing to vehicle_datas...');
          ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle_datas' }));
        }, 1000);
        
        // Setup ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'subscription') {
            const { event, data } = message;
            
            if (event === 'init' && data && data.length > 0) {
              const firstItem = data[0];
              
              if (firstItem.vehicle_id && firstItem.license_plate) {
                const vehiclesArray = data.filter((v: Vehicle) => v.user_id === userId);
                setVehicles(vehiclesArray);
                setVehiclesDetailForDetection(vehiclesArray);
              } else if (firstItem.gps_id && firstItem.latitude) {
                setVehicleData(prev => {
                  const dataMap = new Map(prev.map(d => [d.gps_id || d.vehicle_id, d]));
                  data.forEach((d: VehicleData) => {
                    const key = d.gps_id || d.vehicle_id;
                    if (key) dataMap.set(key, d);
                  });
                  return Array.from(dataMap.values());
                });
              } else if (firstItem.geofence_id && firstItem.definition) {
                const processedGeofences = data
                  .filter((gf: any) => gf.user_id === userId)
                  .map((gf: any) => ({
                    ...gf,
                    definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
                  }));
                setGeofences(processedGeofences);
                
                // Update detector
                clearAllLoadedGeofencesInDetector();
                processedGeofences.forEach((gf: ProjectGeofence) => {
                  addOrUpdateGeofence(gf);
                });
              }
            } else if (event === 'create' || event === 'update') {
              handleRealtimeUpdate({ event, data: data[0] });
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        wsRef.current = null;
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        if (navigator.onLine && event.code !== 1000) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(RECONNECT_INTERVAL * reconnectAttemptsRef.current, 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setIsConnected(false);
    }
  }, [userId, addOrUpdateGeofence, clearAllLoadedGeofencesInDetector]);

  const handleRealtimeUpdate = useCallback((message: any) => {
    const { data } = message;
    console.group('📨 Realtime update received');
    console.log('Message:', message);
    
    if (data.vehicle_id && data.license_plate) {
      // Vehicle update
      console.log('🚗 Vehicle update:', data);
      setVehicles(prev => {
        const index = prev.findIndex(v => v.vehicle_id === data.vehicle_id);
        let updated: Vehicle[];
        if (index >= 0) {
          updated = [...prev];
          updated[index] = { ...updated[index], ...data };
        } else if (data.user_id === userId) {
          updated = [...prev, data];
        } else {
          return prev;
        }
        
        // Update vehicle details for detector
        setVehiclesDetailForDetection(updated);
        return updated;
      });
    } else if (data.gps_id && data.latitude) {
      // Vehicle data update - Check geofence violations here
      console.group('📍 GPS Data Update');
      console.log('GPS ID:', data.gps_id);
      console.log('Position:', `${data.latitude}, ${data.longitude}`);
      console.log('Timestamp:', data.timestamp);
      
      setVehicleData(prev => {
        const key = data.gps_id || data.vehicle_id;
        const existingIndex = prev.findIndex(d => (d.gps_id || d.vehicle_id) === key);
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = data;
          return updated;
        } else {
          return [data, ...prev].slice(0, 1000);
        }
      });
      
      // Use vehicles from state ref to avoid closure issues
      setVehicles(currentVehicles => {
        console.log('🔎 Searching for vehicle with GPS ID:', data.gps_id);
        console.log('Number of vehicles available:', currentVehicles.length);
        
        if (currentVehicles.length === 0) {
          console.log('⚠️ No vehicles loaded yet! Will retry on next update.');
          return currentVehicles;
        }
        
        console.log('Available vehicles:');
        currentVehicles.forEach(v => {
          console.log(`  - ${v.name}: vehicle_id=${v.vehicle_id}, gps_id="${v.gps_id}", geofence_id=${v.geofence_id}`);
        });
        
        // Also log the data GPS ID for comparison
        console.log(`Incoming GPS ID: "${data.gps_id}" (type: ${typeof data.gps_id})`);
        
        // Try multiple ways to find the vehicle
        let vehicle = currentVehicles.find(v => v.gps_id === data.gps_id);
        
        // If not found by gps_id, try by vehicle_id
        if (!vehicle && data.vehicle_id) {
          console.log('🔄 Trying to find by vehicle_id:', data.vehicle_id);
          vehicle = currentVehicles.find(v => v.vehicle_id === data.vehicle_id);
        }
        
        // If still not found, check if gps_id is a string/number mismatch
        if (!vehicle) {
          console.log('🔄 Trying with type conversion...');
          vehicle = currentVehicles.find(v => {
            const vGpsId = String(v.gps_id).trim();
            const dataGpsId = String(data.gps_id).trim();
            console.log(`  Comparing: vehicle gps_id="${vGpsId}" with data gps_id="${dataGpsId}" => ${vGpsId === dataGpsId}`);
            return vGpsId === dataGpsId;
          });
        }
        
        if (vehicle) {
          console.log('✅ Found vehicle:', vehicle.name);
          console.log('   Vehicle details:', {
            vehicle_id: vehicle.vehicle_id,
            gps_id: vehicle.gps_id,
            geofence_id: vehicle.geofence_id
          });
          
          if (vehicle.geofence_id) {
            // Check if geofence exists - use current geofences state
            setGeofences(currentGeofences => {
              const geofence = currentGeofences.find(g => g.geofence_id.toString() === vehicle.geofence_id?.toString());
              if (geofence) {
                console.log('✅ Vehicle has geofence:', geofence.name, `(${geofence.rule_type})`);
                console.log('🚀 Triggering geofence check...');
                checkGeofenceViolations(vehicle, data);
              } else {
                console.log('❌ Geofence not found! Looking for ID:', vehicle.geofence_id);
                console.log('   Available geofence IDs:', currentGeofences.map(g => g.geofence_id));
              }
              return currentGeofences;
            });
          } else {
            console.log('⚠️ Vehicle has no geofence assigned');
          }
        } else {
          console.log('❌ No vehicle found for GPS ID:', data.gps_id);
          console.log('   This GPS data might be from a vehicle not belonging to this user');
        }
        
        return currentVehicles;
      });
      
      console.groupEnd();
    } else if (data.geofence_id && data.definition) {
      // Geofence update
      console.log('🗺️ Geofence update:', data);
      const processed = {
        ...data,
        definition: typeof data.definition === 'string' ? JSON.parse(data.definition) : data.definition
      };
      
      setGeofences(prev => {
        const index = prev.findIndex(g => g.geofence_id === data.geofence_id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = processed;
          return updated;
        } else if (data.user_id === userId) {
          return [...prev, processed];
        }
        return prev;
      });
      
      // Update detector
      if (processed.status === 'active') {
        console.log('➕ Adding geofence to detector:', processed.name);
        addOrUpdateGeofence(processed);
      } else {
        console.log('➖ Removing geofence from detector:', processed.name);
        removeGeofenceById(processed.geofence_id);
      }
    }
    
    console.groupEnd();
  }, [userId, checkGeofenceViolations, addOrUpdateGeofence, removeGeofenceById]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    loadInitialData();
    const connectTimeout = setTimeout(() => {
      connect();
    }, 500);
    
    return () => {
      clearTimeout(connectTimeout);
      disconnect();
    };
  }, [userId, connect, disconnect, loadInitialData]);

  // Expose checkGeofenceViolations for debug
  const exposedCheckGeofenceViolations = checkGeofenceViolations;

  return {
    isConnected,
    vehicles,
    vehicleData,
    geofences,
    activeGeofenceAlert,
    setActiveGeofenceAlert,
    loadInitialData,
    checkGeofenceViolations: exposedCheckGeofenceViolations
  };
};

const DashboardPage = () => {
  const router = useRouter();
  const [activeView, setActiveView] = useState("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Use WebSocket with Geofence Detection - PASS USER AS PARAMETER
  const { 
    isConnected, 
    vehicles, 
    vehicleData, 
    geofences, 
    activeGeofenceAlert, 
    setActiveGeofenceAlert,
    loadInitialData,
    checkGeofenceViolations
  } = useWebSocketWithGeofence(user?.id || user?.user_id, user);
  
  // Get detector functions separately
  const { resetVehicleStateInDetector } = useProjectGeofenceDetection();

  // Add this to check if geofences are loaded into detector
  useEffect(() => {
    if (geofences.length > 0) {
      console.log('📊 Geofences loaded into detector:', geofences.length);
      geofences.forEach(gf => {
        console.log(`- ${gf.name} (ID: ${gf.geofence_id}, Type: ${gf.type}, Rule: ${gf.rule_type}, Status: ${gf.status})`);
      });
    } else {
      console.log('⚠️ No geofences loaded!');
    }
  }, [geofences]);

  // Expose debug data to window for testing (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && checkGeofenceViolations) {
      // Create global debug object
      (window as any).__GPS_DEBUG__ = {
        vehicles,
        geofences,
        vehicleData,
        user,
        isConnected,
        
        // Helper functions
        checkVehicleGeofences: () => {
          console.log('=== VEHICLE GEOFENCE CHECK ===');
          vehicles.forEach(v => {
            console.log(`${v.name} (ID: ${v.vehicle_id}, GPS: ${v.gps_id}): Geofence ${v.geofence_id || 'NONE'}`);
          });
        },
        
        checkActiveGeofences: () => {
          console.log('\n=== ACTIVE GEOFENCES ===');
          const activeGeofences = geofences.filter(g => g.status === 'active');
          if (activeGeofences.length === 0) {
            console.log('❌ No active geofences found!');
          } else {
            activeGeofences.forEach(g => {
              console.log(`ID: ${g.geofence_id} - ${g.name} (${g.rule_type})`);
              console.log('  Definition:', g.definition);
            });
          }
        },
        
        checkVehiclePositions: () => {
          console.log('\n=== LATEST VEHICLE POSITIONS ===');
          vehicles.forEach(v => {
            const data = vehicleData.find(d => d.gps_id === v.gps_id);
            if (data) {
              console.log(`${v.name}: Lat ${data.latitude}, Lng ${data.longitude}, Time: ${data.timestamp}`);
            } else {
              console.log(`${v.name}: No GPS data found for GPS ID: ${v.gps_id}`);
            }
          });
          
          // Also show all GPS IDs in vehicleData
          console.log('\n=== ALL GPS DATA AVAILABLE ===');
          const uniqueGpsIds = [...new Set(vehicleData.map(d => d.gps_id))];
          console.log('Unique GPS IDs in vehicle data:', uniqueGpsIds);
          
          // Show latest data for each GPS ID
          uniqueGpsIds.forEach(gpsId => {
            const latestData = vehicleData.find(d => d.gps_id === gpsId);
            if (latestData) {
              console.log(`GPS ID ${gpsId}: Lat ${latestData.latitude}, Lng ${latestData.longitude}`);
            }
          });
        },
        
        checkGeofenceAssignment: () => {
          console.log('\n=== GEOFENCE ASSIGNMENT CHECK ===');
          vehicles.forEach(v => {
            if (v.geofence_id) {
              const gf = geofences.find(g => g.geofence_id.toString() === v.geofence_id.toString());
              if (gf) {
                console.log(`✅ ${v.name}: Assigned to "${gf.name}" (${gf.rule_type})`);
              } else {
                console.log(`❌ ${v.name}: Geofence ID ${v.geofence_id} NOT FOUND in geofences list!`);
              }
            } else {
              console.log(`⚠️ ${v.name}: No geofence assigned`);
            }
          });
        },
        
        testEmailAPI: async () => {
          console.log('Testing email API...');
          try {
            const response = await fetch('/api/send-geofence-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: user?.email || 'test@example.com',
                vehicleName: 'Test Vehicle',
                licensePlate: 'TEST 123',
                geofenceName: 'Test Geofence',
                violationType: 'violation_enter',
                location: '-6.8920, 107.6949',
                timestamp: new Date().toISOString(),
                userName: user?.full_name || user?.username || 'Test User'
              })
            });
            const data = await response.json();
            console.log('Email API Response:', data);
            if (response.ok) {
              console.log('✅ Email sent successfully!');
            } else {
              console.log('❌ Email failed:', data);
            }
          } catch (err) {
            console.error('Email API Error:', err);
          }
        },
        
        simulateGeofenceViolation: (vehicleIndex = 0, forceInside = true) => {
          const vehicle = vehicles[vehicleIndex];
          if (!vehicle) {
            console.error('Vehicle not found at index:', vehicleIndex);
            return;
          }
          
          if (!vehicle.geofence_id) {
            console.error('Vehicle has no geofence assigned');
            return;
          }
          
          const geofence = geofences.find(g => g.geofence_id.toString() === vehicle.geofence_id.toString());
          if (!geofence) {
            console.error('Geofence not found for vehicle');
            return;
          }
          
          console.log(`Simulating violation for ${vehicle.name} on geofence ${geofence.name} (${geofence.rule_type})`);
          
          // Get a position that will trigger a violation
          let testPosition: [number, number];
          
          if (geofence.rule_type === 'FORBIDDEN') {
            // For FORBIDDEN zones, we need to be INSIDE to trigger a violation
            if (forceInside) {
              // Use the current actual position if it's inside (from your debug: -6.89200, 107.69475)
              const currentData = vehicleData.find(d => d.gps_id === vehicle.gps_id);
              if (currentData && currentData.latitude && currentData.longitude) {
                testPosition = [parseFloat(currentData.longitude), parseFloat(currentData.latitude)];
                console.log('Using current vehicle position (should be inside forbidden zone):', testPosition);
              } else if (geofence.type === 'circle' && geofence.definition.center) {
                // Use center for circles
                testPosition = [geofence.definition.center[0], geofence.definition.center[1]];
              } else if (geofence.type === 'polygon' && geofence.definition.coordinates?.[0]) {
                // Calculate centroid for polygons
                const coords = geofence.definition.coordinates[0];
                const centroid = coords.reduce((acc, coord) => {
                  return [acc[0] + coord[0], acc[1] + coord[1]];
                }, [0, 0]);
                testPosition = [centroid[0] / coords.length, centroid[1] / coords.length];
                console.log('Using polygon centroid:', testPosition);
              } else {
                console.error('Cannot determine test position from geofence');
                return;
              }
            } else {
              // Position outside (for testing exit events)
              testPosition = [106.0, -6.0]; // Far outside Jakarta
            }
          } else if (geofence.rule_type === 'STAY_IN') {
            // For STAY_IN zones, we need to be OUTSIDE to trigger a violation
            if (forceInside) {
              testPosition = [106.0, -6.0]; // Far outside to trigger violation
            } else {
              // Inside position
              if (geofence.type === 'circle' && geofence.definition.center) {
                testPosition = [geofence.definition.center[0], geofence.definition.center[1]];
              } else if (geofence.type === 'polygon' && geofence.definition.coordinates?.[0]?.[0]) {
                testPosition = geofence.definition.coordinates[0][0];
              } else {
                console.error('Cannot determine test position from geofence');
                return;
              }
            }
          } else {
            // STANDARD geofence - use any position
            testPosition = [107.69475, -6.892]; // Your actual vehicle position
          }
          
          const fakeGPSData: VehicleData = {
            gps_id: vehicle.gps_id,
            vehicle_id: vehicle.vehicle_id,
            latitude: testPosition[1].toString(),
            longitude: testPosition[0].toString(),
            timestamp: new Date().toISOString(),
            speed: 0,
            ignition_status: "on",
            battery_level: "100",
            fuel_level: "50"
          };
          
          console.log('Simulating GPS update with position:', fakeGPSData);
          console.log(`This should ${geofence.rule_type === 'FORBIDDEN' ? 'trigger' : 'not trigger'} a violation for FORBIDDEN zone`);
          
          // First reset the vehicle state to ensure fresh detection
          if (resetVehicleStateInDetector) {
            console.log('Resetting vehicle state first...');
            resetVehicleStateInDetector(vehicle.vehicle_id);
          }
          
          // Small delay to ensure state is reset
          setTimeout(() => {
            // Call the check function
            if (checkGeofenceViolations) {
              checkGeofenceViolations(vehicle, fakeGPSData);
            } else {
              console.error('checkGeofenceViolations function not available');
            }
          }, 100);
        },
        
        runAllChecks: () => {
          console.log('🔍 RUNNING ALL DEBUG CHECKS...\n');
          (window as any).__GPS_DEBUG__.checkVehicleGeofences();
          (window as any).__GPS_DEBUG__.checkActiveGeofences();
          (window as any).__GPS_DEBUG__.checkVehiclePositions();
          (window as any).__GPS_DEBUG__.checkGeofenceAssignment();
          console.log('\n✅ All checks completed. Check the output above for issues.');
        },
        
        resetVehicleGeofenceState: (vehicleIndex = 0) => {
          const vehicle = vehicles[vehicleIndex];
          if (!vehicle) {
            console.error('Vehicle not found at index:', vehicleIndex);
            return;
          }
          
          console.log(`Resetting geofence state for ${vehicle.name}...`);
          if (resetVehicleStateInDetector) {
            resetVehicleStateInDetector(vehicle.vehicle_id);
            console.log('✅ Vehicle state reset. Next GPS update will trigger fresh detection.');
          } else {
            console.error('Reset function not available');
          }
        },
        
        checkInitialViolations: () => {
          console.log('🚨 Checking for initial geofence violations...');
          vehicles.forEach(vehicle => {
            if (vehicle.geofence_id) {
              const latestData = vehicleData.find(d => d.gps_id === vehicle.gps_id);
              if (latestData && latestData.latitude && latestData.longitude) {
                console.log(`Checking ${vehicle.name}...`);
                
                // Reset state first to ensure fresh check
                if (resetVehicleStateInDetector) {
                  resetVehicleStateInDetector(vehicle.vehicle_id);
                }
                
                // Force initial violation check
                setTimeout(() => {
                  checkGeofenceViolations(vehicle, latestData);
                }, 100);
              }
            }
          });
        },
        
        forceGeofenceCheck: () => {
          console.log('🔄 Forcing geofence check for all vehicles...');
          vehicles.forEach((vehicle, index) => {
            if (vehicle.geofence_id) {
              const latestData = vehicleData.find(d => d.gps_id === vehicle.gps_id);
              if (latestData) {
                console.log(`Checking ${vehicle.name}...`);
                checkGeofenceViolations(vehicle, latestData);
              }
            }
          });
        },
        
        // New function to test with actual current position
        testWithCurrentPosition: (vehicleIndex = 0) => {
          const vehicle = vehicles[vehicleIndex];
          if (!vehicle) {
            console.error('Vehicle not found at index:', vehicleIndex);
            return;
          }
          
          const currentData = vehicleData.find(d => d.gps_id === vehicle.gps_id);
          if (!currentData || !currentData.latitude || !currentData.longitude) {
            console.error('No current GPS data for vehicle');
            return;
          }
          
          console.log(`Testing ${vehicle.name} with current position: ${currentData.latitude}, ${currentData.longitude}`);
          
          // Reset state first
          if (resetVehicleStateInDetector) {
            console.log('Resetting vehicle state...');
            resetVehicleStateInDetector(vehicle.vehicle_id);
          }
          
          // Small delay then check
          setTimeout(() => {
            checkGeofenceViolations(vehicle, currentData);
          }, 100);
        }
      };
      
      console.log('🐛 Debug helpers loaded! Use __GPS_DEBUG__ in console:');
      console.log('- __GPS_DEBUG__.runAllChecks() - Run all diagnostic checks');
      console.log('- __GPS_DEBUG__.checkVehicleGeofences() - Check vehicle geofence assignments');
      console.log('- __GPS_DEBUG__.checkActiveGeofences() - List active geofences');
      console.log('- __GPS_DEBUG__.checkVehiclePositions() - Show latest GPS positions');
      console.log('- __GPS_DEBUG__.checkGeofenceAssignment() - Verify geofence assignments');
      console.log('- __GPS_DEBUG__.testEmailAPI() - Test email sending');
      console.log('- __GPS_DEBUG__.simulateGeofenceViolation(vehicleIndex, forceInside) - Simulate a violation');
      console.log('- __GPS_DEBUG__.testWithCurrentPosition(vehicleIndex) - Test with actual GPS position');
      console.log('- __GPS_DEBUG__.checkInitialViolations() - Check all vehicles for initial violations');
      console.log('- __GPS_DEBUG__.resetVehicleGeofenceState(vehicleIndex) - Reset vehicle detector state');
      console.log('- __GPS_DEBUG__.forceGeofenceCheck() - Force check all vehicles');
    }
  }, [vehicles, geofences, vehicleData, user, isConnected, checkGeofenceViolations, resetVehicleStateInDetector]);

  // Check if mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animation and mounting setup
  useEffect(() => {
    setIsMounted(true);
    
    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 150);
    
    return () => clearTimeout(animationTimer);
  }, []);

  // Get user data safely
  const getUserData = useCallback(() => {
    try {
      if (typeof window === 'undefined') return null;
      
      const userData = sessionStorage.getItem("user");
      if (!userData) return null;
      
      const parsedUser = JSON.parse(userData) as User;
      if (!parsedUser || !parsedUser.email) {
        throw new Error("Invalid user data structure");
      }
      
      return parsedUser;
    } catch (error) {
      console.error("Error getting user data:", error);
      return null;
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const response = await fetch('/api/alerts?limit=3', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAlerts(result.data);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = getUserData();
        if (!userData) {
          toast.error("Session expired. Please login again.");
          router.push("/login");
          return false;
        }

        // Validate session
        if (userData.login_time) {
          const sessionAge = Date.now() - new Date(userData.login_time).getTime();
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge > maxSessionAge) {
            throw new Error("Session expired due to age");
          }
        }

        setUser(userData);

        // Handle stored view
        const storedActiveView = sessionStorage.getItem("activeView");
        if (storedActiveView && ['dashboard', 'tracking', 'vehicles', 'alerts', 'commands', 'settings', 'geofences', 'history'].includes(storedActiveView)) {
          setActiveView(storedActiveView);
          sessionStorage.removeItem("activeView");
        }

        // Load alerts
        await fetchAlerts();

        return true;
      } catch (error) {
        console.error("Authentication error:", error);
        
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("activeView");
        
        if (error instanceof Error) {
          if (error.message.includes("expired")) {
            toast.error("Your session has expired. Please login again.");
          } else {
            toast.error("Authentication failed. Please login again.");
          }
        }
        
        router.push("/login");
        return false;
      } finally {
        setLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      checkAuth();
    }
  }, [router, getUserData, fetchAlerts]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          toast.success('Notifikasi browser diaktifkan', {
            description: 'Anda akan menerima notifikasi untuk pelanggaran geofence',
          });
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    }
  }, []);

  // Request notification permission after user is authenticated
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      // Request notification permission after a short delay
      const timer = setTimeout(() => {
        requestNotificationPermission();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, requestNotificationPermission]);

  // Auto-refresh alerts
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user, fetchAlerts]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    try {
      toast.loading("Logging out...", { id: "logout" });

      sessionStorage.removeItem("user");
      sessionStorage.removeItem("activeView");
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem("user_preferences");
      }
      
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user?.id || user?.user_id })
        });
      } catch (apiError) {
        console.warn("Logout API call failed:", apiError);
      }

      toast.success("Logged out successfully", { id: "logout" });
      
      setTimeout(() => {
        router.push("/");
      }, 500);

    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error during logout", { id: "logout" });
      router.push("/");
    }
  }, [router, user]);

  // Handle view changes
  const handleViewChange = useCallback((newView: string) => {
    setActiveView(newView);
    
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('last_active_view', newView);
      }
    } catch (error) {
      console.warn("Failed to save view preference:", error);
    }
  }, []);

  // Get user initials
  const getUserInitials = useCallback((user: User): string => {
    if (user.full_name) {
      const nameParts = user.full_name.split(' ');
      return nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : nameParts[0].substring(0, 2).toUpperCase();
    }
    
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    
    return user.email.substring(0, 2).toUpperCase();
  }, []);

  // Get display name
  const getDisplayName = useCallback((user: User): string => {
    return user.full_name || user.username || user.email.split('@')[0];
  }, []);

  // Format time
  const formatLastActivity = useCallback((timestamp?: string | Date): string => {
    if (!timestamp) return 'Just now';
    
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return 'Unknown time';
    }
  }, []);

  // Get alert icon
  const getAlertIcon = useCallback((alertType: string | null) => {
    switch (alertType) {
      case 'violation_enter':
      case 'violation_exit':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-ping mx-auto"></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-800">Loading GPS Dashboard</h3>
            <p className="text-sm text-slate-600">Initializing vehicle monitoring system...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-800">Preparing Dashboard</h3>
            <p className="text-sm text-slate-600">Setting up your vehicle monitoring system...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex min-h-screen w-full bg-gray-50 transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      suppressHydrationWarning={true}
    >
      {/* Geofence Violation Notification - Shows on all pages */}
      {activeGeofenceAlert && (
        <GeofenceViolationNotification
          alert={activeGeofenceAlert}
          onDismiss={() => setActiveGeofenceAlert(null)}
        />
      )}

      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          {/* Desktop Sidebar - Hidden on Mobile */}
          <AppSidebar 
            activeView={activeView} 
            setActiveView={handleViewChange}
            className="hidden md:flex border-r border-slate-200/50 bg-white/80 backdrop-blur-sm"
            // Pass WebSocket data
            isConnected={isConnected}
            vehicles={vehicles}
            vehicleData={vehicleData}
            geofences={geofences}
            alerts={alerts}
            // Pass logout handler
            onLogout={handleLogout}
            // Pass collapsed state and setter
            isCollapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />

          {/* Main Content Area */}
          <SidebarInset className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto bg-gray-50">
              <div className="p-0 md:p-6">
                <CleanMainContent 
                  activeView={activeView} 
                  user={user}
                  onViewChange={handleViewChange}
                  className="transition-all duration-500 ease-out"
                  // Pass WebSocket data
                  isConnected={isConnected}
                  vehicles={vehicles}
                  vehicleData={vehicleData}
                  geofences={geofences}
                  alerts={alerts}
                  onRefresh={() => {
                    if (loadInitialData) {
                      loadInitialData();
                      toast.info('Refreshing data...');
                    }
                  }}
                />
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeView={activeView} setActiveView={handleViewChange} />
    </div>
  