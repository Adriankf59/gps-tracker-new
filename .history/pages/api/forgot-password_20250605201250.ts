import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiting untuk forgot password attempts
const checkForgotPasswordRateLimit = async (ip: string): Promise<{ allowed: boolean; remaining: number }> => {
  const maxAttempts = 5; // 5 attempts per hour
  
  const key = `forgot_password_limit:${ip}`;
  const windowMs = 60 * 60; // 1 hour in seconds
  
  try {
    const current = await redis.get(key);
    
    if (!current) {
      await redis.setex(key, windowMs, 1);
      return { allowed: true, remaining: maxAttempts - 1 };
    }
    
    const attempts = parseInt(current as string);
    if (attempts >= maxAttempts) {
      return { allowed: false, remaining: 0 };
    }
    
    await redis.incr(key);
    return { allowed: true, remaining: maxAttempts - attempts - 1 };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    return { allowed: true, remaining: maxAttempts - 1 };
  }
};

// Generate OTP (sesuai dengan format yang sudah ada)
const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store OTP in Redis (menggunakan format key yang sama)
const storeOTP = async (userId: string, email: string, otp: string): Promise<boolean> => {
  try {
    const otpKey = `otp:${userId}:${email}`;
    console.log('🔑 Storing OTP with key:', otpKey);
    
    // Store OTP with 10 minutes expiration for forgot password
    const result = await redis.setex(otpKey, 600, otp);
    console.log('💾 Redis storage result:', result);
    return true;
  } catch (error) {
    console.error('Redis OTP storage error:', error);
    return false;
  }
};

// Verify OTP (menggunakan format key yang sama)
const verifyOTP = async (userId: string, email: string, inputOtp: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const otpKey = `otp:${userId}:${email}`;
    console.log('🔍 Verifying OTP with key:', otpKey);
    
    const storedOtp = await redis.get(otpKey);
    console.log('💾 Stored OTP:', storedOtp);
    console.log('📝 Submitted OTP:', inputOtp);

    if (!storedOtp) {
      return { valid: false, error: 'OTP sudah expired atau tidak ditemukan' };
    }

    // Normalize both values (sesuai dengan verifyOTP.ts yang ada)
    const normalizedStored = String(storedOtp).trim();
    const normalizedSubmitted = String(inputOtp).trim();
    
    console.log('🔄 Normalized comparison:');
    console.log('  Stored:', `"${normalizedStored}" (length: ${normalizedStored.length})`);
    console.log('  Submitted:', `"${normalizedSubmitted}" (length: ${normalizedSubmitted.length})`);

    if (normalizedStored !== normalizedSubmitted) {
      return { valid: false, error: 'Kode OTP tidak valid' };
    }

    // OTP is valid, remove it from Redis
    await redis.del(otpKey);
    console.log('✅ OTP verified and deleted successfully');
    
    return { valid: true };
  } catch (error) {
    console.error('Redis OTP verification error:', error);
    return { valid: false, error: 'Gagal memverifikasi OTP' };
  }
};

// Send OTP Email (menggunakan nodemailer seperti generateOTP.ts yang ada)
const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  // Check environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ Email credentials missing");
    return false;
  }

  try {
    console.log("📬 Configuring email transporter for forgot password...");
    
    // Configure Nodemailer (sama dengan generateOTP.ts)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log("✅ Email transporter verified successfully");

    // Email template untuk forgot password
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">GPS Tracker Pro</h1>
          <p style="color: white; margin: 10px 0 0 0;">Vehicle Management System</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Reset Password - Kode OTP</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            Halo,<br><br>
            Anda telah meminta untuk mereset password akun GPS Tracker Anda. 
            Gunakan kode OTP berikut untuk melanjutkan proses reset password:
          </p>
          
          <div style="background: white; border: 2px dashed #dc2626; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #dc2626; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            <strong>Penting:</strong>
          </p>
          <ul style="color: #666; font-size: 14px;">
            <li>Kode ini akan expired dalam <strong>10 menit</strong></li>
            <li>Jangan bagikan kode ini kepada siapapun</li>
            <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
            <li>Setelah reset, gunakan password baru untuk login</li>
          </ul>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>Keamanan:</strong> Pastikan Anda berada di halaman resmi GPS Tracker saat memasukkan kode OTP ini.
            </p>
          </div>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 GPS Tracker Pro. All rights reserved.</p>
        </div>
      </div>
    `;

    console.log("📧 Sending forgot password email...");

    // Send OTP email
    const emailResult = await transporter.sendMail({
      from: `GPS Tracker Pro <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password - Kode Verifikasi OTP",
      html: emailHtml,
      text: `Kode OTP untuk reset password Anda adalah: ${otp}. Kode ini akan expired dalam 10 menit. Jika Anda tidak meminta reset password, abaikan email ini.`,
    });

    console.log("✅ Forgot password email sent successfully:", emailResult.messageId);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// Helper functions
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

const isValidPassword = (password: string): boolean => {
  // At least 6 characters, contains letter and number
  return password.length >= 6 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
};

interface ForgotPasswordRequestBody {
  email: string;
  step: 'send_otp' | 'reset_password';
  otp?: string;
  password?: string;
}

interface ApiResponse {
  message: string;
  success?: boolean;
  error?: string;
  step?: string;
  messageId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  console.log('🚀 Forgot Password API called');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      message: 'Method not allowed',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Get client IP
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress ||
                   'unknown';

