// pages/api/auth/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface OTPRequest {
  email: string;
  otp: string;
}

interface User {
  user_id: string;
  username: string | null;
  password_hash: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
}

interface OTPResponse {
  success: boolean;
  message?: string;
  user?: Omit<User, 'password_hash'>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OTPResponse>
) {
  console.log('OTP Verification API called with method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, otp }: OTPRequest = req.body;
    console.log('OTP verification for email:', email);
    console.log('OTP received:', otp);

    if (!email || !otp) {
      console.log('Missing email or OTP');
      return res.status(400).json({ 
        success: false, 
        error: 'Email and OTP are required' 
      });
    }

    // Simple OTP validation (for demo purposes)
    if (otp.length !== 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid OTP format' 
      });
    }

    // For demo purposes, accept any 6-digit OTP
    // In production, implement proper OTP verification
    
    // Fetch user data
    console.log('Fetching user data...');
    const { API_BASE_URL } = await import('../../../api/file');
    const response = await fetch(`${API_BASE_URL}/items/users`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    const users: User[] = data.data || [];
    
    // Find user with matching email
    const user = users.find((u: User) => u.email === email);
    
    if (user) {
      console.log('OTP verification successful for user:', user.username || user.full_name);
      
      // Don't send password hash back to client
      const { password_hash, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        user: userWithoutPassword
      });
    } else {
      console.log('User not found for email:', email);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error: any) {
    console.error('OTP Verification API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}