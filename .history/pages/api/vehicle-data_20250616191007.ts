// pages/api/vehicle-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Vehicle Data API called with method:', req.method);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, limit = '100' } = req.query;
    console.log('Fetching vehicle data from external API for user:', user_id);
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // 1. Get user's vehicles
    const { API_BASE_URL } = await import('../../api/file');
    const vehiclesUrl = `${API_BASE_URL}/items/vehicle?filter[user_id][_eq]=${user_id}`;
    
    const vehiclesResponse = await fetch(vehiclesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!vehiclesResponse.ok) {
      throw new Error(`Failed to fetch user vehicles: ${vehiclesResponse.status}`);
    }
    
    const vehiclesData = await vehiclesResponse.json();
    const userVehicles = vehiclesData.data || [];
    
    console.log(`Found ${userVehicles.length} vehicles for user ${user_id}`);
    
    if (userVehicles.length === 0) {
      return res.status(200).json({ data: [] });
    }
    
    // 2. Get GPS IDs
    const userGpsIds = userVehicles
      .map((vehicle: any) => vehicle.gps_id)
      .filter((gpsId: any) => gpsId !== null && gpsId !== undefined && gpsId !== '');
    
    if (userGpsIds.length === 0) {
      return res.status(200).json({ data: [] });
    }
    
    // 3. Fetch vehicle data with filter and limit
    const gpsFilter = userGpsIds.join(',');
    const vehicleDataUrl = `${API_BASE_URL}/items/vehicle_datas?filter[gps_id][_in]=${gpsFilter}&sort=-timestamp&limit=${limit}`;
    
    console.log('Fetching filtered vehicle data with limit:', limit);
    
    const response = await fetch(vehicleDataUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicle_datas: ${response.status}`);
    }

    const data = await response.json();
    console.log('Vehicle data received:', data.data?.length || 0, 'records');
    
    // Get latest data for each GPS ID
    const latestDataMap = new Map();
    (data.data || []).forEach((record: any) => {
      const existing = latestDataMap.get(record.gps_id);
      if (!existing || new Date(record.timestamp) > new Date(existing.timestamp)) {
        latestDataMap.set(record.gps_id, record);
      }
    });
    
    const latestData = Array.from(latestDataMap.values());
    
    return res.status(200).json({
      data: latestData,
      meta: {
        total_count: latestData.length,
        filter_count: data.data?.length || 0
      }
    });
    
  } catch (error: any) {
    console.error('Vehicle Data API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch vehicle data',
      message: error.message
    });
  }
}