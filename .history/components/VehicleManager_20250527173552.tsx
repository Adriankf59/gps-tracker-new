"use client"; // Menandakan ini adalah komponen client-side

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Car, 
  Search, 
  Plus, 
  MapPin, 
  Fuel, 
  Zap,
  Settings,
  Eye,
  Edit,
  Trash2
} from "lucide-react";

// Definisikan interface untuk tipe kendaraan
interface Vehicle {
  id: number;
  name: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  status: string;
  location: string;
  speed: string;
  fuel: number;
  battery: number;
  simCard: string;
  lastUpdate: string;
}

export function VehicleManager() {
  const [searchTerm, setSearchTerm] = useState("");

  // Data kendaraan (dalam aplikasi nyata, ini mungkin berasal dari API)
  const vehicles: Vehicle[] = [
    {
      id: 1,
      name: "Truck-001",
      licensePlate: "B 1234 ABC",
      make: "Isuzu",
      model: "ELF",
      year: 2022,
      status: "online",
      location: "Jl. Sudirman, Jakarta",
      speed: "45 km/h",
      fuel: 78,
      battery: 92,
      simCard: "081234567890",
      lastUpdate: "2 minutes ago"
    },
    {
      id: 2,
      name: "Van-003",
      licensePlate: "B 5678 DEF",
      make: "Daihatsu",
      model: "Gran Max",
      year: 2021,
      status: "parked",
      location: "Jl. Gatot Subroto, Jakarta",
      speed: "0 km/h",
      fuel: 45,
      battery: 88,
      simCard: "081234567891",
      lastUpdate: "1 minute ago"
    },
    {
      id: 3,
      name: "Car-002",
      licensePlate: "B 9012 GHI",
      make: "Toyota",
      model: "Avanza",
      year: 2023,
      status: "moving",
      location: "Jl. Thamrin, Jakarta",
      speed: "32 km/h",
      fuel: 89,
      battery: 95,
      simCard: "081234567892",
      lastUpdate: "30 seconds ago"
    },
    {
      id: 4,
      name: "Truck-002",
      licensePlate: "B 3456 JKL",
      make: "Mitsubishi",
      model: "Fuso",
      year: 2020,
      status: "offline",
      location: "Last seen: Jl. Casablanca",
      speed: "0 km/h",
      fuel: 15,
      battery: 45,
      simCard: "081234567893",
      lastUpdate: "2 hours ago"
    }
  ];

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.make.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'moving':
        return 'bg-blue-100 text-blue-700 border-blue-200';
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
          <h1 className="text-2xl font-bold text-slate-800">Vehicle Management</h1>
          <p className="text-slate-600">Manage and monitor your vehicle fleet</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>
      
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search vehicles by name, license plate, or make..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Car className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{vehicle.name}</CardTitle>
                    <p className="text-sm text-slate-500">{vehicle.licensePlate}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(vehicle.status)}>
                  {vehicle.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vehicle Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Make & Model</p>
                  <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                </div>
                <div>
                  <p className="text-slate-500">Year</p>
                  <p className="font-medium">{vehicle.year}</p>
                </div>
              </div>
              
              {/* Location */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <MapPin className="w-4 h-4 text-slate-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{vehicle.location}</p>
                  <p className="text-xs text-slate-500">Speed: {vehicle.speed}</p>
                </div>
              </div>
              
              {/* Status Indicators */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Fuel className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{vehicle.fuel}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{vehicle.battery}%</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{vehicle.lastUpdate}</p>
              </div>
              
              {/* SIM Card Info */}
              <div className="text-xs text-slate-500 border-t pt-3">
                SIM Card: {vehicle.simCard}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-3 h-3 mr-1" />
                  Track
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredVehicles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No vehicles found</h3>
            <p className="text-slate-500">Try adjusting your search criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}