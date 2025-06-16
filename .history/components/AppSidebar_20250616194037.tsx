import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Car,
  MapPin,
  Shield,
  AlertTriangle,
  Command,
  BarChart3,
  Settings,
  History,
  Loader2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

// ===== INTERFACES & TYPES =====
interface AppSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  className?: string;
}

interface User {
  id?: string;
  user_id?: string;
  _id?: string;
  ID?: string;
  email?: string;
  full_name?: string;
}

interface VehicleData {
  vehicle_id: string;
  user_id: string;
  gps_device_id?: string | null;
  gps_id?: string;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status?: string | null;
  created_at: string;
  updated_at?: string | null;
  vehicle_photo?: string;
}

interface VehicleStatusData {
  vehicle_datas_id?: string;
  data_id?: string;
  vehicle_id?: string;
  gps_id?: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  speed: number;
  rpm?: number;
  fuel_level: string;
  ignition_status: string;
  battery_level: string;
  satellites_used?: number;
}

interface SidebarStats {
  totalVehicles: number;
  onlineVehicles: number;
  alerts: number;
  loading: boolean;
  error: string | null;
}

interface MenuItemConfig {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  view: string;
  badge?: string | null;
  badgeColor?: string;
  priority: number; // For sorting
}

// ===== CONSTANTS =====
import { API_BASE_URL } from '../api/file';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const ONLINE_THRESHOLD_MINUTES = 30;
const ALERT_THRESHOLDS = {
  FUEL_LEVEL: 20,
  BATTERY_LEVEL: 15,
  OFFLINE_HOURS: 1
} as const;

