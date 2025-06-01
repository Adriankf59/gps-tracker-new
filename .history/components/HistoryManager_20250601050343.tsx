import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { History, MapPin, Calendar, Clock, Car, Route } from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamically import MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false
});

interface Vehicle {
  vehicle_id: string;
  user_id: string;
  name: string;
  license_plate: string;
}

interface VehicleData {
  vehicle_id: string;
  timestamp: string;
  latitude: string;
  longitude: string;
