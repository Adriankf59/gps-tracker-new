"use client";

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet'; // Import L directly

// Import types only
interface Geofence {
  geofence_id: number;
  user_id: string | null; // Allow null
  name: string;
  type: "circle" | "polygon" | "multipolygon"; // Add multipolygon
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

interface MapWithDrawingProps {
  center: [number, number];
  zoom: number;
  drawMode?: "polygon" | "circle";
  onDrawCreated?: (e: any) => void;
  onDrawEdited?: (e: any) => void;
  onDrawDeleted?: (e: any) => void;
  ruleType?: string;
  viewOnly?: boolean;
  geofence?: Geofence; // For single view
  geofences?: Geofence[]; // For multiple view
  isCreating?: boolean; // To control drawing/viewing modes
  selectedGeofence?: Geofence | null; // To highlight a geofence


export default function MapWithDrawing({
  center,
  zoom = 5,
  drawMode = "polygon",
  onDrawCreated,
  onDrawEdited,
  onDrawDeleted,
  ruleType = "FORBIDDEN",
  viewOnly = false,
  geofence,
  geofences = [],
  isCreating = false,
  selectedGeofence = null,
  onMapReady,
}: MapWithDrawingProps) {
  // Timer reference for managing zoom operations
  const mapZoomTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const featureGroupRef = useRef<any>(null);

  // Helper function to validate coordinates [lat, lng]
  const validateCoordinates = (coords: any): [number, number] | null => {
      try {
          if (!coords || !Array.isArray(coords) || coords.length !== 2) {
              console.warn('Invalid coordinates array:', coords);
              return null;
          }

          const [lat, lng] = coords;
          const numLat = Number(lat);
          const numLng = Number(lng);

          if (isNaN(numLat) || isNaN(numLng) || !isFinite(numLat) || !isFinite(numLng)) {
              console.warn('Invalid coordinate values:', lat, lng);
              return null;
          }

          if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
              console.warn('Coordinates out of valid range:', numLat, numLng);
              return null;
          }

          return [numLat, numLng];
      } catch (e) {
          console.error('Error validating coordinates:', e, coords);
          return null;
      }
  };


