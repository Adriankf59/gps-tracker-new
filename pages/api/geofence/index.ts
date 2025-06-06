import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/geofence';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const params = new URLSearchParams(req.query as any).toString();
    const url = `${BASE_URL}?${params}`;
    const response = await fetch(url);
    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch geofences' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create geofence' });
  }
}
