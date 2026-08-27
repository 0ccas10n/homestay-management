// ─── GET & POST /api/cleaning ────────────────────────────────────────────────────
// GET: list cleaning tasks with optional filters.
// POST: create a cleaning task.

import { query, create, dueToday } from '@/lib/google-sheets/cleaning.repository';
import { createCleaningSchema, parseBody } from '@/lib/api/validation';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const roomId    = searchParams.get('roomId')    ?? undefined;
  const bookingId = searchParams.get('bookingId') ?? undefined;
  const status    = searchParams.get('status')     ?? undefined;
  const date      = searchParams.get('date')       ?? undefined;

  try {
    // If no filters, default to today's due tasks
    const tasks = (roomId || bookingId || status || date)
      ? await query(SPREADSHEET_ID, {
          roomId:     roomId     ?? undefined,
          bookingId:  bookingId  ?? undefined,
          status:     status     as any ?? undefined,
        })
      : await dueToday(SPREADSHEET_ID);

    return jsonSuccess(tasks);
  } catch (err) {
    return jsonServerError(err, 'GET /api/cleaning');
  }
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const parsed = await parseBody(request, createCleaningSchema);
  if (parsed instanceof Response) return parsed;

  try {
    const task = await create(SPREADSHEET_ID, {
      roomId:      parsed.roomId,
      bookingId:   parsed.bookingId,
      scheduledAt: parsed.scheduledAt,
      status:      'pending',
      priority:    parsed.priority,
      assignedTo:  parsed.assignedTo,
      note:        parsed.note,
    });
    return jsonCreated(task);
  } catch (err) {
    return jsonServerError(err, 'POST /api/cleaning');
  }
}
