"use client";

import React, { useEffect, useMemo, useRef } from 'react'; // Added useRef
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon } from 'react-leaflet'; // Added Circle, Polygon
import L, { LatLngExpression } from 'leaflet'; // Imported LatLngExpression
import 'leaflet/dist/leaflet.css';

// Interface untuk geofence (sesuaikan dengan struktur dari LiveTracking atau GeofenceManager)
interface ProjectGeofence {
  geofence_id: number;
  name: string;
  type: "circle" | "polygon";
  status?: "active" | "inactive"; // Tambahkan jika ingin style berbeda untuk status
  rule_type?: "STANDARD" | "FORBIDDEN" | "STAY_IN"; // Tambahkan jika ingin style berbeda
  definition: {
    coordinates?: number[][][]; // Untuk polygon [[[lng,lat], [lng,lat], ...]]
    center?: [number, number];   // Untuk circle [lng,lat]
    radius?: number;            // Untuk circle, dalam meter
    // type: string; // Tidak terlalu dibutuhkan di sini jika sudah ada 'type' di level atas
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
  minHeight?: string; // Tambahkan minHeight
  vehicles: ProcessedVehicle[];
  selectedVehicleId?: string | null;
  centerCoordinates?: [number, number] | null; // Prop baru untuk pusat peta yang reaktif
  zoomLevel?: number; // Prop baru untuk level zoom yang reaktif
  onVehicleClick?: (vehicle: ProcessedVehicle) => void;
  onMapClick?: () => void;
  displayGeofences?: ProjectGeofence[]; // Prop baru untuk menampilkan geofence
  className?: string;
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

// Ikon default (bisa dipindahkan ke luar komponen jika perlu)
const defaultCarIcon = createIcon('🚗', '#3B82F6');
const defaultMotorIcon = createIcon('🏍️', '#10B981');
const offlineCarIcon = createIcon('🚗', '#9CA3AF');
const offlineMotorIcon = createIcon('🏍️', '#9CA3AF');
const selectedCarIcon = createIcon('🚗', '#FF6B35', true);
const selectedMotorIcon = createIcon('🏍️', '#FF6B35', true);


const MapComponent: React.FC<MapComponentProps> = ({
  height = "500px",
  minHeight = "400px", // Default minHeight
  vehicles = [],
  selectedVehicleId,
  centerCoordinates, // Menggunakan prop ini untuk pusat peta
  zoomLevel,       // Menggunakan prop ini untuk zoom
  onVehicleClick,
  onMapClick,
  displayGeofences = [], // Default ke array kosong
  className = ""
}) => {

  const mapRef = useRef<L.Map | null>(null);

  // Tentukan pusat dan zoom awal, tapi biarkan ReactiveMapView menangani pembaruan
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
      return [-2.5, 118.0]; // Default Indonesia
  }, [centerCoordinates, selectedVehicleId, vehicles]);

  const initialZoom = useMemo(() => {
      if (zoomLevel !== undefined) return zoomLevel;
      if (selectedVehicleId || (vehicles.length === 1 && vehicles[0].position)) return 16;
      return 5;
  }, [zoomLevel, selectedVehicleId, vehicles]);


  const handleVehicleMarkerClick = (vehicle: ProcessedVehicle) => {
    onVehicleClick?.(vehicle);
  };

  const handleMapGeneralClick = () => {
    onMapClick?.();
  };

  const getVehicleIcon = (vehicle: ProcessedVehicle) => {
    const isSelected = selectedVehicleId === vehicle.id;
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
    let color = '#3388ff'; // Default biru untuk STANDARD
    let fillColor = '#3388ff';
    let fillOpacity = 0.2;

    switch (geofence.rule_type) {
      case 'FORBIDDEN':
        color = '#ff0000'; // Merah
        fillColor = '#ff0000';
        break;
      case 'STAY_IN':
        color = '#00ff00'; // Hijau
        fillColor = '#00ff00';
        break;
      case 'STANDARD':
      default:
        // Gunakan warna default
        break;
    }
    if (geofence.status === 'inactive') {
        color = '#888888';
        fillColor = '#aaaaaa';
        fillOpacity = 0.1;
    }
    return { color, weight: 2, fillColor, fillOpacity };
  };

  return (
    <div className={`relative ${className}`} style={{ height, minHeight, width: '100%' }}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg" // Hapus border di sini jika div luar sudah punya
        whenCreated={mapInstance => { mapRef.current = mapInstance; }} // Simpan instance map
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <ReactiveMapView center={centerCoordinates} zoom={zoomLevel || initialZoom} />
        <MapEvents onClick={handleMapGeneralClick} />
        
        {/* Render Geofences */}
        {displayGeofences.map(geofence => {
          if (!geofence.definition) return null;
          const style = getGeofenceStyle(geofence);

          if (geofence.type === 'circle' && geofence.definition.center && geofence.definition.radius) {
            // Leaflet mengharapkan [lat, lng]
            const centerLatLng: LatLngExpression = [geofence.definition.center[1], geofence.definition.center[0]];
            return (
              <Circle
                key={`gf-circle-${geofence.geofence_id}`}
                center={centerLatLng}
                radius={geofence.definition.radius} // Radius dalam meter
                pathOptions={style}
              >
                <Popup>{geofence.name}<br/>Tipe: Lingkaran<br/>Aturan: {geofence.rule_type}</Popup>
              </Circle>
            );
          } else if (geofence.type === 'polygon' && geofence.definition.coordinates && geofence.definition.coordinates[0]) {
            // Leaflet mengharapkan array dari [lat, lng]
            const polygonLatLngs: LatLngExpression[] = geofence.definition.coordinates[0].map(
              (coord: number[]) => [coord[1], coord[0]] as LatLngExpression
            );
            if (polygonLatLngs.length < 3) return null; // Poligon butuh min 3 titik
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
          return (
            <Marker
              key={vehicle.id}
              position={vehicle.position} // Asumsi sudah [lat, lng]
              icon={vehicleIcon}
              eventHandlers={{ click: () => handleVehicleMarkerClick(vehicle) }}
            >
              <Popup>
                <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>{vehicle.name}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{vehicle.licensePlate}</div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '12px', backgroundColor: vehicle.status === 'moving' ? '#10B981' : vehicle.status === 'parked' ? '#3B82F6' : '#9CA3AF', color: 'white', fontWeight: '500' }}>
                      {vehicle.status.toUpperCase()}
                    </span>
                  </div>
                  {vehicle.timestamp && (<div style={{ fontSize: '11px', marginBottom: '8px' }}><strong>Update:</strong><br />{new Date(vehicle.timestamp).toLocaleString('id-ID')}</div>)}
                  <div style={{ fontSize: '11px', marginBottom: '8px' }}><strong>Koordinat:</strong><br />{vehicle.position[0].toFixed(5)}, {vehicle.position[1].toFixed(5)}</div>
                  <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                    <div>Speed: {vehicle.speed} km/h</div>
                    <div>Mesin: {vehicle.ignition ? 'ON' : 'OFF'}</div>
                    {vehicle.fuel !== null && <div>BBM: {vehicle.fuel.toFixed(1)}%</div>}
                    {vehicle.battery !== null && <div>Baterai: {vehicle.battery.toFixed(1)}V</div>}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {vehicles.length === 0 && !displayGeofences.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Tidak Ada Data untuk Ditampilkan</h3>
            <p className="text-gray-500 text-sm">Lokasi kendaraan atau geofence akan muncul di sini.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;