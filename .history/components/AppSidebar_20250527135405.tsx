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
    badge: "12",
  },
  {
    title: "Live Tracking",
    icon: MapPin,
    view: "tracking",
    badge: "Online",
  },
  {
    title: "Geofences",
    icon: Shield,
    view: "geofences",
    badge: null,
  },
  {
    title: "Alerts",
    icon: AlertTriangle,
    view: "alerts",
    badge: "3",
  },
  {
    title: "Commands",
    icon: Command,
    view: "commands",
    badge: null,
  },
  {
    title: "Users",
    icon: Users,
    view: "users",
    badge: null,
  },
  {
    title: "Settings",
    icon: Settings,
    view: "settings",
    badge: null,
  },
];

export function AppSidebar({ activeView, setActiveView }: AppSidebarProps) {
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
                        variant={item.badge === "Online" ? "default" : "secondary"}
                        className={`text-xs ${
                          item.badge === "Online" 
                            ? "bg-green-100 text-green-700 border-green-200" 
                            : item.badge === "3"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-slate-100 text-slate-600"
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