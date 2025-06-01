// components/MainContent.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Dashboard } from "@/components/Dashboard";
import { VehicleManager } from "@/components/VehicleManager";
import { LiveTracking } from "@/components/LiveTracking";
import { GeofenceManager } from "@/components/GeofenceManager";
import { AlertManager } from "@/components/AlertManager";
import { CommandCenter } from "@/components/CommandCenter";
import { UserManager } from "@/components/UserManager";
import { SettingsPanel } from "@/components/SettingsPanel";
import { toast } from 'sonner';

interface MainContentProps {
  activeView: string;
}

export function MainContent({ activeView }: MainContentProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const userData = sessionStorage.getItem('user');
    
    if (!userData) {
      // Redirect to login if not authenticated
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      sessionStorage.removeItem('user');
      router.push('/login');
      return;
    }

    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    router.push('/login');
    toast.success('Logged out successfully');
  };

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard />;
      case "vehicles":
        return <VehicleManager />;
      case "tracking":
        return <LiveTracking />;
      case "geofences":
        return <GeofenceManager />;
      case "alerts":
        return <AlertManager />;
      case "commands":
        return <CommandCenter />;
      case "users":
        return <UserManager />;
      case "settings":
        return <SettingsPanel />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <main className="flex-1 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <main className="flex-1 overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-slate-600 hover:text-slate-800" />
            <div>
              <h2 className="text-xl font-semibold text-slate-800 capitalize">
                {activeView === "tracking" ? "Live Tracking" : activeView}
              </h2>
              <p className="text-sm text-slate-500">
                {activeView === "dashboard" && "Overview of your fleet management"}
                {activeView === "vehicles" && "Manage your vehicle fleet"}
                {activeView === "tracking" && "Real-time vehicle locations"}
                {activeView === "geofences" && "Set up geographic boundaries"}
                {activeView === "alerts" && "Monitor system notifications"}
                {activeView === "commands" && "Control vehicle operations"}
                {activeView === "users" && "Manage system users"}
                {activeView === "settings" && "Configure system preferences"}
              </p>
            </div>
          </div>
          
          {/* User info and logout */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              Welcome, {user?.full_name || user?.username || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      <div className="p-6 h-full overflow-auto">
        {renderContent()}
      </div>
    </main>
  );
}dow p-6">
              <p className="text-slate-600">Alerts management content will be here...</p>
            </div>
          </div>
        );
      case 'commands':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Commands</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-slate-600">Vehicle commands content will be here...</p>
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Users</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-slate-600">Users management content will be here...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-slate-600">Settings content will be here...</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-6">
            <Dashboard />
          </div>
        );
    }
  };

  return (
    <SidebarInset className="flex-1">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="lg:hidden">
                <Menu className="h-4 w-4" />
              </SidebarTrigger>
              <div>
                <h1 className="text-xl font-semibold text-slate-800 capitalize">
                  {activeView}
                </h1>
                <p className="text-sm text-slate-500">
                  Welcome back, {user?.full_name || user?.username || user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {renderContent()}
      </main>
    </SidebarInset>
  );
}