'use client';

import React, { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, Eye, EyeOff, Loader2, Clock, Mail } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  password_hash: string;
  // Jika API mengembalikan properti lain (misalnya: name), tambahkan di sini
}

interface GenerateOTPResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
}

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showOtpStep, setShowOtpStep] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [tempUser, setTempUser] = useState<User | null>(null);

  const router = useRouter();

  // Countdown timer for resend OTP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        "http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/users"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      const users: User[] = Array.isArray(data.data) ? data.data : [];

      // Cari user dengan email + password yang cocok
      const user = users.find(
        (u: User) => u.email === email && u.password_hash === password
      );

      if (user) {
        setTempUser(user);

        // Kirim OTP ke email
        await sendOTP(user.id, email);

        // Tampilkan langkah verifikasi OTP
        setShowOtpStep(true);
        setCountdown(60); // Mulai hitung mundur 60 detik
      } else {
        toast.error("Email atau password tidak valid");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login gagal. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (userId: string, userEmail: string) => {
    try {
      const response = await fetch("/api/auth/generateOTP", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          userId: userId,
        }),
      });

      const result: GenerateOTPResponse = await response.json();

      if (result.success) {
        toast.success("Kode OTP telah dikirim ke email Anda");
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast.error("Gagal mengirim OTP. Silakan coba lagi.");
      // Lanjutkan lempar supaya handleLogin memahami kegagalan
      throw error;
    }
  };

  const handleOtpVerification = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (tempUser === null) {
      toast.error("Terjadi kesalahan internal. Silakan coba login ulang.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/verifyOTP", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          otp: otp,
          userId: tempUser.id,
        }),
      });

      const result: VerifyOTPResponse = await response.json();

      if (result.success) {
        // Simpan data user ke sessionStorage
        sessionStorage.setItem("user", JSON.stringify(tempUser));
        toast.success("Login berhasil!");

        // Beri sedikit delay agar penyimpanan selesai
        setTimeout(() => {
          router.push("/dashboard");
        }, 100);
      } else {
        toast.error(result.message || "Kode OTP tidak valid");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error("Verifikasi OTP gagal. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || tempUser === null) return;

    setResendLoading(true);
    try {
      await sendOTP(tempUser.id, email);
      setCountdown(60);
      toast.success("Kode OTP baru telah dikirim ke email Anda");
    } catch {
      toast.error("Gagal mengirim ulang OTP. Silakan coba lagi.");
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
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
              {showOtpStep ? "Verifikasi OTP" : "Selamat Datang Kembali"}
            </CardTitle>
            <CardDescription>
              {showOtpStep
                ? "Masukkan kode OTP yang telah dikirim ke email Anda"
                : "Masuk ke akun GPS Tracker Anda"}
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
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
                  {loading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
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
                    onChange={(e) => {
                      const onlyDigits = e.target.value.replace(/\D/g, "");
                      setOtp(onlyDigits);
                    }}
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                    required
                  />
                  <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                    <Mail className="w-4 h-4" />
                    <span>
                      Kode OTP dikirim ke{" "}
                      <span className="font-medium">{email}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Verifikasi OTP
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowOtpStep(false);
                        setOtp("");
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
                      {resendLoading && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {countdown > 0 ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(countdown)}
                        </div>
                      ) : (
                        "Kirim Ulang"
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
