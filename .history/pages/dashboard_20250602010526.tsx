// pages/dashboard.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MainContent } from "@/components/MainContent";
import { toast } from "sonner";
import { Menu } from "lucide-react";

// Definisikan interface User, sesuaikan properti tambahan jika diperlukan:
// - full_name dan username bisa saja tidak ada → tandai sebagai opsional (?)
// - email wajib ada
interface User {
  full_name?: string;
  username?: string;
  email: string;
  // jika ada properti lain (misalnya: id), tambahkan di sini
}

const DashboardPage = () => {
  const router = useRouter();
  const [activeView, setActiveView] = useState("dashboard");
  // Beri tipe User | null agar TS mengenali property seperti full_name atau username
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Cek autentikasi saat halaman pertama kali dimuat
  useEffect(() => {
    const checkAuth = () => {
      try {
        const userData = sessionStorage.getItem("user");
        if (!userData) {
          router.push("/login");
          return false;
        }
        const parsedUser = JSON.parse(userData) as User;
        if (!parsedUser || !parsedUser.email) {
          throw new Error("Invalid user data");
        }

        setUser(parsedUser);

        // Cek override activeView dari sessionStorage (jika ada)
        const storedActiveView = sessionStorage.getItem("activeView");
        if (storedActiveView) {
          setActiveView(storedActiveView);
          // Hapus setelah dipakai agar tidak persist terus-menerus
          sessionStorage.removeItem("activeView");
        }

        return true;
      } catch (error) {
        console.error("Authentication error:", error);
        sessionStorage.removeItem("user");
        router.push("/login");
        return false;
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    router.push("/");
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Sudah dialihkan ke /login
  }

  return (
    <SidebarProvider>
      {/* Gunakan min-h-screen agar konten bisa scroll jika panjang */}
      <div className="flex min-h-screen w-full bg-gray-50">
        {/* Sidebar */}
        <AppSidebar activeView={activeView} setActiveView={setActiveView} />

        {/* Main Content */}
        <SidebarInset className="flex flex-col w-full">
          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </SidebarTrigger>
                  <div>
                    <h1 className="text-xl font-semibold text-slate-800 capitalize">
                      {activeView === "tracking" ? "Live Tracking" : activeView}
                    </h1>
                    <p className="text-sm text-slate-500">
                      Welcome back,{" "}
                      {/* 
                        Karena User.full_name dan User.username bisa undefined,
                        gunakan conditional chaining dan fallback ke email
                      */}
                      {user.full_name || user.username || user.email}
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

          {/* Area konten utama: beri overflow-auto agar konten panjang dapat digulir */}
          <div className="flex-1 overflow-auto bg-slate-50">
            <MainContent activeView={activeView} />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DashboardPage;
