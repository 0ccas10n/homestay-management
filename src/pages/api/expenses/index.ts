// ─── GET & POST /api/expenses ────────────────────────────────────────────────────
// GET: list expenses with optional date-range and category filters.
// POST: create a new expense record.

import { query, create } from '@/lib/google-sheets/expenses.repository';
import { createExpenseSchema, parseBody } from '@/lib/api/validation';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const from     = searchParams.get('from')     ?? undefined;
  const to       = searchParams.get('to')       ?? undefined;
  const category = searchParams.get('category') ?? undefined;

  try {
    const expenses = await query(SPREADSHEET_ID, { from, to, category });
    return jsonSuccess(expenses);
  } catch (err) {
    return jsonServerError(err, 'GET /api/expenses');
  }
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const parsed = await parseBody(request, createExpenseSchema);
  if (parsed instanceof Response) return parsed;

  try {
    const expense = await create(SPREADSHEET_ID, {
      category:    parsed.category,
      amount:      parsed.amount,
      date:        parsed.date,
      description: parsed.description,
      vendor:      parsed.vendor,
    });
    return jsonCreated(expense);
  } catch (err) {
    return jsonServerError(err, 'POST /api/expenses');
  }
}
