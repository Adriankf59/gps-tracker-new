import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import useSWR from 'swr';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  FileText,
  Home,
  Navigation,
  X,
  Fuel,
  Zap,
  TrendingUp,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";

// Types from original dashboard
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

interface Vehicle {
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
  created_at: string;
  updated_at: string;
  vehicle_photo: string;
}

interface VehicleData {
  gps_id: string | null;
  vehicle_id?: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
}

interface ProcessedVehicle {
  id: string;
  name: string;
  licensePlate: string;
  position: [number, number];
  speed: number;
  ignition: boolean;
  fuel: number | null;
  battery: number | null;
  timestamp: string | null;
  isMotor: boolean;
  make: string;
  model: string;
  year: number;
  status: 'moving' | 'parked' | 'offline';
  isOnline: boolean;
  location: string;
}

interface Alert {
  alert_id: number;
  vehicle_id: number;
  alert_type: string | null;
  alert_message: string | null;
  lokasi: string | null;
  timestamp: string | null;
}

// Constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8055';

const INTERVALS = {
  VEHICLES: 60000,
  VEHICLE_DATA: 5000,
  GEOFENCES: 300000,
  ALERTS: 15000
};

// Navigation items
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'tracking', label: 'Live Track', icon: Navigation },
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Enhanced fetcher
const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

// Utility functions
const parseFloat_ = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const getLocationName = (lat: string, lng: string): string => {
  const latitude = parseFloat_(lat);
  const longitude = parseFloat_(lng);
  
  if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
    return "Bandung, Jawa Barat";
  }
  if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
    return "Jakarta";
  }
  return `${lat}, ${lng}`;
};

const getVehicleStatus = (data: VehicleData | undefined): 'moving' | 'parked' | 'offline' => {
  if (!data?.timestamp) return 'offline';
  
  const diffMinutes = (Date.now() - new Date(data.timestamp).getTime()) / 60000;
  if (diffMinutes > 10) return 'offline';
  return (data.speed ?? 0) > 0 ? 'moving' : 'parked';
};

const isVehicleOnline = (data: VehicleData | undefined): boolean => {
  if (!data?.timestamp) return false;
  return (Date.now() - new Date(data.timestamp).getTime()) / 60000 <= 10;
};

const isMotorVehicle = (vehicle: Vehicle): boolean => {
  const checkStrings = [vehicle.make, vehicle.model, vehicle.name].map(s => s?.toLowerCase() || '');
  return checkStrings.some(str => str.includes('motor'));
};

// Custom hooks
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

const useUser = () => {
  return useMemo(() => {
    if (typeof window === 'undefined') return { userData: null, userId: undefined };
    
    try {
      const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
      return {
        userData,
        userId: userData.id || userData.user_id
      };
    } catch {
      return { userData: null, userId: undefined };
    }
  }, []);
};

const useVehicles = (userId?: string) => {
  const isOnline = useOnlineStatus();
  
  const { data, error, isLoading, mutate } = useSWR(
    userId && isOnline ? `${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}&limit=-1` : null,
    fetcher,
    {
      refreshInterval: isOnline ? INTERVALS.VEHICLES : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 1,
      errorRetryInterval: 5000,
      onError: (err: unknown) => {
        if (isOnline && err instanceof Error && !err.message?.includes('timeout')) {
          toast.error('Failed to load vehicles');
        }
      }
    }
  );

  return {
    vehicles: (data?.data || []) as Vehicle[],
    vehiclesLoading: isLoading,
    mutateVehicles: mutate
  };
};

const useVehicleData = (vehicles: Vehicle[]) => {
  const isOnline = useOnlineStatus();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  const gpsIds = useMemo(() => {
    return vehicles
      .map(v => v.gps_id)
      .filter(Boolean)
      .join(',');
  }, [vehicles]);

  const { data, error, isLoading, mutate } = useSWR(
    gpsIds && isOnline ? `${API_BASE_URL}/items/vehicle_datas?filter[gps_id][_in]=${gpsIds}&limit=1000&sort=-timestamp` : null,
    fetcher,
    {
      refreshInterval: isOnline ? INTERVALS.VEHICLE_DATA : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 1,
      onSuccess: () => setLastUpdate(new Date())
    }
  );

  return {
    vehicleData: (data?.data || []) as VehicleData[],
    vehicleDataLoading: isLoading,
    mutateVehicleData: mutate,
    lastUpdate
  };
};

