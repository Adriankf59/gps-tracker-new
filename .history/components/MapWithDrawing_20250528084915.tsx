"use client";

import { useEffect, useRef, useState } from 'react';

// Import types only
interface MapWithDrawingProps {
  center: [number, number];
  zoom: number;
  drawMode?: "polygon" | "circle";
  onDrawCreated?: (e: any) => void;
  onDrawEdited?: (e: any) => void;
  onDrawDeleted?: (e: any) => void;
  ruleType?: string;
  viewOnly?: boolean;
  geofence?: any;
}

export default function MapWithDrawing({
  center,
  zoom,
  drawMode = "polygon",
  onDrawCreated,
  onDrawEdited,
  onDrawDeleted,
  ruleType = "FORBIDDEN",
  viewOnly = false,
  geofence
}: MapWithDrawingProps) {
  const [isClient, setIsClient] = useState(false);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadMapComponents = async () => {
      try {
        console.log('Starting to load map components...'); // Debug log
        
        // Check if we're in the browser
        if (typeof window === 'undefined') {
          console.log('Not in browser environment'); // Debug log
          return;
        }

        // Dynamic imports for all map-related components
        const [
          reactLeaflet,
          leafletDraw,
          L
        ] = await Promise.all([
          import('react-leaflet'),
          import('react-leaflet-draw'),
          import('leaflet')
        ]);

        console.log('Loaded libraries successfully'); // Debug log

        // Import CSS
        await import('leaflet/dist/leaflet.css');
        await import('leaflet-draw/dist/leaflet.draw.css');
        
        console.log('Loaded CSS successfully'); // Debug log
        
        // Fix Leaflet icons
        delete (L as any).Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });

        console.log('Fixed icons successfully'); // Debug log

        // Component to control draw mode
        function DrawControl({ drawMode, onCreated, onEdited, onDeleted, ruleType }) {
          const featureGroupRef = useRef(null);
          
          useEffect(() => {
            if (featureGroupRef.current) {
              // Clear existing drawings when draw mode changes
              featureGroupRef.current.clearLayers();
            }
          }, [drawMode]);

          const drawOptions = {
            position: 'topright' as const,
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
            <reactLeaflet.FeatureGroup ref={featureGroupRef}>
              <leafletDraw.EditControl
                position="topright"
                onCreated={onCreated}
                onEdited={onEdited}
                onDeleted={onDeleted}
                draw={drawOptions.draw}
                edit={drawOptions.edit}
              />
            </reactLeaflet.FeatureGroup>
          );
        }

        // Component to display a saved geofence
        function GeofenceDisplay({ geofence }) {
          if (!geofence) return null;
          
          if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.radius) {
            const center: [number, number] = [geofence.definition.center[1], geofence.definition.center[0]]; // lat, lng
            const radius = geofence.definition.radius;
            
            const fillColor = geofence.rule_type === 'FORBIDDEN' ? '#ef4444' : '#3b82f6';
            
            return (
              <reactLeaflet.Circle
                center={center}
                radius={radius}
                pathOptions={{
                  fillColor: fillColor,
                  fillOpacity: 0.2,
                  color: fillColor,
                  weight: 2
                }}
              >
                <reactLeaflet.Popup>
                  <strong>{geofence.name}</strong><br />
                  Type: {geofence.rule_type}
                </reactLeaflet.Popup>
              </reactLeaflet.Circle>
            );
          } else if (geofence.type === 'polygon' && geofence.definition.coordinates) {
            // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
            const positions = geofence.definition.coordinates[0][0].map(coord => [coord[1], coord[0]]);
            
            const fillColor = geofence.rule_type === 'FORBIDDEN' ? '#ef4444' : '#3b82f6';
            
            return (
              <reactLeaflet.Polygon
                positions={positions}
                pathOptions={{
                  fillColor: fillColor,
                  fillOpacity: 0.2,
                  color: fillColor,
                  weight: 2
                }}
              >
                <reactLeaflet.Popup>
                  <strong>{geofence.name}</strong><br />
                  Type: {geofence.rule_type}
                </reactLeaflet.Popup>
              </reactLeaflet.Polygon>
            );
          }
          
          return null;
        }

        if (mounted) {
          setMapComponents({
            MapContainer: reactLeaflet.MapContainer,
            TileLayer: reactLeaflet.TileLayer,
            DrawControl,
            GeofenceDisplay
          });
          setIsClient(true);
          console.log('Map components set successfully'); // Debug log
        }
      } catch (error) {
        console.error('Error loading map components:', error);
        if (mounted) {
          setError(`Failed to load map: ${error.message}`);
        }
      }
    };

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      loadMapComponents();
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️</div>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-red-500 text-xs mt-2">Please check console for details</p>
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

  const { MapContainer, TileLayer, DrawControl, GeofenceDisplay } = MapComponents;

  return (
    <div ref={mapContainerRef} className="h-full w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {!viewOnly && onDrawCreated && (
          <DrawControl 
            drawMode={drawMode}
            onCreated={onDrawCreated}
            onEdited={onDrawEdited}
            onDeleted={onDrawDeleted}
            ruleType={ruleType}
          />
        )}
        
        {viewOnly && geofence && (
          <GeofenceDisplay geofence={geofence} />
        )}
      </MapContainer>
    </div>
  );
}DrawCreated && (
        <DrawControl 
          drawMode={drawMode}
          onCreated={onDrawCreated}
          onEdited={onDrawEdited}
          onDeleted={onDrawDeleted}
          ruleType={ruleType}
        />
      )}
      
      {viewOnly && geofence && (
        <GeofenceDisplay geofence={geofence} />
      )}
    </MapContainer>
  );
}