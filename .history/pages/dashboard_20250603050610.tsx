import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MainContent } from "@/components/MainContent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar";
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
  Signal, 
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  Activity,
  Shield,
  Clock
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
  // Additional dashboard-specific properties
  last_activity?: string;
  permissions?: string[];
  subscription_type?: 'free' | 'premium' | 'enterprise';
}

// System status interface
interface SystemStatus {
  online: boolean;
  lastUpdate: Date;
  connectedDevices: number;
  activeTracking: number;
}

const DashboardPage = () => {
  const router = useRouter();
  const [activeView, setActiveView] = useState("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    online: true,
    lastUpdate: new Date(),
    connectedDevices: 0,
    activeTracking: 0
  });
  const [notifications, setNotifications] = useState<any[]>([]);
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

  // Enhanced authentication check dengan comprehensive error handling
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = sessionStorage.getItem("user");
        if (!userData) {
          toast.error("Session expired. Please login again.");
          router.push("/login");
          return false;
        }

        const parsedUser = JSON.parse(userData) as User;
        if (!parsedUser || !parsedUser.email) {
          throw new Error("Invalid user data structure");
        }

        // Validate session integrity
        const loginTime = parsedUser.login_time;
        if (loginTime) {
          const sessionAge = Date.now() - new Date(loginTime).getTime();
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge > maxSessionAge) {
            throw new Error("Session expired due to age");
          }
        }

        setUser(parsedUser);

        // Handle stored view navigation
        const storedActiveView = sessionStorage.getItem("activeView");
        if (storedActiveView && ['dashboard', 'tracking', 'vehicles', 'reports', 'settings'].includes(storedActiveView)) {
          setActiveView(storedActiveView);
          sessionStorage.removeItem("activeView");
        }

        // Initialize system status monitoring
        await initializeSystemStatus();

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

    checkAuth();
  }, [router]);

  // System status monitoring
  const initializeSystemStatus = useCallback(async () => {
    try {
      // Simulate API call untuk system status
      // Replace with actual API call
      setSystemStatus({
        online: true,
        lastUpdate: new Date(),
        connectedDevices: Math.floor(Math.random() * 25) + 5,
        activeTracking: Math.floor(Math.random() * 15) + 2
      });

      // Mock notifications
      setNotifications([
        {
          id: 1,
          type: 'success',
          message: 'Vehicle #GPS001 entered designated zone',
          timestamp: new Date(Date.now() - 5 * 60 * 1000)
        },
        {
          id: 2,
          type: 'warning',
          message: 'Low battery alert for Vehicle #GPS003',
          timestamp: new Date(Date.now() - 15 * 60 * 1000)
        }
      ]);

    } catch (error) {
      console.error("Failed to initialize system status:", error);
      setSystemStatus(prev => ({ ...prev, online: false }));
    }
  }, []);

  // Enhanced logout dengan comprehensive cleanup
  const handleLogout = useCallback(async () => {
    try {
      // Show loading state
      toast.loading("Logging out...", { id: "logout" });

      // Clear all session data
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("activeView");
      localStorage.removeItem("user_preferences"); // Clear any cached preferences
      
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
      localStorage.setItem('last_active_view', newView);
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

  // Format time for last activity
  const formatLastActivity = useCallback((timestamp?: string): string => {
    if (!timestamp) return 'Just now';
    
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
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

  return (
    <SidebarProvider>
      <div className={`flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 transition-all duration-1000 ${isMounted && isVisible ? 'opacity-100' : 'opacity-0'}`}>
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
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>Welcome back, {getDisplayName(user)}</span>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {user.status || 'Active'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3">
                  {/* System Status Indicator */}
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                    {systemStatus.online ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <Wifi className="w-4 h-4" />
                        <span className="text-xs font-medium">Online</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <WifiOff className="w-4 h-4" />
                        <span className="text-xs font-medium">Offline</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">{systemStatus.activeTracking}</span>
                      <span className="text-xs text-blue-600">tracking</span>
                    </div>
                    <div className="w-px h-4 bg-blue-200"></div>
                    <div className="flex items-center gap-1">
                      <Signal className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">{systemStatus.connectedDevices}</span>
                      <span className="text-xs text-green-600">devices</span>
                    </div>
                  </div>

                  {/* Notifications */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="relative p-2">
                        <Bell className="w-5 h-5" />
                        {notifications.length > 0 && (
                          <Badge className="absolute -top-1 -right-1 w-5 h-5 text-xs p-0 flex items-center justify-center bg-red-500">
                            {notifications.length}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel>Recent Notifications</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <DropdownMenuItem key={notif.id} className="p-3">
                            <div className="space-y-1">
                              <p className="text-sm">{notif.message}</p>
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                {formatLastActivity(notif.timestamp)}
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>
                          <span className="text-sm text-slate-500">No notifications</span>
                        </DropdownMenuItem>
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

          {/* Main Content Area dengan enhanced styling */}
          <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50/50 to-slate-100/50">
            <div className="p-6">
              <MainContent 
                activeView={activeView} 
                user={user}
                systemStatus={systemStatus}
                className="transition-all duration-500 ease-out"
              />
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DashboardPage;