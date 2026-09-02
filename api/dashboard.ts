// ─── Dashboard API for Vercel ────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Sample data for fallback
const SAMPLE_BOOKINGS = [
  { bookingId: 'BOOK-0001', roomId: 'ROOM-0001', guestName: 'Nadia Okonkwo', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-10T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0002', roomId: 'ROOM-0005', guestName: 'Marcus Chen', checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-09T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0003', roomId: 'ROOM-0006', guestName: 'Elena Vasquez', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-12T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0004', roomId: 'ROOM-0010', guestName: 'James Whitfield', checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-08T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0005', roomId: 'ROOM-0012', guestName: 'Aisha Rahman', checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00', status: 'checked_in' },
  { bookingId: 'BOOK-0006', roomId: 'ROOM-0002', guestName: 'Tomás Eriksson', checkInAt: '2026-08-08T14:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0007', roomId: 'ROOM-0008', guestName: 'Priya Sharma', checkInAt: '2026-08-09T14:00:00+07:00', expectedCheckOutAt: '2026-08-14T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0008', roomId: 'ROOM-0009', guestName: 'Carlos Mendes', checkInAt: '2026-08-10T14:00:00+07:00', expectedCheckOutAt: '2026-08-13T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0009', roomId: 'ROOM-0005', guestName: 'Nadia Okonkwo', checkInAt: '2026-08-14T14:00:00+07:00', expectedCheckOutAt: '2026-08-16T12:00:00+07:00', status: 'confirmed' },
  { bookingId: 'BOOK-0010', roomId: 'ROOM-0003', guestName: 'James Whitfield', checkInAt: '2026-07-30T14:00:00+07:00', expectedCheckOutAt: '2026-08-02T12:00:00+07:00', actualCheckOutAt: '2026-08-02T11:30:00+07:00', status: 'checked_out' },
];

const SAMPLE_CLEANING = [
  { cleaningId: 'CLN-0001', roomId: 'ROOM-0003', status: 'pending', priority: 'high' },
  { cleaningId: 'CLN-0002', roomId: 'ROOM-0011', status: 'in_progress', priority: 'high' },
  { cleaningId: 'CLN-0003', roomId: 'ROOM-0004', status: 'pending', priority: 'medium' },
  { cleaningId: 'CLN-0004', roomId: 'ROOM-0009', status: 'pending', priority: 'medium' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00+07:00`;
  const todayEnd = `${today}T23:59:59+07:00`;

  const bookings = SAMPLE_BOOKINGS;
  const cleaning = SAMPLE_CLEANING;

  const todayCheckIns = bookings.filter(b => {
    const checkIn = b.checkInAt.slice(0, 10);
    return checkIn === today && b.status === 'checked_in';
  }).length;

  const todayCheckOuts = bookings.filter(b => {
    const checkOut = b.expectedCheckOutAt.slice(0, 10);
    return checkOut === today && b.status === 'checked_in';
  }).length;

  const occupiedRooms = new Set(
    bookings.filter(b => b.status === 'checked_in').map(b => b.roomId)
  ).size;

  const roomsToClean = cleaning.filter(c => c.status !== 'completed').length;

  return res.json({
    success: true,
    data: {
      todayCheckIns,
      todayCheckOuts,
      availableRooms: 12 - occupiedRooms,
      occupiedRooms,
      roomsToClean,
      upcomingBookings: bookings.filter(b => b.status === 'confirmed').slice(0, 5),
      monthlyRevenue: [
        { month: 'Mar', revenue: 17840000, expenses: 8100000 },
        { month: 'Apr', revenue: 19620000, expenses: 8300000 },
        { month: 'May', revenue: 22100000, expenses: 8650000 },
        { month: 'Jun', revenue: 28400000, expenses: 9240000 },
        { month: 'Jul', revenue: 32450000, expenses: 9680000 },
        { month: 'Aug', revenue: 24340000, expenses: 9248000 },
      ],
      weeklyOccupancy: [
        { day: 'Mon', rate: 75 },
        { day: 'Tue', rate: 83 },
        { day: 'Wed', rate: 92 },
        { day: 'Thu', rate: 67 },
        { day: 'Fri', rate: 100 },
        { day: 'Sat', rate: 100 },
        { day: 'Sun', rate: 58 },
      ],
      monthlyRevenueTotal: 144700000,
    },
  });
}
