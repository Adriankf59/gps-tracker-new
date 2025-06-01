"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
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
import { toast } from 'sonner';

// Dynamic import for the entire map component to avoid SSR issues
const MapWithDrawing = dynamic(() => import('./MapWithDrawing'), { 
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

// Fallback simple map component
const SimpleMapFallback = dynamic(() => import('./SimpleMapFallback'), { 
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading fallback map...</p>
      </div>
    </div>
  )
});

interface Geofence {
  geofence_id: number;
  user_id: string;
  name: string;
  type: "circle" | "polygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][];
    center?: number[];
    radius?: number;
    type: string;
  };
  date_created: string;
}

interface GeofenceData {
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
  id?: string;
  user_id?: string;
  email: string;
  username?: string;
  full_name?: string;
}

// Map center coordinates (Indonesia)
const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456];
const API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';

export function GeofenceManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    description: "",
    ruleType: "FORBIDDEN",
    type: "polygon"
  });
  const [drawMode, setDrawMode] = useState<"polygon" | "circle">("polygon");
  const [drawnLayers, setDrawnLayers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [useSimpleMap, setUseSimpleMap] = useState(false);
  
  // Load user from session storage on component mount
  useEffect(() => {
    console.log('🔧 GeofenceManager: Component mounted'); // Debug log
    
    const loadUser = () => {
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          console.log('🔧 GeofenceManager: Loaded user:', user); // Debug log
          setCurrentUser(user);
          // Once user is loaded, fetch geofences
          // Support both 'id' and 'user_id' field names
          const userId = user.id || user.user_id;
          if (userId) {
            fetchGeofences(userId);
          } else {
            console.log('🔧 GeofenceManager: No user ID found in user object'); // Debug log
            setLoading(false);
          }
        } else {
          console.log('🔧 GeofenceManager: No user found in session storage'); // Debug log
          setLoading(false);
        }
      } catch (error) {
        console.error('🔧 GeofenceManager: Error loading user from session storage:', error);
        setLoading(false);
      }
    };
    
    loadUser();
    
    // Set map ready after a short delay to ensure proper loading
    const timer = setTimeout(() => {
      setMapReady(true);
    }, 1000);
    
    // Try full map first, fallback to simple map after 5 seconds if needed
    const fallbackTimer = setTimeout(() => {
      console.log('🔧 GeofenceManager: Switching to simple map fallback');
      setUseSimpleMap(true);
    }, 5000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
    
    return () => clearTimeout(timer);
  }, []);

  const filteredGeofences = geofences.filter(geofence =>
    geofence.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'FORBIDDEN':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'STAY_IN':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'STANDARD':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatRuleType = (ruleType: string) => {
    switch (ruleType) {
      case 'FORBIDDEN':
        return 'Terlarang';
      case 'STAY_IN':
        return 'Tetap di Dalam';
      case 'STANDARD':
        return 'Standar';
      default:
        return ruleType;
    }
  };

  const handleCreateGeofence = () => {
    // Check if user is logged in
    if (!currentUser) {
      toast.error("Anda harus login terlebih dahulu untuk membuat geofence");
      return;
    }
    
    setDrawnLayers([]);
    setNewGeofence({
      name: "",
      description: "",
      ruleType: "FORBIDDEN",
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
      toast.error("Anda harus login terlebih dahulu untuk membuat geofence");
      return;
    }

    if (!newGeofence.name) {
      toast.error("Silakan masukkan nama untuk geofence");
      return;
    }

    if (drawnLayers.length === 0) {
      toast.error("Silakan gambar geofence pada peta");
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
          user_id: currentUser.id || currentUser.user_id, // Use either field
          name: newGeofence.name,
          type: "polygon",
          definition: {
            coordinates: [[coordinates]],
            type: "Polygon"
          },
          rule_type: newGeofence.ruleType,
          status: "active",
          date_created: new Date().toISOString()
        };
      } else {
        // Extract circle center and radius
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
        geofenceData = {
          user_id: currentUser.id || currentUser.user_id, // Use either field
          name: newGeofence.name,
          type: "circle",
          definition: {
            center: [center.lng, center.lat],
            radius: radius,
            type: "Circle"
          },
          rule_type: newGeofence.ruleType,
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
        body: JSON.stringify(geofenceData),
      });

      if (!response.ok) {
        throw new Error('Failed to save geofence');
      }

      toast.success("Geofence berhasil disimpan");
      setIsMapDialogOpen(false);
      
      // Refresh the geofence list
      const userId = currentUser.id || currentUser.user_id;
      if (userId) {
        fetchGeofences(userId);
      }
      
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast.error("Gagal menyimpan geofence. Silakan coba lagi.");
    }
  };
  
  // Function to fetch geofences from API
  const fetchGeofences = async (userId: string) => {
    try {
      setLoading(true);
      console.log('🔧 GeofenceManager: Fetching geofences for user:', userId); // Debug log
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      console.log('🔧 GeofenceManager: API response status:', response.status); // Debug log
      
      if (!response.ok) {
        throw new Error('Failed to fetch geofences');
      }
      
      const data = await response.json();
      console.log('🔧 GeofenceManager: Fetched geofences:', data); // Debug log
      setGeofences(data.data || []);
      
    } catch (error) {
      console.error('🔧 GeofenceManager: Error fetching geofences:', error);
      toast.error("Gagal memuat data geofence");
      // Set empty array on error to show empty state instead of loading
      setGeofences([]);
    } finally {
      setLoading(false);
      console.log('🔧 GeofenceManager: Loading finished'); // Debug log
    }
  };

  // Function to delete geofence
  const handleDeleteGeofence = async (geofenceId: number) => {
    if (!currentUser) {
      toast.error("Anda harus login terlebih dahulu");
      return;
    }

    if (!confirm("Apakah Anda yakin ingin menghapus geofence ini?")) {
      return;
    }

    try {
      const response = await fetch(`${API_ENDPOINT}/${geofenceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete geofence');
      }

      toast.success("Geofence berhasil dihapus");
      
      // Refresh the geofence list
      const userId = currentUser.id || currentUser.user_id;
      if (userId) {
        fetchGeofences(userId);
      }
      
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast.error("Gagal menghapus geofence. Silakan coba lagi.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Memuat data geofence...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no user is logged in
  if (!currentUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">Akses Ditolak</h3>
            <p className="text-slate-500">Anda harus login terlebih dahulu untuk mengakses fitur geofence.</p>
          </div>
        </div>
      </div>
    );
  }

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
              placeholder="Cari geofence berdasarkan nama..."
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
                  {geofences.filter(g => g.rule_type === 'FORBIDDEN').length}
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
                  {geofences.filter(g => g.type === 'circle').length}
                </p>
                <p className="text-sm text-slate-600">Geofence Lingkaran</p>
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
                  {geofences.filter(g => g.type === 'polygon').length}
                </p>
                <p className="text-sm text-slate-600">Geofence Poligon</p>
              </div>
              <Eye className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Geofence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredGeofences.map((geofence) => (
          <Card key={geofence.geofence_id} className="hover:shadow-lg transition-shadow">
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
                  <Badge className={getRuleTypeColor(geofence.rule_type)}>
                    {formatRuleType(geofence.rule_type)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Tipe</p>
                  <p className="font-medium capitalize">{geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Dibuat</p>
                  <p className="font-medium">{new Date(geofence.date_created).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2 ">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleViewGeofence(geofence)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Lihat
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteGeofence(geofence.geofence_id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredGeofences.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">Tidak ada geofence ditemukan</h3>
            <p className="text-slate-500">
              {geofences.length === 0 
                ? "Belum ada geofence yang dibuat. Klik tombol 'Buat Geofence' untuk membuat yang pertama."
                : "Coba sesuaikan kriteria pencarian."}
            </p>
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
                    <SelectItem value="FORBIDDEN">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        Zona Terlarang
                      </div>
                    </SelectItem>
                    <SelectItem value="STAY_IN">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        Area Tetap di Dalam
                      </div>
                    </SelectItem>
                    <SelectItem value="STANDARD">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        Standar
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Petunjuk</h4>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                  <li>Pilih tipe geofence (Poligon atau Lingkaran)</li>
                  <li>Gunakan tools di peta untuk menggambar</li>
                  <li>Pilih tipe aturan</li>
                  <li>Masukkan nama geofence</li>
                  <li>Klik Simpan untuk membuat geofence</li>
                </ol>
              </div>
            </div>
            
            {/* Map Panel */}
            <div className="col-span-2 h-full min-h-[400px] border rounded-md overflow-hidden">
              {mapReady ? (
                useSimpleMap ? (
                  <SimpleMapFallback
                    center={DEFAULT_CENTER}
                    zoom={10}
                    drawMode={drawMode}
                    onDrawCreated={handleDrawCreated}
                    onDrawEdited={handleDrawEdited}
                    onDrawDeleted={handleDrawDeleted}
                    ruleType={newGeofence.ruleType}
                  />
                ) : (
                  <MapWithDrawing
                    center={DEFAULT_CENTER}
                    zoom={10}
                    drawMode={drawMode}
                    onDrawCreated={handleDrawCreated}
                    onDrawEdited={handleDrawEdited}
                    onDrawDeleted={handleDrawDeleted}
                    ruleType={newGeofence.ruleType}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing map...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMapDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleSaveGeofence}
              disabled={!drawnLayers.length || !newGeofence.name}
              className={`${newGeofence.ruleType === 'FORBIDDEN' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
              <Badge className={`ml-2 ${getRuleTypeColor(currentGeofence?.rule_type || '')}`}>
                {currentGeofence ? formatRuleType(currentGeofence.rule_type) : ''}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
            {/* Info Panel */}
            <div className="space-y-4">
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
                <h3 className="text-sm font-medium text-slate-500">Aturan</h3>
                <Badge className={getRuleTypeColor(currentGeofence?.rule_type || '')}>
                  {currentGeofence ? formatRuleType(currentGeofence.rule_type) : ''}
                </Badge>
              </div>
              
              {currentGeofence?.type === 'circle' && currentGeofence.definition.center && currentGeofence.definition.radius && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500">Pusat</h3>
                    <p className="font-mono text-xs">
                      {currentGeofence.definition.center[1].toFixed(6)}, {currentGeofence.definition.center[0].toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500">Radius</h3>
                    <p>{Math.round(currentGeofence.definition.radius)}m</p>
                  </div>
                </>
              )}
              
              {currentGeofence?.type === 'polygon' && currentGeofence.definition.coordinates && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500">Jumlah Titik</h3>
                  <p>{currentGeofence.definition.coordinates[0][0].length - 1} titik</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-slate-500">Dibuat</h3>
                <p>{currentGeofence ? new Date(currentGeofence.date_created).toLocaleDateString('id-ID') : ''}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-slate-500">Status</h3>
                <Badge className={getStatusColor(currentGeofence?.status || '')}>
                  {currentGeofence?.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                </Badge>
              </div>
            </div>
            
            {/* Map Panel */}
            <div className="col-span-2 h-full min-h-[400px] border rounded-md overflow-hidden">
              {currentGeofence && mapReady ? (
                useSimpleMap ? (
                  <SimpleMapFallback
                    center={
                      currentGeofence.type === 'circle' && currentGeofence.definition.center
                        ? [currentGeofence.definition.center[1], currentGeofence.definition.center[0]]
                        : currentGeofence.type === 'polygon' && currentGeofence.definition.coordinates
                        ? [currentGeofence.definition.coordinates[0][0][0][1], currentGeofence.definition.coordinates[0][0][0][0]]
                        : DEFAULT_CENTER
                    }
                    zoom={13}
                    viewOnly={true}
                    geofence={currentGeofence}
                  />
                ) : (
                  <MapWithDrawing
                    center={
                      currentGeofence.type === 'circle' && currentGeofence.definition.center
                        ? [currentGeofence.definition.center[1], currentGeofence.definition.center[0]]
                        : currentGeofence.type === 'polygon' && currentGeofence.definition.coordinates
                        ? [currentGeofence.definition.coordinates[0][0][0][1], currentGeofence.definition.coordinates[0][0][0][0]]
                        : DEFAULT_CENTER
                    }
                    zoom={13}
                    viewOnly={true}
                    geofence={currentGeofence}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading geofence map...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}