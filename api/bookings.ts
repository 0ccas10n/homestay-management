// ─── Bookings API for Vercel ────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Sample bookings data for fallback
const SAMPLE_BOOKINGS: any[] = [
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
      range: 'Bookings!A2:U',
    });

    const rows = response.data.values as string[][] || [];
    
    // Map rows to booking objects (simplified mapping)
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => {
        // Check if old or new layout
        const isOldLayout = row[8]?.startsWith('RP-') || row[8] === 'custom';
        
        const booking = {
          bookingId: row[0] || '',
          roomId: row[1] || '',
          customerId: row[2] || '',
          checkInAt: row[3] || '',
          expectedCheckOutAt: row[4] || '',
          actualCheckOutAt: isOldLayout ? undefined : (row[5] || undefined),
          status: (row[6] || 'inquiry') as string,
          ratePlanId: row[7] || '',
          bookingType: isOldLayout 
            ? (row[7]?.startsWith('RP-') ? 'daily' : 'hourly')
            : (row[8] || 'daily'),
          expectedDurationMinutes: isOldLayout 
            ? (row[8] ? parseInt(row[8]) : 0) 
            : (row[9] ? parseInt(row[9]) : 0),
          baseAmount: isOldLayout 
            ? (row[9] ? parseFloat(row[9]) : 0) 
            : (row[10] ? parseFloat(row[10]) : 0),
          overtimeMinutes: isOldLayout 
            ? (row[10] ? parseInt(row[10]) : undefined) 
            : (row[11] ? parseInt(row[11]) : undefined),
          overtimeAmount: isOldLayout 
            ? (row[11] ? parseFloat(row[11]) : undefined) 
            : (row[12] ? parseFloat(row[12]) : undefined),
          totalAmount: isOldLayout 
            ? (row[12] ? parseFloat(row[12]) : 0) 
            : (row[13] ? parseFloat(row[13]) : 0),
          unitPriceAtBooking: isOldLayout ? undefined : (row[14] ? parseFloat(row[14]) : undefined),
          numGuests: isOldLayout 
            ? (row[13] ? parseInt(row[13]) : undefined) 
            : (row[15] ? parseInt(row[15]) : undefined),
          note: isOldLayout ? (row[14] || '') : (row[16] || ''),
          guestName: isOldLayout ? '' : (row[17] || ''),
        };
        
        // Fix totalAmount if suspiciously small
        if (booking.totalAmount <= 10 && booking.baseAmount >= 1000) {
          booking.totalAmount = booking.baseAmount + (booking.overtimeAmount || 0);
        }
        
        return booking;
      });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    return SAMPLE_BOOKINGS;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method === 'GET') {
    const spreadsheetId = process.env.SPREADSHEET_ID || '';
    let bookings = await getBookings(spreadsheetId);

    // Apply filters
    if (req.query.roomId) {
      bookings = bookings.filter(b => b.roomId === req.query.roomId);
    }
    if (req.query.status) {
      bookings = bookings.filter(b => b.status === req.query.status);
    }
    if (req.query.locationId) {
      // Would need to cross-reference with rooms for location filtering
    }

    return res.json({ success: true, data: bookings });
  }

  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
}
