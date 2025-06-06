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
    const { user_id, gps_ids } = req.query;
    console.log('Fetching vehicle data for', { user_id, gps_ids });

    if (!user_id && !gps_ids) {
      const qs = new URLSearchParams(req.query as any).toString();
      const url = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?${qs}`;
      const proxyResp = await fetch(url);
      const text = await proxyResp.text();
      return res.status(proxyResp.status).send(text);
    }

    // 1. First, get the user's vehicles to get their gps_ids
    console.log('Getting vehicles for user:', user_id);
    let targetGpsIds: string[] = [];

    if (gps_ids) {
      targetGpsIds = String(gps_ids)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
    } else if (user_id) {
      const vehiclesUrl = `http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle?filter[user_id][_eq]=${user_id}`;

      const vehiclesResponse = await fetch(vehiclesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!vehiclesResponse.ok) {
        const errorText = await vehiclesResponse.text();
        console.error('External vehicles API error:', errorText);
        throw new Error(`Failed to fetch user vehicles: ${vehiclesResponse.status}`);
      }

      const vehiclesData = await vehiclesResponse.json();
      const userVehicles = vehiclesData.data || [];

      console.log(`Found ${userVehicles.length} vehicles for user ${user_id}`);

      if (userVehicles.length === 0) {
        return res.status(200).json({ data: [] });
      }

      targetGpsIds = userVehicles
        .map((vehicle: any) => vehicle.gps_id)
        .filter((gpsId: any) => gpsId !== null && gpsId !== undefined && gpsId !== '');

      console.log('User GPS IDs:', targetGpsIds);
    }

    if (targetGpsIds.length === 0) {
      console.log('No GPS IDs specified');
      return res.status(200).json({ data: [] });
    }
    
    // 3. Fetch all vehicle_datas with the exact endpoint specified
    const vehicleDataUrl = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_datas?limit=-1';
    
    const response = await fetch(vehicleDataUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('External vehicle_datas API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicle_datas API error:', errorText);
      throw new Error(`Failed to fetch vehicle_datas: ${response.status} ${response.statusText}`);
    }

    const allData = await response.json();
    const allRecords = allData.data || [];
    console.log('All vehicle_datas received:', allRecords.length, 'records');
    
    // 4. Filter records that match the requested GPS IDs
    const filteredData = allRecords.filter((record: any) => {
      return targetGpsIds.includes(record.gps_id);
    });
    
    console.log('Filtered vehicle_datas for selected vehicles:', filteredData.length, 'records');
    
    // 5. Return data in the same format as the external API
    return res.status(200).json({
      data: filteredData
    });
  } catch (error: any) {
    console.error('Vehicle Data API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch vehicle data',
      message: error.message
    });
  }
}