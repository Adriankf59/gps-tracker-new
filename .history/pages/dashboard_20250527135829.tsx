// pages/dashboard.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AppSidebar } from '@/components/AppSidebar';
import { Dashboard } from '@/components/Dashboard';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { toast } from 'sonner';
import { Menu } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'vehicles':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Vehicles</h1>
            <p>Vehicles management content will be here...</p>
          </div>
        );
      case 'tracking':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Live Tracking</h1>
            <p>Live tracking content will be here...</p>
          </div>
        );
      case 'geofences':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Geofences</h1>
            <p>Geofences content will be here...</p>
          </div>
        );
      case 'alerts':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Alerts</h1>
            <p>Alerts content will be here...</p>
          </div>
        );
      case 'commands':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Commands</h1>
            <p>Commands content will be here...</p>
          </div>
        );
      case 'users':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Users</h1>
            <p>Users management content will be here...</p>
          </div>
        );
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <p>Settings content will be here...</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <AppSidebar activeView={activeView} setActiveView={setActiveView} />
        
        {/* Main Content */}
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
                      Welcome back, {user.full_name || user.username || user.email}
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
          <main className="flex-1 overflow-auto">
            {renderContent()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}