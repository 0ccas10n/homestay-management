// ─── PATCH /api/bookings/:id/status ─────────────────────────────────────────────
// Updates a booking's lifecycle status (e.g. confirm, check-in, check-out,
// cancel). Cancel is the headline use case — it frees the room's availability
// immediately by transitioning the room back to 'available' (or whatever its
// pre-booking state was) and cancels any linked pending cleaning task.
//
// The dedicated endpoint exists separately from the generic PATCH /api/bookings/:id
// because:
//   1. The status transition is the most frequent admin action — a narrower
//      handler keeps validation focused and the response payload small.
//   2. Cancelling has side effects (room cleanup, cleaning task cancellation)
//      that don't belong in the general update path.

import { readOne, update } from '@/lib/google-sheets/bookings.repository';
import { readOne as readRoom, update as updateRoom } from '@/lib/google-sheets/rooms.repository';
import { transition } from '@/lib/google-sheets/cleaning.repository';
import { updateBookingStatusSchema, parseBody } from '@/lib/api/validation';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

async function getBookingId(request: Request): Promise<string | Response> {
  // URL: /api/bookings/{id}/status → segments[-2]
  const segments = new URL(request.url).pathname.split('/');
  const bookingId = segments.at(-2) ?? '';
  if (!bookingId) return jsonError(400, 'BAD_REQUEST', 'Missing booking ID');
  return bookingId;
}

export async function PATCH(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const bookingId = await getBookingId(request);
  if (bookingId instanceof Response) return bookingId;

  const parsed = await parseBody(request, updateBookingStatusSchema);
  if (parsed instanceof Response) return parsed;

  const { status } = parsed;

  try {
    const existing = await readOne(SPREADSHEET_ID, bookingId);
    if (!existing) return jsonError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);

    // Idempotent: cancelling an already-cancelled booking is a no-op success.
    if (existing.status === status) {
      return jsonSuccess({ booking: existing, changed: false, message: `Booking already ${status}` });
    }

    const updated = await update(SPREADSHEET_ID, bookingId, { status });
    if (!updated) return jsonError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);

    // Side effects when transitioning to 'cancelled':
    //   - Free the room: if the room was marked 'occupied' for this booking,
    //     transition it back to 'available' so other guests can book it now.
    //   - Cancel any pending cleaning tasks linked to this booking — there
    //     won't be a real check-out to clean up after.
    if (status === 'cancelled') {
      const room = await readRoom(SPREADSHEET_ID, updated.roomId);
      if (room && room.status === 'occupied') {
        await updateRoom(SPREADSHEET_ID, updated.roomId, { status: 'available' });
      }

      const { query: queryCleaning } = await import('@/lib/google-sheets/cleaning.repository');
      const tasks = await queryCleaning(SPREADSHEET_ID, {
        bookingId,
        status: 'pending',
      });
      for (const task of tasks) {
        await transition(SPREADSHEET_ID, task.cleaningId, 'cancelled');
      }
    }

    return jsonSuccess({
      booking: updated,
      changed: true,
      message: status === 'cancelled'
        ? 'Booking cancelled. Room is now available.'
        : `Status updated to ${status}`,
    });
  } catch (err) {
    return jsonServerError(err, 'PATCH /api/bookings/:id/status');
  }
}
