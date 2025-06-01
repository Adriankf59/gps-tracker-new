"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon, Polyline } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Interface untuk geofence
interface ProjectGeofence {
  geofence_id: number;
  name: string;
  type: "circle" | "polygon";
  status?: "active" | "inactive";
  rule_type?: "STANDARD" | "FORBIDDEN" | "STAY_IN";
  definition: {
    coordinates?: number[][][];
    center?: [number, number];
    radius?: number;
  };
}

// Simplified interfaces for map display
interface ProcessedVehicle {
  id: string;
  name: string;
  licensePlate: string;
  position: [number, number]; // [latitude, longitude]
  speed: number;
  ignition: boolean;
  fuel: number | null;
  battery: number | null;
  timestamp: string | null;
  isMotor: boolean;
  make?: string;
  model?: string;
  year?: number;
  status: 'moving' | 'parked' | 'offline';
}

interface MapComponentProps {
  height?: string;
  minHeight?: string;
  vehicles: ProcessedVehicle[];
  selectedVehicleId?: string | null;
  centerCoordinates?: [number, number] | null;
  zoomLevel?: number;
  onVehicleClick?: (vehicle: ProcessedVehicle) => void;
  onMapClick?: () => void;
  displayGeofences?: ProjectGeofence[];
  routePolyline?: [number, number][]; // New prop for polyline route
  className?: string;
}

// Component for auto-fitting bounds when showing route
function AutoFitBounds({ 
  routePolyline, 
  vehicles 
}: { 
  routePolyline?: [number, number][]; 
  vehicles: ProcessedVehicle[] 
}) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    let bounds: L.LatLngBounds | null = null;
    
    // Include route polyline in bounds
    if (routePolyline && routePolyline.length > 1) {
      bounds = L.latLngBounds(routePolyline);
    }
    
    // Include vehicle markers in bounds
    vehicles.forEach(vehicle => {
      if (vehicle.position && !isNaN(vehicle.position[0]) && !isNaN(vehicle.position[1])) {
        if (!bounds) {
          bounds = L.latLngBounds([vehicle.position, vehicle.position]);
        } else {
          bounds.extend(vehicle.position);
        }
      }
    });
    
    // Fit bounds if we have any
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { 
        padding: [20, 20],
        maxZoom: 16
      });
    }
  }, [map, routePolyline, vehicles]);
  
  return null;
}

// Komponen untuk memperbarui view peta secara reaktif
function ReactiveMapView({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom, { animate: true, duration: 0.5 });
    }
  }, [map, center, zoom]);
  
  return null;
}

function MapEvents({ onClick }: { onClick: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, onClick]);
  return null;
}

if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

const createIcon = (emoji: string, color: string, isSelected?: boolean) => {
  return new L.DivIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${isSelected ? '36px' : '30px'};
        height: ${isSelected ? '36px' : '30px'};
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '18px' : '14px'};
        box-shadow: 0 2px ${isSelected ? '6px' : '4px'} rgba(0,0,0,0.3);
        transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
        transition: all 0.2s ease-in-out;
      ">️${emoji}</div>
    `,
    className: 'custom-div-icon',
    iconSize: isSelected ? [36, 36] : [30, 30],
    iconAnchor: isSelected ? [18, 18] : [15, 15],
    popupAnchor: [0, -15]
  });
};

// Special icons for route start/end points
const createRouteIcon = (type: 'start' | 'end', isMotor: boolean = false) => {
  const emoji = type === 'start' ? '🏁' : '🏁';
  const color = type === 'start' ? '#10B981' : '#EF4444';
  const text = type === 'start' ? 'S' : 'E';
  
  return new L.DivIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">${text}</div>
    `,
    className: 'route-marker-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

// Icons
const defaultCarIcon = createIcon('🚗', '#3B82F6');
const defaultMotorIcon = createIcon('🏍️', '#10B981');
const offlineCarIcon = createIcon('🚗', '#9CA3AF');
const offlineMotorIcon = createIcon('🏍️', '#9CA3AF');
const selectedCarIcon = createIcon('🚗', '#FF6B35', true);
const selectedMotorIcon = createIcon('🏍️', '#FF6B35', true);

