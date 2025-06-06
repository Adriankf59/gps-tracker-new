// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { API_BASE_URL } = await import('../../../api/file');
    const response = await fetch(`${API_BASE_URL}/items/users`);
    
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