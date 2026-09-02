// ─── Cleaning API for Vercel ────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_CLEANING = [
  { cleaningId: 'CLN-0001', roomId: 'ROOM-0003', bookingId: 'BOOK-0010', scheduledAt: '2026-08-02T12:00:00+07:00', status: 'pending', priority: 'high', note: 'After James Whitfield checkout; next guest Priya Sharma arrives Aug 9' },
  { cleaningId: 'CLN-0002', roomId: 'ROOM-0011', bookingId: undefined, scheduledAt: '2026-08-08T12:00:00+07:00', status: 'in_progress', priority: 'high', assignedTo: 'Maria Santos', startedAt: '2026-08-07T09:30:00+07:00', note: 'After Carlos Mendes checkout; next guest TBD' },
  { cleaningId: 'CLN-0003', roomId: 'ROOM-0004', bookingId: undefined, scheduledAt: '2026-08-05T12:00:00+07:00', status: 'pending', priority: 'medium' },
  { cleaningId: 'CLN-0004', roomId: 'ROOM-0009', bookingId: 'BOOK-0008', scheduledAt: '2026-08-13T12:00:00+07:00', status: 'pending', priority: 'medium', note: 'After Carlos Mendes checkout' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method === 'GET') {
    let tasks = SAMPLE_CLEANING;
    
    if (req.query.status) {
      tasks = tasks.filter(t => t.status === req.query.status);
    }

    return res.json({ success: true, data: tasks });
  }

  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
}
