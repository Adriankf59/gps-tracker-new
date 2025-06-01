// components/AlertManager.tsx
import React, { useState, useEffect } from "react";
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
  Zap, // Untuk baterai
  Fuel, // Untuk bahan bakar
  Shield, // Untuk geofence
  PowerOff // Contoh untuk engine_off
} from "lucide-react";

// Impor GeofenceEvent dari detector Anda
import { GeofenceEvent as DetectorGeofenceEvent } from '@/lib/geofenceDetector'; // Sesuaikan path

// Struktur data untuk alert yang dikelola oleh AlertManager
export interface ManagedAlert {
  id: string; // ID unik untuk alert, bisa dari event_id detector atau dibuat
  type: string; // misal: "speed_limit", "geofence_violation_enter"
  vehicleName: string; // Nama kendaraan
  message: string; // Deskripsi alert
  locationString?: string; // Deskripsi lokasi atau koordinat
  timestamp: Date; // Objek Date untuk sorting dan formatting
  status: "active" | "acknowledged" | "resolved";
  severity: "high" | "medium" | "low";
  originalEvent?: DetectorGeofenceEvent | any; // Simpan event asli jika perlu
  geofenceName?: string | null;
}

interface AlertManagerProps {
  // Anda akan mengirimkan event yang sudah terdeteksi ke komponen ini
  newDetectedEvents?: DetectorGeofenceEvent[]; 
  // Callback jika ada aksi pada alert (opsional)
  onAcknowledgeAlert?: (alertId: string) => void;
  onResolveAlert?: (alertId: string) => void;
  // Untuk memuat alert awal jika ada dari sumber lain (misalnya dari API saat load)
  initialAlerts?: ManagedAlert[]; 
}

let internalAlertIdCounter = 0; // Untuk ID unik jika event.event_id tidak cukup