const useGeofences = (userId?: string) => {
  const isOnline = useOnlineStatus();
  
  const { data, mutate } = useSWR(
    userId && isOnline ? `${API_BASE_URL}/items/geofence?filter[user_id][_eq]=${userId}` : null,
    fetcher,
    {
      refreshInterval: isOnline ? INTERVALS.GEOFENCES : 0,
      revalidateOnFocus: false,
      errorRetryCount: 1
    }
  );

  return {
    geofences: data?.data || [],
    mutateGeofences: mutate
  };
};

const useAlerts = () => {
  const isOnline = useOnlineStatus();
  
  const { data, mutate } = useSWR(
    isOnline ? '/api/alerts?limit=5' : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const result = await response.json();
      return result.data || [];
    },
    {
      refreshInterval: isOnline ? INTERVALS.ALERTS : 0,
      revalidateOnFocus: true,
      errorRetryCount: 1
    }
  );

  return {
    alerts: (data || []) as Alert[],
    mutateAlerts: mutate
  };
};

// Desktop Sidebar Component
const DesktopSidebar = ({ activeView, setActiveView, className = "" }) => (
  <div className={`hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 ${className}`}>
    <div className="p-6 border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">GPS Fleet</h2>
          <p className="text-sm text-slate-500">Management</p>
        </div>
      </div>
    </div>
    
    <nav className="flex-1 p-4">
      <div className="space-y-2">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
              activeView === item.id
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  </div>
);

