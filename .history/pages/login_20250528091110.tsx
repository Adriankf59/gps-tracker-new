'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Eye, EyeOff, Loader2, Clock, Mail } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [tempUser, setTempUser] = useState<any>(null);
  
  const router = useRouter();

  // Countdown timer for resend OTP
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [countdown]);

  const sendOTP = async (userId: string, userEmail: string) => {
    try {
      const response = await fetch('/api/auth/generateOTP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          userId: userId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Kode OTP telah dikirim ke email Anda');
        return true;
      } else {
        toast.error(result.message || 'Gagal mengirim OTP');
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast.error('Gagal mengirim OTP. Silakan coba lagi.');
      throw error;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Fetch users from the API
      const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users');
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      const users = data.data || [];
      
      console.log('📊 API Response:', data);
      console.log('👥 Users array:', users);
      console.log('🔍 First user structure:', users[0]); // Debug: lihat struktur user
      
      // Find user with matching email and password
      const user = users.find(
        (u: any) => u.email === email && u.password_hash === password
      );
      
      if (user) {
        console.log('👤 User found:', user); // Debug: lihat struktur user
        console.log('🆔 User ID field:', user.id || user._id || user.user_id); // Check ID field
        
        // Store user data for OTP verification
        setTempUser(user);
        
        // Get userId - check different possible field names
        const userId = user.id || user._id || user.user_id || user.ID || String(user.id);
        console.log('🔑 Using userId:', userId);
        
        if (!userId) {
          toast.error('User ID tidak ditemukan. Silakan hubungi administrator.');
          setLoading(false);
          return;
        }
        
        // Send real OTP to user's email
        try {
          await sendOTP(userId, email);
          
          // Show OTP step only after successful email sending
          setShowOtpStep(true);
          setCountdown(60); // Start 60-second countdown for resend
          
        } catch (otpError) {
          // If OTP sending fails, don't proceed to OTP step
          console.error('OTP sending failed:', otpError);
          // Error toast already shown in sendOTP function
        }
        
      } else {
        toast.error('Email atau password tidak valid');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login gagal. Periksa koneksi internet Anda.');
    }
    
    setLoading(false);
  };

  const handleOtpVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Verify OTP with backend API
      const userId = tempUser.id || tempUser._id || tempUser.user_id || tempUser.ID || String(tempUser.id);
      
      if (!userId) {
        toast.error('User ID tidak ditemukan. Silakan login ulang.');
        setShowOtpStep(false);
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/auth/verifyOTP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          otp: otp,
          userId: userId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Store user data in sessionStorage
        sessionStorage.setItem('user', JSON.stringify(tempUser));
        
        toast.success('Login berhasil!');
        
        // Add small delay to ensure data is stored
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      } else {
        toast.error(result.message || 'Kode OTP tidak valid');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Verifikasi OTP gagal. Silakan coba lagi.');
    }
    
    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    
    try {
      // Get userId with same logic as handleLogin
      const userId = tempUser.id || tempUser._id || tempUser.user_id || tempUser.ID || String(tempUser.id);
      
      if (!userId) {
        toast.error('User ID tidak ditemukan. Silakan login ulang.');
        setShowOtpStep(false);
        setResendLoading(false);
        return;
      }
      
      await sendOTP(userId, email);
      setCountdown(60); // Reset countdown
    } catch (error) {
      // Error toast already shown in sendOTP function
    }
    
    setResendLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-slate-800">GPS Tracker</h1>
              <p className="text-sm text-slate-500">Vehicle Management System</p>
            </div>
          </Link>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {showOtpStep ? 'Verifikasi OTP' : 'Selamat Datang Kembali'}
            </CardTitle>
            <CardDescription>
              {showOtpStep 
                ? 'Masukkan kode OTP yang telah dikirim ke email Anda'
                : 'Masuk ke akun GPS Tracker Anda'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {!showOtpStep ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Kata Sandi</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Lupa kata sandi?
                  </Link>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Masuk
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpVerification} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Kode OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Masukkan 6 digit kode OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                    required
                  />
                  <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                    <Mail className="w-4 h-4" />
                    <span>Kode OTP dikirim ke <span className="font-medium">{email}</span></span>
                  </div>
                  
                </div>
                
                <div className="space-y-3">
                  <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Verifikasi OTP
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowOtpStep(false);
                        setOtp('');
                        setTempUser(null);
                        setCountdown(0);
                      }}
                    >
                      Kembali
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || resendLoading}
                    >
                      {resendLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {countdown > 0 ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(countdown)}
                        </div>
                      ) : (
                        'Kirim Ulang'
                      )}
                    </Button>
                  </div>
                </div>
                
                {countdown > 0 && (
                  <div className="text-center text-xs text-slate-500 bg-slate-50 p-2 rounded">
                    Anda dapat meminta kode baru dalam {formatTime(countdown)}
                  </div>
                )}
              </form>
            )}
            
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Belum punya akun?{' '}
                <Link 
                  href="/register" 
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  Daftar sekarang
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;