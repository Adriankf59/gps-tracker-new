'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { MapPin, Eye, EyeOff, Loader2, CheckCircle, XCircle, Shield, Mail, Phone, User, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

interface FormData {
  fullName: string;
  nickname: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  agreeToMarketing: boolean;
}

interface PasswordCriteria {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    nickname: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    agreeToMarketing: false
  });

  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  const [emailValid, setEmailValid] = useState<boolean | null>(null);

  const router = useRouter();

  // Auto-advancing hero text
  const heroTexts = [
    "Pantau Kendaraan Anda",
    "Amankan Armada Anda", 
    "Kelola Fleet Anda"
  ];

  // Component mounting and animation setup
  useEffect(() => {
    setIsMounted(true);
    
    // Delay untuk animation
    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    // Interval untuk sliding text
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroTexts.length);
    }, 3000);
    
    return () => {
      clearTimeout(animationTimer);
      clearInterval(interval);
    };
  }, []);

  // Real-time password validation
  useEffect(() => {
    const password = formData.password;
    setPasswordCriteria({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    });
  }, [formData.password]);

  // Email validation
  useEffect(() => {
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValid(emailRegex.test(formData.email));
    } else {
      setEmailValid(null);
    }
  }, [formData.email]);

  const calculatePasswordStrength = () => {
    const criteria = Object.values(passwordCriteria);
    const met = criteria.filter(Boolean).length;
    return (met / criteria.length) * 100;
  };

  const getPasswordStrengthText = () => {
    const strength = calculatePasswordStrength();
    if (strength < 40) return "Lemah";
    if (strength < 80) return "Sedang";
    return "Kuat";
  };

  const validateStep1 = () => {
    return formData.fullName.trim() && 
           formData.nickname.trim() && 
           emailValid && 
           formData.phoneNumber.trim();
  };

  const validateStep2 = () => {
    return Object.values(passwordCriteria).every(Boolean) &&
           formData.password === formData.confirmPassword &&
           formData.agreeToTerms;
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, '');
    
    // Format: 0812-3456-7890
    if (numbers.length <= 4) return numbers;
    if (numbers.length <= 8) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}-${numbers.slice(8, 12)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep2()) {
      toast.error("Pastikan semua field telah diisi dengan benar!");
      return;
    }
    
    setLoading(true);
    
    try {
      const userId = uuidv4();
      
      // Format data sesuai dengan endpoint yang diinginkan
      const requestData = {
        user_id: userId,
        username: formData.nickname,
        password_hash: formData.password,
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formData.phoneNumber.replace(/\D/g, ''), // Remove formatting
        marketing_consent: formData.agreeToMarketing
      };

      console.log('Sending registration data:', requestData);
      
      // Use Next.js API route
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success('🎉 Registrasi berhasil! Silakan login.');
        // Add delay for better UX
        setTimeout(() => {
          router.push('/login?registered=true');
        }, 1500);
      } else {
        console.error('Registration error:', result);
        
        // Handle specific error cases
        if (result.error === 'DUPLICATE_ENTRY') {
          toast.error('Email atau username sudah terdaftar. Silakan gunakan data lain.');
        } else if (result.error === 'VALIDATION_ERROR') {
          toast.error(result.message || 'Data yang dimasukkan tidak valid.');
        } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
          toast.error('Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
        } else {
          toast.error(`Registrasi gagal: ${result.message || 'Silakan coba lagi.'}`);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Terjadi kesalahan koneksi. Silakan coba lagi.');
    }
    
    setLoading(false);
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    if (field === 'phoneNumber' && typeof value === 'string') {
      // Apply phone number formatting
      const formatted = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        [field]: formatted
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
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
            <div className="flex items-center justify-between mb-4">
              {currentStep === 2 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={prevStep}
                  className="p-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div className="flex-1">
                <div className="flex justify-center mb-2">
                  <div className="flex gap-2">
                    <div className={`w-8 h-2 rounded-full transition-all duration-300 ${currentStep >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                    <div className={`w-8 h-2 rounded-full transition-all duration-300 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Langkah {currentStep} dari 2
                </p>
              </div>
              <div className="w-8"></div>
            </div>
            
            <CardTitle className="text-2xl mb-2">
              {currentStep === 1 ? "Informasi Pribadi" : "Keamanan Akun"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 
                ? "Masukkan data diri Anda dengan lengkap" 
                : "Buat password yang aman untuk akun Anda"
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nama Lengkap
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    className="h-12"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Username
                  </Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="Pilih username unik"
                    value={formData.nickname}
                    onChange={(e) => handleInputChange("nickname", e.target.value)}
                    className="h-12"
                    required
                  />
                  <p className="text-xs text-slate-500">Username akan digunakan untuk login</p>
                </div>

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
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`h-12 pr-10 ${emailValid === false ? 'border-red-300' : emailValid === true ? 'border-green-300' : ''}`}
                      required
                    />
                    {isMounted && emailValid !== null && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {emailValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Nomor Telepon
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="0812-3456-7890"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    className="h-12"
                    maxLength={13}
                    required
                  />
                  <p className="text-xs text-slate-500">Format: 0812-3456-7890</p>
                </div>

                <Button 
                  onClick={nextStep} 
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
                  disabled={!validateStep1()}
                >
                  Lanjutkan
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Kata Sandi
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Buat kata sandi yang kuat"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className="h-12 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {isMounted && formData.password && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Kekuatan Password:</span>
                        <span className={`text-xs font-medium ${
                          calculatePasswordStrength() < 40 ? 'text-red-500' : 
                          calculatePasswordStrength() < 80 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          {getPasswordStrengthText()}
                        </span>
                      </div>
                      <Progress 
                        value={calculatePasswordStrength()} 
                        className="h-2"
                      />
                    </div>
                  )}
                </div>

                {/* Password Criteria */}
                {isMounted && formData.password && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium text-slate-700 mb-2">Kriteria Password:</p>
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      {[
                        { key: 'length', text: 'Minimal 8 karakter' },
                        { key: 'uppercase', text: 'Huruf besar (A-Z)' },
                        { key: 'lowercase', text: 'Huruf kecil (a-z)' },
                        { key: 'number', text: 'Angka (0-9)' },
                        { key: 'special', text: 'Karakter khusus (!@#$...)' }
                      ].map(({ key, text }) => (
                        <div key={key} className="flex items-center gap-2">
                          {passwordCriteria[key as keyof PasswordCriteria] ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-400" />
                          )}
                          <span className={passwordCriteria[key as keyof PasswordCriteria] ? 'text-green-700' : 'text-slate-500'}>
                            {text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Konfirmasi Kata Sandi
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Ulangi kata sandi"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className={`h-12 pr-10 ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword 
                          ? 'border-red-300' : 
                          formData.confirmPassword && formData.password === formData.confirmPassword 
                            ? 'border-green-300' : ''
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {isMounted && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Kata sandi tidak cocok
                    </p>
                  )}
                </div>

                {/* Terms and Marketing */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="terms" 
                      checked={formData.agreeToTerms}
                      onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                      className="mt-1"
                    />
                    <Label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed">
                      Saya setuju dengan{" "}
                      <Link href="/terms" className="text-blue-600 hover:underline font-medium">
                        syarat dan ketentuan
                      </Link>{" "}
                      serta{" "}
                      <Link href="/privacy" className="text-blue-600 hover:underline font-medium">
                        kebijakan privasi
                      </Link>
                    </Label>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="marketing" 
                      checked={formData.agreeToMarketing}
                      onCheckedChange={(checked) => handleInputChange("agreeToMarketing", checked as boolean)}
                      className="mt-1"
                    />
                    <Label htmlFor="marketing" className="text-sm text-slate-600 leading-relaxed">
                      Saya bersedia menerima informasi produk dan penawaran khusus via email
                    </Label>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmit} 
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl" 
                  disabled={loading || !validateStep2()}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? "Membuat Akun..." : "Buat Akun"}
                </Button>
              </div>
            )}
            
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-slate-600">
                Sudah punya akun?{" "}
                <Link 
                  href="/login" 
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Keamanan Data Terjamin</h4>
              <p className="text-xs text-blue-600 leading-relaxed">
                Semua data Anda dienkripsi dan disimpan dengan aman. Kami tidak akan membagikan informasi pribadi Anda kepada pihak ketiga.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;