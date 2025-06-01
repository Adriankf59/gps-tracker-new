import { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, otp, userId } = req.body;

  if (!email || !otp || !userId) {
    return res.status(400).json({ 
      success: false,
      message: 'Email, OTP, and userId are required' 
    });
  }

  try {
    // Create OTP key that matches generation
    const otpKey = `otp:${userId}:${email}`;
    
    // Get stored OTP from Redis
    const storedOtp = await redis.get(otpKey);

    if (!storedOtp) {
      return res.status(400).json({ 
        success: false,
        message: 'Kode OTP sudah expired atau tidak ditemukan' 
      });
    }

    if (storedOtp !== otp.toString()) {
      return res.status(400).json({ 
        success: false,
        message: 'Kode OTP tidak valid' 
      });
    }

    // OTP is valid, remove it from Redis
    await redis.del(otpKey);

    return res.status(200).json({ 
      success: true,
      message: 'OTP berhasil diverifikasi' 
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Gagal memverifikasi OTP. Silakan coba lagi.' 
    });
  }
}