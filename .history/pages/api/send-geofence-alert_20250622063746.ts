// pages/api/send-geofence-alert.ts

import type { NextApiRequest, NextApiResponse } from 'next';

// Email configuration
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || `"GPS Tracker Alert" <${EMAIL_USER}>`;

// Create reusable transporter
const createTransporter = async () => {
  // Dynamic import to handle module compatibility
  const nodemailer = await import('nodemailer');
  
  return nodemailer.default.createTransporter({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false // For development
    }
  });
};

interface EmailAlertRequest {
  to: string;
  vehicleName: string;
  licensePlate: string;
  geofenceName: string;
  violationType: 'violation_enter' | 'violation_exit' | 'violation_stay_out';
  location: string;
  timestamp: string;
  userName?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log untuk debugging
  console.log('Email API called');
  console.log('Request method:', req.method);
  console.log('Request body:', req.body);
  console.log('Email config:', {
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    user: EMAIL_USER,
    from: EMAIL_FROM,
    hasPassword: !!EMAIL_PASS
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      to,
      vehicleName,
      licensePlate,
      geofenceName,
      violationType,
      location,
      timestamp,
      userName
    } = req.body as EmailAlertRequest;

    // Validate required fields
    if (!to || !vehicleName || !geofenceName || !violationType) {
      console.error('Missing required fields:', { to, vehicleName, geofenceName, violationType });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check email configuration
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.error('Email configuration missing');
      return res.status(500).json({ error: 'Email configuration not set' });
    }

    // Format violation type for display
    const getViolationDescription = (type: string) => {
      switch (type) {
        case 'violation_enter':
          return 'memasuki area terlarang';
        case 'violation_exit':
          return 'keluar dari area yang ditentukan';
        case 'violation_stay_out':
          return 'berada di luar area yang ditentukan';
        default:
          return 'melakukan pelanggaran geofence';
      }
    };

    const violationDescription = getViolationDescription(violationType);
    const formattedTime = new Date(timestamp).toLocaleString('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    // Email HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 0;
          }
          .header {
            background-color: #dc2626;
            color: #ffffff;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .alert-icon {
            font-size: 48px;
            margin-bottom: 10px;
          }
          .content {
            padding: 30px;
          }
          .alert-box {
            background-color: #fee2e2;
            border: 2px solid #dc2626;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-label {
            font-weight: bold;
            color: #374151;
          }
          .info-value {
            color: #6b7280;
          }
          .map-button {
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
          }
          .footer {
            background-color: #f3f4f6;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="alert-icon">🚨</div>
            <h1>Pelanggaran Geofence Terdeteksi!</h1>
          </div>
          
          <div class="content">
            <div class="alert-box">
              <h2 style="margin-top: 0; color: #dc2626;">⚠️ Peringatan Penting</h2>
              <p style="font-size: 16px; margin: 0;">
                Kendaraan <strong>${vehicleName}</strong> (${licensePlate}) telah 
                <strong>${violationDescription}</strong> pada geofence <strong>${geofenceName}</strong>.
              </p>
            </div>
            
            <h3>Detail Pelanggaran:</h3>
            
            <div class="info-row">
              <span class="info-label">Kendaraan:</span>
              <span class="info-value">${vehicleName} (${licensePlate})</span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Geofence:</span>
              <span class="info-value">${geofenceName}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Jenis Pelanggaran:</span>
              <span class="info-value">${violationDescription}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Lokasi:</span>
              <span class="info-value">${location}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label">Waktu:</span>
              <span class="info-value">${formattedTime}</span>
            </div>
            
            <center>
              <a href="https://www.google.com/maps?q=${location}" class="map-button">
                📍 Lihat Lokasi di Peta
              </a>
            </center>
            
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Silakan segera periksa dan ambil tindakan yang diperlukan. 
              Anda dapat memantau kendaraan secara real-time melalui dashboard GPS Tracker.
            </p>
          </div>
          
          <div class="footer">
            <p>Email ini dikirim otomatis oleh sistem GPS Tracker.</p>
            <p>© 2024 VehiTrack. All rights reserved.</p>
            <p>Jika Anda tidak merasa mendaftar untuk layanan ini, silakan abaikan email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
PELANGGARAN GEOFENCE TERDETEKSI!

Kendaraan ${vehicleName} (${licensePlate}) telah ${violationDescription} pada geofence ${geofenceName}.

Detail Pelanggaran:
- Kendaraan: ${vehicleName} (${licensePlate})
- Geofence: ${geofenceName}
- Jenis Pelanggaran: ${violationDescription}
- Lokasi: ${location}
- Waktu: ${formattedTime}

Lihat lokasi di peta: https://www.google.com/maps?q=${location}

Silakan segera periksa dan ambil tindakan yang diperlukan.

---
Email ini dikirim otomatis oleh sistem GPS Tracker.
    `;

    console.log('Creating transporter...');
    const transporter = await createTransporter();

    console.log('Sending email to:', to);
    
    // Send email
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: to,
      subject: `🚨 Pelanggaran Geofence - ${vehicleName} (${licensePlate})`,
      text: textContent,
      html: htmlContent,
    });

    console.log('Email sent successfully:', info.messageId);

    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}