  // Check rate limiting
  const rateLimitResult = await checkForgotPasswordRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      message: 'Terlalu banyak percobaan reset password. Coba lagi dalam 1 jam.',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }

  try {
    const { email, step, otp, password }: ForgotPasswordRequestBody = req.body;
    console.log('📨 Request data:', { email, step, otp: otp ? '***' : undefined });

    // Validate required fields
    if (!email || !step) {
      return res.status(400).json({
        message: 'Email dan step wajib diisi',
        error: 'VALIDATION_ERROR'
      });
    }

    // Sanitize input
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    // Validate email format
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({
        message: 'Format email tidak valid',
        error: 'INVALID_EMAIL'
      });
    }

    // Get Directus URL
    const directusUrl = process.env.API_URL;
    
    if (!directusUrl) {
      return res.status(500).json({
        message: 'Server configuration error',
        error: 'MISSING_CONFIG'
      });
    }

    // Fetch users from Directus to check if email exists
    console.log('🔍 Fetching users from Directus...');
    const response = await fetch(`${directusUrl}/items/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    const users = data.data || [];

    console.log('📊 Users fetched:', users.length);

    // Find user with matching email
    const user = users.find((u: any) => u.email === sanitizedEmail);

    if (!user) {
      // For security, don't reveal if email exists or not
      console.log('❌ Email not found, but returning success for security');
      return res.status(200).json({
        message: 'Jika email terdaftar, kode OTP akan dikirim.',
        success: true,
        step: 'otp_sent'
      });
    }

    console.log('✅ User found:', { 
      users_id: user.users_id, 
      email: user.email, 
      name: user.name 
    });

    // Handle different steps
    if (step === 'send_otp') {
      // Generate and send OTP
      const otpCode = generateOTP();
      console.log('🔢 Generated OTP for forgot password:', otpCode);
      
      // Store OTP in Redis (menggunakan format yang sama dengan generateOTP.ts)
      const stored = await storeOTP(user.users_id, sanitizedEmail, otpCode);
      
      if (!stored) {
        return res.status(500).json({
          message: 'Gagal menyimpan OTP. Silakan coba lagi.',
          error: 'OTP_STORAGE_FAILED'
        });
      }
      
      // Send OTP via email
      const emailSent = await sendOTPEmail(sanitizedEmail, otpCode);
      
      if (!emailSent) {
        return res.status(500).json({
          message: 'Gagal mengirim email OTP. Silakan coba lagi.',
          error: 'EMAIL_SEND_FAILED'
        });
      }
      
      console.log('🔐 Forgot password OTP sent successfully:', {
        email: sanitizedEmail,
        userId: user.users_id,
        timestamp: new Date().toISOString()
      });
      
      return res.status(200).json({
        message: 'Kode OTP telah dikirim ke email Anda',
        success: true,
        step: 'otp_sent'
      });
      
    } else if (step === 'reset_password') {
      // Validate OTP and reset password
      if (!otp || !password) {
        return res.status(400).json({
          message: 'OTP dan password baru wajib diisi',
          error: 'VALIDATION_ERROR'
        });
      }
      
      // Validate password strength
      if (!isValidPassword(password)) {
        return res.status(400).json({
          message: 'Password minimal 6 karakter dan mengandung huruf serta angka',
          error: 'WEAK_PASSWORD'
        });
      }
      
      // Verify OTP (menggunakan format yang sama dengan verifyOTP.ts)
      const otpVerification = await verifyOTP(user.users_id, sanitizedEmail, otp);
      
      if (!otpVerification.valid) {
        return res.status(400).json({
          message: otpVerification.error || 'Kode OTP tidak valid atau sudah kedaluwarsa',
          error: 'INVALID_OTP'
        });
      }
      
      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      console.log('🔒 Password hashed successfully');
      
      // Update password in Directus
      try {
        console.log('📝 Updating password in Directus...');
        const updateResponse = await fetch(`${directusUrl}/items/users/${user.users_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password_hash: hashedPassword,
            updated_at: new Date().toISOString()
          })
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('❌ Directus update failed:', errorText);
          throw new Error(`Failed to update password: ${updateResponse.status}`);
        }
        
        console.log('✅ Password reset successful:', {
          user_id: user.users_id,
          email: sanitizedEmail,
          timestamp: new Date().toISOString()
        });
        
        return res.status(200).json({
          message: 'Password berhasil direset',
          success: true,
          step: 'password_reset'
        });
        
      } catch (updateError) {
        console.error('Password update error:', updateError);
        return res.status(500).json({
          message: 'Gagal memperbarui password. Silakan coba lagi.',
          error: 'PASSWORD_UPDATE_FAILED'
        });
      }
      
    } else {
      return res.status(400).json({
        message: 'Step tidak valid',
        error: 'INVALID_STEP'
      });
    }

  } catch (error) {
    console.error('❌ Forgot password API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip: clientIP
    });

    if (error instanceof Error) {
      if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
        return res.status(503).json({
          message: 'Tidak dapat terhubung ke server. Pastikan koneksi internet Anda stabil.',
          error: 'CONNECTION_FAILED'
        });
      }
      
      if (error.message.includes('timeout')) {
        return res.status(408).json({
          message: 'Request timeout. Silakan coba lagi.',
          error: 'REQUEST_TIMEOUT'
        });
      }
    }

    return res.status(500).json({
      message: 'Terjadi kesalahan server. Silakan coba lagi nanti.',
      error: 'INTERNAL_ERROR'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};