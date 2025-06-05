'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, ArrowLeft, Mail, Loader2, CheckCircle, AlertCircle, Lock, Eye, EyeOff, Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "success">("email");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  // Email validation
  useEffect(() => {
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValid(emailRegex.test(email));
    } else {
      setEmailValid(null);
    }
  }, [email]);

  // Password strength validation
  useEffect(() => {
    if (password) {
      if (password.length < 6) {
        setPasswordStrength('weak');
      } else if (password.length >= 6 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)) {
        if (password.length >= 8 && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
          setPasswordStrength('strong');
        } else {
          setPasswordStrength('medium');
        }
      } else {
        setPasswordStrength('weak');
      }
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

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

  // Step 1: Submit email to request OTP
  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          step: 'send_otp'
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log("✅ OTP request successful for:", email);
        setStep("otp");
        setCountdown(60); // Start 60-second countdown for resend
        toast.success('🔐 Kode OTP telah dikirim ke email Anda');
        
        // Show messageId in development mode
        if (result.messageId && process.env.NODE_ENV === 'development') {
          console.log("📧 Email Message ID:", result.messageId);
        }
      } else {
        // Handle different error types
        if (result.error === 'RATE_LIMIT_EXCEEDED') {
          toast.error('🕐 Terlalu banyak percobaan. Coba lagi dalam 1 jam.');
        } else if (result.error === 'INVALID_EMAIL') {
          toast.error('📧 Format email tidak valid');
        } else if (result.error === 'EMAIL_SEND_FAILED') {
          toast.error('📮 Gagal mengirim email. Silakan coba lagi atau hubungi admin.');
        } else {
          toast.error(result.message || 'Gagal mengirim email reset. Silakan coba lagi.');
        }
      }
    } catch (error) {
      console.error('❌ Forgot password error:', error);
      toast.error('⚠️ Gagal mengirim email. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          step: 'send_otp'
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setCountdown(60); // Reset countdown
        toast.success('🔐 Kode OTP baru telah dikirim ke email Anda');
        
        // Show messageId in development mode
        if (result.messageId && process.env.NODE_ENV === 'development') {
          console.log("📧 Resend Email Message ID:", result.messageId);
        }
      } else {
        if (result.error === 'RATE_LIMIT_EXCEEDED') {
          toast.error('🕐 Terlalu banyak percobaan. Coba lagi dalam 1 jam.');
        } else {
          toast.error(result.message || 'Gagal mengirim ulang OTP');
        }
      }
    } catch (error) {
      console.error('❌ Resend OTP error:', error);
      toast.error('Gagal mengirim ulang OTP. Silakan coba lagi.');
    } finally {
      setResendLoading(false);
    }
  };

  // Step 2: Submit OTP and new password
  const handleSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password match
    if (password !== confirmPassword) {
      toast.error('❌ Password dan konfirmasi password tidak sama');
      return;
    }
    
    // Validate password strength
    if (passwordStrength === 'weak') {
      toast.error('🔒 Password terlalu lemah. Minimal 6 karakter dengan huruf dan angka.');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          step: 'reset_password',
          otp: otp.trim(),
          password: password
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log("✅ Password reset successful for:", email);
        setStep("success");
        toast.success('🎉 Password Anda telah berhasil direset!');
      } else {
        // Handle different error types
        if (result.error === 'INVALID_OTP') {
          toast.error('🔐 Kode OTP tidak valid atau sudah kedaluwarsa');
        } else if (result.error === 'WEAK_PASSWORD') {
          toast.error('🔒 Password terlalu lemah. Minimal 6 karakter dengan huruf dan angka.');
        } else if (result.error === 'PASSWORD_UPDATE_FAILED') {
          toast.error('💾 Gagal memperbarui password di database. Silakan coba lagi.');
        } else if (result.error === 'VALIDATION_ERROR') {
          toast.error('📝 Data tidak lengkap. Pastikan semua field terisi.');
        } else {
          toast.error(result.message || 'Gagal mereset password. Silakan coba lagi.');
        }
      }
    } catch (error) {
      console.error('❌ Reset password error:', error);
      toast.error('⚠️ Gagal mereset password. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'strong': return 'text-green-600';
      default: return 'text-gray-500';
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'weak': return 'Lemah';
      case 'medium': return 'Sedang';
      case 'strong': return 'Kuat';
      default: return '';
    }
  };

  const resetForm = () => {
    setStep("email");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setCountdown(0);
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-lg text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Password Berhasil Diubah!</CardTitle>
              <CardDescription>
                Password Anda telah berhasil direset. Silakan login dengan password baru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full">
                <Link href="/login">Kembali ke Login</Link>
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={resetForm}
              >
                Reset Password Lain
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-slate-800">GPS Tracker Pro</h1>
              <p className="text-sm text-slate-500">Vehicle Management System</p>
            </div>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            {step === "otp" && (
              <div className="flex items-center justify-start mb-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetForm}
                  className="p-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <CardTitle className="text-2xl">
              {step === "email" ? "Lupa Kata Sandi?" : "Verifikasi & Reset"}
            </CardTitle>
            <CardDescription>
              {step === "email"
                ? "Masukkan email Anda untuk menerima kode OTP reset password"
                : `Kode OTP telah dikirim ke ${email}. Masukkan kode OTP dan password baru Anda.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={handleSubmitEmail} className="space-y-4">
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
                      disabled={loading}
                    />
                    {emailValid !== null && (
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
                <Button 
                  type="submit" 
                  className="w-full h-12" 
                  disabled={loading || !emailValid}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? 'Mengirim OTP...' : 'Kirim OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmitOtp} className="space-y-4">
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
                    disabled={loading}
                  />
                  <div className="flex items-center gap-2 text-sm text-slate-600 justify-center bg-blue-50 p-3 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Kode OTP dikirim ke <span className="font-semibold text-blue-700">{email}</span></span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password Baru
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password baru"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-10"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordStrength && (
                    <p className={`text-sm ${getPasswordStrengthColor()}`}>
                      Kekuatan password: {getPasswordStrengthText()}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Konfirmasi Password Baru
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Ulangi password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`h-12 pr-10 ${password && confirmPassword && password !== confirmPassword ? 'border-red-300' : password && confirmPassword && password === confirmPassword ? 'border-green-300' : ''}`}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-red-600">Password tidak sama</p>
                  )}
                </div>
                
                <div className="space-y-3 pt-2">
                  <Button 
                    type="submit" 
                    className="w-full h-12" 
                    disabled={loading || otp.length !== 6 || password !== confirmPassword || passwordStrength === 'weak'}
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {loading ? 'Mereset Password...' : 'Reset Password'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-11 border border-dashed border-slate-300 hover:border-blue-300 hover:bg-blue-50"
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
                        Kirim Ulang OTP
                      </>
                    )}
                  </Button>
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
            
            <div className="mt-6 text-center">
              <Link 
                href="/login" 
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Login
              </Link>
            </div>
          </CardContent>
        </Card>
        
        {/* Security Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Reset Password Aman dengan OTP</h4>
              <p className="text-xs text-blue-600 leading-relaxed">
                Sistem kami menggunakan verifikasi OTP melalui email untuk memastikan keamanan reset password Anda. 
                Kode OTP berlaku selama <strong>10 menit</strong> dan otomatis terhapus setelah berhasil digunakan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;