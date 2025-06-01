'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

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
      
      // Find user with matching email and password
      const user = users.find(
        (u: any) => u.email === email && u.password_hash === password
      );
      
      if (user) {
        // Store user data temporarily for OTP verification
        localStorage.setItem('tempUser', JSON.stringify(user));
        
        // Show OTP step
        setShowOtpStep(true);
        toast.success('Login berhasil! OTP telah dikirim ke email Anda');
        
        // In a real app, you would send OTP to user's email here
        // await sendOTP(email);
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
      // Simplified OTP verification (for demo purposes)
      // In a real app, you would validate the OTP with your backend
      if (otp.length === 6) {
        // Get user data from temporary storage
        const tempUser = localStorage.getItem('tempUser');
        if (tempUser) {
          // Store user data permanently
          localStorage.setItem('user', tempUser);
          localStorage.removeItem('tempUser');
          
          toast.success('Login berhasil!');
          router.push('/dashboard');
        }
      } else {
        toast.error('Kode OTP harus 6 digit');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Verifikasi OTP gagal');
    }
    
    setLoading(false);
  };

  const handleResendOtp = () => {
    // In a real app, you would resend OTP here
    toast.success('OTP telah dikirim ulang ke email Anda');
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
                  <p className="text-sm text-slate-500 text-center">
                    Kode OTP telah dikirim ke <span className="font-medium">{email}</span>
                  </p>
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
                        localStorage.removeItem('tempUser');
                      }}
                    >
                      Kembali
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      onClick={handleResendOtp}
                    >
                      Kirim Ulang
                    </Button>
                  </div>
                </div>
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