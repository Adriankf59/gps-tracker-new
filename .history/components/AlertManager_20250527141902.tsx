// components/AlertManager.tsx
import { useState } from "react";
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
  Shield
} from "lucide-react";

export function AlertManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const alerts = [
    {
      id: 1,
      type: "speed_limit",
      vehicle: "Van-003",
      message: "Speed limit exceeded: 85 km/h in 60 km/h zone",
      location: "Jl. Gatot Subroto, Jakarta",
      timestamp: "2024-01-25 14:30:25",
      status: "active",
      severity: "high",
      geofence: null
    },
    {
      id: 2,
      type: "geofence_exit",
      vehicle: "Truck-001",
      message: "Vehicle exited authorized area: Warehouse A",
      location: "Near Jl. Sudirman, Jakarta",
      timestamp: "2024-01-25 13:45:12",
      status: "acknowledged",
      severity: "medium",
      geofence: "Warehouse A"
    },
    {
      id: 3,
      type: "low_fuel",
      vehicle: "Truck-002",
      message: "Low fuel warning: 15% remaining",
      location: "Jl. Casablanca, Jakarta",
      timestamp: "2024-01-25 12:15:08",
      status: "active",
      severity: "medium",
      geofence: null
    },
    {
      id: 4,
      type: "geofence_enter",
      vehicle: "Car-002",
      message: "Vehicle entered restricted zone: Downtown Area",
      location: "Jl. Thamrin, Jakarta",
      timestamp: "2024-01-25 11:22:45",
      status: "resolved",
      severity: "high",
      geofence: "Downtown Restricted"
    },
    {
      id: 5,
      type: "engine_off",
      vehicle: "Van-003",
      message: "Unauthorized engine shutdown detected",
      location: "Jl. Kemang, Jakarta",
      timestamp: "2024-01-25 10:30:15",
      status: "active",
      severity: "high",
      geofence: null
    },
    {
      id: 6,
      type: "low_battery",
      vehicle: "Truck-001",
      message: "GPS device low battery: 15% remaining",
      location: "Jl. Sudirman, Jakarta",
      timestamp: "2024-01-25 09:45:30",
      status: "acknowledged",
      severity: "low",
      geofence: null
    }
  ];

  const filteredAlerts = alerts.filter(alert =>
    alert.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'speed_limit':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'geofence_exit':
      case 'geofence_enter':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'low_fuel':
        return <Fuel className="w-4 h-4 text-orange-500" />;
      case 'low_battery':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'engine_off':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatAlertType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alert Management</h1>
          <p className="text-slate-600">Monitor and manage system alerts and notifications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline">
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search alerts by vehicle, message, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.status === 'active').length}
                </p>
                <p className="text-sm text-slate-600">Active Alerts</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {alerts.filter(a => a.status === 'acknowledged').length}
                </p>
                <p className="text-sm text-slate-600">Acknowledged</p>
              </div>
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {alerts.filter(a => a.status === 'resolved').length}
                </p>
                <p className="text-sm text-slate-600">Resolved</p>
              </div>
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.severity === 'high').length}
                </p>
                <p className="text-sm text-slate-600">High Priority</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                <div className="p-2 rounded-lg bg-slate-100">
                  {getAlertIcon(alert.type)}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-800">{alert.vehicle}</h4>
                      <Badge variant="outline" className="text-xs">
                        {formatAlertType(alert.type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <Badge className={getStatusColor(alert.status)}>
                        {alert.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-slate-700">{alert.message}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{alert.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{alert.timestamp}</span>
                    </div>
                    {alert.geofence && (
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>{alert.geofence}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  {alert.status === 'active' && (
                    <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Acknowledge
                    </Button>
                  )}
                  {alert.status === 'acknowledged' && (
                    <Button size="sm" variant="outline" className="text-blue-600 hover:text-blue-700">
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredAlerts.length === 0 && (
            <div className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No alerts found</h3>
              <p className="text-slate-500">Try adjusting your search criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}