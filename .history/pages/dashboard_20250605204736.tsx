import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
// 🔥 FIXED: Import UniversalMainContent instead of MainContent
import { UniversalMainContent } from "@/components/MainContent";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Info
} from "lucide-react";

// Enhanced User interface dengan comprehensive typing
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

// Alert/Notification interface - sesuai dengan format API alerts
interface Alert {
  alert_id: number;
  vehicle_id: number;
  alert_type: string | null;
  alert_message: string | null;
  lokasi: string | null;
  timestamp: string | null;
}

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

  // Animation and mounting setup
  useEffect(() => {
    setIsMounted(true);
    
    // Staggered animation timing
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

  // Fetch alerts dari API lokal
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      console.log('🚨 Fetching alerts...');
      
      const response = await fetch('/api/alerts?limit=3', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Loaded ${result.data.length} alerts`);
        setAlerts(result.data);
      } else {
        console.warn('❌ No alerts data received');
        setAlerts([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch alerts:', error);
      setAlerts([]);
      
      // Don't show error toast to avoid spam, just log it
      if (error instanceof Error && !error.message.includes('timeout')) {
        console.error('Alert fetch error:', error.message);
      }
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Enhanced authentication check dengan comprehensive error handling
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = getUserData();
        if (!userData) {
          toast.error("Session expired. Please login again.");
          router.push("/login");
          return false;
        }

        // Validate session integrity
        if (userData.login_time) {
          const sessionAge = Date.now() - new Date(userData.login_time).getTime();
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge > maxSessionAge) {
            throw new Error("Session expired due to age");
          }
        }

        setUser(userData);

        // Handle stored view navigation
        const storedActiveView = sessionStorage.getItem("activeView");
        if (storedActiveView && ['dashboard', 'tracking', 'vehicles', 'reports', 'settings'].includes(storedActiveView)) {
          setActiveView(storedActiveView);
          sessionStorage.removeItem("activeView");
        }

        // Load alerts setelah user terautentikasi
        await fetchAlerts();

        return true;
      } catch (error) {
        console.error("Authentication error:", error);
        
        // Clear corrupted session data
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

  // Auto-refresh alerts setiap 30 detik
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user, fetchAlerts]);

  // Enhanced logout dengan comprehensive cleanup
  const handleLogout = useCallback(async () => {
    try {
      // Show loading state
      toast.loading("Logging out...", { id: "logout" });

      // Clear all session data
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("activeView");
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem("user_preferences");
      }
      
      // Optional: Call logout API to invalidate server-side session
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user?.id || user?.user_id })
        });
      } catch (apiError) {
        console.warn("Logout API call failed:", apiError);
        // Don't block logout if API fails
      }

      // Success feedback
      toast.success("Logged out successfully", { id: "logout" });
      
      // Navigate after a brief delay for UX
      setTimeout(() => {
        router.push("/");
      }, 500);

    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error during logout", { id: "logout" });
      
      // Force logout even if error occurs
      router.push("/");
    }
  }, [router, user]);

  // Handle view changes dengan state persistence
  const handleViewChange = useCallback((newView: string) => {
    setActiveView(newView);
    
    // Optional: Save view preference
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('last_active_view', newView);
      }
    } catch (error) {
      console.warn("Failed to save view preference:", error);
    }
  }, []);

  // Get user initials untuk avatar
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

  // Get display name dengan fallback logic
  const getDisplayName = useCallback((user: User): string => {
    return user.full_name || user.username || user.email.split('@')[0];
  }, []);

  // Format time for last activity and alerts
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

  // Get alert icon berdasarkan alert_type
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

  // Get alert priority color
  const getAlertPriorityColor = useCallback((alertType: string | null) => {
    switch (alertType) {
      case 'violation_enter':
      case 'violation_exit':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, []);

  // Loading state dengan enhanced design
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
    return null; // Already redirected to login
  }

  // Render hanya setelah mounted untuk menghindari hydration mismatch
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
      className={`flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      suppressHydrationWarning={true}
    >
      <SidebarProvider>
        {/* Enhanced Sidebar */}
        <AppSidebar 
          activeView={activeView} 
          setActiveView={handleViewChange}
          className="border-r border-slate-200/50 bg-white/80 backdrop-blur-sm"
        />

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col w-full">
          {/* Enhanced Header */}
          <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-slate-200/50 sticky top-0 z-10">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                  <SidebarTrigger 
                    className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    <Menu className="h-5 w-5" />
                  </SidebarTrigger>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-6 h-6 text-blue-600" />
                      <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent capitalize">
                          {activeView === "tracking" ? "Live Tracking" : activeView === "dashboard" ? "Command Center" : activeView}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-slate-500" suppressHydrationWarning={true}>
                          <span>Welcome back, {getDisplayName(user)}</span>
                        </div>
                      </div>
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
                          <span className="absolute -top-1 -right-1 w-5 h-5 text-xs flex items-center justify-center bg-red-500 text- rounded-full">
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
                                  <div className="flex items-center justify-between mt-1">
                                    <span className={`text-xs px-2 py-1 rounded-full ${getAlertPriorityColor(alert.alert_type)}`}>
                                      {alert.alert_type?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <Clock className="w-3 h-3" />
                                      {alert.timestamp ? formatLastActivity(alert.timestamp) : 'Unknown time'}
                                    </div>
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

          {/* 🔥 FIXED: Main Content Area - menggunakan UniversalMainContent */}
          <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50/50 to-slate-100/50">
            <div className="p-6">
              <UniversalMainContent 
                activeView={activeView} 
                user={user}
                onViewChange={handleViewChange}
                className="transition-all duration-500 ease-out"
              />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default DashboardPage;