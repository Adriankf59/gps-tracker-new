"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Command as CommandIcon, 
  Power, 
  PowerOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Car,
  Send,
  Loader2,
  RefreshCw
} from "lucide-react";

// Types
interface Vehicle {
  id: string;
  name: string;
  status: "online" | "offline";
  relayStatus?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number;
  gpsId?: string;
}

interface Command {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

interface CommandHistory {
  command_id: number;
  issued_by: string;
  command_type: string;
  status: string;
  date_sent: string | null;
  vehicle_id: number | null;
  gps_id: string | null;
}

interface User {
  id?: string;
  user_id?: string;
  _id?: string;
  ID?: string;
  name?: string;
  email?: string;
}

// Constants
const API_BASE_URL = "http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055";
const POLLING_INTERVAL = 10000; // 10 seconds

const AVAILABLE_COMMANDS: Command[] = [
  { value: "RELAY_OFF", label: "Turn Engine Off", icon: PowerOff, color: "red" },
  { value: "RELAY_ON", label: "Turn Engine On", icon: Power, color: "green" }
];

const STATUS_STYLES = {
  sent: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200'
} as const;

// Utility functions
const safeString = (value: any, fallback: string = ''): string => {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return fallback;
  } catch {
    return fallback;
  }
};

const safeNumber = (value: any, fallback: number = 0): number => {
  try {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  } catch {
    return fallback;
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Date';
  }
};

const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case 'sent':
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-gray-500" />;
  }
};

const getCommandIcon = (command: string): React.ReactNode => {
  switch (command) {
    case 'RELAY_OFF':
    case 'ENGINE_OFF':
      return <PowerOff className="w-4 h-4 text-red-500" />;
    case 'RELAY_ON':
    case 'ENGINE_ON':
      return <Power className="w-4 h-4 text-green-500" />;
    default:
      return <CommandIcon className="w-4 h-4 text-gray-500" />;
  }
};

