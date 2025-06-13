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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin, Eye, EyeOff, Loader2, CheckCircle, XCircle, Shield, 
  Mail, Phone, User, Lock, ArrowRight, AlertCircle, Calendar,
  Building2, Home, CreditCard, Info
} from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

interface FormData {
  // Personal Information
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  
  // Account Information
  username: string;
  password: string;
  confirmPassword: string;
  
  // Company Information (optional)
  companyName: string;
  companyRole: string;
  fleetSize: string;
  
  // Agreements
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

interface InputState {
  focused: string;
  touched: Set<string>;
  errors: Record<string, string>;
}

const RegisterPage = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Form Data
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: "",
    username: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    companyRole: "",
    fleetSize: "",
    agreeToTerms: false,
    agreeToMarketing: false
  });

  // Input States - Following Core States Principle
  const [inputState, setInputState] = useState<InputState>({
    focused: "",
    touched: new Set(),
    errors: {}
  });

  // Password Criteria
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Email validation state
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Component mounting
  useEffect(() => {
    setIsMounted(true);
    const animationTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(animationTimer);
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
    if (formData.email && inputState.touched.has('email')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValid(emailRegex.test(formData.email));
    } else {
      setEmailValid(null);
    }
  }, [formData.email, inputState.touched]);

  // Username availability check (simulated)
  useEffect(() => {
    if (formData.username && inputState.touched.has('username')) {
      // Simulate API check
      const timer = setTimeout(() => {
        // Mock unavailable usernames
        const unavailable = ['admin', 'user', 'test'];
        setUsernameAvailable(!unavailable.includes(formData.username.toLowerCase()));
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailable(null);
    }
  }, [formData.username, inputState.touched]);

  // Input field handlers
  const handleFocus = (field: string) => {
    setInputState(prev => ({
      ...prev,
      focused: field
    }));
  };

  const handleBlur = (field: string) => {
    setInputState(prev => ({
      ...prev,
      focused: "",
      touched: new Set([...prev.touched, field])
    }));
    
    // Validate on blur
    validateField(field);
  };

  const validateField = (field: string) => {
    const errors = { ...inputState.errors };
    
    switch (field) {
      case 'fullName':
        if (!formData.fullName.trim()) {
          errors.fullName = 'Nama lengkap wajib diisi';
        } else {
          delete errors.fullName;
        }
        break;
        
      case 'email':
        if (!formData.email) {
          errors.email = 'Email wajib diisi';
        } else if (emailValid === false) {
          errors.email = 'Format email tidak valid';
        } else {
          delete errors.email;
        }
        break;
        
      case 'phoneNumber':
        if (!formData.phoneNumber) {
          errors.phoneNumber = 'Nomor telepon wajib diisi';
        } else if (formData.phoneNumber.replace(/\D/g, '').length < 10) {
          errors.phoneNumber = 'Nomor telepon tidak valid';
        } else {
          delete errors.phoneNumber;
        }
        break;
        
      case 'username':
        if (!formData.username) {
          errors.username = 'Username wajib diisi';
        } else if (formData.username.length < 3) {
          errors.username = 'Username minimal 3 karakter';
        } else if (usernameAvailable === false) {
          errors.username = 'Username sudah digunakan';
        } else {
          delete errors.username;
        }
        break;
        
      case 'confirmPassword':
        if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Password tidak cocok';
        } else {
          delete errors.confirmPassword;
        }
        break;
    }
    
    setInputState(prev => ({
      ...prev,
      errors
    }));
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 4) return numbers;
    if (numbers.length <= 8) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}-${numbers.slice(8, 12)}`;
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    if (field === 'phoneNumber' && typeof value === 'string') {
      const formatted = formatPhoneNumber(value);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.fullName.trim() && 
                 emailValid && 
                 formData.phoneNumber.trim() &&
                 formData.dateOfBirth);
      case 2:
        return !!(formData.username.trim() &&
                 usernameAvailable &&
                 Object.values(passwordCriteria).every(Boolean) &&
                 formData.password === formData.confirmPassword);
      case 3:
        return formData.agreeToTerms;
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(3)) {
      toast.error("Pastikan semua field telah diisi dengan benar!");
      return;
    }
    
    setLoading(true);
    
    try {
      const userId = uuidv4();
      
      const requestData = {
        user_id: userId,
        username: formData.username,
        password_hash: formData.password,
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formData.phoneNumber.replace(/\D/g, ''),
        date_of_birth: formData.dateOfBirth,
        company_name: formData.companyName || null,
        company_role: formData.companyRole || null,
        fleet_size: formData.fleetSize || null,
        marketing_consent: formData.agreeToMarketing
      };

      console.log('Sending registration data:', requestData);
      
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
        setTimeout(() => {
          router.push('/login?registered=true');
        }, 1500);
      } else {
        toast.error(result.message || 'Registrasi gagal. Silakan coba lagi.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Terjadi kesalahan koneksi. Silakan coba lagi.');
    }
    
    setLoading(false);
  };

  const getInputStateClass = (field: string) => {
    const isFocused = inputState.focused === field;
    const isTouched = inputState.touched.has(field);
    const hasError = inputState.errors[field];
    
    if (isFocused) return 'ring-2 ring-blue-500 border-blue-500';
    if (hasError && isTouched) return 'border-red-500';
    if (isTouched && !hasError) return 'border-green-500';
    return 'border-gray-300';
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800">Informasi Pribadi</h3>
              <p className="text-sm text-slate-600 mt-1">Lengkapi data diri Anda</p>
            </div>

            {/* Full Name Input */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-slate-600" />
                Nama Lengkap
              </Label>
              <div className="relative">
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Masukkan nama lengkap Anda"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  onFocus={() => handleFocus('fullName')}
                  onBlur={() => handleBlur('fullName')}
                  className={`h-12 pl-4 pr-10 transition-all duration-200 ${getInputStateClass('fullName')}`}
                  required
                />
                {inputState.touched.has('fullName') && formData.fullName && !inputState.errors.fullName && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
              {inputState.errors.fullName && inputState.touched.has('fullName') && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {inputState.errors.fullName}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="w-4 h-4 text-slate-600" />
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onFocus={() => handleFocus('email')}
                  onBlur={() => handleBlur('email')}
                  className={`h-12 pl-4 pr-10 transition-all duration-200 ${getInputStateClass('email')}`}
                  required
                />
                {emailValid !== null && inputState.touched.has('email') && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailValid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Email akan digunakan untuk notifikasi dan pemulihan akun
              </p>
              {inputState.errors.email && inputState.touched.has('email') && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {inputState.errors.email}
                </p>
              )}
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="flex items-center gap-2 text-sm font-medium">
                <Phone className="w-4 h-4 text-slate-600" />
                Nomor Telepon
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                  <img src="https://flagcdn.com/w20/id.png" alt="ID" className="w-5 h-3 mr-2" />
                  <span className="text-sm text-slate-600">+62</span>
                </div>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="812-3456-7890"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  onFocus={() => handleFocus('phoneNumber')}
                  onBlur={() => handleBlur('phoneNumber')}
                  className={`h-12 pl-20 pr-10 transition-all duration-200 ${getInputStateClass('phoneNumber')}`}
                  maxLength={13}
                  required
                />
                {inputState.touched.has('phoneNumber') && formData.phoneNumber && !inputState.errors.phoneNumber && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
              <p className="text-xs text-slate-500">
                Format: 812-3456-7890
              </p>
              {inputState.errors.phoneNumber && inputState.touched.has('phoneNumber') && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {inputState.errors.phoneNumber}
                </p>
              )}
            </div>

            {/* Date of Birth Input */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="w-4 h-4 text-slate-600" />
                Tanggal Lahir
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                onFocus={() => handleFocus('dateOfBirth')}
                onBlur={() => handleBlur('dateOfBirth')}
                className={`h-12 px-4 transition-all duration-200 ${getInputStateClass('dateOfBirth')}`}
                max={new Date().toISOString().split('T')[0]}
                required
              />
              <p className="text-xs text-slate-500">
                Anda harus berusia minimal 18 tahun
              </p>
            </div>

            <Button 
              onClick={() => setCurrentStep(2)}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
              disabled={!validateStep(1)}
            >
              Lanjutkan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800">Keamanan Akun</h3>
              <p className="text-sm text-slate-600 mt-1">Buat kredensial untuk akun Anda</p>
            </div>

            {/* Username Input */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-slate-600" />
                Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="Pilih username unik"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value.toLowerCase())}
                  onFocus={() => handleFocus('username')}
                  onBlur={() => handleBlur('username')}
                  className={`h-12 pl-4 pr-10 transition-all duration-200 ${getInputStateClass('username')}`}
                  required
                />
                {usernameAvailable !== null && inputState.touched.has('username') && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameAvailable ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Username akan digunakan untuk login (huruf kecil, tanpa spasi)
              </p>
              {inputState.errors.username && inputState.touched.has('username') && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {inputState.errors.username}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                <Lock className="w-4 h-4 text-slate-600" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Buat password yang kuat"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  onFocus={() => handleFocus('password')}
                  onBlur={() => handleBlur('password')}
                  className={`h-12 pl-4 pr-10 transition-all duration-200 ${getInputStateClass('password')}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.password && (
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
                  
                  {/* Password Criteria */}
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    {[
                      { key: 'length', text: 'Min. 8 karakter' },
                      { key: 'uppercase', text: 'Huruf besar' },
                      { key: 'lowercase', text: 'Huruf kecil' },
                      { key: 'number', text: 'Angka' },
                      { key: 'special', text: 'Karakter khusus' }
                    ].map(({ key, text }) => (
                      <div key={key} className="flex items-center gap-2">
                        {passwordCriteria[key as keyof PasswordCriteria] ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <CircleIcon className="w-3 h-3 text-gray-300" />
                        )}
                        <span className={passwordCriteria[key as keyof PasswordCriteria] ? 'text-green-700' : 'text-gray-500'}>
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-medium">
                <Shield className="w-4 h-4 text-slate-600" />
                Konfirmasi Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ulangi password Anda"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  onFocus={() => handleFocus('confirmPassword')}
                  onBlur={() => handleBlur('confirmPassword')}
                  className={`h-12 pl-4 pr-10 transition-all duration-200 ${getInputStateClass('confirmPassword')}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {inputState.errors.confirmPassword && inputState.touched.has('confirmPassword') && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {inputState.errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="flex-1 h-12"
              >
                Kembali
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                disabled={!validateStep(2)}
              >
                Lanjutkan
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800">Informasi Tambahan</h3>
              <p className="text-sm text-slate-600 mt-1">Opsional: Informasi perusahaan Anda</p>
            </div>

            {/* Company Name Input (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="w-4 h-4 text-slate-600" />
                Nama Perusahaan
                <span className="text-xs text-slate-500">(Opsional)</span>
              </Label>
              <Input
                id="companyName"
                type="text"
                placeholder="PT. Contoh Logistics"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                onFocus={() => handleFocus('companyName')}
                onBlur={() => handleBlur('companyName')}
                className={`h-12 px-4 transition-all duration-200 ${getInputStateClass('companyName')}`}
              />
            </div>

            {/* Company Role Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="companyRole" className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-slate-600" />
                Jabatan
                <span className="text-xs text-slate-500">(Opsional)</span>
              </Label>
              <Select
                value={formData.companyRole}
                onValueChange={(value) => handleInputChange("companyRole", value)}
              >
                <SelectTrigger 
                  id="companyRole"
                  className={`h-12 transition-all duration-200 ${
                    inputState.focused === 'companyRole' ? 'ring-2 ring-blue-500 border-blue-500' : ''
                  }`}
                  onFocus={() => handleFocus('companyRole')}
                  onBlur={() => handleBlur('companyRole')}
                >
                  <SelectValue placeholder="Pilih jabatan Anda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Pemilik Usaha</SelectItem>
                  <SelectItem value="manager">Fleet Manager</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fleet Size Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="fleetSize" className="flex items-center gap-2 text-sm font-medium">
                <Car className="w-4 h-4 text-slate-600" />
                Jumlah Kendaraan
                <span className="text-xs text-slate-500">(Opsional)</span>
              </Label>
              <Select
                value={formData.fleetSize}
                onValueChange={(value) => handleInputChange("fleetSize", value)}
              >
                <SelectTrigger 
                  id="fleetSize"
                  className={`h-12 transition-all duration-200 ${
                    inputState.focused === 'fleetSize' ? 'ring-2 ring-blue-500 border-blue-500' : ''
                  }`}
                  onFocus={() => handleFocus('fleetSize')}
                  onBlur={() => handleBlur('fleetSize')}
                >
                  <SelectValue placeholder="Pilih jumlah armada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-5">1-5 Kendaraan</SelectItem>
                  <SelectItem value="6-10">6-10 Kendaraan</SelectItem>
                  <SelectItem value="11-25">11-25 Kendaraan</SelectItem>
                  <SelectItem value="26-50">26-50 Kendaraan</SelectItem>
                  <SelectItem value="50+">Lebih dari 50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Terms and Marketing Checkboxes */}
            <div className="space-y-3 pt-4">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="terms" 
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                  className="mt-1"
                />
                <Label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
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
                <Label htmlFor="marketing" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                  Saya ingin menerima informasi produk, tips, dan penawaran khusus via email
                </Label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => setCurrentStep(2)}
                variant="outline"
                className="flex-1 h-12"
              >
                Kembali
              </Button>
              <Button 
                onClick={handleSubmit} 
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl" 
                disabled={loading || !validateStep(3)}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? "Membuat Akun..." : "Buat Akun"}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
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
      
      <div className={`w-full max-w-lg transition-all duration-1000 ${isMounted && isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-all duration-300 group">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Vehitack
              </h1>
              <p className="text-sm text-slate-500">Vehicle Management System</p>
            </div>
          </Link>
        </div>

        <Card className="shadow-xl border-0 backdrop-blur-sm bg-white/90">
          <CardHeader className="text-center pb-4">
            {/* Progress Steps */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-3">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                        currentStep >= step 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {currentStep > step ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step
                      )}
                    </div>
                    {step < 3 && (
                      <div 
                        className={`w-12 h-1 transition-all duration-300 ${
                          currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <CardTitle className="text-2xl mb-2">
              Buat Akun Baru
            </CardTitle>
            <CardDescription>
              Langkah {currentStep} dari 3
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="w-full">
              {renderStep()}
            </form>
            
            <div className="text-center pt-6 mt-6 border-t">
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

        {/* Security & Privacy Notice */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Keamanan Data Terjamin</h4>
              <p className="text-xs text-blue-600 leading-relaxed">
                Data Anda dienkripsi dengan standar industri. Kami mematuhi GDPR dan tidak akan membagikan informasi pribadi Anda tanpa persetujuan.
              </p>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-600">
            Butuh bantuan?{" "}
            <Link href="/help" className="text-blue-600 hover:underline">
              Hubungi support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;