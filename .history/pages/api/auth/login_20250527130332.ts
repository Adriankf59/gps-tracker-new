// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface LoginRequest {
  email: string;
  password: string;
}

interface User {
  user_id: string;
  username: string | null;
  password_hash: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  user?: Omit<User, 'password_hash'>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  console.log('Login API called with method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password }: LoginRequest = req.body;
    console.log('Login attempt for email:', email);

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Fetch users from external API
    console.log('Fetching users from external API...');
    const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users');
    
    console.log('External API response status:', response.status);
    
    if (!response.ok) {
      console.error('External API failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    console.log('Users data received, count:', data.data?.length || 0);
    
    const users: User[] = data.data || [];
    
    // Find user with matching email and password
    const user = users.find(
      (u: User) => u.email === email && u.password_hash === password
    );
    
    console.log('User search result:', user ? 'Found' : 'Not found');
    
    if (user) {
      console.log('Login successful for user:', user.username || user.full_name);
      
      // Don't send password hash back to client
      const { password_hash, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: userWithoutPassword
      });
    } else {
      console.log('Invalid credentials for email:', email);
      
      // Log available emails for debugging (remove in production)
      const availableEmails = users.filter(u => u.email).map(u => u.email);
      console.log('Available emails:', availableEmails);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
  } catch (error) {
    console.error('Login API Error:', error);
    return res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
}