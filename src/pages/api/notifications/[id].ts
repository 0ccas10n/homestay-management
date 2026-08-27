// ─── PATCH /api/notifications/[id] ───────────────────────────────────────────────
// Marks a single notification as read.

import { markRead } from '@/lib/google-sheets/notifications.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const { id } = await params;

  try {
    const updated = await markRead(SPREADSHEET_ID, id);
    if (!updated) {
      return jsonError(404, 'NOT_FOUND', `Notification ${id} not found`);
    }
    return jsonSuccess(updated);
  } catch (err) {
    return jsonServerError(err, `PATCH /api/notifications/${id}`);
  }
}