// Mobile Bottom Navigation
const MobileBottomNav = ({ activeView, setActiveView }) => (
  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-2 safe-area-pb">
    <div className="flex justify-around items-center">
      {navigationItems.slice(0, 4).map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveView(item.id)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg min-w-0 flex-1 transition-all ${
            activeView === item.id
              ? 'text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <item.icon className={`w-5 h-5 ${activeView === item.id ? 'text-blue-600' : ''}`} />
          <span className={`text-xs font-medium truncate ${activeView === item.id ? 'text-blue-600' : ''}`}>
            {item.label}
          </span>
        </button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex flex-col items-center gap-1 p-2 rounded-lg min-w-0 flex-1 text-slate-500 hover:text-slate-700">
            <Menu className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="mb-2 mr-4">
          <DropdownMenuItem onClick={() => setActiveView('settings')}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem>
            <FileText className="w-4 h-4 mr-2" />
            Help
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

// Mobile Header Component
const MobileHeader = ({ user, alerts, alertsLoading, onLogout, isOnline, onRefresh, lastUpdate }) => {
  const getUserInitials = (user: User): string => {
    if (user.full_name) {
      const nameParts = user.full_name.split(' ');
      return nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : nameParts[0].substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const formatTime = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Logo & Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">GPS Fleet</h1>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-3 h-3 text-green-600" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={!isOnline}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

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
                  <span className="absolute -top-1 -right-1 w-4 h-4 text-xs flex items-center justify-center bg-red-500 text-white rounded-full">
                    {alerts.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 mr-4">
              <DropdownMenuLabel>Recent Alerts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <DropdownMenuItem key={alert.alert_id} className="p-3">
                    <div className="space-y-1 w-full">
                      <p className="text-sm font-medium">{alert.alert_message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {alert.alert_type?.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {alert.timestamp ? formatTime(alert.timestamp) : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-center p-4">
                  No recent alerts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-1">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mr-4">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="font-medium">{user.full_name || user.email.split('@')[0]}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

// Desktop Header Component
const DesktopHeader = ({ activeView, user, alerts, alertsLoading, onLogout, isOnline, onRefresh, lastUpdate }) => {
  const getUserInitials = (user: User): string => {
    if (user.full_name) {
      const nameParts = user.full_name.split(' ');
      return nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : nameParts[0].substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (user: User): string => {
    return user.full_name || user.username || user.email.split('@')[0];
  };

  const formatTime = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <header className="hidden lg:block bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex justify-between items-center">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 capitalize">
                {activeView === "tracking" ? "Live Tracking" : activeView === "dashboard" ? "Command Center" : activeView}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>Welcome back, {getDisplayName(user)}</span>
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-green-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-600" />
                  )}
                  <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                    {isOnline ? 'Connected' : 'Offline'}
                  </span>
                  {isOnline && (
                    <span className="text-gray-600 ml-2">
                      Last update: {lastUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={!isOnline}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

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
              <DropdownMenuLabel>Recent Alerts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <DropdownMenuItem key={alert.alert_id} className="p-3">
                    <div className="space-y-2 w-full">
                      <p className="text-sm font-medium">{alert.alert_message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {alert.alert_type?.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {alert.timestamp ? formatTime(alert.timestamp) : 'Unknown'}
                        </span>
                      </div>
                      {alert.lokasi && (
                        <p className="text-xs text-slate-500">📍 {alert.lokasi}</p>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-center p-4">
                  No recent alerts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-3 py-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">{getDisplayName(user)}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="font-medium">{getDisplayName(user)}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="w-4 h-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                System Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Shield className="w-4 h-4 mr-2" />
                Security
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

// Content Components with Real Data
const DashboardContent = ({ processedVehicles, stats, vehicleDataLoading, isOnline, selectedVehicleId, onVehicleClick }) => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {[
          { title: "Total Vehicles", value: stats.totalVehicles.toString(), icon: Car, color: "blue" },
          { title: "Active Tracking", value: stats.activeTracking.toString(), icon: Navigation, color: "green" },
          { title: "Active Alerts", value: stats.activeAlerts.toString(), icon: AlertTriangle, color: "red" },
          { title: "Geofences", value: stats.geofences.toString(), icon: Shield, color: "purple" },
        ].map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <div className={`p-2 lg:p-3 rounded-lg bg-${stat.color}-100`}>
                  <stat.icon className={`w-4 h-4 lg:w-6 lg:h-6 text-${stat.color}-600`} />
                </div>
              </div>
              <div className="space-y-1 lg:space-y-2">
                <h3 className="text-xs lg:text-sm font-medium text-slate-600">{stat.title}</h3>
                <span className="text-lg lg:text-2xl font-bold text-slate-800">{stat.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vehicle List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
            <TrendingUp className="w-4 h-4 text-green-600" /> 
            Live Vehicles ({stats.activeTracking} online)
            {vehicleDataLoading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 lg:max-h-96 overflow-y-auto">
            {processedVehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No vehicles available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {processedVehicles.map(vehicle => (
                  <div
                    key={vehicle.id}
                    className={`p-3 lg:p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedVehicleId === vehicle.id 
                        ? 'bg-blue-50 border-blue-200 shadow-md' 
                        : vehicle.isOnline 
                          ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => onVehicleClick(vehicle)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm lg:text-base text-slate-800">{vehicle.name}</h4>
                      <Badge 
                        className={`text-xs ${
                          vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 
                          vehicle.status === 'parked' ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'
                        }`}
                      >
                        {vehicle.status}
                      </Badge>
                    </div>
                    
                    <p className="text-xs lg:text-sm text-slate-600 mb-2 truncate">{vehicle.location}</p>
                    
                    <div className="flex items-center justify-between text-xs lg:text-sm">
                      <span className="font-medium text-blue-600">{vehicle.speed} km/h</span>
                      <div className="flex items-center gap-2 lg:gap-4">
                        <div className="flex items-center gap-1">
                          <Fuel className="w-3 h-3 lg:w-4 lg:h-4 text-blue-500" />
                          <span>{(vehicle.fuel ?? 0).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-green-500" />
                          <span>{(vehicle.battery ?? 0).toFixed(1)}V</span>
                        </div>
                      </div>
                    </div>
                    
                    {vehicle.timestamp && (
                      <p className="text-xs text-gray-400 mt-1">
                        Updated: {new Date(vehicle.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Other content components remain the same but simplified for mobile
const TrackingContent = ({ processedVehicles }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-600" />
          Live Vehicle Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 lg:h-96 bg-slate-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-600">Interactive Map Component</p>
            <p className="text-sm text-slate-500">{processedVehicles.length} vehicles tracked</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const VehiclesContent = ({ processedVehicles }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          Vehicle Management ({processedVehicles.length} total)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {processedVehicles.map(vehicle => (
            <Card key={vehicle.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{vehicle.name}</h3>
                  <Badge variant={vehicle.isOnline ? "default" : "secondary"}>
                    {vehicle.isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <p><strong>License:</strong> {vehicle.licensePlate}</p>
                  <p><strong>Status:</strong> {vehicle.status}</p>
                  <p><strong>Location:</strong> {vehicle.location}</p>
                  <div className="flex justify-between">
                    <span><strong>Speed:</strong> {vehicle.speed} km/h</span>
                    <span><strong>Fuel:</strong> {vehicle.fuel?.toFixed(0) || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

// Main Dashboard Component
export default function ResponsiveDashboard() {
  const router = useRouter();
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hooks
  const isOnline = useOnlineStatus();
  const { userId } = useUser();
  const { vehicles, vehiclesLoading, mutateVehicles } = useVehicles(userId);
  const { vehicleData, vehicleDataLoading, mutateVehicleData, lastUpdate } = useVehicleData(vehicles);
  const { geofences, mutateGeofences } = useGeofences(userId);
  const { alerts, mutateAlerts } = useAlerts();

  // Get user from session storage
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const userData = sessionStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
    setLoading(false);
  }, []);

  // Process vehicles with real data
  const processedVehicles = useMemo((): ProcessedVehicle[] => {
    if (!vehicles.length) return [];

    const dataMap = new Map<string, VehicleData>();
    
    vehicleData.forEach(data => {
      const key = data.gps_id || data.vehicle_id;
      if (!key) return;
      
      const existing = dataMap.get(key);
      if (!existing || (data.timestamp && existing.timestamp && 
          new Date(data.timestamp) > new Date(existing.timestamp))) {
        dataMap.set(key, data);
      }
    });

    return vehicles.map(vehicle => {
      const latestData = dataMap.get(vehicle.gps_id) || dataMap.get(vehicle.vehicle_id);
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      let position: [number, number] = [0, 0];
      
      if (latestData?.latitude && latestData?.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
        const lat = parseFloat_(latestData.latitude);
        const lng = parseFloat_(latestData.longitude);
        if (lat && lng) position = [lat, lng];
      }

      return {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        licensePlate: vehicle.license_plate,
        position,
        speed: latestData?.speed ?? 0,
        ignition: latestData?.ignition_status === 'ON',
        fuel: latestData?.fuel_level ? parseFloat_(latestData.fuel_level) : null,
        battery: latestData?.battery_level ? parseFloat_(latestData.battery_level) : null,
        timestamp: latestData?.timestamp || null,
        isMotor: isMotorVehicle(vehicle),
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || 0,
        status,
        isOnline: online,
        location
      };
    });
  }, [vehicles, vehicleData]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = processedVehicles.length;
    const online = processedVehicles.filter(v => v.isOnline).length;
    const alertCount = processedVehicles.filter(v => 
      (v.fuel ?? 0) < 20 || (v.speed ?? 0) > 80
    ).length;
    
    return {
      totalVehicles: total,
      activeTracking: online,
      activeAlerts: Math.max(alertCount, alerts.length),
      geofences: geofences.length
    };
  }, [processedVehicles, alerts.length, geofences.length]);

  // Handlers
  const handleVehicleClick = useCallback((vehicle: ProcessedVehicle) => {
    setSelectedVehicleId(prev => prev === vehicle.id ? null : vehicle.id);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline');
      return;
    }
    
    try {
      await Promise.allSettled([
        mutateVehicles(),
        mutateVehicleData(),
        mutateGeofences(),
        mutateAlerts()
      ]);
      toast.success('Data refreshed');
    } catch (error: unknown) {
      console.error('Refresh error:', error);
      toast.error('Refresh failed');
    }
  }, [isOnline, mutateVehicles, mutateVehicleData, mutateGeofences, mutateAlerts]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('user');
    router.push('/login');
  }, [router]);

  const renderContent = () => {
    switch (activeView) {
      case 'tracking':
        return <TrackingContent processedVehicles={processedVehicles} />;
      case 'vehicles':
        return <VehiclesContent processedVehicles={processedVehicles} />;
      case 'reports':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Analytics & Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center">
                  <p className="text-slate-600">Distance Analytics Chart</p>
                </div>
                <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center">
                  <p className="text-slate-600">Fuel Consumption Chart</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'settings':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Real-time Updates</h3>
                    <p className="text-sm text-slate-500">Enable live vehicle tracking</p>
                  </div>
                  <Button variant="outline" size="sm">Toggle</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Push Notifications</h3>
                    <p className="text-sm text-slate-500">Receive alerts on your device</p>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return (
          <DashboardContent 
            processedVehicles={processedVehicles}
            stats={stats}
            vehicleDataLoading={vehicleDataLoading}
            isOnline={isOnline}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleClick}
          />
        );
    }
  };

  if (loading || vehiclesLoading && !processedVehicles.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-semibold text-slate-800">Loading GPS Dashboard</h3>
          <p className="text-sm text-slate-600">Initializing vehicle monitoring system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please login to access the dashboard</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Desktop Sidebar */}
      <DesktopSidebar activeView={activeView} setActiveView={setActiveView} />

      {/* Main Content Area */}
      <div className="flex flex-col w-full lg:flex-1">
        {/* Headers */}
        <MobileHeader 
          user={user} 
          alerts={alerts} 
          alertsLoading={false}
          onLogout={handleLogout}
          isOnline={isOnline}
          onRefresh={handleRefresh}
          lastUpdate={lastUpdate}
        />
        <DesktopHeader 
          activeView={activeView}
          user={user} 
          alerts={alerts} 
          alertsLoading={false}
          onLogout={handleLogout}
          isOnline={isOnline}
          onRefresh={handleRefresh}
          lastUpdate={lastUpdate}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeView={activeView} setActiveView={setActiveView} />
    </div>
  );
}