"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Layer, Circle, Polygon, LatLng, LayerGroup } from 'leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Search,
  Plus,
  MapPin,
  Trash2,
  Circle as CircleIcon,
  Square,
  Save,
  X,
  List,
  Car
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamic import for the drawing map component
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

export interface Geofence {
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

export interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_id: string;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
  sim_card_number: string;
  relay_status: string | null;
  geofence_id: string | null;
  position?: [number, number];
}

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  username?: string;
  full_name?: string;
}

// Map center coordinates (Indonesia)
const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';
const VEHICLE_API_ENDPOINT = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';

export function GeofenceManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentGeofence, setCurrentGeofence] = useState<Geofence | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    description: "",
    ruleType: "FORBIDDEN",
    type: "polygon"
  });
  const [drawMode, setDrawMode] = useState<"polygon" | "circle">("polygon");
  const [drawnLayers, setDrawnLayers] = useState<L.Layer[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false);
  const [savedGeofenceForAssign, setSavedGeofenceForAssign] = useState<Geofence | null>(null);

  // In your useEffect for styling, update the z-index values:
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Ensure dialogs appear above everything */
      [data-radix-popper-content-wrapper] {
        z-index: 50000 !important;
      }
      
      /* Lower map container z-index */
      .leaflet-container {
        z-index: 1 !important;
      }
      
      /* Ensure all dialog components have proper z-index */
      [role="dialog"] {
        z-index: 50000 !important;
      }
      
      /* Fixed positioning for dialog overlay */
      .fixed[role="dialog"] {
        z-index: 50000 !important;
      }
      
      /* Dialog overlay background */
      [data-state="open"][data-overlay] {
        z-index: 49999 !important;
      }
      
      /* Select dropdown positioning */
      [data-radix-select-content] {
        z-index: 50001 !important;
      }
      
      /* Toast notifications should be above dialogs */
      [data-sonner-toaster] {
        z-index: 50002 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Check screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Helper function to validate geofence coordinates
  const validateGeofenceCoordinates = (geofence: Geofence): boolean => {
    try {
      if (!geofence.definition) {
        console.log('⚠️ No definition in geofence');
        return false;
      }

      if (geofence.type === 'circle') {
        if (!geofence.definition.center || !Array.isArray(geofence.definition.center) || geofence.definition.center.length < 2) {
          console.log('⚠️ Invalid circle center');
          return false;
        }
        const [lng, lat] = geofence.definition.center;
        if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
          console.log('⚠️ Invalid circle center coordinates:', lng, lat);
          return false;
        }
        if (geofence.definition.radius === undefined || isNaN(geofence.definition.radius)) {
          console.log('⚠️ Invalid circle radius');
          return false;
        }
        return true;
      }

      if (geofence.type === 'polygon') {
        return validatePolygonCoords(geofence.definition.coordinates);
      }

      console.log('⚠️ Unknown geofence type:', geofence.type);
      return false;
    } catch (error) {
      console.error('❌ Error validating coordinates:', error, geofence);
      return false;
    }
  };

  const validatePolygonCoords = (coordinates: number[][][] | undefined): boolean => {
    if (!coordinates || !Array.isArray(coordinates)) {
      console.log('⚠️ Invalid polygon coordinates structure (outer)');
      return false;
    }

    const coords = coordinates;
    if (!coords[0] || !Array.isArray(coords[0])) {
      console.log('⚠️ Invalid polygon coordinates structure (ring)');
      return false;
    }

    if (!coords[0][0] || !Array.isArray(coords[0][0])) {
      console.log('⚠️ Invalid polygon coordinates structure (point)');
      return false;
    }

    const firstPoint = coords[0][0];
    if (!firstPoint || firstPoint.length < 2) {
      console.log('⚠️ Invalid polygon first point length');
      return false;
    }

    const [lng, lat] = firstPoint;
    if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
      console.log('⚠️ Invalid polygon coordinates values:', lng, lat);
      return false;
    }

    return true;
  }

  const zoomToGeofence = (geofence: Geofence | null) => {
    if (!geofence) {
      console.log('⚠️ Cannot zoom: No geofence provided');
      return;
    }
    
    console.log('🔍 Zooming to geofence:', geofence.name);
    setCurrentGeofence(geofence);
    setIsCreatingGeofence(false); // Ensure not in creating mode when zooming to existing
    setMapKey(prev => prev + 1);
  };

  useEffect(() => {
    if (mapReady && currentGeofence) {
      console.log('🗺️ Map ready with current geofence:', currentGeofence.name);
    }
  }, [mapReady, currentGeofence]);

  const getGeofenceCenter = (geofence: Geofence | null): [number, number] => {
    if (!geofence) return DEFAULT_CENTER;
    
    if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.center.length === 2) {
      return geofence.definition.center as [number, number];
    } else if (geofence.type === 'polygon' && geofence.definition.coordinates && geofence.definition.coordinates[0]?.length > 0) {
      const coords = geofence.definition.coordinates[0];
      if (coords.length === 0) return DEFAULT_CENTER;
      const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
      const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
      return [sumLat / coords.length, sumLng / coords.length];
    }
    
    return DEFAULT_CENTER;
  };
  
  const prepareGeofenceForMap = (geofence: Geofence) => {
    if (!geofence || !validateGeofenceCoordinates(geofence)) { // Validate before preparing
        console.warn('⚠️ Invalid geofence data, cannot prepare for map:', geofence);
        return null;
    }
    
    console.log('🔄 Preparing geofence for map display:', geofence.name);
    
    try {
      return {
        geofence_id: geofence.geofence_id,
        user_id: geofence.user_id,
        name: geofence.name,
        type: geofence.type,
        rule_type: geofence.rule_type,
        status: geofence.status,
        definition: geofence.definition,
        date_created: geofence.date_created
      };
    } catch (error) {
      console.error('❌ Error preparing geofence for map:', error, geofence);
      return null;
    }
  };

  const mapGeofences = useMemo(() => {
    return geofences
      .map(prepareGeofenceForMap)
      .filter(g => g !== null);
  }, [geofences]);

  const currentMapGeofence = useMemo(() => {
    if (!currentGeofence) return null;
    return prepareGeofenceForMap(currentGeofence);
  }, [currentGeofence]);

  // Load user from session storage on component mount
  useEffect(() => {
    console.log('🔧 GeofenceManager: Component mounted');

    const loadUser = () => {
      try {
        const userJson = sessionStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          console.log('🔧 GeofenceManager: Loaded user:', user);
          setCurrentUser(user);
          const userId = user.id || user.user_id;
          if (userId) {
            fetchGeofences(userId);
            fetchVehicles(userId);
          } else {
            console.log('🔧 GeofenceManager: No user ID found in user object');
            setLoading(false);
          }
        } else {
          console.log('🔧 GeofenceManager: No user found in session storage');
          setLoading(false);
        }
      } catch (error) {
        console.error('🔧 GeofenceManager: Error loading user from session storage:', error);
        setLoading(false);
      }
    };

    loadUser();

    const timer = setTimeout(() => {
      setMapReady(true);
      console.log('🗺️ Map component is now considered ready.');
    }, 1000); // Give map a bit of time to initialize

    return () => clearTimeout(timer);
  }, []);

  // Fetch geofences from API
  const fetchGeofences = async (userId: string): Promise<Geofence[]> => {
    setLoading(true); // Set loading true at the start of fetch
    try {
      console.log('🔧 Fetching geofences for user:', userId);
      const response = await fetch(`${API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const fetchedData = result.data || [];
        console.log('🔧 Geofences fetched:', fetchedData.length);
        
        // Validate each geofence
        const validGeofences = fetchedData.filter((geo: Geofence) => {
            const isValid = validateGeofenceCoordinates(geo);
            if (!isValid) {
                console.warn(`⚠️ Invalid coordinates for geofence ID ${geo.geofence_id}: ${geo.name}. It will be excluded.`);
                toast.warning(`Geofence "${geo.name}" memiliki data tidak valid dan tidak akan ditampilkan di peta.`);
            }
            return isValid;
        });
        setGeofences(validGeofences);
        return validGeofences;
      } else {
        console.error('🔧 Failed to fetch geofences:', response.statusText);
        toast.error("Gagal memuat data geofence");
        return [];
      }
    } catch (error) {
      console.error('🔧 Error fetching geofences:', error);
      toast.error("Gagal memuat data geofence");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch vehicles from API
  const fetchVehicles = async (userId: string) => {
    try {
      console.log('🔧 Fetching vehicles for user:', userId);
      const response = await fetch(`${VEHICLE_API_ENDPOINT}?filter[user_id][_eq]=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      const result = await response.json();
      console.log('🔧 Vehicles fetched:', result.data?.length || 0);
      setVehicles(result.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    }
  };
  
  // Auto-select first geofence when geofences are loaded and no current geofence is selected
  useEffect(() => {
    if (geofences.length > 0 && !currentGeofence && !isCreatingGeofence && mapReady) {
      const firstGeofence = geofences[0];
      console.log('🎯 Auto-selecting first geofence:', firstGeofence.name);
      // Validate coordinates before setting
      if (validateGeofenceCoordinates(firstGeofence)) {
        // setCurrentGeofence(firstGeofence); // zoomToGeofence will set it
        zoomToGeofence(firstGeofence);
      } else {
        console.warn('⚠️ First geofence has invalid coordinates, skipping auto-selection', firstGeofence);
         // Try to find the next valid geofence
        const nextValidGeofence = geofences.find(validateGeofenceCoordinates);
        if (nextValidGeofence) {
            console.log('🎯 Auto-selecting next valid geofence:', nextValidGeofence.name);
            // setCurrentGeofence(nextValidGeofence);
            zoomToGeofence(nextValidGeofence);
        } else {
            console.warn('⚠️ No valid geofences found for auto-selection.');
        }
      }
    }
  }, [geofences, currentGeofence, isCreatingGeofence, mapReady]); // Added mapReady dependency


  // Handle assigning vehicles to a geofence
  const handleAssignGeofence = (geofence: Geofence) => {
    if (!validateGeofenceCoordinates(geofence)) {
        toast.error("Tidak dapat assign kendaraan: Data geofence tidak valid.");
        return;
    }
    setCurrentGeofence(geofence); // Ensure currentGeofence is set for the dialog
    
    const assignedVehicleIds = vehicles
      .filter(v => v.geofence_id === geofence.geofence_id.toString())
      .map(v => v.vehicle_id);
    
    setSelectedVehicles(assignedVehicleIds);
    setAssignDialogOpen(true);
  };
  
  const handleVehicleSelectionChange = (vehicleId: string) => {
    setSelectedVehicles(prev => {
      if (prev.includes(vehicleId)) {
        return prev.filter(id => id !== vehicleId);
      } else {
        return [...prev, vehicleId];
      }
    });
  };
  
  // Update vehicle with geofence assignment
  const updateVehicleGeofence = async (vehicleId: string, geofenceId: string | null) => {
    try {
      const response = await fetch(`${VEHICLE_API_ENDPOINT}/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          geofence_id: geofenceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to update vehicle ${vehicleId}:`, errorData);
        throw new Error(`Failed to update vehicle ${vehicleId}`);
      }
      console.log(`🔧 Vehicle ${vehicleId} geofence_id updated to ${geofenceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating vehicle ${vehicleId}:`, error);
      return false;
    }
  };

  // Save vehicle assignments to the geofence
  const assignGeofenceToVehicles = async () => {
    if (!currentGeofence) {
        toast.error("Tidak ada geofence dipilih untuk assignment.");
        return;
    }
    
    setLoading(true); // Start loading spinner on button
    
    try {
      const geofenceIdStr = currentGeofence.geofence_id.toString();
      
      // Vehicles currently assigned to THIS geofence in the local state
      const initiallyAssignedToThisGeofence = vehicles
        .filter(v => v.geofence_id === geofenceIdStr)
        .map(v => v.vehicle_id);

      // Vehicles selected in the dialog
      const vehiclesToUltimatelyBeAssigned = selectedVehicles;

      // Vehicles to assign: selected AND (not initially assigned to this geofence OR was null)
      const vehiclesToAdd = vehiclesToUltimatelyBeAssigned.filter(
        vehicleId => !initiallyAssignedToThisGeofence.includes(vehicleId)
      );
      
      // Vehicles to unassign: initially assigned to this geofence BUT NOT in selectedVehicles
      const vehiclesToRemove = initiallyAssignedToThisGeofence.filter(
        vehicleId => !vehiclesToUltimatelyBeAssigned.includes(vehicleId)
      );

      console.log('Assigning to geofence ID:', geofenceIdStr);
      console.log('Selected vehicles in dialog:', vehiclesToUltimatelyBeAssigned);
      console.log('Initially assigned to this geofence:', initiallyAssignedToThisGeofence);
      console.log('Vehicles to add assignment:', vehiclesToAdd);
      console.log('Vehicles to remove assignment:', vehiclesToRemove);
      
      const assignPromises = vehiclesToAdd.map(vehicleId => 
        updateVehicleGeofence(vehicleId, geofenceIdStr)
      );
      
      const unassignPromises = vehiclesToRemove.map(vehicleId => 
        updateVehicleGeofence(vehicleId, null) // Unassign by setting geofence_id to null
      );
      
      const results = await Promise.all([...assignPromises, ...unassignPromises]);
      
      if (results.some(result => !result)) {
        toast.error('Gagal memperbarui beberapa assignment kendaraan.');
      } else {
        toast.success('Assignment kendaraan berhasil diperbarui.');
      }
      
      // Refresh vehicles data to reflect changes
      const userId = currentUser?.id || currentUser?.user_id;
      if (userId) {
        await fetchVehicles(userId); // wait for fetch to complete
      }
      
      setAssignDialogOpen(false);
    } catch (error) {
      console.error('❌ Error updating vehicle assignments:', error);
      toast.error('Gagal memperbarui assignment kendaraan.');
    } finally {
      setLoading(false); // Stop loading spinner on button
    }
  };

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
    setCurrentGeofence(null); // Clear current geofence selection
    setNewGeofence({
      name: "",
      description: "",
      ruleType: "FORBIDDEN",
      type: "polygon"
    });
    setDrawMode("polygon");
    setIsCreatingGeofence(true);
    setMapKey(prev => prev + 1); // Force map re-render for drawing tools

    if (isMobile) {
      setActiveTab("map");
    }
  };

  const handleCancelCreatingGeofence = () => {
    setIsCreatingGeofence(false);
    setDrawnLayers([]);
    // Optionally, re-select the first geofence or previously selected one
    if (geofences.length > 0) {
        const firstValidGeofence = geofences.find(validateGeofenceCoordinates);
        if (firstValidGeofence) {
            zoomToGeofence(firstValidGeofence);
        } else {
            setCurrentGeofence(null); // No valid geofence to show
            setMapKey(prev => prev + 1); // Refresh map to default view
        }
    } else {
        setCurrentGeofence(null);
        setMapKey(prev => prev + 1);
    }
  };



  const handleDrawModeChange = (mode: "polygon" | "circle") => {
    setDrawMode(mode);
    setNewGeofence({...newGeofence, type: mode});
    setDrawnLayers([]); // Clear existing drawings when mode changes
  };

  const handleDrawCreated = (e: { layerType: string; layer: L.Layer }) => {
    console.log('🎨 Draw created:', e);
    const { layerType, layer } = e;
    setDrawnLayers([layer]); // Replace, only one drawn layer for new geofence

    // Update the type in newGeofence state based on what was actually drawn
    if (layerType === 'circle') {
      setNewGeofence(prev => ({...prev, type: 'circle'}));
      // setDrawMode('circle'); // Not necessary, drawMode controls tool, not type of drawn shape
    } else if (layerType === 'polygon' || layerType === 'rectangle') { // Leaflet draw might return 'rectangle'
      setNewGeofence(prev => ({...prev, type: 'polygon'})); // Treat rectangle as polygon
      // setDrawMode('polygon');
    }
  };

  const handleDrawEdited = (e: { layers: L.LayerGroup }) => {
    console.log('🎨 Draw edited:', e);
    const layers = e.layers;
    const editedLayers: L.Layer[] = [];
    layers.eachLayer((layer: L.Layer) => {
      editedLayers.push(layer);
    });
    setDrawnLayers(editedLayers); // Update with the edited layer
  };

  const handleDrawDeleted = (e: { layers: L.LayerGroup }) => {
    console.log('🎨 Draw deleted:', e);
    setDrawnLayers([]); // Clear the drawn layer
  };

  const handleSaveGeofence = async () => {
    if (!currentUser) {
      toast.error("Anda harus login untuk membuat geofence");
      return;
    }
    if (!newGeofence.name.trim()) {
      toast.error("Nama geofence harus diisi");
      return;
    }
    if (drawnLayers.length === 0) {
      toast.error("Silakan gambar area geofence terlebih dahulu");
      return;
    }

    setLoading(true); // Indicate saving process

    try {
      const layer = drawnLayers[0];
      const userId = currentUser?.id || currentUser?.user_id;
      if (!userId) {
        throw new Error('User ID not found');
      }

      let definition: Geofence['definition'];
      
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        const coordinates = latlngs.map(latLng => [latLng.lng, latLng.lat]);
        if (coordinates.length > 0 && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
            coordinates.push(coordinates[0]); // Close the polygon if not already closed
        }

        definition = {
            type: "Polygon",
            coordinates: [coordinates]
        };
      } else if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
        // For circle, we store its original properties and a polygonal representation
        const points = 64; 
        const circlePolygonCoords: number[][] = [];
        for (let i = 0; i < points; i++) {
          const angle = (i * 2 * Math.PI) / points;
          // Approximation for converting radius in meters to lat/lng degrees
          const latRadius = radius / 111320; // meters per degree latitude
          const lngRadius = radius / (111320 * Math.cos(center.lat * Math.PI / 180)); // meters per degree longitude
          
          const lat = center.lat + latRadius * Math.cos(angle);
          const lng = center.lng + lngRadius * Math.sin(angle);
          circlePolygonCoords.push([lng, lat]);
        }
        circlePolygonCoords.push(circlePolygonCoords[0]); // Close the polygon

        definition = {
            type: "Circle",
            center: [center.lng, center.lat],
            radius: radius,
            coordinates: [circlePolygonCoords]
        };
      } else {
        throw new Error('Invalid layer type');
      }

      const geofencePayload: Omit<Geofence, 'geofence_id'> = {
        user_id: userId,
        name: newGeofence.name,
        type: newGeofence.type,
        rule_type: newGeofence.ruleType as Geofence['rule_type'],
        status: "active",
        date_created: new Date().toISOString(),
        definition
      };
      

      console.log("💾 Saving Geofence Data:", JSON.stringify(geofencePayload, null, 2));

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geofencePayload),
      });

      if (response.ok) {
        const savedGeofenceResponse = await response.json();
        const savedGeofence = savedGeofenceResponse.data as Geofence; // Assuming Directus returns the item in 'data'
        
        toast.success("Geofence berhasil disimpan");
        setIsCreatingGeofence(false);
        setDrawnLayers([]);
        setNewGeofence({ name: "", description: "", ruleType: "FORBIDDEN", type: "polygon" });
        
        if (currentUserId) {
          // Refetch geofences to include the new one and re-validate all
          const updatedGeofences = await fetchGeofences(currentUserId); 
          
          // Try to find the newly created geofence in the updated list to ensure we have the DB version
          const newlySavedGeofenceFromList = updatedGeofences.find(g => g.geofence_id === savedGeofence.geofence_id);

          if (newlySavedGeofenceFromList && validateGeofenceCoordinates(newlySavedGeofenceFromList)) {
            setCurrentGeofence(newlySavedGeofenceFromList); // Set the full object from DB
            setSavedGeofenceForAssign(newlySavedGeofenceFromList); 
            zoomToGeofence(newlySavedGeofenceFromList);
            
            // Show vehicle assignment dialog after a short delay
            setTimeout(() => {
              handleAssignGeofence(newlySavedGeofenceFromList);
            }, 500); 
          } else if (savedGeofence && validateGeofenceCoordinates(savedGeofence)) {
            // Fallback to API response if not found in list (should not happen ideally) or if list is empty
             setCurrentGeofence(savedGeofence);
             setSavedGeofenceForAssign(savedGeofence);
             zoomToGeofence(savedGeofence);
             setTimeout(() => {
              handleAssignGeofence(savedGeofence);
            }, 500);
          } else {
            console.warn("⚠️ Newly saved geofence might have invalid data or was not found in refetched list.");
            // setActiveTab("list"); // Go to list if something is off
          }
        }
        if (isMobile && activeTab !== "list") { // If mobile and not already on list, switch to list
          setActiveTab("list");
        }
      } else {
        const errorData = await response.json();
        console.error('❌ API Error saving geofence:', errorData);
        toast.error(`Gagal menyimpan geofence: ${errorData?.errors?.[0]?.message || 'Silakan coba lagi.'}`);
      }
    } catch (error) {
      console.error('❌ Error saving geofence:', error);
      toast.error("Terjadi kesalahan saat menyimpan geofence. Silakan coba lagi.");
    } finally {
        setLoading(false); // Stop loading indication
    }
  };

  const handleDeleteGeofence = async (geofenceId: number) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus geofence ini? Semua assignment kendaraan terkait akan dihapus.")) {
        return;
    }
    setLoading(true);
    try {
      // Before deleting geofence, unassign all vehicles associated with it
      const vehiclesAssignedToThisGeofence = vehicles.filter(v => v.geofence_id === geofenceId.toString());
      const unassignPromises = vehiclesAssignedToThisGeofence.map(v => updateVehicleGeofence(v.vehicle_id, null));
      await Promise.all(unassignPromises);
      console.log(`🔧 All vehicles unassigned from geofence ID ${geofenceId}`);

      const response = await fetch(`${API_ENDPOINT}/${geofenceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success("Geofence berhasil dihapus");
        const userId = currentUser?.id || currentUser?.user_id;
        if (userId) {
          await fetchGeofences(userId); // Refresh geofence list
          await fetchVehicles(userId); // Refresh vehicle list (to reflect unassignments)
        }
        if (currentGeofence?.geofence_id === geofenceId) {
            setCurrentGeofence(null); // Clear selection if deleted geofence was selected
            setIsViewDialogOpen(false); // Close view dialog if open for this geofence
            // Auto-select first valid geofence if available after deletion
            if (geofences.length > 1) { // if there were more than the one deleted
                const firstValid = geofences.filter(g => g.geofence_id !== geofenceId).find(validateGeofenceCoordinates);
                if (firstValid) zoomToGeofence(firstValid);
            } else {
                setMapKey(prev => prev + 1); // Reset map if no geofences left or no valid ones
            }
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to delete geofence:', errorData);
        toast.error(`Gagal menghapus geofence: ${errorData?.errors?.[0]?.message || 'Coba lagi'}`);
      }
    } catch (error) {
      console.error('❌ Error deleting geofence:', error);
      toast.error("Terjadi kesalahan saat menghapus geofence.");
    } finally {
        setLoading(false);
    }
  };

  // Fix for Leaflet _leaflet_pos error on geofence deletion
  useEffect(() => {
    if (!mapReady) return;

    // Force map re-render by updating mapKey after geofence deletion
    // This helps Leaflet reset internal state and avoid _leaflet_pos errors
    const handleGeofenceChange = () => {
      setMapKey(prev => prev + 1);
    };

    // Listen for geofence changes (you may need to adapt this to your event system)
    // For now, we simulate by calling handleGeofenceChange after geofences update
    handleGeofenceChange();

  }, [geofences, mapReady]);

  if (loading && !currentUser) { // Main loading screen, typically shown on initial load before user data is fetched.
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <p className="text-xl text-gray-700 font-semibold">Memuat data...</p>
          <p className="text-gray-500">Silakan tunggu sebentar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Manajemen Geofence</h1>
            <p className="text-sm text-gray-600">Kelola area geografis untuk monitoring kendaraan Anda.</p>
          </div>
        </div>
        
        {/* Show "Tambah Geofence" button if not creating and either has geofences OR finished initial load */}
        {(!loading || geofences.length > 0) && !isCreatingGeofence && (
          <Button 
            onClick={handleStartCreatingGeofence}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-md transition-all w-full sm:w-auto"
            disabled={!mapReady} // Disable if map is not ready for drawing
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Geofence Baru
          </Button>
        )}
      </div>

      {/* Mobile: Tabs Layout */}
      {isMobile ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sticky top-0 bg-gray-50 z-10 shadow-sm">
                <TabsTrigger value="list" className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm py-2.5">
                    <List className="h-5 w-5" />
                    Daftar
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm py-2.5">
                    <MapPin className="h-5 w-5" />
                    Peta & Buat Baru
                </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-2">
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <Input
                            placeholder="Cari nama geofence..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 py-2.5 text-base"
                        />
                    </div>
                </div>

                {loading && geofences.length === 0 && (
                     <div className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">Memuat geofence...</p>
                    </div>
                )}

                {!loading && filteredGeofences.length === 0 && (
                    <Card className="shadow-sm">
                        <CardContent className="p-6 text-center">
                        <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            {searchTerm ? "Geofence tidak ditemukan" : "Belum ada geofence"}
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {searchTerm ? `Tidak ada geofence yang cocok dengan pencarian "${searchTerm}".` : "Mulai dengan membuat geofence pertama Anda di tab Peta."}
                        </p>
                        {!searchTerm && (
                            <Button onClick={() => { handleStartCreatingGeofence(); setActiveTab("map"); }} className="bg-green-500 hover:bg-green-600">
                                <Plus className="h-5 w-5 mr-2" />
                                Buat Geofence Sekarang
                            </Button>
                        )}
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {filteredGeofences.map((geofence) => (
                        <Card 
                            key={geofence.geofence_id} 
                            className={`hover:shadow-lg transition-shadow border rounded-lg overflow-hidden ${currentGeofence?.geofence_id === geofence.geofence_id ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                            onClick={() => {zoomToGeofence(geofence); setActiveTab("map");}}
                        >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 text-lg truncate" title={geofence.name}>
                                    {geofence.name}
                                    </h3>
                                </div>
                                <Badge className={`${getStatusColor(geofence.status)} ml-2 text-xs px-1.5 py-0.5`}>
                                    {geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Badge className={`${getRuleTypeColor(geofence.rule_type)} text-xs px-1.5 py-0.5`}>
                                    {formatRuleType(geofence.rule_type)}
                                </Badge>
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-gray-300 text-gray-600">
                                    {geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                <span>Dibuat: {new Date(geofence.date_created).toLocaleDateString('id-ID')}</span>
                                <span>ID: {geofence.geofence_id}</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={(e) => { e.stopPropagation(); handleAssignGeofence(geofence);}}
                                    title="Assign kendaraan"
                                >
                                    <Car className="h-4 w-4 mr-1.5" /> Assign
                                </Button>
                                 <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:bg-red-50"
                                    onClick={(e) => {e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id);}}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                        </Card>
                    ))}
                </div>
            </TabsContent>

            <TabsContent value="map" className="mt-1">
                <Card className="shadow-md">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MapPin className="h-5 w-5 text-blue-600" />
                            {isCreatingGeofence ? 'Gambar Geofence Baru di Peta' : (currentGeofence ? `Peta: ${currentGeofence.name}` : 'Peta Geofence')}
                        </CardTitle>
                         {!isCreatingGeofence && (
                            <Button 
                                onClick={handleStartCreatingGeofence}
                                size="sm"
                                className="mt-2 w-full bg-green-500 hover:bg-green-600"
                                disabled={!mapReady}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Buat Geofence Baru di Peta Ini
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4">
                        {isCreatingGeofence && (
                            <div className="mb-4 space-y-3 p-3 bg-gray-50 rounded-lg border">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Nama Geofence</label>
                                    <Input
                                    placeholder="Contoh: Area Gudang Utama"
                                    value={newGeofence.name}
                                    onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                                    className="text-base"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Jenis Aturan</label>
                                    <Select
                                    value={newGeofence.ruleType}
                                    onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value})}
                                    >
                                    <SelectTrigger className="text-base"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FORBIDDEN">Terlarang Masuk</SelectItem>
                                        <SelectItem value="STAY_IN">Wajib Tetap di Dalam</SelectItem>
                                        <SelectItem value="STANDARD">Area Standar (Notifikasi Masuk/Keluar)</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Mode Gambar Area</label>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={drawMode === "polygon" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleDrawModeChange("polygon")}
                                            className={`flex-1 ${drawMode === "polygon" ? 'bg-blue-600 text-white' : ''}`}
                                        >
                                            <Square className="h-4 w-4 mr-2" /> Poligon
                                        </Button>
                                        <Button
                                            variant={drawMode === "circle" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleDrawModeChange("circle")}
                                            className={`flex-1 ${drawMode === "circle" ? 'bg-blue-600 text-white' : ''}`}
                                        >
                                            <Circle className="h-4 w-4 mr-2" /> Lingkaran
                                        </Button>
                                    </div>
                                    {drawnLayers.length > 0 && <p className="text-xs text-green-600 mt-1">Area telah digambar. Anda bisa edit atau hapus di peta.</p>}
                                    {drawnLayers.length === 0 && <p className="text-xs text-orange-600 mt-1">Klik tool gambar di peta untuk memulai.</p>}
                                </div>

                                <div className="flex gap-2 pt-2 border-t mt-3">
                                    <Button onClick={handleSaveGeofence} disabled={drawnLayers.length === 0 || !newGeofence.name.trim() || loading} className="bg-green-500 hover:bg-green-600 flex-1">
                                        {loading && drawnLayers.length > 0 ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Menyimpan...</> : <><Save className="h-4 w-4 mr-2" /> Simpan Geofence</>}
                                    </Button>
                                    <Button variant="outline" onClick={handleCancelCreatingGeofence} className="flex-1">
                                        <X className="h-4 w-4 mr-2" /> Batal
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className={`h-80 sm:h-96 border rounded-lg overflow-hidden shadow-inner ${isCreatingGeofence ? 'ring-2 ring-blue-500' : ''}`}>
                            {!mapReady && (
                                <div className="h-full flex items-center justify-center bg-gray-100">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                        <p className="text-gray-600">Memuat peta...</p>
                                    </div>
                                </div>
                            )}
                            {mapReady && (
                                <MapWithDrawing
                                    key={`mobile-map-${mapKey}-${currentGeofence?.geofence_id || 'new'}-${isCreatingGeofence}`}
                                    center={getGeofenceCenter(isCreatingGeofence ? null : currentGeofence)} // Center on default or current
                                    zoom={isCreatingGeofence ? 5 : (currentGeofence ? 13 : 5)} // Zoom out for new, zoom in for selected
                                    drawMode={isCreatingGeofence ? drawMode : undefined} // Only pass drawMode if creating
                                    onDrawCreated={isCreatingGeofence ? handleDrawCreated : undefined}
                                    onDrawEdited={isCreatingGeofence ? handleDrawEdited : undefined}
                                    onDrawDeleted={isCreatingGeofence ? handleDrawDeleted : undefined}
                                    viewOnly={!isCreatingGeofence}
                                    geofences={isCreatingGeofence ? [] : (currentGeofence ? [currentMapGeofence].filter(Boolean) as Geofence[] : mapGeofences as Geofence[])}
                                    selectedGeofence={isCreatingGeofence ? null : currentMapGeofence}
                                    isCreating={isCreatingGeofence}
                                    {...(isCreatingGeofence ? { drawnLayersForEditing: drawnLayers } : {})}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      ) : (
        /* Desktop: Side-by-side Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] xl:h-[calc(100vh-160px)]"> {/* Adjusted height */}
          <div className="lg:col-span-1 flex flex-col bg-white p-4 rounded-xl shadow-lg border border-gray-200">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Cari nama geofence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 pr-4 py-2.5 text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {isCreatingGeofence && (
              <Card className="mb-4 border-blue-300 shadow-md">
                <CardHeader className="bg-blue-50 py-3 px-4 rounded-t-lg">
                  <CardTitle className="text-lg font-semibold text-blue-700">Buat Geofence Baru</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Nama Geofence</label>
                    <Input
                      placeholder="Contoh: Kantor Pusat"
                      value={newGeofence.name}
                      onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Jenis Aturan</label>
                    <Select
                      value={newGeofence.ruleType}
                      onValueChange={(value) => setNewGeofence({...newGeofence, ruleType: value})}
                    >
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FORBIDDEN" className="text-sm">Terlarang Masuk</SelectItem>
                        <SelectItem value="STAY_IN" className="text-sm">Wajib Tetap di Dalam</SelectItem>
                        <SelectItem value="STANDARD" className="text-sm">Area Standar (Notifikasi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Mode Gambar Area di Peta</label>
                    <div className="flex gap-2">
                      <Button
                        variant={drawMode === "polygon" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDrawModeChange("polygon")}
                        className={`flex-1 text-xs ${drawMode === "polygon" ? 'bg-blue-600 text-white' : 'border-gray-300 text-gray-700'}`}
                      > <Square className="h-3.5 w-3.5 mr-1.5" /> Poligon </Button>
                      <Button
                        variant={drawMode === "circle" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDrawModeChange("circle")}
                        className={`flex-1 text-xs ${drawMode === "circle" ? 'bg-blue-600 text-white' : 'border-gray-300 text-gray-700'}`}
                      > <Circle className="h-3.5 w-3.5 mr-1.5" /> Lingkaran </Button>
                    </div>
                     {drawnLayers.length > 0 && <p className="text-xs text-green-600 mt-1.5">Area telah digambar di peta. Anda bisa edit atau hapus menggunakan tools di peta.</p>}
                     {drawnLayers.length === 0 && <p className="text-xs text-orange-600 mt-1.5">Pilih tool gambar di peta untuk memulai.</p>}
                  </div>

                  <div className="flex gap-2 pt-3 border-t mt-3">
                    <Button onClick={handleSaveGeofence} disabled={drawnLayers.length === 0 || !newGeofence.name.trim() || loading} size="sm" className="bg-green-500 hover:bg-green-600 text-white flex-1 text-xs">
                       {loading && drawnLayers.length > 0 ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div> Menyimpan...</> : <><Save className="h-3.5 w-3.5 mr-1.5" /> Simpan</>}
                    </Button>
                    <Button variant="outline" onClick={handleCancelCreatingGeofence} size="sm" className="border-gray-300 text-gray-700 flex-1 text-xs">
                      <X className="h-3.5 w-3.5 mr-1.5" /> Batal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {loading && geofences.length === 0 && !isCreatingGeofence && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">Memuat daftar geofence...</p>
                    </div>
                </div>
            )}

            {!loading && filteredGeofences.length === 0 && !isCreatingGeofence && (
              <Card className="flex-1 border-dashed border-gray-300 bg-gray-50 shadow-none">
                <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full">
                  <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    {searchTerm ? "Geofence Tidak Ditemukan" : "Belum Ada Geofence"}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                     {searchTerm ? `Tidak ada geofence yang cocok dengan "${searchTerm}".` : "Anda belum memiliki geofence. Klik tombol di atas atau di peta untuk membuat yang baru."}
                  </p>
                  <Button onClick={handleStartCreatingGeofence} className="bg-blue-500 hover:bg-blue-600 text-sm" disabled={!mapReady}>
                    <Plus className="h-4 w-4 mr-2" />
                    Buat Geofence di Peta
                  </Button>
                </CardContent>
              </Card>
            )}

            {filteredGeofences.length > 0 && (
            <div className="flex-1 overflow-auto space-y-2 pr-1 custom-scrollbar">
                {filteredGeofences.map((geofence) => (
                  <Card
                    key={geofence.geofence_id}
                    className={`cursor-pointer transition-all duration-150 ease-in-out hover:shadow-md border rounded-lg overflow-hidden ${
                      currentGeofence?.geofence_id === geofence.geofence_id
                        ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-400 shadow-md'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                        if (validateGeofenceCoordinates(geofence)) {
                            // setCurrentGeofence(geofence); // zoomToGeofence sets it
                            setIsCreatingGeofence(false);
                            zoomToGeofence(geofence);
                        } else {
                            toast.error(`Geofence "${geofence.name}" memiliki koordinat tidak valid dan tidak dapat ditampilkan.`);
                        }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 text-sm truncate" title={geofence.name}>
                            {geofence.name}
                          </h3>
                        </div>
                        <Badge className={`${getStatusColor(geofence.status)} ml-2 text-xs px-1.5 py-0.5`}>
                            {geofence.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge className={`${getRuleTypeColor(geofence.rule_type)} text-xs px-1.5 py-0.5`}>
                          {formatRuleType(geofence.rule_type)}
                        </Badge>
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-gray-300 text-gray-600">
                           {geofence.type === 'circle' ? 'Lingkaran' : 'Poligon'}
                        </Badge>
                      </div>
                       <p className="text-xs text-gray-500 mb-2">
                          Dibuat: {new Date(geofence.date_created).toLocaleDateString('id-ID')}
                       </p>
                      <div className="flex gap-1.5 items-center justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleAssignGeofence(geofence); }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-gray-300 h-7 w-7"
                          title="Assign Kendaraan"
                        > <Car className="h-3.5 w-3.5" /> </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(geofence.geofence_id); }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-300 h-7 w-7"
                          title="Hapus Geofence"
                        > <Trash2 className="h-3.5 w-3.5" /> </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            )}
          </div>

          <div className={`lg:col-span-2 h-full min-h-[400px] border rounded-xl overflow-hidden shadow-xl ${isCreatingGeofence ? 'ring-2 ring-offset-2 ring-blue-500' : 'border-gray-200'}`}>
             {!mapReady && (
                <div className="h-full flex items-center justify-center bg-gray-100 rounded-xl">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-5"></div>
                        <p className="text-gray-700 text-lg">Memuat Peta Interaktif...</p>
                    </div>
                </div>
            )}
            {mapReady && (
              <MapWithDrawing
                key={`desktop-map-${mapKey}-${currentGeofence?.geofence_id || 'new'}-${isCreatingGeofence}`}
                center={getGeofenceCenter(isCreatingGeofence && !currentGeofence ? null : currentGeofence)}
                zoom={isCreatingGeofence && !currentGeofence ? 5 : (currentGeofence ? 13 : 5)}
                drawMode={isCreatingGeofence ? drawMode : undefined}
                onDrawCreated={isCreatingGeofence ? handleDrawCreated : undefined}
                onDrawEdited={isCreatingGeofence ? handleDrawEdited : undefined}
                onDrawDeleted={isCreatingGeofence ? handleDrawDeleted : undefined}
                viewOnly={!isCreatingGeofence}
                geofences={isCreatingGeofence ? [] : (currentGeofence ? [currentMapGeofence].filter(Boolean) as Geofence[] : mapGeofences as Geofence[])}
                selectedGeofence={isCreatingGeofence ? null : currentMapGeofence} // Only show selected if not creating
                isCreating={isCreatingGeofence}
                {...(isCreatingGeofence ? { drawnLayersForEditing: drawnLayers } : {})}
              />
            )}
          </div>
        </div>
      )}

      {/* View Geofence Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-lg">
          <DialogHeader className="px-6 py-4 border-b bg-gray-50 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-800">
              <Shield className="h-6 w-6 text-blue-600" />
              Detail Geofence: {currentGeofence?.name}
            </DialogTitle>
            {currentGeofence && <DialogDescription className="text-sm text-gray-600">ID: {currentGeofence.geofence_id}</DialogDescription>}
          </DialogHeader>

          {currentGeofence && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0"> {/* No gap for continuous sections */}
            <div className="md:col-span-2 p-5 border-r-0 md:border-r border-gray-200 bg-white">
              <Card className="shadow-none border-none">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="text-lg font-medium text-gray-700">Informasi Geofence</CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Nama</label>
                    <p className="text-gray-800 font-semibold">{currentGeofence?.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Jenis Area</label>
                        <Badge variant="outline" className="border-gray-300 text-gray-700">
                        {currentGeofence?.type === 'circle' ? 'Lingkaran' : 'Poligon'}
                        </Badge>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Status</label>
                        <Badge className={`${currentGeofence ? getStatusColor(currentGeofence.status) : ''} text-xs`}>
                        {currentGeofence?.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                        </Badge>
                    </div>
                  </div>
                   <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Aturan</label>
                    <Badge className={`${currentGeofence ? getRuleTypeColor(currentGeofence.rule_type) : ''} text-xs`}>
                      {currentGeofence ? formatRuleType(currentGeofence.rule_type) : ''}
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Tanggal Dibuat</label>
                    <p className="text-gray-700">
                      {currentGeofence ? new Date(currentGeofence.date_created).toLocaleString('id-ID', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : ''}
                    </p>
                  </div>

                  {currentGeofence?.type === 'circle' && currentGeofence.definition.radius !== undefined && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-0.5">Radius</label>
                      <p className="text-gray-700">
                        {Math.round(currentGeofence.definition.radius)} meter
                      </p>
                    </div>
                  )}
                   {currentGeofence?.type === 'circle' && currentGeofence.definition.center && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-0.5">Pusat Lingkaran (Lng, Lat)</label>
                      <p className="text-gray-700">
                        {currentGeofence.definition.center[0].toFixed(5)}, {currentGeofence.definition.center[1].toFixed(5)}
                      </p>
                    </div>
                  )}
                   {currentGeofence?.definition?.coordinates && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-0.5">Jumlah Titik Koordinat</label>
                      <p className="text-gray-700">
                        {currentGeofence.definition.coordinates[0].length} titik
                      </p>
                    </div>
                  )}


                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-3 p-1 md:p-2 bg-gray-100">
              <div className="h-[300px] md:h-[450px] lg:h-[500px] border rounded-md overflow-hidden shadow-inner">
                  {currentGeofence && mapReady && validateGeofenceCoordinates(currentGeofence) && ( // check valid coords
                            <MapWithDrawing
                                key={`view-dialog-map-${currentGeofence.geofence_id}-${mapKey}`} // Add mapKey to force re-render if needed
                                center={getGeofenceCenter(currentGeofence)}
                                zoom={14} // Default zoom for detail view
                                viewOnly={true}
                                geofences={[currentMapGeofence].filter(Boolean) as Geofence[]}
                                selectedGeofence={currentMapGeofence}
                                isCreating={false}
                            />
                  )}
                  {(!currentGeofence || !validateGeofenceCoordinates(currentGeofence)) && mapReady && (
                     <div className="h-full flex items-center justify-center bg-gray-50">
                        <p className="text-red-500 p-4 text-center">Tidak dapat menampilkan peta karena data koordinat geofence tidak valid atau tidak lengkap.</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
          )}

          <DialogFooter className="px-6 py-3 border-t bg-gray-50 rounded-b-lg flex justify-end">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} size="sm">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Vehicle Assignment Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[50000] bg-white border shadow-2xl rounded-lg p-0">
            <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Car className="h-5 w-5 text-blue-600" />
                Assign Kendaraan ke "{currentGeofence?.name}"
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
                Pilih kendaraan yang akan dipantau dalam geofence ini. Kendaraan hanya bisa terhubung ke satu geofence.
            </DialogDescription>
            </DialogHeader>
            
            <div className="p-5"> {/* Reduced py-4 to p-5 for content padding */}
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar"> {/* Added custom-scrollbar if you have one */}
                {loading && vehicles.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div>
                        <p>Memuat daftar kendaraan...</p>
                    </div>
                )}
                {!loading && vehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Tidak ada kendaraan tersedia</p>
                    <p className="text-xs">Silakan tambahkan kendaraan terlebih dahulu.</p>
                </div>
                ) : (
                <div className="space-y-2.5"> {/* Increased spacing */}
                    {vehicles.map((vehicle) => {
                    const isCurrentlyAssignedToThisGeofence = vehicle.geofence_id === currentGeofence?.geofence_id.toString();
                    const isAssignedToOtherGeofence = vehicle.geofence_id && vehicle.geofence_id !== currentGeofence?.geofence_id.toString();
                    const geofenceThisVehicleIsAssignedTo = isAssignedToOtherGeofence ? geofences.find(g => g.geofence_id.toString() === vehicle.geofence_id) : null;

                    return (
                        <div 
                            key={vehicle.vehicle_id} 
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-all duration-150 ease-in-out ${
                            selectedVehicles.includes(vehicle.vehicle_id) 
                                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' 
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                            } ${isAssignedToOtherGeofence ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={isAssignedToOtherGeofence ? (e) => {
                                e.preventDefault(); // Prevent selection if assigned elsewhere
                                toast.error(`${vehicle.name} sudah di-assign ke geofence "${geofenceThisVehicleIsAssignedTo?.name || 'lain'}". Lepaskan dulu untuk assign ke sini.`);
                            } : () => handleVehicleSelectionChange(vehicle.vehicle_id)}
                        >
                            <Checkbox 
                                id={`vehicle-assign-${vehicle.vehicle_id}`} // Unique ID for checkbox
                                checked={selectedVehicles.includes(vehicle.vehicle_id)}
                                onCheckedChange={isAssignedToOtherGeofence ? undefined : () => handleVehicleSelectionChange(vehicle.vehicle_id)}
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shrink-0"
                                disabled={isAssignedToOtherGeofence}
                            />
                            <label 
                                htmlFor={`vehicle-assign-${vehicle.vehicle_id}`} // Match checkbox ID
                                className={`flex-1 ${isAssignedToOtherGeofence ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                            <div className="font-medium text-gray-800 text-sm">{vehicle.name}</div>
                            <div className="text-xs text-gray-500">
                                {vehicle.license_plate} • {vehicle.make} {vehicle.model} ({vehicle.year})
                            </div>
                            {vehicle.gps_id && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                GPS ID: {vehicle.gps_id}
                                </div>
                            )}
                            </label>
                            <div className="flex flex-col items-end gap-1">
                                {isCurrentlyAssignedToThisGeofence && (
                                    <div className="flex items-center gap-1">
                                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-1.5 py-0.5">
                                            Terassign di sini
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Apakah Anda yakin ingin melepaskan assignment kendaraan ${vehicle.name} dari geofence ini?`)) {
                                                    updateVehicleGeofence(vehicle.vehicle_id, null).then(success => {
                                                        if (success) {
                                                            toast.success(`Berhasil melepaskan assignment kendaraan ${vehicle.name}`);
                                                            const userId = currentUser?.id || currentUser?.user_id;
                                                            if (userId) fetchVehicles(userId);
                                                            setSelectedVehicles(prev => prev.filter(id => id !== vehicle.vehicle_id));
                                                        } else {
                                                            toast.error(`Gagal melepaskan assignment kendaraan ${vehicle.name}`);
                                                        }
                                                    });
                                                }
                                            }}
                                            title="Lepaskan assignment"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                {isAssignedToOtherGeofence && (
                                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-1.5 py-0.5 whitespace-nowrap">
                                        Di Geofence lain
                                        {geofenceThisVehicleIsAssignedTo && <span className="font-semibold ml-1">({geofenceThisVehicleIsAssignedTo.name})</span>}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    );
                    })}
                </div>
                )}
            </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-lg">
            <div className="text-sm text-gray-600 mb-2 sm:mb-0">
                {selectedVehicles.length} dari {vehicles.filter(v => !v.geofence_id || v.geofence_id === currentGeofence?.geofence_id.toString()).length} kendaraan dapat dipilih
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <DialogClose asChild>
                <Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none border-gray-300 text-gray-700">
                    Batal
                </Button>
                </DialogClose>
                <Button 
                    type="button" 
                    onClick={assignGeofenceToVehicles} 
                    disabled={loading} // Only main loading state for the button
                    size="sm"
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow hover:shadow-md"
                >
                {loading ? ( // Use local loading state for button if preferred or passed as prop
                    <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Menyimpan...
                    </>
                ) : (
                    <>
                    <Save className="h-4 w-4 mr-2" />
                    Simpan Assignment
                    </>
                )}
                </Button>
            </div>
            </DialogFooter>
        </DialogContent>
        </Dialog>
    </div>
  );
}