// ─── Logout API for Vercel ──────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Clear session cookie
  res.setHeader('Set-Cookie', 'homestay_session=; HttpOnly; Max-Age=0; Path=/');

  return res.json({ success: true, data: {} });
}
