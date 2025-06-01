'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid'; // Pastikan menginstal: npm install uuid

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    nickname: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false
  });

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Kata sandi tidak cocok!");
      return;
    }
    
    if (!formData.agreeToTerms) {
      toast.error("Anda harus menyetujui syarat dan ketentuan!");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    
    setLoading(true);
    
    try {
      // Generate a unique user_id using UUID
      const userId = uuidv4();
      
      // Directus API endpoint
      const response = await fetch('http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // All fields at the top level (not nested in a data object)
          user_id: userId,
          username: formData.nickname,
          password_hash: formData.password,
          full_name: formData.fullName,
          email: formData.email,
          phone_number: formData.phoneNumber
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success('Registrasi berhasil! Silakan login.');
        // Navigate to login page
        router.push('/login');
      } else {
        console.error('Registration error:', result);
        toast.error(`Registrasi gagal: ${result.errors?.[0]?.message || 'Silakan coba lagi.'}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Terjadi kesalahan saat mengirim data. Silakan coba lagi.');
    }
    
    setLoading(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
            <CardTitle className="text-2xl">Buat Akun Baru</CardTitle>
            <CardDescription>
              Daftar untuk mulai mengelola kendaraan Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama Lengkap</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="Masukkan nickname"
                    value={formData.nickname}
                    onChange={(e) => handleInputChange("nickname", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Nomor Telepon</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Sandi</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimal 8 karakter"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
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
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Ulangi kata sandi"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm text-slate-600">
                  Saya setuju dengan{" "}
                  <Link href="#" className="text-blue-600 hover:underline">
                    syarat dan ketentuan
                  </Link>
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Daftar
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Sudah punya akun?{" "}
                <Link 
                  href="/login" 
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;