// pages/api/vehicles.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Vehicles API called with method:', req.method);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id } = req.query;
    console.log('Fetching vehicles data for user_id:', user_id);
    
    let url = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';
    
    // Add filter if user_id is provided
    if (user_id) {
      url += `?filter[user_id][_eq]=${user_id}`;
    }
    
    console.log('Fetching from URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('External vehicles API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicles API error:', errorText);
      throw new Error(`Failed to fetch vehicles: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Vehicles data received:', data.data?.length || 0, 'vehicles');
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Vehicles API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch vehicles',
      message: error.message
    });
  }
}
