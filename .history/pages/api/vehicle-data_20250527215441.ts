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
    console.log('Fetching vehicle data from external API...');
    
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_data?limi', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('External vehicle data API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicle data API error:', errorText);
      throw new Error(`Failed to fetch vehicle data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Vehicle data received:', data.data?.length || 0, 'records');
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Vehicle Data API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch vehicle data',
      message: error.message
    });
  }
}