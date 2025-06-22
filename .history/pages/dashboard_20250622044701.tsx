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

interface VehiclePositionHistory {
  vehicleId: string;
  previousPosition: [number, number] | null;
  currentPosition: [number, number] | null;
  wasInsideGeofence: boolean;
  lastChecked: Date;
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

// Geofence detection utilities
const isPointInCircle = (point: [number, number], center: [number, number], radius: number): boolean => {
  const [pointLng, pointLat] = point;
  const [centerLng, centerLat] = center;
  
  const R = 6371000;
  const dLat = (centerLat - pointLat) * Math.PI / 180;
  const dLng = (centerLng - pointLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(pointLat * Math.PI / 180) * Math.cos(centerLat * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance <= radius;
};

const isPointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
  const [lng, lat] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

const isVehicleInsideGeofence = (vehiclePos: [number, number], geofence: ProjectGeofence): boolean => {
  if (!geofence || !geofence.definition) return false;
  
  try {
    if (geofence.type === 'circle') {
      const { center, radius } = geofence.definition;
      if (!center || !radius) return false;
      return isPointInCircle(vehiclePos, center, radius);
    }
    
    if (geofence.type === 'polygon') {
      const { coordinates } = geofence.definition;
      if (!coordinates || !coordinates[0]) return false;
      return isPointInPolygon(vehiclePos, coordinates[0]);
    }
  } catch (error) {
    console.error('Error checking geofence:', error);
  }
  
  return false;
};

// WebSocket Hook with Geofence Detection
const useWebSocketWithGeofence = (userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [geofences, setGeofences] = useState<ProjectGeofence[]>([]);
  const [activeGeofenceAlert, setActiveGeofenceAlert] = useState<GeofenceAlert | null>(null);
  const [vehiclePositionHistory, setVehiclePositionHistory] = useState<Map<string, VehiclePositionHistory>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const alertCooldownRef = useRef<Map<string, Date>>(new Map());

  // Load initial data from API
  const loadInitialData = useCallback(async () => {
    if (!userId) return;
    
    console.log('📥 Loading initial data from API...');
    try {
      // Fetch vehicles
      const vehiclesResponse = await fetch(`${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1`);
      if (vehiclesResponse.ok) {
        const vehiclesData = await vehiclesResponse.json();
        setVehicles(vehiclesData.data || []);
      }
      
      // Fetch vehicle data
      const vehicleDataResponse = await fetch(`${API_BASE_URL}/items/vehicle_datas?limit=1000&sort=-timestamp`);
      if (vehicleDataResponse.ok) {
        const vData = await vehicleDataResponse.json();
        setVehicleData(vData.data || []);
      }
      
      // Fetch geofences
      const geofencesResponse = await fetch(`${API_BASE_URL}/items/geofence?filter[user_id][_eq]=${userId}`);
      if (geofencesResponse.ok) {
        const geoData = await geofencesResponse.json();
        const processedGeofences = (geoData.data || []).map((gf: any) => ({
          ...gf,
          definition: typeof gf.definition === 'string' ? JSON.parse(gf.definition) : gf.definition
        }));
        setGeofences(processedGeofences);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, [userId]);

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

  // Check geofence violations
  const checkGeofenceViolations = useCallback((vehicle: Vehicle, latestData: VehicleData) => {
    if (!latestData?.latitude || !latestData?.longitude) return;

    const currentPos: [number, number] = [
      parseFloat(latestData.longitude),
      parseFloat(latestData.latitude)
    ];

    if (isNaN(currentPos[0]) || isNaN(currentPos[1])) return;

    const assignedGeofence = geofences.find(gf => 
      gf.geofence_id.toString() === vehicle.geofence_id?.toString() && 
      gf.status === 'active'
    );

    if (!assignedGeofence || !assignedGeofence.definition) return;

    const historyKey = vehicle.vehicle_id;
    const history = vehiclePositionHistory.get(historyKey) || {
      vehicleId: vehicle.vehicle_id,
      previousPosition: null,
      currentPosition: null,
      wasInsideGeofence: false,
      lastChecked: new Date()
    };

    history.previousPosition = history.currentPosition;
    history.currentPosition = currentPos;

    const isCurrentlyInside = isVehicleInsideGeofence(currentPos, assignedGeofence);
    const wasInside = history.wasInsideGeofence;

    let violationDetected = false;
    let alertType: GeofenceAlert['alert_type'] | null = null;
    let alertMessage = '';

    switch (assignedGeofence.rule_type) {
      case 'FORBIDDEN':
        if (!wasInside && isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_enter';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} memasuki geofence ${assignedGeofence.name} (FORBIDDEN)`;
        }
        break;

      case 'STAY_IN':
        if (wasInside && !isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_exit';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} keluar dari geofence ${assignedGeofence.name} (STAY_IN)`;
        }
        break;

      case 'STANDARD':
        if (!wasInside && isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_enter';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} memasuki geofence ${assignedGeofence.name} (STANDARD)`;
        } else if (wasInside && !isCurrentlyInside) {
          violationDetected = true;
          alertType = 'violation_exit';
          alertMessage = `PELANGGARAN: Kendaraan ${vehicle.name} keluar dari geofence ${assignedGeofence.name} (STANDARD)`;
        }
        break;
    }

    history.wasInsideGeofence = isCurrentlyInside;
    history.lastChecked = new Date();
    
    setVehiclePositionHistory(prev => {
      const newMap = new Map(prev);
      newMap.set(historyKey, history);
      return newMap;
    });

    if (violationDetected && alertType) {
      const cooldownKey = `${vehicle.vehicle_id}_${alertType}`;
      const lastAlert = alertCooldownRef.current.get(cooldownKey);
      const now = new Date();
      
      if (!lastAlert || (now.getTime() - lastAlert.getTime()) > 5 * 60 * 1000) {
        const alert: GeofenceAlert = {
          vehicle_id: parseInt(vehicle.vehicle_id),
          alert_type: alertType,
          alert_message: alertMessage,
          lokasi: `${currentPos[1].toFixed(4)}, ${currentPos[0].toFixed(4)}`,
          timestamp: new Date().toISOString()
        };

        alertCooldownRef.current.set(cooldownKey, now);
        setActiveGeofenceAlert(alert);
        saveAlertToAPI(alert);

        toast.error(`🚨 ${alertMessage}`, {
          duration: 5000,
        });

        console.log('Geofence violation detected:', alert);
      }
    }
  }, [geofences, vehiclePositionHistory, saveAlertToAPI]);

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
        
        // Subscribe to collections
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle' }));
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'vehicle_datas' }));
        ws.send(JSON.stringify({ type: 'subscribe', collection: 'geofence' }));
        
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
                setVehicles(data.filter((v: Vehicle) => v.user_id === userId));
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
  }, [userId]);

  const handleRealtimeUpdate = useCallback((message: any) => {
    const { data } = message;
    
    if (data.vehicle_id && data.license_plate) {
      // Vehicle update
      setVehicles(prev => {
        const index = prev.findIndex(v => v.vehicle_id === data.vehicle_id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        } else if (data.user_id === userId) {
          return [...prev, data];
        }
        return prev;
      });
    } else if (data.gps_id && data.latitude) {
      // Vehicle data update - Check geofence violations here
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
      
      // Check geofence violations for this vehicle
      const vehicle = vehicles.find(v => v.gps_id === data.gps_id);
      if (vehicle && vehicle.geofence_id) {
        checkGeofenceViolations(vehicle, data);
      }
    } else if (data.geofence_id && data.definition) {
      // Geofence update
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
    }
  }, [userId, vehicles, checkGeofenceViolations]);

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
  }, [userId]);

  return {
    isConnected,
    vehicles,
    vehicleData,
    geofences,
    activeGeofenceAlert,
    setActiveGeofenceAlert
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

  // Use WebSocket with Geofence Detection
  const { 
    isConnected, 
    vehicles, 
    vehicleData, 
    geofences, 
    activeGeofenceAlert, 
    setActiveGeofenceAlert 
  } = useWebSocketWithGeofence(user?.id || user?.user_id);

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

  // Fetch alerts - FIXED VERSION
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      // Use relative URL to avoid protocol and domain issues
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
        {/* Desktop Sidebar - Hidden on Mobile */}
        <div className="hidden md:block">
          <AppSidebar 
            activeView={activeView} 
            setActiveView={handleViewChange}
            className="border-r border-slate-200/50 bg-white/80 backdrop-blur-sm"
          />
        </div>

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col w-full">
          {/* Mobile Header - Simplified */}
          <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40 md:hidden">
            <div className="px-4 py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h1 className="text-lg font-semibold text-slate-800 capitalize">
                    {activeView === "tracking" ? "Live Tracking" : activeView === "dashboard" ? "Dashboard" : activeView}
                  </h1>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Notifications Badge */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="relative p-2"
                    onClick={() => handleViewChange('alerts')}
                  >
                    {alertsLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Bell className="w-5 h-5" />
                        {alerts.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 text-xs flex items-center justify-center bg-red-500 text-white rounded-full">
                            {alerts.length}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                  
                  {/* User Menu - Simplified */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-medium">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{getDisplayName(user)}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleViewChange('settings')}>
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          {/* Desktop Header - Hidden on Mobile */}
          <header className="hidden md:block bg-white/90 backdrop-blur-sm shadow-sm border-b border-slate-200/50 sticky top-0 z-10">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-blue-600" />
                    <div>
                      <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent capitalize">
                        {activeView === "tracking" ? "Live Tracking" : activeView === "dashboard" ? "Command Center" : activeView}
                      </h1>
                      <div className="flex items-center gap-2 text-sm text-slate-500" suppressHydrationWarning={true}>
                        <span>Welcome back, {getDisplayName(user)}</span>
                        {isConnected && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs">Live</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Notifications */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="relative p-2">
                        {alertsLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Bell className="w-5 h-5" />
                        )}
                        {alerts.length > 0 && !alertsLoading && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 text-xs flex items-center justify-center bg-red-500 text-white rounded-full">
                            {alerts.length}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-96">
                      <DropdownMenuLabel className="flex items-center justify-between">
                        <span>Recent Alerts</span>
                        {alertsLoading && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {alerts.length > 0 ? (
                        alerts.map((alert) => (
                          <DropdownMenuItem key={alert.alert_id} className="p-3 cursor-pointer">
                            <div className="space-y-2 w-full">
                              <div className="flex items-start gap-2">
                                {getAlertIcon(alert.alert_type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 leading-tight">
                                    {alert.alert_message || 'No message'}
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                    <Clock className="w-3 h-3" />
                                    {alert.timestamp ? formatLastActivity(alert.timestamp) : 'Unknown time'}
                                  </div>
                                  {alert.lokasi && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      📍 {alert.lokasi}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled className="p-3">
                          <div className="text-center w-full">
                            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No recent alerts</p>
                            <p className="text-xs text-slate-400">All systems running normally</p>
                          </div>
                        </DropdownMenuItem>
                      )}
                      {alerts.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-center text-blue-600 hover:text-blue-800 cursor-pointer p-2"
                            onClick={() => handleViewChange('alerts')}
                          >
                            View all alerts
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden md:block text-left">
                          <p className="text-sm font-medium text-slate-800 leading-none">
                            {getDisplayName(user)}
                          </p>
                          <p className="text-xs text-slate-500 leading-none mt-1">
                            {user.email}
                          </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>
                        <div className="space-y-1">
                          <p className="font-medium">{getDisplayName(user)}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                          {user.login_time && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="w-3 h-3" />
                              Last login: {formatLastActivity(user.login_time)}
                            </div>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleViewChange('profile')}>
                        <User className="w-4 h-4 mr-2" />
                        Profile Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewChange('settings')}>
                        <Settings className="w-4 h-4 mr-2" />
                        System Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Shield className="w-4 h-4 mr-2" />
                        Security
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-0 md:p-6">
              <CleanMainContent 
                activeView={activeView} 
                user={user}
                onViewChange={handleViewChange}
                className="transition-all duration-500 ease-out"
                isConnected={isConnected}
                  vehicles={vehicles}
  vehicleData={vehicleData}
  geofences={geofences}
  alerts={alerts}
              />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeView={activeView} setActiveView={handleViewChange} />
    </div>
  );
};

export default DashboardPage;