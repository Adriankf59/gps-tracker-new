// components/MainContent.tsx
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Dashboard } from "@/components/Dashboard";
import { VehicleManager } from "@/components/VehicleManager";
import { LiveTracking } from "@/components/LiveTracking";
import { GeofenceManager } from "@/components/GeofenceManager";
import { AlertManager } from "@/components/AlertManager";
import { CommandCenter } from "@/components/CommandCenter";
import { UserManager } from "@/components/UserManager";
import { SettingsPanel } from "@/components/SettingsPanel";

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
    <main className="flex-1 overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-slate-600 hover:text-slate-800 lg:hidden" />
          <div>

            <p className="text-sm text-slate-500">
              Overview of your fleet management
            </p>
          </div>
        </div>
      </div>
      <div className="w-full h-full overflow-auto p-6">
        {renderContent()}
      </div>
    </main>
  );
}