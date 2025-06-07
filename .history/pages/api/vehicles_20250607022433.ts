// pages/api/vehicles.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🚗 Vehicles API called with method:', req.method);
  console.log('🔍 Query params:', req.query);
  
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
    const { user_id, limit } = req.query;
    console.log('📊 Fetching vehicles data for user_id:', user_id);
    
    // Validate user_id
    if (!user_id) {
      console.log('⚠️ No user_id provided');
      return res.status(400).json({ 
        error: 'user_id parameter is required',
        message: 'Please provide a valid user_id to fetch vehicles'
      });
    }
    
    // Construct URL with proper filtering
    let url = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle';
    const params = new URLSearchParams();
    
    // Add user filter
    params.append('filter[user_id][_eq]', String(user_id));
    
    // Add limit if specified
    if (limit) {
      params.append('limit', String(limit));
    }
    
    // Add sorting to get most recent first
    params.append('sort', '-created_at');
    
    const fullUrl = `${url}?${params.toString()}`;
    console.log('🌐 Fetching from URL:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    console.log('📡 External vehicles API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ External vehicles API error:', errorText);
      
      // Try to parse error for more details
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorJson.error || errorText;
      } catch (e) {
        // Keep original error text
      }
      
      return res.status(response.status).json({
        error: 'Failed to fetch vehicles from external API',
        message: errorDetails,
        status: response.status
      });
    }

    const data = await response.json();
    const vehicles = data.data || [];
    
    console.log('✅ Vehicles data received:', vehicles.length, 'vehicles');
    
    // Enhanced logging for debugging
    if (vehicles.length > 0) {
      console.log('📋 First vehicle structure:');
      const firstVehicle = vehicles[0];
      console.log('   - vehicle_id:', firstVehicle.vehicle_id);
      console.log('   - user_id:', firstVehicle.user_id);
      console.log('   - gps_id:', firstVehicle.gps_id);
      console.log('   - name:', firstVehicle.name);
      console.log('   - license_plate:', firstVehicle.license_plate);
      
      // Check for vehicles with missing GPS IDs
      const vehiclesWithoutGPS = vehicles.filter((v: any) => !v.gps_id || v.gps_id.trim() === '');
      if (vehiclesWithoutGPS.length > 0) {
        console.log('⚠️ Vehicles without GPS ID:', vehiclesWithoutGPS.length);
        vehiclesWithoutGPS.forEach((v: any) => {
          console.log(`   - ${v.name} (${v.license_plate}) has no GPS ID`);
        });
      }
      
      // List all GPS IDs
      const gpsIds = vehicles.map((v: any) => v.gps_id).filter(Boolean);
      console.log('🔑 Available GPS IDs:', gpsIds);
    } else {
      console.log('⚠️ No vehicles found for user_id:', user_id);
    }
    
    // Return data with success flag for easier debugging
    return res.status(200).json({
      success: true,
      data: vehicles,
      count: vehicles.length,
      user_id: user_id
    });
    
  } catch (error: any) {
    console.error('💥 Vehicles API Error:', error);
    
    // Enhanced error response
    let errorMessage = 'Failed to fetch vehicles';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - external API took too long to respond';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message.includes('fetch failed')) {
      errorMessage = 'Failed to connect to external API';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'External API server not found';
      errorCode = 'DNS_ERROR';
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      error_code: errorCode,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Handle POST requests (create new vehicle)
async function handleCreateVehicle(req: NextApiRequest, res: NextApiResponse) {
  try {
    const vehicleData = req.body;
    console.log('🚗 Creating new vehicle:', vehicleData);
    
    // Validate required fields
    const requiredFields = ['user_id', 'name', 'license_plate', 'make', 'model', 'year', 'sim_card_number'];
    const missingFields = requiredFields.filter(field => !vehicleData[field]);
    
    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        fields: missingFields,
        required_fields: requiredFields
      });
    }
    
    // Add timestamps
    const vehicleDataWithTimestamps = {
      ...vehicleData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Create vehicle via external API
    const response = await fetch(
      'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(vehicleDataWithTimestamps),
        signal: AbortSignal.timeout(15000) // 15 second timeout for creation
      }
    );
    
    console.log('📡 External vehicle creation API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ External vehicle creation API error:', errorText);
      
      let errorMessage = `Failed to create vehicle: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Keep default error message
      }
      
      return res.status(response.status).json({
        success: false,
        error: errorMessage,
        details: errorText,
        status: response.status
      });
    }

    const result = await response.json();
    console.log('✅ Vehicle created successfully:', result);
    
    return res.status(201).json({
      success: true,
      data: result.data || result,
      message: 'Vehicle created successfully'
    });
    
  } catch (error: any) {
    console.error('💥 Vehicle creation API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create vehicle',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}