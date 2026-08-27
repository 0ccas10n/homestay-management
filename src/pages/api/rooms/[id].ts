// ─── PATCH & DELETE /api/rooms/:id ──────────────────────────────────────────────
// PATCH: update mutable fields (staff or admin).
// DELETE: soft-delete — sets active=false, status=inactive (staff or admin).

import { readOne, update, softDelete } from '@/lib/google-sheets/rooms.repository';
import { updateRoomSchema, parseBody } from '@/lib/api/validation';
import { requireRole } from '@/lib/auth/middleware';
import { jsonSuccess, jsonNoContent, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

async function getRoomId(request: Request): Promise<string | Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // Pattern: /api/rooms/{roomId} → segments[-1]
  const roomId = segments.at(-1) ?? '';
  if (!roomId) return jsonError(400, 'BAD_REQUEST', 'Missing room ID');
  return roomId;
}

export async function PATCH(request: Request) {
  const session = await requireRole(request, 'staff');
  if (session instanceof Response) return session;

  const roomIdResult = await getRoomId(request);
  if (roomIdResult instanceof Response) return roomIdResult;
  const roomId = roomIdResult;

  const parsed = await parseBody(request, updateRoomSchema);
  if (parsed instanceof Response) return parsed;

  // Admins can change status; staff cannot
  if (parsed.status !== undefined && session.role !== 'admin') {
    return jsonError(403, 'FORBIDDEN', 'Only admins can change room status');
  }

  try {
    const room = await update(SPREADSHEET_ID, roomId, parsed);
    if (!room) return jsonError(404, 'NOT_FOUND', `Room ${roomId} not found`);
    return jsonSuccess(room);
  } catch (err) {
    return jsonServerError(err, 'PATCH /api/rooms/:id');
  }
}

export async function DELETE(request: Request) {
  const session = await requireRole(request, 'staff');
  if (session instanceof Response) return session;

  const roomIdResult = await getRoomId(request);
  if (roomIdResult instanceof Response) return roomIdResult;
  const roomId = roomIdResult;

  try {
    const existing = await readOne(SPREADSHEET_ID, roomId);
    if (!existing) return jsonError(404, 'NOT_FOUND', `Room ${roomId} not found`);

    const ok = await softDelete(SPREADSHEET_ID, roomId);
    if (!ok) return jsonError(404, 'NOT_FOUND', `Room ${roomId} not found`);

    return jsonNoContent();
  } catch (err) {
    return jsonServerError(err, 'DELETE /api/rooms/:id');
  }
}
