// ─── PATCH /api/notifications/[id] ───────────────────────────────────────────────
// Marks a single notification as read.

import { markRead } from '@/lib/google-sheets/notifications.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

async function getNotificationId(request: Request): Promise<string | Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const notificationId = segments.at(-2) ?? ''; // /api/notifications/{id} → segments[-2]
  if (!notificationId) return jsonError(400, 'BAD_REQUEST', 'Missing notification ID');
  return notificationId;
}

export async function PATCH(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const idResult = await getNotificationId(request);
  if (idResult instanceof Response) return idResult;
  const id = idResult;

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
