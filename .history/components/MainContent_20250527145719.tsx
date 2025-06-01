// components/MainContent.tsx
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import Dashboard from "@/components/Dashboard";
import VehicleManager from "@/components/VehicleManager";
import LiveTracking from "@/components/LiveTracking";
import GeofenceManager from "@/components/GeofenceManager";
import AlertManager from "@/components/AlertManager";
import CommandCenter from "@/components/CommandCenter";
import UserManager from "@/components/UserManager";
import SettingsPanel from "@/components/SettingsPanel";

interface MainContentProps {
  activeView: string;
}

export function MainContent({ activeView }: MainContentProps) {
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

  return (
    <div className="p-6 h-full overflow-auto">
      {renderContent()}
    </div>
  );
}