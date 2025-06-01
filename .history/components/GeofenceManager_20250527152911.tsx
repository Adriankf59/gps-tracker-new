"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  Search, 
  Plus, 
  MapPin, 
  Edit,
  Trash2,
  Eye,
  Circle,
  Square
} from "lucide-react";

interface Geofence {
  id: number;
  name: string;
  type: "circle" | "polygon";
  ruleType: "standard" | "forbidden" | "stay_in";
  status: "active" | "inactive";
  vehicles: number;
  center: string;
  radius: string;
  description: string;
  createdDate: string;
  events: number;
}

export function GeofenceManager() {
  const [searchTerm, setSearchTerm] = useState("");

  const geofences: Geofence[] = [
    {
      id: 1,
      name: "Warehouse A",
      type: "circle",
      ruleType: "standard",
      status: "active",
      vehicles: 2,
      center: "-6.2088, 106.8456",
      radius: "500m",
      description: "Main warehouse facility in Jakarta",
      createdDate: "2024-01-15",
      events: 45
    },
    {
      id: 2,
      name: "Restricted Zone",
      type: "polygon",
      ruleType: "forbidden",
      status: "active",
      vehicles: 0,
      center: "-6.1944, 106.8229",
      radius: "N/A",
      description: "Prohibited area for all vehicles",
      createdDate: "2024-01-20",
      events: 8
    },
    {
      id: 3,
      name: "Customer Site B",
      type: "circle",
      ruleType: "stay_in",
      status: "active",
      vehicles: 1,
      center: "-6.2297, 106.8197",
      radius: "300m",
      description: "Customer delivery location",
      createdDate: "2024-02-01",
      events: 23
    },
    {
      id: 4,
      name: "Service Center",
      type: "polygon",
      ruleType: "standard",
      status: "inactive",
      vehicles: 0,
      center: "-6.2500, 106.8300",
      radius: "N/A",
      description: "Vehicle maintenance facility",
      createdDate: "2024-01-10",
      events: 12
    }
  ];

  const filteredGeofences = geofences.filter(geofence =>
    geofence.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    geofence.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'forbidden':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'stay_in':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'standard':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatRuleType = (ruleType: string) => {
    switch (ruleType) {
      case 'forbidden':
        return 'Forbidden';
      case 'stay_in':
        return 'Stay In';
      case 'standard':
        return 'Standard';
      default:
        return ruleType;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Geofence Management</h1>
          <p className="text-slate-600">Create and manage geographic boundaries for your fleet</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Geofence
        </Button>
      </div>
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search geofences by name or description..."
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
                <p className="text-2xl font-bold text-blue-600">
                  {geofences.filter(g => g.status === 'active').length}
                </p>
                <p className="text-sm text-slate-600">Active Geofences</p>
              </div>
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {geofences.filter(g => g.ruleType === 'forbidden').length}
                </p>
                <p className="text-sm text-slate-600">Forbidden Zones</p>
              </div>
              <Circle className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {geofences.reduce((acc, g) => acc + g.vehicles, 0)}
                </p>
                <p className="text-sm text-slate-600">Vehicles Inside</p>
              </div>
              <MapPin className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {geofences.reduce((acc, g) => acc + g.events, 0)}
                </p>
                <p className="text-sm text-slate-600">Total Events</p>
              </div>
              <Eye className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Geofence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredGeofences.map((geofence) => (
          <Card key={geofence.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    {geofence.type === 'circle' ? (
                      <Circle className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{geofence.name}</CardTitle>
                    <p className="text-sm text-slate-500 capitalize">{geofence.type} geofence</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatusColor(geofence.status)}>
                    {geofence.status}
                  </Badge>
                  <Badge className={getRuleTypeColor(geofence.ruleType)}>
                    {formatRuleType(geofence.ruleType)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              <p className="text-sm text-slate-600">{geofence.description}</p>
              {/* Location Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Center Coordinates</p>
                  <p className="font-mono text-xs">{geofence.center}</p>
                </div>
                <div>
                  <p className="text-slate-500">Radius/Size</p>
                  <p className="font-medium">{geofence.radius}</p>
                </div>
              </div>
              {/* Statistics */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{geofence.vehicles}</p>
                  <p className="text-xs text-slate-500">Vehicles Inside</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{geofence.events}</p>
                  <p className="text-xs text-slate-500">Events</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">{geofence.createdDate}</p>
                  <p className="text-xs text-slate-500">Created</p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filteredGeofences.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No geofences found</h3>
            <p className="text-slate-500">Try adjusting your search criteria or create a new geofence</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}