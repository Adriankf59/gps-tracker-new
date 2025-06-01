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
          user_id: