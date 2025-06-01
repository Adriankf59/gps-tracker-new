// lib/alertService.ts

export interface Alert {
  vehicle_id: string;
  alert_type: string;
  alert_message: string;
  lokasi: string;
  timestamp: string;
}

const ALERTS_API_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/alerts';

export const saveAlert = async (alert: Alert) => {
  try {
    const response = await fetch(ALERTS_API_URL, {
      method: 'POST',
      headers: {
