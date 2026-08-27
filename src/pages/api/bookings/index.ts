// ─── GET & POST /api/bookings ────────────────────────────────────────────────────
// GET: list bookings with optional filters.
// POST: create a new booking (findOrCreate for customer, compute amounts).

import { query, create, byCustomer } from '@/lib/google-sheets/bookings.repository';
import { readOne as readRoom } from '@/lib/google-sheets/rooms.repository';
import { getRatePlan } from '@/utils/pricing';
import { createBookingSchema, parseBody } from '@/lib/api/validation';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const roomId      = searchParams.get('roomId')      ?? undefined;
  const customerId  = searchParams.get('customerId')  ?? undefined;
  const locationId  = searchParams.get('locationId')  ?? undefined;
  const status      = searchParams.get('status')       ?? undefined;
  const from        = searchParams.get('from')         ?? undefined;
  const to          = searchParams.get('to')           ?? undefined;

  try {
    let bookings;

    if (customerId) {
      // Fast path: customer-specific query
      bookings = await byCustomer(SPREADSHEET_ID, customerId);
    } else {
      bookings = await query(SPREADSHEET_ID, {
        roomId:     roomId     ?? undefined,
        status:     status     as any ?? undefined,
        from:       from       ?? undefined,
        to:         to         ?? undefined,
      });
    }

    // locationId requires a cross-sheet filter — fetch rooms and map
    const finalBookings = locationId
      ? await filterByLocation(bookings, locationId)
      : bookings;

    // Strip any fields that shouldn't reach the client
    const safe = finalBookings.map(safeBooking);

    return jsonSuccess(safe);
  } catch (err) {
    return jsonServerError(err, 'GET /api/bookings');
  }
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  const parsed = await parseBody(request, createBookingSchema);
  if (parsed instanceof Response) return parsed;

  const { customer, roomId, checkInAt, expectedCheckOutAt, status, source, ratePlanId, numGuests, note } = parsed;

  try {
    // 1. Validate room exists
    const room = await readRoom(SPREADSHEET_ID, roomId);
    if (!room) return jsonError(400, 'VALIDATION_ERROR', `Room ${roomId} does not exist`);

    // 2. Validate rate plan exists
    const plan = getRatePlan(ratePlanId);

    // 3. Create or find customer
    const { findOrCreate } = await import('@/lib/google-sheets/customers.repository');
    const { customer: savedCustomer } = await findOrCreate(SPREADSHEET_ID, {
      name:  customer.name,
      phone: customer.phone,
      email: customer.email,
      note:  customer.note,
    });

    // 4. Create booking
    const booking = await create(SPREADSHEET_ID, {
      roomId,
      customerId: savedCustomer.customerId,
      checkInAt,
      expectedCheckOutAt,
      status:      status ?? 'confirmed',
      source:      source ?? 'phone',
      ratePlanId,
      numGuests,
      note,
      createdBy: session.userId,
    });

    return jsonCreated(safeBooking(booking));
  } catch (err: any) {
    if (err?.message?.includes('not available') || err?.message?.includes('overlap')) {
      return jsonError(409, 'BOOKING_CONFLICT', err.message);
    }
    if (err?.message?.includes('checkInAt must be before')) {
      return jsonError(400, 'VALIDATION_ERROR', err.message);
    }
    return jsonServerError(err, 'POST /api/bookings');
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function filterByLocation(
  bookings: Awaited<ReturnType<typeof query>>,
  locationId: string,
): Promise<Awaited<ReturnType<typeof query>>> {
  const { readAll: readAllRooms } = await import('@/lib/google-sheets/rooms.repository');
  const rooms = await readAllRooms(SPREADSHEET_ID);
  const roomIds = new Set(rooms.filter(r => r.locationId === locationId).map(r => r.roomId));
  return bookings.filter(b => roomIds.has(b.roomId));
}

/** Strip sensitive fields before sending to client. */
function safeBooking(b: ReturnType<typeof query> extends Promise<infer T> ? T : never): object {
  return {
    bookingId:               b.bookingId,
    roomId:                  b.roomId,
    customerId:              b.customerId,
    checkInAt:               b.checkInAt,
    expectedCheckOutAt:       b.expectedCheckOutAt,
    actualCheckOutAt:        b.actualCheckOutAt,
    status:                  b.status,
    source:                  b.source,
    ratePlanId:              b.ratePlanId,
    expectedDurationMinutes: b.expectedDurationMinutes,
    baseAmount:              b.baseAmount,
    overtimeMinutes:         b.overtimeMinutes,
    overtimeAmount:          b.overtimeAmount,
    totalAmount:             b.totalAmount,
    numGuests:               b.numGuests,
    note:                    b.note,
  };
}