const formatCommandName = (command: string): string => {
  if (!command) return 'Unknown';
  return command.replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function CommandCenter() {
  // State
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fetchingVehicles, setFetchingVehicles] = useState<boolean>(true);
  const [fetchingHistory, setFetchingHistory] = useState<boolean>(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Memoized user ID
  const userId = useMemo(() => {
    if (!currentUser) return 'unknown';
    return currentUser.id || currentUser.user_id || currentUser._id || currentUser.ID || 'unknown';
  }, [currentUser]);

  // Fetch vehicles
  const fetchVehicles = useCallback(async () => {
    setFetchingVehicles(true);
    setVehicleError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/items/vehicle`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      
      if (!rawData?.data || !Array.isArray(rawData.data)) {
        console.warn('Invalid vehicle data structure');
        setVehicles([]);
        return;
      }
      
      const processedVehicles: Vehicle[] = rawData.data
        .filter((vehicle: any) => vehicle && vehicle.vehicle_id)
        .map((vehicle: any): Vehicle => ({
          id: safeString(vehicle.vehicle_id),
          name: safeString(vehicle.name, `Vehicle-${vehicle.vehicle_id}`),
          status: vehicle.relay_status === "ON" ? "online" : "offline",
          relayStatus: safeString(vehicle.relay_status),
          licensePlate: safeString(vehicle.license_plate),
          make: safeString(vehicle.make),
          model: safeString(vehicle.model),
          year: safeNumber(vehicle.year),
          gpsId: safeString(vehicle.gps_id)
        }));
      
      setVehicles(processedVehicles);
      
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setVehicleError(error instanceof Error ? error.message : 'Unknown error');
      setVehicles([]);
    } finally {
      setFetchingVehicles(false);
    }
  }, []);

  // Fetch command history
  const fetchCommandHistory = useCallback(async () => {
    setFetchingHistory(true);
    setHistoryError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/items/commands?limit=-1&sort=-command_id`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data?.data || !Array.isArray(data.data)) {
        console.warn('Invalid command history data structure');
        setCommandHistory([]);
        return;
      }
      
      // Filter out invalid entries and sort by command_id descending
      const validCommands = data.data
        .filter((cmd: any) => cmd && cmd.command_id && cmd.command_type)
        .sort((a: any, b: any) => safeNumber(b.command_id) - safeNumber(a.command_id));
      
      setCommandHistory(validCommands);
      
    } catch (error) {
      console.error('Error fetching command history:', error);
      setHistoryError(error instanceof Error ? error.message : 'Unknown error');
      setCommandHistory([]);
    } finally {
      setFetchingHistory(false);
    }
  }, []);

  // Get vehicle name by ID
  const getVehicleNameById = useCallback((id: string | number): string => {
    if (!id) return 'Unknown Vehicle';
    
    const vehicle = vehicles.find(v => v.id === String(id));
    return vehicle ? vehicle.name : `Vehicle-${id}`;
  }, [vehicles]);

  // Send command
  const handleSendCommand = useCallback(async () => {
    if (!selectedVehicle || !selectedCommand) {
      toast.error('Please select a vehicle and command first');
      return;
    }

    if (!currentUser) {
      toast.error('Please login first');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const commandData = {
        vehicle_id: parseInt(selectedVehicle),
        command_type: selectedCommand,
        issued_by: userId,
        status: 'pending',
        date_sent: new Date().toISOString(),
        gps_id: null
      };
      
      console.log('Sending command:', commandData);
      
      const response = await fetch(`${API_BASE_URL}/items/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send command: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Command sent successfully:', result);
      
      // Update vehicle relay status locally for immediate feedback
      const newRelayStatus = selectedCommand === 'RELAY_ON' ? 'ON' : 'OFF';
      setVehicles(prev => prev.map(v => 
        v.id === selectedVehicle 
          ? { ...v, relayStatus: newRelayStatus, status: newRelayStatus === 'ON' ? 'online' : 'offline' }
          : v
      ));
      
      toast.success(`Command "${formatCommandName(selectedCommand)}" sent successfully to ${getVehicleNameById(selectedVehicle)}`);
      
      // Reset selections
      setSelectedVehicle("");
      setSelectedCommand("");
      
      // Refresh command history
      await fetchCommandHistory();
      
    } catch (error) {
      console.error('Error sending command:', error);
      
      let errorMessage = 'Failed to send command. ';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += 'Please check your internet connection.';
        } else if (error.message.includes('500')) {
          errorMessage += 'Server error. Please try again later.';
        } else if (error.message.includes('400')) {
          errorMessage += 'Invalid command data. Please check your selection.';
        } else if (error.message.includes('403') || error.message.includes('401')) {
          errorMessage += 'Authentication failed. Please login again.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedVehicle, selectedCommand, currentUser, userId, getVehicleNameById, fetchCommandHistory]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([fetchVehicles(), fetchCommandHistory()]);
  }, [fetchVehicles, fetchCommandHistory]);

  // Memoized statistics
  const stats = useMemo(() => {
    const sent = commandHistory.filter(cmd => cmd.status === 'sent').length;
    const pending = commandHistory.filter(cmd => cmd.status === 'pending').length;
    const failed = commandHistory.filter(cmd => cmd.status === 'failed').length;
    const completed = commandHistory.filter(cmd => cmd.status === 'completed').length;
    const onlineVehicles = vehicles.filter(v => v.status === 'online').length;
    
    return { sent, pending, failed, completed, onlineVehicles };
  }, [commandHistory, vehicles]);

  // Initialize data
  useEffect(() => {
    console.log('Initializing CommandCenter...');
    
    // Get current user
    try {
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        console.log('Current user loaded:', user);
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
    
    // Load initial data
    refreshData();
  }, [refreshData]);

  // Set up polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCommandHistory();
    }, POLLING_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchCommandHistory]);

  // Render vehicle options
  const renderVehicleOptions = () => {
    if (fetchingVehicles) {
      return (
        <SelectItem value="loading" disabled>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading vehicles...</span>
          </div>
        </SelectItem>
      );
    }

    if (vehicleError) {
      return (
        <SelectItem value="error" disabled>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>Error loading vehicles</span>
          </div>
        </SelectItem>
      );
    }

    if (vehicles.length === 0) {
      return (
        <SelectItem value="no-vehicles" disabled>
          No vehicles available
        </SelectItem>
      );
    }

    return vehicles.map((vehicle) => (
      <SelectItem key={vehicle.id} value={vehicle.id}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4" />
            <span className="font-medium">{vehicle.name}</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                vehicle.status === 'online' 
                  ? 'text-green-600 border-green-200' 
                  : 'text-red-600 border-red-200'
              }`}
            >
              {vehicle.status}
            </Badge>
            {vehicle.relayStatus && (
              <Badge 
                variant="outline" 
                className={`text-xs ml-1 ${
                  vehicle.relayStatus === 'ON' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {vehicle.relayStatus === 'ON' ? 'Engine ON' : 'Engine OFF'}
              </Badge>
            )}
          </div>
          {(vehicle.make || vehicle.model || vehicle.licensePlate) && (
            <div className="text-xs text-gray-500 pl-6">
              {[vehicle.make, vehicle.model, vehicle.licensePlate].filter(Boolean).join(' • ')}
            </div>
          )}
        </div>
      </SelectItem>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Command Center</h1>
          <p className="text-slate-600">Send commands and control vehicle operations remotely</p>
        </div>
        <Button 
          onClick={refreshData} 
          variant="outline"
          disabled={fetchingVehicles || fetchingHistory}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${(fetchingVehicles || fetchingHistory) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Command Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Send Command
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vehicle Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Vehicle</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {renderVehicleOptions()}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Command Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Command</label>
                <Select value={selectedCommand} onValueChange={setSelectedCommand}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a command" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COMMANDS.map((command) => (
                      <SelectItem key={command.value} value={command.value}>
                        <div className="flex items-center gap-2">
                          <command.icon className={`w-4 h-4 text-${command.color}-500`} />
                          <span>{command.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Send Button */}
              <Button 
                onClick={handleSendCommand}
                disabled={!selectedVehicle || !selectedCommand || isLoading || fetchingVehicles}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Command
                  </>
                )}
              </Button>
              
              {/* Warning */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium mb-1">Important</p>
                    <p>Commands sent to vehicles are executed immediately. Please ensure the vehicle is in a safe location before sending engine control commands.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Command History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Command History
              </CardTitle>
              {fetchingHistory && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historyError ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-500 mb-2">Error loading command history</p>
                    <p className="text-sm text-gray-500">{historyError}</p>
                    <Button 
                      onClick={fetchCommandHistory}
                      variant="outline"
                      className="mt-4"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : commandHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <CommandIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {fetchingHistory ? 'Loading command history...' : 'No command history available'}
                    </p>
                  </div>
                ) : (
                  commandHistory.map((cmd) => (
                    <div key={cmd.command_id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="p-2 rounded-lg bg-slate-100">
                        {getCommandIcon(cmd.command_type)}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-800">
                              {getVehicleNameById(cmd.vehicle_id || 0)}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {formatCommandName(cmd.command_type)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(cmd.status)}
                            <Badge className={STATUS_STYLES[cmd.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending}>
                              {cmd.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-500">
                          <div>
                            <p className="text-slate-400">Command ID</p>
                            <p className="font-medium text-slate-600">#{cmd.command_id}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Sent at</p>
                            <p className="font-medium text-slate-600">{formatDate(cmd.date_sent)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Issued by</p>
                            <p className="font-medium text-slate-600">{safeString(cmd.issued_by, 'Unknown')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                <p className="text-sm text-slate-600">Sent</p>
              </div>
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-sm text-slate-600">Pending</p>
              </div>
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-sm text-slate-600">Failed</p>
              </div>
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
                <p className="text-sm text-slate-600">Completed</p>
              </div>
              <CheckCircle className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.onlineVehicles}</p>
                <p className="text-sm text-slate-600">Online Vehicles</p>
              </div>
              <Car className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}