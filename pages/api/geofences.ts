import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Geofences API called with method:', req.method);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id } = req.query;
    const { API_BASE_URL } = await import('../../api/file');

    const params = new URLSearchParams();
    if (user_id) {
      params.set('filter[user_id][_eq]', String(user_id));
    }
    params.set('limit', '-1');
    params.set('sort', '-date_created');

    const url = `${API_BASE_URL}/items/geofence?${params.toString()}`;
    console.log('Fetching geofences from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('External geofences API error:', text);
      throw new Error(`Failed to fetch geofences: ${response.status}`);
    }

    const data = await response.json();
    console.log('Geofences received:', data.data?.length || 0);

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Geofences API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch geofences',
      message: error.message,
    });
  }
}
