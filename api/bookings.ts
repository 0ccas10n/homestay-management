// ─── Bookings API for Vercel ────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Sample bookings data
const SAMPLE_BOOKINGS = [
  { bookingId: 'BOOK-0001', roomId: 'ROOM-0001', customerId: 'CUS-0001', guestName: 'Nadia Okonkwo', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-10T12:00:00+07:00', status: 'checked_in', ratePlanId: 'RP-0004', bookingType: 'daily', expectedDurationMinutes: 4300, baseAmount: 1650000, totalAmount: 1650000, numGuests: 2 },
  { bookingId: 'BOOK-0002', roomId: 'ROOM-0005', customerId: 'CUS-0002', guestName: 'Marcus Chen', checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-09T12:00:00+07:00', status: 'checked_in', ratePlanId: 'RP-0004', bookingType: 'daily', expectedDurationMinutes: 2580, baseAmount: 1300000, totalAmount: 1300000, numGuests: 3 },
  { bookingId: 'BOOK-0003', roomId: 'ROOM-0006', customerId: 'CUS-0003', guestName: 'Elena Vasquez', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-12T12:00:00+07:00', status: 'checked_in', ratePlanId: 'RP-0004', bookingType: 'daily', expectedDurationMinutes: 7180, baseAmount: 2600000, totalAmount: 2600000, numGuests: 2 },
  { bookingId: 'BOOK-0004', roomId: 'ROOM-0010', customerId: 'CUS-0004', guestName: 'James Whitfield', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-08T12:00:00+07:00', status: 'checked_in', ratePlanId: 'RP-0002', bookingType: 'daily', expectedDurationMinutes: 1420, baseAmount: 450000, totalAmount: 450000, numGuests: 1 },
  { bookingId: 'BOOK-0005', roomId: 'ROOM-0012', customerId: 'CUS-0005', guestName: 'Aisha Rahman', checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00', status: 'checked_in', ratePlanId: 'RP-0004', bookingType: 'daily', expectedDurationMinutes: 5700, baseAmount: 2300000, totalAmount: 2300000, numGuests: 4 },
  { bookingId: 'BOOK-0006', roomId: 'ROOM-0002', customerId: 'CUS-0006', guestName: 'Tomás Eriksson', checkInAt: '2026-08-08T14:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00', status: 'confirmed', ratePlanId: 'RP-0003', bookingType: 'daily', expectedDurationMinutes: 4300, baseAmount: 800000, totalAmount: 800000, numGuests: 2 },
  { bookingId: 'BOOK-0007', roomId: 'ROOM-0008', customerId: 'CUS-0007', guestName: 'Priya Sharma', checkInAt: '2026-08-09T14:00:00+07:00', expectedCheckOutAt: '2026-08-14T12:00:00+07:00', status: 'confirmed', ratePlanId: 'RP-0004', bookingType: 'daily', expectedDurationMinutes: 7180, baseAmount: 2475000, totalAmount: 2475000, numGuests: 2 },
  { bookingId: 'BOOK-0008', roomId: 'ROOM-0009', customerId: 'CUS-0008', guestName: 'Carlos Mendes', checkInAt: '2026-08-10T14:00:00+07:00', expectedCheckOutAt: '2026-08-13T12:00:00+07:00', status: 'confirmed', ratePlanId: 'RP-0003', bookingType: 'daily', expectedDurationMinutes: 4300, baseAmount: 1200000, totalAmount: 1200000, numGuests: 3 },
  { bookingId: 'BOOK-0009', roomId: 'ROOM-0005', customerId: 'CUS-0001', guestName: 'Nadia Okonkwo', checkInAt: '2026-08-14T14:00:00+07:00', expectedCheckOutAt: '2026-08-16T12:00:00+07:00', status: 'confirmed', ratePlanId: 'RP-0003', bookingType: 'daily', expectedDurationMinutes: 2860, baseAmount: 1000000, totalAmount: 1000000, numGuests: 2 },
  { bookingId: 'BOOK-0010', roomId: 'ROOM-0003', customerId: 'CUS-0004', guestName: 'James Whitfield', checkInAt: '2026-07-30T14:00:00+07:00', expectedCheckOutAt: '2026-08-02T12:00:00+07:00', actualCheckOutAt: '2026-08-02T11:30:00+07:00', status: 'checked_out', ratePlanId: 'RP-0003', bookingType: 'daily', expectedDurationMinutes: 4300, baseAmount: 1200000, totalAmount: 1200000, numGuests: 1 },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method === 'GET') {
    let bookings = SAMPLE_BOOKINGS;

    // Apply filters
    if (req.query.roomId) {
      bookings = bookings.filter(b => b.roomId === req.query.roomId);
    }
    if (req.query.status) {
      bookings = bookings.filter(b => b.status === req.query.status);
    }
    if (req.query.locationId) {
      // For simplicity, return all bookings when location filter is needed
      // In production, this would cross-reference with rooms
    }

    return res.json({ success: true, data: bookings });
  }

  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
}
