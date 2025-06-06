// pages/api/vehicles/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { DIRECTUS_BASE_URL } from '../config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  
  console.log(`Vehicle API called for ID ${id} with method:`, req.method);
  
  if (req.method === 'DELETE') {
    return handleDeleteVehicle(req, res);
  } else if (req.method === 'GET') {
    return handleGetVehicle(req, res);
  } else if (req.method === 'PUT' || req.method === 'PATCH') {
    return handleUpdateVehicle(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle DELETE requests
async function handleDeleteVehicle(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  try {
    console.log('Deleting vehicle with ID:', id);
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }
    
    // Delete vehicle via external API
    const response = await fetch(
      `${DIRECTUS_BASE_URL}/items/vehicle/${id}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('External vehicle deletion API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicle deletion API error:', errorText);
      
      let errorMessage = `Failed to delete vehicle: ${response.status}`;
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

    // Check if response has content
    let result = null;
    const responseText = await response.text();
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: 'Vehicle deleted successfully' };
      }
    } else {
      result = { message: 'Vehicle deleted successfully' };
    }
    
    console.log('Vehicle deleted successfully:', result);
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vehicle deletion API Error:', error);
    return res.status(500).json({
      error: 'Failed to delete vehicle',
      message: error.message
    });
  }
}

// Handle GET requests (get single vehicle)
async function handleGetVehicle(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  try {
    console.log('Fetching vehicle with ID:', id);
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }
    
    const response = await fetch(
      `${DIRECTUS_BASE_URL}/items/vehicle/${id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicle API error:', errorText);
      throw new Error(`Failed to fetch vehicle: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Vehicle data received:', data);
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Vehicle API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch vehicle',
      message: error.message
    });
  }
}

// Handle PUT/PATCH requests (update vehicle)
async function handleUpdateVehicle(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  try {
    const vehicleData = req.body;
    console.log('Updating vehicle with ID:', id, 'Data:', vehicleData);
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }
    
    // Update vehicle via external API
    const response = await fetch(
      `${DIRECTUS_BASE_URL}/items/vehicle/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(vehicleData)
      }
    );
    
    console.log('External vehicle update API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External vehicle update API error:', errorText);
      
      let errorMessage = `Failed to update vehicle: ${response.status}`;
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
    console.log('Vehicle updated successfully:', result);
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vehicle update API Error:', error);
    return res.status(500).json({
      error: 'Failed to update vehicle',
      message: error.message
    });
  }
}