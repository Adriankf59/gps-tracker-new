// pages/api/vehicles.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Vehicles API called with method:', req.method);
  
  if (req.method === 'GET') {
    return handleGetVehicles(req, res);
  } else if (req.method === 'POST') {
    return handleCreateVehicle(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle GET requests
async function handleGetVehicles(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user_id } = req.query;
    console.log('Fetching vehicles data for user_id:', user_id);
    
    const { API_BASE_URL } = await import('../../api/file');
    let url = `${API_BASE_URL}/items/vehicle`;
    
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

// Handle POST requests (create new vehicle)
async function handleCreateVehicle(req: NextApiRequest, res: NextApiResponse) {
  try {
    const vehicleData = req.body;
    console.log('Creating new vehicle:', vehicleData);
    
    // Validate required fields
    const requiredFields = ['user_id', 'name', 'license_plate', 'make', 'model', 'year', 'sim_card_number'];
    const missingFields = requiredFields.filter(field => !vehicleData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missingFields
      });
    }
    
    // Create vehicle via external API
    const { API_BASE_URL } = await import('../../api/file');
    const response = await fetch(
      `${API_BASE_URL}/items/vehicle`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(vehicleData)
      }
    );
    
    console.log('External vehicle creation API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicle creation API error:', errorText);
      
      let errorMessage = `Failed to create vehicle: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Keep default error message
      }
      
      return res.status(response.status).json({
        error: errorMessage,
        details: errorText
      });
    }

    const result = await response.json();
    console.log('Vehicle created successfully:', result);
    
    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Vehicle creation API Error:', error);
    return res.status(500).json({
      error: 'Failed to create vehicle',
      message: error.message
    });
  }
}