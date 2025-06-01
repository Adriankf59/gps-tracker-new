import React, { useEffect, useRef, useState, useMemo } from 'react';

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

const MapComponent: React.FC<MapComponentProps> = ({ 
  height = "600px",
  userId,
  refreshInterval = 30000
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
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
        vehicle: vehicle,
        allGpsData: allGpsData
      };
    }).filter(v => v.positions.length > 0); // Only include vehicles with GPS data
  }, [vehicles, vehicleData]);
  
  // Initial data fetch and setup refresh interval
  useEffect(() => {
    fetchVehicleData();
    
    const interval = setInterval(() => {
      fetchVehicleData();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [userId, refreshInterval]);
  
  // Initialize Leaflet
  useEffect(() => {
    let mounted = true;
    
    const initializeLeaflet = async () => {
      try {
        const leafletModule = await import('leaflet');
        const leaflet = leafletModule.default;
        
        await import('leaflet/dist/leaflet.css');
        
        if (!mounted) return;
        
        // Fix default icon paths for Next.js
        delete leaflet.Icon.Default.prototype._getIconUrl;
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
        
        setL(leaflet);
        setMapLoaded(true);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };
    
    if (typeof window !== 'undefined') {
      initializeLeaflet();
    }
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Initialize map instance
  useEffect(() => {
    if (!L || !mapLoaded || !mapRef.current || mapInstanceRef.current) return;
    
    try {
      const mapInstance = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapInstance);
      
      mapInstanceRef.current = mapInstance;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [L, mapLoaded]);
  
  // Create custom icons
  const createIcons = () => {
    if (!L) return {};
    
    const createCustomIcon = (color: string, symbol: string, status: string) => {
      const isOffline = status === 'offline';
      const opacity = isOffline ? 0.6 : 1;
      const borderColor = isOffline ? '#9CA3AF' : 'white';
      const pulseAnimation = status === 'moving' ? 'animation: pulse 2s infinite;' : '';
      
      return L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            background-color: ${color};
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid ${borderColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            color: white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            opacity: ${opacity};
            ${pulseAnimation}
          ">${symbol}</div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
              50% { transform: scale(1.1); box-shadow: 0 6px 12px rgba(0,0,0,0.4); }
              100% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
            }
          </style>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      });
    };
    
    return {
      carMoving: createCustomIcon('#10B981', '🚗', 'moving'),
      carParked: createCustomIcon('#F59E0B', '🚗', 'parked'),
      carOffline: createCustomIcon('#6B7280', '🚗', 'offline'),
      motorMoving: createCustomIcon('#10B981', '🏍️', 'moving'),
      motorParked: createCustomIcon('#F59E0B', '🏍️', 'parked'),
      motorOffline: createCustomIcon('#6B7280', '🏍️', 'offline')
    };
  };
  
  // Update map with vehicle data
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !processedVehicles.length) return;
    
    const map = mapInstanceRef.current;
    
    // Clear existing layers
    layersRef.current.forEach(layer => {
      try {
        map.removeLayer(layer);
      } catch (e) {
        // Layer might already be removed
      }
    });
    layersRef.current = [];
    
    const icons = createIcons();
    
    // Find center position
    let center = defaultCenter;
    let allPositions: [number, number][] = [];
    
    processedVehicles.forEach(vehicle => {
      const positions = vehicle.positions || [];
      
      if (positions.length === 0) return;
      
      allPositions = allPositions.concat(positions);
      
      // Choose icon based on vehicle type and status
      let vehicleIcon;
      const status = vehicle.status;
      
      if (vehicle.jenis_kendaraan === 'MOBIL') {
        vehicleIcon = status === 'moving' ? icons.carMoving : 
                     status === 'parked' ? icons.carParked : icons.carOffline;
      } else {
        vehicleIcon = status === 'moving' ? icons.motorMoving : 
                     status === 'parked' ? icons.motorParked : icons.motorOffline;
      }
      
      try {
        // Add polyline for route if there are multiple points
        if (positions.length > 1) {
          const polyline = L.polyline(positions, { 
            color: "#3B82F6", 
            weight: 3,
            opacity: 0.8
          }).addTo(map);
          layersRef.current.push(polyline);
        }
        
        // Add marker for current/latest position
        const currentPosition = positions[0]; // Latest position
        const marker = L.marker(currentPosition, { icon: vehicleIcon }).addTo(map);
        
        // Create popup content
        const timestamp = vehicle.timestamps && vehicle.timestamps.length > 0 
          ? new Date(vehicle.timestamps[0]).toLocaleString()
          : 'No timestamp';
        const speed = vehicle.latestData?.speed || 0;
        const fuel = vehicle.latestData?.fuel_level ? parseFloat(vehicle.latestData.fuel_level).toFixed(1) : 'N/A';
        const battery = vehicle.latestData?.battery_level ? parseFloat(vehicle.latestData.battery_level).toFixed(1) : 'N/A';
        const rpm = vehicle.latestData?.rpm || 0;
        const satellites = vehicle.latestData?.satellites_used || 0;
        const ignition = vehicle.latestData?.ignition_status === 'true' ? 'ON' : 'OFF';
        
        const statusColor = status === 'moving' ? '#10B981' : 
                           status === 'parked' ? '#F59E0B' : '#6B7280';
        const statusText = status === 'moving' ? '🚗 Moving' : 
                          status === 'parked' ? '🅿️ Parked' : '📴 Offline';
        
        const popupContent = `
          <div style="min-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 8px; color: #1F2937;">${vehicle.name}</div>
            <div style="font-size: 14px; color: #6B7280; margin-bottom: 12px;">${vehicle.number}</div>
            
            <div style="background: ${statusColor}20; color: ${statusColor}; padding: 8px; border-radius: 8px; font-size: 14px; text-align: center; margin: 12px 0; border: 1px solid ${statusColor}40; font-weight: 600;">
              ${statusText}
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 12px; margin-bottom: 4px;">
                <strong style="color: #374151;">Last Update:</strong><br>
                <span style="color: #059669; font-family: monospace;">${timestamp}</span>
              </div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 12px; margin-bottom: 4px;">
                <strong style="color: #374151;">Location:</strong><br>
                <span style="color: #6B7280;">${vehicle.location}</span>
              </div>
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 12px;">
                <strong style="color: #374151;">Coordinates:</strong><br>
                <code style="background: #F3F4F6; padding: 4px 6px; border-radius: 4px; font-size: 11px;">
                  ${currentPosition[0].toFixed(6)}, ${currentPosition[1].toFixed(6)}
                </code>
              </div>
            </div>
            
            <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 12px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                <div style="background: #F9FAFB; padding: 8px; border-radius: 6px;">
                  <div style="color: #6B7280; margin-bottom: 2px;">Speed</div>
                  <div style="font-weight: 600; color: #1F2937;">${speed} km/h</div>
                </div>
                <div style="background: #F9FAFB; padding: 8px; border-radius: 6px;">
                  <div style="color: #6B7280; margin-bottom: 2px;">RPM</div>
                  <div style="font-weight: 600; color: #1F2937;">${rpm}</div>
                </div>
                <div style="background: #F9FAFB; padding: 8px; border-radius: 6px;">
                  <div style="color: #6B7280; margin-bottom: 2px;">Fuel</div>
                  <div style="font-weight: 600; color: #1F2937;">${fuel}%</div>
                </div>
                <div style="background: #F9FAFB; padding: 8px; border-radius: 6px;">
                  <div style="color: #6B7280; margin-bottom: 2px;">Battery</div>
                  <div style="font-weight: 600; color: #1F2937;">${battery}V</div>
                </div>
                <div style="background: #F9FAFB; padding: 8px; border-radius: 6px;">
                  <div style="color: #6B7280; margin-bottom: 2px;">Ignition</div>
                  <div style="font-weight: 600; color: ${ignition === 'ON' ? '#059669' : '#DC2626'};">${ignition}</div>
                </div>
                <div style="background: #F9FAFB; padding: 8px; border-radius: 6px;">
                  <div style="color: #6B7280; margin-bottom: 2px;">Satellites</div>
                  <div style="font-weight: 600; color: #1F2937;">${satellites}</div>
                </div>
              </div>
            </div>
            
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF;">
              Vehicle: ${vehicle.vehicle.make} ${vehicle.vehicle.model} (${vehicle.vehicle.year})<br>
              Total GPS Points: ${vehicle.positions.length} | Device ID: ${vehicle.vehicle.gps_device_id}
            </div>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        layersRef.current.push(marker);
        
      } catch (error) {
        console.error('Error adding vehicle to map:', error);
      }
    });
    
    // Fit map bounds to show all vehicles
    if (allPositions.length > 0) {
      try {
        if (processedVehicles.length === 1 && processedVehicles[0].positions.length > 0) {
          // Single vehicle - center on latest position
          const latestPos = processedVehicles[0].positions[0];
          map.setView(latestPos, 15);
        } else {
          // Multiple vehicles or multiple points - fit bounds
          const group = L.featureGroup(layersRef.current.filter(layer => layer.getLatLng || layer.getBounds));
          if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
          }
        }
      } catch (error) {
        console.error('Error fitting map bounds:', error);
      }
    }
    
  }, [processedVehicles, L]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // Map might already be removed
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);
  
  // Loading state
  if (isLoading && !mapLoaded) {
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
      {/* Map container */}
      <div 
        ref={mapRef} 
        style={{ height, width: '100%' }}
        className="rounded-lg border shadow-sm"
      />
      
      {/* Loading overlay for map initialization */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Initializing map...</p>
          </div>
        </div>
      )}
      
      {/* Data loading indicator */}
      {isLoading && mapLoaded && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-[1000] flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Updating data...</span>
        </div>
      )}
      
      {/* Vehicle count indicator */}
      {processedVehicles && processedVehicles.length > 0 && mapLoaded && (
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
      {!isLoading && (!processedVehicles || processedVehicles.length === 0) && mapLoaded && (
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