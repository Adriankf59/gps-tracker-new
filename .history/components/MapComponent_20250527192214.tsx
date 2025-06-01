import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Komponen StationaryMarker
const StationaryMarker = ({ period, color = "purple", radius = 5 }) => {
  const circleRef = useRef(null);
  
  if (!period || !period.position) return null;
  
  return (
    <div 
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: radius * 2,
        height: radius * 2,
        backgroundColor: color,
        borderRadius: '50%',
        opacity: 0.6,
        border: '2px solid white',
        zIndex: 1000
      }}
      title={`Stationary: ${period.duration ? Math.round(period.duration / 60000) : '?'} min`}
    />
  );
};

// Komponen untuk update view map
const UpdateMapView = ({ position, mapRef }) => {
  useEffect(() => {
    if (position && position.length === 2 && mapRef.current) {
      const map = mapRef.current;
      map.setView(position, map.getZoom());
    }
  }, [position, mapRef]);
  
  return null;
};

const MapComponent = ({ 
  vehicles = [], 
  useFilteredData = true, 
  selectedDate = 'all', 
  useStationaryFiltering = true,
  filterSettings = { distanceThreshold: 5, timeThreshold: 5 * 60 * 1000 }
}) => {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const [map, setMap] = useState(null);
  const [L, setL] = useState(null);
  
  // Default center - Bandung coordinates
  const defaultCenter = [-6.914744, 107.609810];
  
  // Initialize map
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default);
        
        // Fix default icon issue
        delete leaflet.default.Icon.Default.prototype._getIconUrl;
        leaflet.default.Icon.Default.mergeOptions({
          iconRetinaUrl: '/leaflet/marker-icon-2x.png',
          iconUrl: '/leaflet/marker-icon.png',
          shadowUrl: '/leaflet/marker-shadow.png',
        });
      });
    }
  }, []);
  
  // Initialize map instance
  useEffect(() => {
    if (L && !map && mapRef.current) {
      const mapInstance = L.map(mapRef.current).setView(defaultCenter, 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance);
      
      setMap(mapInstance);
    }
    
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [L]);
  
  // Create custom icons
  const createIcons = () => {
    if (!L) return {};
    
    return {
      carIcon: L.icon({
        iconUrl: '/car.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      }),
      motorcycleIcon: L.icon({
        iconUrl: '/motorcycle.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      }),
      stationaryCarIcon: L.icon({
        iconUrl: '/car-parked.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      }),
      stationaryMotorcycleIcon: L.icon({
        iconUrl: '/motorcycle-parked.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      })
    };
  };
  
  // Determine if vehicle is stationary
  const isVehicleStationary = (vehicle) => {
    if (!vehicle || !vehicle.stationaryPeriods || !vehicle.stationaryPeriods.length) {
      return false;
    }
    const lastPeriod = vehicle.stationaryPeriods[vehicle.stationaryPeriods.length - 1];
    return !lastPeriod.endTime;
  };
  
  // Update map with vehicle data
  useEffect(() => {
    if (!map || !L || !vehicles.length) return;
    
    // Clear existing markers and polylines
    markersRef.current.forEach(marker => map.removeLayer(marker));
    polylinesRef.current.forEach(polyline => map.removeLayer(polyline));
    markersRef.current = [];
    polylinesRef.current = [];
    
    const icons = createIcons();
    const isDateFiltered = selectedDate !== 'all';
    
    // Safely extract center position
    let center = defaultCenter;
    let latestPosition = null;
    
    if (vehicles.length > 0) {
      const vehicle = vehicles[0];
      const positions = useStationaryFiltering && useFilteredData 
        ? (vehicle.filteredPositions || [])
        : useFilteredData 
          ? (vehicle.positions || []) 
          : (vehicle.rawPositions || []);
      
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
        ? (vehicle.filteredPositions || [])
        : useFilteredData 
          ? (vehicle.positions || []) 
          : (vehicle.rawPositions || []);
      
      const timestampsToShow = useStationaryFiltering && useFilteredData
        ? (vehicle.filteredTimestamps || [])
        : (vehicle.timestamps || []);
      
      if (!positionsToShow.length) return;
      
      // Add polyline for route
      const polyline = L.polyline(positionsToShow, { 
        color: useFilteredData ? "blue" : "red", 
        weight: 4 
      }).addTo(map);
      polylinesRef.current.push(polyline);
      
      // Add raw data polyline for comparison
      if (useFilteredData && useStationaryFiltering && vehicle.rawPositions && vehicle.rawPositions.length > 0) {
        const rawPolyline = L.polyline(vehicle.rawPositions, { 
          color: "red", 
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
      const popupContent = `
        <div class="font-medium">${vehicle.name}</div>
        <div class="text-sm">${vehicle.number}</div>
        <div class="mt-2">
          ${timestampsToShow && timestampsToShow.length > 0 
            ? new Date(timestampsToShow[timestampsToShow.length - 1]).toLocaleString()
            : 'No timestamp'}
        </div>
        <div class="mt-1">
          <div>Lat: ${currentPosition[0].toFixed(6)}</div>
          <div>Lng: ${currentPosition[1].toFixed(6)}</div>
        </div>
        ${isStationary ? 
          '<div class="mt-2 text-center font-medium text-yellow-600 py-1 px-2 bg-yellow-100 rounded">Kendaraan Sedang Diam</div>' 
          : ''}
        ${useStationaryFiltering && vehicle.filterStats ? 
          `<div class="mt-2 text-xs text-gray-600 border-t pt-2">
            <div>Filtering Data:</div>
            <div>${vehicle.filterStats.originalPoints || 0} titik asli → ${vehicle.filterStats.filteredPoints || 0} titik terfilter</div>
            <div>Reduksi: ${vehicle.filterStats.reductionPercentage || 0}%</div>
          </div>` 
          : ''}
      `;
      
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
      
      // Add stationary markers
      if (useStationaryFiltering && vehicle.stationaryPeriods) {
        vehicle.stationaryPeriods.forEach((period) => {
          if (period.position) {
            const stationaryMarker = L.circleMarker(period.position, {
              radius: filterSettings.distanceThreshold,
              color: 'purple',
              fillColor: 'purple',
              fillOpacity: 0.3,
              weight: 2
            }).addTo(map);
            
            stationaryMarker.bindPopup(`
              <div>Lokasi Diam</div>
              <div>Durasi: ${period.duration ? Math.round(period.duration / 60000) : '?'} menit</div>
              <div>Mulai: ${period.startTime ? new Date(period.startTime).toLocaleString() : 'Unknown'}</div>
              ${period.endTime ? `<div>Selesai: ${new Date(period.endTime).toLocaleString()}</div>` : '<div>Status: Masih diam</div>'}
            `);
            
            markersRef.current.push(stationaryMarker);
          }
        });
      }
    });
    
    // Update map view to latest position
    if (latestPosition) {
      map.setView(latestPosition, map.getZoom());
    }
    
  }, [map, L, vehicles, useFilteredData, useStationaryFiltering, filterSettings, selectedDate]);
  
  // Determine display info
  const hasPoints = vehicles && vehicles.length > 0 && (
    (vehicles[0].filteredPositions && vehicles[0].filteredPositions.length > 0) || 
    (vehicles[0].positions && vehicles[0].positions.length > 0) || 
    (vehicles[0].rawPositions && vehicles[0].rawPositions.length > 0)
  );
  
  const isDateFiltered = selectedDate !== 'all';
  
  return (
    <div className="relative">
      {/* Map container */}
      <div 
        ref={mapRef} 
        style={{ height: '600px', width: '100%' }}
        className="rounded-lg"
      />
      
      {/* Legend overlay */}
      <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-90 p-3 rounded-md text-white text-xs z-[1000] max-w-xs">
        <div className="flex items-center mb-2">
          <div className="w-4 h-1 bg-blue-500 mr-2"></div>
          <span>Filtered GPS Data</span>
        </div>
        <div className="flex items-center mb-2">
          <div className="w-4 h-1 bg-red-500 mr-2"></div>
          <span>Raw GPS Data</span>
        </div>
        
        {useStationaryFiltering && (
          <div className="flex items-center mb-2">
            <div className="w-4 h-4 bg-purple-500 mr-2 rounded-full border border-purple-300"></div>
            <span>Lokasi Diam ({filterSettings.distanceThreshold}m)</span>
          </div>
        )}
        
        {vehicles && vehicles.length > 0 && vehicles[0].timestamps && vehicles[0].timestamps.length > 0 ? (
          <div className="mt-3 pt-2 border-t border-gray-600">
            <div className="font-medium">Last update:</div>
            <div className="text-green-300">
              {new Date(vehicles[0].timestamps[vehicles[0].timestamps.length - 1]).toLocaleString()}
            </div>
            {isDateFiltered && (
              <div className="mt-1 text-yellow-300">
                Data: {new Date(selectedDate).toLocaleDateString('id-ID', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            )}
            {useStationaryFiltering && vehicles[0].filterStats && (
              <div className="mt-1 text-green-300">
                Reduksi: {vehicles[0].filterStats.reductionPercentage}%
              </div>
            )}
          </div>
        ) : !hasPoints ? (
          <div className="mt-3 pt-2 border-t border-gray-600">
            {isDateFiltered ? (
              <div className="text-yellow-300">
                No data for {new Date(selectedDate).toLocaleDateString('id-ID')}
              </div>
            ) : (
              <div className="text-yellow-300">No data available</div>
            )}
          </div>
        ) : null}
      </div>
      
      {/* Filter settings overlay */}
      {useStationaryFiltering && (
        <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 p-3 rounded-md text-white text-xs z-[1000]">
          <div className="font-medium border-b border-gray-600 pb-2 mb-2">Filter Settings</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Distance:</span>
              <span className="text-green-300 font-medium">{filterSettings.distanceThreshold}m</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span className="text-green-300 font-medium">{filterSettings.timeThreshold / (60 * 1000)}min</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Vehicle count indicator */}
      {vehicles && vehicles.length > 0 && (
        <div className="absolute top-4 left-4 bg-blue-600 bg-opacity-90 px-3 py-2 rounded-md text-white text-sm z-[1000]">
          <div className="font-medium">
            {vehicles.length} Kendaraan Aktif
          </div>
        </div>
      )}
    </div>
  );
};

// Demo component with sample data
const MapDemo = () => {
  const [useFilteredData, setUseFilteredData] = useState(true);
  const [useStationaryFiltering, setUseStationaryFiltering] = useState(true);
  const [selectedDate, setSelectedDate] = useState('all');
  const [filterSettings, setFilterSettings] = useState({
    distanceThreshold: 5,
    timeThreshold: 5 * 60 * 1000
  });
  
  // Sample vehicle data
  const sampleVehicles = [
    {
      id: 'vehicle-001',
      name: 'Toyota Avanza',
      number: 'B 1234 ABC',
      jenis_kendaraan: 'MOBIL',
      rawPositions: [
        [-6.914744, 107.609810],
        [-6.914750, 107.609815],
        [-6.914755, 107.609820],
        [-6.914800, 107.609900],
        [-6.914850, 107.610000],
        [-6.915000, 107.610200]
      ],
      positions: [
        [-6.914744, 107.609810],
        [-6.914800, 107.609900],
        [-6.914850, 107.610000],
        [-6.915000, 107.610200]
      ],
      filteredPositions: [
        [-6.914744, 107.609810],
        [-6.914850, 107.610000],
        [-6.915000, 107.610200]
      ],
      timestamps: [
        '2024-01-15T08:00:00Z',
        '2024-01-15T08:15:00Z',
        '2024-01-15T08:30:00Z',
        '2024-01-15T08:45:00Z'
      ],
      filteredTimestamps: [
        '2024-01-15T08:00:00Z',
        '2024-01-15T08:30:00Z',
        '2024-01-15T08:45:00Z'
      ],
      stationaryPeriods: [
        {
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T08:10:00Z',
          position: [-6.914744, 107.609810],
          duration: 10 * 60 * 1000
        },
        {
          startTime: '2024-01-15T08:40:00Z',
          endTime: null,
          position: [-6.915000, 107.610200],
          duration: null
        }
      ],
      filterStats: {
        originalPoints: 6,
        filteredPoints: 3,
        reductionPercentage: 50
      }
    },
    {
      id: 'vehicle-002',
      name: 'Honda Vario',
      number: 'B 5678 DEF',
      jenis_kendaraan: 'MOTOR',
      rawPositions: [
        [-6.915100, 107.610300],
        [-6.915200, 107.610400],
        [-6.915300, 107.610500],
        [-6.915400, 107.610600]
      ],
      positions: [
        [-6.915100, 107.610300],
        [-6.915200, 107.610400],
        [-6.915400, 107.610600]
      ],
      filteredPositions: [
        [-6.915100, 107.610300],
        [-6.915400, 107.610600]
      ],
      timestamps: [
        '2024-01-15T09:00:00Z',
        '2024-01-15T09:15:00Z',
        '2024-01-15T09:30:00Z'
      ],
      filteredTimestamps: [
        '2024-01-15T09:00:00Z',
        '2024-01-15T09:30:00Z'
      ],
      stationaryPeriods: [],
      filterStats: {
        originalPoints: 4,
        filteredPoints: 2,
        reductionPercentage: 50
      }
    }
  ];
  
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">GPS Vehicle Tracking Map</h1>
        
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Map Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Tanggal
              </label>
              <select 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Tanggal</option>
                <option value="2024-01-15">15 Januari 2024</option>
                <option value="2024-01-16">16 Januari 2024</option>
              </select>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={useFilteredData}
                  onChange={(e) => setUseFilteredData(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Gunakan Data Terfilter</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={useStationaryFiltering}
                  onChange={(e) => setUseStationaryFiltering(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Filter Titik Stasioner</span>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jarak Threshold: {filterSettings.distanceThreshold}m
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={filterSettings.distanceThreshold}
                onChange={(e) => setFilterSettings(prev => ({
                  ...prev,
                  distanceThreshold: parseInt(e.target.value)
                }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Waktu Threshold: {filterSettings.timeThreshold / (60 * 1000)} menit
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={filterSettings.timeThreshold / (60 * 1000)}
                onChange={(e) => setFilterSettings(prev => ({
                  ...prev,
                  timeThreshold: parseInt(e.target.value) * 60 * 1000
                }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
        
        {/* Map */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <MapComponent
            vehicles={sampleVehicles}
            useFilteredData={useFilteredData}
            selectedDate={selectedDate}
            useStationaryFiltering={useStationaryFiltering}
            filterSettings={filterSettings}
          />
        </div>
        
        {/* Vehicle Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {sampleVehicles.map(vehicle => (
            <div key={vehicle.id} className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-semibold text-gray-900">{vehicle.name}</h3>
              <p className="text-gray-600 mb-2">{vehicle.number}</p>
              <p className="text-sm text-gray-500 mb-4">Jenis: {vehicle.jenis_kendaraan}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Titik GPS Asli:</span>
                  <span className="font-medium">{vehicle.rawPositions?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Titik Terfilter:</span>
                  <span className="font-medium">{vehicle.positions?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Filter Stasioner:</span>
                  <span className="font-medium">{vehicle.filteredPositions?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Periode Diam:</span>
                  <span className="font-medium">{vehicle.stationaryPeriods?.length || 0}</span>
                </div>
              </div>
              
              {vehicle.filterStats && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">
                    Reduksi Data: {vehicle.filterStats.reductionPercentage}%
                  </div>
                  <div className="text-xs text-blue-700">
                    {vehicle.filterStats.originalPoints} → {vehicle.filterStats.filteredPoints} titik
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapDemo;