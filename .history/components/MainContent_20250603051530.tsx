import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

// Lazy loaded components dengan proper error boundaries
const Dashboard = lazy(() => 
  import('@/components/Dashboard').catch(err => {
    console.error('Failed to load Dashboard:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Dashboard" /> };
  })
);

const VehicleManager = lazy(() => 
  import('@/components/VehicleManager').catch(err => {
    console.error('Failed to load VehicleManager:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Vehicle Manager" /> };
  })
);

const LiveTracking = lazy(() => 
  import('@/components/LiveTracking').catch(err => {
    console.error('Failed to load LiveTracking:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Live Tracking" /> };
  })
);

const GeofenceManager = lazy(() => 
  import('@/components/GeofenceManager').catch(err => {
    console.error('Failed to load GeofenceManager:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Geofence Manager" /> };
  })
);

const AlertManager = lazy(() => 
  import('@/components/AlertManager').catch(err => {
    console.error('Failed to load AlertManager:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Alert Manager" /> };
  })
);

const CommandCenter = lazy(() => 
  import('@/components/CommandCenter').catch(err => {
    console.error('Failed to load CommandCenter:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Command Center" /> };
  })
);

const UserManager = lazy(() => 
  import('@/components/UserManager').catch(err => {
    console.error('Failed to load UserManager:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="User Manager" /> };
  })
);

const SettingsPanel = lazy(() => 
  import('@/components/SettingsPanel').catch(err => {
    console.error('Failed to load SettingsPanel:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="Settings Panel" /> };
  })
);

const HistoryManager = lazy(() => 
  import('@/components/HistoryManager').catch(err => {
    console.error('Failed to load HistoryManager:', err);
    return { default: () => <ErrorFallback error={err} resetErrorBoundary={() => {}} componentName="History Manager" /> };
  })
);

// Component Registry untuk better management (dengan default permissions yang lebih permissive)
interface ComponentConfig {
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  title: string;
  description: string;
  requiredPermissions?: string[];
  subscriptionRequired?: 'free' | 'premium' | 'enterprise';
  icon?: React.ReactNode;
  isPublic?: boolean; // New: untuk components yang bisa diakses semua user
}

const COMPONENT_REGISTRY: Record<string, ComponentConfig> = {
  dashboard: {
    component: Dashboard,
    title: 'Dashboard',
    description: 'Overview of your fleet and system status',
    isPublic: true, // Dashboard bisa diakses semua user
  },
  vehicles: {
    component: VehicleManager,
    title: 'Vehicle Manager',
    description: 'Manage your fleet vehicles and configurations',
    requiredPermissions: ['view_vehicles'],
  },
  tracking: {
    component: LiveTracking,
    title: 'Live Tracking',
    description: 'Real-time vehicle location and status monitoring',
    isPublic: true, // Tracking bisa diakses semua user
  },
  geofences: {
    component: GeofenceManager,
    title: 'Geofence Manager',
    description: 'Create and manage geographic boundaries',
    requiredPermissions: ['view_geofences'],
    subscriptionRequired: 'premium',
  },
  alerts: {
    component: AlertManager,
    title: 'Alert Manager',
    description: 'Configure and monitor system alerts',
    requiredPermissions: ['view_alerts'],
  },
  commands: {
    component: CommandCenter,
    title: 'Command Center',
    description: 'Send remote commands to vehicles',
    requiredPermissions: ['send_commands'],
    subscriptionRequired: 'premium',
  },
  history: {
    component: HistoryManager,
    title: 'History Manager',
    description: 'View historical data and reports',
    isPublic: true, // History bisa diakses semua user
  },
  users: {
    component: UserManager,
    title: 'User Manager',
    description: 'Manage system users and permissions',
    requiredPermissions: ['manage_users'],
    subscriptionRequired: 'enterprise',
  },
  settings: {
    component: SettingsPanel,
    title: 'Settings',
    description: 'System configuration and preferences',
    isPublic: true, // Settings bisa diakses semua user
  },
};

// Permission Check Component (Updated dengan default permissions)
interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  userPermissions?: string[];
  subscriptionRequired?: 'free' | 'premium' | 'enterprise';
  userSubscription?: string;
  componentName: string;
  isPublic?: boolean; // New: untuk bypass permission check
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermissions = [],
  userPermissions = [],
  subscriptionRequired,
  userSubscription = 'free',
  componentName,
  isPublic = false, // Default false untuk backward compatibility
}) => {
  // Jika component adalah public, langsung render tanpa check permissions
  if (isPublic) {
    return <>{children}</>;
  }

  // Jika tidak ada required permissions, anggap sebagai public access
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  // Check permissions (hanya jika ada required permissions)
  const hasRequiredPermissions = requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  );

  // Check subscription level
  const hasRequiredSubscription = !subscriptionRequired || 
    (subscriptionRequired === 'free') ||
    (subscriptionRequired === 'premium' && ['premium', 'enterprise'].includes(userSubscription)) ||
    (subscriptionRequired === 'enterprise' && userSubscription === 'enterprise');

  if (!hasRequiredPermissions) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md border-yellow-200 bg-yellow-50">
          <CardHeader className="text-center">
            <CardTitle className="text-yellow-800">Access Restricted</CardTitle>
            <CardDescription className="text-yellow-600">
              You don't have permission to access {componentName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-yellow-700">
              Contact your administrator to request access to this feature.
            </p>
            <div className="text-xs text-slate-500 bg-white p-2 rounded border">
              <strong>Required permissions:</strong> {requiredPermissions.join(', ')}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasRequiredSubscription) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md border-purple-200 bg-purple-50">
          <CardHeader className="text-center">
            <CardTitle className="text-purple-800">Upgrade Required</CardTitle>
            <CardDescription className="text-purple-600">
              {componentName} requires a {subscriptionRequired} subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-purple-700">
              Upgrade your plan to access this premium feature.
            </p>
            <Button className="bg-purple-600 hover:bg-purple-700">
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

// Main Content Component
export const MainContent: React.FC<MainContentProps> = ({ 
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

  // Track view changes untuk analytics
  useEffect(() => {
    if (previousView !== activeView) {
      setPreviousView(activeView);
      
      // Optional: Send analytics event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'view_change', {
          event_category: 'navigation',
          event_label: activeView,
          user_id: user?.id || user?.user_id
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
    // Clear any cached modules
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // Render component dengan proper error boundaries
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
        resetKeys={[activeView]} // Reset error boundary when view changes
      >
        <PermissionGuard
          requiredPermissions={componentConfig.requiredPermissions}
          userPermissions={user?.permissions || []} // Default ke empty array jika undefined
          subscriptionRequired={componentConfig.subscriptionRequired}
          userSubscription={user?.subscription_type || 'free'} // Default ke 'free' jika undefined
          componentName={componentConfig.title}
          isPublic={componentConfig.isPublic} // Pass isPublic flag
        >
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
    <main className={cn('flex-1 overflow-hidden', className)}>
      <div className="w-full h-full overflow-auto bg-gradient-to-br from-slate-50/50 to-slate-100/50">
        <div className="p-6">
          {/* Page Header dengan breadcrumb */}
          <div className={cn(
            'mb-6 transition-all duration-500 ease-out',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 mb-1">
                  {componentConfig.title}
                </h1>
                <p className="text-slate-600 text-sm">
                  {componentConfig.description}
                </p>
              </div>
              
              {/* Optional: System status indicator */}
              {systemStatus && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg shadow-sm border">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    systemStatus.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  )} />
                  <span className="text-xs font-medium text-slate-700">
                    {systemStatus.online ? 'System Online' : 'System Offline'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Component Content */}
          <div className={cn(
            'transition-all duration-500 ease-out',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}>
            {renderComponent()}
          </div>
        </div>
      </div>
    </main>
  );
};

// Export individual components untuk direct import jika diperlukan
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
};

// Export types
export type { MainContentProps, ComponentConfig };