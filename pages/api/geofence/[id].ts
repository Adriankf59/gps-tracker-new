import type { NextApiRequest, NextApiResponse } from 'next';
import { DIRECTUS_BASE_URL } from '../config';

const BASE_URL = `${DIRECTUS_BASE_URL}/items/geofence`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid geofence ID' });
  }

  if (req.method === 'PATCH') {
    return handlePatch(id as string, req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(id as string, res);
  } else if (req.method === 'GET') {
    return handleGet(id as string, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(id: string, res: NextApiResponse) {
  const response = await fetch(`${BASE_URL}/${id}`);
  const text = await response.text();
  return res.status(response.status).send(text);
}

async function handlePatch(id: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update geofence' });
  }
}

async function handleDelete(id: string, res: NextApiResponse) {
  const response = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  const text = await response.text();
  return res.status(response.status).send(text);
}
