'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, ArrowLeft, Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // TODO: Implement actual forgot password API call
      // Example API call structure:
      // const response = await fetch('/api/forgot-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email })
      // });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("Forgot password request for:", email);
      setIsSubmitted(true);
      toast.success('Link reset kata sandi telah dikirim ke email Anda');
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('Gagal mengirim email reset. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      // TODO: Implement resend email logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Email reset telah dikirim ulang');
    } catch (error) {
      toast.error('Gagal mengirim ulang email');
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-lg text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Email Terkirim!</CardTitle>
              <CardDescription>
                Kami telah mengirimkan link reset kata sandi ke email Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-6">
                Periksa kotak masuk Anda di <strong>{email}</strong> dan ikuti instruksi untuk mereset kata sandi.
              </p>
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link href="/login">Kembali ke Login</Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Kirim Ulang Email
                </Button>
              </div>
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
              <h1 className="text-2xl font-bold text-slate-800">GPS Tracker</h1>
              <p className="text-sm text-slate-500">Vehicle Management System</p>
            </div>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Lupa Kata Sandi?</CardTitle>
            <CardDescription>
              Masukkan email Anda dan kami akan mengirimkan link untuk mereset kata sandi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Kirim Link Reset
              </Button>
            </form>
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
      </div>
    </div>
  );
};

export default ForgotPasswordPage;