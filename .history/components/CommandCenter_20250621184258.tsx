"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL } from "../api/file";
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
  Zap,
  Settings,
  ShieldAlert,
  RefreshCw,
  Wifi,
  WifiOff,
  Bell,
  CheckCircle2
} from "lucide-react";

interface User {
  id?: string;
  user_id?: string;
  _id?: string;
  ID?: string;
  email?: string;
  name?: string;
  full_name?: string;
}

interface Vehicle {
  id: string;
  name: string;
  status: "online" | "offline";
  relayStatus?: string;
  relayCommandStatus?: string; // New field
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
  id: number;
  vehicle_id: string;
  vehicle_name?: string;
  command: string;
  status: "completed" | "pending" | "failed";
  relay_command_status?: "sent" | "success" | "failed"; // New field
  issuedBy: string;
  timestamp: string;
  executedAt: string | null;
}

interface PendingCommand {
  id: number;
  vehicle_id: string;
  vehicle_name: string;
  command: string;
  status: string;
  relay_command_status: string;
}

export function CommandCenter() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fetchingVehicles, setFetchingVehicles] = useState<boolean>(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

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

  // Get user data
  const getUserData = (): User | null => {
    try {
      if (typeof window === 'undefined') return null;
      const storedUser = sessionStorage.getItem('user');
      if (!storedUser) return null;
      return JSON.parse(storedUser);
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  };

  const getUserId = (user: User | null): string | null => {
    if (!user) return null;
    return user.id || user.user_id || user._id || user.ID || null;
  };

  // Safely extract string
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

  // Safely extract number
  const safeNumber = (value: any, fallback: number = 0): number => {
    try {
      if (value === null || value === undefined) return fallback;
      const num = Number(value);
      return isNaN(num) ? fallback : num;
    } catch {
      return fallback;
    }
  };

  // Fetch vehicles for current user only
  const fetchVehicles = async (userId: string) => {
    console.log('🚗 Fetching vehicles for user:', userId);
    setFetchingVehicles(true);
    setVehicleError(null);
    
    try {
      // Fetch only vehicles belonging to current user
      const response = await fetch(`${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${userId}`);
      
      console.log('📡 Vehicle fetch response:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('📦 Raw vehicle response:', rawData);
      
      if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
        console.warn('⚠️ Invalid response structure');
        setVehicles([]);
        return;
      }
      
      console.log(`📊 Processing ${rawData.data.length} vehicles...`);
      
      // Process vehicles
      const processedVehicles: Vehicle[] = [];
      
      for (const rawVehicle of rawData.data) {
        try {
          if (!rawVehicle) continue;
          
          const vehicleId = safeString(rawVehicle.vehicle_id);
          if (!vehicleId) continue;
          
          const vehicle: Vehicle = {
            id: vehicleId,
            name: safeString(rawVehicle.name, `Vehicle-${vehicleId}`),
            status: rawVehicle.relay_status === "ON" ? "online" : "offline",
            relayStatus: safeString(rawVehicle.relay_status),
            relayCommandStatus: safeString(rawVehicle.relay_command_status), // New field
            licensePlate: safeString(rawVehicle.license_plate),
            make: safeString(rawVehicle.make),
            model: safeString(rawVehicle.model),
            year: safeNumber(rawVehicle.year),
            gpsId: safeString(rawVehicle.gps_id)
          };
          
          processedVehicles.push(vehicle);
          console.log(`✅ Added vehicle: ${vehicle.name} (${vehicle.id})`);
        } catch (error) {
          console.error('❌ Error processing vehicle:', error);
        }
      }
      
      console.log(`🎯 Successfully processed ${processedVehicles.length} vehicles`);
      setVehicles(processedVehicles);
      
    } catch (error) {
      console.error('❌ Error fetching vehicles:', error);
      setVehicleError(error instanceof Error ? error.message : 'Unknown error');
      setVehicles([]);
    } finally {
      setFetchingVehicles(false);
    }
  };

  // Fetch command history for current user
  const fetchCommandHistory = async (userId: string) => {
    try {
      console.log('📜 Fetching command history for user:', userId);
      
      // Fetch commands with user filter
      const response = await fetch(
        `${API_BASE_URL}/items/commands?filter[issued_by][_eq]=${userId}&sort=-date_created&limit=20`
      );
      
      if (!response.ok) {
        console.warn('⚠️ Failed to fetch command history');
        setCommandHistory([]);
        return;
      }
      
      const data = await response.json();
      console.log('📦 Raw command history:', data);
      
      if (!data || !data.data || !Array.isArray(data.data)) {
        setCommandHistory([]);
        return;
      }
      
      // Process command history
      const processedHistory: CommandHistory[] = [];
      const pending: PendingCommand[] = [];
      
      for (const cmd of data.data) {
        try {
          if (!cmd) continue;
          
          // Find vehicle name from vehicles list
          const vehicle = vehicles.find(v => v.id === safeString(cmd.vehicle_id));
          const vehicleName = vehicle ? vehicle.name : `Vehicle-${cmd.vehicle_id}`;
          
          const processedCmd: CommandHistory = {
            id: safeNumber(cmd.id || cmd.command_id),
            vehicle_id: safeString(cmd.vehicle_id),
            vehicle_name: vehicleName,
            command: safeString(cmd.command_type || cmd.command, 'unknown'),
            status: ['completed', 'pending', 'failed'].includes(safeString(cmd.status)) 
              ? cmd.status 
              : 'pending',
            relay_command_status: ['sent', 'success', 'failed'].includes(safeString(cmd.relay_command_status))
              ? cmd.relay_command_status
              : undefined,
            issuedBy: safeString(cmd.issued_by || userId),
            timestamp: safeString(cmd.date_created || cmd.timestamp, new Date().toISOString()),
            executedAt: cmd.date_executed || cmd.executed_at ? safeString(cmd.date_executed || cmd.executed_at) : null
          };
          
          processedHistory.push(processedCmd);
          
          // Track pending commands for real-time monitoring
          if (processedCmd.relay_command_status === 'sent' && processedCmd.status === 'pending') {
            pending.push({
              id: processedCmd.id,
              vehicle_id: processedCmd.vehicle_id,
              vehicle_name: vehicleName,
              command: processedCmd.command,
              status: processedCmd.status,
              relay_command_status: processedCmd.relay_command_status
            });
          }
        } catch (error) {
          console.error('❌ Error processing command:', error);
        }
      }
      
      console.log(`✅ Processed ${processedHistory.length} command history items`);
      setCommandHistory(processedHistory);
      setPendingCommands(pending);
      
    } catch (error) {
      console.error('❌ Error fetching command history:', error);
      setCommandHistory([]);
      setPendingCommands([]);
    }
  };

  // Check for command status updates
  const checkCommandUpdates = useCallback(async () => {
    if (!currentUser || pendingCommands.length === 0) return;
    
    const userId = getUserId(currentUser);
    if (!userId) return;
    
    try {
      // Check each pending command for updates
      for (const pendingCmd of pendingCommands) {
        const response = await fetch(`${API_BASE_URL}/items/commands/${pendingCmd.id}`);
        
        if (response.ok) {
          const data = await response.json();
          const commandData = data.data;
          
          if (commandData?.relay_command_status === 'success' && 
              pendingCmd.relay_command_status === 'sent') {
            
            // Show success notification
            toast.success(
              `✅ Command executed successfully on ${pendingCmd.vehicle_name}`,
              {
                description: `${formatCommandName(pendingCmd.command)} completed`,
                duration: 5000,
              }
            );
            
            // Update command history
            await fetchCommandHistory(userId);
            
            // Update vehicle status
            await fetchVehicles(userId);
          } else if (commandData?.relay_command_status === 'failed' && 
                     pendingCmd.relay_command_status === 'sent') {
            
            // Show failure notification
            toast.error(
              `❌ Command failed on ${pendingCmd.vehicle_name}`,
              {
                description: `${formatCommandName(pendingCmd.command)} could not be executed`,
                duration: 5000,
              }
            );
            
            // Update command history
            await fetchCommandHistory(userId);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error checking command updates:', error);
    }
  }, [currentUser, pendingCommands, vehicles]);

  // Start polling for command updates
  useEffect(() => {
    if (pendingCommands.length > 0 && isOnline) {
      const interval = setInterval(checkCommandUpdates, 3000); // Check every 3 seconds
      setPollingInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [pendingCommands, isOnline, checkCommandUpdates]);

  // Initialize data
  useEffect(() => {
    console.log('🚀 Initializing CommandCenter...');
    
    const user = getUserData();
    if (!user) {
      console.error('❌ No user found');
      return;
    }
    
    setCurrentUser(user);
    const userId = getUserId(user);
    
    if (!userId) {
      console.error('❌ No user ID found');
      return;
    }
    
    // Load data
    const loadData = async () => {
      await fetchVehicles(userId);
      await fetchCommandHistory(userId);
    };
    
    loadData();
  }, []);

  // Refresh data
  const refreshData = async () => {
    if (!currentUser || refreshing || !isOnline) return;
    
    const userId = getUserId(currentUser);
    if (!userId) return;
    
    setRefreshing(true);
    try {
      await Promise.all([
        fetchVehicles(userId),
        fetchCommandHistory(userId)
      ]);
      toast.success('Data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const availableCommands: Command[] = [
    { value: "RELAY_OFF", label: "Turn Engine Off", icon: PowerOff, color: "red" },
    { value: "RELAY_ON", label: "Turn Engine On", icon: Power, color: "green" }
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRelayCommandStatusColor = (status?: string): string => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'sent':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
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

  const getRelayCommandStatusIcon = (status?: string): React.ReactNode => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'sent':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCommandIcon = (command: string): React.ReactNode => {
    switch (command) {
      case 'RELAY_OFF':
      case 'engine_off':
        return <PowerOff className="w-4 h-4 text-red-500" />;
      case 'RELAY_ON':
      case 'engine_on':
        return <Power className="w-4 h-4 text-green-500" />;
      default:
        return <CommandIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatCommandName = (command: string): string => {
    if (!command) return 'Unknown';
    
    // Handle both formats
    if (command === 'RELAY_ON') return 'Engine On';
    if (command === 'RELAY_OFF') return 'Engine Off';
    
    return command.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatRelayCommandStatus = (status?: string): string => {
    if (!status) return '';
    
    switch (status) {
      case 'sent':
        return 'Sent';
      case 'success':
        return 'Success';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const handleSendCommand = async () => {
    if (!selectedVehicle || !selectedCommand) {
      toast.error('Please select a vehicle and command first');
      return;
    }

    if (!currentUser) {
      toast.error('Please login first');
      return;
    }

    if (!isOnline) {
      toast.error('No internet connection');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const userId = getUserId(currentUser);
      if (!userId) throw new Error('User ID not found');
      
      // Record command in history with "sent" status
      const commandData = {
        vehicle_id: selectedVehicle,
        command_type: selectedCommand,
        issued_by: userId,
        status: 'pending',
        relay_command_status: 'sent', // New field - command sent to ESP32
        date_created: new Date().toISOString(),
        date_executed: null
      };
      
      console.log('📤 Recording command:', commandData);
      
      const historyResponse = await fetch(`${API_BASE_URL}/items/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandData),
      });
      
      if (!historyResponse.ok) {
        throw new Error(`Failed to record command: ${historyResponse.status}`);
      }
      
      // Update vehicle relay_command_status to "sent"
      console.log(`📤 Updating vehicle ${selectedVehicle} relay_command_status to sent`);
      
      const vehicleUpdateResponse = await fetch(`${API_BASE_URL}/items/vehicle/${selectedVehicle}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relay_command_status: 'sent'
        }),
      });
      
      if (!vehicleUpdateResponse.ok) {
        throw new Error(`Failed to update vehicle: ${vehicleUpdateResponse.status}`);
      }
      
      const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
      
      // Show "sent" notification
      toast.info(
        `📤 Command sent to ${selectedVehicleObj?.name || 'vehicle'}`,
        {
          description: `${formatCommandName(selectedCommand)} command has been sent to ESP32`,
          duration: 4000,
        }
      );
      
      // Reset and refresh
      setSelectedVehicle("");
      setSelectedCommand("");
      
      await refreshData();
      
    } catch (error) {
      console.error('❌ Error sending command:', error);
      toast.error('Failed to send command');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    return {
      completed: commandHistory.filter(cmd => cmd?.status === 'completed').length,
      pending: commandHistory.filter(cmd => cmd?.status === 'pending').length,
      failed: commandHistory.filter(cmd => cmd?.status === 'failed').length,
      onlineVehicles: vehicles.filter(v => v?.relayStatus === 'ON').length,
      sentCommands: commandHistory.filter(cmd => cmd?.relay_command_status === 'sent').length,
      successCommands: commandHistory.filter(cmd => cmd?.relay_command_status === 'success').length
    };
  }, [commandHistory, vehicles]);

  return (
    <div className="space-y-4 p-4 pb-20 md:pb-4">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Command Center</h1>
          <p className="text-sm text-slate-600">Control vehicle operations remotely</p>
          {pendingCommands.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Bell className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="text-xs text-blue-600 font-medium">
                {pendingCommands.length} command(s) pending execution
              </span>
            </div>
          )}
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
            onClick={refreshData}
            disabled={refreshing || !isOnline}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Command Panel - Full width on mobile */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Send className="w-5 h-5 text-blue-600" />
                Send Command
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vehicle Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Vehicle</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {fetchingVehicles ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Loading vehicles...</span>
                        </div>
                      </SelectItem>
                    ) : vehicleError ? (
                      <SelectItem value="error" disabled>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span>Error loading vehicles</span>
                        </div>
                      </SelectItem>
                    ) : vehicles.length === 0 ? (
                      <SelectItem value="no-vehicles" disabled>
                        No vehicles available
                      </SelectItem>
                    ) : (
                      vehicles.map((vehicle) => {
                        const isOn = vehicle.relayStatus === 'ON';
                        const commandStatus = vehicle.relayCommandStatus;
                        return (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4" />
                              <span className="font-medium">{vehicle.name}</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${isOn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                              >
                                {isOn ? 'ON' : 'OFF'}
                              </Badge>
                              {commandStatus && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getRelayCommandStatusColor(commandStatus)}`}
                                >
                                  {formatRelayCommandStatus(commandStatus)}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Command Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Command</label>
                <Select value={selectedCommand} onValueChange={setSelectedCommand}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a command" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCommands.map((command) => (
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
                disabled={!selectedVehicle || !selectedCommand || isLoading || fetchingVehicles || !isOnline}
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
              
              {/* Warning - Smaller on mobile */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-yellow-700">
                    <p className="font-medium mb-1">Important</p>
                    <p>Commands are sent to ESP32 and executed automatically. Ensure vehicle safety first.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Stats Cards - Grid on mobile */}
        <div className="lg:hidden grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.successCommands}</p>
                  <p className="text-xs text-slate-600">Success</p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.sentCommands}</p>
                  <p className="text-xs text-slate-600">Sent</p>
                </div>
                <Send className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  <p className="text-xs text-slate-600">Pending</p>
                </div>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.onlineVehicles}</p>
                  <p className="text-xs text-slate-600">Engines On</p>
                </div>
                <Power className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Command History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="w-5 h-5 text-blue-600" />
                Command History
                {pendingCommands.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {pendingCommands.length} pending
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {commandHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <CommandIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">No command history available</p>
                  </div>
                ) : (
                  commandHistory.map((cmd) => (
                    <div key={cmd.id} className="p-3 sm:p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      {/* Mobile Layout */}
                      <div className="space-y-2">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getCommandIcon(cmd.command)}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm sm:text-base text-slate-800 truncate">
                                {cmd.vehicle_name || cmd.vehicle_id}
                              </h4>
                              <p className="text-xs text-slate-500">
                                {formatCommandName(cmd.command)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              {getStatusIcon(cmd.status)}
                              <Badge className={`text-xs ${getStatusColor(cmd.status)}`}>
                                {cmd.status}
                              </Badge>
                            </div>
                            {cmd.relay_command_status && (
                              <div className="flex items-center gap-1">
                                {getRelayCommandStatusIcon(cmd.relay_command_status)}
                                <Badge className={`text-xs ${getRelayCommandStatusColor(cmd.relay_command_status)}`}>
                                  {formatRelayCommandStatus(cmd.relay_command_status)}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Details - Responsive Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                          <div>
                            <p className="text-slate-400">Sent at</p>
                            <p className="font-medium text-slate-600">
                              {new Date(cmd.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          {cmd.executedAt && (
                            <div>
                              <p className="text-slate-400">Executed</p>
                              <p className="font-medium text-slate-600">
                                {new Date(cmd.executedAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          )}
                          <div className="hidden sm:block">
                            <p className="text-slate-400">Date</p>
                            <p className="font-medium text-slate-600">
                              {new Date(cmd.timestamp).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </p>
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
      
      {/* Desktop Stats Cards */}
      <div className="hidden lg:grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.successCommands}</p>
                <p className="text-sm text-slate-600">Success</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.sentCommands}</p>
                <p className="text-sm text-slate-600">Sent</p>
              </div>
              <Send className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-sm text-slate-600">Completed</p>
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
                <p className="text-2xl font-bold text-blue-600">{stats.onlineVehicles}</p>
                <p className="text-sm text-slate-600">Engines On</p>
              </div>
              <Power className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}