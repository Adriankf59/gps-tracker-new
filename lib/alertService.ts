// lib/alertService.ts

export interface Alert {
  vehicle_id: string;
  alert_type: string;
  alert_message: string;
  lokasi: string;
  timestamp: string;
}

import { API_BASE_URL } from '../api/file';

const ALERTS_API_URL = `${API_BASE_URL}/items/alerts`;

export const saveAlert = async (alert: Alert) => {
  try {
    const response = await fetch(ALERTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alert)
    });

    if (!response.ok) {
      throw new Error(`Failed to save alert: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving alert:', error);
    throw error;
  }
};

export const getAlerts = async () => {
  try {
    const response = await fetch(ALERTS_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw error;
  }
};
