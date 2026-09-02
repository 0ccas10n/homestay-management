// ─── Notifications API for Vercel ───────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_NOTIFICATIONS = [
  { notificationId: 'NOT-0001', type: 'check_in', title: 'Check-in Today', message: 'Tomás Eriksson arriving for Hiên 2 at 2:00 PM', time: '2026-08-07T12:00:00+07:00', read: false, priority: 'high', relatedBookingId: 'BOOK-0006', relatedRoomId: 'ROOM-0002' },
  { notificationId: 'NOT-0002', type: 'check_out', title: 'Check-out Today', message: 'James Whitfield (Yên 7) checks out today by 11 AM', time: '2026-08-07T08:00:00+07:00', read: false, priority: 'high', relatedBookingId: 'BOOK-0004', relatedRoomId: 'ROOM-0010' },
  { notificationId: 'NOT-0003', type: 'cleaning', title: 'Urgent Cleaning', message: 'Hiên 3 needs cleaning — next guest arrives Aug 9', time: '2026-08-07T07:30:00+07:00', read: false, priority: 'high', relatedRoomId: 'ROOM-0003' },
  { notificationId: 'NOT-0004', type: 'payment', title: 'Payment Pending', message: 'Nadia Okonkwo has an outstanding balance of 95.000 ₫', time: '2026-08-07T06:00:00+07:00', read: false, priority: 'medium', relatedBookingId: 'BOOK-0001' },
  { notificationId: 'NOT-0005', type: 'cleaning', title: 'Yên 8 In Progress', message: 'Maria Santos started cleaning Yên 8', time: '2026-08-07T09:30:00+07:00', read: true, priority: 'low', relatedRoomId: 'ROOM-0011' },
  { notificationId: 'NOT-0006', type: 'check_in', title: 'Upcoming Check-in', message: 'Priya Sharma arriving Aug 9 for Yên 5', time: '2026-08-06T10:00:00+07:00', read: true, priority: 'low', relatedBookingId: 'BOOK-0007', relatedRoomId: 'ROOM-0008' },
  { notificationId: 'NOT-0007', type: 'maintenance', title: 'Maintenance Alert', message: 'Yên 4 AC still out of service', time: '2026-08-05T08:00:00+07:00', read: true, priority: 'medium', relatedRoomId: 'ROOM-0007' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  return res.json({ success: true, data: SAMPLE_NOTIFICATIONS });
}
