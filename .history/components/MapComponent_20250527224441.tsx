import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
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
  sim_card_number: string;
  relay_status: string | null;
  created_at: string;
  updated_at: string;
  vehicle_photo: string;
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

// Komponen untuk update view map saat posisi berubah
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

// Create custom icons with emoji for different vehicle types and status
const createIcon = (emoji: string, color: string) => {
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
        font-size: 16px;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      ">${emoji}</div>
    `,
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const carMovingIcon = createIcon('🚗', '#10B981');
const carParkedIcon = createIcon('🚗', '#F59E0B'); 
const carOfflineIcon = createIcon('🚗', '#6B7280');
const motorMovingIcon = createIcon('🏍️', '#10B981');
const motorParkedIcon = createIcon('🏍️', '#F59E0B');
const motorOfflineIcon = createIcon('🏍️', '#6B7280');

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
      
      // Build URLs with user filter if provided
      const vehiclesUrl = userId ? `/api/vehicles?user_id=${userId}` : '/api/vehicles';
      const vehicleDataUrl = '/api/vehicle-data';
      
      console.log('Fetching data from:', { vehiclesUrl, vehicleDataUrl });
      
      const [vehiclesResponse, vehicleDataResponse] = await Promise.all([
        fetch(vehiclesUrl),
        fetch(vehicleDataUrl)
      ]);
      
      if (!vehiclesResponse.ok) {
        throw new Error(`Failed to fetch vehicles: ${vehiclesResponse.status}`);
      }
      
      if (!vehicleDataResponse.ok) {
        throw new Error(`Failed to fetch vehicle data: ${vehicleDataResponse.status}`);
      }
      
      const vehiclesData = await vehiclesResponse.json();
      const vehicleDataData = await vehicleDataResponse.json();
      
      console.log('API Response:', {
        vehicles: vehiclesData.data?.length || 0,
        vehicleData: vehicleDataData.data?.length || 0
      });
      
      setVehicles(vehiclesData.data || []);
      setVehicleData(vehicleDataData.data || []);
      setIsLoading(false);
      
    } catch (err) {
      console.error('Error fetching vehicle data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setIsLoading(false);
    }
  };
  
  // Helper functions
  const getLocationName = (lat: string, lng: string): string => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
      if (latitude <= -6.89 && longitude >= 107.69) {
        return "Jl. Dago, Bandung";
      }
      return "Bandung, Jawa Barat";
    }
    
    if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
      return "Jakarta";
    }
    
    return `${lat}, ${lng}`;
  };

  const isVehicleOnline = (data: VehicleData | undefined): boolean => {
    if (!data || !data.timestamp) return false;
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes <= 15;
  };

  const getVehicleStatus = (data: VehicleData | undefined): 'moving' | 'parked' | 'offline' => {
    if (!data || !data.timestamp) return 'offline';
    
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes > 15) return 'offline';
    
    const speed = data.speed || 0;
    return speed > 0 ? 'moving' : 'parked';
  };
  
  // Process vehicles with their GPS data (no filtering, just raw data)
  const processedVehicles = useMemo(() => {
    return vehicles.map(vehicle => {
      // Get ALL GPS data for this vehicle, sorted by timestamp (latest first)
      const allGpsData = vehicleData
        .filter(data => data.vehicle_id === vehicle.vehicle_id)
        .filter(data => data.latitude && data.longitude && 
                       !isNaN(parseFloat(data.latitude)) && 
                       !isNaN(parseFloat(data.longitude)))
        .sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

      const latestData = allGpsData[0];
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      if (latestData && latestData.latitude && latestData.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
      }

      // Convert GPS data to positions array (no filtering)
      const positions: [number, number][] = allGpsData.map(data => [
        parseFloat(data.latitude!),
        parseFloat(data.longitude!)
      ]);
      
      const timestamps = allGpsData.map(data => data.timestamp!);
      
      // Determine vehicle type
      const vehicleType = vehicle.make?.toLowerCase().includes('motor') || 
                         vehicle.model?.toLowerCase().includes('motor') || 
                         vehicle.make?.toLowerCase().includes('honda') ||
                         vehicle.make?.toLowerCase().includes('yamaha') ||
                         vehicle.make?.toLowerCase().includes('kawasaki') ||
                         vehicle.make?.toLowerCase().includes('suzuki')
                         ? 'MOTOR' : 'MOBIL';

      return {
        id: vehicle.vehicle_id,
        name: vehicle.name,
        number: vehicle.license_plate,
        jenis_kendaraan: vehicleType,
        positions: positions,
        timestamps: timestamps,
        rawPositions: positions, // Same as positions (no filtering)
        latestData,
        isOnline: online,
        location,
        status,
        vehicle: vehicle
      };
    }).filter(v => v.positions.length > 0); // Only include vehicles with GPS data
  }, [vehicles, vehicleData]);
  
  // Find center position and latest position
  let center = defaultCenter;
  let latestPosition: [number, number] | null = null;
  
  if (processedVehicles && processedVehicles.length > 0) {
    const vehicle = processedVehicles[0];
    const positions = vehicle.positions;
    
    if (positions && positions.length > 0) {
      const lastPos = positions[0]; // Latest position (first in sorted array)
      if (Array.isArray(lastPos) && lastPos.length === 2 && 
          typeof lastPos[0] === 'number' && typeof lastPos[1] === 'number') {
        center = lastPos;
        latestPosition = lastPos;
      }
    }
  }
  
  // Initial data fetch and setup refresh interval
  useEffect(() => {
    fetchVehicleData();
    
    const interval = setInterval(() => {
      fetchVehicleData();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [userId, refreshInterval]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="relative" style={{ height, width: '100%' }}>
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-700 mb-2">Loading GPS Tracking Data</p>
            <p className="text-sm text-gray-500">Fetching vehicles and location data...</p>
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
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Failed to Load Map Data</h3>
            <p className="text-sm text-red-600 mb-4">
              {error || 'Unable to fetch vehicle tracking data'}
            </p>
            <button 
              onClick={() => fetchVehicleData()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
        className="rounded-lg border shadow-sm"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Komponen untuk update view map saat posisi berubah */}
        {latestPosition && <UpdateMapView position={latestPosition} />}
        
        {processedVehicles && processedVehicles.map(vehicle => {
          const positions = vehicle.positions || [];
          
          if (positions.length === 0) return null;
          
          // Choose icon based on vehicle type and status
          let vehicleIcon;
          const status = vehicle.status;
          
          if (vehicle.jenis_kendaraan === 'MOBIL') {
            vehicleIcon = status === 'moving' ? carMovingIcon : 
                         status === 'parked' ? carParkedIcon : carOfflineIcon;
          } else {
            vehicleIcon = status === 'moving' ? motorMovingIcon : 
                         status === 'parked' ? motorParkedIcon : motorOfflineIcon;
          }
          
          return (
            <div key={vehicle.id}>
              {/* Draw polyline for the route if there are multiple points */}
              {positions.length > 1 && (
                <Polyline 
                  positions={positions} 
                  color="#3B82F6" 
                  weight={3}
                  opacity={0.8}
                />
              )}
              
              {/* Marker for current/latest position */}
              <Marker
                position={positions[0]} // Latest position
                icon={vehicleIcon}
              >
                <Popup>
                  <div style={{ minWidth: '250px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#1F2937' }}>
                      {vehicle.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '10px' }}>
                      {vehicle.number}
                    </div>
                    
                    {/* Status badge */}
                    <div style={{
                      background: status === 'moving' ? '#10B98120' : status === 'parked' ? '#F59E0B20' : '#6B728020',
                      color: status === 'moving' ? '#10B981' : status === 'parked' ? '#F59E0B' : '#6B7280',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      textAlign: 'center',
                      margin: '8px 0',
                      border: `1px solid ${status === 'moving' ? '#10B98140' : status === 'parked' ? '#F59E0B40' : '#6B728040'}`,
                      fontWeight: '600'
                    }}>
                      {status === 'moving' ? '🚗 Moving' : status === 'parked' ? '🅿️ Parked' : '📴 Offline'}
                    </div>
                    
                    {/* Last update time */}
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#374151' }}>Last Update:</strong><br />
                      <span style={{ color: '#059669', fontFamily: 'monospace', fontSize: '11px' }}>
                        {vehicle.timestamps && vehicle.timestamps.length > 0 
                          ? new Date(vehicle.timestamps[0]).toLocaleString()
                          : 'No timestamp'}
                      </span>
                    </div>
                    
                    {/* Location */}
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#374151' }}>Location:</strong><br />
                      <span style={{ color: '#6B7280' }}>{vehicle.location}</span>
                    </div>
                    
                    {/* Coordinates */}
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: '#374151' }}>Coordinates:</strong><br />
                      <code style={{ 
                        background: '#F3F4F6', 
                        padding: '2px 4px', 
                        borderRadius: '3px', 
                        fontSize: '10px' 
                      }}>
                        {positions[0][0].toFixed(6)}, {positions[0][1].toFixed(6)}
                      </code>
                    </div>
                    
                    {/* Vehicle data */}
                    {vehicle.latestData && (
                      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '8px', marginTop: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
                          <div style={{ background: '#F9FAFB', padding: '4px', borderRadius: '3px' }}>
                            <div style={{ color: '#6B7280' }}>Speed</div>
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>{vehicle.latestData.speed || 0} km/h</div>
                          </div>
                          <div style={{ background: '#F9FAFB', padding: '4px', borderRadius: '3px' }}>
                            <div style={{ color: '#6B7280' }}>RPM</div>
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>{vehicle.latestData.rpm || 0}</div>
                          </div>
                          <div style={{ background: '#F9FAFB', padding: '4px', borderRadius: '3px' }}>
                            <div style={{ color: '#6B7280' }}>Fuel</div>
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>
                              {vehicle.latestData.fuel_level ? parseFloat(vehicle.latestData.fuel_level).toFixed(1) : 'N/A'}%
                            </div>
                          </div>
                          <div style={{ background: '#F9FAFB', padding: '4px', borderRadius: '3px' }}>
                            <div style={{ color: '#6B7280' }}>Battery</div>
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>
                              {vehicle.latestData.battery_level ? parseFloat(vehicle.latestData.battery_level).toFixed(1) : 'N/A'}V
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Vehicle info */}
                    <div style={{ 
                      marginTop: '8px', 
                      paddingTop: '6px', 
                      borderTop: '1px solid #E5E7EB', 
                      fontSize: '10px', 
                      color: '#9CA3AF' 
                    }}>
                      Vehicle: {vehicle.vehicle.make} {vehicle.vehicle.model} ({vehicle.vehicle.year})<br />
                      Total GPS Points: {vehicle.positions.length}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
      
      {/* Vehicle count indicator */}
      {processedVehicles && processedVehicles.length > 0 && (
        <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="animate-pulse">📍</span>
            <span>{processedVehicles.length} Vehicle{processedVehicles.length !== 1 ? 's' : ''} Tracked</span>
          </div>
          <div className="text-xs opacity-90">
            {processedVehicles.filter(v => v.isOnline).length} online • {vehicleData.length} GPS records
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-90 p-3 rounded-md text-white text-xs z-[1000]">
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-4 h-1 bg-blue-500 mr-2 rounded"></div>
            <span>GPS Route Data</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 mr-1 rounded-full flex items-center justify-center text-[8px]">🚗</div>
              <span>Moving</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 mr-1 rounded-full flex items-center justify-center text-[8px]">🚗</div>
              <span>Parked</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-500 mr-1 rounded-full flex items-center justify-center text-[8px]">🚗</div>
              <span>Offline</span>
            </div>
          </div>
        </div>
        
        {processedVehicles && processedVehicles.length > 0 && processedVehicles[0].timestamps && processedVehicles[0].timestamps.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-600">
            <div className="font-medium">Last update:</div>
            <div className="text-green-300">
              {new Date(processedVehicles[0].timestamps[0]).toLocaleString()}
            </div>
            <div className="mt-1 text-blue-300">
              Auto-refresh: {refreshInterval / 1000}s
            </div>
          </div>
        )}
      </div>
      
      {/* No data message */}
      {!isLoading && (!processedVehicles || processedVehicles.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-95 rounded-lg">
          <div className="text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No GPS Data Available</h3>
            <p className="text-gray-500 mb-4 max-w-md">
              {vehicles.length === 0 
                ? "No vehicles found. Add vehicles with GPS tracking to see them on the map."
                : vehicleData.length === 0
                ? "No GPS data available for your vehicles."
                : "No vehicles have valid GPS coordinates."
              }
            </p>
            <div className="text-sm text-gray-400">
              <div>Vehicles: {vehicles.length}</div>
              <div>GPS Records: {vehicleData.length}</div>
              <div>Auto-refresh: {refreshInterval / 1000}s</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;