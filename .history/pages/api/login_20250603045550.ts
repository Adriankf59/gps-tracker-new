import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';

// Initialize Redis client
let redis: any;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
} catch (error) {
  console.warn('Redis not available:', error);
  redis = null;
}

// Rate limiting untuk login attempts
const checkLoginRateLimit = async (ip: string): Promise<{ allowed: boolean; remaining: number }> => {
  const maxAttempts = 10; // 10 attempts per 15 minutes
  
  if (!redis) {
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  const key = `login_limit:${ip}`;
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

// Check account lockout
const checkAccountLockout = async (email: string): Promise<{ locked: boolean; attempts: number }> => {
  if (!redis) {
    return { locked: false, attempts: 0 };
  }
  
  const key = `account_lockout:${email}`;
  const maxAttempts = 5;
  
  try {
    const attempts = await redis.get(key);
    const attemptCount = attempts ? parseInt(attempts as string) : 0;
    
    return {
      locked: attemptCount >= maxAttempts,
      attempts: attemptCount
    };
  } catch (error) {
    console.error('Redis account lockout check error:', error);
    return { locked: false, attempts: 0 };
  }
};

// Increment failed login attempts
const incrementFailedAttempts = async (email: string): Promise<void> => {
  if (!redis) return;
  
  const key = `account_lockout:${email}`;
  const lockoutWindow = 30 * 60; // 30 minutes
  
  try {
    const current = await redis.get(key);
    
    if (!current) {
      await redis.setex(key, lockoutWindow, 1);
    } else {
      await redis.incr(key);
      await redis.expire(key, lockoutWindow);
    }
  } catch (error) {
    console.error('Redis increment failed attempts error:', error);
  }
};

// Clear failed login attempts
const clearFailedAttempts = async (email: string): Promise<void> => {
  if (!redis) return;
  
  const key = `account_lockout:${email}`;
  
  try {
    await redis.del(key);
  } catch (error) {
    console.error('Redis clear failed attempts error:', error);
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

interface LoginRequestBody {
  email: string;
  password: string;
}

interface ApiResponse {
  message: string;
  success?: boolean;
  user?: any;
  error?: string;
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

  // Get client IP
  const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress ||
                   'unknown';

  // Check rate limiting
  const rateLimitResult = await checkLoginRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Debug logging
  if (process.env.DEBUG_API === 'true') {
    console.log('Login attempt:', {
      ip: clientIP,
      timestamp: new Date().toISOString(),
      remaining_attempts: rateLimitResult.remaining
    });
  }

  try {
    const { email, password }: LoginRequestBody = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email dan password wajib diisi',
        error: 'VALIDATION_ERROR'
      });
    }

    // Sanitize input
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedPassword = password; // Don't sanitize password

    // Validate email format
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({
        message: 'Format email tidak valid',
        error: 'INVALID_EMAIL'
      });
    }

    // Check account lockout
    const lockoutStatus = await checkAccountLockout(sanitizedEmail);
    
    if (lockoutStatus.locked) {
      return res.status(423).json({
        message: 'Akun dikunci karena terlalu banyak percobaan login yang gagal. Coba lagi dalam 30 menit.',
        error: 'ACCOUNT_LOCKED'
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

    // Debug logging
    if (process.env.DEBUG_API === 'true') {
      console.log('Fetching users from:', `${directusUrl}/items/users`);
    }

    // Fetch users from Directus
    const response = await fetch(`${directusUrl}/items/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    const users = data.data || [];

    console.log('📊 API Response structure:', {
      hasData: !!data.data,
      userCount: users.length,
      firstUserFields: users[0] ? Object.keys(users[0]) : []
    });

    // Find user with matching email
    const user = users.find((u: any) => u.email === sanitizedEmail);

    if (!user) {
      await incrementFailedAttempts(sanitizedEmail);
      return res.status(401).json({
        message: 'Email atau password tidak valid',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    let passwordValid = false;

    try {
      // Try bcrypt verification first (for properly hashed passwords)
      passwordValid = await bcrypt.compare(sanitizedPassword, user.password_hash);
    } catch (bcryptError) {
      // If bcrypt fails, might be plain text password (legacy)
      passwordValid = sanitizedPassword === user.password_hash;
      
      if (passwordValid && process.env.DEBUG_API === 'true') {
        console.warn('⚠️ Plain text password detected for user:', sanitizedEmail);
      }
    }

    if (!passwordValid) {
      await incrementFailedAttempts(sanitizedEmail);
      return res.status(401).json({
        message: 'Email atau password tidak valid',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Successful login - clear failed attempts
    await clearFailedAttempts(sanitizedEmail);

    // Prepare user data (remove sensitive information)
    const userData = {
      id: user.id || user.user_id,
      user_id: user.user_id || user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      status: user.status,
      email_verified: user.email_verified,
      created_at: user.created_at,
      // Don't include password_hash or other sensitive data
    };

    // Log successful login
    console.log('✅ User login successful:', {
      user_id: userData.user_id,
      email: userData.email,
      timestamp: new Date().toISOString()
    });

    // Store login session in Redis (optional)
    if (redis) {
      try {
        await redis.setex(
          `login_session:${userData.user_id}`, 
          24 * 60 * 60, // 24 hours
          JSON.stringify({
            user_id: userData.user_id,
            email: userData.email,
            login_time: new Date().toISOString(),
            ip: clientIP
          })
        );
      } catch (redisError) {
        console.error('Redis session storage failed:', redisError);
        // Don't fail login if Redis fails
      }
    }

    return res.status(200).json({
      message: 'Login berhasil',
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Login API error:', {
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