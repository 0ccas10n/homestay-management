// ─── Rate Plan Prices API for Vercel ────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Generate rate plan prices for all rooms
function generateRatePlanPrices() {
  const rooms = [
    'ROOM-0001', 'ROOM-0002', 'ROOM-0003', 'ROOM-0004', 'ROOM-0005',
    'ROOM-0006', 'ROOM-0007', 'ROOM-0008', 'ROOM-0009', 'ROOM-0010',
    'ROOM-0011', 'ROOM-0012'
  ];
  const ratePlanPrices = [
    { ratePlanId: 'RP-0001', price: 250000 },
    { ratePlanId: 'RP-0002', price: 350000 },
    { ratePlanId: 'RP-0003', price: 400000 },
    { ratePlanId: 'RP-0004', price: 550000 },
  ];
  
  const result = [];
  let id = 1;
  for (const roomId of rooms) {
    for (const rp of ratePlanPrices) {
      result.push({
        ratePlanPriceId: `RPP-${String(id++).padStart(4, '0')}`,
        ratePlanId: rp.ratePlanId,
        roomId,
        priceVnd: rp.price,
        active: true,
      });
    }
  }
  return result;
}

const SAMPLE_RATES = generateRatePlanPrices();

function parseBool(value: any): boolean {
  if (value === false || value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const s = value.trim().toUpperCase();
    if (s === 'FALSE' || s === '0' || s === 'NO') return false;
  }
  return true;
}

async function getRatePlanPrices(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_RATES;
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
      range: 'RatePlanPrices!A2:G',
    });

    const rows = response.data.values as string[][] || [];
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => ({
        ratePlanPriceId: row[0] || '',
        ratePlanId: row[1] || '',
        roomId: row[2] || '',
        priceVnd: row[3] ? parseFloat(row[3]) : 0,
        active: parseBool(row[4]),
        createdAt: row[5] || '',
        updatedAt: row[6] || '',
      }));
  } catch (err) {
    console.error('Error fetching rate plan prices:', err);
    return SAMPLE_RATES;
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
  let rates = await getRatePlanPrices(spreadsheetId);
  
  // Filter by ratePlanId and roomId if provided
  if (req.query.ratePlanId) {
    rates = rates.filter(r => r.ratePlanId === req.query.ratePlanId);
  }
  if (req.query.roomId) {
    rates = rates.filter(r => r.roomId === req.query.roomId);
  }

  return res.json({ success: true, data: rates });
}
