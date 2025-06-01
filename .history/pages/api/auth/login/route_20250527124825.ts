// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Fetch users from external API
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users');
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    const users = data.data || [];
    
    // Find user with matching email and password
    const user = users.find(
      (u: any) => u.email === email && u.password_hash === password
    );
    
    if (user) {
      // Don't send password hash back to client
      const { password_hash, ...userWithoutPassword } = user;
      
      return NextResponse.json({
        success: true,
        message: 'Login successful',
        user: userWithoutPassword
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}