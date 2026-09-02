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

async function getBookings(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_BOOKINGS;
  }

  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Bookings!A2:G',
    });

    const rows = response.data.values as string[][] || [];
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => ({
        bookingId: row[0] || '',
        roomId: row[1] || '',
        checkInAt: row[3] || '',
        expectedCheckOutAt: row[4] || '',
        status: row[6] || 'inquiry',
      }));
  } catch (err) {
    console.error('Error fetching bookings for availability:', err);
    return SAMPLE_BOOKINGS;
  }
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

  const spreadsheetId = process.env.SPREADSHEET_ID || '';
  const bookings = await getBookings(spreadsheetId);

  // Check for overlapping bookings
  const hasOverlap = bookings.some(b => 
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
