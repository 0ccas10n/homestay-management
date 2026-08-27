// ─── GET /api/notifications ─────────────────────────────────────────────────────
// Returns all notifications, newest first.

import { readAll } from '@/lib/google-sheets/notifications.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  try {
    const all = await readAll(SPREADSHEET_ID);
    // Sort newest first
    const sorted = all.sort((a, b) => b.time.localeCompare(a.time));
    return jsonSuccess(sorted);
  } catch (err) {
    return jsonServerError(err, 'GET /api/notifications');
  }
}
