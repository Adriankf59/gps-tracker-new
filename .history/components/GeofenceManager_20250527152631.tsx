"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Navigation, 
  Car,
  Fuel,
  Zap,
  Gauge,
  Clock,
  Satellite
} from "lucide-react";

interface Vehicle {
  id: number;
  name: string;
  licensePlate: string;
  status: "moving" | "parked" | "offline";
  location: string;
  coordinates: string;
  speed: number;
  heading: string;
  fuel: number;
  battery: number;
  rpm: number;
  satellites: number;
  lastUpdate: string;
  driver: string;
}

export  function LiveTracking() {
  const trackingData: Vehicle[] = [
    {
      id: 1,
      name: "Truck-001",
      licensePlate: "B 1234 ABC",
      status: "moving",
      location: "Jl. Sudirman No.45, Jakarta Pusat",
      coordinates: "-6.2088, 106.8456",
      speed: 45,
      heading: "NE",
      fuel: 78,
      battery: 92,
      rpm: 2100,
      satellites: 12,
      lastUpdate: "Real-time",
      driver: "Ahmad Rahman"
    },
    {
      id: 2,
      name: "Van-003",
      licensePlate: "B 5678 DEF",
      status: "parked",
      location: "Jl. Gatot Subroto No.122, Jakarta Selatan",
      coordinates: "-6.2297, 106.8197",
      speed: 0,
      heading: "N",
      fuel: 45,
      battery: 88,
      rpm: 0,
      satellites: 10,
      lastUpdate: "30 seconds ago",
      driver: "Budi Santoso"
    },
    {
      id: 3,
      name: "Car-002",
      licensePlate: "B 9012 GHI",
      status: "moving",
      location: "Jl. M.H. Thamrin No.88, Jakarta Pusat",
      coordinates: "-6.1944, 106.8229",
      speed: 32,
      heading: "SW",
      fuel: 89,
      battery: 95,
      rpm: 1800,
      satellites: 11,
      lastUpdate: "Real-time",
      driver: "Siti Nurhaliza"
    }
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'moving':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'parked':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'offline':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Live Tracking</h1>
          <p className="text-slate-600">Real-time monitoring of your vehicle fleet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Navigation className="w-4 h-4 mr-2" />
            Center Map
          </Button>
          <Button className="bg-green-600 hover:bg-green-700">
            <MapPin className="w-4 h-4 mr-2" />
            Track All
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Live Map View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-200 relative overflow-hidden">
                {/* Map Placeholder */}
                <div className="text-center z-10">
                  <MapPin className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-blue-600 mb-2">Interactive Tracking Map</h3>
                  <p className="text-blue-500 mb-4">Real-time vehicle positions and routes</p>
                  <div className="flex items-center justify-center gap-4 text-sm text-blue-400">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      Moving ({trackingData.filter(v => v.status === 'moving').length})
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      Parked ({trackingData.filter(v => v.status === 'parked').length})
                    </span>
                  </div>
                </div>
                
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-4 left-4 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                  <div className="absolute top-12 right-8 w-2 h-2 bg-green-500 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                  <div className="absolute bottom-8 left-12 w-2 h-2 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Vehicle List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trackingData.map((vehicle) => (
                <div key={vehicle.id} className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-slate-800">{vehicle.name}</span>
                    </div>
                    <Badge className={getStatusColor(vehicle.status)}>
                      {vehicle.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-slate-500">Driver</p>
                      <p className="font-medium">{vehicle.driver}</p>
                    </div>
                    
                    <div>
                      <p className="text-slate-500">Location</p>
                      <p className="text-slate-700">{vehicle.location}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-blue-500" />
                        <span>{vehicle.speed} km/h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-green-500" />
                        <span>{vehicle.heading}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-orange-500" />
                        <span>{vehicle.fuel}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-green-500" />
                        <span>{vehicle.battery}%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Satellite className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{vehicle.satellites} satellites</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{vehicle.lastUpdate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {trackingData.filter(v => v.status === 'moving').length}
                </p>
                <p className="text-sm text-slate-600">Moving</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {trackingData.filter(v => v.status === 'parked').length}
                </p>
                <p className="text-sm text-slate-600">Parked</p>
              </div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(trackingData.reduce((acc, v) => acc + v.speed, 0) / trackingData.length)}
                </p>
                <p className="text-sm text-slate-600">Avg Speed (km/h)</p>
              </div>
              <Gauge className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {Math.round(trackingData.reduce((acc, v) => acc + v.fuel, 0) / trackingData.length)}
                </p>
                <p className="text-sm text-slate-600">Avg Fuel (%)</p>
              </div>
              <Fuel className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}