export function AlertManager({ 
  newDetectedEvents = [],
  onAcknowledgeAlert,
  onResolveAlert,
  initialAlerts = []
}: AlertManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [alerts, setAlerts] = useState<ManagedAlert[]>([]);

  // Fetch alerts from API
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await getAlerts();
        if (response.data) {
          const apiAlerts = response.data.map((alert: any) => ({
            id: alert.alert_id.toString(),
            type: alert.alert_type || 'unknown',
            vehicleName: `Vehicle ${alert.vehicle_id}`,
            message: alert.alert_message,
            locationString: alert.lokasi,
            timestamp: new Date(alert.timestamp),
            status: 'active',
            severity: 'high',
            geofenceName: null
          }));
          setAlerts([...apiAlerts, ...initialAlerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    fetchAlerts();
    // Set up polling every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [initialAlerts]);

  // Efek untuk memproses event baru dari detector
  useEffect(() => {
    if (newDetectedEvents.length > 0) {
      const transformedAlerts = newDetectedEvents.map((event): ManagedAlert => {
        let severity: ManagedAlert['severity'] = "medium";
        let alertTypeForDisplay = event.event_type;
        let message = `Kendaraan '${event.vehicle_name}' ${event.event_type.replace('_', ' ')} geofence '${event.geofence_name}'.`;

        if (event.event_type.startsWith('violation_')) {
          severity = "high";
          // type bisa tetap 'violation_enter' atau diubah untuk display
          message = `PELANGGARAN: Kendaraan '${event.vehicle_name}' ${event.event_type.includes('enter') ? 'memasuki' : 'meninggalkan'} geofence '${event.geofence_name}' (Aturan: ${event.rule_triggered}).`;
        } else if (event.event_type === 'enter') {
          severity = "low";
          message = `INFO: Kendaraan '${event.vehicle_name}' memasuki geofence '${event.geofence_name}'.`;
        } else if (event.event_type === 'exit') {
          severity = "low";
          message = `INFO: Kendaraan '${event.vehicle_name}' meninggalkan geofence '${event.geofence_name}'.`;
        }
        
        return {
          id: event.event_id, // Gunakan event_id dari detector
          type: alertTypeForDisplay, // atau event.event_type jika ingin lebih spesifik
          vehicleName: event.vehicle_name,
          message: message,
          locationString: `Lat: ${event.position[1].toFixed(4)}, Lon: ${event.position[0].toFixed(4)}`,
          timestamp: event.timestamp, // Sudah objek Date
          status: "active", // Event baru selalu aktif
          severity: severity,
          geofenceName: event.geofence_name,
          originalEvent: event,
        };
      });

      // Tambahkan alert baru ke daftar, hindari duplikat berdasarkan ID
      setAlerts(prevAlerts => {
        const existingIds = new Set(prevAlerts.map(a => a.id));
        const trulyNewAlerts = transformedAlerts.filter(ta => !existingIds.has(ta.id));
        if (trulyNewAlerts.length === 0) return prevAlerts; // Tidak ada alert baru yang unik
        return [...trulyNewAlerts, ...prevAlerts].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
      });
    }
  }, [newDetectedEvents]); // Jalankan ketika prop newDetectedEvents berubah

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    onAcknowledgeAlert?.(id);
  };

  const handleResolve = (id: string) => {
     setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
     onResolveAlert?.(id);
  };

  const filteredAlerts = alerts.filter(alert =>
    alert.vehicleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (alert.locationString && alert.locationString.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (alert.geofenceName && alert.geofenceName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    alert.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColorClass = (status: ManagedAlert['status']) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-700 border-red-300';
      case 'acknowledged': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSeverityColorClass = (severity: ManagedAlert['severity']) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

 const getAlertIcon = (type: string) => {
    // Prioritaskan geofence jika ada dalam tipe
    if (type.includes('geofence') || type.includes('violation')) return <Shield className="w-5 h-5 text-blue-600" />;
    switch (type) {
      case 'speed_limit': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'low_fuel': return <Fuel className="w-5 h-5 text-orange-500" />;
      case 'low_battery': return <Zap className="w-5 h-5 text-yellow-600" />;
      case 'engine_off': return <PowerOff className="w-5 h-5 text-purple-600" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatAlertTypeForDisplay = (type: string) => {
    let formatted = type.replace(/violation_/g, '').replace(/geofence_/g, ''); // Hapus prefix
    return formatted.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">
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
            onClick={() => setAlerts(prev => prev.map(a => a.status === 'active' ? {...a, status: 'acknowledged'} : a))}
            disabled={!alerts.some(a => a.status === 'active')}
            >
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Tandai Semua Aktif Selesai
          </Button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Peringatan Aktif", filterFn: (a: ManagedAlert) => a.status === 'active', Icon: AlertTriangle, color: "text-red-600" },
          { title: "Perlu Ditinjau", filterFn: (a: ManagedAlert) => a.status === 'acknowledged', Icon: Clock, color: "text-yellow-700" },
          { title: "Sudah Diselesaikan", filterFn: (a: ManagedAlert) => a.status === 'resolved', Icon: CheckCircle, color: "text-green-600" },
          { title: "Prioritas Tinggi", filterFn: (a: ManagedAlert) => a.severity === 'high', Icon: AlertTriangle, color: "text-red-600" },
        ].map(stat => (
          <Card key={stat.title} className="shadow hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${stat.color}`}>
                    {alerts.filter(stat.filterFn).length}
                  </p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.title}</p>
                </div>
                <stat.Icon className={`w-7 h-7 ${stat.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-700">Daftar Peringatan Terbaru</CardTitle>
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
                <div 
                    key={alert.id} 
                    className={`flex flex-col sm:flex-row items-start gap-3 p-3.5 border rounded-lg hover:shadow-sm transition-all duration-150 ease-in-out 
                                ${alert.status === 'active' ? 'border-red-200 bg-red-50/70' : 
                                 alert.status === 'acknowledged' ? 'border-yellow-200 bg-yellow-50/70' : 
                                 'border-slate-200 bg-white'}`}
                >
                  <div className={`p-2 rounded-full mt-1 shrink-0 ${
                        alert.status === 'active' ? 'bg-red-100' : 
                        alert.status === 'acknowledged' ? 'bg-yellow-100' : 'bg-slate-100'
                    }`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 space-y-1 min-w-0"> {/* min-w-0 untuk flexbox truncate */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-baseline gap-2 mb-0.5 sm:mb-0">
                        <h4 className="font-semibold text-slate-800 text-base truncate" title={alert.vehicleName}>{alert.vehicleName}</h4>
                        <Badge variant="outline" className="text-xs border-slate-300 text-slate-600 px-1.5 py-0.5 whitespace-nowrap">
                          {formatAlertTypeForDisplay(alert.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge className={`${getSeverityColorClass(alert.severity)} text-xs px-1.5 py-0.5 font-medium`}>
                          {alert.severity}
                        </Badge>
                        <Badge className={`${getStatusColorClass(alert.status)} text-xs px-1.5 py-0.5 font-medium`}>
                          {alert.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-slate-700 text-sm leading-normal">{alert.message}</p>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                      {alert.locationString && (
                        <div className="flex items-center gap-1"> <MapPin className="w-3 h-3" /> <span>{alert.locationString}</span> </div>
                      )}
                      <div className="flex items-center gap-1"> <Clock className="w-3 h-3" /> <span>{alert.timestamp.toLocaleString('id-ID', { day: '2-digit', month:'short', year:'numeric', hour: '2-digit', minute:'2-digit'})}</span> </div>
                      {alert.geofenceName && (
                        <div className="flex items-center gap-1"> <Shield className="w-3 h-3 text-blue-500" /> <span>{alert.geofenceName}</span> </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col gap-1.5 mt-2 sm:mt-0 sm:ml-3 w-full sm:w-auto shrink-0">
                    {alert.status === 'active' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleAcknowledge(alert.id)}
                        className="border-yellow-400 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800 w-full sm:w-auto text-xs px-2.5 py-1 justify-center"
                      >
                        <Clock className="w-3 h-3 mr-1" /> Tinjau
                      </Button>
                    )}
                    {alert.status === 'acknowledged' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleResolve(alert.id)}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}