import { useState, useEffect } from "react";
import {
  Car,
  MapPin,
  Shield,
  AlertTriangle,
  Command,
  BarChart3,
  Settings,
  Users,
  Menu,
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
  SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

interface VehicleData {
  vehicle_id: string;
  user_id: string;
  gps_device_id: string | null;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  created_at: string;
  updated_at: string | null;
  vehicle_photo: string;
}

interface VehicleStatusData {
  data_id: string;
  vehicle_id: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  speed: number;
  rpm: number;
  fuel_level: string;
  ignition_status: string;
  battery_level: string;
  satellites_used: number;
}

export function AppSidebar({ activeView, setActiveView }: AppSidebarProps) {
  const [vehicleCount, setVehicleCount] = useState<number>(0);
  const [onlineVehicles, setOnlineVehicles] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Fungsi untuk mendapatkan user yang sedang login
  const getCurrentUser = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // Fungsi untuk fetch data kendaraan user
  const fetchUserVehicles = async (userId: string) => {
    try {
      const response = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      
      const data = await response.json();
      const allVehicles: VehicleData[] = data.data || [];
      
      // Filter kendaraan berdasarkan user_id
      const userVehicles = allVehicles.filter(vehicle => vehicle.user_id === userId);
      
      return userVehicles;
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }
  };

  // Fungsi untuk fetch status kendaraan
  const fetchVehicleStatus = async () => {
    try {
      const response = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?limit=-1'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch vehicle status');
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching vehicle status:', error);
      return [];
    }
  };

  // Fungsi untuk menentukan status online berdasarkan data terakhir
  const isVehicleOnline = (vehicleId: string, statusData: VehicleStatusData[]): boolean => {
    const vehicleData = statusData
      .filter(data => data.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (vehicleData.length === 0) return false;
    
    const latestData = vehicleData[0];
    const lastUpdate = new Date(latestData.timestamp);
    const now = new Date();
    const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Anggap online jika data terakhir < 30 menit
    return minutesAgo <= 30;
  };

  // Fungsi untuk menghitung alert berdasarkan kondisi kendaraan
  const calculateAlerts = (vehicles: VehicleData[], statusData: VehicleStatusData[]): number => {
    let alerts = 0;
    
    vehicles.forEach(vehicle => {
      const vehicleStatusList = statusData
        .filter(data => data.vehicle_id === vehicle.vehicle_id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (vehicleStatusList.length > 0) {
        const latestStatus = vehicleStatusList[0];
        
        // Alert conditions:
        // 1. Fuel level < 20%
        if (parseFloat(latestStatus.fuel_level) < 20) alerts++;
        
        // 2. Battery level < 15%
        if (parseFloat(latestStatus.battery_level) < 15) alerts++;
        
        // 3. Vehicle offline > 1 hour
        const lastUpdate = new Date(latestStatus.timestamp);
        const now = new Date();
        const hoursAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 1) alerts++;
      } else {
        // No data = offline alert
        alerts++;
      }
    });
    
    return alerts;
  };

  // Load data saat komponen mount
  useEffect(() => {
    const loadSidebarData = async () => {
      try {
        setLoading(true);
        
        const user = getCurrentUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const userId = user.id || user.user_id || user._id || user.ID;
        if (!userId) {
          setLoading(false);
          return;
        }

        console.log('📊 Loading sidebar data for user:', userId);

        const [vehicles, statusData] = await Promise.all([
          fetchUserVehicles(userId),
          fetchVehicleStatus()
        ]);

        // Hitung jumlah kendaraan
        setVehicleCount(vehicles.length);

        // Hitung kendaraan online
        const onlineCount = vehicles.filter(vehicle => 
          isVehicleOnline(vehicle.vehicle_id, statusData)
        ).length;
        setOnlineVehicles(onlineCount);

        // Hitung alert
        const alerts = calculateAlerts(vehicles, statusData);
        setAlertCount(alerts);

        console.log('📊 Sidebar stats:', {
          totalVehicles: vehicles.length,
          onlineVehicles: onlineCount,
          alerts: alerts
        });

      } catch (error) {
        console.error('Error loading sidebar data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSidebarData();

    // Refresh data setiap 5 menit
    const interval = setInterval(loadSidebarData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Dynamic menu items dengan data real
  const menuItems = [
    {
      title: "Dashboard",
      icon: BarChart3,
      view: "dashboard",
      badge: null,
    },
    {
      title: "Vehicles",
      icon: Car,
      view: "vehicles",
      badge: loading ? "..." : vehicleCount.toString(),
      badgeColor: "bg-slate-100 text-slate-600"
    },
    {
      title: "Live Tracking",
      icon: MapPin,
      view: "tracking",
      badge: loading ? "..." : onlineVehicles > 0 ? `${onlineVehicles} Online` : "Offline",
      badgeColor: loading ? "bg-slate-100 text-slate-600" : 
                  onlineVehicles > 0 ? "bg-green-100 text-green-700 border-green-200" : 
                  "bg-red-100 text-red-700 border-red-200"

  return (
    <Sidebar className="border-r border-slate-200">
      <SidebarHeader className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800">GPS Tracker</h1>
            <p className="text-xs text-slate-500">Vehicle Management System</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-600 font-medium px-2 py-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => setActiveView(item.view)}
                    className={`w-full justify-between hover:bg-blue-50 hover:text-blue-700 ${
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
                        className={`text-xs ${
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
      </SidebarContent>
    </Sidebar>
  );
}