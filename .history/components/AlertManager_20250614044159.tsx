import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  Search, 
  Filter,
  CheckCircle,
  Clock,
  MapPin,
  Zap,
  Fuel,
  Shield,
  PowerOff,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown
} from "lucide-react";

// Mock data and interfaces
interface ManagedAlert {
  id: string;
  type: string;
  vehicleName: string;
  message: string;
  locationString?: string;
  timestamp: Date;
  status: "active" | "acknowledged" | "resolved";
  severity: "high" | "medium" | "low";
  geofenceName?: string | null;
}

// Constants
const ALERT_ICONS = {
  speed_limit: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />,
  low_fuel: <Fuel className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />,
  low_battery: <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />,
  engine_off: <PowerOff className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />,
  geofence: <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />,
  default: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
} as const;

const STATUS_STYLES = {
  active: 'bg-red-100 text-red-700 border-red-300',
  acknowledged: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  resolved: 'bg-green-100 text-green-700 border-green-300'
} as const;

const SEVERITY_STYLES = {
  high: 'bg-red-100 text-red-700 border-red-300',
  medium: 'bg-orange-100 text-orange-700 border-orange-300',
  low: 'bg-blue-100 text-blue-700 border-blue-300'
} as const;

// Mock data
const mockAlerts: ManagedAlert[] = [
  {
    id: "1",
    type: "speed_limit",
    vehicleName: "Truck Jakarta 01",
    message: "Kendaraan melebihi batas kecepatan 120 km/h di Tol Cikampek",
    locationString: "Lat: -6.2088, Lon: 106.8456",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    status: "active",
    severity: "high",
    geofenceName: "Zona Tol Cikampek"
  },
  {
    id: "2",
    type: "low_fuel",
    vehicleName: "Van Delivery 05",
    message: "Level bahan bakar rendah (15%), segera isi ulang",
    locationString: "Lat: -6.3021, Lon: 106.8951",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    status: "acknowledged",
    severity: "medium",
    geofenceName: null
  },
  {
    id: "3",
    type: "geofence",
    vehicleName: "Sedan Executive 02",
    message: "Kendaraan memasuki area terlarang: Zona Militer",
    locationString: "Lat: -6.1753, Lon: 106.8271",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "resolved",
    severity: "high",
    geofenceName: "Zona Militer Cilangkap"
  }
];

export default function AlertManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [alerts, setAlerts] = useState<ManagedAlert[]>(mockAlerts);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (!searchTerm) return alerts;
    
    const searchLower = searchTerm.toLowerCase();
    return alerts.filter(alert =>
      alert.vehicleName.toLowerCase().includes(searchLower) ||
      alert.message.toLowerCase().includes(searchLower) ||
      alert.type.toLowerCase().includes(searchLower)
    );
  }, [alerts, searchTerm]);

  // Alert statistics
  const alertStats = useMemo(() => {
    return {
      active: alerts.filter(a => a.status === 'active').length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      highPriority: alerts.filter(a => a.severity === 'high').length
    };
  }, [alerts]);

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const } : a));
  };

  const handleResolve = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const getAlertIcon = (type: string) => {
    return ALERT_ICONS[type as keyof typeof ALERT_ICONS] || ALERT_ICONS.default;
  };

  const formatAlertType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-4 pb-20 md:pb-4 space-y-4">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Alert Manager</h1>
          <p className="text-sm text-slate-600">Monitor and manage system alerts</p>
        </div>
        
        {/* Connection Status & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || !isOnline}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search and Filter - Mobile Optimized */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search alerts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 h-10 text-sm"
          />
        </div>
        
        {/* Mobile Filter Button */}
        <div className="flex gap-2 sm:hidden">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            disabled={alertStats.active === 0}
            className="flex-1"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All
          </Button>
        </div>
        
        {/* Desktop Buttons */}
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            disabled={alertStats.active === 0}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All Active as Done
          </Button>
        </div>
      </div>

      {/* Stats Cards - Mobile Grid 2x2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{alertStats.active}</p>
                <p className="text-xs text-slate-600">Active</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{alertStats.acknowledged}</p>
                <p className="text-xs text-slate-600">Review</p>
              </div>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{alertStats.resolved}</p>
                <p className="text-xs text-slate-600">Resolved</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{alertStats.highPriority}</p>
                <p className="text-xs text-slate-600">High</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">
            Recent Alerts
            {searchTerm && (
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({filteredAlerts.length} results)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No alerts found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-3 sm:p-4 border rounded-lg hover:bg-slate-50 transition-colors ${
                    alert.status === 'active' ? 'border-red-200 bg-red-50' :
                    alert.status === 'acknowledged' ? 'border-yellow-200 bg-yellow-50' :
                    'border-green-200 bg-green-50'
                  }`}
                >
                  {/* Mobile Layout */}
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm sm:text-base text-slate-800 truncate">
                            {alert.vehicleName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {formatAlertType(alert.type)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`text-xs ${STATUS_STYLES[alert.status]}`}>
                          {alert.status}
                        </Badge>
                        <Badge className={`text-xs ${SEVERITY_STYLES[alert.severity]}`}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Message */}
                    <p className="text-xs sm:text-sm text-slate-700 line-clamp-2">
                      {alert.message}
                    </p>
                    
                    {/* Details & Actions */}
                    <div className="flex flex-col sm:flex-row justify-between gap-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {alert.timestamp.toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {alert.locationString && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{alert.locationString}</span>
                          </div>
                        )}
                        {alert.geofenceName && (
                          <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-blue-500" />
                            <span className="truncate max-w-[150px]">{alert.geofenceName}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 w-full sm:w-auto">
                        {alert.status === 'active' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAcknowledge(alert.id)}
                            className="flex-1 sm:flex-none text-xs h-8"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Review
                          </Button>
                        )}
                        {alert.status === 'acknowledged' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleResolve(alert.id)}
                            className="flex-1 sm:flex-none text-xs h-8 border-green-400 text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {alert.status === 'resolved' && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            <span>Resolved</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}