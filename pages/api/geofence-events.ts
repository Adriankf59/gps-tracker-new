import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence_events';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save geofence event' });
  }
}
