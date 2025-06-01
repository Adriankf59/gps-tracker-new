// pages/api/upload.ts (Temporary simple version without formidable)
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return a placeholder response
    // This will be implemented later when formidable is installed
    console.log('Upload API called - temporarily disabled');
    
    return res.status(200).json({
      message: 'Photo upload temporarily disabled',
      id: null
    });
  } catch (error: any) {
    console.error('Upload API Error:', error);
    return res.status(500).json({
      error: 'Failed to upload file',
      message: error.message
    });
  }
}