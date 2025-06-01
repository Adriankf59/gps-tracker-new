'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
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
        // Simulate sending OTP
        // In a real app, you would call an actual API endpoint to send OTP
        setShowOtpStep(true);
        toast.success('OTP telah dikirim ke email Anda');
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
      // In a real app, you would validate the OTP properly
      if (otp.length === 6) {
        // Fetch users again to get the user data
        const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users');
        
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        
        const data = await response.json();
        const users = data.data || [];
        
        // Find user with matching email
        const user = users.find((u: any) => u.email === email);
        
        if (user) {
          // Store user data in localStorage
          localStorage.setItem('user', JSON.stringify(user));
          
          toast.success('Login berhasil!');
          router.push('/dashboard');
        } else {
          toast.error('Terjadi kesalahan. Silakan coba lagi.');
        }
      } else {
        toast.error('Kode OTP tidak valid');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Verifikasi OTP gagal');
    }
    
    setLoading(false);
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
            <CardTitle className="text-2xl">{showOtpStep ? 'Verifikasi OTP' : 'Masuk ke Akun Anda'}</CardTitle>
            <CardDescription>
              {showOtpStep 
                ? 'Masukkan kode OTP yang telah dikirim ke email Anda'
                : 'Masukkan email dan kata sandi untuk mengakses dashboard'
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
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Link 
                      href="/forgot-password" 
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Lupa kata sandi?
                    </Link>
                  </div>
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
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    required
                  />
                  <p className="text-sm text-gray-500">
                    Kode OTP telah dikirim ke {email}
                  </p>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verifikasi OTP
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowOtpStep(false)}
                >
                  Kembali ke Login
                </Button>
              </form>
            )}
            
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Belum punya akun?{" "}
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