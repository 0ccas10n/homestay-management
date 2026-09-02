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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  return res.json({ success: true, data: SAMPLE_EXPENSES });
}
