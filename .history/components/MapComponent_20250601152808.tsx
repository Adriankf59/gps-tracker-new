"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon, Polyline } from 'react-leaflet';
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet'; // Rename imported Map to LeafletMap to avoid conflict
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
    center?: [number, number]; // [lng, lat]
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
  centerCoordinates?: [number, number] | null; // [latitude, longitude]
  zoomLevel?: number;
  onVehicleClick?: (vehicle: ProcessedVehicle) => void;
  onMapClick?: () => void;
  displayGeofences?: ProjectGeofence[];
  routePolyline?: [number, number][]; // [latitude, longitude][]
  className?: string;
}

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

    if (routePolyline && routePolyline.length > 1) {
      const validRoutePoints = routePolyline.filter(
        p => Array.isArray(p) && p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])
      ) as LatLngExpression[];
      if (validRoutePoints.length > 1) {
        bounds = L.latLngBounds(validRoutePoints);
      }
    }

    vehicles.forEach(vehicle => {
      if (vehicle.position && !isNaN(vehicle.position[0]) && !isNaN(vehicle.position[1])) {
        const vehicleLatLng: LatLngExpression = [vehicle.position[0], vehicle.position[1]];
        if (!bounds) {
          bounds = L.latLngBounds([vehicleLatLng, vehicleLatLng]);
        } else {
          bounds.extend(vehicleLatLng);
        }
      }
    });

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16
      });
    }
  }, [map, routePolyline, vehicles]);

  return null;
}

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
    iconAnchor: isSelected ? [18, 36] : [15, 30],
    popupAnchor: [0, -15]
  });
};

