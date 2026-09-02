// ─── Locations API for Vercel ───────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_LOCATIONS = [
  { locationId: 'LOC-0001', name: 'Bình Lợi Trung', description: 'Cụm homestay Bình Lợi Trung', publicAddress: 'Bình Lợi Trung, Bình Chánh, Hồ Chí Minh', phone: '+84 28 0000 0001', active: true },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  return res.json({ success: true, data: SAMPLE_LOCATIONS });
}
