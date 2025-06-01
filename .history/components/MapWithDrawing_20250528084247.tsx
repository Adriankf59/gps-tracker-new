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

  useEffect(() => {
    const loadMapComponents = async () => {
      try {
        // Dynamic imports for all map-related components
        const [
          { MapContainer, TileLayer, FeatureGroup, Circle, Polygon, Popup },
          { EditControl },
          L
        ] = await Promise.all([
          import('react-leaflet'),
          import('react-leaflet-draw'),
          import('leaflet')
        ]);

        // Import CSS
        await import('leaflet/dist/leaflet.css');
        await import('leaflet-draw/dist/leaflet.draw.css');
        
        // Fix Leaflet icons
        delete (L as any).Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });

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
            </FeatureGroup>
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
              <Circle
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
                  Type: {geofence.rule_type}
                </Popup>
              </Circle>
            );
          } else if (geofence.type === 'polygon' && geofence.definition.coordinates) {
            // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
            const positions = geofence.definition.coordinates[0][0].map(coord => [coord[1], coord[0]]);
            
            const fillColor = geofence.rule_type === 'FORBIDDEN' ? '#ef4444' : '#3b82f6';
            
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
                  Type: {geofence.rule_type}
                </Popup>
              </Polygon>
            );
          }
          
          return null;
        }

        setMapComponents({
          MapContainer,
          TileLayer,
          DrawControl,
          GeofenceDisplay
        });
        setIsClient(true);
      } catch (error) {
        console.error('Error loading map components:', error);
      }
    };

    loadMapComponents();
  }, []);

  if (!isClient || !MapComponents) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, DrawControl, GeofenceDisplay } = MapComponents;

  return (
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
  );
}