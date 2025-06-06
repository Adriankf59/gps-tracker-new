"use client";

import React, { useState } from "react";
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
  ShieldAlert
} from "lucide-react";

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
  id: number;
  vehicle: string;
  command: string;
  status: "completed" | "pending" | "failed";
  issuedBy: string;
  timestamp: string;
  executedAt: string | null;
}

export function CommandCenter() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [fetchingVehicles, setFetchingVehicles] = useState<boolean>(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  // Ultra-safe helper functions
  const safeParse = (value: any): any => {
    try {
      if (value === null || value === undefined) return null;
      return value;
    } catch {
      return null;
    }
  };

  const safeString = (value: any, fallback: string = ''): string => {
    try {
      if (value === null || value === undefined) return fallback;
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return String(value);
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

  // Safely extract vehicle data
  const extractVehicleData = (rawVehicle: any): Vehicle | null => {
    try {
      if (!rawVehicle || typeof rawVehicle !== 'object') {
        console.log('⚠️ Invalid vehicle object:', rawVehicle);
        return null;
      }

      // Extract ID from various possible fields
      let vehicleId = '';
      const possibleIdFields = ['vehicle_id', 'id', '_id', 'ID', 'vehicleId'];
      
      for (const field of possibleIdFields) {
        const value = safeParse(rawVehicle[field]);
        if (value !== null) {
          vehicleId = safeString(value);
          if (vehicleId) break;
        }
      }

      if (!vehicleId) {
        console.log('⚠️ No valid ID found for vehicle:', rawVehicle);
        return null;
      }

      // Extract name
      let vehicleName = '';
      const possibleNameFields = ['name', 'vehicle_name', 'vehicleName', 'title'];
      
      for (const field of possibleNameFields) {
        const value = safeParse(rawVehicle[field]);
        if (value !== null) {
          vehicleName = safeString(value);
          if (vehicleName) break;
        }
      }

      if (!vehicleName) {
        vehicleName = `Vehicle-${vehicleId}`;
      }

      // Extract status
      let vehicleStatus: "online" | "offline" = 'offline';
      const possibleStatusFields = ['status', 'vehicle_status', 'vehicleStatus', 'state'];
      
      for (const field of possibleStatusFields) {
        const value = safeParse(rawVehicle[field]);
        if (value !== null) {
          const statusStr = safeString(value).toLowerCase();
          if (statusStr === 'online' || statusStr === 'active' || statusStr === '1' || statusStr === 'true') {
            vehicleStatus = 'online';
            break;
          }
        }
      }

      const vehicle: Vehicle = {
        id: vehicleId,
        name: vehicleName,
        status: vehicleStatus
      };

      console.log('✅ Successfully extracted vehicle:', vehicle);
      return vehicle;

    } catch (error) {
      console.error('❌ Error extracting vehicle data:', error, rawVehicle);
      return null;
    }
  };

  // Fetch vehicles with maximum safety
  const fetchVehicles = async () => {
    console.log('🚗 Starting vehicle fetch...');
    setFetchingVehicles(true);
    setVehicleError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/items/vehicle`);
      
      console.log('📡 Vehicle fetch response:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('📦 Raw vehicle response:', rawData);
      
      // Validate response structure
      if (!rawData) {
        console.warn('⚠️ No data in response');
        setVehicles([]);
        return;
      }
      
      if (!rawData.data) {
        console.warn('⚠️ No data.data in response:', rawData);
        setVehicles([]);
        return;
      }
      
      if (!Array.isArray(rawData.data)) {
        console.warn('⚠️ data.data is not array:', typeof rawData.data, rawData.data);
        setVehicles([]);
        return;
      }
      
      console.log(`📊 Processing ${rawData.data.length} raw vehicles...`);
      
      // Process each vehicle with maximum safety - NO MAP FUNCTION
      const processedVehicles: Vehicle[] = [];
      
      for (let i = 0; i < rawData.data.length; i++) {
        try {
          const rawVehicle = rawData.data[i];
          console.log(`🔍 Processing vehicle ${i + 1}/${rawData.data.length}:`, rawVehicle);
          
          // Extract vehicle data
          if (!rawVehicle) continue;
          
          const vehicleId = safeString(rawVehicle.vehicle_id);
          if (!vehicleId) continue;
          
          const vehicle: Vehicle = {
            id: vehicleId,
            name: safeString(rawVehicle.name, `Vehicle-${vehicleId}`),
            status: rawVehicle.relay_status === "ON" ? "online" : "offline",
            relayStatus: safeString(rawVehicle.relay_status),
            licensePlate: safeString(rawVehicle.license_plate),
            make: safeString(rawVehicle.make),
            model: safeString(rawVehicle.model),
            year: safeNumber(rawVehicle.year),
            gpsId: safeString(rawVehicle.gps_id)
          };
          
          processedVehicles.push(vehicle);
          console.log(`✅ Added vehicle ${i + 1}: ${vehicle.name} (${vehicle.id}) - Relay: ${vehicle.relayStatus || 'Unknown'}`);
        } catch (error) {
          console.error(`❌ Error processing vehicle ${i + 1}:`, error);
          // Continue with next vehicle instead of stopping
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

  // Fetch command history
  const fetchCommandHistory = async () => {
    try {
      console.log('📜 Fetching command history...');
      const response = await fetch(`${API_BASE_URL}/items/commands?sort=-date_created`);
      
      if (!response.ok) {
        console.warn('⚠️ Failed to fetch command history, using sample data');
        setSampleCommandHistory();
        return;
      }
      
      const data = await response.json();
      console.log('📦 Raw command history:', data);
      
      if (!data || !data.data || !Array.isArray(data.data)) {
        console.warn('⚠️ Invalid command history structure, using sample data');
        setSampleCommandHistory();
        return;
      }
      
      // Process command history safely
      const processedHistory: CommandHistory[] = [];
      
      for (let i = 0; i < data.data.length; i++) {
        try {
          const cmd = data.data[i];
          if (!cmd) continue;
          
          const processedCmd: CommandHistory = {
            id: safeNumber(cmd.id || cmd.command_id, i),
            vehicle: safeString(cmd.vehicle_id) || getVehicleNameById(safeString(cmd.vehicle_id)) || 'Unknown',
            command: safeString(cmd.command_type || cmd.command, 'unknown'),
            status: ['completed', 'pending', 'failed'].includes(safeString(cmd.status)) 
              ? cmd.status 
              : 'pending',
            issuedBy: safeString(cmd.issued_by || cmd.user_id, 'System'),
            timestamp: safeString(cmd.date_created || cmd.timestamp, new Date().toISOString()),
            executedAt: cmd.date_executed || cmd.executed_at ? safeString(cmd.date_executed || cmd.executed_at) : null
          };
          
          processedHistory.push(processedCmd);
        } catch (error) {
          console.error(`❌ Error processing command ${i + 1}:`, error);
        }
      }
      
      console.log(`✅ Processed ${processedHistory.length} command history items`);
      setCommandHistory(processedHistory);
      
    } catch (error) {
      console.error('❌ Error fetching command history:', error);
      setSampleCommandHistory();
    }
  };

  // Set sample command history data
  const setSampleCommandHistory = () => {
    console.log('📋 Using sample command history data');
    setCommandHistory([
      {
        id: 1,
        vehicle: "Truck-001",
        command: "engine_off",
        status: "completed",
        issuedBy: "Admin",
        timestamp: "2024-01-25 14:30:25",
        executedAt: "2024-01-25 14:30:28"
      },
      {
        id: 2,
        vehicle: "Van-003",
        command: "engine_on",
        status: "completed",
        issuedBy: "Manager",
        timestamp: "2024-01-25 13:45:12",
        executedAt: "2024-01-25 13:45:15"
      },
      {
        id: 3,
        vehicle: "Car-002",
        command: "engine_off",
        status: "pending",
        issuedBy: "Admin",
        timestamp: "2024-01-25 12:15:08",
        executedAt: null
      },
      {
        id: 4,
        vehicle: "Truck-002",
        command: "engine_on",
        status: "failed",
        issuedBy: "Operator",
        timestamp: "2024-01-25 11:22:45",
        executedAt: null
      },
      {
        id: 5,
        vehicle: "Van-003",
        command: "engine_off",
        status: "completed",
        issuedBy: "Admin",
        timestamp: "2024-01-25 10:30:15",
        executedAt: "2024-01-25 10:30:18"
      }
    ]);
  };

  // Helper function to get vehicle name by ID
  const getVehicleNameById = (id: string): string => {
    if (!id) return 'Unknown';
    
    try {
      const vehicle = vehicles.find(v => v && v.id === id);
      return vehicle ? vehicle.name : `Vehicle-${id}`;
    } catch {
      return `Vehicle-${id}`;
    }
  };

  // Initialize data
  React.useEffect(() => {
    console.log('🚀 Initializing CommandCenter...');
    
    // Get current user
    try {
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        console.log('👤 Current user loaded:', user);
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('❌ Error loading user:', error);
    }
    
    // Load data
    const loadData = async () => {
      await fetchVehicles();
      await fetchCommandHistory();
    };
    
    loadData();
  }, []);

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

  const getCommandIcon = (command: string): React.ReactNode => {
    switch (command) {
      case 'engine_off':
        return <PowerOff className="w-4 h-4 text-red-500" />;
      case 'engine_on':
        return <Power className="w-4 h-4 text-green-500" />;
      default:
        return <CommandIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatCommandName = (command: string): string => {
    if (!command) return 'Unknown';
    return command.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSendCommand = async () => {
    if (!selectedVehicle || !selectedCommand) {
      alert('Please select a vehicle and command first');
      return;
    }

    if (!currentUser) {
      alert('Please login first');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get user ID with fallback options
      const userId = currentUser.id || currentUser.user_id || currentUser._id || currentUser.ID || 'Unknown';
      
      // First, update the command history to track the action
      const commandData = {
        vehicle_id: selectedVehicle,
        command_type: selectedCommand,
        issued_by: safeString(userId),
        status: 'pending',
        date_created: new Date().toISOString(),
        date_executed: null
      };
      
      console.log('📤 Recording command in history:', commandData);
      
      // Send command to command history API
      const historyResponse = await fetch(`${API_BASE_URL}/items/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandData),
      });
      
      if (!historyResponse.ok) {
        throw new Error(`Failed to record command: ${historyResponse.status} ${historyResponse.statusText}`);
      }
      
      // Now, update the vehicle's relay status
      const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
      if (!selectedVehicleObj) {
        throw new Error(`Vehicle not found: ${selectedVehicle}`);
      }
      
      const newRelayStatus = selectedCommand === 'RELAY_ON' ? 'ON' : 'OFF';
      
      console.log(`📤 Updating vehicle ${selectedVehicle} relay status to ${newRelayStatus}`);
      
      // Update the vehicle record with the new relay status
      const vehicleUpdateResponse = await fetch(`${API_BASE_URL}/items/vehicle/${selectedVehicle}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relay_status: newRelayStatus
        }),
      });
      
      if (!vehicleUpdateResponse.ok) {
        throw new Error(`Failed to update vehicle: ${vehicleUpdateResponse.status} ${vehicleUpdateResponse.statusText}`);
      }
      
      const vehicleResult = await vehicleUpdateResponse.json();
      console.log('✅ Vehicle updated successfully:', vehicleResult);
      
      // Mark the command as completed
      const historyResult = await historyResponse.json();
      if (historyResult && historyResult.data && historyResult.data.id) {
        const commandId = historyResult.data.id;
        const updateResponse = await fetch(`${API_BASE_URL}/items/commands/${commandId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            date_executed: new Date().toISOString()
          }),
        });
        
        if (!updateResponse.ok) {
          console.warn('⚠️ Failed to update command status to completed');
        }
      }
      
      toast.success(`Command ${formatCommandName(selectedCommand)} sent successfully to ${getVehicleNameById(selectedVehicle)}`);
      
      // Reset selections after sending
      setSelectedVehicle("");
      setSelectedCommand("");
      
      // Refresh vehicle data and command history
      await Promise.all([
        fetchVehicles(),
        fetchCommandHistory()
      ]);
      
    } catch (error) {
      console.error('❌ Error sending command:', error);
      
      let errorMessage = 'Failed to send command. ';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += 'Please check your internet connection.';
        } else if (error.message.includes('500')) {
          errorMessage += 'Server error. Please try again later.';
        } else if (error.message.includes('400')) {
          errorMessage += 'Invalid command data. Please try again.';
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
  };

  // Safe rendering for vehicle options
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

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return (
        <SelectItem value="no-vehicles" disabled>
          No vehicles available
        </SelectItem>
      );
    }

    // Safe rendering of vehicles
    const vehicleItems = [];
    for (let i = 0; i < vehicles.length; i++) {
      try {
        const vehicle = vehicles[i];
        if (!vehicle) continue;

        const vehicleId = safeString(vehicle.id);
        const vehicleName = safeString(vehicle.name, 'Unknown Vehicle');
        const vehicleDetails = vehicle.make && vehicle.model 
          ? `${vehicle.make} ${vehicle.model}` 
          : vehicle.licensePlate || '';
        const vehicleStatus = vehicle.status || 'offline';

        if (!vehicleId) continue;

        // Determine relay status badge appearance
        let relayStatusBadge = null;
        if (vehicle.relayStatus) {
          const isOn = vehicle.relayStatus === 'ON';
          relayStatusBadge = (
            <Badge 
              variant="outline" 
              className={`text-xs ml-1 ${isOn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {isOn ? 'Engine ON' : 'Engine OFF'}
            </Badge>
          );
        }

        vehicleItems.push(
          <SelectItem 
            key={`vehicle-${i}-${vehicleId}`}
            value={vehicleId} 
            disabled={false} // Allow all vehicles to be selected for commands
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                <span className="font-medium">{vehicleName}</span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    vehicleStatus === 'online' 
                      ? 'text-green-600 border-green-200' 
                      : 'text-red-600 border-red-200'
                  }`}
                >
                  {vehicleStatus}
                </Badge>
                {relayStatusBadge}
              </div>
              {vehicleDetails && (
                <div className="text-xs text-gray-500 pl-6">{vehicleDetails}</div>
              )}
            </div>
          </SelectItem>
        );
      } catch (error) {
        console.error(`❌ Error rendering vehicle ${i}:`, error);
      }
    }

    return vehicleItems.length > 0 ? vehicleItems : (
      <SelectItem value="no-valid-vehicles" disabled>
        No valid vehicles found
      </SelectItem>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Command Center</h1>
          <p className="text-slate-600">Send commands and control vehicle operations remotely</p>
        </div>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Command History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!Array.isArray(commandHistory) || commandHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <CommandIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No command history available</p>
                  </div>
                ) : (
                  commandHistory.map((cmd, index) => {
                    if (!cmd) return null;
                    
                    return (
                      <div key={`cmd-${index}-${cmd.id}`} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="p-2 rounded-lg bg-slate-100">
                          {getCommandIcon(cmd.command)}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-slate-800">{safeString(cmd.vehicle, 'Unknown')}</h4>
                              <Badge variant="outline" className="text-xs">
                                {formatCommandName(cmd.command)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(cmd.status)}
                              <Badge className={getStatusColor(cmd.status)}>
                                {cmd.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-500">
                            <div>
                              <p className="text-slate-400">Issued by</p>
                              <p className="font-medium text-slate-600">{safeString(cmd.issuedBy, 'Unknown')}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Sent at</p>
                              <p className="font-medium text-slate-600">{safeString(cmd.timestamp, 'Unknown')}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Executed at</p>
                              <p className="font-medium text-slate-600">
                                {cmd.executedAt ? safeString(cmd.executedAt) : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {Array.isArray(commandHistory) ? commandHistory.filter(cmd => cmd && cmd.status === 'completed').length : 0}
                </p>
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
                <p className="text-2xl font-bold text-yellow-600">
                  {Array.isArray(commandHistory) ? commandHistory.filter(cmd => cmd && cmd.status === 'pending').length : 0}
                </p>
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
                <p className="text-2xl font-bold text-red-600">
                  {Array.isArray(commandHistory) ? commandHistory.filter(cmd => cmd && cmd.status === 'failed').length : 0}
                </p>
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
                <p className="text-2xl font-bold text-blue-600">
                  {Array.isArray(vehicles) ? vehicles.filter(v => v && v.status === 'online').length : 0}
                </p>
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