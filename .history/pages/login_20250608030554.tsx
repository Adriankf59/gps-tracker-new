'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Eye, EyeOff, Loader2, Clock, Mail, CheckCircle, AlertCircle, User, Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface UserData {
  id?: string;
  user_id?: string;
  users_id?: string;
  name?: string;
  full_name?: string;
  nickname?: string;
  username?: string;
  email?: string;
  phone_number?: string;
  status?: string;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
}

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showOtpStep, setShowOtpStep] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [tempUser, setTempUser] = useState<UserData | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  
  const router = useRouter();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown]);

  // Auto-submit OTP when all fields are filled
  useEffect(() => {
    if (otp.every(digit => digit !== '') && otp.join('').length === 6) {
      handleOtpVerification();
    }
  }, [otp]);

  const sendOTP = async (userId: string, userEmail: string): Promise<boolean> => {
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
          
          // Focus first OTP input
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
          
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

  const handleOtpChange = (index: number, value: string): void => {
    if (value.length > 1) return; // Prevent multiple characters
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      // Focus will trigger auto-submit via useEffect
    }
  };

  const handleOtpVerification = async (e?: React.FormEvent<HTMLFormElement>): Promise<void> => {
    if (e) e.preventDefault();
    
    // Check if we're already loading or OTP is incomplete
    if (loading || otp.some(digit => !digit)) return;
    
    setLoading(true);
    
    try {
      // Get userId with proper field mapping from tempUser
      const userId = tempUser?.users_id || tempUser?.user_id || tempUser?.id;
      
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
          otp: otp.join(''),
          userId: userId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Ensure user data has consistent properties with all possible field names
        const userData: UserData = {
          ...tempUser,
          // Ensure all ID variants exist for maximum compatibility
          id: userId,
          user_id: userId,
          users_id: userId,
          // Add timestamp for session tracking
          last_login: new Date().toISOString(),
          // Ensure name fields are consistent
          full_name: tempUser?.name || tempUser?.full_name,
          name: tempUser?.name || tempUser?.full_name,
          username: tempUser?.nickname || tempUser?.username,
          nickname: tempUser?.nickname || tempUser?.username,
        };
        
        console.log('💾 Storing user data in session:', {
          id: userData.id,
          user_id: userData.user_id,
          users_id: userData.users_id,
          email: userData.email,
          name: userData.name
        });
        
        // Store enhanced user data in sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user', JSON.stringify(userData));
        }
        
        toast.success('🎉 Login berhasil!');
        
        // Add small delay to ensure data is stored
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      } else {
        toast.error(result.message || 'Kode OTP tidak valid');
        // Reset OTP on failure
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Verifikasi OTP gagal. Silakan coba lagi.');
      // Reset OTP on error
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    }
    
    setLoading(false);
  };

  const handleResendOtp = async (): Promise<void> => {
    if (countdown > 0 || !tempUser) return;
    
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
      setOtp(['', '', '', '', '', '']); // Clear OTP
      otpInputRefs.current[0]?.focus(); // Focus first input
    } catch (error) {
      // Error toast already shown in sendOTP function
    }
    
    setResendLoading(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validateLoginForm = (): boolean => {
    return email.trim() !== '' && password.trim() !== '' && emailValid === true;
  };

  const resetLoginForm = (): void => {
    setShowOtpStep(false);
    setOtp(['', '', '', '', '', '']);
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
                  type="button"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <CardTitle className="text-2xl sm:text-3xl mb-2">
              {showOtpStep ? 'Verifikasi Keamanan' : 'Selamat Datang Kembali'}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base px-2">
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
                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
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
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 justify-center text-center">
                    <Lock className="w-4 h-4" />
                    Kode Verifikasi OTP
                  </Label>
                  
                  {/* Mobile-optimized OTP Input */}
                  <div className="flex justify-center gap-2 sm:gap-3 px-2">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (otpInputRefs.current[index] = el)}
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        disabled={loading}
                        className={`
                          w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold 
                          rounded-lg border-2 transition-all duration-200 focus:outline-none
                          ${digit 
                            ? 'border-blue-400 bg-blue-50 text-blue-600' 
                            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          }
                          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                          focus:border-blue-500 focus:bg-blue-50 focus:shadow-lg
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        style={{ 
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield'
                        }}
                      />
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 justify-center bg-blue-50 p-3 rounded-lg mx-2">
                    <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-center">
                      Kode OTP dikirim ke <span className="font-semibold text-blue-700 block sm:inline">{email}</span>
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Manual verify button - only show if not auto-submitting */}
                  {otp.every(digit => digit !== '') && !loading && (
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl" 
                    >
                      Verifikasi & Masuk
                    </Button>
                  )}
                  
                  {/* Loading state */}
                  {loading && (
                    <div className="flex items-center justify-center text-blue-600 py-3">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      <span className="text-sm">Memverifikasi...</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 border-2 bg-white hover:bg-slate-50 text-xs sm:text-sm"
                      onClick={resetLoginForm}
                      disabled={loading}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
                      Kembali
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 border border-dashed border-slate-300 hover:border-blue-300 hover:bg-blue-50 text-xs sm:text-sm"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || resendLoading || loading}
                    >
                      {resendLoading && <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />}
                      {countdown > 0 ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="hidden sm:inline">{formatTime(countdown)}</span>
                          <span className="sm:hidden">{countdown}s</span>
                        </div>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Kirim Ulang</span>
                          <span className="sm:hidden">Ulang</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {countdown > 0 && (
                  <div className="text-center text-xs sm:text-sm text-slate-600 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 p-3 rounded-lg mx-2">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                      <span className="text-center">
                        Anda dapat meminta kode baru dalam{' '}
                        <span className="font-semibold text-yellow-700">{formatTime(countdown)}</span>
                      </span>
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
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 mx-2 sm:mx-0">
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