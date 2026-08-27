// ─── GET /api/customers ──────────────────────────────────────────────────────────
// Returns all customers (no filtering needed for the guests page).

import { readAll } from '@/lib/google-sheets/customers.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  try {
    const customers = await readAll(SPREADSHEET_ID);
    return jsonSuccess(customers);
  } catch (err) {
    return jsonServerError(err, 'GET /api/customers');
  }
}
