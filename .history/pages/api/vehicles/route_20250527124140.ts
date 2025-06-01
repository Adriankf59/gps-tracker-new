// app/api/vehicles/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicles');
    
    if (!response.ok) {
      throw new Error('Failed to fetch vehicles');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Vehicles API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}

// app/api/vehicle-data/route.ts
export async function GET() {
  try {
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/vehicle_data');
    
    if (!response.ok) {
      throw new Error('Failed to fetch vehicle data');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Vehicle Data API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle data' },
      { status: 500 }
    );
  }
}