  useEffect(() => {
    let mounted = true;

    const loadMapComponents = async () => {
      try {
        console.log('🗺️ Starting to load map components...');

        if (typeof window === 'undefined') {
          console.log('🚫 Not in browser environment');
          return;
        }

        const [
          reactLeaflet,
          leafletDraw,
          // L is imported directly now
        ] = await Promise.all([
          import('react-leaflet'),
          import('react-leaflet-draw'),
        ]);
        console.log('✅ Loaded libraries successfully');

        await import('leaflet/dist/leaflet.css');
        await import('leaflet-draw/dist/leaflet.draw.css');
        console.log('✅ Loaded CSS successfully');

        delete (L as any).Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });
        console.log('✅ Fixed icons successfully');

        // --- Helper Functions ---
        function getRuleTypeColor(ruleType: string) {
            switch (ruleType) {
                case 'FORBIDDEN': return '#ef4444'; // red-500
                case 'STAY_IN': return '#3b82f6'; // blue-500
                case 'STANDARD': return '#10b981'; // green-500
                default: return '#6b7280'; // gray-500
            }
        }

        function formatRuleType(ruleType: string) {
            switch (ruleType) {
                case 'FORBIDDEN': return 'Terlarang';
                case 'STAY_IN': return 'Tetap di Dalam';
                case 'STANDARD': return 'Standar';
                default: return ruleType;
            }
        }

        // --- Sub-Components ---
        function GeofenceDisplay({ geofenceItem, isSelected }: { geofenceItem: Geofence, isSelected: boolean }) {
            console.log(`🏑 Rendering ${isSelected ? 'SELECTED' : 'regular'} geofence: ${geofenceItem.name} (${geofenceItem.geofence_id})`);
            if (!geofenceItem?.definition) return null;

            const color = getRuleTypeColor(geofenceItem.rule_type);
            const pathOptions = {
                fillColor: color,
                fillOpacity: isSelected ? 0.5 : 0.2,
                color: color,
                weight: isSelected ? 3 : 2,
            };
            const popupContent = `<strong>${geofenceItem.name}</strong><br />Tipe: ${formatRuleType(geofenceItem.rule_type)}`;

            try {
                // Handle Circle (using center/radius if available)
                if (geofenceItem.type === 'circle' && geofenceItem.definition.center && geofenceItem.definition.radius) {
                    const [lng, lat] = geofenceItem.definition.center;
                    const validatedCenter = validateCoordinates([Number(lat), Number(lng)]);
                    const radius = Number(geofenceItem.definition.radius);

                    if (validatedCenter && radius > 0) {
                        return (
                            <reactLeaflet.Circle center={validatedCenter} radius={radius} pathOptions={pathOptions}>
                                <reactLeaflet.Popup>{popupContent}</reactLeaflet.Popup>
                            </reactLeaflet.Circle>
                        );
                    }
                }

                // Handle Polygon, Multipolygon, or Circle represented as Polygon
                // Check if type is polygon OR multipolygon OR (circle AND coordinates exist)
                if ((geofenceItem.type === 'polygon' || geofenceItem.type === 'multipolygon' || geofenceItem.type === 'circle')
                     && geofenceItem.definition.coordinates) {
                    const coords = geofenceItem.definition.coordinates;

                    if (!coords || !Array.isArray(coords) || !coords[0] || !Array.isArray(coords[0])) {
                        console.warn('⚠️ Invalid polygon structure:', geofenceItem);
                        return null;
                    }

                    // Map over coords[0] (the ring)
                    const positions = coords[0].map((coord: number[]) => {
                        if (!coord || !Array.isArray(coord) || coord.length < 2) {
                            console.warn('⚠️ Invalid coordinate point:', coord, 'in', geofenceItem);
                            return null;
                        }
                        const [lng, lat] = coord;
                        return validateCoordinates([Number(lat), Number(lng)]);
                    }).filter(p => p !== null) as [number, number][];

                    if (positions.length >= 3) {
                        return (
                            <reactLeaflet.Polygon positions={positions} pathOptions={pathOptions}>
                                <reactLeaflet.Popup>{popupContent}</reactLeaflet.Popup>
                            </reactLeaflet.Polygon>
                        );
                    } else {
                         console.warn('⚠️ Insufficient valid points for polygon:', geofenceItem);
                    }
                }
            } catch (err) {
                console.error(`❌ Error rendering geofence ${geofenceItem.geofence_id}:`, err, geofenceItem);
                setError(`Error rendering geofence: ${geofenceItem.name}`);
            }

            return null;
        }

        function DrawControlWrapper({ drawMode, onCreated, onEdited, onDeleted, isCreating }) {
            const fgRef = useRef<any>(null);
            featureGroupRef.current = fgRef;

            if (!isCreating) {
                return <reactLeaflet.FeatureGroup ref={fgRef} />;
            }

            return (
                <reactLeaflet.FeatureGroup ref={fgRef}>
                    <leafletDraw.EditControl
                        position="topright"
                        onCreated={onCreated}
                        onEdited={onEdited}
                        onDeleted={onDeleted}
                        draw={{
                            polyline: false,
                            rectangle: false,
                            circlemarker: false,
                            marker: false,
                            polygon: drawMode === 'polygon',
                            circle: drawMode === 'circle',
                        }}
                        edit={{
                            featureGroup: fgRef.current,
                            remove: true,
                            edit: true,
                        }}
                    />
                </reactLeaflet.FeatureGroup>
            );
        }

        function MapController({ center, zoom }) {
            const map = reactLeaflet.useMap();
            mapRef.current = map;
            
            // Call onMapReady if provided
            useEffect(() => {
                if (map && onMapReady) {
                    console.log('🗺️ Map is ready, calling onMapReady callback');
                    onMapReady(map);
                }
            }, [map]);

            useEffect(() => {
                const validatedCenter = validateCoordinates(center) || [-6.2088, 106.8456];
                // Use zoom from props, ALWAYS respect it
                const validZoom = Number(zoom);
                const finalZoom = isNaN(validZoom) ? 5 : validZoom;
                
                console.log(`🗺️ Setting map view with center: ${validatedCenter}, zoom: ${finalZoom}`);
                
                // Clear any previous timeouts using ref to store the timer ID
                if (mapZoomTimerRef.current) {
                    clearTimeout(mapZoomTimerRef.current);
                }
                
                // First call to ensure immediate effect
                map.setView(validatedCenter, finalZoom, { animate: false });
                
                // Use a timer to ensure zoom is applied
                mapZoomTimerRef.current = setTimeout(() => {
                    // Check if zoom got overridden
                    if (map.getZoom() !== finalZoom) {
                        console.log(`🗺️ Zoom was changed to ${map.getZoom()}, resetting to ${finalZoom}`);
                        map.setView(validatedCenter, finalZoom, { animate: false });
                    }
                    
                    console.log(`🗺️ Final map zoom is: ${map.getZoom()}`);
                }, 500);
            }, [center, zoom, map]);

            return null;
        }

        if (mounted) {
          setMapComponents({
            MapContainer: reactLeaflet.MapContainer,
            TileLayer: reactLeaflet.TileLayer,
            DrawControl: DrawControlWrapper,
            GeofenceDisplay,
            MapController,
            FeatureGroup: reactLeaflet.FeatureGroup,
          });
          setIsClient(true);
          console.log('✅ Map components set successfully');
        }
      } catch (err: any) {
        console.error('❌ Error loading map components:', err);
        if (mounted) {
          setError(`Failed to load map: ${err.message}`);
        }
      }
    };

