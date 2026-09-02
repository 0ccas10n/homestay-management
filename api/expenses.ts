// ─── Expenses API for Vercel ─────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAMPLE_EXPENSES = [
  { expenseId: 'EXP-0001', category: 'Cleaning Supplies', amount: 1455000, date: '2026-08-01', description: 'Monthly cleaning supplies restock', vendor: 'Clean Pro Supplies' },
  { expenseId: 'EXP-0002', category: 'Electricity', amount: 3800000, date: '2026-08-01', description: 'July electricity bill', vendor: 'City Power Co.' },
  { expenseId: 'EXP-0003', category: 'Water', amount: 950000, date: '2026-08-01', description: 'July water bill', vendor: 'Municipal Water' },
  { expenseId: 'EXP-0004', category: 'Internet', amount: 450000, date: '2026-08-01', description: 'Monthly fiber broadband', vendor: 'FiberNet ISP' },
  { expenseId: 'EXP-0005', category: 'Staff', amount: 4800000, date: '2026-08-05', description: 'Weekly staff wages', vendor: 'Payroll' },
  { expenseId: 'EXP-0006', category: 'Repairs', amount: 2200000, date: '2026-08-06', description: 'AC unit repair — Yên 4', vendor: 'CoolTech HVAC' },
  { expenseId: 'EXP-0007', category: 'Cleaning Supplies', amount: 623000, date: '2026-08-06', description: 'Additional toiletries order', vendor: 'Clean Pro Supplies' },
  { expenseId: 'EXP-0008', category: 'Other', amount: 350000, date: '2026-08-07', description: 'Welcome fruit baskets', vendor: 'Local Market' },
];

async function getExpenses(spreadsheetId: string): Promise<any[]> {
  if (!spreadsheetId) {
    return SAMPLE_EXPENSES;
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
      range: 'Expenses!A2:H',
    });

    const rows = response.data.values as string[][] || [];
    
    return rows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => ({
        expenseId: row[0] || '',
        category: row[1] || '',
        amount: row[2] ? parseFloat(row[2]) : 0,
        date: row[3] || '',
        description: row[4] || '',
        vendor: row[5] || '',
        createdAt: row[6] || '',
        updatedAt: row[7] || '',
      }));
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return SAMPLE_EXPENSES;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const spreadsheetId = process.env.SPREADSHEET_ID || '';
  const expenses = await getExpenses(spreadsheetId);

  return res.json({ success: true, data: expenses });
}
