// components/MapComponent.tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Navigation, Fuel, Zap } from 'lucide-react';

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

interface Vehicle {
  vehicle_id: string;
  name: string;
  license_plate: string;
  make: string;
  model: string;
}

interface MapComponentProps {
  height?: string;
  showControls?: boolean;
}

export function MapComponent({ height = "400px", showControls = true }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Fetch vehicle data from API
  const fetchVehicleData = async () => {
    try {
      console.log('🗺️ MapComponent: Fetching vehicle data...');
      setError(null);
      
      const [vehicleDataResponse, vehiclesResponse] = await Promise.all([
        fetch('/api/vehicle-data').catch(err => {
          console.error('🗺️ Vehicle data fetch error:', err);
          return { ok: false, status: 'network_error' };
        }),
        fetch('/api/vehicles').catch(err => {
          console.error('🗺️ Vehicles fetch error:', err);
          return { ok: false, status: 'network_error' };
        })
      ]);

      console.log('🗺️ Vehicle data response status:', vehicleDataResponse.status);
      console.log('🗺️ Vehicles response status:', vehiclesResponse.status);

      if (vehicleDataResponse.ok && vehiclesResponse.ok) {
        const vehicleDataResult = await vehicleDataResponse.json();
        const vehiclesResult = await vehiclesResponse.json();
        
        console.log('🗺️ Vehicle data received:', vehicleDataResult.data?.length || 0, 'records');
        console.log('🗺️ Vehicles received:', vehiclesResult.data?.length || 0, 'vehicles');
        
        setVehicleData(vehicleDataResult.data || []);
        setVehicles(vehiclesResult.data || []);
      } else {
        const errorMsg = `API Error - Vehicle data: ${vehicleDataResponse.status}, Vehicles: ${vehiclesResponse.status}`;
        console.error('🗺️', errorMsg);
        setError(errorMsg);
      }
    } catch (error) {
      console.error('🗺️ Error fetching vehicle data:', error);
      setError('Failed to fetch vehicle data');
    } finally {
      console.log('🗺️ Setting loading to false');
      setLoading(false);
    }
  };

  // Get latest position for each vehicle
  const getLatestVehiclePositions = () => {
    const latestPositions: { [key: string]: VehicleData } = {};
    
    vehicleData.forEach(data => {
      if (data.latitude && data.longitude) {
        const vehicleId = data.vehicle_id;
        if (!latestPositions[vehicleId] || 
            (data.timestamp && latestPositions[vehicleId].timestamp && 
             new Date(data.timestamp) > new Date(latestPositions[vehicleId].timestamp))) {
          latestPositions[vehicleId] = data;
        }
      }
    });
    
    return Object.values(latestPositions);
  };

  // Get vehicle info by ID
  const getVehicleInfo = (vehicleId: string) => {
    return vehicles.find(v => v.vehicle_id === vehicleId);
  };

  // Create popup content for vehicle
  const createPopupContent = (data: VehicleData, vehicleInfo?: Vehicle) => {
    const fuelLevel = data.fuel_level ? parseFloat(data.fuel_level).toFixed(1) : 'N/A';
    const batteryLevel = data.battery_level ? parseFloat(data.battery_level).toFixed(1) : 'N/A';
    const speed = data.speed || 0;
    const lastUpdate = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'No timestamp';
    
    return `
      <div class="vehicle-popup" style="min-width: 200px;">
        <div style="font-weight: bold; margin-bottom: 8px; color: #1e293b;">
          ${vehicleInfo?.name || `Vehicle ${data.vehicle_id}`}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
          ${vehicleInfo?.license_plate || 'Unknown'} • ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #3b82f6;">📍</span>
            <span>Speed: ${speed} km/h</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #f59e0b;">⛽</span>
            <span>Fuel: ${fuelLevel}%</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #10b981;">🔋</span>
            <span>Battery: ${batteryLevel}V</span>
          </div>
          <div style="color: #64748b; margin-top: 4px;">
            Last update: ${lastUpdate}
          </div>
        </div>
      </div>
    `;
  };

  // Get marker color based on vehicle status
  const getMarkerColor = (data: VehicleData) => {
    if (!data.timestamp) return '#6b7280'; // Gray for no data
    
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes > 15) return '#6b7280'; // Gray for offline
    
    const speed = data.speed || 0;
    if (speed > 0) return '#10b981'; // Green for moving
    return '#f59e0b'; // Orange for parked
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      },
      center: [107.6098, -6.9147], // Default to Bandung coordinates
      zoom: 12
    });

    if (showControls) {
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');
    }

    // Fetch initial data
    fetchVehicleData();

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [showControls]);

  // Update markers when vehicle data changes
  useEffect(() => {
    if (!map.current || loading) return;

    const latestPositions = getLatestVehiclePositions();
    
    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.vehicle-marker');
    existingMarkers.forEach(marker => marker.remove());

    if (latestPositions.length === 0) return;

    // Calculate bounds for all vehicles
    const bounds = new maplibregl.LngLatBounds();
    let hasValidBounds = false;

    latestPositions.forEach(data => {
      const lat = parseFloat(data.latitude!);
      const lng = parseFloat(data.longitude!);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        bounds.extend([lng, lat]);
        hasValidBounds = true;

        // Create marker element
        const markerElement = document.createElement('div');
        markerElement.className = 'vehicle-marker';
        markerElement.style.width = '24px';
        markerElement.style.height = '24px';
        markerElement.style.borderRadius = '50%';
        markerElement.style.backgroundColor = getMarkerColor(data);
        markerElement.style.border = '2px solid white';
        markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        markerElement.style.cursor = 'pointer';
        markerElement.style.display = 'flex';
        markerElement.style.alignItems = 'center';
        markerElement.style.justifyContent = 'center';
        
        // Add vehicle icon
        markerElement.innerHTML = '🚗';
        markerElement.style.fontSize = '12px';

        // Create popup
        const vehicleInfo = getVehicleInfo(data.vehicle_id);
        const popup = new maplibregl.Popup({
          offset: 25,
          closeButton: true,
          closeOnClick: false
        }).setHTML(createPopupContent(data, vehicleInfo));

        // Create marker
        const marker = new maplibregl.Marker({
          element: markerElement,
          anchor: 'center'
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map.current!);

        // Add click event
        markerElement.addEventListener('click', () => {
          setSelectedVehicle(data.vehicle_id);
          popup.addTo(map.current!);
        });
      }
    });

    // Fit map to show all vehicles
    if (hasValidBounds && latestPositions.length > 1) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    } else if (latestPositions.length === 1) {
      const data = latestPositions[0];
      const lat = parseFloat(data.latitude!);
      const lng = parseFloat(data.longitude!);
      map.current.setCenter([lng, lat]);
      map.current.setZoom(14);
    }

  }, [vehicleData, vehicles, loading]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchVehicleData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-100 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-pulse" />
          <p className="text-slate-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={mapContainer} 
        className="w-full rounded-lg overflow-hidden"
        style={{ height }}
      />
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
        <h4 className="font-semibold mb-2">Vehicle Status</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Moving</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Parked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Offline</span>
          </div>
        </div>
      </div>

      {/* Vehicle Count Info */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span className="font-semibold">
            {getLatestVehiclePositions().length} vehicles on map
          </span>
        </div>
      </div>
    </div>
  );
}