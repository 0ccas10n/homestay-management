// ─── GET /api/rate-plans ────────────────────────────────────────────────────────
// Returns all rate plans (read-only). Requires authentication.

import { readAll } from '@/lib/google-sheets/ratePlans.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  try {
    const plans = await readAll(SPREADSHEET_ID);
    return jsonSuccess(plans);
  } catch (err) {
    return jsonServerError(err, 'GET /api/rate-plans');
  }
}
