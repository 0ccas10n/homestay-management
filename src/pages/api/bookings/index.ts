// ─── GET & POST /api/bookings ────────────────────────────────────────────────────
// GET: list bookings with optional filters.
// POST: create a new booking (findOrCreate for customer, compute amounts).

import { query, create, byCustomer } from '@/lib/google-sheets/bookings.repository';
import { readOne as readRoom, readAll as readAllRooms } from '@/lib/google-sheets/rooms.repository';
import { readAll as readAllPlans, active as activePlans } from '@/lib/google-sheets/ratePlans.repository';
import { findOrCreate } from '@/lib/google-sheets/customers.repository';
import { createBookingSchema, parseBody, CUSTOM_RATE_PLAN_ID } from '@/lib/api/validation';
import type { Booking } from '@/types/index';
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
    const safe = finalBookings.map((b: Booking) => safeBooking(b));

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

  console.log('[API bookings POST] guestName received:', parsed.guestName, 'customer:', parsed.customer);

  const { guestName, customer, roomId, checkInAt, expectedCheckOutAt, status, ratePlanId, bookingType, totalAmount, numGuests, note } = parsed;
  console.log('[API bookings POST] bookingType:', bookingType, 'ratePlanId:', ratePlanId, 'roomId:', roomId, 'totalAmount:', totalAmount, 'numGuests:', numGuests);

  try {
    // 1. Validate room exists & capacity
    const room = await readRoom(SPREADSHEET_ID, roomId);
    if (!room) return jsonError(400, 'VALIDATION_ERROR', `Room ${roomId} does not exist`);

    if (numGuests && room.capacity && numGuests > room.capacity) {
      return jsonError(
        400,
        'VALIDATION_ERROR',
        `Phòng ${room.name} chỉ chứa tối đa ${room.capacity} khách (bạn đang chọn ${numGuests} khách)`,
      );
    }


    // 2. Rate plan: only validate against the sheet for daily bookings.
    //    Hourly bookings store a manual totalAmount and may use the legacy
    //    `CUSTOM_RATE_PLAN_ID` sentinel — neither needs a sheet lookup.
    const isHourlyBooking = bookingType === 'hourly';
    if (!isHourlyBooking && ratePlanId && ratePlanId !== CUSTOM_RATE_PLAN_ID) {
      const allPlansList = await readAllPlans(SPREADSHEET_ID);
      const activePlansList = await activePlans(SPREADSHEET_ID);
      const knownValidPlans = ['RP-0001', 'RP-0002', 'RP-0003', 'RP-0004'];
      const exists =
        activePlansList.some(p => p.ratePlanId === ratePlanId) ||
        allPlansList.some(p => p.ratePlanId === ratePlanId) ||
        knownValidPlans.includes(ratePlanId);

      if (!exists) {
        return jsonError(400, 'VALIDATION_ERROR', `Rate plan ${ratePlanId} does not exist`);
      }
    }

    // 3. Create or find customer
    // The guest's display name from the booking form must be stored on the
    // Customer row so the (name, source) pair can be used to de-duplicate
    // future bookings. We always forward `guestName` (not `customer.name`)
    // because the form's "Guest Name" field is the single source of truth.

    const { customer: savedCustomer } = await findOrCreate(SPREADSHEET_ID, {
      name:   guestName,
      source: customer.source,
      email:  customer.email,
      note:   customer.note,
    });

    // 4. Create booking
    const booking = await create(SPREADSHEET_ID, {
      roomId,
      guestName,
      customerId: savedCustomer.customerId,
      checkInAt,
      expectedCheckOutAt,
      status:      status ?? 'confirmed',
      ratePlanId,
      bookingType: bookingType ?? 'daily',
      totalAmount: bookingType === 'hourly' ? totalAmount : undefined,
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
    if (err?.message?.includes('No price configured')) {
      return jsonError(400, 'PRICE_NOT_CONFIGURED', err.message);
    }
    return jsonServerError(err, 'POST /api/bookings');
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function filterByLocation(
  bookings: Awaited<ReturnType<typeof query>>,
  locationId: string,
): Promise<Awaited<ReturnType<typeof query>>> {
  const rooms = await readAllRooms(SPREADSHEET_ID);
  const roomIds = new Set(rooms.filter(r => r.locationId === locationId).map(r => r.roomId));
  return bookings.filter(b => roomIds.has(b.roomId));
}

/** Strip sensitive fields before sending to client. */
function safeBooking(b: Booking): object {
  return {
    bookingId:               b.bookingId,
    roomId:                  b.roomId,
    customerId:              b.customerId,
    guestName:               b.guestName,
    checkInAt:               b.checkInAt,
    expectedCheckOutAt:       b.expectedCheckOutAt,
    actualCheckOutAt:        b.actualCheckOutAt,
    status:                  b.status,
    ratePlanId:              b.ratePlanId,
    bookingType:             b.bookingType,
    expectedDurationMinutes: b.expectedDurationMinutes,
    baseAmount:              b.baseAmount,
    overtimeMinutes:         b.overtimeMinutes,
    overtimeAmount:          b.overtimeAmount,
    totalAmount:             b.totalAmount,
    unitPriceAtBooking:      b.unitPriceAtBooking,
    numGuests:               b.numGuests,
    note:                    b.note,
  };
}
