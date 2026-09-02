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

function parseBool(value: any): boolean {
  if (value === false || value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const s = value.trim().toUpperCase();
    if (s === 'FALSE' || s === '0' || s === 'NO') return false;
  }
  return true;
}

async function getNotifications(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_NOTIFICATIONS;
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
      range: 'Notifications!A2:K',
    });

    const rows = response.data.values as string[][] || [];
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => ({
        notificationId: row[0] || '',
        type: row[1] || 'check_in',
        title: row[2] || '',
        message: row[3] || '',
        time: row[4] || '',
        read: parseBool(row[5]),
        priority: row[6] || 'medium',
        relatedBookingId: row[7] || undefined,
        relatedRoomId: row[8] || undefined,
        createdAt: row[9] || '',
        updatedAt: row[10] || '',
      }));
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return SAMPLE_NOTIFICATIONS;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const spreadsheetId = process.env.SPREADSHEET_ID || '';
  const notifications = await getNotifications(spreadsheetId);

  return res.json({ success: true, data: notifications });
}
