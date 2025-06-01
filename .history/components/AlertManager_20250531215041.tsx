"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Search,
  Filter,
  MapPin,
  Clock,
  Car,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Download,
  RefreshCw,
  Bell,
  BellOff,
  Calendar,
  ExternalLink
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { id } from "date-fns/locale";

// Import types and hooks from geofenceDetector
import { 
  GeofenceEvent, 
  DetectionResult, 
  useGeofenceDetection,
  Geofence,
  Vehicle 
} from '@/lib/geofenceDetector';

interface AlertItem extends GeofenceEvent {
  id: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'acknowledged';
  notes?: string;
}

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  username?: string;
  full_name?: string;
}

// API endpoints
const API_BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055';
const GEOFENCE_EVENTS_API = `${API_BASE_URL}/items/geofence_events`;
const VEHICLE_API_ENDPOINT = `${API_BASE_URL}/items/vehicle`;
const GEOFENCE_API_ENDPOINT = `${API_BASE_URL}/items/geofence`;

export function AlertManager() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [realTimeAlerts, setRealTimeAlerts] = useState<GeofenceEvent[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const { getApiStatus, retryFailedApiCalls } = useGeofenceDetection();

  // Check screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load user and initial data
  useEffect(() => {
    const loadUser = () => {
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          if (userId) {
            fetchVehicles(userId);
            fetchGeofences(userId);
            fetchAlerts();
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading user from session storage:', error);
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Auto refresh alerts
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Fetch vehicles
  const fetchVehicles = async (userId: string) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      const result = await response.json();
      setVehicles(result.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    }
  };

  // Fetch geofences
  const fetchGeofences = async (userId: string) => {
    try {
      const response = await fetch(`${GEOFENCE_API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch geofences');
      const result = await response.json();
      setGeofences(result.data || []);
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error('Failed to load geofences');
    }
  };

  // Fetch alerts from API
  const fetchAlerts = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Build query with date range if specified
      let query = `${GEOFENCE_EVENTS_API}?sort=-event_timestamp&limit=1000`;
      
      if (dateRange?.from && dateRange?.to) {
        const fromISO = startOfDay(dateRange.from).toISOString();
        const toISO = endOfDay(dateRange.to).toISOString();
        query += `&filter[event_timestamp][_gte]=${fromISO}&filter[event_timestamp][_lte]=${toISO}`;
      }

      const response = await fetch(query);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      
      const result = await response.json();
      const events = result.data || [];

      // Convert API events to AlertItems
      const alertItems: AlertItem[] = events.map((event: any) => {
        const vehicle = vehicles.find(v => v.vehicle_id === event.vehicle_id);
        const geofence = geofences.find(g => g.geofence_id === event.geofence_id);
        
        return {
          ...event,
          id: event.event_id || `${event.vehicle_id}-${event.geofence_id}-${event.event_timestamp}`,
          event_id: event.event_id || `${event.vehicle_id}-${event.geofence_id}-${event.event_timestamp}`,
          vehicle_id: event.vehicle_id,
          geofence_id: event.geofence_id,
          event_type: event.event as GeofenceEvent['event_type'],
          timestamp: new Date(event.event_timestamp),
          position: [0, 0] as [number, number], // API doesn't store position, use default
          geofence_name: geofence?.name || `Geofence ${event.geofence_id}`,
          vehicle_name: vehicle?.name || `Vehicle ${event.vehicle_id}`,
          rule_triggered: geofence?.rule_type || 'STANDARD',
          acknowledged: false, // This would come from a separate acknowledgment table in real app
          severity: getSeverityFromEvent(event.event, geofence?.rule_type),
          status: 'active' as const
        };
      });

      setAlerts(alertItems);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  // Determine severity based on event type and rule
  const getSeverityFromEvent = (eventType: string, ruleType?: string): AlertItem['severity'] => {
    if (eventType === 'violation_enter' || eventType === 'violation_exit') {
      return ruleType === 'FORBIDDEN' ? 'critical' : 'high';
    }
    if (eventType === 'enter' || eventType === 'exit') {
      return 'medium';
    }
    return 'low';
  };

  // Filter alerts based on search and filters
  useEffect(() => {
    let filtered = alerts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(alert =>
        alert.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.geofence_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.event_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(alert => alert.status === filterStatus);
    }

    // Severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === filterSeverity);
    }

    // Event type filter
    if (filterEventType !== 'all') {
      filtered = filtered.filter(alert => alert.event_type === filterEventType);
    }

    // Date range filter (if not already applied in API call)
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(alert =>
        isWithinInterval(alert.timestamp, {
          start: startOfDay(dateRange.from!),
          end: endOfDay(dateRange.to!)
        })
      );
    }

    setFilteredAlerts(filtered);
  }, [alerts, searchTerm, filterStatus, filterSeverity, filterEventType, dateRange]);

  // Get alert counts by severity
  const alertCounts = useMemo(() => {
    const counts = {
      total: filteredAlerts.length,
      critical: filteredAlerts.filter(a => a.severity === 'critical').length,
      high: filteredAlerts.filter(a => a.severity === 'high').length,
      medium: filteredAlerts.filter(a => a.severity === 'medium').length,
      low: filteredAlerts.filter(a => a.severity === 'low').length,
      unacknowledged: filteredAlerts.filter(a => !a.acknowledged).length
    };
    return counts;
  }, [filteredAlerts]);

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      // In a real app, this would update the acknowledgment in the database
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              acknowledged: true, 
              acknowledgedBy: currentUser?.name || 'Current User',
              acknowledgedAt: new Date(),
              status: 'acknowledged' as const
            }
          : alert
      ));
      toast.success('Alert acknowledged');
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error('Failed to acknowledge alert');
    }
  };

  // Handle bulk acknowledge
  const handleBulkAcknowledge = async () => {
    try {
      setAlerts(prev => prev.map(alert => 
        selectedAlerts.includes(alert.id)
          ? { 
              ...alert, 
              acknowledged: true, 
              acknowledgedBy: currentUser?.name || 'Current User',
              acknowledgedAt: new Date(),
              status: 'acknowledged' as const
            }
          : alert
      ));
      setSelectedAlerts([]);
      toast.success(`${selectedAlerts.length} alerts acknowledged`);
    } catch (error) {
      console.error('Error bulk acknowledging alerts:', error);
      toast.error('Failed to acknowledge alerts');
    }
  };

  // Handle export alerts
  const handleExportAlerts = () => {
    try {
      const csvData = filteredAlerts.map(alert => ({
        'Alert ID': alert.event_id,
        'Vehicle': alert.vehicle_name,
        'Geofence': alert.geofence_name,
        'Event Type': alert.event_type,
        'Severity': alert.severity,
        'Status': alert.status,
        'Timestamp': format(alert.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        'Acknowledged': alert.acknowledged ? 'Yes' : 'No',
        'Acknowledged By': alert.acknowledgedBy || '',
        'Rule Triggered': alert.rule_triggered
      }));

      const csv = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geofence-alerts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Alerts exported successfully');
    } catch (error) {
      console.error('Error exporting alerts:', error);
      toast.error('Failed to export alerts');
    }
  };

  // Get severity color
  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get event type color
  const getEventTypeColor = (eventType: GeofenceEvent['event_type']) => {
    switch (eventType) {
      case 'violation_enter':
      case 'violation_exit':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'enter':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'exit':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Format event type for display
  const formatEventType = (eventType: GeofenceEvent['event_type']) => {
    switch (eventType) {
      case 'enter':
        return 'Masuk Area';
      case 'exit':
        return 'Keluar Area';
      case 'violation_enter':
        return 'Pelanggaran: Masuk';
      case 'violation_exit':
        return 'Pelanggaran: Keluar';
      default:
        return eventType;
    }
  };

  // Handle alert selection
  const handleAlertSelection = (alertId: string) => {
    setSelectedAlerts(prev => 
      prev.includes(alertId) 
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };

  // Select all alerts
  const handleSelectAll = () => {
    if (selectedAlerts.length === filteredAlerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(filteredAlerts.map(alert => alert.id));
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <p className="text-xl text-gray-700 font-semibold">Loading alerts...</p>
          <p className="text-gray-500">Please wait while we fetch your data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-red-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Alert Manager</h1>
            <p className="text-sm text-gray-600">Monitor and manage geofence alerts</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            {autoRefresh ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            {autoRefresh ? 'Disable Auto' : 'Enable Auto'}
          </Button>
          <Button
            onClick={fetchAlerts}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{alertCounts.total}</div>
            <div className="text-sm text-gray-600">Total Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{alertCounts.critical}</div>
            <div className="text-sm text-gray-600">Critical</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{alertCounts.high}</div>
            <div className="text-sm text-gray-600">High</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{alertCounts.medium}</div>
            <div className="text-sm text-gray-600">Medium</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{alertCounts.low}</div>
            <div className="text-sm text-gray-600">Low</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{alertCounts.unacknowledged}</div>
            <div className="text-sm text-gray-600">Unacknowledged</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEventType} onValueChange={setFilterEventType}>
              <SelectTrigger>
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="enter">Enter</SelectItem>
                <SelectItem value="exit">Exit</SelectItem>
                <SelectItem value="violation_enter">Violation Enter</SelectItem>
                <SelectItem value="violation_exit">Violation Exit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                className="w-full sm:w-auto"
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {selectedAlerts.length > 0 && (
                <Button
                  onClick={handleBulkAcknowledge}
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Acknowledge ({selectedAlerts.length})
                </Button>
              )}
              
              <Button
                onClick={handleExportAlerts}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Alerts ({filteredAlerts.length})
            </CardTitle>
            
            {filteredAlerts.length > 0 && (
              <Checkbox
                checked={selectedAlerts.length === filteredAlerts.length}
                onCheckedChange={handleSelectAll}
                className="mr-2"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading alerts...</p>
            </div>
          )}

          {!loading && filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Alerts Found</h3>
              <p className="text-gray-500">
                {alerts.length === 0 
                  ? "No alerts have been generated yet."
                  : "No alerts match your current filters."
                }
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <Card 
                key={alert.id}
                className={`transition-all hover:shadow-md border-l-4 ${
                  alert.severity === 'critical' ? 'border-l-red-500' :
                  alert.severity === 'high' ? 'border-l-orange-500' :
                  alert.severity === 'medium' ? 'border-l-yellow-500' :
                  'border-l-blue-500'
                } ${selectedAlerts.includes(alert.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={selectedAlerts.includes(alert.id)}
                        onCheckedChange={() => handleAlertSelection(alert.id)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge className={getEventTypeColor(alert.event_type)}>
                            {formatEventType(alert.event_type)}
                          </Badge>
                          {alert.acknowledged && (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{alert.vehicle_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span>{alert.geofence_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{format(alert.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: id })}</span>
                          </div>
                        </div>
                        
                        {alert.acknowledged && alert.acknowledgedBy && (
                          <div className="mt-2 text-xs text-gray-500">
                            Acknowledged by {alert.acknowledgedBy} at {format(alert.acknowledgedAt!, 'dd/MM/yyyy HH:mm')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setIsDetailDialogOpen(true);
                        }}
                        className="h-8 w-8"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {!alert.acknowledged && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="h-8 w-8"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Alert Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about the geofence alert
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-6">
              {/* Alert Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Alert ID</label>
                  <p className="text-gray-800 font-mono text-sm">{selectedAlert.event_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Timestamp</label>
                  <p className="text-gray-800">{format(selectedAlert.timestamp, 'dd MMMM yyyy, HH:mm:ss', { locale: id })}</p>
                </div>
              </div>

              {/* Severity and Event Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Severity Level</label>
                  <Badge className={getSeverityColor(selectedAlert.severity)}>
                    {selectedAlert.severity.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Event Type</label>
                  <Badge className={getEventTypeColor(selectedAlert.event_type)}>
                    {formatEventType(selectedAlert.event_type)}
                  </Badge>
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Vehicle Name</label>
                    <p className="text-gray-800">{selectedAlert.vehicle_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Vehicle ID</label>
                    <p className="text-gray-800 font-mono text-sm">{selectedAlert.vehicle_id}</p>
                  </div>
                  {(() => {
                    const vehicle = vehicles.find(v => v.vehicle_id === selectedAlert.vehicle_id);
                    return vehicle ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">License Plate</label>
                          <p className="text-gray-800">{vehicle.license_plate}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Vehicle Model</label>
                          <p className="text-gray-800">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Geofence Information */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Geofence Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Geofence Name</label>
                    <p className="text-gray-800">{selectedAlert.geofence_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Geofence ID</label>
                    <p className="text-gray-800 font-mono text-sm">{selectedAlert.geofence_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Rule Type</label>
                    <Badge variant="outline">
                      {selectedAlert.rule_triggered === 'FORBIDDEN' ? 'Terlarang' :
                       selectedAlert.rule_triggered === 'STAY_IN' ? 'Wajib Tetap di Dalam' : 'Standar'}
                    </Badge>
                  </div>
                  {(() => {
                    const geofence = geofences.find(g => g.geofence_id === selectedAlert.geofence_id);
                    return geofence ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Geofence Type</label>
                        <Badge variant="outline">
                          {geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}
                        </Badge>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Event Description */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Event Description
                </h4>
                <p className="text-gray-700">
                  {selectedAlert.event_type === 'enter' && 
                    `Vehicle "${selectedAlert.vehicle_name}" entered geofence "${selectedAlert.geofence_name}".`}
                  {selectedAlert.event_type === 'exit' && 
                    `Vehicle "${selectedAlert.vehicle_name}" exited geofence "${selectedAlert.geofence_name}".`}
                  {selectedAlert.event_type === 'violation_enter' && 
                    `🚨 VIOLATION: Vehicle "${selectedAlert.vehicle_name}" illegally entered forbidden geofence "${selectedAlert.geofence_name}".`}
                  {selectedAlert.event_type === 'violation_exit' && 
                    `🚨 VIOLATION: Vehicle "${selectedAlert.vehicle_name}" illegally exited mandatory geofence "${selectedAlert.geofence_name}".`}
                </p>
              </div>

              {/* Acknowledgment Status */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Acknowledgment Status
                </h4>
                {selectedAlert.acknowledged ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 font-medium">This alert has been acknowledged</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Acknowledged by: <span className="font-medium">{selectedAlert.acknowledgedBy}</span></p>
                      <p>Acknowledged at: <span className="font-medium">
                        {selectedAlert.acknowledgedAt && format(selectedAlert.acknowledgedAt, 'dd MMMM yyyy, HH:mm:ss', { locale: id })}
                      </span></p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-700 font-medium">This alert has not been acknowledged</span>
                    </div>
                    <Button
                      onClick={() => {
                        handleAcknowledgeAlert(selectedAlert.id);
                        setIsDetailDialogOpen(false);
                      }}
                      className="w-full"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Acknowledge This Alert
                    </Button>
                  </div>
                )}
              </div>

              {/* API Status Info */}
              {(() => {
                const apiStatus = getApiStatus();
                return apiStatus.pendingEvents > 0 ? (
                  <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      API Status
                    </h4>
                    <p className="text-yellow-700 text-sm">
                      There are {apiStatus.pendingEvents} events pending to be sent to the server.
                    </p>
                    <Button
                      onClick={retryFailedApiCalls}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Failed API Calls
                    </Button>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setIsDetailDialogOpen(false)}
            >
              Close
            </Button>
            {selectedAlert && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportAlerts}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                {!selectedAlert.acknowledged && (
                  <Button
                    onClick={() => {
                      handleAcknowledgeAlert(selectedAlert.id);
                      setIsDetailDialogOpen(false);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}