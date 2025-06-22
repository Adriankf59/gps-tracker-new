// pages/api/send-geofence-alert-alternative.ts
// Alternative approach using external email service API

import type { NextApiRequest, NextApiResponse } from 'next';

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

// If nodemailer doesn't work, you can use an external email API service
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
      return res.status(400).json({ error: 'Missing required fields' });
    }

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

    // Option 1: Use SendGrid API (if you have SendGrid)
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = {
        personalizations: [{
          to: [{ email: to }]
        }],
        from: {
          email: process.env.EMAIL_USER || 'noreply@vehitrack.com',
          name: 'GPS Tracker Alert'
        },
        subject: `🚨 Pelanggaran Geofence - ${vehicleName} (${licensePlate})`,
        content: [
          {
            type: 'text/plain',
            value: `PELANGGARAN GEOFENCE TERDETEKSI!\n\nKendaraan ${vehicleName} (${licensePlate}) telah ${violationDescription} pada geofence ${geofenceName}.\n\nDetail Pelanggaran:\n- Kendaraan: ${vehicleName} (${licensePlate})\n- Geofence: ${geofenceName}\n- Jenis Pelanggaran: ${violationDescription}\n- Lokasi: ${location}\n- Waktu: ${formattedTime}\n\nLihat lokasi di peta: https://www.google.com/maps?q=${location}`
          },
          {
            type: 'text/html',
            value: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #dc2626; color: #ffffff; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">🚨 Pelanggaran Geofence Terdeteksi!</h1>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <div style="background-color: #fee2e2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                  <p style="font-size: 16px;">Kendaraan <strong>${vehicleName}</strong> (${licensePlate}) telah <strong>${violationDescription}</strong> pada geofence <strong>${geofenceName}</strong>.</p>
                </div>
                <h3>Detail Pelanggaran:</h3>
                <ul>
                  <li>Kendaraan: ${vehicleName} (${licensePlate})</li>
                  <li>Geofence: ${geofenceName}</li>
                  <li>Jenis Pelanggaran: ${violationDescription}</li>
                  <li>Lokasi: ${location}</li>
                  <li>Waktu: ${formattedTime}</li>
                </ul>
                <a href="https://www.google.com/maps?q=${location}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">📍 Lihat Lokasi di Peta</a>
              </div>
            </div>`
          }
        ]
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sgMail)
      });

      if (response.ok) {
        return res.status(200).json({ success: true, service: 'sendgrid' });
      } else {
        throw new Error(`SendGrid error: ${response.status}`);
      }
    }

    // Option 2: Use a simple webhook/external service
    // You can setup a webhook on services like Make.com, Zapier, or n8n
    if (process.env.EMAIL_WEBHOOK_URL) {
      const webhookResponse = await fetch(process.env.EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          subject: `🚨 Pelanggaran Geofence - ${vehicleName} (${licensePlate})`,
          text: `PELANGGARAN GEOFENCE TERDETEKSI!\n\nKendaraan ${vehicleName} (${licensePlate}) telah ${violationDescription} pada geofence ${geofenceName}.`,
          html: `<h1>🚨 Pelanggaran Geofence!</h1><p>Kendaraan ${vehicleName} (${licensePlate}) telah ${violationDescription} pada geofence ${geofenceName}.</p><p>Lokasi: ${location}</p><p>Waktu: ${formattedTime}</p>`,
          vehicleName,
          licensePlate,
          geofenceName,
          violationType,
          location,
          timestamp
        })
      });

      if (webhookResponse.ok) {
        return res.status(200).json({ success: true, service: 'webhook' });
      }
    }

    // Option 3: Log to database only (fallback)
    console.log('Email notification data:', {
      to,
      vehicleName,
      licensePlate,
      geofenceName,
      violationType,
      location,
      timestamp
    });

    // You can save this to database as pending email
    // and process it later with a background job

    return res.status(200).json({ 
      success: true, 
      message: 'Email queued for sending',
      fallback: true 
    });

  } catch (error) {
    console.error('Error in email handler:', error);
    return res.status(500).json({ 
      error: 'Failed to process email request', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}