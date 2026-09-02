// ─── Customers API for Vercel ────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_CUSTOMERS = [
  { customerId: 'CUS-0001', name: 'Nadia Okonkwo', source: 'FACEBOOK', email: 'nadia.okonkwo@gmail.com', note: 'Prefers high floor rooms' },
  { customerId: 'CUS-0002', name: 'Marcus Chen', source: 'INSTAGRAM', email: 'marcus.chen@outlook.com' },
  { customerId: 'CUS-0003', name: 'Elena Vasquez', source: 'TIKTOK', email: 'elena.v@gmail.com' },
  { customerId: 'CUS-0004', name: 'James Whitfield', source: 'ZALO', email: 'j.whitfield@company.com', note: 'Business traveler, early check-in requested' },
  { customerId: 'CUS-0005', name: 'Aisha Rahman', source: 'FACEBOOK', email: 'aisha.r@yahoo.com' },
  { customerId: 'CUS-0006', name: 'Tomás Eriksson', source: 'INSTAGRAM', email: 'tomas.e@hotmail.com' },
  { customerId: 'CUS-0007', name: 'Priya Sharma', source: 'TIKTOK', email: 'priya.s@gmail.com' },
  { customerId: 'CUS-0008', name: 'Carlos Mendes', source: 'ZALO', email: 'carlos.m@gmail.com' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  return res.json({ success: true, data: SAMPLE_CUSTOMERS });
}
