// ─── Availability API for Vercel ────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Sample bookings (same as bookings.ts)
const SAMPLE_BOOKINGS = [
  { bookingId: 'BOOK-0001', roomId: 'ROOM-0001', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-10T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0002', roomId: 'ROOM-0005', checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-09T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0003', roomId: 'ROOM-0006', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-12T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0004', roomId: 'ROOM-0010', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-08T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0005', roomId: 'ROOM-0012', checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0006', roomId: 'ROOM-0002', checkInAt: '2026-08-08T14:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0007', roomId: 'ROOM-0008', checkInAt: '2026-08-09T14:00:00+07:00', expectedCheckOutAt: '2026-08-14T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0008', roomId: 'ROOM-0009', checkInAt: '2026-08-10T14:00:00+07:00', expectedCheckOutAt: '2026-08-13T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0009', roomId: 'ROOM-0005', checkInAt: '2026-08-14T14:00:00+07:00', expectedCheckOutAt: '2026-08-16T12:00:00+07:00', status: 'confirmed' },
];

function windowsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return new Date(start1) < new Date(end2) && new Date(end1) > new Date(start2);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const { roomId, checkIn, checkOut } = req.query || {};

  if (!roomId || !checkIn || !checkOut) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'roomId, checkIn, and checkOut are required' },
    });
  }

  // Check for overlapping bookings
  const hasOverlap = SAMPLE_BOOKINGS.some(b => 
    b.roomId === roomId &&
    b.status !== 'cancelled' &&
    b.status !== 'checked_out' &&
    windowsOverlap(b.checkInAt, b.expectedCheckOutAt, checkIn as string, checkOut as string)
  );

  return res.json({
    success: true,
    data: {
      roomId,
      checkIn,
      checkOut,
      available: !hasOverlap,
    },
  });
}
