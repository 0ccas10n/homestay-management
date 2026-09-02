// ─── Rate Plan Prices API for Vercel ────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Generate rate plan prices for all rooms
function generateRatePlanPrices() {
  const rooms = [
    'ROOM-0001', 'ROOM-0002', 'ROOM-0003', 'ROOM-0004', 'ROOM-0005',
    'ROOM-0006', 'ROOM-0007', 'ROOM-0008', 'ROOM-0009', 'ROOM-0010',
    'ROOM-0011', 'ROOM-0012'
  ];
  const ratePlanPrices = [
    { ratePlanId: 'RP-0001', price: 250000 },
    { ratePlanId: 'RP-0002', price: 350000 },
    { ratePlanId: 'RP-0003', price: 400000 },
    { ratePlanId: 'RP-0004', price: 550000 },
  ];
  
  const result = [];
  let id = 1;
  for (const roomId of rooms) {
    for (const rp of ratePlanPrices) {
      result.push({
        ratePlanPriceId: `RPP-${String(id++).padStart(4, '0')}`,
        ratePlanId: rp.ratePlanId,
        roomId,
        priceVnd: rp.price,
        active: true,
      });
    }
  }
  return result;
}

const SAMPLE_RATES = generateRatePlanPrices();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  let rates = SAMPLE_RATES;
  
  // Filter by ratePlanId and roomId if provided
  if (req.query.ratePlanId) {
    rates = rates.filter(r => r.ratePlanId === req.query.ratePlanId);
  }
  if (req.query.roomId) {
    rates = rates.filter(r => r.roomId === req.query.roomId);
  }

  return res.json({ success: true, data: rates });
}
