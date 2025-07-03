import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
  otp?: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  otpRequired?: boolean;
  user?: any;
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, password, deviceId, otp }: LoginRequest = req.body;

  if (!email || !password || !deviceId) {
    return res.status(400).json({ success: false, message: 'Email, password, and deviceId are required' });
  }

  const directusUrl = process.env.API_URL;
  if (!directusUrl) {
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  try {
    const userRes = await fetch(`${directusUrl}/items/users?filter[email][_eq]=${encodeURIComponent(email)}`);
    if (!userRes.ok) {
      throw new Error('Failed to fetch user');
    }
    const userData = await userRes.json();
    const user = userData.data?.[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const recognizedKey = `recognized_devices:${user.users_id}`;
    const deviceRecognized = await redis.sismember(recognizedKey, deviceId);

    if (deviceRecognized) {
      return res.status(200).json({ success: true, message: 'Login successful', user });
    }

    const otpKey = `login_otp:${user.users_id}:${deviceId}`;
    if (otp) {
      const storedOtp = await redis.get(otpKey);
      if (storedOtp && String(storedOtp).trim() === String(otp).trim()) {
        await redis.del(otpKey);
        await redis.sadd(recognizedKey, deviceId);
        return res.status(200).json({ success: true, message: 'OTP verified, login successful', user });
      } else {
        return res.status(400).json({ success: false, message: 'Invalid OTP', otpRequired: true });
      }
    } else {
      const code = generateOTP();
      await redis.setex(otpKey, 600, code);

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
        await transporter.sendMail({
          from: `GPS Tracker <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: 'Kode OTP Login',
          text: `Kode OTP Anda adalah ${code}`,
        });
      }

      return res.status(200).json({ success: false, message: 'OTP sent to email', otpRequired: true });
    }
  } catch (error: any) {
    console.error('Device login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

