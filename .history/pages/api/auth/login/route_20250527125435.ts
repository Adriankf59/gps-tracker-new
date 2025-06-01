// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Login API called');
  
  try {
    const body = await request.json();
    console.log('Request body received');
    
    const { email, password } = body;

    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('Attempting login for email:', email);
    
    // Fetch users from external API
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('External API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error:', errorText);
      throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Users data received, count:', data.data?.length || 0);
    
    const users = data.data || [];
    
    // Find user with matching email and password
    // Note: password_hash in your API is actually plain text password
    const user = users.find(
      (u: any) => u.email === email && u.password_hash === password
    );
    
    console.log('User search result:', user ? 'Found' : 'Not found');
    
    if (user) {
      console.log('Login successful for user:', user.username || user.full_name);
      
      // Don't send password hash back to client
      const { password_hash, ...userWithoutPassword } = user;
      
      return NextResponse.json({
        success: true,
        message: 'Login successful',
        user: userWithoutPassword
      });
    } else {
      console.log('Invalid credentials for email:', email);
      
      // Log available emails for debugging (remove in production)
      const availableEmails = users.filter(u => u.email).map(u => u.email);
      console.log('Available emails:', availableEmails);
      
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}