const createRouteIcon = (type: 'start' | 'end', isMotor: boolean = false) => {
  const text = type === 'start' ? 'S' : 'E';
  const color = type === 'start' ? '#10B981' : '#EF4444';

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
    iconAnchor: [16, 32],
    popupAnchor: [0, -16]
  });
};

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
  routePolyline = [],
  className = ""
}) => {

  const mapRef = useRef<LeafletMap | null>(null); // Use LeafletMap alias

  const shouldAutoFit = routePolyline && routePolyline.length > 1;

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
      if (routePolyline && routePolyline.length > 0 && !isNaN(routePolyline[0][0]) && !isNaN(routePolyline[0][1])) {
          return routePolyline[0];
      }
      return [-2.5, 118.0];
  }, [centerCoordinates, selectedVehicleId, vehicles, routePolyline]);

  const initialZoom = useMemo(() => {
      if (zoomLevel !== undefined) return zoomLevel;
      if (shouldAutoFit) return 10;
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
    const vehicleIdStr = String(vehicle.id);

    if (vehicleIdStr.startsWith('start-route-') || vehicleIdStr.startsWith('end-route-')) {
      const type = vehicleIdStr.startsWith('start-route-') ? 'start' : 'end';
      return createRouteIcon(type, vehicle.isMotor);
    }

    if (isSelected) {
      return vehicle.isMotor ? selectedMotorIcon : selectedCarIcon;
    }
    if (vehicle.status === 'offline') {
      return vehicle.isMotor ? offlineMotorIcon : offlineCarIcon;
    }
    const color = vehicle.status === 'moving' ? '#10B981' : vehicle.status === 'parked' ? '#3B82F6' : '#9CA3AF';
    return createIcon(vehicle.isMotor ? '🏍️' : '🚗', color, false);
  };

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
        color = '#00cc00';
        fillColor = '#00cc00';
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

  const getRouteStyle = () => {
    return {
      color: '#2563EB',
      weight: 5,
      opacity: 0.7,
    };
  };

  return (
    <div className={`relative ${className}`} style={{ height, minHeight, width: '100%' }}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        // PERBAIKAN DI SINI
        whenReady={(mapInstance: LeafletMap) => { mapRef.current = mapInstance; }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        {shouldAutoFit ? (
          <AutoFitBounds routePolyline={routePolyline} vehicles={vehicles} />
        ) : (
          <ReactiveMapView center={centerCoordinates} zoom={zoomLevel || initialZoom} />
        )}

        <MapEvents onClick={handleMapGeneralClick} />

        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline.filter(p => Array.isArray(p) && p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) as LatLngExpression[]}
            pathOptions={getRouteStyle()}
          >
            <Popup>
              <div style={{ minWidth: '150px', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                  Rute Kendaraan
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {routePolyline.length} titik pelacakan
                </div>
              </div>
            </Popup>
          </Polyline>
        )}

        {displayGeofences.map(geofence => {
          if (!geofence.definition) return null;
          const style = getGeofenceStyle(geofence);

          if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.radius) {
            const centerLatLng: LatLngExpression = [geofence.definition.center[1], geofence.definition.center[0]];
            if (isNaN(centerLatLng[0]) || isNaN(centerLatLng[1]) || isNaN(geofence.definition.radius)) return null;
            return (
              <Circle
                key={`gf-circle-${geofence.geofence_id}`}
                center={centerLatLng}
                radius={geofence.definition.radius}
                pathOptions={style}
              >
                <Popup>{geofence.name}<br/>Tipe: Lingkaran<br/>Aturan: {geofence.rule_type || 'N/A'}</Popup>
              </Circle>
            );
          } else if (geofence.type === 'polygon' && geofence.definition.coordinates && geofence.definition.coordinates[0]) {
            const polygonLatLngs: LatLngExpression[] = geofence.definition.coordinates[0]
              .map((coord: number[]) => {
                if (Array.isArray(coord) && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
                  return [coord[1], coord[0]] as LatLngExpression;
                }
                return null;
              })
              .filter((p): p is LatLngExpression => p !== null);

            if (polygonLatLngs.length < 3) return null;
            return (
              <Polygon
                key={`gf-poly-${geofence.geofence_id}`}
                positions={polygonLatLngs}
                pathOptions={style}
              >
                <Popup>{geofence.name}<br/>Tipe: Poligon<br/>Aturan: {geofence.rule_type || 'N/A'}</Popup>
              </Polygon>
            );
          }
          return null;
        })}

        {vehicles.map(vehicle => {
          if (!vehicle.position || isNaN(vehicle.position[0]) || isNaN(vehicle.position[1])) {
            return null;
          }
          const vehicleIcon = getVehicleIcon(vehicle);
          const vehicleIdStr = String(vehicle.id);
          const isRouteMarker = vehicleIdStr.startsWith('start-route-') || vehicleIdStr.startsWith('end-route-');

          return (
            <Marker
              key={vehicle.id}
              position={vehicle.position}
              icon={vehicleIcon}
              eventHandlers={{ click: () => handleVehicleMarkerClick(vehicle) }}
              zIndexOffset={isRouteMarker ? 1000 : (selectedVehicleId === vehicle.id ? 900 : 0) }
            >
              <Popup>
                <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                    {isRouteMarker ?
                      `${vehicle.name} (${vehicleIdStr.includes('start-route-') ? 'Titik Mulai' : 'Titik Akhir'})` :
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
                      <strong>Waktu:</strong><br />{new Date(vehicle.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                    <strong>Koordinat:</strong><br />{vehicle.position[0].toFixed(5)}, {vehicle.position[1].toFixed(5)}
                  </div>
                  {!isRouteMarker && (
                    <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                      <div>Kecepatan: {vehicle.speed} km/j</div>
                      <div>Mesin: {vehicle.ignition ? 'ON' : 'OFF'}</div>
                      {vehicle.fuel !== null && <div>BBM: {vehicle.fuel.toFixed(1)}%</div>}
                      {vehicle.battery !== null && <div>Baterai: {vehicle.battery.toFixed(1)}V</div>}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {routePolyline && routePolyline.length > 1 && (
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-3 pointer-events-auto z-[1000]">
          <div className="flex items-center gap-2 text-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
              <path d="M1 6 L11 6" stroke="#2563EB" strokeWidth="3" />
            </svg>
            <span className="font-medium text-gray-700">
              Rute: {routePolyline.length} titik
            </span>
          </div>
        </div>
      )}

      {vehicles.length === 0 && !displayGeofences.length && (!routePolyline || routePolyline.length <= 1) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Tidak Ada Data untuk Ditampilkan</h3>
            <p className="text-gray-500 text-sm">Lokasi kendaraan, rute, atau geofence akan muncul di sini.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;