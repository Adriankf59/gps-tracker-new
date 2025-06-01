// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users');
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Users API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}