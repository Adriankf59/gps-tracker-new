// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
// impor utilitas lain yang diperlukan, misal cek kredensial, dll.

interface LoginResponse {
  success: boolean;
  message: string;
  // tambahkan field lain jika perlu
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email, password } = req.body;
  // Lakukan cek kredensial user di database Anda
  // Contoh sederhana:
  if (email === "demo@example.com" && password === "secret") {
    return res.status(200).json({ success: true, message: "Login berhasil" });
  } else {
    return res.status(401).json({ success: false, message: "Email atau password salah" });
  }
}
