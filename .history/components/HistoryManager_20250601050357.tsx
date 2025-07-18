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
  speed: number;
}

export function HistoryManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | undefined>(undefined);

  // Get current user
  const getCurrentUser = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // Fetch vehicles
  const fetchVehicles = async (userId: string) => {
    try {
      const response = await fetch(
        'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      
      const data = await response.json();
      const userVehicles = data.data.filter((v: Vehicle) => v.user_id === userId);
      setVehicles(userVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // Fetch vehicle data with date range filter
  const fetchVehicleData = async (vehicleId: string, from?: Date, to?: Date) => {
    try {
      let url = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?limit=-1';
      
      // Add filters
      const filters = [];
      if (vehicleId) {
        filters.push(`filter[vehicle_id][_eq]=${vehicleId}`);
      }
      if (from && to) {
        filters.push(`filter[timestamp][_between]=${from.toISOString()},${to.toISOString()}`);
      }
      
      if (filters.length > 0) {
        url += '&' + filters.join('&');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicle data');
      }

      const data = await response.json();
      // Sort data by timestamp
      const sortedData = data.data.sort((a: VehicleData, b: VehicleData) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setVehicleData(sortedData);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const user = getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const userId = user.id || user.user_id;
      if (!userId) {
        setLoading(false);
        return;
      }

      await fetchVehicles(userId);
      setLoading(false);
    };

    loadData();
  }, []);

  // Fetch vehicle data when vehicle or date range changes
  useEffect(() => {
    if (selectedVehicle) {
      fetchVehicleData(selectedVehicle, dateRange?.from, dateRange?.to);
    }
  }, [selectedVehicle, dateRange]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate route statistics
  const calculateStats = () => {
    if (!vehicleData.length) return { distance: 0, duration: 0, avgSpeed: 0 };

    let totalDistance = 0;
    let totalSpeed = 0;
