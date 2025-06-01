import React, { useEffect, useRef, useState } from 'react';

// Interface for MapComponent props
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
  vehicles?: MapVehicle[];
  useFilteredData?: boolean;
  selectedDate?: string;
  useStationaryFiltering?: boolean;
  filterSettings?: {
    distanceThreshold: number;
    timeThreshold: number;
  };
  height?: string;
  showControls?: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  vehicles = [], 
  useFilteredData = true, 
  selectedDate = 'all', 
  useStationaryFiltering = true,
  filterSettings = { distanceThreshold: 5, timeThreshold: 5 * 60 * 1000 },
  height = "600px",
  showControls = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  
  // Default center - Bandung coordinates
  const defaultCenter: [number, number] = [-6.914744, 107.609810];
  
  // Initialize Leaflet
  useEffect(() => {
    let mounted = true;
    
    const initializeLeaflet = async () => {
      try {
        // Dynamic import of Leaflet
        const leafletModule = await import('leaflet');
        const leaflet = leafletModule.default;
        
        // Import CSS
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
      
      // Add tile layer
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
    
    const createCustomIcon = (color: string, symbol: string) => {
      return L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${symbol}</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });
    };
    
    return {
      carIcon: createCustomIcon('#3B82F6', '🚗'),
      motorcycleIcon: createCustomIcon('#10B981', '🏍️'),
      stationaryCarIcon: createCustomIcon('#F59E0B', '🅿️'),
      stationaryMotorcycleIcon: createCustomIcon('#F59E0B', '🅿️')
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
    if (!mapInstanceRef.current || !L || !vehicles.length) return;
    
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
    
    if (vehicles.length > 0) {
      const vehicle = vehicles[0];
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
    
    vehicles.forEach(vehicle => {
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
            weight: 3,
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
          <div style="min-width: 200px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">${vehicle.name}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${vehicle.number}</div>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <strong>Last Update:</strong><br>${lastTimestamp}
            </div>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <strong>Coordinates:</strong><br>
              Lat: ${currentPosition[0].toFixed(6)}<br>
              Lng: ${currentPosition[1].toFixed(6)}
            </div>
            ${isStationary ? 
              '<div style="background: #FEF3C7; color: #92400E; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-align: center; margin-top: 8px;">🅿️ Vehicle Parked</div>' 
              : ''}
            ${useStationaryFiltering && vehicle.filterStats ? 
              `<div style="border-top: 1px solid #E5E7EB; padding-top: 8px; margin-top: 8px; font-size: 11px; color: #6B7280;">
                <div><strong>Data Filtering:</strong></div>
                <div>${vehicle.filterStats.originalPoints || 0} → ${vehicle.filterStats.filteredPoints || 0} points</div>
                <div>Reduction: ${vehicle.filterStats.reductionPercentage || 0}%</div>
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
                  radius: Math.max(filterSettings.distanceThreshold / 2, 3),
                  color: '#8B5CF6',
                  fillColor: '#8B5CF6',
                  fillOpacity: 0.2,
                  weight: 2
                }).addTo(map);
                
                const duration = period.duration ? Math.round(period.duration / 60000) : '?';
                const startTime = period.startTime ? new Date(period.startTime).toLocaleString() : 'Unknown';
                const endTime = period.endTime ? new Date(period.endTime).toLocaleString() : 'Still parked';
                
                stationaryMarker.bindPopup(`
                  <div style="text-align: center;">
                    <div style="font-weight: bold; margin-bottom: 4px;">🅿️ Parking Area</div>
                    <div style="font-size: 12px;">Duration: ${duration} minutes</div>
                    <div style="font-size: 11px; color: #666; margin-top: 4px;">
                      Start: ${startTime}<br>
                      End: ${endTime}
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
      if (vehicles.length > 1) {
        // Fit bounds to show all vehicles
        const allPositions = vehicles.flatMap(v => {
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
    
  }, [vehicles, useFilteredData, useStationaryFiltering, filterSettings, L]);
  
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
  
  const hasPoints = vehicles && vehicles.length > 0;
  const isDateFiltered = selectedDate !== 'all';
  
  return (
    <div className="relative">
      {/* Map container */}
      <div 
        ref={mapRef} 
        style={{ height, width: '100%' }}
        className="rounded-lg border"
      />
      
      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Legend overlay */}
      {mapLoaded && (
        <div className="absolute bottom-4 right-4 bg-white bg-opacity-95 backdrop-blur-sm p-3 rounded-lg shadow-lg text-xs z-[1000] max-w-xs border">
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="w-4 h-1 bg-blue-500 mr-2 rounded"></div>
              <span>Filtered GPS Data</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-1 bg-red-500 mr-2 rounded opacity-50" style={{borderStyle: 'dashed'}}></div>
              <span>Raw GPS Data</span>
            </div>
            
            {useStationaryFiltering && (
              <div className="flex items-center">
                <div className="w-4 h-4 bg-purple-500 mr-2 rounded-full opacity-30 border-2 border-purple-500"></div>
                <span>Parking Areas ({filterSettings.distanceThreshold}m)</span>
              </div>
            )}
            
            <div className="flex items-center space-x-4 pt-2 border-t">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 mr-1 rounded-full flex items-center justify-center text-[8px]">🚗</div>
                <span>Car</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 mr-1 rounded-full flex items-center justify-center text-[8px]">🏍️</div>
                <span>Motorcycle</span>
              </div>
            </div>
            
            {vehicles && vehicles.length > 0 ? (
              <div className="pt-2 border-t text-green-600">
                <div className="font-medium">{vehicles.length} vehicles tracked</div>
                {isDateFiltered && (
                  <div className="text-yellow-600">
                    Date: {new Date(selectedDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ) : !hasPoints ? (
              <div className="pt-2 border-t text-yellow-600">
                No tracking data available
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Filter settings overlay */}
      {useStationaryFiltering && mapLoaded && (
        <div className="absolute top-4 right-4 bg-white bg-opacity-95 backdrop-blur-sm p-3 rounded-lg shadow-lg text-xs z-[1000] border">
          <div className="font-medium border-b border-gray-200 pb-2 mb-2">Filter Settings</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Distance:</span>
              <span className="text-blue-600 font-medium">{filterSettings.distanceThreshold}m</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span className="text-blue-600 font-medium">{filterSettings.timeThreshold / (60 * 1000)}min</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Vehicle count indicator */}
      {vehicles && vehicles.length > 0 && mapLoaded && (
        <div className="absolute top-4 left-4 bg-blue-600 bg-opacity-95 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm z-[1000] shadow-lg">
          <div className="font-medium">
            📍 {vehicles.length} Vehicle{vehicles.length !== 1 ? 's' : ''} Active
          </div>
        </div>
      )}
      
      {/* No data message */}
      {!vehicles || vehicles.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-95 rounded-lg">
          <div className="text-center">
            <div className="text-4xl mb-4">🗺️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles to display</h3>
            <p className="text-gray-500">
              Add vehicles with GPS tracking to see them on the map.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MapComponent;