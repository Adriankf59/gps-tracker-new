// app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Simple OTP validation (for demo purposes)
    // In production, you would:
    // 1. Check OTP from database or cache
    // 2. Verify expiration time
    // 3. Check if OTP is already used
    
    if (otp.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid OTP format' },
        { status: 400 }
      );
    }

    // For demo purposes, accept any 6-digit OTP
    // In production, implement proper OTP verification
    
    // Fetch user data
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users');
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    const users = data.data || [];
    
    // Find user with matching email
    const user = users.find((u: any) => u.email === email);
    
    if (user) {
      // Don't send password hash back to client
      const { password_hash, ...userWithoutPassword } = user;
      
      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        user: userWithoutPassword
      });
    } else {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('OTP Verification API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}