"use client";

import { useState, useRef, useEffect } from "react";
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
  Square,
  Save,
  X
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, useMap, FeatureGroup, Circle as LeafletCircle, Polygon } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

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

interface GeofenceData {
  geofence_id?: number; // Optional as it will be auto-incremented by the API
  user_id: string;
  name: string;
  type: string;
  definition: {
    coordinates: number[][][];
    type: string;
  } | {
    center: number[];
    radius: number;
    type: string;
  };
  rule_type: string;
  status: string;
  date_created: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  // Add other user properties as needed
}

// Map center coordinates (Indonesia)
const DEFAULT_CENTER = [-6.2088, 106.8456];
const API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';

// Component to control draw mode
function DrawControl({ drawMode, onCreated, onEdited, onDeleted, ruleType }) {
  const map = useMap();
  const featureGroupRef = useRef(null);
  
  useEffect(() => {
    if (featureGroupRef.current) {
      // Clear existing drawings when draw mode changes
      featureGroupRef.current.clearLayers();
    }
  }, [drawMode]);

  const drawOptions = {
    position: 'topright',
    draw: {
      polyline: false,
      rectangle: false,
      circlemarker: false,
      marker: false,
      polygon: drawMode === 'polygon',
      circle: drawMode === 'circle',
    },
    edit: {
      featureGroup: featureGroupRef.current,
      remove: true,
      edit: true,
    },
  };

  return (
    <FeatureGroup ref={featureGroupRef}>
      <EditControl
        position="topright"
        onCreated={onCreated}
        onEdited={onEdited}
        onDeleted={onDeleted}
        draw={drawOptions.draw}
        edit={drawOptions.edit}
      />
      {/* Apply different styles based on rule type */}
      <style jsx global>{`
        .leaflet-draw-draw-polygon {
          background-color: ${ruleType === 'forbidden' ? '#fee2e2' : '#dbeafe'};
        }
        .leaflet-draw-draw-circle {
          background-color: ${ruleType === 'forbidden' ? '#fee2e2' : '#dbeafe'};
        }
      `}</style>
    </FeatureGroup>
  );
}

// Component to display a saved geofence
function GeofenceDisplay({ geofence }) {
  if (!geofence) return null;
  
  // For demo purposes, we'll create some mock data for visualization
  // In a real app, you would use the actual stored coordinates
  
  if (geofence.type === 'circle') {
    // Parse center coordinates
    const centerParts = geofence.center.split(',');
    const center = [parseFloat(centerParts[0]), parseFloat(centerParts[1])];
    // Parse radius (remove 'm' and convert to number)
    const radius = parseInt(geofence.radius.replace('m', ''));
    
    const fillColor = geofence.ruleType === 'forbidden' ? '#ef4444' : '#3b82f6';
    
    return (
      <LeafletCircle
        center={center}
        radius={radius}
        pathOptions={{
          fillColor: fillColor,
          fillOpacity: 0.2,
          color: fillColor,
          weight: 2
        }}
      >
        <Popup>
          <strong>{geofence.name}</strong><br />
          {geofence.description}
        </Popup>
      </LeafletCircle>
    );
  } else if (geofence.type === 'polygon') {
    // For demo, create a simple polygon around the center
    // In a real app, you would use the actual polygon coordinates
    const centerParts = geofence.center.split(',');
    const center = [parseFloat(centerParts[0]), parseFloat(centerParts[1])];
    
    // Create a simple polygon around the center point
    const positions = [
      [center[0] - 0.01, center[1] - 0.01],
      [center[0] - 0.01, center[1] + 0.01],
      [center[0] + 0.01, center[1] + 0.01],
      [center[0] + 0.01, center[1] - 0.01]
    ];
    
    const fillColor = geofence.ruleType === 'forbidden' ? '#ef4444' : '#3b82f6';
    
    return (
      <Polygon
        positions={positions}
        pathOptions={{
          fillColor: fillColor,
          fillOpacity: 0.2,
          color: fillColor,
          weight: 2
        }}
      >
        <Popup>
          <strong>{geofence.name}</strong><br />
          {geofence.description}
        </Popup>
      </Polygon>
    );
  }
  
  return null;
}

