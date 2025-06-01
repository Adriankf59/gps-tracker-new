"use client";

import { useEffect, useState } from 'react';

interface SimpleMapFallbackProps {
  center: [number, number];
  zoom: number;
  drawMode?: "polygon" | "circle";
  onDrawCreated?: (e: any) => void;
  onDrawEdited?: (e: any) => void;
  onDrawDeleted?: (e: any) => void;
  ruleType?: string;
  viewOnly?: boolean;
  geofence?: any;
}

export default function SimpleMapFallback({
  center,
  zoom,
  drawMode = "polygon",
  onDrawCreated,
  onDrawEdited,
  onDrawDeleted,
  ruleType = "FORBIDDEN",
  viewOnly = false,
  geofence
}: SimpleMapFallbackProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleCreateDemoShape = () => {
    if (!onDrawCreated) return;

    // Simulate creating a polygon
    const demoLayer = {
      getLatLngs: () => [[
        { lat: center[0] + 0.01, lng: center[1] + 0.01 },
        { lat: center[0] + 0.01, lng: center[1] - 0.01 },
        { lat: center[0] - 0.01, lng: center[1] - 0.01 },
        { lat: center[0] - 0.01, lng: center[1] + 0.01 }
      ]],
      getLatLng: () => ({ lat: center[0], lng: center[1] }),
      getRadius: () => 1000
    };

    onDrawCreated({
      layerType: drawMode,
      layer: demoLayer
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-green-50 flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
      <div className="text-center space-y-4">
        <div className="text-6xl mb-4">🗺️</div>
        <h3 className="text-lg font-semibold text-gray-700">Map Placeholder</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          {viewOnly ? (
            geofence ? (
              <>
                Viewing: <strong>{geofence.name}</strong><br />
                Type: {geofence.type}<br />
                Rule: {geofence.rule_type}
              </>
            ) : (
              'No geofence data to display'
            )
          ) : (
            <>
              Draw Mode: <strong>{drawMode}</strong><br />
              Rule Type: <strong>{ruleType}</strong><br />
              Center: {center[0].toFixed(4)}, {center[1].toFixed(4)}
            </>
          )}
        </p>

        {!viewOnly && onDrawCreated && (
          <div className="space-y-2">
            <button
              onClick={handleCreateDemoShape}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Create Demo {drawMode === 'circle' ? 'Circle' : 'Polygon'}
            </button>
            <p className="text-xs text-gray-400">
              Click to simulate drawing a {drawMode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}