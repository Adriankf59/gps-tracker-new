"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Command as CommandIcon, 
  Power, 
  PowerOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Car,
  Send
} from "lucide-react";

interface Vehicle {
  id: string;
  name: string;
  status: "online" | "offline";
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

export default function CommandCenter() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedCommand, setSelectedCommand] = useState<string>("");

  const vehicles: Vehicle[] = [
    { id: "1", name: "Truck-001", status: "online" },
    { id: "2", name: "Van-003", status: "online" },
    { id: "3", name: "Car-002", status: "online" },
    { id: "4", name: "Truck-002", status: "offline" }
  ];

  const commandHistory: CommandHistory[] = [
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
  ];

  const availableCommands: Command[] = [
    { value: "engine_off", label: "Turn Engine Off", icon: PowerOff, color: "red" },
    { value: "engine_on", label: "Turn Engine On", icon: Power, color: "green" }
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
    return command.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSendCommand = (): void => {
    if (selectedVehicle && selectedCommand) {
      console.log(`Sending ${selectedCommand} command to ${selectedVehicle}`);
      // Here you would typically make an API call to send the command
      setSelectedVehicle("");
      setSelectedCommand("");
    }
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
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.name} disabled={vehicle.status === 'offline'}>
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4" />
                          <span>{vehicle.name}</span>
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
                        </div>
                      </SelectItem>
                    ))}
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
                disabled={!selectedVehicle || !selectedCommand}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Command
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
                {commandHistory.map((cmd) => (
                  <div key={cmd.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="p-2 rounded-lg bg-slate-100">
                      {getCommandIcon(cmd.command)}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-800">{cmd.vehicle}</h4>
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
                          <p className="font-medium text-slate-600">{cmd.issuedBy}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Sent at</p>
                          <p className="font-medium text-slate-600">{cmd.timestamp}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Executed at</p>
                          <p className="font-medium text-slate-600">
                            {cmd.executedAt || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                  {commandHistory.filter(cmd => cmd.status === 'completed').length}
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
                  {commandHistory.filter(cmd => cmd.status === 'pending').length}
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
                  {commandHistory.filter(cmd => cmd.status === 'failed').length}
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
                  {vehicles.filter(v => v.status === 'online').length}
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