export function GeofenceManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    description: "",
    ruleType: "forbidden",
    type: "polygon"
  });
  const [drawMode, setDrawMode] = useState<"polygon" | "circle">("polygon");
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Load user from session storage on component mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Error loading user from session storage:', error);
      }
    };
    
    loadUser();
  }, []);
  
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

  const handleCreateGeofence = () => {
    // Check if user is logged in
    if (!currentUser) {
      toast({
        title: "Error",
        description: "Anda harus login terlebih dahulu untuk membuat geofence",
        variant: "destructive"
      });
      return;
    }
    
    setDrawnLayers([]);
    setNewGeofence({
      name: "",
      description: "",
      ruleType: "forbidden",
      type: "polygon"
    });
    setDrawMode("polygon");
    setIsMapDialogOpen(true);
  };

  const handleViewGeofence = (geofence: Geofence) => {
    setCurrentGeofence(geofence);
    setIsViewDialogOpen(true);
  };

  const handleDrawModeChange = (mode: "polygon" | "circle") => {
    setDrawMode(mode);
    setNewGeofence({...newGeofence, type: mode});
  };

  const handleDrawCreated = (e) => {
    const { layerType, layer } = e;
    
    // Store the layer for later use
    setDrawnLayers([layer]);
    
    // Update the geofence type based on what was drawn
    if (layerType === 'circle') {
      setNewGeofence({...newGeofence, type: 'circle'});
      setDrawMode('circle');
    } else if (layerType === 'polygon') {
      setNewGeofence({...newGeofence, type: 'polygon'});
      setDrawMode('polygon');
    }
  };

  const handleDrawEdited = (e) => {
    const layers = e.layers;
    // Update drawn layers
    const editedLayers = [];
    layers.eachLayer((layer) => {
      editedLayers.push(layer);
    });
    setDrawnLayers(editedLayers);
  };

  const handleDrawDeleted = () => {
    setDrawnLayers([]);
  };

  const handleSaveGeofence = async () => {
    // Check if user is logged in
    if (!currentUser) {
      toast({
        title: "Error",
        description: "Anda harus login terlebih dahulu untuk membuat geofence",
        variant: "destructive"
      });
      return;
    }

    if (!newGeofence.name) {
      toast({
        title: "Error",
        description: "Silakan masukkan nama untuk geofence",
        variant: "destructive"
      });
      return;
    }

    if (drawnLayers.length === 0) {
      toast({
        title: "Error",
        description: "Silakan gambar geofence pada peta",
        variant: "destructive"
      });
      return;
    }

    try {
      const layer = drawnLayers[0];
      let geofenceData: GeofenceData;
      
      if (drawMode === "polygon") {
        // Extract polygon coordinates
        const latLngs = layer.getLatLngs()[0];
        const coordinates = latLngs.map(latLng => [latLng.lng, latLng.lat]);
        // Close the polygon by repeating the first point
        coordinates.push(coordinates[0]);
        
        geofenceData = {
          // Don't include geofence_id, let the API auto-increment it
          user_id: currentUser.id, // Use the logged-in user's ID
          name: newGeofence.name,
          type: "polygon",
          definition: {
            coordinates: [[coordinates]],
            type: "Polygon"
          },
          rule_type: newGeofence.ruleType.toUpperCase(),
          status: "active",
          date_created: new Date().toISOString()
        };
      } else {
        // Extract circle center and radius
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
                geofenceData = {
          // Don't include geofence_id, let the API auto-increment it
          user_id: currentUser.id, // Use the logged-in user's ID
          name: newGeofence.name,
          type: "circle",
          definition: {
            center: [center.lng, center.lat],
            radius: radius,
            type: "Circle"
          },
          rule_type: newGeofence.ruleType.toUpperCase(),
          status: "active",
          date_created: new Date().toISOString()
        };
      }

      // Send to API
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [geofenceData] }),
      });

      if (!response.ok) {
        throw new Error('Failed to save geofence');
      }

      toast({
        title: "Success",
        description: "Geofence berhasil disimpan",
      });

      setIsMapDialogOpen(false);
      
      // Optionally refresh the geofence list here
      // fetchGeofences();
      
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan geofence. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  };
  
  // Function to fetch geofences from API (to be implemented)
  const fetchGeofences = async () => {
    try {
      // Check if user is logged in
      if (!currentUser) return;
      
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${currentUser.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch geofences');
      }
      
      const data = await response.json();
      // Process and set geofences data
      // This would replace the static geofences array
      
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data geofence",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Geofence Management</h1>
          <p className="text-slate-600">Buat dan kelola batas geografis untuk armada Anda</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={handleCreateGeofence}
        >
          <Plus className="w-4 h-4 mr-2" />
          Buat Geofence
        </Button>
      </div>
      
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari geofence berdasarkan nama atau deskripsi..."
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
                <p className="text-sm text-slate-600">Geofence Aktif</p>
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
                <p className="text-sm text-slate-600">Zona Terlarang</p>
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
                <p className="text-sm text-slate-600">Kendaraan di Dalam</p>
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
                <p className="text-sm text-slate-600">Total Kejadian</p>
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
                    <p className="text-sm text-slate-500 capitalize">{geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'} geofence</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatusColor(geofence.status)}>
                    {geofence.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                  </Badge>
                  <Badge className={getRuleTypeColor(geofence.ruleType)}>
                    {geofence.ruleType === 'forbidden' ? 'Terlarang' : 
                     geofence.ruleType === 'stay_in' ? 'Tetap di Dalam' : 'Standar'}
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
                  <p className="text-slate-500">Koordinat Pusat</p>
                  <p className="font-mono text-xs">{geofence.center}</p>
                </div>
                <div>
                  <p className="text-slate-500">Radius/Ukuran</p>
                  <p className="font-medium">{geofence.radius}</p>
                </div>
              </div>
              {/* Statistics */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{geofence.vehicles}</p>
                  <p className="text-xs text-slate-500">Kendaraan di Dalam</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{geofence.events}</p>
                  <p className="text-xs text-slate-500">Kejadian</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">{geofence.createdDate}</p>
                  <p className="text-xs text-slate-500">Dibuat</p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleViewGeofence(geofence)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Lihat
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
            <h3 className="text-lg font-medium text-slate-600 mb-2">Tidak ada geofence ditemukan</h3>
            <p className="text-slate-500">Coba sesuaikan kriteria pencarian atau buat geofence baru</p>
          </CardContent>
        </Card>
      )}

      {/* Create Geofence Dialog */}
      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Buat Geofence Baru</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
            {/* Form Panel */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nama</label>
                <Input 
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                  placeholder="Masukkan nama geofence"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Deskripsi</label>
                <Textarea 
                  value={newGeofence.description}
                  onChange={(e) => setNewGeofence({...newGeofence, description: e.target.value})}
                  placeholder="Masukkan deskripsi"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Tipe Geofence</label>
                <div className="flex gap-2 mt-1">
                  <Button 
                    type="button"
                    variant={drawMode === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDrawModeChange("polygon")}
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Poligon
                  </Button>
                  <Button 
                    type="button"
                    variant={drawMode === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDrawModeChange("circle")}
                    className="flex-1"
                  >
                    <Circle className="w-4 h-4 mr-2" />
                    Lingkaran
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Tipe Aturan</label>
                <Select 
                  value={newGeofence.ruleType}
                  onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe aturan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forbidden">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        Zona Terlarang
                      </div>
                    </SelectItem>
                    <SelectItem value="stay_in">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        Area Tetap di Dalam
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Petunjuk</h4>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                  <li>Pilih tipe geofence (Poligon atau Lingkaran)</li>
                  <li>Gambar bentuk pada peta</li>
                  <li>Pilih tipe aturan (Terlarang atau Tetap di Dalam)</li>
                  <li>Masukkan nama dan deskripsi</li>
                  <li>Klik Simpan untuk membuat geofence</li>
                </ol>
              </div>
            </div>
            
            {/* Map Panel */}
            <div className="col-span-2 h-full min-h-[400px] border rounded-md overflow-hidden">
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={10}
                style={{ width: '100%', height: '100%' }}
              >
                                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <DrawControl 
                  drawMode={drawMode}
                  onCreated={handleDrawCreated}
                  onEdited={handleDrawEdited}
                  onDeleted={handleDrawDeleted}
                  ruleType={newGeofence.ruleType}
                />
              </MapContainer>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMapDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleSaveGeofence}
              className={`${newGeofence.ruleType === 'forbidden' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              <Save className="w-4 h-4 mr-2" />
              Simpan Geofence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Geofence Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {currentGeofence?.name}
              <Badge className={`ml-2 ${getRuleTypeColor(currentGeofence?.ruleType || '')}`}>
                {currentGeofence?.ruleType === 'forbidden' ? 'Terlarang' : 
                 currentGeofence?.ruleType === 'stay_in' ? 'Tetap di Dalam' : 'Standar'}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
            {/* Info Panel */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-500">Deskripsi</h3>
                <p className="text-sm">{currentGeofence?.description}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-slate-500">Tipe</h3>
                <div className="flex items-center">
                  {currentGeofence?.type === 'circle' ? (
                    <Circle className="w-4 h-4 mr-2 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 mr-2 text-blue-600" />
                  )}
                  <span className="capitalize">{currentGeofence?.type === 'circle' ? 'Lingkaran' : 'Poligon'}</span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-slate-500">Pusat</h3>
                <p className="font-mono text-xs">{currentGeofence?.center}</p>
              </div>
              
              {currentGeofence?.type === 'circle' && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500">Radius</h3>
                  <p>{currentGeofence?.radius}</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-slate-500">Dibuat</h3>
                <p>{currentGeofence?.createdDate}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-slate-500">Status</h3>
                <Badge className={getStatusColor(currentGeofence?.status || '')}>
                  {currentGeofence?.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                </Badge>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Statistik</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{currentGeofence?.vehicles}</p>
                    <p className="text-xs text-slate-500">Kendaraan di Dalam</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{currentGeofence?.events}</p>
                    <p className="text-xs text-slate-500">Kejadian</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Map Panel */}
            <div className="col-span-2 h-full min-h-[400px] border rounded-md overflow-hidden">
              {currentGeofence && (
                <MapContainer
                  center={currentGeofence.center.split(',').map(coord => parseFloat(coord)).reverse()}
                  zoom={13}
                  style={{ width: '100%', height: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeofenceDisplay geofence={currentGeofence} />
                </MapContainer>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Tutup
            </Button>
            <Button variant="outline" className="flex-1">
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}