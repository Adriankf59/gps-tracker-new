// pages/dashboard.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MainContent } from "@/components/MainContent";
import { toast } from 'sonner';
import { Menu } from 'lucide-react';

const Index = () => {
  const router = useRouter();
  const [activeView, setActiveView] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication on page load
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
      console.error('Invalid user data:', error);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

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
                      {activeView === "tracking" ? "Live Tracking" : activeView}
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
          <main className="flex-1 overflow-auto">
            <MainContent activeView={activeView} />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Index;