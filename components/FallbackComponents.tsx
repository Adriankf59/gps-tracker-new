// Temporary fallback components untuk development
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Car, 
  Navigation, 
  MapPin, 
  Shield, 
  Bell, 
  Command, 
  Users, 
  Settings, 
  History,
  BarChart3,
  Activity,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap
} from 'lucide-react';

// Props interface untuk semua fallback components
interface FallbackComponentProps {
  user?: any;
  systemStatus?: any;
  onViewChange?: (view: string) => void;
}

// Dashboard Component
export const Dashboard: React.FC<FallbackComponentProps> = ({ user, systemStatus }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Welcome to GPS Command Center
            </h2>
            <p className="text-blue-100">
              Hello {user?.full_name || user?.username || 'User'}! Monitor and manage your fleet with real-time insights
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <MapPin className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Vehicles</p>
                <p className="text-3xl font-bold text-slate-900">12</p>
              </div>
              <Car className="w-8 h-8 text-blue-600" />
            </div>
            <div className="mt-4">
              <Badge className="text-xs">+2 this month</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Trips</p>
                <p className="text-3xl font-bold text-slate-900">8</p>
              </div>
              <Navigation className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-4">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                Live tracking
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Distance Today</p>
                <p className="text-3xl font-bold text-slate-900">2,847</p>
                <p className="text-xs text-slate-500">kilometers</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">System Status</p>
                <p className="text-xl font-bold text-green-600">Online</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-4">
              <Badge className="text-xs bg-green-600">All systems operational</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Vehicle GPS001 started trip to Jakarta', time: '2 min ago', type: 'info' },
                { action: 'Geofence alert: Vehicle exited zone', time: '5 min ago', type: 'warning' },
                { action: 'Vehicle GPS002 reached destination', time: '15 min ago', type: 'success' },
                { action: 'Route optimization completed', time: '1 hour ago', type: 'info' }
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' : 
                    activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Fleet Efficiency</span>
                <span className="font-semibold text-green-600">92%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Fuel Savings</span>
                <span className="font-semibold text-blue-600">245L</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Average Speed</span>
                <span className="font-semibold text-purple-600">65 km/h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Uptime</span>
                <span className="font-semibold text-green-600">99.8%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Generic fallback component untuk features yang belum diimplementasi
const GenericFallback: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  comingSoon?: boolean;
}> = ({ icon, title, description, comingSoon = true }) => {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">{description}</p>
        
        {comingSoon && (
          <div className="space-y-4">
            <Badge className="bg-blue-600 text-white px-4 py-2">
              Coming Soon
            </Badge>
            <p className="text-sm text-slate-500">
              This feature is under development and will be available soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Vehicle Manager
export const VehicleManager: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Car className="w-8 h-8 text-blue-600" />}
    title="Vehicle Manager"
    description="Manage your fleet vehicles, add new vehicles, configure tracking devices, and monitor vehicle health."
  />
);

// Live Tracking
export const LiveTracking: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Navigation className="w-8 h-8 text-blue-600" />}
    title="Live Tracking"
    description="Real-time vehicle location monitoring, route tracking, and live fleet status updates."
  />
);

// Geofence Manager
export const GeofenceManager: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Shield className="w-8 h-8 text-blue-600" />}
    title="Geofence Manager"
    description="Create virtual boundaries, set up entry/exit alerts, and manage geographical restrictions for your fleet."
  />
);

// Alert Manager
export const AlertManager: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Bell className="w-8 h-8 text-blue-600" />}
    title="Alert Manager"
    description="Configure system alerts, notification preferences, and manage emergency response protocols."
  />
);

// Command Center
export const CommandCenter: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Command className="w-8 h-8 text-blue-600" />}
    title="Command Center"
    description="Send remote commands to vehicles, control engine functions, and manage fleet operations remotely."
  />
);

// User Manager
export const UserManager: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Users className="w-8 h-8 text-blue-600" />}
    title="User Manager"
    description="Manage system users, assign roles and permissions, and control access to fleet management features."
  />
);

// Settings Panel
export const SettingsPanel: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<Settings className="w-8 h-8 text-blue-600" />}
    title="Settings Panel"
    description="Configure system preferences, update account settings, and customize your GPS tracking experience."
  />
);

// History Manager
export const HistoryManager: React.FC<FallbackComponentProps> = () => (
  <GenericFallback
    icon={<History className="w-8 h-8 text-blue-600" />}
    title="History Manager"
    description="View historical tracking data, generate reports, and analyze fleet performance over time."
  />
);