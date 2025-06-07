import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Enhanced interface dengan comprehensive typing
interface MainContentProps {
  activeView: string;
  user?: {
    id?: string;
    user_id?: string;
    full_name?: string;
    username?: string;
    email: string;
    permissions?: string[];
    subscription_type?: 'free' | 'premium' | 'enterprise';
  };
  systemStatus?: {
    online: boolean;
    lastUpdate: Date;
    connectedDevices: number;
    activeTracking: number;
  };
  className?: string;
  onViewChange?: (view: string) => void;
}

// Error Fallback Component
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  componentName?: string;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetErrorBoundary, 
  componentName = 'Component' 
}) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-md border-red-200 bg-red-50">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-red-800">Error Loading {componentName}</CardTitle>
          <CardDescription className="text-red-600">
            Something went wrong while loading this component
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-sm text-red-700 bg-red-100 p-3 rounded border">
            <strong>Error:</strong> {error.message}
          </div>
          <div className="flex gap-2 justify-center">
            <Button 
              onClick={resetErrorBoundary}
              variant="outline" 
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700"
            >
              Reload Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Enhanced Loading Component
interface LoadingFallbackProps {
  componentName?: string;
  description?: string;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ 
  componentName = 'Component',
  description 
}) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-400 rounded-full animate-ping mx-auto"></div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Loading {componentName}
          </h3>
          {description && (
            <p className="text-sm text-slate-600">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Generic Component Props Interface
interface ComponentProps {
  user?: any;
  systemStatus?: any;
  onViewChange?: (view: string) => void;
}

// ========================================
// 🎯 FALLBACK COMPONENTS - CLEAN VERSION
// Clean fallback components without excessive badges
// ========================================

const DashboardFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-blue-200 bg-blue-50">
        <CardHeader className="text-center">
          <CardTitle className="text-blue-800 text-2xl">Dashboard</CardTitle>
          <CardDescription className="text-blue-600 text-base">
            Vehicle fleet overview and monitoring dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-blue-700 bg-blue-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">🚧 Component Under Development</p>
            <p>This feature is currently being developed and will be available soon.</p>
          </div>
          
          {user && (
            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-slate-800 mb-2">Current User</h4>
              <p className="text-sm text-slate-600">{user.email}</p>
              {user.full_name && <p className="text-sm text-slate-600">{user.full_name}</p>}
            </div>
          )}

          {systemStatus && (
            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-slate-800 mb-2">System Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Status: </span>
                  <span className={systemStatus.online ? "text-green-600" : "text-red-600"}>
                    {systemStatus.online ? "Online" : "Offline"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Active Tracking: </span>
                  <span className="text-blue-600">{systemStatus.activeTracking}</span>
                </div>
                <div>
                  <span className="text-slate-600">Connected Devices: </span>
                  <span className="text-green-600">{systemStatus.connectedDevices}</span>
                </div>
                <div>
                  <span className="text-slate-600">Last Update: </span>
                  <span className="text-slate-600">{systemStatus.lastUpdate.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={() => onViewChange?.('dashboard')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Refresh Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const VehicleManagerFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <CardTitle className="text-green-800 text-2xl">Vehicle Manager</CardTitle>
          <CardDescription className="text-green-600 text-base">
            Manage your fleet vehicles and configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-green-700 bg-green-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">🚗 Vehicle Management System</p>
            <p>Vehicle management features are being prepared for your fleet.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-green-600 hover:bg-green-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const LiveTrackingFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-red-200 bg-red-50">
        <CardHeader className="text-center">
          <CardTitle className="text-red-800 text-2xl">Live Tracking</CardTitle>
          <CardDescription className="text-red-600 text-base">
            Real-time vehicle location and status monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-red-700 bg-red-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">📍 Live Tracking System</p>
            <p>Real-time GPS tracking features are being initialized.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-red-600 hover:bg-red-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const GeofenceManagerFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-purple-200 bg-purple-50">
        <CardHeader className="text-center">
          <CardTitle className="text-purple-800 text-2xl">Geofence Manager</CardTitle>
          <CardDescription className="text-purple-600 text-base">
            Create and manage geographic boundaries
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-purple-700 bg-purple-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">🗺️ Geofence Management</p>
            <p>Geographic boundary management tools are being prepared.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-purple-600 hover:bg-purple-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const AlertManagerFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-orange-200 bg-orange-50">
        <CardHeader className="text-center">
          <CardTitle className="text-orange-800 text-2xl">Alert Manager</CardTitle>
          <CardDescription className="text-orange-600 text-base">
            Configure and monitor system alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-orange-700 bg-orange-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">🚨 Alert Management System</p>
            <p>Alert configuration and monitoring tools are being set up.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-orange-600 hover:bg-orange-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const CommandCenterFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-indigo-200 bg-indigo-50">
        <CardHeader className="text-center">
          <CardTitle className="text-indigo-800 text-2xl">Command Center</CardTitle>
          <CardDescription className="text-indigo-600 text-base">
            Send remote commands to vehicles
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-indigo-700 bg-indigo-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">⚡ Command Center</p>
            <p>Remote command capabilities are being established.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-indigo-600 hover:bg-indigo-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const UserManagerFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-teal-200 bg-teal-50">
        <CardHeader className="text-center">
          <CardTitle className="text-teal-800 text-2xl">User Manager</CardTitle>
          <CardDescription className="text-teal-600 text-base">
            Manage system users and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-teal-700 bg-teal-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">👥 User Management</p>
            <p>User administration tools are being configured.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-teal-600 hover:bg-teal-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const SettingsPanelFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-gray-200 bg-gray-50">
        <CardHeader className="text-center">
          <CardTitle className="text-gray-800 text-2xl">Settings Panel</CardTitle>
          <CardDescription className="text-gray-600 text-base">
            System configuration and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-gray-700 bg-gray-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">⚙️ System Settings</p>
            <p>Configuration options are being prepared.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-gray-600 hover:bg-gray-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const HistoryManagerFallback: React.FC<ComponentProps> = ({ user, systemStatus, onViewChange }) => {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="w-full max-w-2xl border-cyan-200 bg-cyan-50">
        <CardHeader className="text-center">
          <CardTitle className="text-cyan-800 text-2xl">History Manager</CardTitle>
          <CardDescription className="text-cyan-600 text-base">
            View historical data and reports
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="text-sm text-cyan-700 bg-cyan-100 p-4 rounded-lg border">
            <p className="font-medium mb-2">📊 Historical Data</p>
            <p>Historical tracking and reporting tools are being loaded.</p>
          </div>
          <Button onClick={() => onViewChange?.('dashboard')} className="bg-cyan-600 hover:bg-cyan-700">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ========================================
// 🎯 LAZY LOADING COMPONENTS
// ========================================

const Dashboard = lazy(() =>
  (import('@/components/Dashboard')
    .then(mod => ({ default: (mod as any).Dashboard || (mod as any).default }))
    .catch(() => ({ default: DashboardFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const VehicleManager = lazy(() =>
  (import('@/components/VehicleManager')
    .then(mod => ({ default: (mod as any).VehicleManager || (mod as any).default }))
    .catch(() => ({ default: VehicleManagerFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const LiveTracking = lazy(() =>
  (import('@/components/LiveTracking')
    .then(mod => ({ default: (mod as any).LiveTracking || (mod as any).default }))
    .catch(() => ({ default: LiveTrackingFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const GeofenceManager = lazy(() =>
  (import('@/components/GeofenceManager')
    .then(mod => ({ default: (mod as any).GeofenceManager || (mod as any).default }))
    .catch(() => ({ default: GeofenceManagerFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const AlertManager = lazy(() =>
  (import('@/components/AlertManager')
    .then(mod => ({ default: (mod as any).AlertManager || (mod as any).default }))
    .catch(() => ({ default: AlertManagerFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const CommandCenter = lazy(() =>
  (import('@/components/CommandCenter')
    .then(mod => ({ default: (mod as any).CommandCenter || (mod as any).default }))
    .catch(() => ({ default: CommandCenterFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const UserManager = lazy(() =>
  (import('@/components/UserManager')
    .then(mod => ({ default: (mod as any).UserManager || (mod as any).default }))
    .catch(() => ({ default: UserManagerFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const SettingsPanel = lazy(() =>
  (import('@/components/SettingsPanel')
    .then(mod => ({ default: (mod as any).SettingsPanel || (mod as any).default }))
    .catch(() => ({ default: SettingsPanelFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

const HistoryManager = lazy(() =>
  (import('@/components/HistoryManager')
    .then(mod => ({ default: (mod as any).HistoryManager || (mod as any).default }))
    .catch(() => ({ default: HistoryManagerFallback }))
  ) as Promise<{ default: React.ComponentType<any> }>
);

// ========================================
// 🔓 COMPONENT REGISTRY
// ========================================

interface ComponentConfig {
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  title: string;
  description: string;
  requiredPermissions?: string[];
  subscriptionRequired?: 'free' | 'premium' | 'enterprise';
  icon?: React.ReactNode;
  isPublic?: boolean;
}

const COMPONENT_REGISTRY: Record<string, ComponentConfig> = {
  dashboard: {
    component: Dashboard,
    title: 'Dashboard',
    description: 'Overview of your fleet and system status',
    isPublic: true,
  },
  vehicles: {
    component: VehicleManager,
    title: 'Vehicle Manager',
    description: 'Manage your fleet vehicles and configurations',
    isPublic: true,
  },
  tracking: {
    component: LiveTracking,
    title: 'Live Tracking',
    description: 'Real-time vehicle location and status monitoring',
    isPublic: true,
  },
  geofences: {
    component: GeofenceManager,
    title: 'Geofence Manager',
    description: 'Create and manage geographic boundaries',
    isPublic: true,
  },
  alerts: {
    component: AlertManager,
    title: 'Alert Manager',
    description: 'Configure and monitor system alerts',
    isPublic: true,
  },
  commands: {
    component: CommandCenter,
    title: 'Command Center',
    description: 'Send remote commands to vehicles',
    isPublic: true,
  },
  history: {
    component: HistoryManager,
    title: 'History Manager',
    description: 'View historical data and reports',
    isPublic: true,
  },
  users: {
    component: UserManager,
    title: 'User Manager',
    description: 'Manage system users and permissions',
    isPublic: true,
  },
  settings: {
    component: SettingsPanel,
    title: 'Settings',
    description: 'System configuration and preferences',
    isPublic: true,
  },
};

// ========================================
// 🔓 PERMISSION GUARD (SIMPLIFIED)
// ========================================

interface PermissionGuardProps {
  children: React.ReactNode;
  componentName: string;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  componentName,
}) => {
  // Simplified - direct access to all components
  console.log(`Access granted: ${componentName}`);
  return <>{children}</>;
};

// ========================================
// 🎯 MAIN CONTENT COMPONENT (CLEAN VERSION)
// ========================================

export const CleanMainContent: React.FC<MainContentProps> = ({ 
  activeView, 
  user,
  systemStatus,
  className,
  onViewChange 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [previousView, setPreviousView] = useState<string>('');

  // Animation effect
  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, [activeView]);

  // Track view changes
  useEffect(() => {
    if (previousView !== activeView) {
      setPreviousView(activeView);
      
      // Analytics tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'view_change', {
          event_category: 'navigation',
          event_label: activeView,
          user_id: user?.id || user?.user_id,
        });
      }
    }
  }, [activeView, previousView, user]);

  // Get component configuration
  const componentConfig = useMemo(() => {
    return COMPONENT_REGISTRY[activeView] || COMPONENT_REGISTRY.dashboard;
  }, [activeView]);

  // Enhanced error boundary reset
  const handleErrorReset = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // Render component
  const renderComponent = useCallback(() => {
    const ComponentToRender = componentConfig.component;
    
    return (
      <ErrorBoundary
        FallbackComponent={(props) => (
          <ErrorFallback 
            {...props} 
            componentName={componentConfig.title}
          />
        )}
        onReset={handleErrorReset}
        resetKeys={[activeView]}
      >
        <PermissionGuard componentName={componentConfig.title}>
          <Suspense 
            fallback={
              <LoadingFallback 
                componentName={componentConfig.title}
                description={componentConfig.description}
              />
            }
          >
            <ComponentToRender 
              user={user}
              systemStatus={systemStatus}
              onViewChange={onViewChange}
            />
          </Suspense>
        </PermissionGuard>
      </ErrorBoundary>
    );
  }, [componentConfig, user, systemStatus, onViewChange, activeView, handleErrorReset]);

  return (
    // White background instead of gradient
    <div className={cn(
      'bg-white transition-all duration-500 ease-out',
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    )}>
      {renderComponent()}
    </div>
  );
};

// Export semua komponen
export {
  Dashboard,
  VehicleManager,
  LiveTracking,
  GeofenceManager,
  AlertManager,
  CommandCenter,
  UserManager,
  SettingsPanel,
  HistoryManager,
  PermissionGuard,
  COMPONENT_REGISTRY
};

// Export types
export type { MainContentProps, ComponentConfig };

// Export default as CleanMainContent
export default CleanMainContent;