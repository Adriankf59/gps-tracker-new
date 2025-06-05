import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bell,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Clock,
  MapPin,
  Eye,
  Car,
  Navigation
} from "lucide-react";

// Tipe data untuk pelanggaran geofence
interface GeofenceViolation {
  id: string;
  vehicleId: string;
  vehicleName: string;
  licensePlate: string;
  geofenceName: string;
  violationType: 'ENTRY' | 'EXIT' | 'STAY_OUT'; // Entry ke forbidden, Exit dari required, atau Stay out dari stay_in
  ruleType: 'STANDARD' | 'FORBIDDEN' | 'STAY_IN';
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  isRead: boolean;
  isResolved: boolean;
}

// Komponen notifikasi pop-up
const ViolationNotification = ({ 
  violation, 
  onDismiss, 
  onView 
}: { 
  violation: GeofenceViolation;
  onDismiss: () => void;
  onView: () => void;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 8000); // Auto dismiss after 8 seconds

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'border-red-500 bg-red-50';
      case 'MEDIUM': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'ENTRY': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'EXIT': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Shield className="w-5 h-5 text-blue-500" />;
    }
  };

  const getViolationMessage = (violation: GeofenceViolation) => {
    switch (violation.violationType) {
      case 'ENTRY':
        return `masuk ke zona terlarang "${violation.geofenceName}"`;
      case 'EXIT':
        return `keluar dari zona wajib "${violation.geofenceName}"`;
      case 'STAY_OUT':
        return `berada di luar zona "${violation.geofenceName}"`;
      default:
        return `melanggar aturan geofence "${violation.geofenceName}"`;
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <Card className={`w-96 shadow-lg border-2 ${getSeverityColor(violation.severity)}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getViolationIcon(violation.violationType)}
              <CardTitle className="text-lg font-bold text-slate-800">
                Pelanggaran Geofence!
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700">
                Kendaraan <span className="font-bold">{violation.vehicleName}</span> ({violation.licensePlate})
              </p>
              <p className="text-sm text-slate-600">
                {getViolationMessage(violation)}
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {violation.timestamp.toLocaleTimeString('id-ID')}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {violation.location.lat.toFixed(4)}, {violation.location.lng.toFixed(4)}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                onClick={onView}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="w-4 h-4 mr-1" />
                Lihat Detail
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setIsVisible(false);
                  setTimeout(onDismiss, 300);
                }}
                className="flex-1"
              >
                Tutup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Komponen panel riwayat pelanggaran
const ViolationHistoryPanel = ({ 
  violations, 
  onMarkAsRead, 
  onResolve,
  isOpen,
  onToggle 
}: {
  violations: GeofenceViolation[];
  onMarkAsRead: (id: string) => void;
  onResolve: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const unreadCount = violations.filter(v => !v.isRead).length;
  const unresolvedCount = violations.filter(v => !v.isResolved).length;

  const sortedViolations = useMemo(() => {
    return [...violations].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [violations]);

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={onToggle}
        className="fixed top-4 left-4 z-40 bg-red-600 hover:bg-red-700 shadow-lg"
        size="sm"
      >
        <Bell className="w-4 h-4 mr-2" />
        Pelanggaran
        {unreadCount > 0 && (
          <Badge className="ml-2 bg-white text-red-600 px-1 py-0 text-xs min-w-[20px] h-5">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Side Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Riwayat Pelanggaran</h3>
              <p className="text-sm text-slate-600">
                {unresolvedCount} belum diselesaikan, {unreadCount} belum dibaca
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ height: 'calc(100vh - 100px)' }}>
          {sortedViolations.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada pelanggaran</p>
            </div>
          ) : (
            sortedViolations.map((violation) => (
              <Card
                key={violation.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  !violation.isRead ? 'border-red-300 bg-red-50' : 'border-slate-200'
                } ${violation.isResolved ? 'opacity-60' : ''}`}
                onClick={() => !violation.isRead && onMarkAsRead(violation.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {violation.violationType === 'ENTRY' && <ShieldAlert className="w-4 h-4 text-red-500" />}
                      {violation.violationType === 'EXIT' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      {violation.violationType === 'STAY_OUT' && <Shield className="w-4 h-4 text-blue-500" />}
                      <span className="font-medium text-sm text-slate-800">
                        {violation.vehicleName}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {!violation.isRead && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          Baru
                        </Badge>
                      )}
                      {violation.isResolved && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          Selesai
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-600 mb-2">
                    {violation.violationType === 'ENTRY' && `Masuk ke zona terlarang: ${violation.geofenceName}`}
                    {violation.violationType === 'EXIT' && `Keluar dari zona wajib: ${violation.geofenceName}`}
                    {violation.violationType === 'STAY_OUT' && `Di luar zona: ${violation.geofenceName}`}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{violation.timestamp.toLocaleString('id-ID')}</span>
                    <span>{violation.licensePlate}</span>
                  </div>
                  
                  {!violation.isResolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolve(violation.id);
                      }}
                      className="w-full mt-2 text-xs"
                    >
                      Tandai Selesai
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={onToggle}
        />
      )}
    </>
  );
};

