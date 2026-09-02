// ─── Rate Plans API for Vercel ───────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_RATE_PLANS = [
  { ratePlanId: 'RP-0001', name: 'Combo 4H', type: 'hourly', baseMinutes: 240, baseAmount: 250000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0002', name: 'Combo 6H', type: 'hourly', baseMinutes: 360, baseAmount: 350000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0003', name: 'Overnight', type: 'overnight', baseMinutes: 780, baseAmount: 400000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '21:00', overnightEnd: '10:00', active: true },
  { ratePlanId: 'RP-0004', name: 'Full Day', type: 'daily', baseMinutes: 1320, baseAmount: 550000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '14:00', overnightEnd: '12:00', active: true },
];

async function getRatePlans(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_RATE_PLANS;
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
      range: 'RatePlans!A2:J',
    });

    const rows = response.data.values as string[][] || [];
    
    function parseBool(value: any): boolean {
      if (value === false || value === 0 || value === '0') return false;
      if (typeof value === 'string') {
        const s = value.trim().toUpperCase();
        if (s === 'FALSE' || s === '0' || s === 'NO') return false;
      }
      return true;
    }
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => {
        // Check if 8-column format
        const is8Col = row.length <= 8 || (row[5] && row[5].includes(':')) || (row[7] !== undefined && (row[7].toUpperCase() === 'TRUE' || row[7].toUpperCase() === 'FALSE' || row[7] === ''));

        if (is8Col) {
          return {
            ratePlanId: row[0] || '',
            name: row[1] || '',
            type: row[2] || 'hourly',
            baseMinutes: row[3] ? parseInt(row[3]) : 0,
            baseAmount: 0,
            extraMinutePrice: 0,
            overtimeMinutePrice: row[4] ? parseFloat(row[4]) : 0,
            overnightStart: row[5] || '',
            overnightEnd: row[6] || '',
            active: parseBool(row[7]),
          };
        }

        return {
          ratePlanId: row[0] || '',
          name: row[1] || '',
          type: row[2] || 'hourly',
          baseMinutes: row[3] ? parseInt(row[3]) : 0,
          baseAmount: row[4] ? parseFloat(row[4]) : 0,
          extraMinutePrice: row[5] ? parseFloat(row[5]) : 0,
          overtimeMinutePrice: row[6] ? parseFloat(row[6]) : 0,
          overnightStart: row[7] || '',
          overnightEnd: row[8] || '',
          active: parseBool(row[9]),
        };
      });
  } catch (err) {
    console.error('Error fetching rate plans:', err);
    return SAMPLE_RATE_PLANS;
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
  const ratePlans = await getRatePlans(spreadsheetId);

  return res.json({ success: true, data: ratePlans });
}
