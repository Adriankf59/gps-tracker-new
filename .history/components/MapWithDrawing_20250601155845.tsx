"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
// Import L directly for type usage and direct calls if needed
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet';

// Import types only
interface Geofence {
  geofence_id: number;
  user_id: string | null;
  name: string;
  type: "circle" | "polygon" | "multipolygon";
  rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  status: "active" | "inactive";
  definition: {
    coordinates?: number[][][];
    center?: number[]; // [lng, lat] for consistency with GeoJSON-like structures
    radius?: number;
    type: string; // e.g., "Polygon", "Circle"
  };
  date_created: string;
}

interface MapWithDrawingProps {
  center: [number, number]; // [lat, lng] for Leaflet
  zoom: number;
  drawMode?: "polygon" | "circle";
  onDrawCreated?: (e: any) => void;
  onDrawEdited?: (e: any) => void;
  onDrawDeleted?: (e: any) => void;
  ruleType?: string;
  viewOnly?: boolean;
  geofence?: Geofence;
  geofences?: Geofence[];
  isCreating?: boolean;
  selectedGeofence?: Geofence | null;
  onMapReady?: (map: LeafletMap) => void; // Use LeafletMap type
  drawnLayersForEditing?: L.Layer[];
}


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
  const mapZoomTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null); // Use LeafletMap type
  const featureGroupRef = useRef<L.FeatureGroup | null>(null); // Use L.FeatureGroup

  const validateCoordinates = (coords: any): [number, number] | null => {
      try {
          if (!coords || !Array.isArray(coords) || coords.length !== 2) {
              // console.warn('Invalid coordinates array:', coords);
              return null;
          }
          const [lat, lng] = coords;
          const numLat = Number(lat);
          const numLng = Number(lng);
          if (isNaN(numLat) || isNaN(numLng) || !isFinite(numLat) || !isFinite(numLng)) {
              // console.warn('Invalid coordinate values:', lat, lng);
              return null;
          }
          if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
              // console.warn('Coordinates out of valid range:', numLat, numLng);
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
        // console.log('🗺️ Starting to load map components...');
        if (typeof window === 'undefined') {
          // console.log('🚫 Not in browser environment');
          return;
        }

        const [
          reactLeaflet,
          leafletDraw,
        ] = await Promise.all([
          import('react-leaflet'),
          import('react-leaflet-draw'),
        ]);
        // console.log('✅ Loaded libraries successfully');

        // CSS should be imported globally in _app.tsx or layout.tsx
        // await import('leaflet/dist/leaflet.css');
        // await import('leaflet-draw/dist/leaflet.draw.css');
        // console.log('✅ CSS should be pre-loaded globally');

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png', // Ensure these paths are correct in your public folder
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });
        // console.log('✅ Fixed icons successfully');

        function getRuleTypeColor(ruleType: string) {
            switch (ruleType) {
                case 'FORBIDDEN': return '#ef4444';
                case 'STAY_IN': return '#3b82f6';
                case 'STANDARD': return '#10b981';
                default: return '#6b7280';
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

        function GeofenceDisplay({ geofenceItem, isSelected }: { geofenceItem: Geofence, isSelected: boolean }) {
            // console.log(`🏑 Rendering ${isSelected ? 'SELECTED' : ''} geofence: ${geofenceItem.name} (${geofenceItem.geofence_id})`);
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
                if (geofenceItem.type === 'circle' && geofenceItem.definition.center && geofenceItem.definition.radius) {
                    const [lng, lat] = geofenceItem.definition.center;
                    const validatedCenter = validateCoordinates([Number(lat), Number(lng)]); // Leaflet uses [lat, lng]
                    const radius = Number(geofenceItem.definition.radius);
                    if (validatedCenter && radius > 0) {
                        return (
                            <reactLeaflet.Circle center={validatedCenter} radius={radius} pathOptions={pathOptions}>
                                <reactLeaflet.Popup>{popupContent}</reactLeaflet.Popup>
                            </reactLeaflet.Circle>
                        );
                    }
                }

                if ((geofenceItem.type === 'polygon' || geofenceItem.type === 'multipolygon' || geofenceItem.type === 'circle')
                     && geofenceItem.definition.coordinates) {
                    const coords = geofenceItem.definition.coordinates;
                    if (!coords || !Array.isArray(coords) || !coords[0] || !Array.isArray(coords[0])) {
                        console.warn('⚠️ Invalid polygon structure:', geofenceItem);
                        return null;
                    }
                    const positions = coords[0].map((coord: number[]) => {
                        if (!coord || !Array.isArray(coord) || coord.length < 2) return null;
                        const [lng, lat] = coord;
                        return validateCoordinates([Number(lat), Number(lng)]); // Leaflet uses [lat, lng]
                    }).filter(p => p !== null) as [number, number][];

                    if (positions.length >= 3) {
                        return (
                            <reactLeaflet.Polygon positions={positions} pathOptions={pathOptions}>
                                <reactLeaflet.Popup>{popupContent}</reactLeaflet.Popup>
                            </reactLeaflet.Polygon>
                        );
                    } else {
                         // console.warn('⚠️ Insufficient valid points for polygon:', geofenceItem.name, positions);
                    }
                }
            } catch (err) {
                console.error(`❌ Error rendering geofence ${geofenceItem.geofence_id}:`, err, geofenceItem);
                // setError(`Error rendering geofence: ${geofenceItem.name}`); // Avoid setting state in render function
            }
            return null;
        }

        function DrawControlWrapper({ drawMode: currentDrawMode, onCreated, onEdited, onDeleted, isCreating: currentlyCreating }) {
            const fgRef = useRef<L.FeatureGroup>(null); // Typed ref
            featureGroupRef.current = fgRef.current; // Assign to outer ref

            if (!currentlyCreating || viewOnly) { // Disable drawing if viewOnly is true
                return <reactLeaflet.FeatureGroup ref={fgRef} />;
            }
            
            const drawOptions: any = { // Use any for drawOptions if specific types are complex
                polyline: false,
                rectangle: false,
                circlemarker: false,
                marker: false,
                polygon: currentDrawMode === 'polygon',
                circle: currentDrawMode === 'circle',
            };
            if (currentDrawMode === 'polygon') drawOptions.polygon = { shapeOptions: { color: '#f06eaa' } };
            if (currentDrawMode === 'circle') drawOptions.circle = { shapeOptions: { color: '#f06eaa' } };
            
            return (
                <reactLeaflet.FeatureGroup ref={fgRef}>
                    <leafletDraw.EditControl
                        position="topright"
                        onCreated={onCreated}
                        onEdited={onEdited}
                        onDeleted={onDeleted}
                        draw={drawOptions}
                        edit={{
                            featureGroup: fgRef.current!, // Non-null assertion if sure it will be set
                            remove: true,
                            edit: true,
                        }}
                    />
                </reactLeaflet.FeatureGroup>
            );
        }

        function MapController({ center: currentCenter, zoom: currentZoom }) {
            const map = reactLeaflet.useMap();
            mapRef.current = map;
            
            useEffect(() => {
                if (map && onMapReady) {
                    // console.log('🗺️ Map is ready, calling onMapReady callback');
                    onMapReady(map);
                }
            }, [map]); // Removed onMapReady from deps to avoid re-trigger if onMapReady changes

            useEffect(() => {
                const validatedCenter = validateCoordinates(currentCenter) || [-6.2088, 106.8456];
                const validZoom = Number(currentZoom);
                const finalZoom = isNaN(validZoom) ? 5 : validZoom;
                
                // console.log(`🗺️ Setting map view with center: ${validatedCenter}, zoom: ${finalZoom}`);
                
                if (mapZoomTimerRef.current) {
                    clearTimeout(mapZoomTimerRef.current);
                }
                map.setView(validatedCenter, finalZoom, { animate: false });
                
                mapZoomTimerRef.current = setTimeout(() => {
                    if (map.getZoom() !== finalZoom) {
                        // console.log(`🗺️ Zoom was changed to ${map.getZoom()}, resetting to ${finalZoom}`);
                        map.setView(validatedCenter, finalZoom, { animate: false });
                    }
                    // console.log(`🗺️ Final map zoom is: ${map.getZoom()}`);
                }, 500);
            }, [currentCenter, currentZoom, map]);

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
          // console.log('✅ Map components set successfully');
        }
      } catch (err: any) {
        console.error('❌ Error loading map components:', err);
        if (mounted) {
          setError(`Gagal memuat komponen peta: ${err.message}`);
        }
      }
    };

    const timer = setTimeout(() => {
        loadMapComponents();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (mapZoomTimerRef.current) {
          clearTimeout(mapZoomTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
      if (!mapRef.current || !MapComponents) return;

      const map = mapRef.current;
      const fg = featureGroupRef.current;

      if (isCreating && fg) {
          // Hapus layer lama saat mode pembuatan dimulai atau drawMode berubah
          fg.clearLayers();
          console.log("Drawing mode: Cleared previous layers for new drawing.");
      }

      // Focus logic
      let targetBounds: L.LatLngBounds | null = null;

      if (selectedGeofence && validateCoordinates(getGeofenceCenter(selectedGeofence))) {
          targetBounds = getGeofenceBounds(selectedGeofence);
          console.log(`🎯 Prioritas 1: Fokus pada geofence terpilih ${selectedGeofence.name}`, targetBounds);
      } else if (viewOnly && geofence && validateCoordinates(getGeofenceCenter(geofence))) {
          targetBounds = getGeofenceBounds(geofence);
          console.log(`🎯 Prioritas 2: Fokus pada geofence view-only ${geofence.name}`, targetBounds);
      } else if (!isCreating && geofences.length > 0) {
          const allValidGeofences = geofences.filter(gf => validateCoordinates(getGeofenceCenter(gf)));
          if (allValidGeofences.length > 0) {
              targetBounds = L.latLngBounds([]); // Inisialisasi bounds kosong
              allValidGeofences.forEach(gf => {
                  const bounds = getGeofenceBounds(gf);
                  if (bounds && bounds.isValid()) {
                      targetBounds!.extend(bounds);
                  }
              });
              console.log(`🌍 Prioritas 3: Menyesuaikan dengan semua ${allValidGeofences.length} geofence`, targetBounds);
          }
      }
      
      if (targetBounds && targetBounds.isValid()) {
          console.log(`🗺️ Menyesuaikan peta ke bounds:`, targetBounds.toBBoxString());
          map.fitBounds(targetBounds, { padding: [50, 50], maxZoom: 16, animate: true });
      } else if (isCreating) {
          // Jika membuat baru dan tidak ada fokus, gunakan center dan zoom dari props
          const validatedCenter = validateCoordinates(center) || [-6.2088, 106.8456];
          const finalZoom = isNaN(Number(zoom)) ? 5 : Number(zoom);
          console.log(`✨ Mode pembuatan, set view ke: ${validatedCenter}, zoom: ${finalZoom}`);
          map.setView(validatedCenter, finalZoom);
      }

  }, [selectedGeofence, geofences, geofence, viewOnly, isCreating, MapComponents, center, zoom]); // Tambahkan center dan zoom


  function getGeofenceBounds(gf: Geofence): L.LatLngBounds | null {
      if (!gf || !gf.definition) return null;
      try {
          if (gf.type === 'circle' && gf.definition.center && typeof gf.definition.radius === 'number') {
              const [lng, lat] = gf.definition.center;
              const validatedCenter = validateCoordinates([Number(lat), Number(lng)]);
              if (validatedCenter) return L.circle(validatedCenter, { radius: gf.definition.radius }).getBounds();
          }
          if ((gf.type === 'polygon' || gf.type === 'multipolygon' || gf.type === 'circle') && gf.definition.coordinates && gf.definition.coordinates[0]) {
              const positions = gf.definition.coordinates[0]
                  .map(c => validateCoordinates([c[1], c[0]]))
                  .filter((p): p is [number, number] => p !== null);
              if (positions.length >= 3) return L.polygon(positions).getBounds();
          }
      } catch (e) {
          console.error("Error getting bounds for geofence:", gf.name, e);
      }
      return null;
  }

  function getGeofenceCenter(gf: Geofence): [number, number] | null {
      if (!gf || !gf.definition) return null;
      if (gf.type === 'circle' && gf.definition.center) {
          const [lng, lat] = gf.definition.center;
          return validateCoordinates([Number(lat), Number(lng)]);
      }
      if ((gf.type === 'polygon' || gf.type === 'multipolygon') && gf.definition.coordinates && gf.definition.coordinates[0] && gf.definition.coordinates[0].length > 0) {
          // Ambil titik pertama sebagai "pusat" kasar atau hitung centroid jika perlu
          const [lng, lat] = gf.definition.coordinates[0][0];
          return validateCoordinates([Number(lat), Number(lng)]);
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
          <p className="text-gray-600">Memuat komponen peta...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, DrawControl, GeofenceDisplay, MapController, FeatureGroup } = MapComponents;

  const finalCenter = validateCoordinates(center) || [-6.2088, 106.8456]; // Default ke Jakarta jika tidak valid
  const finalZoom = isNaN(Number(zoom)) ? 5 : Number(zoom);


  return (
    <div ref={mapContainerRef} className="h-full w-full rounded-md overflow-hidden">
      <MapContainer
        center={finalCenter}
        zoom={finalZoom}
        style={{ width: '100%', height: '100%' }}
        // whenReady={(map: LeafletMap) => { mapRef.current = map; }} // whenReady juga bisa digunakan di sini jika tipe benar
        ref={mapRef} // Menggunakan ref untuk mendapatkan instance peta
      >
        <MapController center={finalCenter} zoom={finalZoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FeatureGroup ref={featureGroupRef}> {/* Gunakan FeatureGroup yang direferensikan */}
            {/* Render selected geofence with higher emphasis if not creating */}
            {!isCreating && selectedGeofence && validateCoordinates(getGeofenceCenter(selectedGeofence)) && (
                <GeofenceDisplay
                    key={`selected-${selectedGeofence.geofence_id}-${Date.now()}`} // Unique key
                    geofenceItem={selectedGeofence}
                    isSelected={true}
                />
            )}

            {/* Render all other geofences (or all if no selection and not creating) */}
            {!isCreating && geofences && geofences.map(gf => {
                if (selectedGeofence && gf.geofence_id === selectedGeofence.geofence_id) return null; // Sudah dirender di atas
                if (!validateCoordinates(getGeofenceCenter(gf))) return null; // Validasi sebelum render
                // console.log(`Rendering unselected geofence: ${gf.name}`);
                return (
                    <GeofenceDisplay
                        key={`all-${gf.geofence_id}`}
                        geofenceItem={gf}
                        isSelected={false}
                    />
                );
            })}

            {/* Render single geofence in viewOnly mode */}
            {viewOnly && geofence && validateCoordinates(getGeofenceCenter(geofence)) && (!selectedGeofence || geofence.geofence_id !== selectedGeofence.geofence_id) && (
                 <GeofenceDisplay
                    key={`single-view-${geofence.geofence_id}`}
                    geofenceItem={geofence}
                    isSelected={true} // Single view geofence is always "selected" for display
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