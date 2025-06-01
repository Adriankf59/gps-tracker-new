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
  ruleType = "FORBIDDEN", // ruleType prop seems unused in this component
  viewOnly = false,
  geofence,
  geofences = [],
  isCreating = false,
  selectedGeofence = null,
  onMapReady,
  // drawnLayersForEditing prop seems unused in this component currently
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
              return null;
          }
          const [lat, lng] = coords;
          const numLat = Number(lat);
          const numLng = Number(lng);
          if (isNaN(numLat) || isNaN(numLng) || !isFinite(numLat) || !isFinite(numLng)) {
              return null;
          }
          if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
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
        if (typeof window === 'undefined') {
          return;
        }
        const [
          reactLeaflet,
          leafletDraw,
        ] = await Promise.all([
          import('react-leaflet'),
          import('react-leaflet-draw'),
        ]);

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });

        function getRuleTypeColor(ruleTypeProp: Geofence['rule_type']) {
            switch (ruleTypeProp) {
                case 'FORBIDDEN': return '#ef4444';
                case 'STAY_IN': return '#3b82f6';
                case 'STANDARD': return '#10b981';
                default: return '#6b7280';
            }
        }

        function formatRuleType(ruleTypeProp: Geofence['rule_type']) {
            switch (ruleTypeProp) {
                case 'FORBIDDEN': return 'Terlarang';
                case 'STAY_IN': return 'Tetap di Dalam';
                case 'STANDARD': return 'Standar';
                default: return String(ruleTypeProp);
            }
        }

        interface GeofenceDisplayProps {
            geofenceItem: Geofence;
            isSelected: boolean;
        }

        function GeofenceDisplay({ geofenceItem, isSelected }: GeofenceDisplayProps) {
            if (!geofenceItem?.definition) return null;
            const color = getRuleTypeColor(geofenceItem.rule_type);
            const pathOptions = {
                fillColor: color,
                fillOpacity: isSelected ? 0.5 : 0.2,
                color: color,
                weight: isSelected ? 3 : 2,
            };
            const popupContent = `<strong>${geofenceItem.name}</strong><br />Aturan: ${formatRuleType(geofenceItem.rule_type)}`;

            try {
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

                if ((geofenceItem.type === 'polygon' || geofenceItem.type === 'multipolygon' || geofenceItem.type === 'circle')
                     && geofenceItem.definition.coordinates) {
                    const coords = geofenceItem.definition.coordinates;
                    if (!coords || !Array.isArray(coords) || !coords[0] || !Array.isArray(coords[0])) {
                        return null;
                    }
                    const positions = coords[0].map((coord: number[]) => {
                        if (!coord || !Array.isArray(coord) || coord.length < 2) return null;
                        const [lng, lat] = coord;
                        return validateCoordinates([Number(lat), Number(lng)]);
                    }).filter(p => p !== null) as [number, number][];

                    if (positions.length >= 3) {
                        return (
                            <reactLeaflet.Polygon positions={positions} pathOptions={pathOptions}>
                                <reactLeaflet.Popup>{popupContent}</reactLeaflet.Popup>
                            </reactLeaflet.Polygon>
                        );
                    }
                }
            } catch (err) {
                console.error(`❌ Error rendering geofence ${geofenceItem.geofence_id}:`, err, geofenceItem);
            }
            return null;
        }

        interface DrawControlWrapperProps {
          drawMode?: "polygon" | "circle";
          onCreated?: (e: any) => void;
          onEdited?: (e: any) => void;
          onDeleted?: (e: any) => void;
          isCreating: boolean;
        }

        function DrawControlWrapper({
          drawMode: currentDrawMode,
          onCreated,
          onEdited,
          onDeleted,
          isCreating: currentlyCreating
        }: DrawControlWrapperProps) {
            const fgRef = useRef<L.FeatureGroup>(null);
            if (fgRef.current) { // Only assign if fgRef.current is not null
                featureGroupRef.current = fgRef.current;
            }


            if (!currentlyCreating || viewOnly) {
                return <reactLeaflet.FeatureGroup ref={fgRef} />;
            }
            
            // PERBAIKAN DI SINI: Hapus L.Control.DrawOptions
            const drawOptionsValue = {
                polyline: false,
                rectangle: false,
                circlemarker: false,
                marker: false,
                polygon: currentDrawMode === 'polygon' ? { shapeOptions: { color: '#f06eaa' } } : false,
                circle: currentDrawMode === 'circle' ? { shapeOptions: { color: '#f06eaa' } } : false,
            };
                        
            return (
                <reactLeaflet.FeatureGroup ref={fgRef}>
                    <leafletDraw.EditControl
                        position="topright"
                        onCreated={onCreated}
                        onEdited={onEdited}
                        onDeleted={onDeleted}
                        draw={drawOptionsValue}
                        edit={{
                            featureGroup: fgRef.current!,
                            remove: true,
                            edit: true,
                        }}
                    />
                </reactLeaflet.FeatureGroup>
            );
        }
        
        interface MapControllerProps {
            center: [number, number] | null;
            zoom: number;
        }

        function MapController({ center: currentCenter, zoom: currentZoom }: MapControllerProps) {
            const map = reactLeaflet.useMap();
            mapRef.current = map;
            
            useEffect(() => {
                if (map && onMapReady) {
                    onMapReady(map);
                }
            }, [map, onMapReady]);

            useEffect(() => {
                const validatedCenter = validateCoordinates(currentCenter) || [-6.2088, 106.8456];
                const validZoom = Number(currentZoom);
                const finalZoom = isNaN(validZoom) ? 5 : validZoom;
                
                if (mapZoomTimerRef.current) {
                    clearTimeout(mapZoomTimerRef.current);
                }
                map.setView(validatedCenter, finalZoom, { animate: false }); 
                
                mapZoomTimerRef.current = setTimeout(() => {
                    if (map.getZoom() !== finalZoom) {
                        // map.setView(validatedCenter, finalZoom, { animate: false });
                    }
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
      if (!mapRef.current || !MapComponents || !isClient) return;
      const map = mapRef.current;
      let targetBounds: L.LatLngBounds | null = null;
      let targetCenter: [number,number] | null = null;
      let targetZoom: number | null = null;

      if (selectedGeofence && validateCoordinates(getGeofenceCenter(selectedGeofence))) {
          targetBounds = getGeofenceBounds(selectedGeofence);
          if (!targetBounds || !targetBounds.isValid()) {
            targetCenter = getGeofenceCenter(selectedGeofence);
            targetZoom = 15;
          }
      } else if (viewOnly && geofence && validateCoordinates(getGeofenceCenter(geofence))) {
          targetBounds = getGeofenceBounds(geofence);
           if (!targetBounds || !targetBounds.isValid()) {
            targetCenter = getGeofenceCenter(geofence);
            targetZoom = 15;
          }
      } else if (!isCreating && geofences.length > 0) {
          const allValidGeofences = geofences.filter(gf => validateCoordinates(getGeofenceCenter(gf)));
          if (allValidGeofences.length > 0) {
              targetBounds = L.latLngBounds([]);
              allValidGeofences.forEach(gf => {
                  const bounds = getGeofenceBounds(gf);
                  if (bounds && bounds.isValid()) {
                      targetBounds!.extend(bounds);
                  }
              });
              if (!targetBounds.isValid() && allValidGeofences.length === 1) {
                  targetCenter = getGeofenceCenter(allValidGeofences[0]);
                  targetZoom = 15;
                  targetBounds = null;
              } else if (!targetBounds.isValid()) {
                  targetBounds = null;
              }
          }
      }
      
      if (targetBounds && targetBounds.isValid()) {
          map.fitBounds(targetBounds, { padding: [50, 50], maxZoom: 16, animate: true, duration: 0.5 });
      } else if (targetCenter && targetZoom !== null) {
          map.setView(targetCenter, targetZoom, {animate: true, duration: 0.5});
      } else if (isCreating) {
          const validatedCenter = validateCoordinates(center) || [-6.2088, 106.8456];
          const finalZoom = isNaN(Number(zoom)) ? 5 : Number(zoom);
          map.setView(validatedCenter, finalZoom);
      }

  }, [selectedGeofence, geofences, geofence, viewOnly, isCreating, MapComponents, center, zoom, isClient]);


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
                  .map(c => {
                      if (!Array.isArray(c) || c.length < 2) return null;
                      return validateCoordinates([Number(c[1]), Number(c[0])]);
                  })
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
          const firstPoint = gf.definition.coordinates[0][0];
          if (!Array.isArray(firstPoint) || firstPoint.length < 2) return null;
          const [lng, lat] = firstPoint;
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

  const finalCenter = validateCoordinates(center) || [-6.2088, 106.8456];
  const finalZoom = isNaN(Number(zoom)) ? 5 : Number(zoom);


  return (
    <div ref={mapContainerRef} className="h-full w-full rounded-md overflow-hidden">
      <MapContainer
        center={finalCenter}
        zoom={finalZoom}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
      >
        <MapController center={finalCenter} zoom={finalZoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FeatureGroup ref={featureGroupRef}>
            {!isCreating && selectedGeofence && validateCoordinates(getGeofenceCenter(selectedGeofence)) && (
                <GeofenceDisplay
                    key={`selected-${selectedGeofence.geofence_id}-${Date.now()}`}
                    geofenceItem={selectedGeofence}
                    isSelected={true}
                />
            )}
            {!viewOnly && geofences && geofences.filter(gf => !selectedGeofence || gf.geofence_id !== selectedGeofence.geofence_id).map(gf => {
                if (!validateCoordinates(getGeofenceCenter(gf))) return null;
                return (
                    <GeofenceDisplay
                        key={`all-${gf.geofence_id}`}
                        geofenceItem={gf}
                        isSelected={false}
                    />
                );
            })}
            {viewOnly && geofence && validateCoordinates(getGeofenceCenter(geofence)) && (!selectedGeofence || geofence.geofence_id !== selectedGeofence.geofence_id) && (
                 <GeofenceDisplay
                    key={`single-view-${geofence.geofence_id}`}
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