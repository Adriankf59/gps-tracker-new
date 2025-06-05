'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Eye, EyeOff, Loader2, Clock, Mail, CheckCircle, AlertCircle, User, Lock, ArrowLeft } from 'lucide-react';
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
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  
  const router = useRouter();

  // Component mounting and animation setup
  useEffect(() => {
    setIsMounted(true);
    
    // Delay untuk animation
    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => {
      clearTimeout(animationTimer);
    };
  }, []);

  // Email validation
  useEffect(() => {
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValid(emailRegex.test(email));
    } else {
      setEmailValid(null);
    }
  }, [email]);

  // Countdown timer for resend OTP
  useEffect(() => {
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
        toast.success('🔐 Kode OTP telah dikirim ke email Anda');
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
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('👤 User login response:', result.user);
        
        // Store user data for OTP verification
        setTempUser(result.user);
        
        // Get userId with proper field mapping
        const userId = result.user.users_id || result.user.user_id || result.user.id;
        console.log('🔑 Using userId for OTP:', userId);
        
        if (!userId) {
          console.error('❌ No valid user ID found in response:', result.user);
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
        // Handle login errors
        if (result.error === 'INVALID_CREDENTIALS') {
          toast.error('📧 Email atau password tidak valid');
        } else if (result.error === 'ACCOUNT_LOCKED') {
          toast.error('🔒 Akun Anda dikunci karena terlalu banyak percobaan login yang gagal');
        } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
          toast.error('🕐 Terlalu banyak percobaan login. Coba lagi dalam 15 menit.');
        } else {
          toast.error(result.message || 'Login gagal');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('⚠️ Login gagal. Periksa koneksi internet Anda.');
    }
    
    setLoading(false);
  };

  const handleOtpVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Get userId with proper field mapping from tempUser
      const userId = tempUser.users_id || tempUser.user_id || tempUser.id;
      
      if (!userId) {
        console.error('❌ No valid user ID found in tempUser:', tempUser);
        toast.error('User ID tidak ditemukan. Silakan login ulang.');
        setShowOtpStep(false);
        setLoading(false);
        return;
      }
      
      console.log('🔐 Verifying OTP for userId:', userId);
      
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
        // Ensure user data has consistent properties with all possible field names
        const userData = {
          ...tempUser,
          // Ensure all ID variants exist for maximum compatibility
          id: userId,
          user_id: userId,
          users_id: userId,
          // Add timestamp for session tracking
          login_time: new Date().toISOString(),
          // Ensure name fields are consistent
          full_name: tempUser.name || tempUser.full_name,
          name: tempUser.name || tempUser.full_name,
          username: tempUser.nickname || tempUser.username,
          nickname: tempUser.nickname || tempUser.username,
        };
        
        console.log('💾 Storing user data in session:', {
          id: userData.id,
          user_id: userData.user_id,
          users_id: userData.users_id,
          email: userData.email,
          name: userData.name
        });
        
        // Store enhanced user data in sessionStorage
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        toast.success('🎉 Login berhasil!');
        
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
      // Get userId with proper field mapping
      const userId = tempUser.users_id || tempUser.user_id || tempUser.id;
      
      if (!userId) {
        console.error('❌ No valid user ID found for resend:', tempUser);
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

  const validateLoginForm = () => {
    return email.trim() && password.trim() && emailValid;
  };

  const resetLoginForm = () => {
    setShowOtpStep(false);
    setOtp('');
    setTempUser(null);
    setCountdown(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      {isMounted && (
        <>
          <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200 rounded-full opacity-10 animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-24 h-24 bg-purple-200 rounded-full opacity-10 animate-pulse" style={{animationDelay: '1s'}}></div>
        </>
      )}
      
      <div className={`w-full max-w-md transition-all duration-1000 ${isMounted && isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-all duration-300 group">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                GPS Tracker Pro
              </h1>
              <p className="text-sm text-slate-500">Vehicle Management System</p>
            </div>
          </Link>
        </div>
        
        <Card className="shadow-xl border-0 backdrop-blur-sm bg-white/90">
          <CardHeader className="text-center pb-6">
            {showOtpStep && (
              <div className="flex items-center justify-start mb-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetLoginForm}
                  className="p-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <CardTitle className="text-3xl mb-2">
              {showOtpStep ? 'Verifikasi Keamanan' : 'Selamat Datang Kembali'}
            </CardTitle>
            <CardDescription className="text-base">
              {showOtpStep 
                ? 'Masukkan kode OTP yang telah dikirim ke email Anda untuk keamanan ekstra'
                : 'Masuk ke dashboard GPS Tracker Pro Anda'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {!showOtpStep ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`h-12 pr-10 ${emailValid === false ? 'border-red-300' : emailValid === true ? 'border-green-300' : ''}`}
                      required
                    />
                    {isMounted && emailValid !== null && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {emailValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Kata Sandi
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="remember" className="text-sm text-slate-600">
                      Ingat saya
                    </Label>
                  </div>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                  >
                    Lupa kata sandi?
                  </Link>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl" 
                  disabled={loading || !validateLoginForm()}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpVerification} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Kode Verifikasi OTP
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Masukkan 6 digit kode OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    className="text-center text-xl tracking-[0.5em] h-14 font-mono"
                    required
                  />
                  <div className="flex items-center gap-2 text-sm text-slate-600 justify-center bg-blue-50 p-3 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Kode OTP dikirim ke <span className="font-semibold text-blue-700">{email}</span></span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl" 
                    disabled={loading || otp.length !== 6}
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3 bg ">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 border-2 hover:bg-slate-50"
                      onClick={resetLoginForm}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Kembali
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 border border-dashed border-slate-300 hover:border-blue-300 hover:bg-blue-50"
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
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Kirim Ulang
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {countdown > 0 && (
                  <div className="text-center text-sm text-slate-600 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 p-3 rounded-lg">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <span>Anda dapat meminta kode baru dalam <span className="font-semibold text-yellow-700">{formatTime(countdown)}</span></span>
                    </div>
                  </div>
                )}
              </form>
            )}
            
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-slate-600">
                Belum punya akun?{' '}
                <Link 
                  href="/register" 
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                >
                  Daftar sekarang
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Login Aman dengan OTP</h4>
              <p className="text-xs text-blue-600 leading-relaxed">
                Sistem kami menggunakan verifikasi 2 langkah untuk melindungi akun Anda dari akses yang tidak sah.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;