// pages/api/vehicles.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Fetching vehicles data...');
    
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicles');
    
    if (!response.ok) {
      throw new Error('Failed to fetch vehicles');
    }

    const data = await response.json();
    console.log('Vehicles data received:', data.data?.length || 0, 'vehicles');
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Vehicles API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch vehicles'
    });
  }
}