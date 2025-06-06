import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query;
  if (!user_id || Array.isArray(user_id)) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  const directusUrl = process.env.API_URL;
  if (!directusUrl) {
    return res.status(500).json({ error: 'Missing API_URL' });
  }

  try {
    const response = await fetch(`${directusUrl}/items/users/${user_id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile', message: error.message });
  }
}

export const config = { api: { bodyParser: false } };
