import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL = 'http://ec2-13-229-83-7.ap-southeast-1.compute.amazonaws.com:8055/items/commands';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid command ID' });
  }

  if (req.method === 'PATCH') {
    return handlePatch(id as string, req, res);
  } else if (req.method === 'GET') {
    return handleGet(id as string, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(id as string, res);
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
    return res.status(500).json({ error: err.message || 'Failed to update command' });
  }
}

async function handleDelete(id: string, res: NextApiResponse) {
  const response = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  const text = await response.text();
  return res.status(response.status).send(text);
}
