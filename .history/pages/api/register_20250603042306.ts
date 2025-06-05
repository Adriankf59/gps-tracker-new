import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import nodemailer from 'nodemailer';

// Initialize Redis client untuk rate limiting dan session management
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Email transporter configuration
const emailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Rate limiting dengan Redis
const checkRateLimit = async (ip: string): Promise<{ allowed: boolean; remaining: number }> => {
  const key = `register_limit:${ip}`;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  
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
};

// Function untuk mengirim welcome email
const sendWelcomeEmail = async (email: string, fullName: string, username: string): Promise<boolean> => {
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
            
            <div style="margin: 30px 0;">
              <h3 style="color: #1e293b; margin-bottom: 15px;">✨ Fitur Unggulan yang Menanti Anda:</h3>
              <ul style="color: #475569; line-height: 1.8; padding-left: 20px;">
                <li>📍 Real-time GPS tracking dengan akurasi tinggi</li>
                <li>🛡️ Geofencing untuk keamanan maksimal</li>
                <li>📱 Remote control kendaraan dari smartphone</li>
                <li>📊 Analytics dashboard yang komprehensif</li>
                <li>🔔 Notifikasi instant untuk semua aktivitas</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://gps-tracker-pro.com'}/login" 
                 style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block; 
                        font-weight: bold;
                        box-shadow: 0 4px 6px rgba(37, 99, 235, 0.25);">
                🚀 Mulai Tracking Sekarang
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                <strong>Butuh bantuan?</strong> Tim support kami siap membantu 24/7 di 
                <a href="mailto:support@gps-tracker-pro.com" style="color: #2563eb;">support@gps-tracker-pro.com</a>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
            <p>© 2024 GPS Tracker Pro. Semua hak dilindungi undang-undang.</p>
            <p>Email ini dikirim karena Anda mendaftar di layanan kami.</p>
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
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function untuk validasi password
const isValidPassword = (password: string): boolean => {
  // Minimal 8 karakter, mengandung huruf besar, kecil, angka, dan karakter khusus
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Helper function untuk validasi nomor telepon Indonesia
const isValidPhoneNumber = (phone: string): boolean => {
  // Format: 08xxxxxxxxxx (10-13 digit)
  const phoneRegex = /^08\d{8,11}$/;
  const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
  return phoneRegex.test(cleanPhone);
};

// Helper function untuk sanitasi input
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
  // Get client IP untuk rate limiting
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.headers['x-real-ip'] as string || 
                   req.connection.remoteAddress || 
                   'unknown';

  // Check rate limiting dengan Redis
  const rateLimitResult = await checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      message: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 15 menit.',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Debug logging jika enabled
  if (process.env.DEBUG_API === 'true') {
    console.log('Registration attempt:', {
      ip: clientIP,
      timestamp: new Date().toISOString(),
      remaining_attempts: rateLimitResult.remaining
    });
  }

  // Hanya terima POST request
  if (req.method !== 'POST') {
    return res.status(405).json({
      message: 'Method not allowed',
      error: 'METHOD_NOT_ALLOWED'
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
      phone_number: phone_number.replace(/\D/g, ''), // Remove formatting
      password_hash: password_hash // Don't sanitize password
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

    if (sanitizedData.username.length < 3 || sanitizedData.username.length > 20) {
      return res.status(400).json({
        message: 'Username harus antara 3-20 karakter',
        error: 'INVALID_USERNAME'
      });
    }

    if (sanitizedData.full_name.length < 2 || sanitizedData.full_name.length > 50) {
      return res.status(400).json({
        message: 'Nama lengkap harus antara 2-50 karakter',
        error: 'INVALID_FULLNAME'
      });
    }

    // Hash password di server-side untuk keamanan
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password_hash, saltRounds);

    // Prepare data untuk Directus
    const directusData = {
      user_id: sanitizedData.user_id,
      username: sanitizedData.username,
      password_hash: hashedPassword, // Use hashed password
      full_name: sanitizedData.full_name,
      email: sanitizedData.email,
      phone_number: sanitizedData.phone_number,
      marketing_consent: Boolean(marketing_consent),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      email_verified: false, // Default false, bisa diverifikasi nanti
      last_login: null,
      login_attempts: 0,
      account_locked: false
    };

    // Kirim ke Directus menggunakan environment variable yang ada
    const directusUrl = process.env.API_URL;
    
    if (!directusUrl) {
      throw new Error('DIRECTUS_URL not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const directusResponse = await fetch(`${directusUrl}/items/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(directusData)
    });

    const result = await directusResponse.json();

    if (directusResponse.ok) {
      // Log successful registration
      console.log('User registered successfully:', {
        user_id: sanitizedData.user_id,
        username: sanitizedData.username,
        email: sanitizedData.email,
        timestamp: new Date().toISOString()
      });

      // Kirim welcome email (async, tidak blocking response)
      sendWelcomeEmail(sanitizedData.email, sanitizedData.full_name, sanitizedData.username)
        .then((emailSent) => {
          if (process.env.DEBUG_API === 'true') {
            console.log('Welcome email sent:', emailSent);
          }
        })
        .catch((emailError) => {
          console.error('Welcome email failed:', emailError);
        });

      // Store user session info in Redis untuk future use
      try {
        await redis.setex(
          `user_session:${sanitizedData.user_id}`, 
          86400, // 24 hours
          JSON.stringify({
            user_id: sanitizedData.user_id,
            username: sanitizedData.username,
            email: sanitizedData.email,
            registered_at: new Date().toISOString()
          })
        );
      } catch (redisError) {
        console.error('Redis session storage failed:', redisError);
        // Don't fail registration if Redis fails
      }

      return res.status(201).json({
        message: 'Registrasi berhasil! Silakan cek email Anda untuk informasi selanjutnya.',
        user_id: sanitizedData.user_id
      });

    } else {
      // Handle specific Directus errors
      console.error('Directus registration error:', {
        status: directusResponse.status,
        error: result,
        timestamp: new Date().toISOString()
      });

      // Check for duplicate entries
      if (result.errors?.[0]?.extensions?.code === 'RECORD_NOT_UNIQUE') {
        const field = result.errors[0].extensions.field;
        let message = 'Data sudah terdaftar';
        
        if (field === 'email') {
          message = 'Email sudah terdaftar. Silakan gunakan email lain atau login.';
        } else if (field === 'username') {
          message = 'Username sudah digunakan. Silakan pilih username lain.';
        }

        return res.status(409).json({
          message,
          error: 'DUPLICATE_ENTRY'
        });
      }

      // Generic error response
      return res.status(400).json({
        message: result.errors?.[0]?.message || 'Terjadi kesalahan saat mendaftarkan akun',
        error: 'REGISTRATION_FAILED'
      });
    }

  } catch (error) {
    // Log error untuk debugging (tanpa sensitive data)
    console.error('Registration API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    // Network atau server error
    if (error instanceof Error && error.message.includes('fetch')) {
      return res.status(503).json({
        message: 'Layanan sedang tidak tersedia. Silakan coba lagi nanti.',
        error: 'SERVICE_UNAVAILABLE'
      });
    }

    // Generic server error
    return res.status(500).json({
      message: 'Terjadi kesalahan server. Silakan coba lagi nanti.',
      error: 'INTERNAL_ERROR'
    });
  }
}

// Export configuration untuk Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}