    const timer = setTimeout(() => {
        loadMapComponents();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  // --- Map Update Effects ---
   useEffect(() => {
      if (!mapRef.current) return; // Keep running even when creating
      
      console.log(`🔍 Map update effect running with ${geofences.length} geofences, selectedGeofence: ${selectedGeofence?.name || 'none'}`);

      // First priority: Selected geofence (from list)
      if (selectedGeofence) {
          console.log(`🎯 Focusing on selected geofence: ${selectedGeofence.name}`);
          const bounds = getGeofenceBounds(selectedGeofence);
          if (bounds && bounds.isValid()) {
              console.log(`✅ Found valid bounds for ${selectedGeofence.name}, fitting map`);
              mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              return;
          } else {
              console.log(`⚠️ Could not get valid bounds for ${selectedGeofence.name}`);
              const center = getGeofenceCenter(selectedGeofence);
              if (center) {
                  console.log(`🔍 Using center for ${selectedGeofence.name}: ${center}`);
                  mapRef.current.setView(center, 12);
                  return;
              }
          }
      }
      
      // Second priority: Single geofence in view-only mode
      if (viewOnly && geofence) {
          console.log(`🎯 View-only mode with geofence: ${geofence.name}`);
          const bounds = getGeofenceBounds(geofence);
          if (bounds && bounds.isValid()) {
              console.log(`✅ Found valid bounds for view-only geofence, fitting map`);
              mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              return;
          } else {
              const center = getGeofenceCenter(geofence);
              if (center) {
                  console.log(`🔍 Using center for view-only geofence: ${center}`);
                  mapRef.current.setView(center, 15);
                  return;
              }
          }
      }
      
      // Third priority: Fit all geofences if available
      if (geofences.length > 0 && !isCreating) {
          console.log(`🌍 Fitting ${geofences.length} geofences on map`);
          const allBounds = geofences
              .map(getGeofenceBounds)
              .filter((b): b is L.LatLngBounds => b !== null);

          if (allBounds.length > 0) {
              let targetBounds = allBounds[0];
              allBounds.slice(1).forEach(b => targetBounds.extend(b));
              if (targetBounds.isValid()) {
                  console.log(`✅ Fitting all geofences bounds`);
                  mapRef.current.fitBounds(targetBounds, { padding: [50, 50], maxZoom: 16 });
                  return;
              }
          }
      }

  }, [selectedGeofence, geofences, geofence, viewOnly, isCreating, MapComponents]); // Re-run when components are ready


  // --- Helper to get bounds ---
  function getGeofenceBounds(gf: Geofence): L.LatLngBounds | null {
      if (!gf || !gf.definition) return null;

       try {
            if (gf.type === 'circle' && gf.definition.center && gf.definition.radius) {
                const [lng, lat] = gf.definition.center;
                const center = validateCoordinates([Number(lat), Number(lng)]);
                if (center) return L.circle(center, { radius: gf.definition.radius }).getBounds();
            }

            if (gf.definition.coordinates) {
                const coords = gf.definition.coordinates[0];
                const latlngs = coords
                    .map(c => validateCoordinates([c[1], c[0]]))
                    .filter((p): p is [number, number] => p !== null);
                if (latlngs.length > 0) return L.polygon(latlngs).getBounds();
            }
       } catch (e) {
           console.error("Error getting bounds:", e, gf);
       }
      return null;
  }

   function getGeofenceCenter(gf: Geofence): [number, number] | null {
        if (!gf || !gf.definition) return null;
        if (gf.definition.center) {
            const [lng, lat] = gf.definition.center;
            return validateCoordinates([Number(lat), Number(lng)]);
        }
        if (gf.definition.coordinates) {
             const coords = gf.definition.coordinates[0];
             if(coords && coords[0]) {
                 const [lng, lat] = coords[0];
                 return validateCoordinates([Number(lat), Number(lng)]);
             }
        }
        return null;
   }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-red-50 p-4 rounded-md border border-red-200">
        <div className="text-center">
          <div className="text-red-600 text-2xl mb-2">⚠️</div>
          <p className="text-red-700 font-semibold">Map Loading Error</p>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-2">Please check the browser console for more details.</p>
        </div>
      </div>
    );
  }

