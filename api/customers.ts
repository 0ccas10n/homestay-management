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

async function getCustomers(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_CUSTOMERS;
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
      range: 'Customers!A2:G',
    });

    const rows = response.data.values as string[][] || [];
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => {
        // Check if old layout (6 columns) or new layout (7 columns)
        const isLegacy = ['INSTAGRAM', 'TIKTOK', 'ZALO', 'FACEBOOK', 'KHÁC'].includes((row[1] || '').toUpperCase());
        
        return {
          customerId: row[0] || '',
          name: isLegacy ? '' : (row[1] || ''),
          source: isLegacy ? (row[1] || '') : (row[2] || ''),
          email: isLegacy ? (row[2] || '') : (row[3] || ''),
          note: isLegacy ? (row[3] || '') : (row[4] || ''),
          createdAt: isLegacy ? (row[4] || '') : (row[5] || ''),
          updatedAt: isLegacy ? (row[5] || '') : (row[6] || ''),
        };
      });
  } catch (err) {
    console.error('Error fetching customers:', err);
    return SAMPLE_CUSTOMERS;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const spreadsheetId = process.env.SPREADSHEET_ID || '';
  const customers = await getCustomers(spreadsheetId);

  return res.json({ success: true, data: customers });
}
