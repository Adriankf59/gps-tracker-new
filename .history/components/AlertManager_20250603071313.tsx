// components/AlertManager.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getAlerts } from "@/lib/alertService";
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
  PowerOff
} from "lucide-react";

import { GeofenceEvent as DetectorGeofenceEvent } from '@/lib/geofenceDetector';

// Optimized interfaces
export interface ManagedAlert {
  id: string;
  type: string;
  vehicleName: string;
  message: string;
  locationString?: string;
  timestamp: Date;
  status: "active" | "acknowledged" | "resolved";
  severity: "high" | "medium" | "low";
  originalEvent?: DetectorGeofenceEvent | any;
  geofenceName?: string | null;
}

interface AlertManagerProps {
  newDetectedEvents?: DetectorGeofenceEvent[];
  onAcknowledgeAlert?: (alertId: string) => void;
  onResolveAlert?: (alertId: string) => void;
  initialAlerts?: ManagedAlert[];
}

// Constants for better maintainability
const POLLING_INTERVAL = 30000;
const ALERT_ICONS = {
  speed_limit: <AlertTriangle className="w-5 h-5 text-red-600" />,
  low_fuel: <Fuel className="w-5 h-5 text-orange-500" />,
  low_battery: <Zap className="w-5 h-5 text-yellow-600" />,
  engine_off: <PowerOff className="w-5 h-5 text-purple-600" />,
  geofence: <Shield className="w-5 h-5 text-blue-600" />,
  default: <AlertTriangle className="w-5 h-5 text-gray-500" />
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

// Utility functions
const transformApiAlert = (alert: any): ManagedAlert => ({
  id: alert.alert_id.toString(),
  type: alert.alert_type || 'unknown',
  vehicleName: `Vehicle ${alert.vehicle_id}`,
  message: alert.alert_message,
  locationString: alert.lokasi,
  timestamp: new Date(alert.timestamp),
  status: 'active',
  severity: 'high',
  geofenceName: null
});

const transformDetectorEvent = (event: DetectorGeofenceEvent): ManagedAlert => {
  const isViolation = event.event_type.startsWith('violation_');
  const isEnter = event.event_type === 'enter';
  
  const severity: ManagedAlert['severity'] = isViolation ? "high" : "low";
  
  let message: string;
  if (isViolation) {
    const action = event.event_type.includes('enter') ? 'memasuki' : 'meninggalkan';
    message = `PELANGGARAN: Kendaraan '${event.vehicle_name}' ${action} geofence '${event.geofence_name}' (Aturan: ${event.rule_triggered}).`;
  } else {
    const action = isEnter ? 'memasuki' : 'meninggalkan';
    message = `INFO: Kendaraan '${event.vehicle_name}' ${action} geofence '${event.geofence_name}'.`;
  }

  return {
    id: event.event_id,
    type: event.event_type,
    vehicleName: event.vehicle_name,
    message,
    locationString: `Lat: ${event.position[1].toFixed(4)}, Lon: ${event.position[0].toFixed(4)}`,
    timestamp: event.timestamp,
    status: "active",
    severity,
    geofenceName: event.geofence_name,
    originalEvent: event,
  };
};

const getAlertIcon = (type: string) => {
  if (type.includes('geofence') || type.includes('violation')) return ALERT_ICONS.geofence;
  return ALERT_ICONS[type as keyof typeof ALERT_ICONS] || ALERT_ICONS.default;
};

const formatAlertTypeForDisplay = (type: string): string => {
  return type
    .replace(/violation_/g, '')
    .replace(/geofence_/g, '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function AlertManager({ 
  newDetectedEvents = [],
  onAcknowledgeAlert,
  onResolveAlert,
  initialAlerts = []
}: AlertManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [alerts, setAlerts] = useState<ManagedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Memoized filtered alerts
  const filteredAlerts = useMemo(() => {
    if (!searchTerm) return alerts;
    
    const searchLower = searchTerm.toLowerCase();
    return alerts.filter(alert =>
      alert.vehicleName.toLowerCase().includes(searchLower) ||
      alert.message.toLowerCase().includes(searchLower) ||
      alert.locationString?.toLowerCase().includes(searchLower) ||
      alert.geofenceName?.toLowerCase().includes(searchLower) ||
      alert.type.toLowerCase().includes(searchLower)
    );
  }, [alerts, searchTerm]);

  // Memoized statistics
  const alertStats = useMemo(() => {
    const stats = {
      active: 0,
      acknowledged: 0,
      resolved: 0,
      highPriority: 0
    };

    alerts.forEach(alert => {
      if (alert.status === 'active') stats.active++;
      if (alert.status === 'acknowledged') stats.acknowledged++;
      if (alert.status === 'resolved') stats.resolved++;
      if (alert.severity === 'high') stats.highPriority++;
    });

    return stats;
  }, [alerts]);

  // Optimized fetch function
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await getAlerts();
      if (response.data) {
        const apiAlerts = response.data.map(transformApiAlert);
        const combinedAlerts = [...apiAlerts, ...initialAlerts]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setAlerts(combinedAlerts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [initialAlerts]);

  // Initial fetch and polling
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Handle new detected events with deduplication
  useEffect(() => {
    if (newDetectedEvents.length === 0) return;

    const transformedAlerts = newDetectedEvents.map(transformDetectorEvent);
    
    setAlerts(prevAlerts => {
      const existingIds = new Set(prevAlerts.map(a => a.id));
      const newAlerts = transformedAlerts.filter(alert => !existingIds.has(alert.id));
      
      if (newAlerts.length === 0) return prevAlerts;
      
      return [...newAlerts, ...prevAlerts]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
  }, [newDetectedEvents]);

  // Optimized handlers
  const handleAcknowledge = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const } : a));
    onAcknowledgeAlert?.(id);
  }, [onAcknowledgeAlert]);

  const handleResolve = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a));
    onResolveAlert?.(id);
  }, [onResolveAlert]);

  const handleAcknowledgeAll = useCallback(() => {
    setAlerts(prev => prev.map(a => a.status === 'active' ? { ...a, status: 'acknowledged' as const } : a));
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-orange-500"/>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manajemen Peringatan</h1>
            <p className="text-sm text-slate-600">Pantau dan kelola peringatan sistem dan notifikasi kendaraan.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none text-sm"
            onClick={handleAcknowledgeAll}
            disabled={alertStats.active === 0}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Tandai Semua Aktif Selesai
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Cari peringatan (kendaraan, pesan, lokasi, geofence, tipe)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 text-sm rounded-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Peringatan Aktif", count: alertStats.active, Icon: AlertTriangle, color: "text-red-600" },
          { title: "Perlu Ditinjau", count: alertStats.acknowledged, Icon: Clock, color: "text-yellow-700" },
          { title: "Sudah Diselesaikan", count: alertStats.resolved, Icon: CheckCircle, color: "text-green-600" },
          { title: "Prioritas Tinggi", count: alertStats.highPriority, Icon: AlertTriangle, color: "text-red-600" },
        ].map(stat => (
          <Card key={stat.title} className="shadow hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.count}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.title}</p>
                </div>
                <stat.Icon className={`w-7 h-7 ${stat.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts List */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-700">
            Daftar Peringatan Terbaru
            {searchTerm && (
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({filteredAlerts.length} dari {alerts.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">
                {searchTerm ? "Tidak ada peringatan ditemukan" : "Tidak ada peringatan saat ini"}
              </h3>
              <p className="text-slate-500">
                {searchTerm ? "Coba sesuaikan kriteria pencarian Anda." : "Semua sistem berjalan normal."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Separated AlertItem component for better performance
const AlertItem = React.memo(({ 
  alert, 
  onAcknowledge, 
  onResolve 
}: { 
  alert: ManagedAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) => {
  const getBorderClass = () => {
    switch (alert.status) {
      case 'active': return 'border-red-200 bg-red-50/70';
      case 'acknowledged': return 'border-yellow-200 bg-yellow-50/70';
      default: return 'border-slate-200 bg-white';
    }
  };

  const getIconBgClass = () => {
    switch (alert.status) {
      case 'active': return 'bg-red-100';
      case 'acknowledged': return 'bg-yellow-100';
      default: return 'bg-slate-100';
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-start gap-3 p-3.5 border rounded-lg hover:shadow-sm transition-all duration-150 ease-in-out ${getBorderClass()}`}>
      <div className={`p-2 rounded-full mt-1 shrink-0 ${getIconBgClass()}`}>
        {getAlertIcon(alert.type)}
      </div>
      
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2 mb-0.5 sm:mb-0">
            <h4 className="font-semibold text-slate-800 text-base truncate" title={alert.vehicleName}>
              {alert.vehicleName}
            </h4>
            <Badge variant="outline" className="text-xs border-slate-300 text-slate-600 px-1.5 py-0.5 whitespace-nowrap">
              {formatAlertTypeForDisplay(alert.type)}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge className={`${SEVERITY_STYLES[alert.severity]} text-xs px-1.5 py-0.5 font-medium`}>
              {alert.severity}
            </Badge>
            <Badge className={`${STATUS_STYLES[alert.status]} text-xs px-1.5 py-0.5 font-medium`}>
              {alert.status}
            </Badge>
          </div>
        </div>
        
        <p className="text-slate-700 text-sm leading-normal">{alert.message}</p>
        
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
          {alert.locationString && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{alert.locationString}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{alert.timestamp.toLocaleString('id-ID', { 
              day: '2-digit', 
              month:'short', 
              year:'numeric', 
              hour: '2-digit', 
              minute:'2-digit'
            })}</span>
          </div>
          {alert.geofenceName && (
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-500" />
              <span>{alert.geofenceName}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex sm:flex-col gap-1.5 mt-2 sm:mt-0 sm:ml-3 w-full sm:w-auto shrink-0">
        {alert.status === 'active' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onAcknowledge(alert.id)}
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800 w-full sm:w-auto text-xs px-2.5 py-1 justify-center"
          >
            <Clock className="w-3 h-3 mr-1" /> Tinjau
          </Button>
        )}
        {alert.status === 'acknowledged' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onResolve(alert.id)}
            className="border-green-400 text-green-600 hover:bg-green-100 hover:text-green-700 w-full sm:w-auto text-xs px-2.5 py-1 justify-center"
          >
            <CheckCircle className="w-3 h-3 mr-1" /> Selesaikan
          </Button>
        )}
        {alert.status === 'resolved' && (
          <Button 
            size="sm" 
            variant="ghost" 
            disabled
            className="text-green-700 w-full sm:w-auto text-xs px-2.5 py-1 justify-center"
          >
            <CheckCircle className="w-3 h-3 mr-1 text-green-500" /> Diselesaikan
          </Button>
        )}
      </div>
    </div>
  );
});