  if (!isClient || !MapComponents) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map components...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, DrawControl, GeofenceDisplay, MapController, FeatureGroup } = MapComponents;

  const finalCenter = validateCoordinates(center) || [-6.2088, 106.8456];
  const finalZoom = isNaN(Number(zoom)) ? 5 : Number(zoom);

  return (
    <div ref={mapContainerRef} className="h-full w-full rounded-md overflow-hidden">
      <MapContainer
        center={finalCenter}
        zoom={finalZoom}
        style={{ width: '100%', height: '100%' }}
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
      >
        <MapController center={finalCenter} zoom={finalZoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FeatureGroup>
            {/* Always render selectedGeofence first with clear visibility */}
            {selectedGeofence && (
                <GeofenceDisplay 
                    key={`selected-${selectedGeofence.geofence_id}-${Date.now()}`}
                    geofenceItem={selectedGeofence}
                    isSelected={true}
                />
            )}

            {/* Render all geofences with reduced opacity */}
            {!viewOnly && geofences && geofences.filter(gf => !selectedGeofence || gf.geofence_id !== selectedGeofence.geofence_id).map(gf => {
                console.log(`Rendering geofence: ${gf.name} (ID: ${gf.geofence_id})`);
                return (
                    <GeofenceDisplay
                        key={`all-${gf.geofence_id}`}
                        geofenceItem={gf}
                        isSelected={false}
                    />
                );
            })}
            
            {/* Render single geofence *only* in single view mode */}
            {viewOnly && geofence && (
                <GeofenceDisplay
                    key={`single-${geofence.geofence_id}`}
                    geofenceItem={geofence}
                    isSelected={true}
                />
            )}
        </FeatureGroup>

        <DrawControl
            drawMode={drawMode}
            onCreated={onDrawCreated}
            onEdited={onDrawEdited}
            onDeleted={onDrawDeleted}
            isCreating={isCreating && !viewOnly}
        />

      </MapContainer>
    </div>
  );
}