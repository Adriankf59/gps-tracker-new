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

interface VehicleWithData extends Vehicle {
  latestData?: VehicleData;
  isOnline: boolean;
  location: string;
  status: 'moving' | 'parked' | 'offline';
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
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  
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
  
  // Combine vehicles with their GPS data
  const vehiclesWithData = useMemo(() => {
    return vehicles.map(vehicle => {
      // Get all data for this vehicle, sorted by timestamp (latest first)
      const vehicleTrackingData = vehicleData
        .filter(data => data.vehicle_id === vehicle.vehicle_id)
        .sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

      const latestData = vehicleTrackingData[0];
      const online = isVehicleOnline(latestData);
      const status = getVehicleStatus(latestData);
      
      let location = 'Location unknown';
      if (latestData && latestData.latitude && latestData.longitude) {
        location = getLocationName(latestData.latitude, latestData.longitude);
      }

      return {
        ...vehicle,
        latestData,
        isOnline: online,
        location,
        status,
        allData: vehicleTrackingData // Include all GPS data points
      };
    });
  }, [vehicles, vehicleData]);
  
  // Get all GPS points for map display
  const mapPoints = useMemo(() => {
    const points: Array<{
      vehicle: VehicleWithData;
      data: VehicleData;
      vehicleType: 'MOBIL' | 'MOTOR';
    }> = [];
    
    vehiclesWithData.forEach(vehicle => {
      if (vehicle.allData && vehicle.allData.length > 0) {
        // Get the latest GPS point with valid coordinates
        const validData = vehicle.allData.find(data => 
          data.latitude && data.longitude && 
          !isNaN(parseFloat(data.latitude)) && 
          !isNaN(parseFloat(data.longitude))
        );
        
        if (validData) {
          // Determine vehicle type
          const vehicleType = vehicle.make?.toLowerCase().includes('motor') || 
                             vehicle.model?.toLowerCase().includes('motor') || 
                             vehicle.make?.toLowerCase().includes('honda') ||
                             vehicle.make?.toLowerCase().includes('yamaha') ||
                             vehicle.make?.toLowerCase().includes('kawasaki') ||
                             vehicle.make?.toLowerCase().includes('suzuki')
                             ? 'MOTOR' : 'MOBIL';
          
          points.push({
            vehicle: vehicle as VehicleWithData,
            data: validData,
            vehicleType
          });
        }
      }
    });
    
    return points;
  }, [vehiclesWithData]);
  
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
      const opacity = isOffline ? 0.5 : 1;
      const borderColor = isOffline ? '#9CA3AF' : 'white';
      const pulseAnimation = status === 'moving' ? 'animation: pulse 2s infinite;' : '';
      
      return L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            background-color: ${color};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid ${borderColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
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
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
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
    if (!mapInstanceRef.current || !L || !mapPoints.length) return;
    
    const map = mapInstanceRef.current;
    
    // Clear existing markers
    markersRef.current.forEach(layer => {
      try {
        map.removeLayer(layer);
      } catch (e) {
        // Layer might already be removed
      }
    });
    markersRef.current = [];
    
    const icons = createIcons();
    
    // Add markers for each vehicle
    mapPoints.forEach(({ vehicle, data, vehicleType }) => {
      const lat = parseFloat(data.latitude!);
      const lng = parseFloat(data.longitude!);
      const position: [number, number] = [lat, lng];
      
      // Choose icon based on vehicle type and status
      let vehicleIcon;
      const status = vehicle.status;
      
      if (vehicleType === 'MOBIL') {
        vehicleIcon = status === 'moving' ? icons.carMoving : 
                     status === 'parked' ? icons.carParked : icons.carOffline;
      } else {
        vehicleIcon = status === 'moving' ? icons.motorMoving : 
                     status === 'parked' ? icons.motorParked : icons.motorOffline;
      }
      
      try {
        const marker = L.marker(position, { icon: vehicleIcon }).addTo(map);
        
        // Create popup content with vehicle and GPS data
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'No timestamp';
        const speed = data.speed || 0;
        const fuel = data.fuel_level ? parseFloat(data.fuel_level).toFixed(1) : 'N/A';
        const battery = data.battery_level ? parseFloat(data.battery_level).toFixed(1) : 'N/A';
        const rpm = data.rpm || 0;
        const satellites = data.satellites_used || 0;
        const ignition = data.ignition_status === 'true' ? 'ON' : 'OFF';
        
        const statusColor = status === 'moving' ? '#10B981' : 
                           status === 'parked' ? '#F59E0B' : '#6B7280';
        const statusText = status === 'moving' ? '🚗 Moving' : 
                          status === 'parked' ? '🅿️ Parked' : '📴 Offline';
        
        const popupContent = `
          <div style="min-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 8px; color: #1F2937;">${vehicle.name}</div>
            <div style="font-size: 14px; color: #6B7280; margin-bottom: 12px;">${vehicle.license_plate}</div>
            
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
                  ${lat.toFixed(6)}, ${lng.toFixed(6)}
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
              Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})<br>
              Device ID: ${vehicle.gps_device_id}
            </div>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markersRef.current.push(marker);
        
      } catch (error) {
        console.error('Error adding vehicle marker:', error);
      }
    });
    
    // Fit map bounds to show all vehicles
    if (mapPoints.length > 0) {
      try {
        if (mapPoints.length === 1) {
          // Single vehicle - center on it
          const { data } = mapPoints[0];
          const lat = parseFloat(data.latitude!);
          const lng = parseFloat(data.longitude!);
          map.setView([lat, lng], 15);
        } else {
          // Multiple vehicles - fit bounds
          const group = L.featureGroup(markersRef.current);
          map.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
      } catch (error) {
        console.error('Error fitting map bounds:', error);
      }
    }
    
  }, [mapPoints, L]);
  
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
      
      {/* Vehicle count and stats indicator */}
      {mapPoints && mapPoints.length > 0 && mapLoaded && (
        <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="animate-pulse">📍</span>
            <span>{mapPoints.length} Vehicle{mapPoints.length !== 1 ? 's' : ''} Tracked</span>
          </div>
          <div className="text-xs opacity-90">
            {vehiclesWithData.filter(v => v.isOnline).length} online • {vehicleData.length} GPS records
          </div>
        </div>
      )}
      
      {/* Real-time status indicator */}
      {!isLoading && mapLoaded && (
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg text-xs z-[1000] border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Live Tracking</span>
          </div>
          <div className="text-gray-600 mt-1">
            Updates every {refreshInterval / 1000}s
          </div>
        </div>
      )}
      
      {/* Legend */}
      {mapPoints.length > 0 && mapLoaded && (
        <div className="absolute bottom-4 right-4 bg-white bg-opacity-95 backdrop-blur-sm p-3 rounded-lg shadow-lg text-xs z-[1000] border">
          <div className="font-medium text-gray-800 mb-2">Vehicle Status</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[8px]">🚗</div>
              <span>Moving</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[8px]">🚗</div>
              <span>Parked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center text-[8px]">🚗</div>
              <span>Offline</span>
            </div>
          </div>
        </div>
      )}
      
      {/* No data message */}
      {!isLoading && (!mapPoints || mapPoints.length === 0) && mapLoaded && (
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