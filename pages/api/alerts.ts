import type { NextApiRequest, NextApiResponse } from 'next';
import { DIRECTUS_BASE_URL } from './config';

// Interface untuk Alert data
interface Alert {
  alert_id: number;
  vehicle_id: number;
  alert_type: string | null;
  alert_message: string | null;
  lokasi: string | null;
  timestamp: string | null;
}

interface AlertsResponse {
  data: Alert[];
}

interface ApiResponse {
  success: boolean;
  data?: Alert[];
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  console.log('🚨 Alerts API called');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Get query parameters
    const { limit = '3' } = req.query;
    const alertLimit = parseInt(limit as string, 10);

    console.log(`📊 Fetching alerts with limit: ${alertLimit}`);

    // Fetch data dari Directus API
    const response = await fetch(`${DIRECTUS_BASE_URL}/items/alerts?limit=-1&sort=-alert_id`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.status} ${response.statusText}`);
    }

    const alertsData: AlertsResponse = await response.json();
    console.log(`✅ Fetched ${alertsData.data.length} total alerts`);

    // Filter alerts yang memiliki data valid dan ambil yang terbaru
    const validAlerts = alertsData.data
      .filter(alert => 
        alert.alert_message && 
        alert.alert_type && 
        alert.timestamp &&
        alert.alert_message.trim() !== '' &&
        alert.alert_type.trim() !== ''
      )
      .slice(0, alertLimit); // Ambil sesuai limit yang diminta

    console.log(`📋 Returning ${validAlerts.length} valid alerts`);

    // Log sample data for debugging
    if (validAlerts.length > 0) {
      console.log('📝 Sample alert:', {
        alert_id: validAlerts[0].alert_id,
        alert_type: validAlerts[0].alert_type,
        message: validAlerts[0].alert_message?.substring(0, 50) + '...',
        timestamp: validAlerts[0].timestamp
      });
    }

    return res.status(200).json({
      success: true,
      data: validAlerts
    });

  } catch (error) {
    console.error('❌ Alerts API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });

    if (error instanceof Error) {
      if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
        return res.status(503).json({
          success: false,
          message: 'Tidak dapat terhubung ke server alerts. Pastikan koneksi internet Anda stabil.',
          error: 'CONNECTION_FAILED'
        });
      }
      
      if (error.message.includes('timeout')) {
        return res.status(408).json({
          success: false,
          message: 'Request timeout. Silakan coba lagi.',
          error: 'REQUEST_TIMEOUT'
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server. Silakan coba lagi nanti.',
      error: 'INTERNAL_ERROR'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};