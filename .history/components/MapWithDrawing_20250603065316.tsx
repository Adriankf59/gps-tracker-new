"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, Circle, Polygon, Popup, Marker } from 'react-leaflet';
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import type { Layer } from 'leaflet';

// Fix untuk Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Interface untuk props
interface MapWithDrawingProps {
  center: [number, number];
  zoom: number;
  drawMode?: 'polygon' | 'circle';
  onDrawCreated?: (e: { layerType: string; layer: Layer }) => void;
  onDrawDeleted?: () => void;
  viewOnly?: boolean;
  geofences?: Array<{
    geofence_id: number;
    name: string;
    type: "circle" | "polygon";
    rule_type: "STANDARD" | "FORBIDDEN" | "STAY_IN";
    status: "active" | "inactive";
    definition: {
      coordinates?: number[][][];
      center?: number[];
      radius?: number;
      type: string;
    };
  }>;
  selectedGeofence?: any;
  isCreating?: boolean;
  drawnLayersForEditing?: Layer[];
}

// Hook untuk mengupdate center dan zoom
function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

// Hook untuk handle drawing events
function DrawingEventHandler({ 
  onDrawCreated, 
  onDrawDeleted, 
  isCreating,
  drawMode 
}: {
  onDrawCreated?: (e: { layerType: string; layer: Layer }) => void;
  onDrawDeleted?: () => void;
  isCreating?: boolean;
  drawMode?: 'polygon' | 'circle';
}) {
  const map = useMap();
  
  useEffect(() => {
    if (!isCreating || !onDrawCreated) return;
    
    const handleDrawCreated = (e: any) => {
      console.log('Draw created event:', e);
      if (onDrawCreated) {
        onDrawCreated({
          layerType: e.layerType,
          layer: e.layer
        });
      }
    };
    
    const handleDrawDeleted = (e: any) => {
      console.log('Draw deleted event:', e);
      if (onDrawDeleted) {
        onDrawDeleted();
      }
    };
    
    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);
    
    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
      map.off(L.Draw.Event.DELETED, handleDrawDeleted);
    };
  }, [map, onDrawCreated, onDrawDeleted, isCreating]);
  
  return null;
}

// Component untuk menampilkan geofences
function GeofenceLayer({ geofences, selectedGeofence }: {
  geofences?: Array<any>;
  selectedGeofence?: any;
}) {
  if (!geofences || geofences.length === 0) return null;
  
  return (
    <>
      {geofences.map((geofence) => {
        const isSelected = selectedGeofence?.geofence_id === geofence.geofence_id;
        
        // Style berdasarkan rule type dan selection state
        const getGeofenceStyle = () => {
          const baseStyle = {
            weight: isSelected ? 3 : 2,
            opacity: isSelected ? 1 : 0.7,
            fillOpacity: isSelected ? 0.3 : 0.2,
          };
          
          switch (geofence.rule_type) {
            case 'FORBIDDEN':
              return {
                ...baseStyle,
                color: '#ef4444', // red
                fillColor: '#fee2e2'
              };
            case 'STAY_IN':
              return {
                ...baseStyle,
                color: '#3b82f6', // blue
                fillColor: '#dbeafe'
              };
            case 'STANDARD':
              return {
                ...baseStyle,
                color: '#10b981', // green
                fillColor: '#d1fae5'
              };
            default:
              return {
                ...baseStyle,
                color: '#6b7280', // gray
                fillColor: '#f3f4f6'
              };
          }
        };
        
        const style = getGeofenceStyle();
        
        if (geofence.type === 'circle' && geofence.definition.center &&