// ===== UTILITY FUNCTIONS =====
const getCurrentUser = (): User | null => {
  try {
    if (typeof window === 'undefined') return null;
    
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;
    
    const user = JSON.parse(userStr);
    return user && typeof user === 'object' ? user : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

const getUserId = (user: User | null): string | null => {
  if (!user) return null;
  return user.id || user.user_id || user._id || user.ID || null;
};

const parseFloat_ = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const isVehicleOnline = (vehicleId: string, statusData: VehicleStatusData[]): boolean => {
  const vehicleData = statusData
    .filter(data => 
      data.vehicle_id === vehicleId || 
      data.gps_id === vehicleId
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (vehicleData.length === 0) return false;
  
  const latestData = vehicleData[0];
  const lastUpdate = new Date(latestData.timestamp);
  const now = new Date();
  const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  return minutesAgo <= ONLINE_THRESHOLD_MINUTES;
};

const calculateAlerts = (vehicles: VehicleData[], statusData: VehicleStatusData[]): number => {
  let alerts = 0;
  
  for (const vehicle of vehicles) {
    const vehicleStatusList = statusData
      .filter(data => 
        data.vehicle_id === vehicle.vehicle_id || 
        data.gps_id === vehicle.gps_id
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (vehicleStatusList.length > 0) {
      const latestStatus = vehicleStatusList[0];
      
      // Alert conditions with null safety
      const fuelLevel = parseFloat_(latestStatus.fuel_level);
      const batteryLevel = parseFloat_(latestStatus.battery_level);
      
      if (fuelLevel < ALERT_THRESHOLDS.FUEL_LEVEL) alerts++;
      if (batteryLevel < ALERT_THRESHOLDS.BATTERY_LEVEL) alerts++;
      
      // Offline alert
      const lastUpdate = new Date(latestStatus.timestamp);
      const now = new Date();
      const hoursAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo > ALERT_THRESHOLDS.OFFLINE_HOURS) alerts++;
    } else {
      // No data = offline alert
      alerts++;
    }
  }
  
  return alerts;
};

// ===== CUSTOM HOOKS =====
const useVehicleData = (userId: string | null) => {
  const [stats, setStats] = useState<SidebarStats>({
    totalVehicles: 0,
    onlineVehicles: 0,
    alerts: 0,
    loading: true,
    error: null
  });
  
  const lastFetchRef = useRef<number>(0);
  const cacheRef = useRef<{
    vehicles: VehicleData[];
    statusData: VehicleStatusData[];
    timestamp: number;
  } | null>(null);

  const fetchVehicles = useCallback(async (userId: string): Promise<VehicleData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicles: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  }, []);

  const fetchVehicleStatus = useCallback(async (vehicles: VehicleData[]): Promise<VehicleStatusData[]> => {
    try {
      if (vehicles.length === 0) return [];
      
      // Get all GPS IDs from vehicles
      const gpsIds = vehicles
        .map(v => v.gps_device_id || v.gps_id)
        .filter(id => id && id.trim() !== '')
        .join(',');
      
      if (!gpsIds) return [];
      
      const response = await fetch(
        `${API_BASE_URL}/items/vehicle_datas?filter[gps_id][_in]=${gpsIds}&limit=500&sort=-timestamp`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicle status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching vehicle status:', error);
      throw error;
    }
  }, []);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setStats(prev => ({ ...prev, loading: false, error: 'No user ID' }));
      return;
    }

    const now = Date.now();
    const cacheAge = cacheRef.current ? now - cacheRef.current.timestamp : Infinity;
    const shouldUseCache = !forceRefresh && cacheRef.current && cacheAge < 60000; // 1 minute cache

    if (shouldUseCache && cacheRef.current) {
      const { vehicles, statusData } = cacheRef.current;
      
      const onlineCount = vehicles.filter(vehicle => 
        isVehicleOnline(vehicle.vehicle_id, statusData)
      ).length;
      
      const alertCount = calculateAlerts(vehicles, statusData);
      
      setStats({
        totalVehicles: vehicles.length,
        onlineVehicles: onlineCount,
        alerts: alertCount,
        loading: false,
        error: null
      });
      return;
    }

    // Debounce: prevent rapid successive calls
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    setStats(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('📊 Loading sidebar data for user:', userId);

      const vehicles = await fetchVehicles(userId);
      const statusData = await fetchVehicleStatus(vehicles);

      // Cache the results
      cacheRef.current = {
        vehicles,
        statusData,
        timestamp: now
      };

      // Calculate stats
      const onlineCount = vehicles.filter(vehicle => 
        isVehicleOnline(vehicle.vehicle_id, statusData)
      ).length;
      
      const alertCount = calculateAlerts(vehicles, statusData);

      setStats({
        totalVehicles: vehicles.length,
        onlineVehicles: onlineCount,
        alerts: alertCount,
        loading: false,
        error: null
      });

      console.log('📊 Sidebar stats:', {
        totalVehicles: vehicles.length,
        onlineVehicles: onlineCount,
        alerts: alertCount
      });

    } catch (error) {
      console.error('Error loading sidebar data:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [userId, fetchVehicles, fetchVehicleStatus]);

  return { stats, loadData, refreshData: () => loadData(true) };
};

// ===== MAIN COMPONENT =====
export function AppSidebar({ activeView, setActiveView, className }: AppSidebarProps) {
  const [user, setUser] = useState<User | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get user on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  const userId = useMemo(() => getUserId(user), [user]);
  const { stats, loadData, refreshData } = useVehicleData(userId);

  // Load data when user is available
  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // Setup refresh interval
  useEffect(() => {
    if (!userId) return;

    const setupInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(() => {
        loadData();
      }, REFRESH_INTERVAL);
    };

    setupInterval();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, loadData]);

  // Generate menu items with computed badges
  const menuItems = useMemo((): MenuItemConfig[] => {
    const items: MenuItemConfig[] = [
      {
        title: "Dashboard",
        icon: BarChart3,
        view: "dashboard",
        badge: null,
        priority: 1,
      },
      {
        title: "Vehicles",
        icon: Car,
        view: "vehicles",
        badge: stats.loading ? "..." : stats.totalVehicles.toString(),
        badgeColor: "bg-slate-100 text-slate-600",
        priority: 2,
      },
      {
        title: "Live Tracking",
        icon: MapPin,
        view: "tracking",
        badge: stats.loading ? "..." : 
               stats.onlineVehicles > 0 ? "Online" : "Offline",
        badgeColor: stats.loading ? "bg-slate-100 text-slate-600" : 
                   stats.onlineVehicles > 0 ? "bg-green-100 text-green-700 border-green-200" : 
                   "bg-red-100 text-red-700 border-red-200",
        priority: 3,
      },
      {
        title: "Geofences",
        icon: Shield,
        view: "geofences",
        badge: null,
        priority: 4,
      },
      {
        title: "Alerts",
        icon: AlertTriangle,
        view: "alerts",
        badge: stats.loading ? "..." : 
               stats.alerts > 0 ? stats.alerts.toString() : null,
        badgeColor: stats.alerts > 0 ? "bg-red-100 text-red-700 border-red-200" : 
                   "bg-slate-100 text-slate-600",
        priority: 5,
      },
      {
        title: "Commands",
        icon: Command,
        view: "commands",
        badge: null,
        priority: 6,
      },
      {
        title: "History",
        icon: History,
        view: "history",
        badge: null,
        priority: 7,
      },
      {
        title: "Settings",
        icon: Settings,
        view: "settings",
        badge: null,
        priority: 8,
      },
    ];

    return items.sort((a, b) => a.priority - b.priority);
  }, [stats]);

  // Handle view change with analytics
  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
    
    // Optional: Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'sidebar_navigation', {
        event_category: 'navigation',
        event_label: view,
        user_id: userId
      });
    }
  }, [setActiveView, userId]);

  return (
    <Sidebar className={`border-r border-slate-200 ${className || ''}`}>
      <SidebarHeader className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-slate-800">GPS Tracker</h1>
            <p className="text-xs text-slate-500">Vehicle Management System</p>
          </div>
          {stats.loading && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          )}
        </div>
        
        {stats.error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            <div className="flex items-center justify-between">
              <span>Failed to load data</span>
              <button 
                onClick={refreshData}
                className="text-red-700 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-600 font-medium px-2 py-2">
            Navigation
            {!stats.loading && !stats.error && (
              <span className="text-xs text-slate-400 ml-2">
                ({stats.totalVehicles} vehicles)
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    onClick={() => handleViewChange(item.view)}
                    className={`w-full justify-between hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                      activeView === item.view
                        ? "bg-blue-100 text-blue-700 border-r-2 border-blue-600"
                        : "text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {item.badge && (
                      <Badge 
                        variant="secondary"
                        className={`text-xs transition-colors ${
                          item.badgeColor || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Status Summary */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-slate-600 font-medium px-2 py-2">
            Quick Stats
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 py-2 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Online:</span>
                <span className={`font-medium ${
                  stats.onlineVehicles > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.loading ? '...' : `${stats.onlineVehicles}/${stats.totalVehicles}`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Alerts:</span>
                <span className={`font-medium ${
                  stats.alerts > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {stats.loading ? '...' : stats.alerts}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Updated:</span>
                <span className="text-slate-400">
                  {new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}