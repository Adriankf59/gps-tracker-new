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
  X,
  Layers,
  List
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [activeTab, setActiveTab] = useState("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false);
  
  // Check screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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

  const handleStartCreatingGeofence = () => {
    setDrawnLayers([]);
    setNewGeofence({
      name: "",
      description: "",
      ruleType: "FORBIDDEN",
      type: "polygon"
    });
    setDrawMode("polygon");
    setIsCreatingGeofence(true);
    
    // On mobile, switch to map tab
    if (isMobile) {
      setActiveTab("map");
    }
  };

  const handleCancelCreatingGeofence = () => {
    setIsCreatingGeofence(false);
    setDrawnLayers([]);
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
      setIsCreatingGeofence(false);
      setDrawnLayers([]);
      setNewGeofence({
        name: "",
        description: "",
        ruleType: "FORBIDDEN",
        type: "polygon"
      });
      
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