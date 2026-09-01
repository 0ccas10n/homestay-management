// ─── GET, PATCH & DELETE /api/bookings/:id ──────────────────────────────────────
// GET: single booking with permitted customer info.
// PATCH: update fields; triggers checkout logic when actualCheckOutAt is set.
// DELETE: cancel booking (soft delete — sets status=cancelled).

import { readOne, update, checkout } from '@/lib/google-sheets/bookings.repository';
import { readOne as readCustomer } from '@/lib/google-sheets/customers.repository';
import { update as updateRoom } from '@/lib/google-sheets/rooms.repository';
import { transition } from '@/lib/google-sheets/cleaning.repository';
import { updateBookingSchema, parseBody } from '@/lib/api/validation';
import { requireAuth } from '@/lib/auth/middleware';
import {
  jsonSuccess, jsonNoContent, jsonError, jsonServerError,
} from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

async function getBookingId(request: Request): Promise<string | Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const bookingId = segments.at(-1) ?? ''; // /api/bookings/{id} → segments[-1]
  if (!bookingId) return jsonError(400, 'BAD_REQUEST', 'Missing booking ID');
  return bookingId;
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const bookingId = await getBookingId(request);
  if (bookingId instanceof Response) return bookingId;

  try {
    const booking = await readOne(SPREADSHEET_ID, bookingId);
    if (!booking) return jsonError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);

    // Fetch permitted customer info
    const customer = await readCustomer(SPREADSHEET_ID, booking.customerId);

    return jsonSuccess({
      booking: {
        bookingId:               booking.bookingId,
        roomId:                  booking.roomId,
        customerId:              booking.customerId,
        checkInAt:               booking.checkInAt,
        expectedCheckOutAt:       booking.expectedCheckOutAt,
        actualCheckOutAt:        booking.actualCheckOutAt,
        status:                  booking.status,
        ratePlanId:              booking.ratePlanId,
        bookingType:             booking.bookingType,
        expectedDurationMinutes: booking.expectedDurationMinutes,
        baseAmount:              booking.baseAmount,
        overtimeMinutes:         booking.overtimeMinutes,
        overtimeAmount:          booking.overtimeAmount,
        totalAmount:             booking.totalAmount,
        unitPriceAtBooking:      booking.unitPriceAtBooking,
        numGuests:               booking.numGuests,
        note:                    booking.note,
        createdBy:               booking.createdBy,
        createdAt:               booking.createdAt,
      },
      // Strip phone/email from customer for non-admin roles
      customer: customer
        ? { customerId: customer.customerId, name: customer.name }
        : null,
    });
  } catch (err) {
    return jsonServerError(err, 'GET /api/bookings/:id');
  }
}

export async function PATCH(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const bookingId = await getBookingId(request);
  if (bookingId instanceof Response) return bookingId;

  const parsed = await parseBody(request, updateBookingSchema);
  if (parsed instanceof Response) return parsed;

  try {
    // ── Checkout path: actualCheckOutAt is set ──────────────────────────────────
    if (parsed.actualCheckOutAt !== undefined) {
      const result = await checkout(SPREADSHEET_ID, bookingId, parsed.actualCheckOutAt);
      if (!result) return jsonError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);

      const { booking, overtimeMinutes, overtimeAmount } = result;

      // Update room status → 'needs_cleaning' (checkout just finished, awaiting housekeeping)
      await updateRoom(SPREADSHEET_ID, booking.roomId, { status: 'needs_cleaning' });

      // Auto-complete the linked cleaning task
      const { query: queryCleaning } = await import('@/lib/google-sheets/cleaning.repository');
      const tasks = await queryCleaning(SPREADSHEET_ID, { bookingId, status: 'pending' });
      for (const task of tasks) {
        await transition(SPREADSHEET_ID, task.cleaningId, 'completed');
      }

      return jsonSuccess({
        booking,
        overtimeMinutes,
        overtimeAmount,
        message: overtimeAmount > 0
          ? `Checked out. Overtime: ${overtimeMinutes} minutes, +${overtimeAmount}`
          : 'Checked out successfully',
      });
    }

    // ── General update ──────────────────────────────────────────────────────────
    const { actualCheckOutAt: _, ...generalPatch } = parsed;
    const updated = await update(SPREADSHEET_ID, bookingId, generalPatch);
    if (!updated) return jsonError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);

    return jsonSuccess(updated);
  } catch (err: any) {
    if (err?.message?.includes('overlap')) {
      return jsonError(409, 'BOOKING_CONFLICT', err.message);
    }
    return jsonServerError(err, 'PATCH /api/bookings/:id');
  }
}

export async function DELETE(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const bookingId = await getBookingId(request);
  if (bookingId instanceof Response) return bookingId;

  try {
    const existing = await readOne(SPREADSHEET_ID, bookingId);
    if (!existing) return jsonError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);

    // Soft-delete: set status = cancelled (no physical delete)
    const updated = await update(SPREADSHEET_ID, bookingId, { status: 'cancelled' });
    return jsonNoContent();
  } catch (err) {
    return jsonServerError(err, 'DELETE /api/bookings/:id');
  }
}
