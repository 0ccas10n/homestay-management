// ─── PATCH /api/cleaning/:id ─────────────────────────────────────────────────────
// Transition a cleaning task through its lifecycle.

import { readOne, transition } from '@/lib/google-sheets/cleaning.repository';
import { updateRoom } from '@/lib/google-sheets/rooms.repository';
import { updateCleaningSchema, parseBody } from '@/lib/api/validation';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

async function getCleaningId(request: Request): Promise<string | Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const cleaningId = segments.at(-2) ?? '';
  if (!cleaningId) return jsonError(400, 'BAD_REQUEST', 'Missing cleaning ID');
  return cleaningId;
}

export async function PATCH(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const cleaningId = await getCleaningId(request);
  if (cleaningId instanceof Response) return cleaningId;

  const parsed = await parseBody(request, updateCleaningSchema);
  if (parsed instanceof Response) return parsed;

  if (!parsed.status) {
    return jsonError(400, 'VALIDATION_ERROR', 'status is required');
  }

  try {
    const existing = await readOne(SPREADSHEET_ID, cleaningId);
    if (!existing) return jsonError(404, 'NOT_FOUND', `Cleaning task ${cleaningId} not found`);

    const updated = await transition(SPREADSHEET_ID, cleaningId, parsed.status);
    if (!updated) return jsonError(404, 'NOT_FOUND', `Cleaning task ${cleaningId} not found`);

    // Side-effect: when a cleaning task is completed, set the room back to 'available'
    if (parsed.status === 'completed' && existing.roomId) {
      await updateRoom(SPREADSHEET_ID, existing.roomId, { status: 'available' });
    }

    return jsonSuccess(updated);
  } catch (err) {
    return jsonServerError(err, 'PATCH /api/cleaning/:id');
  }
}
