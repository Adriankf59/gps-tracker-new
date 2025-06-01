import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Interface for API responses
interface Vehicle {
  vehicle_id: string;
  user_id: string;
  gps_device_id: string;
  license_plate: string;
  name: string;
  make: string;
  model: string;
  year: number;
}

interface VehicleData {
  data_id: string;
  vehicle_id: string;
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  speed: number | null;
  rpm: number | null;
  fuel_level: string | null;
  ignition_status: string | null;
  battery_level: string | null;
  satellites_used: number | null;
}

interface MapComponentProps {
  height?: string;
  userId?: string;
  refreshInterval?: number;
}

// Update map view component
function UpdateMapView({ position }: { position: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position && position.length === 2) {
      map.setView(position, map.getZoom());
    }
  }, [map, position]);
  
  return null;
}

// Fix leaflet default icon issue
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// Simple icon creation
const createIcon = (emoji: string, color: string) => {
  return new L.DivIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${emoji}</div>
    `,
    className: 'custom-div-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

const carIcon = createIcon('🚗', '#3B82F6');
const motorIcon = createIcon('🏍️', '#10B981');

const MapComponent: React.FC<MapComponentProps> = ({ 
  height = "600px",
  userId,
  refreshInterval = 30000
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default center - Bandung coordinates
  const defaultCenter: [number, number] = [-6.914744, 107.609810];
  
  // Fetch vehicle data from API
  const fetchVehicleData = async () => {
    try {
      setError(null);
      
      const vehiclesUrl = userId ? `/api/vehicles?user_id=${userId}` : '/api/vehicles';
      const vehicleDataUrl = '/api/vehicle-data';
      
      const [vehiclesResponse, vehicleDataResponse] = await Promise.all([
        fetch(vehiclesUrl),
        fetch(vehicleDataUrl)
      ]);
      
      if (!vehiclesResponse.ok || !vehicleDataResponse.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const vehiclesData = await vehiclesResponse.json();
      const vehicleDataData = await vehicleDataResponse.json();
      
      setVehicles(vehiclesData.data || []);
      setVehicleData(vehicleDataData.data || []);
      setIsLoading(false);
      
    } catch (err) {
      console.error('Error fetching vehicle data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setIsLoading(false);
    }
  };
  
  // Process vehicles with GPS data
  const processedVehicles = useMemo(() => {
    return vehicles.map(vehicle => {
      // Get latest GPS data for this vehicle
      const latestGpsData = vehicleData
        .filter(data => data.vehicle_id === vehicle.vehicle_id)
        .filter(data => data.latitude && data.longitude && 
                       !isNaN(parseFloat(data.latitude)) && 
                       !isNaN(parseFloat(data.longitude)))
        .sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })[0];

      if (!latestGpsData) return null;

      // Determine vehicle type
      const isMotor = vehicle.make?.toLowerCase().includes('motor') || 
                     vehicle.model?.toLowerCase().includes('motor') || 
                     ['honda', 'yamaha', 'kawasaki', 'suzuki'].some(brand => 
                       vehicle.make?.toLowerCase().includes(brand));

      return {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        number: vehicle.license_plate,
        position: [parseFloat(latestGpsData.latitude!), parseFloat(latestGpsData.longitude!)] as [number, number],
        timestamp: latestGpsData.timestamp,
        speed: latestGpsData.speed || 0,
        fuel: latestGpsData.fuel_level ? parseFloat(latestGpsData.fuel_level) : null,
        battery: latestGpsData.battery_level ? parseFloat(latestGpsData.battery_level) : null,
        ignition: latestGpsData.ignition_status === 'true',
        isMotor,
        vehicle
      };
    }).filter(Boolean);
  }, [vehicles, vehicleData]);
  
  // Find center position
  const center = processedVehicles.length > 0 ? processedVehicles[0].position : defaultCenter;
  
  // Fetch data on mount and set interval
  useEffect(() => {
    fetchVehicleData();
    const interval = setInterval(fetchVehicleData, refreshInterval);
    return () => clearInterval(interval);
  }, [userId, refreshInterval]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="relative" style={{ height, width: '100%' }}>
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="relative" style={{ height, width: '100%' }}>
        <div className="absolute inset-0 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
          <div className="text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Failed to Load Map</h3>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button 
              onClick={fetchVehicleData} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={15}
        style={{ height, width: '100%' }}
        className="rounded-lg border"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Update map view to latest position */}
        {processedVehicles.length > 0 && <UpdateMapView position={processedVehicles[0].position} />}
        
        {/* Vehicle markers */}
        {processedVehicles.map(vehicle => (
          <Marker
            key={vehicle.id}
            position={vehicle.position}
            icon={vehicle.isMotor ? motorIcon : carIcon}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                  {vehicle.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  {vehicle.number}
                </div>
                
                {vehicle.timestamp && (
                  <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                    <strong>Last Update:</strong><br />
                    {new Date(vehicle.timestamp).toLocaleString()}
                  </div>
                )}
                
                <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                  <strong>Coordinates:</strong><br />
                  {vehicle.position[0].toFixed(6)}, {vehicle.position[1].toFixed(6)}
                </div>
                
                <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <div>Speed: {vehicle.speed} km/h</div>
                  <div>Engine: {vehicle.ignition ? 'ON' : 'OFF'}</div>
                  {vehicle.fuel !== null && <div>Fuel: {vehicle.fuel.toFixed(1)}%</div>}
                  {vehicle.battery !== null && <div>Battery: {vehicle.battery.toFixed(1)}V</div>}
                </div>
                
                <div style={{ fontSize: '10px', color: '#999', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                  {vehicle.vehicle.make} {vehicle.vehicle.model} ({vehicle.vehicle.year})
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* No data message */}
      {!isLoading && processedVehicles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No GPS Data</h3>
            <p className="text-gray-500 text-sm">
              {vehicles.length === 0 
                ? "No vehicles found"
                : "No GPS data available for your vehicles"
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;