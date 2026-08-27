// ─── POST /api/notifications/mark-all-read ────────────────────────────────────────
// Marks all unread notifications as read.

import { markAllRead } from '@/lib/google-sheets/notifications.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  try {
    await markAllRead(SPREADSHEET_ID);
    return jsonSuccess(null);
  } catch (err) {
    return jsonServerError(err, 'POST /api/notifications/mark-all-read');
  }
}
