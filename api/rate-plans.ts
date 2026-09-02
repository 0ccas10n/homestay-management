// ─── Rate Plans API for Vercel ───────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_RATE_PLANS = [
  { ratePlanId: 'RP-0001', name: 'Combo 4H', type: 'hourly', baseMinutes: 240, baseAmount: 250000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0002', name: 'Combo 6H', type: 'hourly', baseMinutes: 360, baseAmount: 350000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0003', name: 'Overnight', type: 'overnight', baseMinutes: 780, baseAmount: 400000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '21:00', overnightEnd: '10:00', active: true },
  { ratePlanId: 'RP-0004', name: 'Full Day', type: 'daily', baseMinutes: 1320, baseAmount: 550000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '14:00', overnightEnd: '12:00', active: true },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  return res.json({ success: true, data: SAMPLE_RATE_PLANS });
}
