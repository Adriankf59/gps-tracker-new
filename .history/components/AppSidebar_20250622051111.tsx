import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

// ===== INTERFACES & TYPES =====
interface AppSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  className?: string;
  // WebSocket data props
  isConnected?: boolean;
  vehicles?: Vehicle[];
  vehicleData?: VehicleData[];
  geofences?: ProjectGeofence[];
  alerts?: any[];
  onLogout?: () => void;
  // Collapse state props
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface User {
  id?: string;
  user_id?: string;
  _id?: string;
  ID?: string;
  email?: string;
  full_name?: string;
  username?: string;
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
  priority: number;
}

// ===== CONSTANTS =====
const ONLINE_THRESHOLD_MINUTES = 10;
const ALERT_THRESHOLDS = {
  FUEL_LEVEL: 20,
  BATTERY_LEVEL: 11.5,
  SPEED: 80
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

const getUserInitials = (user: User): string => {
  if (user.full_name) {
    const nameParts = user.full_name.split(' ');
    return nameParts.length > 1 
      ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
      : nameParts[0].substring(0, 2).toUpperCase();
  }
  
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  
  return user.email?.substring(0, 2).toUpperCase() || 'U';
};

const getDisplayName = (user: User): string => {
  return user.full_name || user.username || user.email?.split('@')[0] || 'User';
};

const parseFloat_ = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const isVehicleOnline = (vehicle: Vehicle, vehicleDataList: VehicleData[]): boolean => {
  const latestData = vehicleDataList.find(data => 
    data.gps_id === vehicle.gps_id || data.vehicle_id === vehicle.vehicle_id
  );
  
  if (!latestData || !latestData.timestamp) return false;
  
  const lastUpdate = new Date(latestData.timestamp);
  const now = new Date();
  const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  return minutesAgo <= ONLINE_THRESHOLD_MINUTES;
};

const calculateAlerts = (vehicles: Vehicle[], vehicleDataList: VehicleData[]): number => {
  let alerts = 0;
  
  for (const vehicle of vehicles) {
    const latestData = vehicleDataList.find(data => 
      data.gps_id === vehicle.gps_id || data.vehicle_id === vehicle.vehicle_id
    );
    
    if (latestData) {
      const fuelLevel = parseFloat_(latestData.fuel_level);
      const batteryLevel = parseFloat_(latestData.battery_level);
      const speed = latestData.speed || 0;
      
      if (fuelLevel < ALERT_THRESHOLDS.FUEL_LEVEL) alerts++;
      if (batteryLevel < ALERT_THRESHOLDS.BATTERY_LEVEL) alerts++;
      if (speed > ALERT_THRESHOLDS.SPEED) alerts++;
    }
  }
  
  return alerts;
};

// ===== MAIN COMPONENT =====
export function AppSidebar({ 
  activeView, 
  setActiveView, 
  className,
  isConnected = false,
  vehicles = [],
  vehicleData = [],
  geofences = [],
  alerts = [],
  onLogout,
  isCollapsed = false,
  onCollapsedChange
}: AppSidebarProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get user on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  // Calculate stats from WebSocket data
  const stats = useMemo((): SidebarStats => {
    const onlineCount = vehicles.filter(vehicle => 
      isVehicleOnline(vehicle, vehicleData)
    ).length;
    
    const alertCount = alerts.length > 0 ? alerts.length : calculateAlerts(vehicles, vehicleData);

    return {
      totalVehicles: vehicles.length,
      onlineVehicles: onlineCount,
      alerts: alertCount,
      loading: false,
      error: null
    };
  }, [vehicles, vehicleData, alerts]);

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
        badge: stats.totalVehicles > 0 ? stats.totalVehicles.toString() : null,
        badgeColor: "bg-slate-100 text-slate-600",
        priority: 2,
      },
      {
        title: "Live Tracking",
        icon: MapPin,
        view: "tracking",
        badge: stats.onlineVehicles > 0 ? "Online" : "Offline",
        badgeColor: stats.onlineVehicles > 0 ? "bg-green-100 text-green-700 border-green-200" : 
                   "bg-red-100 text-red-700 border-red-200",
        priority: 3,
      },
      {
        title: "Geofences",
        icon: Shield,
        view: "geofences",
        badge: geofences.length > 0 ? geofences.length.toString() : null,
        badgeColor: "bg-blue-100 text-blue-600",
        priority: 4,
      },
      {
        title: "Alerts",
        icon: AlertTriangle,
        view: "alerts",
        badge: stats.alerts > 0 ? stats.alerts.toString() : null,
        badgeColor: stats.alerts > 0 ? "bg-red-100 text-red-700 border-red-200 animate-pulse" : 
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
  }, [stats, geofences]);

  // Handle view change
  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
    
    // On mobile, you might want to close a drawer here
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'sidebar_navigation', {
        event_category: 'navigation',
        event_label: view,
      });
    }
  }, [setActiveView]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (onLogout) {
      onLogout();
    } else {
      // Default logout behavior
      try {
        toast.loading("Logging out...", { id: "logout" });

        sessionStorage.removeItem("user");
        sessionStorage.removeItem("activeView");
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem("user_preferences");
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
    }
  }, [router, onLogout]);

  return (
    <div className={`fixed left-0 top-0 h-full border-r border-slate-200 bg-white transition-all duration-300 ${isCollapsed && !isMobile ? 'w-16' : 'w-64'} ${className || ''}`}>
      <div className="flex flex-col h-full">
        <SidebarHeader className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-3 ${isCollapsed && !isMobile ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="flex-1">
                <h1 className="font-bold text-lg text-slate-800">GVehitr</h1>
                <p className="text-xs text-slate-500">
                  {isConnected ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Disconnected
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          
          {/* Collapse Toggle Button - Desktop Only */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCollapsedChange?.(!isCollapsed)}
              className="p-1 h-auto"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 flex-1">
        <SidebarGroup>
          {(!isCollapsed || isMobile) && (
            <SidebarGroupLabel className="text-slate-600 font-medium px-2 py-2">
              Navigation
            </SidebarGroupLabel>
          )}
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
                    title={isCollapsed && !isMobile ? item.title : undefined}
                  >
                    <div className={`flex items-center gap-3 ${isCollapsed && !isMobile ? 'justify-center w-full' : ''}`}>
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {(!isCollapsed || isMobile) && (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </div>
                    {(!isCollapsed || isMobile) && item.badge && (
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
        
        {/* Status Summary - Only show when not collapsed */}
        {(!isCollapsed || isMobile) && (
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
                    {`${stats.onlineVehicles}/${stats.totalVehicles}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Alerts:</span>
                  <span className={`font-medium ${
                    stats.alerts > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {stats.alerts}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Geofences:</span>
                  <span className="text-slate-600 font-medium">
                    {geofences.length}
                  </span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User Footer with Logout */}
      <SidebarFooter className="border-t border-slate-200 p-2">
        {user && (
          <div className={`${isCollapsed && !isMobile ? 'flex justify-center' : ''}`}>
            {(!isCollapsed || isMobile) ? (
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-medium">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {getDisplayName(user)}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-50 hover:text-red-600"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 hover:text-red-600 w-full"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        </SidebarFooter>
      </div>
    </div>
  );
}