const MapComponent: React.FC<MapComponentProps> = ({
  height = "500px",
  minHeight = "400px",
  vehicles = [],
  selectedVehicleId,
  centerCoordinates,
  zoomLevel,
  onVehicleClick,
  onMapClick,
  displayGeofences = [],
  routePolyline = [], // New prop for route polyline
  className = ""
}) => {

  const mapRef = useRef<L.Map | null>(null);

  // Determine if we should auto-fit bounds (when showing route)
  const shouldAutoFit = routePolyline && routePolyline.length > 1;

  // Tentukan pusat dan zoom awal
  const initialCenter: [number, number] = useMemo(() => {
      if (centerCoordinates && !isNaN(centerCoordinates[0]) && !isNaN(centerCoordinates[1])) {
          return centerCoordinates;
      }
      if (selectedVehicleId) {
          const v = vehicles.find(vh => vh.id === selectedVehicleId);
          if (v && v.position && !isNaN(v.position[0]) && !isNaN(v.position[1])) return v.position;
      }
      if (vehicles.length === 1 && vehicles[0].position && !isNaN(vehicles[0].position[0]) && !isNaN(vehicles[0].position[1])) {
          return vehicles[0].position;
      }
      // If we have a route, use the first point
      if (routePolyline && routePolyline.length > 0) {
          return routePolyline[0];
      }
      return [-2.5, 118.0]; // Default Indonesia
  }, [centerCoordinates, selectedVehicleId, vehicles, routePolyline]);

  const initialZoom = useMemo(() => {
      if (zoomLevel !== undefined) return zoomLevel;
      if (shouldAutoFit) return 10; // Will be adjusted by AutoFitBounds
      if (selectedVehicleId || (vehicles.length === 1 && vehicles[0].position)) return 16;
      return 5;
  }, [zoomLevel, selectedVehicleId, vehicles, shouldAutoFit]);

  const handleVehicleMarkerClick = (vehicle: ProcessedVehicle) => {
    onVehicleClick?.(vehicle);
  };

  const handleMapGeneralClick = () => {
    onMapClick?.();
  };

  const getVehicleIcon = (vehicle: ProcessedVehicle) => {
    const isSelected = selectedVehicleId === vehicle.id;
    
    // Special handling for route start/end markers
    if (vehicle.id.includes('start-') || vehicle.id.includes('end-')) {
      const type = vehicle.id.includes('start-') ? 'start' : 'end';
      return createRouteIcon(type, vehicle.isMotor);
    }
    
    if (isSelected) {
      return vehicle.isMotor ? selectedMotorIcon : selectedCarIcon;
    }
    if (vehicle.status === 'offline') {
      return vehicle.isMotor ? offlineMotorIcon : offlineCarIcon;
    }
    // Warna berdasarkan status jika tidak terpilih
    const color = vehicle.status === 'moving' ? '#10B981' : vehicle.status === 'parked' ? '#3B82F6' : '#9CA3AF';
    return createIcon(vehicle.isMotor ? '🏍️' : '🚗', color, false);
  };

  // Fungsi untuk mendapatkan style geofence berdasarkan rule_type
  const getGeofenceStyle = (geofence: ProjectGeofence) => {
    let color = '#3388ff';
    let fillColor = '#3388ff';
    let fillOpacity = 0.2;

    switch (geofence.rule_type) {
      case 'FORBIDDEN':
        color = '#ff0000';
        fillColor = '#ff0000';
        break;
      case 'STAY_IN':
        color = '#00ff00';
        fillColor = '#00ff00';
        break;
      case 'STANDARD':
      default:
        break;
    }
    if (geofence.status === 'inactive') {
        color = '#888888';
        fillColor = '#aaaaaa';
        fillOpacity = 0.1;
    }
    return { color, weight: 2, fillColor, fillOpacity };
  };

  // Generate route polyline style based on speed or other factors
  const getRouteStyle = (speedBased: boolean = false) => {
    return {
      color: '#2563EB',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1,
      // Add arrow decoration
      dashArray: undefined
    };
  };

  return (
    <div className={`relative ${className}`} style={{ height, minHeight, width: '100%' }}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Auto-fit bounds for route display */}
        {shouldAutoFit ? (
          <AutoFitBounds routePolyline={routePolyline} vehicles={vehicles} />
        ) : (
          <ReactiveMapView center={centerCoordinates} zoom={zoomLevel || initialZoom} />
        )}
        
        <MapEvents onClick={handleMapGeneralClick} />
        
        {/* Render Route Polyline */}
        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            pathOptions={getRouteStyle()}
          >
            <Popup>
              <div style={{ minWidth: '150px', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                  Vehicle Route
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {routePolyline.length} tracking points
                </div>
              </div>
            </Popup>
          </Polyline>
        )}
        
        {/* Render Geofences */}
        {displayGeofences.map(geofence => {
          if (!geofence.definition) return null;
          const style = getGeofenceStyle(geofence);

          if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.radius) {
            const centerLatLng: LatLngExpression = [geofence.definition.center[1], geofence.definition.center[0]];
            return (
              <Circle
                key={`gf-circle-${geofence.geofence_id}`}
                center={centerLatLng}
                radius={geofence.definition.radius}
                pathOptions={style}
              >
                <Popup>{geofence.name}<br/>Tipe: Lingkaran<br/>Aturan: {geofence.rule_type}</Popup>
              </Circle>
            );
          } else if (geofence.type === 'polygon' && geofence.definition.coordinates && geofence.definition.coordinates[0]) {
            const polygonLatLngs: LatLngExpression[] = geofence.definition.coordinates[0].map(
              (coord: number[]) => [coord[1], coord[0]] as LatLngExpression
            );
            if (polygonLatLngs.length < 3) return null;
            return (
              <Polygon
                key={`gf-poly-${geofence.geofence_id}`}
                positions={polygonLatLngs}
                pathOptions={style}
              >
                <Popup>{geofence.name}<br/>Tipe: Poligon<br/>Aturan: {geofence.rule_type}</Popup>
              </Polygon>
            );
          }
          return null;
        })}

        {/* Vehicle Markers */}
        {vehicles.map(vehicle => {
          if (!vehicle.position || isNaN(vehicle.position[0]) || isNaN(vehicle.position[1])) {
            return null;
          }
          const vehicleIcon = getVehicleIcon(vehicle);
          const isRouteMarker = vehicle.id.includes('start-') || vehicle.id.includes('end-');
          
          return (
            <Marker
              key={vehicle.id}
              position={vehicle.position}
              icon={vehicleIcon}
              eventHandlers={{ click: () => handleVehicleMarkerClick(vehicle) }}
              zIndexOffset={isRouteMarker ? 1000 : 0} // Route markers on top
            >
              <Popup>
                <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                    {isRouteMarker ? 
                      `${vehicle.name} (${vehicle.id.includes('start-') ? 'Start Point' : 'End Point'})` : 
                      vehicle.name
                    }
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{vehicle.licensePlate}</div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '12px', 
                      backgroundColor: vehicle.status === 'moving' ? '#10B981' : vehicle.status === 'parked' ? '#3B82F6' : '#9CA3AF', 
                      color: 'white', 
                      fontWeight: '500' 
                    }}>
                      {vehicle.status.toUpperCase()}
                    </span>
                  </div>
                  {vehicle.timestamp && (
                    <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                      <strong>Time:</strong><br />{new Date(vehicle.timestamp).toLocaleString('id-ID')}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                    <strong>Coordinates:</strong><br />{vehicle.position[0].toFixed(5)}, {vehicle.position[1].toFixed(5)}
                  </div>
                  <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                    <div>Speed: {vehicle.speed} km/h</div>
                    <div>Engine: {vehicle.ignition ? 'ON' : 'OFF'}</div>
                    {vehicle.fuel !== null && <div>Fuel: {vehicle.fuel.toFixed(1)}%</div>}
                    {vehicle.battery !== null && <div>Battery: {vehicle.battery.toFixed(1)}V</div>}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Route Info Overlay */}
      {routePolyline && routePolyline.length > 1 && (
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-3 pointer-events-none">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-0.5 bg-blue-600"></div>
            <span className="font-medium text-gray-700">
              Route: {routePolyline.length} points
            </span>
          </div>
        </div>
      )}
      
      {vehicles.length === 0 && !displayGeofences.length && !routePolyline?.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Data to Display</h3>
            <p className="text-gray-500 text-sm">Vehicle locations, routes, or geofences will appear here.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;