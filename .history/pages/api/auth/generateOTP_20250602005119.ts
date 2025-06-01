// pages/api/auth/generateOTP.ts
import { NextApiRequest, NextApiResponse } from "next";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Definisikan tipe response agar lebih jelas
interface GenerateOTPResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateOTPResponse>
) {
  console.log("🚀 Generate OTP API called");

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed", success: false });
  }

  const { email, userId } = req.body;
  console.log("📨 Request data:", { email, userId });

  if (!email || !userId) {
    return res
      .status(400)
      .json({ message: "Email and userId are required", success: false });
  }

  // Check environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ Email credentials missing");
    return res.status(500).json({
      success: false,
      message: "Email configuration missing",
    });
  }

  try {
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    console.log("🔢 Generated OTP:", otp);

    // Create OTP key with userId for security
    const otpKey = `otp:${userId}:${email}`;
    console.log("🔑 OTP Key:", otpKey);

    // Store OTP in Redis with 5 minutes expiration (300 seconds)
    const redisResult = await redis.setex(otpKey, 300, otp);
    console.log("💾 Redis storage result:", redisResult);

    // Configure Nodemailer
    console.log("📬 Configuring email transporter...");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    console.log("🔍 Verifying email configuration...");
    await transporter.verify();
    console.log("✅ Email transporter verified successfully");

    // Email template
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">GPS Tracker</h1>
          <p style="color: white; margin: 10px 0 0 0;">Vehicle Management System</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Kode Verifikasi OTP</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            Halo,<br><br>
            Anda telah meminta untuk masuk ke akun GPS Tracker Anda. 
            Gunakan kode OTP berikut untuk menyelesaikan proses login:
          </p>
          
          <div style="background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #667eea; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            <strong>Penting:</strong>
          </p>
          <ul style="color: #666; font-size: 14px;">
            <li>Kode ini akan expired dalam <strong>5 menit</strong></li>
            <li>Jangan bagikan kode ini kepada siapapun</li>
            <li>Jika Anda tidak meminta kode ini, abaikan email ini</li>
          </ul>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 GPS Tracker. All rights reserved.</p>
        </div>
      </div>
    `;

    console.log("📧 Sending email...");

    // Send OTP email
    const emailResult = await transporter.sendMail({
      from: `GPS Tracker <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Kode Verifikasi OTP - GPS Tracker",
      html: emailHtml,
      text: `Kode OTP Anda adalah: ${otp}. Kode ini akan expired dalam 5 menit.`,
    });

    console.log("✅ Email sent successfully:", emailResult.messageId);

    return res.status(200).json({
      success: true,
      message: "OTP berhasil dikirim ke email Anda",
      messageId: emailResult.messageId,
    });
  } catch (err) {
    // Gunakan unknown alias, lalu lakukan pengecekan sebelum mengakses .message
    console.error("❌ Error in generateOTP:", err);

    const message =
      err instanceof Error ? err.message : "Unknown error saat mengirim OTP";

    return res.status(500).json({
      success: false,
      message: `Gagal mengirim OTP: ${message}`,
    });
  }
}
