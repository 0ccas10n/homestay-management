// ─── Cleaning API for Vercel ────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_CLEANING: any[] = [
  { cleaningId: 'CLN-0001', roomId: 'ROOM-0003', bookingId: 'BOOK-0010', scheduledAt: '2026-08-02T12:00:00+07:00', status: 'pending', priority: 'high', note: 'After James Whitfield checkout; next guest Priya Sharma arrives Aug 9' },
  { cleaningId: 'CLN-0002', roomId: 'ROOM-0011', scheduledAt: '2026-08-08T12:00:00+07:00', status: 'in_progress', priority: 'high', assignedTo: 'Maria Santos', startedAt: '2026-08-07T09:30:00+07:00', note: 'After Carlos Mendes checkout; next guest TBD' },
  { cleaningId: 'CLN-0003', roomId: 'ROOM-0004', scheduledAt: '2026-08-05T12:00:00+07:00', status: 'pending', priority: 'medium' },
  { cleaningId: 'CLN-0004', roomId: 'ROOM-0009', bookingId: 'BOOK-0008', scheduledAt: '2026-08-13T12:00:00+07:00', status: 'pending', priority: 'medium', note: 'After Carlos Mendes checkout' },
];

async function getCleaningTasks(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_CLEANING;
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
      range: 'Cleaning!A2:L',
    });

    const rows = response.data.values as string[][] || [];
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => ({
        cleaningId: row[0] || '',
        roomId: row[1] || '',
        bookingId: row[2] || undefined,
        scheduledAt: row[3] || '',
        status: row[4] || 'pending',
        priority: row[5] || 'medium',
        assignedTo: row[6] || undefined,
        startedAt: row[7] || undefined,
        completedAt: row[8] || undefined,
        note: row[9] || '',
        createdAt: row[10] || '',
        updatedAt: row[11] || '',
      }));
  } catch (err) {
    console.error('Error fetching cleaning tasks:', err);
    return SAMPLE_CLEANING;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method === 'GET') {
    const spreadsheetId = process.env.SPREADSHEET_ID || '';
    let tasks = await getCleaningTasks(spreadsheetId);
    
    if (req.query.status) {
      tasks = tasks.filter(t => t.status === req.query.status);
    }

    return res.json({ success: true, data: tasks });
  }

  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
}
