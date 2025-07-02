"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

interface Geofence {
  geofence_id: number;
  user_id: string | null;
  name: string;
  type: "circle" | "polygon" | "multipolygon";
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
  geofence?: Geofence;
  geofences?: Geofence[];
  isCreating?: boolean;
  selectedGeofence?: Geofence | null;
  onMapReady?: (map: LeafletMap) => void;
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
  const [isClient, setIsClient] = useState(false);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);
  const displayLayersRef = useRef<L.FeatureGroup | null>(null);
  const isUserInteractingRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  // Enhanced coordinate validation
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

  // Convert circle to polygon for consistent storage
  const circleToPolygon = (center: L.LatLng, radius: number, numberOfSides: number = 64): L.LatLng[] => {
    const points: L.LatLng[] = [];
    const angleStep = (2 * Math.PI) / numberOfSides;
    
    for (let i = 0; i < numberOfSides; i++) {
      const angle = i * angleStep;
      const lat = center.lat + (radius / 111000) * Math.cos(angle);
      const lng = center.lng + (radius / (111000 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);
      points.push(L.latLng(lat, lng));
    }
    
    // Close the polygon
    points.push(points[0]);
    return points;
  };

  // Geofence utilities - moved outside to be accessible everywhere
  function getGeofenceBounds(gf: Geofence): L.LatLngBounds | null {
    if (!gf || !gf.definition) return null;
    try {
      if (gf.type === 'circle' && gf.definition.center && typeof gf.definition.radius === 'number') {
        const [lng, lat] = gf.definition.center;
        const validatedCenter = validateCoordinates([Number(lat), Number(lng)]);
        if (validatedCenter) return L.circle(validatedCenter, { radius: gf.definition.radius }).getBounds();
      }
      if ((gf.type === 'polygon' || gf.type === 'multipolygon') && gf.definition.coordinates && gf.definition.coordinates[0]) {
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

  useEffect(() => {
    let mounted = true;
    let styleElement: HTMLStyleElement | null = null;
    let drawStyleElement: HTMLStyleElement | null = null;
    
    // Add global CSS fixes for Leaflet
    styleElement = document.createElement('style');
    styleElement.innerHTML = `
      .leaflet-container {
        height: 100%;
        width: 100%;
        min-height: 400px;
      }
      .leaflet-draw-toolbar {
        margin-top: 0 !important;
      }
      /* Fix for draw toolbar buttons */
      .leaflet-draw-toolbar a {
        background-image: url('https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/images/spritesheet.png');
        background-repeat: no-repeat;
        background-size: 300px 30px;
      }
      .leaflet-draw-toolbar a.leaflet-draw-draw-polygon {
        background-position: -30px 0;
      }
      .leaflet-draw-toolbar a.leaflet-draw-draw-circle {
        background-position: -120px 0;
      }
      /* Fix for Safari */
      .leaflet-retina .leaflet-draw-toolbar a {
        background-image: url('https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/images/spritesheet-2x.png');
        background-size: 300px 30px;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Add Leaflet Draw CSS from CDN
    drawStyleElement = document.createElement('link');
    drawStyleElement.rel = 'stylesheet';
    drawStyleElement.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css';
    document.head.appendChild(drawStyleElement);
    
    const loadMapComponents = async () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        console.log('🗺️ Loading map components...');

        // Import Leaflet Draw first
        await import('leaflet-draw');

        const reactLeaflet = await import('react-leaflet');

        // Verify Leaflet Draw is loaded
        if (!window.L || !window.L.Control || !window.L.Control.Draw) {
          throw new Error('Leaflet Draw not properly loaded');
        }

        // Fix Leaflet icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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
            case 'FORBIDDEN': return 'Forbidden';
            case 'STAY_IN': return 'Stay Inside';
            case 'STANDARD': return 'Standard';
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
          const popupContent = `<strong>${geofenceItem.name}</strong><br />Rule: ${formatRuleType(geofenceItem.rule_type)}`;

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

            if ((geofenceItem.type === 'polygon' || geofenceItem.type === 'multipolygon') && geofenceItem.definition.coordinates) {
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
            console.error(`❌ Error rendering geofence ${geofenceItem.geofence_id}:`, err);
          }
          return null;
        }

        // Custom Draw Control that manages Leaflet Draw directly
        interface DrawControlWrapperProps {
          drawMode?: "polygon" | "circle";
          onCreated?: (e: any) => void;
          onEdited?: (e: any) => void;
          onDeleted?: (e: any) => void;
          isCreating: boolean;
          viewOnly: boolean;
        }

        function DrawControlWrapper({
          drawMode: currentDrawMode,
          onCreated,
          onEdited,
          onDeleted,
          isCreating: currentlyCreating,
          viewOnly: isViewOnly
        }: DrawControlWrapperProps) {
          const map = reactLeaflet.useMap();
          const featureGroupLocal = useRef<L.FeatureGroup | null>(null);
          const drawControlLocal = useRef<L.Control.Draw | null>(null);
          
          useEffect(() => {
            if (!map || isViewOnly) return;

            // Create feature group if it doesn't exist
            if (!featureGroupLocal.current) {
              featureGroupLocal.current = L.featureGroup().addTo(map);
              featureGroupRef.current = featureGroupLocal.current;
              console.log('✅ FeatureGroup created and added to map');
            }

            // Setup draw control
            if (currentlyCreating && !drawControlLocal.current) {
              const drawOptions = {
                position: 'topright' as L.ControlPosition,
                draw: {
                  polyline: false,
                  rectangle: false,
                  circlemarker: false,
                  marker: false,
                  polygon: currentDrawMode === 'polygon' ? {
                    allowIntersection: false,
                    drawError: {
                      color: '#e1e100',
                      message: '<strong>Error:</strong> Shape edges cannot cross!'
                    },
                    shapeOptions: {
                      color: '#3b82f6',
                      weight: 3,
                      opacity: 0.8,
                      fillOpacity: 0.3,
                      fillColor: '#3b82f6'
                    },
                    showArea: true,
                    metric: true,
                    feet: false,
                    nautic: false
                  } : false,
                  circle: currentDrawMode === 'circle' ? {
                    shapeOptions: {
                      color: '#3b82f6',
                      weight: 3,
                      opacity: 0.8,
                      fillOpacity: 0.3,
                      fillColor: '#3b82f6'
                    },
                    showRadius: true,
                    metric: true,
                    feet: false,
                    nautic: false
                  } : false,
                },
                edit: {
                  featureGroup: featureGroupLocal.current,
                  remove: true,
                  edit: false,
                }
              };

              drawControlLocal.current = new L.Control.Draw(drawOptions);
              map.addControl(drawControlLocal.current);
              drawControlRef.current = drawControlLocal.current;
              console.log('✅ Draw control added to map');

              // Setup event handlers
              map.on(L.Draw.Event.CREATED, (e: any) => {
                console.log('🎨 Shape created:', e.layerType, e.layer);
                
                if (e.layerType === 'circle') {
                  const circle = e.layer;
                  const center = circle.getLatLng();
                  const radius = circle.getRadius();
                  
                  e.originalType = 'circle';
                  e.originalRadius = radius;
                  e.originalCenter = center;
                }
                
                if (featureGroupLocal.current) {
                  featureGroupLocal.current.addLayer(e.layer);
                }
                
                if (onCreated) onCreated(e);
              });

              if (onEdited) {
                map.on(L.Draw.Event.EDITED, onEdited);
              }

              if (onDeleted) {
                map.on(L.Draw.Event.DELETED, onDeleted);
              }
            } else if (!currentlyCreating && drawControlLocal.current) {
              // Remove draw control when not creating
              map.removeControl(drawControlLocal.current);
              drawControlLocal.current = null;
              drawControlRef.current = null;
              console.log('✅ Draw control removed from map');
            }

            return () => {
              // Cleanup
              if (drawControlLocal.current && map.hasLayer(drawControlLocal.current)) {
                map.removeControl(drawControlLocal.current);
              }
              if (featureGroupLocal.current && map.hasLayer(featureGroupLocal.current)) {
                map.removeLayer(featureGroupLocal.current);
              }
              
              // Remove event listeners
              map.off(L.Draw.Event.CREATED);
              map.off(L.Draw.Event.EDITED);
              map.off(L.Draw.Event.DELETED);
            };
          }, [map, currentlyCreating, isViewOnly, currentDrawMode, onCreated, onEdited, onDeleted]);

          return null;
        }

        interface MapControllerProps {
          center: [number, number] | null;
          zoom: number;
        }

        function MapController({ center: currentCenter, zoom: currentZoom }: MapControllerProps) {
          const map = reactLeaflet.useMap();
          const hasInitialized = useRef(false);
          const lastIsCreating = useRef(isCreating);
          
          useEffect(() => {
            mapRef.current = map;
            
            // Set up interaction tracking with better handling
            const startInteraction = () => {
              if (!programmaticMoveRef.current) {
                isUserInteractingRef.current = true;
              }
            };
            
            const endInteraction = () => {
              if (!programmaticMoveRef.current) {
                // Longer delay to prevent premature resets
                setTimeout(() => {
                  isUserInteractingRef.current = false;
                }, 3000);
              }
            };
            
            // Track all user interactions
            map.on('mousedown', startInteraction);
            map.on('dragstart', startInteraction);
            map.on('zoomstart', startInteraction);
            map.on('wheel', startInteraction);
            map.on('mouseup', endInteraction);
            map.on('dragend', endInteraction);
            map.on('zoomend', endInteraction);
            
            if (onMapReady) {
              onMapReady(map);
              console.log('🗺️ Map ready callback executed');
            }
            
            return () => {
              map.off('mousedown', startInteraction);
              map.off('dragstart', startInteraction);
              map.off('zoomstart', startInteraction);
              map.off('wheel', startInteraction);
              map.off('mouseup', endInteraction);
              map.off('dragend', endInteraction);
              map.off('zoomend', endInteraction);
            };
          }, [map]);

          // Set initial view only once, or when switching modes
          useEffect(() => {
            // Only set view if:
            // 1. First initialization
            // 2. Switching from viewing to creating mode (and view hasn't been set for creating yet)
            // 3. NOT when user is interacting
            const isModeSwitchToCreate = lastIsCreating.current !== isCreating && isCreating;
            const shouldSetView = !hasInitialized.current || isModeSwitchToCreate;
            
            if (shouldSetView && !isUserInteractingRef.current) {
              const validatedCenter = validateCoordinates(currentCenter) || [-6.2088, 106.8456];
              const validZoom = Number(currentZoom);
              const finalZoom = isNaN(validZoom) ? 12 : Math.max(2, Math.min(18, validZoom));
              
              programmaticMoveRef.current = true;
              map.setView(validatedCenter, finalZoom, { animate: false });
              
              if (!hasInitialized.current) {
                hasInitialized.current = true;
              }
              
              // Reset programmatic move flag after a short delay
              setTimeout(() => {
                programmaticMoveRef.current = false;
              }, 100);
              
              console.log('🎯 Map view set:', { 
                center: validatedCenter, 
                zoom: finalZoom, 
                isCreating,
                reason: hasInitialized.current ? 'mode change to create' : 'initial'
              });
            }
            
            lastIsCreating.current = isCreating;
          }, [currentCenter, currentZoom, map, isCreating]);

          return null;
        }

        // Reset View Button component - Main way to center map to selected geofence
        interface ResetViewButtonProps {
          selectedGeofence: Geofence | null;
          isCreating: boolean;
          center: [number, number];
        }
        
        function ResetViewButton({ selectedGeofence: currentSelected, isCreating: currentlyCreating, center: defaultCenter }: ResetViewButtonProps) {
          const map = reactLeaflet.useMap();
          
          const handleReset = () => {
            if (currentSelected && validateCoordinates(getGeofenceCenter(currentSelected))) {
              const targetBounds = getGeofenceBounds(currentSelected);
              const targetCenter = getGeofenceCenter(currentSelected);
              
              programmaticMoveRef.current = true;
              isUserInteractingRef.current = false; // Clear interaction flag
              
              if (targetBounds && targetBounds.isValid()) {
                map.fitBounds(targetBounds, { padding: [50, 50], maxZoom: 16, animate: true });
              } else if (targetCenter) {
                map.setView(targetCenter, 15, { animate: true });
              }
              
              setTimeout(() => {
                programmaticMoveRef.current = false;
              }, 600);
            } else if (!currentlyCreating) {
              // Reset to default view
              const validatedCenter = validateCoordinates(defaultCenter) || [-6.2088, 106.8456];
              programmaticMoveRef.current = true;
              isUserInteractingRef.current = false; // Clear interaction flag
              map.setView(validatedCenter, 12, { animate: true });
              setTimeout(() => {
                programmaticMoveRef.current = false;
              }, 600);
            }
          };
          
          return (
            <div className="leaflet-top leaflet-left" style={{ marginTop: '80px', marginLeft: '10px', zIndex: 1000 }}>
              <div className="leaflet-control leaflet-bar">
                <a
                  href="#"
                  className="leaflet-control-zoom-in"
                  title={currentSelected ? "Center to selected geofence" : "Reset to default view"}
                  role="button"
                  aria-label="Reset view"
                  style={{ 
                    fontSize: '18px', 
                    lineHeight: '30px',
                    backgroundColor: currentSelected ? '#e3f2fd' : '#fff',
                    fontWeight: 'bold'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    handleReset();
                  }}
                >
                  ⟲
                </a>
              </div>
            </div>
          );
        }

        if (mounted) {
          console.log('✅ Map components loaded successfully');
          setMapComponents({
            MapContainer: reactLeaflet.MapContainer,
            TileLayer: reactLeaflet.TileLayer,
            DrawControl: DrawControlWrapper,
            GeofenceDisplay,
            MapController,
            FeatureGroup: reactLeaflet.FeatureGroup,
            ResetViewButton,
          });
          setIsClient(true);
        }
      } catch (err: any) {
        console.error('❌ Error loading map components:', err);
        if (mounted) {
          setError(`Failed to load map components: ${err.message}`);
        }
      }
    };

    loadMapComponents();

    return () => {
      mounted = false;
      // Cleanup style element
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
      if (drawStyleElement && drawStyleElement.parentNode) {
        drawStyleElement.parentNode.removeChild(drawStyleElement);
      }
    };
  }, [onMapReady]);

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
          <p className="text-xs text-gray-500 mt-2">Preparing drawing tools...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, DrawControl, GeofenceDisplay, MapController, FeatureGroup, ResetViewButton } = MapComponents;

  const finalCenter = validateCoordinates(center) || [-6.2088, 106.8456];
  const finalZoom = isNaN(Number(zoom)) ? 12 : Number(zoom);

  return (
    <div ref={mapContainerRef} className="h-full w-full rounded-md overflow-hidden relative" style={{ minHeight: '400px' }}>
      <MapContainer
        center={finalCenter}
        zoom={finalZoom}
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
        ref={mapRef}
      >
        <MapController center={finalCenter} zoom={finalZoom} />
        <ResetViewButton selectedGeofence={selectedGeofence} isCreating={isCreating} center={center} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Geofences Display */}
        <FeatureGroup ref={displayLayersRef}>
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
                key={`all-${gf.geofence_id}-${Date.now()}`}
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

        {/* Drawing Controls */}
        <DrawControl
          drawMode={drawMode}
          onCreated={onDrawCreated}
          onEdited={onDrawEdited}
          onDeleted={onDrawDeleted}
          isCreating={isCreating}
          viewOnly={viewOnly}
        />

      </MapContainer>
    </div>
  );
}