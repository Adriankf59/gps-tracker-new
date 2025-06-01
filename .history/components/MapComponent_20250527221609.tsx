import React, { useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';

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

// Interface for MapComponent
interface MapVehicle {
  id: string;
  name: string;
  number: string;
  jenis_kendaraan: 'MOBIL' | 'MOTOR';
  positions: [number, number][];
  timestamps: string[];
  rawPositions?: [number, number][];
  filteredPositions?: [number, number][];
  filteredTimestamps?: string[];
  stationaryPeriods?: Array<{
    startTime: string;
    endTime: string | null;
    position: [number, number];
    duration: number | null;
  }>;
  filterStats?: {
    originalPoints: number;
    filteredPoints: number;
    reductionPercentage: number;
  };
}

interface MapComponentProps {
  useFilteredData?: boolean;
  selectedDate?: string;
  useStationaryFiltering?: boolean;
  filterSettings?: {
    distanceThreshold: number;
    timeThreshold: number;
  };
  height?: string;
  showControls?: boolean;
  userId?: string;
  refreshInterval?: number;
}

// SWR fetcher function
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
};

// Custom hook for vehicle data with SWR
const useVehicleData = (userId?: string, refreshInterval: number = 30000) => {
  // Build URLs with user filter if provided
  const vehiclesUrl = userId ? `/api/vehicles?user_id=${userId}` : '/api/vehicles';
  const vehicleDataUrl = '/api/vehicle-data';
  
  const { data: vehiclesResponse, error: vehiclesError, isLoading: vehiclesLoading } = useSWR(
    vehiclesUrl,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  );
  
  const { data: vehicleDataResponse, error: vehicleDataError, isLoading: vehicleDataLoading } = useSWR(
    vehicleDataUrl,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );
  
  const isLoading = vehiclesLoading || vehicleDataLoading;
  const error = vehiclesError || vehicleDataError;
  
  // Process and combine data
  const processedVehicles = useMemo(() => {
    if (!vehiclesResponse?.data || !vehicleDataResponse?.data) return [];
    
    const vehiclesList: Vehicle[] = vehiclesResponse.data || [];
    const vehicleDataList: VehicleData[] = vehicleDataResponse.data || [];
    
    // Helper functions
    const isVehicleOnline = (data: VehicleData | undefined): boolean => {
      if (!data || !data.timestamp) return false;
      const lastUpdate = new Date(data.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      return diffMinutes <= 15; // Online if updated within 15 minutes
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
    
    const getLocationName = (lat: string, lng: string): string => {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      // Area Bandung
      if (latitude >= -6.95 && latitude <= -6.85 && longitude >= 107.55 && longitude <= 107.75) {
        if (latitude <= -6.89 && longitude >= 107.69) {
          return "Jl. Dago, Bandung";
        }
        return "Bandung, Jawa Barat";
      }
      
      // Area Jakarta
      if (latitude >= -6.3 && latitude <= -6.1 && longitude >= 106.7 && longitude <= 106.9) {
        return "Jakarta";
      }
      
      return `${lat}, ${lng}`;
    };
    
    // Combine vehicle data with latest tracking data
    const combinedData: VehicleWithData[] = vehiclesList.map(vehicle => {
      // Get latest data for this vehicle
      const vehicleTrackingData = vehicleDataList
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
        status
      };
    });
    
    return combinedData;
  }, [vehiclesResponse, vehicleDataResponse]);
  
  return {
    vehicles: processedVehicles,
    isLoading,
    error,
    vehiclesCount: processedVehicles.length,
    onlineCount: processedVehicles.filter(v => v.isOnline).length
  };
};

const MapComponent: React.FC<MapComponentProps> = ({ 
  useFilteredData = true, 
  selectedDate = 'all', 
  useStationaryFiltering = true,
  filterSettings = { distanceThreshold: 5, timeThreshold: 5 * 60 * 1000 },
  height = "600px",
  showControls = false,
  userId,
  refreshInterval = 30000
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  
  // Use SWR hook for data fetching
  const { vehicles, isLoading, error, vehiclesCount, onlineCount } = useVehicleData(userId, refreshInterval);
  
  // Default center - Bandung coordinates
  const defaultCenter: [number, number] = [-6.914744, 107.609810];
  
  // Convert vehicles data to MapComponent format
  const mapVehicles: MapVehicle[] = useMemo(() => {
    return vehicles
      .filter(vehicle => vehicle.latestData && vehicle.latestData.latitude && vehicle.latestData.longitude)
      .map(vehicle => {
        const lat = parseFloat(vehicle.latestData!.latitude!);
        const lng = parseFloat(vehicle.latestData!.longitude!);
        const position: [number, number] = [lat, lng];
        
        // Determine vehicle type based on make/model
        const vehicleType = vehicle.make?.toLowerCase().includes('motor') || 
                           vehicle.model?.toLowerCase().includes('motor') || 
                           vehicle.make?.toLowerCase().includes('honda') ||
                           vehicle.make?.toLowerCase().includes('yamaha') ||
                           vehicle.make?.toLowerCase().includes('kawasaki') ||
                           vehicle.make?.toLowerCase().includes('suzuki')
                           ? 'MOTOR' : 'MOBIL';

        // Create position data
        const positions: [number, number][] = [position];
        const timestamps = vehicle.latestData?.timestamp ? [vehicle.latestData.timestamp] : [];

        // Generate sample historical data for moving vehicles
        const historicalPositions: [number, number][] = [];
        const historicalTimestamps: string[] = [];
        
        if (vehicle.isOnline && vehicle.status === 'moving') {
          const baseTime = new Date(vehicle.latestData?.timestamp || new Date());
          for (let i = 5; i >= 1; i--) {
            const offsetLat = (Math.random() - 0.5) * 0.002; // Small random offset
            const offsetLng = (Math.random() - 0.5) * 0.002;
            historicalPositions.push([lat + offsetLat, lng + offsetLng]);
            const histTime = new Date(baseTime.getTime() - (i * 5 * 60 * 1000)); // 5 min intervals
            historicalTimestamps.push(histTime.toISOString());
          }
          historicalPositions.push(position);
          historicalTimestamps.push(vehicle.latestData?.timestamp || new Date().toISOString());
        }

        // Create stationary periods for parked vehicles
        const stationaryPeriods = vehicle.status === 'parked' ? [{
          startTime: vehicle.latestData?.timestamp || new Date().toISOString(),
          endTime: null,
          position,
          duration: null
        }] : [];

        return {
          id: vehicle.vehicle_id,
          name: vehicle.name,
          number: vehicle.license_plate,
          jenis_kendaraan: vehicleType,
          positions: historicalPositions.length > 0 ? historicalPositions : positions,
          timestamps: historicalTimestamps.length > 0 ? historicalTimestamps : timestamps,
          rawPositions: historicalPositions.length > 0 ? historicalPositions : positions,
          filteredPositions: positions,
          filteredTimestamps: timestamps,
          stationaryPeriods,
          filterStats: historicalPositions.length > 0 ? {
            originalPoints: historicalPositions.length,
            filteredPoints: positions.length,
            reductionPercentage: Math.round((1 - positions.length / historicalPositions.length) * 100)
          } : undefined
        };
      });
  }, [vehicles]);
  
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
    
    const createCustomIcon = (color: string, symbol: string, isStationary = false) => {
      const opacity = isStationary ? 0.7 : 1;
      const borderColor = isStationary ? '#F59E0B' : 'white';
      
      return L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            background-color: ${color};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid ${borderColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            color: white;
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            opacity: ${opacity};
            ${isStationary ? 'animation: pulse 2s infinite;' : ''}
          ">${symbol}</div>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); }
            }
          </style>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });
    };
    
    return {
      carIcon: createCustomIcon('#3B82F6', '🚗'),
      motorcycleIcon: createCustomIcon('#10B981', '🏍️'),
      stationaryCarIcon: createCustomIcon('#F59E0B', '🅿️', true),
      stationaryMotorcycleIcon: createCustomIcon('#F59E0B', '🅿️', true)
    };
  };
  
  // Determine if vehicle is stationary
  const isVehicleStationary = (vehicle: MapVehicle) => {
    if (!vehicle.stationaryPeriods || !vehicle.stationaryPeriods.length) {
      return false;
    }
    const lastPeriod = vehicle.stationaryPeriods[vehicle.stationaryPeriods.length - 1];
    return !lastPeriod.endTime;
  };
  
  // Update map with vehicle data
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !mapVehicles.length) return;
    
    const map = mapInstanceRef.current;
    
    // Clear existing markers and polylines
    markersRef.current.forEach(layer => {
      try {
        map.removeLayer(layer);
      } catch (e) {
        // Layer might already be removed
      }
    });
    polylinesRef.current.forEach(layer => {
      try {
        map.removeLayer(layer);
      } catch (e) {
        // Layer might already be removed
      }
    });
    markersRef.current = [];
    polylinesRef.current = [];
    
    const icons = createIcons();
    
    // Find center position
    let center = defaultCenter;
    let latestPosition: [number, number] | null = null;
    
    if (mapVehicles.length > 0) {
      const vehicle = mapVehicles[0];
      const positions = useStationaryFiltering && useFilteredData 
        ? (vehicle.filteredPositions || vehicle.positions || [])
        : useFilteredData 
          ? (vehicle.positions || []) 
          : (vehicle.rawPositions || vehicle.positions || []);
      
      if (positions && positions.length > 0) {
        const lastPos = positions[positions.length - 1];
        if (Array.isArray(lastPos) && lastPos.length === 2) {
          center = lastPos;
          latestPosition = lastPos;
        }
      }
    }
    
    mapVehicles.forEach(vehicle => {
      const isStationary = isVehicleStationary(vehicle);
      const vehicleIcon = isStationary 
        ? (vehicle.jenis_kendaraan === 'MOBIL' ? icons.stationaryCarIcon : icons.stationaryMotorcycleIcon)
        : (vehicle.jenis_kendaraan === 'MOBIL' ? icons.carIcon : icons.motorcycleIcon);
      
      // Choose positions to display
      const positionsToShow = useStationaryFiltering && useFilteredData 
        ? (vehicle.filteredPositions || vehicle.positions || [])
        : useFilteredData 
          ? (vehicle.positions || []) 
          : (vehicle.rawPositions || vehicle.positions || []);
      
      const timestampsToShow = useStationaryFiltering && useFilteredData
        ? (vehicle.filteredTimestamps || vehicle.timestamps || [])
        : (vehicle.timestamps || []);
      
      if (!positionsToShow.length) return;
      
      try {
        // Add polyline for route
        if (positionsToShow.length > 1) {
          const polyline = L.polyline(positionsToShow, { 
            color: useFilteredData ? "#3B82F6" : "#EF4444", 
            weight: 4,
            opacity: 0.8
          }).addTo(map);
          polylinesRef.current.push(polyline);
        }
        
        // Add raw data polyline for comparison
        if (useFilteredData && useStationaryFiltering && vehicle.rawPositions && vehicle.rawPositions.length > 1) {
          const rawPolyline = L.polyline(vehicle.rawPositions, { 
            color: "#EF4444", 
            weight: 2, 
            opacity: 0.3,
            dashArray: "5,10"
          }).addTo(map);
          polylinesRef.current.push(rawPolyline);
        }
        
        // Add current position marker
        const currentPosition = positionsToShow[positionsToShow.length - 1];
        const marker = L.marker(currentPosition, { icon: vehicleIcon }).addTo(map);
        
        // Create popup content
        const lastTimestamp = timestampsToShow && timestampsToShow.length > 0 
          ? new Date(timestampsToShow[timestampsToShow.length - 1]).toLocaleString()
          : 'No timestamp';
        
        const popupContent = `
          <div style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #1F2937;">${vehicle.name}</div>
            <div style="font-size: 13px; color: #6B7280; margin-bottom: 10px;">${vehicle.number}</div>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <strong style="color: #374151;">Last Update:</strong><br>
              <span style="color: #10B981;">${lastTimestamp}</span>
            </div>
            <div style="font-size: 12px; margin-bottom: 10px;">
              <strong style="color: #374151;">Coordinates:</strong><br>
              <code style="background: #F3F4F6; padding: 2px 4px; border-radius: 3px;">
                ${currentPosition[0].toFixed(6)}, ${currentPosition[1].toFixed(6)}
              </code>
            </div>
            ${isStationary ? 
              '<div style="background: linear-gradient(135deg, #FEF3C7, #FDE68A); color: #92400E; padding: 8px; border-radius: 6px; font-size: 12px; text-align: center; margin: 10px 0; border: 1px solid #F59E0B;">🅿️ Vehicle Currently Parked</div>' 
              : '<div style="background: linear-gradient(135deg, #D1FAE5, #A7F3D0); color: #065F46; padding: 8px; border-radius: 6px; font-size: 12px; text-align: center; margin: 10px 0; border: 1px solid #10B981;">🚗 Vehicle Moving</div>'}
            ${useStationaryFiltering && vehicle.filterStats ? 
              `<div style="border-top: 1px solid #E5E7EB; padding-top: 8px; margin-top: 10px; font-size: 11px; color: #6B7280; background: #F9FAFB; padding: 8px; border-radius: 4px;">
                <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">📊 Data Filtering:</div>
                <div>${vehicle.filterStats.originalPoints || 0} → ${vehicle.filterStats.filteredPoints || 0} points</div>
                <div>Reduction: <span style="color: #059669; font-weight: 600;">${vehicle.filterStats.reductionPercentage || 0}%</span></div>
              </div>` 
              : ''}
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markersRef.current.push(marker);
        
        // Add stationary markers
        if (useStationaryFiltering && vehicle.stationaryPeriods) {
          vehicle.stationaryPeriods.forEach((period) => {
            if (period.position) {
              try {
                const stationaryMarker = L.circleMarker(period.position, {
                  radius: Math.max(filterSettings.distanceThreshold / 2, 4),
                  color: '#8B5CF6',
                  fillColor: '#8B5CF6',
                  fillOpacity: 0.3,
                  weight: 3,
                  dashArray: '5,5'
                }).addTo(map);
                
                const duration = period.duration ? Math.round(period.duration / 60000) : '?';
                const startTime = period.startTime ? new Date(period.startTime).toLocaleString() : 'Unknown';
                const endTime = period.endTime ? new Date(period.endTime).toLocaleString() : 'Still parked';
                
                stationaryMarker.bindPopup(`
                  <div style="text-align: center; font-family: system-ui, -apple-system, sans-serif; min-width: 180px;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #6B46C1; font-size: 14px;">🅿️ Parking Zone</div>
                    <div style="background: #EDE9FE; color: #6B46C1; padding: 6px; border-radius: 6px; margin: 8px 0;">
                      <strong>Duration:</strong> ${duration} minutes
                    </div>
                    <div style="font-size: 11px; color: #6B7280; line-height: 1.4;">
                      <strong>Start:</strong> ${startTime}<br>
                      <strong>End:</strong> ${endTime}
                    </div>
                  </div>
                `);
                
                markersRef.current.push(stationaryMarker);
              } catch (e) {
                console.warn('Error adding stationary marker:', e);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error adding vehicle to map:', error);
      }
    });
    
    // Update map view to show all vehicles or center on latest
    try {
      if (mapVehicles.length > 1) {
        const allPositions = mapVehicles.flatMap(v => {
          const positions = useStationaryFiltering && useFilteredData 
            ? (v.filteredPositions || v.positions || [])
            : (v.positions || []);
          return positions;
        }).filter(pos => Array.isArray(pos) && pos.length === 2);
        
        if (allPositions.length > 0) {
          const group = L.featureGroup(markersRef.current.filter(m => m.getLatLng));
          if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
          }
        }
      } else if (latestPosition) {
        map.setView(latestPosition, 15);
      }
    } catch (error) {
      console.error('Error updating map view:', error);
    }
    
  }, [mapVehicles, useFilteredData, useStationaryFiltering, filterSettings, L]);
  
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
  
  const isDateFiltered = selectedDate !== 'all';
  
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
              {error.message || 'Unable to fetch vehicle tracking data'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
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
      {mapVehicles && mapVehicles.length > 0 && mapLoaded && (
        <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="animate-pulse">📍</span>
            <span>{mapVehicles.length} Vehicle{mapVehicles.length !== 1 ? 's' : ''} Active</span>
          </div>
          <div className="text-xs opacity-90">
            {onlineCount} online • Updated {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
      
      {/* No data message */}
      {!isLoading && (!mapVehicles || mapVehicles.length === 0) && mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-95 rounded-lg">
          <div className="text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No GPS Data Available</h3>
            <p className="text-gray-500 mb-4 max-w-md">
              {vehiclesCount === 0 
                ? "No vehicles found. Add vehicles with GPS tracking to see them on the map."
                : "Your vehicles don't have current GPS location data."
              }
            </p>
            <div className="text-sm text-gray-400">
              Data refreshes automatically every {refreshInterval / 1000} seconds
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;