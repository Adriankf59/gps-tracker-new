import { useState, useEffect, useCallback } from "react";
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
  TrendingUp
} from "lucide-react";

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

// Alert interface
interface Alert {
  alert_id: number;
  vehicle_id: number;
  alert_type: string | null;
  alert_message: string | null;
  lokasi: string | null;
  timestamp: string | null;
}

// Vehicle interface untuk demo
interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  status: 'moving' | 'parked' | 'offline';
  speed: number;
  fuel: number;
  battery: number;
  location: string;
  timestamp: string;
  isOnline: boolean;
}

// Navigation items
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'tracking', label: 'Live Track', icon: Navigation },
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Demo data
const demoUser: User = {
  id: '1',
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  login_time: new Date().toISOString(),
  subscription_type: 'premium'
};

const demoAlerts: Alert[] = [
  {
    alert_id: 1,
    vehicle_id: 101,
    alert_type: 'violation_enter',
    alert_message: 'Vehicle B 1234 XY entered restricted area',
    lokasi: 'Jakarta Pusat',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString()
  },
  {
    alert_id: 2,
    vehicle_id: 102,
    alert_type: 'warning',
    alert_message: 'Low fuel alert for vehicle B 5678 AB',
    lokasi: 'Bandung',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString()
  }
];

const demoVehicles: Vehicle[] = [
  {
    id: '1',
    name: 'Truck Alpha',
    licensePlate: 'B 1234 XY',
    status: 'moving',
    speed: 65,
    fuel: 78,
    battery: 12.4,
    location: 'Jakarta Pusat',
    timestamp: new Date().toISOString(),
    isOnline: true
  },
  {
    id: '2',
    name: 'Van Beta',
    licensePlate: 'B 5678 AB',
    status: 'parked',
    speed: 0,
    fuel: 15,
    battery: 12.1,
    location: 'Bandung',
    timestamp: new Date().toISOString(),
    isOnline: true
  },
  {
    id: '3',
    name: 'Truck Gamma',
    licensePlate: 'B 9876 CD',
    status: 'offline',
    speed: 0,
    fuel: 45,
    battery: 11.8,
    location: 'Unknown',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    isOnline: false
  }
];

// Sidebar Component for Desktop
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
const MobileHeader = ({ user, alerts, alertsLoading, onLogout }) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
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
    <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">GPS Fleet</h1>
          </div>
        </div>

        {/* Right: Notifications & User */}
        <div className="flex items-center gap-2">
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
          <DropdownMenu open={showMobileMenu} onOpenChange={setShowMobileMenu}>
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
                  <p className="font-medium">{getDisplayName(user)}</p>
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

// Desktop Header Component
const DesktopHeader = ({ activeView, user, alerts, alertsLoading, onLogout }) => {
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 capitalize">
                {activeView === "tracking" ? "Live Tracking" : activeView === "dashboard" ? "Command Center" : activeView}
              </h1>
              <p className="text-sm text-slate-500">Welcome back, {getDisplayName(user)}</p>
            </div>
          </div>
        </div>

        {/* Right Section */}
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

// Main Content Components
const DashboardContent = () => {
  const stats = [
    { title: "Total Vehicles", value: "3", icon: Car, color: "blue" },
    { title: "Active Tracking", value: "2", icon: Navigation, color: "green" },
    { title: "Active Alerts", value: "2", icon: AlertTriangle, color: "red" },
    { title: "Fuel Alerts", value: "1", icon: Fuel, color: "orange" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {stats.map((stat, index) => (
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
            Live Vehicles (2 online)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {demoVehicles.map(vehicle => (
              <div
                key={vehicle.id}
                className={`p-3 lg:p-4 border rounded-lg transition-all ${
                  vehicle.isOnline 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
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
                
                <p className="text-xs lg:text-sm text-slate-600 mb-2">{vehicle.location}</p>
                
                <div className="flex items-center justify-between text-xs lg:text-sm">
                  <span className="font-medium text-blue-600">{vehicle.speed} km/h</span>
                  <div className="flex items-center gap-2 lg:gap-4">
                    <div className="flex items-center gap-1">
                      <Fuel className="w-3 h-3 lg:w-4 lg:h-4 text-blue-500" />
                      <span>{vehicle.fuel}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-green-500" />
                      <span>{vehicle.battery}V</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const TrackingContent = () => (
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
            <p className="text-sm text-slate-500">Real-time vehicle tracking would appear here</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const VehiclesContent = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          Vehicle Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {demoVehicles.map(vehicle => (
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
                    <span><strong>Fuel:</strong> {vehicle.fuel}%</span>
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

const ReportsContent = () => (
  <div className="space-y-6">
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
  </div>
);

const SettingsContent = () => (
  <div className="space-y-6">
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Data Export</h3>
              <p className="text-sm text-slate-500">Download reports and analytics</p>
            </div>
            <Button variant="outline" size="sm">Export</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

// Main Dashboard Component
export default function ResponsiveDashboard() {
  const [activeView, setActiveView] = useState("dashboard");
  const [user] = useState<User>(demoUser);
  const [alerts] = useState<Alert[]>(demoAlerts);
  const [alertsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = useCallback(() => {
    console.log("Logging out...");
    // Implement logout logic
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case 'tracking':
        return <TrackingContent />;
      case 'vehicles':
        return <VehiclesContent />;
      case 'reports':
        return <ReportsContent />;
      case 'settings':
        return <SettingsContent />;
      default:
        return <DashboardContent />;
    }
  };

  if (loading) {
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
          alertsLoading={alertsLoading} 
          onLogout={handleLogout} 
        />
        <DesktopHeader 
          activeView={activeView}
          user={user} 
          alerts={alerts} 
          alertsLoading={alertsLoading} 
          onLogout={handleLogout} 
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