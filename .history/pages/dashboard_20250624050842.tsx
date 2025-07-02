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

// Import event emitter untuk geofence events
import { geofenceEvents } from '@/lib/events/geofenceEvents';

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
  geofence_id?: number; // Add this to track which geofence triggered the alert
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
      </div>
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

  // Load initial data from API
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
        setVehicleData(vData.data || []);
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
  }, [userId, addOrUpdateGeofence, clearAllLoadedGeofencesInDetector]);

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
      console.log('📧 Preparing to send email notification...');
      console.log('Email details:', {
        to: userEmail,
        vehicle: vehicle.name,
        geofence: geofence.name,
        violationType: alert.alert_type
      });
      
      // Validate email
      if (!userEmail || !userEmail.includes('@')) {
        throw new Error('Invalid email address');
      }
      
      const emailPayload = {
        to: userEmail,
        vehicleName: vehicle.name,
        licensePlate: vehicle.license_plate,
        geofenceName: geofence.name,
        violationType: alert.alert_type,
        location: alert.lokasi,
        timestamp: alert.timestamp,
        userName: userName || 'User'
      };
      
      console.log('📤 Sending email with payload:', emailPayload);
      
      const response = await fetch('/api/send-geofence-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload)
      });

      const responseData = await response.json();
      console.log('📨 Email API response:', responseData);

      if (!response.ok) {
        throw new Error(`Email API error: ${response.status} - ${responseData.error || 'Unknown error'}`);
      }

      console.log('✅ Email notification sent successfully');
      
      // Show success toast
      toast.success('Email notification sent', {
        description: `Alert sent to ${userEmail}`,
        duration: 3000,
      });
      
      return responseData;
      
    } catch (error) {
      console.error('❌ Error sending email notification:', error);
      
      // Log lebih detail untuk debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      // Show error toast dengan detail
      toast.error('Failed to send email notification', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
      
      // Jangan throw error agar tidak mengganggu flow lain
      return null;
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
          timestamp: event.timestamp.toISOString(),
          geofence_id: event.geofence_id // Store geofence ID in alert
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

  // Enhanced checkGeofenceViolations with forceInitialCheck support
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
      console.log('   Geofence type:', assignedGeofence.type);
      console.log('   Rule type:', assignedGeofence.rule_type);
      console.log('   Status:', assignedGeofence.status);

      // Use detector to check for events with forceInitialCheck
      const result = detectVehicleEvents(
        vehicle.vehicle_id,
        currentPos,
        new Date(latestData.timestamp || Date.now()),
        true // Force initial check untuk deteksi kondisi awal
      );

      console.log('🎯 Detection result:', result);
      console.log('   Triggered alert:', result.triggeredAlert);
      console.log('   Events:', result.events);
      console.log('   Warnings:', result.warnings);

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

  // Handle realtime update
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
      // GPS Data update
      console.group('📍 GPS Data Update');
      console.log('GPS ID:', data.gps_id);
      console.log('Position:', `${data.latitude}, ${data.longitude}`);
      console.log('Timestamp:', data.timestamp);
      
      // Update vehicle data
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
      
      // Check vehicle geofence with retry
      const checkVehicleGeofenceWithRetry = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          // Get latest vehicles
          const currentVehicles = await new Promise<Vehicle[]>((resolve) => {
            setVehicles(current => {
              resolve(current);
              return current;
            });
          });
          
          if (currentVehicles.length === 0 && i < retries - 1) {
            console.log(`⏳ No vehicles loaded yet, retry ${i + 1}/${retries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          console.log('🔎 Searching for vehicle with GPS ID:', data.gps_id);
          console.log('Available vehicles:', currentVehicles.length);
          
          // Try various matching methods
          let vehicle = currentVehicles.find(v => {
            // Exact match
            if (v.gps_id === data.gps_id) return true;
            
            // String comparison (trim whitespace)
            if (v.gps_id && data.gps_id) {
              const vGpsId = String(v.gps_id).trim();
              const dataGpsId = String(data.gps_id).trim();
              if (vGpsId === dataGpsId) return true;
            }
            
            // Match by vehicle_id if available
            if (data.vehicle_id && v.vehicle_id === data.vehicle_id) return true;
            
            return false;
          });
          
          if (vehicle) {
            console.log('✅ Found vehicle:', vehicle.name);
            console.log('   Vehicle details:', {
              vehicle_id: vehicle.vehicle_id,
              gps_id: vehicle.gps_id,
              geofence_id: vehicle.geofence_id
            });
            
            if (vehicle.geofence_id) {
              // Get latest geofences
              const currentGeofences = await new Promise<ProjectGeofence[]>((resolve) => {
                setGeofences(current => {
                  resolve(current);
                  return current;
                });
              });
              
              const geofence = currentGeofences.find(g => 
                g.geofence_id.toString() === vehicle.geofence_id?.toString()
              );
              
              if (geofence) {
                console.log('✅ Vehicle has geofence:', geofence.name, `(${geofence.rule_type})`);
                console.log('🚀 Triggering geofence check...');
                
                // Create proper VehicleData object
                const vehicleData: VehicleData = {
                  gps_id: data.gps_id,
                  vehicle_id: data.vehicle_id,
                  timestamp: data.timestamp,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  speed: data.speed,
                  ignition_status: data.ignition_status,
                  battery_level: data.battery_level,
                  fuel_level: data.fuel_level
                };
                
                // Trigger geofence check
                checkGeofenceViolations(vehicle, vehicleData);
              } else {
                console.log('❌ Geofence not found! Looking for ID:', vehicle.geofence_id);
                console.log('   Available geofence IDs:', currentGeofences.map(g => g.geofence_id));
              }
            } else {
              console.log('⚠️ Vehicle has no geofence assigned');
            }
          } else {
            console.log('❌ No vehicle found for GPS ID:', data.gps_id);
            if (i === retries - 1) {
              console.log('   This GPS data might be from a vehicle not belonging to this user');
            }
          }
          
          break; // Exit retry loop
        }
      };
      
      // Execute with retry
      checkVehicleGeofenceWithRetry().catch(err => {
        console.error('Error in geofence check:', err);
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
  }, [userId, addOrUpdateGeofence, clearAllLoadedGeofencesInDetector, handleRealtimeUpdate]);

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
    checkGeofenceViolations: exposedCheckGeofenceViolations,
    resetVehicleStateInDetector,
    removeGeofenceById,
    addOrUpdateGeofence,
    clearAllLoadedGeofencesInDetector
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

  // Add refs for tracking to prevent infinite loops
  const hasRunInitialCheck = useRef(false);
  const debugHelpersLoaded = useRef(false);
  const geofencesLogged = useRef(false);

  // Use WebSocket with Geofence Detection - PASS USER AS PARAMETER
  const { 
    isConnected, 
    vehicles, 
    vehicleData, 
    geofences, 
    activeGeofenceAlert, 
    setActiveGeofenceAlert,
    loadInitialData,
    checkGeofenceViolations,
    resetVehicleStateInDetector,
    removeGeofenceById,
    addOrUpdateGeofence,
    clearAllLoadedGeofencesInDetector
  } = useWebSocketWithGeofence(user?.id || user?.user_id, user);

  // Listen to geofence events untuk refresh data
  useEffect(() => {
    if (!user) return;

    const userId = user.id || user.user_id;
    if (!userId) return;

    // Handler untuk geofence deleted
    const handleGeofenceDeleted = (geofenceId: number) => {
      console.log('📡 Geofence deleted event received:', geofenceId);
      
      // Remove geofence from detector immediately
      removeGeofenceById(geofenceId);
      
      // Reset vehicle geofence states in detector for affected vehicles
      vehicles.forEach(vehicle => {
        if (vehicle.geofence_id?.toString() === geofenceId.toString()) {
          console.log(`🔄 Resetting geofence state for vehicle ${vehicle.name}`);
          if (resetVehicleStateInDetector) {
            resetVehicleStateInDetector(vehicle.vehicle_id);
          }
        }
      });
      
      // Clear active geofence alert if it's from deleted geofence
      if (activeGeofenceAlert && activeGeofenceAlert.geofence_id === geofenceId) {
        setActiveGeofenceAlert(null);
      }
      
      // Refresh data dari API
      if (loadInitialData) {
        loadInitialData();
        toast.info('Refreshing data after geofence deletion...', {
          description: `Geofence ID ${geofenceId} has been removed`,
          duration: 3000,
        });
      }
    };

    // Handler untuk geofence created
    const handleGeofenceCreated = (geofence: any) => {
      console.log('📡 Geofence created event received:', geofence);
      
      // Add new geofence to detector if it's for current user
      if (geofence.user_id === userId && geofence.status === 'active') {
        const processedGeofence = {
          ...geofence,
          definition: typeof geofence.definition === 'string' 
            ? JSON.parse(geofence.definition) 
            : geofence.definition
        };
        addOrUpdateGeofence(processedGeofence);
      }
      
      if (loadInitialData) {
        loadInitialData();
        toast.success('New geofence created', {
          description: `${geofence.name} has been added`,
          duration: 3000,
        });
      }
    };

    // Handler untuk geofence updated
    const handleGeofenceUpdated = (geofence: any) => {
      console.log('📡 Geofence updated event received:', geofence);
      
      // Update geofence in detector
      if (geofence.user_id === userId) {
        const processedGeofence = {
          ...geofence,
          definition: typeof geofence.definition === 'string' 
            ? JSON.parse(geofence.definition) 
            : geofence.definition
        };
        
        if (geofence.status === 'active') {
          addOrUpdateGeofence(processedGeofence);
        } else {
          removeGeofenceById(geofence.geofence_id);
        }
      }
      
      if (loadInitialData) {
        loadInitialData();
        toast.info('Geofence updated', {
          description: `${geofence.name} has been modified`,
          duration: 3000,
        });
      }
    };

    // Subscribe to events
    const unsubscribeDeleted = geofenceEvents.onGeofenceDeleted(handleGeofenceDeleted);
    const unsubscribeCreated = geofenceEvents.onGeofenceCreated(handleGeofenceCreated);
    const unsubscribeUpdated = geofenceEvents.onGeofenceUpdated(handleGeofenceUpdated);

    // Cleanup
    return () => {
      unsubscribeDeleted();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [
    user, 
    vehicles, 
    loadInitialData, 
    resetVehicleStateInDetector, 
    activeGeofenceAlert, 
    setActiveGeofenceAlert,
    removeGeofenceById,
    addOrUpdateGeofence
  ]);

  // Initial geofence check when data is loaded
  useEffect(() => {
    // Skip if data not complete
    if (vehicles.length === 0 || vehicleData.length === 0 || geofences.length === 0) {
      return;
    }
    
    // Skip if already ran
    if (hasRunInitialCheck.current) {
      return;
    }
    
    hasRunInitialCheck.current = true;
    
    console.log('🚀 Running initial geofence check (one-time only)...');
    console.log(`Found ${vehicles.length} vehicles, ${vehicleData.length} GPS data points, ${geofences.length} geofences`);
    
    // Create a map of latest vehicle data
    const latestDataMap = new Map<string, VehicleData>();
    
    vehicleData.forEach(data => {
      const key = data.gps_id || data.vehicle_id;
      if (!key) return;
      
      const existing = latestDataMap.get(key);
      if (!existing || (data.timestamp && existing.timestamp && 
          new Date(data.timestamp) > new Date(existing.timestamp))) {
        latestDataMap.set(key, data);
      }
    });
    
    // Check each vehicle with assigned geofence
    vehicles.forEach(vehicle => {
      if (!vehicle.geofence_id) {
        console.log(`⚠️ Vehicle ${vehicle.name} has no geofence assigned`);
        return;
      }
      
      const latestData = latestDataMap.get(vehicle.gps_id || '') || 
                        latestDataMap.get(vehicle.vehicle_id);
      
      if (!latestData) {
        console.log(`❌ No GPS data found for vehicle ${vehicle.name}`);
        return;
      }
      
      if (!latestData.latitude || !latestData.longitude) {
        console.log(`❌ Invalid GPS coordinates for vehicle ${vehicle.name}`);
        return;
      }
      
      const geofence = geofences.find(g => 
        g.geofence_id.toString() === vehicle.geofence_id?.toString()
      );
      
      if (!geofence) {
        console.log(`❌ Geofence ${vehicle.geofence_id} not found for vehicle ${vehicle.name}`);
        return;
      }
      
      console.log(`✅ Checking vehicle ${vehicle.name} against geofence ${geofence.name}`);
      
      if (resetVehicleStateInDetector) {
        resetVehicleStateInDetector(vehicle.vehicle_id);
      }
      
      checkGeofenceViolations(vehicle, latestData);
    });
    
    console.log('✅ Initial geofence check completed');
  }, [vehicles.length, vehicleData.length, geofences.length, resetVehicleStateInDetector, checkGeofenceViolations]);

  // Monitor geofences loaded
  useEffect(() => {
    if (geofences.length > 0 && !geofencesLogged.current) {
      geofencesLogged.current = true;
      console.log('📊 Geofences loaded into detector:', geofences.length);
      geofences.forEach(gf => {
        console.log(`- ${gf.name} (ID: ${gf.geofence_id}, Type: ${gf.type}, Rule: ${gf.rule_type}, Status: ${gf.status})`);
      });
    }
  }, [geofences.length, geofences]);

  // Debug helpers
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !checkGeofenceViolations) {
      return;
    }

    // Update debug object with latest data
    (window as any).__GPS_DEBUG__ = {
      vehicles,
      geofences,
      vehicleData,
      user,
      isConnected,
      
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
        
        console.log('\n=== ALL GPS DATA AVAILABLE ===');
        const uniqueGpsIds = [...new Set(vehicleData.map(d => d.gps_id))];
        console.log('Unique GPS IDs in vehicle data:', uniqueGpsIds);
        
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
      
      simulateGeofenceViolation: (vehicleIndex = 0) => {
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
        
        console.log(`Simulating violation for ${vehicle.name} on geofence ${geofence.name}`);
        
        let testPosition: [number, number];
        if (geofence.type === 'circle' && geofence.definition.center) {
          testPosition = [geofence.definition.center[0], geofence.definition.center[1]];
        } else if (geofence.type === 'polygon' && geofence.definition.coordinates?.[0]?.[0]) {
          testPosition = geofence.definition.coordinates[0][0];
        } else {
          console.error('Cannot determine test position from geofence');
          return;
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
        
        console.log('Simulating GPS update:', fakeGPSData);
        
        if (checkGeofenceViolations) {
          checkGeofenceViolations(vehicle, fakeGPSData);
        } else {
          console.error('checkGeofenceViolations function not available');
        }
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
      }
    };
    
    // Log helpers only once
    if (!debugHelpersLoaded.current) {
      debugHelpersLoaded.current = true;
      console.log('🐛 Debug helpers loaded! Use __GPS_DEBUG__ in console:');
      console.log('- __GPS_DEBUG__.runAllChecks() - Run all diagnostic checks');
      console.log('- __GPS_DEBUG__.checkVehicleGeofences() - Check vehicle geofence assignments');
      console.log('- __GPS_DEBUG__.checkActiveGeofences() - List active geofences');
      console.log('- __GPS_DEBUG__.checkVehiclePositions() - Show latest GPS positions');
      console.log('- __GPS_DEBUG__.checkGeofenceAssignment() - Verify geofence assignments');
      console.log('- __GPS_DEBUG__.testEmailAPI() - Test email sending');
      console.log('- __GPS_DEBUG__.simulateGeofenceViolation(vehicleIndex) - Simulate a violation');
      console.log('- __GPS_DEBUG__.resetVehicleGeofenceState(vehicleIndex) - Reset vehicle detector state');
      console.log('- __GPS_DEBUG__.forceGeofenceCheck() - Force check all vehicles');
    }
  }, [vehicles, geofences, vehicleData, user, isConnected, checkGeofenceViolations, resetVehicleStateInDetector]);

  // Cleanup effect for refs
  useEffect(() => {
    return () => {
      // Reset all refs on unmount
      hasRunInitialCheck.current = false;
      debugHelpersLoaded.current = false;
      geofencesLogged.current = false;
    };
  }, []);

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
  );
};

export default DashboardPage;