// Komponen utama dengan demo data
export default function GeofenceNotificationSystem() {
  const [violations, setViolations] = useState<GeofenceViolation[]>([]);
  const [activeNotification, setActiveNotification] = useState<GeofenceViolation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Demo data - dalam implementasi nyata, ini akan datang dari sistem deteksi geofence
  const generateDemoViolation = useCallback(() => {
    const demoViolations: Partial<GeofenceViolation>[] = [
      {
        vehicleName: "Truk Pengiriman A",
        licensePlate: "B 1234 XY",
        geofenceName: "Zona Pengiriman Jakarta Pusat",
        violationType: 'EXIT',
        ruleType: 'STAY_IN',
        severity: 'HIGH'
      },
      {
        vehicleName: "Motor Kurir 02",
        licensePlate: "B 5678 ZZ",
        geofenceName: "Area Terlarang Mall",
        violationType: 'ENTRY',
        ruleType: 'FORBIDDEN',
        severity: 'MEDIUM'
      },
      {
        vehicleName: "Mobil Operasional",
        licensePlate: "B 9999 AB",
        geofenceName: "Zona Kantor Pusat",
        violationType: 'STAY_OUT',
        ruleType: 'STANDARD',
        severity: 'LOW'
      }
    ];

    const randomViolation = demoViolations[Math.floor(Math.random() * demoViolations.length)];
    
    const newViolation: GeofenceViolation = {
      id: `violation_${Date.now()}`,
      vehicleId: `vehicle_${Math.floor(Math.random() * 100)}`,
      vehicleName: randomViolation.vehicleName!,
      licensePlate: randomViolation.licensePlate!,
      geofenceName: randomViolation.geofenceName!,
      violationType: randomViolation.violationType!,
      ruleType: randomViolation.ruleType!,
      timestamp: new Date(),
      location: {
        lat: -6.2088 + (Math.random() - 0.5) * 0.1,
        lng: 106.8456 + (Math.random() - 0.5) * 0.1,
      },
      severity: randomViolation.severity!,
      isRead: false,
      isResolved: false
    };

    return newViolation;
  }, []);

  // Simulasi deteksi pelanggaran real-time
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulasi pelanggaran dengan probabilitas rendah
      if (Math.random() < 0.3) { // 30% chance setiap 15 detik
        const newViolation = generateDemoViolation();
        setViolations(prev => [newViolation, ...prev]);
        setActiveNotification(newViolation);
        
        // Sound notification (opsional)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pelanggaran Geofence Terdeteksi!', {
            body: `${newViolation.vehicleName} melanggar aturan ${newViolation.geofenceName}`,
            icon: '/favicon.ico'
          });
        }
      }
    }, 15000); // Cek setiap 15 detik

    return () => clearInterval(interval);
  }, [generateDemoViolation]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleMarkAsRead = useCallback((violationId: string) => {
    setViolations(prev =>
      prev.map(v => v.id === violationId ? { ...v, isRead: true } : v)
    );
  }, []);

  const handleResolve = useCallback((violationId: string) => {
    setViolations(prev =>
      prev.map(v => v.id === violationId ? { ...v, isResolved: true, isRead: true } : v)
    );
  }, []);

  const handleViewViolation = useCallback((violation: GeofenceViolation) => {
    setSelectedVehicle(violation.vehicleId);
    handleMarkAsRead(violation.id);
    setActiveNotification(null);
    setShowHistory(true);
  }, [handleMarkAsRead]);

  // Demo vehicles untuk simulasi
  const demoVehicles = [
    { id: 'vehicle_1', name: 'Truk Pengiriman A', licensePlate: 'B 1234 XY', status: 'moving' },
    { id: 'vehicle_2', name: 'Motor Kurir 02', licensePlate: 'B 5678 ZZ', status: 'parked' },
    { id: 'vehicle_3', name: 'Mobil Operasional', licensePlate: 'B 9999 AB', status: 'moving' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Demo Sistem Notifikasi Geofence
        </h1>
        <p className="text-slate-600">
          Sistem akan secara otomatis mendeteksi dan memberikan notifikasi ketika kendaraan melanggar aturan geofence.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {violations.filter(v => !v.isResolved).length}
                </p>
                <p className="text-xs text-slate-500 uppercase">Pelanggaran Aktif</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {violations.filter(v => !v.isRead).length}
                </p>
                <p className="text-xs text-slate-500 uppercase">Belum Dibaca</p>
              </div>
              <Bell className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{demoVehicles.length}</p>
                <p className="text-xs text-slate-500 uppercase">Kendaraan Dipantau</p>
              </div>
              <Car className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {violations.filter(v => v.isResolved).length}
                </p>
                <p className="text-xs text-slate-500 uppercase">Diselesaikan</p>
              </div>
              <ShieldCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo Vehicle List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            Kendaraan yang Dipantau
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoVehicles.map(vehicle => (
              <div
                key={vehicle.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  selectedVehicle === vehicle.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 bg-white'
                }`}
                onClick={() => setSelectedVehicle(vehicle.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-800">{vehicle.name}</h4>
                  <Badge 
                    className={
                      vehicle.status === 'moving' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {vehicle.status === 'moving' ? 'Bergerak' : 'Parkir'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{vehicle.licensePlate}</p>
                <div className="mt-3 text-xs text-slate-500">
                  Violations: {violations.filter(v => v.vehicleId === vehicle.id).length}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Demo Controls */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={() => {
                const newViolation = generateDemoViolation();
                setViolations(prev => [newViolation, ...prev]);
                setActiveNotification(newViolation);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Simulasi Pelanggaran
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Bell className="w-4 h-4 mr-2" />
              {showHistory ? 'Tutup' : 'Buka'} Riwayat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Pop-up */}
      {activeNotification && (
        <ViolationNotification
          violation={activeNotification}
          onDismiss={() => setActiveNotification(null)}
          onView={() => handleViewViolation(activeNotification)}
        />
      )}

      {/* History Panel */}
      <ViolationHistoryPanel
        violations={violations}
        onMarkAsRead={handleMarkAsRead}
        onResolve={handleResolve}
        isOpen={showHistory}
        onToggle={() => setShowHistory(!showHistory)}
      />
    </div>
  );
}