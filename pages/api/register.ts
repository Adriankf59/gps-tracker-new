import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';

// Import Redis dan Nodemailer dengan proper error handling
let Redis: any;
let redis: any;
let nodemailer: any;
let emailTransporter: any;

try {
  Redis = require('@upstash/redis').Redis;
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
} catch (error) {
  console.warn('Redis not available:', error);
  redis = null;
}

try {
  nodemailer = require('nodemailer');
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
} catch (error) {
  console.warn('Nodemailer not available:', error);
  emailTransporter = null;
}

// Rate limiting dengan Redis (dengan fallback)
const checkRateLimit = async (ip: string): Promise<{ allowed: boolean; remaining: number }> => {
  const maxAttempts = 5;
  
  if (!redis) {
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  const key = `register_limit:${ip}`;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  try {
    const current = await redis.get(key);
    
    if (!current) {
      await redis.setex(key, Math.ceil(windowMs / 1000), 1);
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

// Function untuk mengirim welcome email
const sendWelcomeEmail = async (email: string, fullName: string, username: string): Promise<boolean> => {
  if (!emailTransporter) {
    console.warn('Email transporter not available');
    return false;
  }
  
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🎉 Selamat Datang di GPS Tracker Pro!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">GPS Tracker Pro</h1>
            <p style="color: #bfdbfe; margin: 10px 0 0 0;">Vehicle Management System</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <h2 style="color: #1e293b; margin-top: 0;">Halo ${fullName}! 👋</h2>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
              Selamat datang di GPS Tracker Pro! Akun Anda telah berhasil dibuat dengan detail berikut:
            </p>
            
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #334155;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 8px 0 0 0; color: #334155;"><strong>Email:</strong> ${email}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" 
                 style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block; 
                        font-weight: bold;">
                🚀 Mulai Tracking Sekarang
              </a>
            </div>
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
};

// Helper functions untuk validasi
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^08\d{8,11}$/;
  const cleanPhone = phone.replace(/\D/g, '');
  return phoneRegex.test(cleanPhone);
};

const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

interface RegisterRequestBody {
  user_id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string;
  phone_number: string;
  marketing_consent?: boolean;
}

interface ApiResponse {
  message: string;
  error?: string;
  user_id?: string;
  details?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
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

  // Get client IP untuk rate limiting
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress ||
                   'unknown';

  // Check rate limiting
  const rateLimitResult = await checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      message: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 15 menit.',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }

  try {
    const {
      user_id,
      username,
      password_hash,
      full_name,
      email,
      phone_number,
      marketing_consent = false
    }: RegisterRequestBody = req.body;

    // Validasi field wajib
    const requiredFields = {
      user_id: 'User ID',
      username: 'Username',
      password_hash: 'Password',
      full_name: 'Nama lengkap',
      email: 'Email',
      phone_number: 'Nomor telepon'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!req.body[field]) {
        return res.status(400).json({
          message: `${label} wajib diisi`,
          error: 'VALIDATION_ERROR'
        });
      }
    }

    // Sanitasi input
    const sanitizedData = {
      user_id: sanitizeInput(user_id),
      username: sanitizeInput(username),
      full_name: sanitizeInput(full_name),
      email: sanitizeInput(email).toLowerCase(),
      phone_number: phone_number.replace(/\D/g, ''),
      password_hash: password_hash
    };

    // Validasi format data
    if (!isValidEmail(sanitizedData.email)) {
      return res.status(400).json({
        message: 'Format email tidak valid',
        error: 'INVALID_EMAIL'
      });
    }

    if (!isValidPassword(password_hash)) {
      return res.status(400).json({
        message: 'Password harus minimal 8 karakter dengan kombinasi huruf besar, kecil, angka, dan karakter khusus',
        error: 'INVALID_PASSWORD'
      });
    }

    if (!isValidPhoneNumber(sanitizedData.phone_number)) {
      return res.status(400).json({
        message: 'Nomor telepon harus dalam format 08xxxxxxxxxx',
        error: 'INVALID_PHONE'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password_hash, saltRounds);

    // Format data sesuai dengan Directus API standard (tanpa wrapper "data")
    const userData = {
      users_id: sanitizedData.user_id,
      name: sanitizedData.full_name,
      nickname: sanitizedData.username,
      email: sanitizedData.email,
      phone_number: sanitizedData.phone_number,
      password_hash: hashedPassword
    };

    // Test connection ke endpoint users
    const apiUrl = process.env.API_URL;
    
    if (!apiUrl) {
      return res.status(500).json({
        message: 'Server configuration error',
        error: 'MISSING_CONFIG'
      });
    }

    // Debug logging - always log in development
    console.log('Registration attempt:', {
      endpoint: `${apiUrl}/items/users`,
      userData: {
        users_id: sanitizedData.user_id,
        name: sanitizedData.full_name,
        nickname: sanitizedData.username,
        email: sanitizedData.email,
        phone_number: sanitizedData.phone_number,
        password_hash: '[HASHED]'
      }
    });

    // Debug logging
    if (process.env.DEBUG_API === 'true') {
      console.log('Sending to endpoint:', `${apiUrl}/items/users`);
      console.log('Request data:', userData);
    }

    try {
      // Test basic connectivity
      const testResponse = await fetch(`${apiUrl}/server/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!testResponse.ok) {
        console.warn('Health check failed, continuing with registration...');
      }
    } catch (connectError) {
      console.warn('Health check failed:', connectError);
      // Continue with registration attempt even if health check fails
    }

    // Kirim data ke endpoint users
    const response = await fetch(`${apiUrl}/items/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      signal: AbortSignal.timeout(15000)
    });

    const result = await response.json();
    
    // Debug: log response
    console.log('API Response:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok) {
      // Log successful registration
      console.log('User registered successfully:', {
        user_id: sanitizedData.user_id,
        username: sanitizedData.username,
        email: sanitizedData.email,
        timestamp: new Date().toISOString()
      });

      // Kirim welcome email (non-blocking)
      if (emailTransporter) {
        sendWelcomeEmail(sanitizedData.email, sanitizedData.full_name, sanitizedData.username)
          .then((emailSent) => {
            if (process.env.DEBUG_API === 'true') {
              console.log('Welcome email sent:', emailSent);
            }
          })
          .catch((emailError) => {
            console.error('Welcome email failed:', emailError);
          });
      }

      // Store session in Redis (non-blocking)
      if (redis) {
        try {
          await redis.setex(
            `user_session:${sanitizedData.user_id}`, 
            86400,
            JSON.stringify({
              user_id: sanitizedData.user_id,
              username: sanitizedData.username,
              email: sanitizedData.email,
              registered_at: new Date().toISOString()
            })
          );
        } catch (redisError) {
          console.error('Redis session storage failed:', redisError);
        }
      }

      return res.status(201).json({
        message: 'Registrasi berhasil! Silakan login untuk melanjutkan.',
        user_id: sanitizedData.user_id
      });

    } else {
      // Handle API errors
      console.error('API registration error:', {
        status: response.status,
        error: result,
        sentData: userData,
        timestamp: new Date().toISOString()
      });

      // Check for specific Directus error patterns
      if (result.errors && Array.isArray(result.errors)) {
        const error = result.errors[0];
        if (error.extensions?.code === 'RECORD_NOT_UNIQUE') {
          const field = error.extensions.field;
          let message = 'Data sudah terdaftar';
          
          if (field === 'email') {
            message = 'Email sudah terdaftar. Silakan gunakan email lain atau login.';
          } else if (field === 'nickname' || field === 'username') {
            message = 'Username sudah digunakan. Silakan pilih username lain.';
          }

          return res.status(409).json({
            message,
            error: 'DUPLICATE_ENTRY'
          });
        }
        
        // Return detailed error message from Directus
        return res.status(400).json({
          message: error.message || 'Data yang dikirim tidak valid',
          error: 'VALIDATION_ERROR',
          details: error.extensions || null
        });
      }

      // Check for common error patterns
      if (response.status === 409 || result.message?.includes('duplicate') || result.message?.includes('already exists')) {
        return res.status(409).json({
          message: 'Email atau username sudah terdaftar. Silakan gunakan data lain atau login.',
          error: 'DUPLICATE_ENTRY'
        });
      }

      if (response.status === 400) {
        return res.status(400).json({
          message: result.message || 'Data yang dikirim tidak valid',
          error: 'VALIDATION_ERROR',
          details: result
        });
      }

      return res.status(500).json({
        message: result.message || 'Terjadi kesalahan saat mendaftarkan akun',
        error: 'REGISTRATION_FAILED',
        details: result
      });
    }

  } catch (error) {
    console.error('Registration API error:', {
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
}