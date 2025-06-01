// components/SimpleMapComponent.tsx (Fallback jika MapLibre bermasalah)
import { useEffect, useState } from 'react';
import { MapPin, Navigation, Fuel, Zap, RefreshCw } from 'lucide-react';

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

interface SimpleMapComponentProps {
  height?: string;
}

export function SimpleMapComponent({ height = "400px" }: SimpleMapComponentProps) {
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch vehicle data from API
  const fetchVehicleData = async () => {
    try {
      console.log('📍 SimpleMap: Fetching vehicle data...');
      setError(null);
      setLoading(true);
      
      const [vehicleDataResponse, vehiclesResponse] = await Promise.all([
        fetch('/api/vehicle-data'),
        fetch('/api/vehicles')
      ]);

      console.log('📍 API Responses:', {
        vehicleData: vehicleDataResponse.status,
        vehicles: vehiclesResponse.status
      });

      if (vehicleDataResponse.ok && vehiclesResponse.ok) {
        const vehicleDataResult = await vehicleDataResponse.json();
        const vehiclesResult = await vehiclesResponse.json();
        
        console.log('📍 Data received:', {
          vehicleDataCount: vehicleDataResult.data?.length || 0,
          vehiclesCount: vehiclesResult.data?.length || 0
        });
        
        setVehicleData(vehicleDataResult.data || []);
        setVehicles(vehiclesResult.data || []);
      } else {
        throw new Error(`API Error: Vehicle data ${vehicleDataResponse.status}, Vehicles ${vehiclesResponse.status}`);
      }
    } catch (error) {
      console.error('📍 Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
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

  // Get vehicle status
  const getVehicleStatus = (data: VehicleData) => {
    if (!data.timestamp) return { status: 'offline', color: 'bg-gray-500' };
    
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    if (diffMinutes > 15) return { status: 'offline', color: 'bg-gray-500' };
    
    const speed = data.speed || 0;
    if (speed > 0) return { status: 'moving', color: 'bg-green-500' };
    return { status: 'parked', color: 'bg-orange-500' };
  };

  useEffect(() => {
    fetchVehicleData();
    const interval = setInterval(fetchVehicleData, 30000);
    return () => clearInterval(interval);
  }, []);

  const latestPositions = getLatestVehiclePositions();

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-100 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-spin" />
          <p className="text-slate-500">Loading vehicle data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-red-50 rounded-lg border border-red-200"
        style={{ height }}
      >
        <div className="text-center p-4">
          <MapPin className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 font-medium">Failed to load vehicle data</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
          <button 
            onClick={fetchVehicleData}
            className="mt-2 px-3 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          <span className="font-medium">{latestPositions.length} vehicles with GPS data</span>
        </div>
        <button 
          onClick={fetchVehicleData}
          className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded hover:bg-blue-200"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Vehicle List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-80 overflow-y-auto">
        {latestPositions.length > 0 ? (
          latestPositions.map((data) => {
            const vehicleInfo = getVehicleInfo(data.vehicle_id);
            const status = getVehicleStatus(data);
            const fuelLevel = data.fuel_level ? parseFloat(data.fuel_level).toFixed(1) : 'N/A';
            const batteryLevel = data.battery_level ? parseFloat(data.battery_level).toFixed(1) : 'N/A';
            
            return (
              <div key={data.data_id} className="p-4 border rounded-lg hover:bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                    <h4 className="font-medium">
                      {vehicleInfo?.name || `Vehicle ${data.vehicle_id}`}
                    </h4>
                  </div>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                    {status.status}
                  </span>
                </div>
                
                <div className="text-sm text-slate-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>License:</span>
                    <span className="font-mono">{vehicleInfo?.license_plate || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Coordinates:</span>
                    <span className="font-mono text-xs">
                      {parseFloat(data.latitude!).toFixed(5)}, {parseFloat(data.longitude!).toFixed(5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Speed:</span>
                    <span>{data.speed || 0} km/h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Fuel:</span>
                    <span className="flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-blue-500" />
                      {fuelLevel}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Battery:</span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-green-500" />
                      {batteryLevel}V
                    </span>
                  </div>
                  {data.timestamp && (
                    <div className="text-xs text-slate-400 mt-2">
                      Last update: {new Date(data.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    const lat = parseFloat(data.latitude!);
                    const lng = parseFloat(data.longitude!);
                    const url = `https://www.google.com/maps?q=${lat},${lng}`;
                    window.open(url, '_blank');
                  }}
                  className="mt-2 w-full px-3 py-1 bg-blue-100 text-blue-600 text-xs rounded hover:bg-blue-200"
                >
                  View on Google Maps
                </button>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-8">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No GPS data available</h3>
            <p className="text-slate-500">Vehicles need to have valid GPS coordinates to appear here</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-4 border-t">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>Moving</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <span>Parked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span>Offline</span>
        </div>
      </div>
    </div>
  );
}