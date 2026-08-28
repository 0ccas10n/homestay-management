// ─── Bookings repository ──────────────────────────────────────────────────────────
//
// CRUD + conflict detection for the Bookings sheet.
// Implements the open-interval overlap rule from DATABASE.md §10:
//   Existing booking: [checkInAt, expectedCheckOutAt)
//   Requested stay:   [requestedCheckIn, requestedCheckOut)
//   They overlap when: existingStart < requestedEnd && existingEnd > requestedStart
//
// Checkout: records actualCheckOutAt, computes overtime, updates totalAmount.
//
// Custom hourly bookings:
//   When ratePlanId === CUSTOM_RATE_PLAN_ID ('custom'), the receptionist has
//   entered the total amount manually. The repository skips all rate-plan
//   pricing math and persists the supplied totalAmount verbatim. Overtime on
//   checkout is also skipped — staff record any extra charges by hand.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  BOOKINGS_HEADERS,
  mapRowToBooking,
  mapBookingToRow,
} from './types';
import type { Booking, BookingStatus } from '@/types/index';
import { timestamps, updatedTimestamp, windowsOverlap, diffMinutes, nowIso } from './datetime';
import { generateId } from './id';
import { getRatePlan } from '@/utils/pricing';
import { CUSTOM_RATE_PLAN_ID } from '@/lib/api/validation';

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all bookings. Returns [] on error. */
export async function readAll(spreadsheetId: string): Promise<Booking[]> {
  const range = `${SHEETS.Bookings}!A2:${String.fromCharCode(64 + BOOKINGS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToBooking);
}

/** Fetch a single booking by ID. */
export async function readOne(
  spreadsheetId: string,
  bookingId: string,
): Promise<Booking | null> {
  const all = await readAll(spreadsheetId);
  return all.find(b => b.bookingId === bookingId) ?? null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────────

/** Filter bookings by any combination of fields. All filters are optional. */
export async function query(
  spreadsheetId: string,
  filters?: {
    roomId?: string;
    customerId?: string;
    locationId?: string;
    status?: BookingStatus;
    from?: string;   // ISO datetime — checkInAt >= from
    to?: string;     // ISO datetime — expectedCheckOutAt <= to
  },
): Promise<Booking[]> {
  let all = await readAll(spreadsheetId);

  if (filters?.roomId)     all = all.filter(b => b.roomId === filters.roomId);
  if (filters?.customerId) all = all.filter(b => b.customerId === filters.customerId);
  if (filters?.status)    all = all.filter(b => b.status === filters.status);

  if (filters?.from) {
    const fromMs = new Date(filters.from).getTime();
    all = all.filter(b => new Date(b.checkInAt).getTime() >= fromMs);
  }
  if (filters?.to) {
    const toMs = new Date(filters.to).getTime();
    all = all.filter(b => new Date(b.expectedCheckOutAt).getTime() <= toMs);
  }

  // locationId is a cross-sheet filter handled by the caller
  return all;
}

/** All bookings for a specific room. */
export async function byRoom(spreadsheetId: string, roomId: string): Promise<Booking[]> {
  return query(spreadsheetId, { roomId });
}

/** All bookings for a specific customer. */
export async function byCustomer(
  spreadsheetId: string,
  customerId: string,
): Promise<Booking[]> {
  return query(spreadsheetId, { customerId });
}

// ─── Conflict detection ─────────────────────────────────────────────────────────

/**
 * Check whether a requested stay window would overlap any active booking for a room.
 * Active = not cancelled, not checked_out.
 * Excludes a bookingId (used when updating an existing booking).
 */
export async function hasOverlap(
  spreadsheetId: string,
  roomId: string,
  checkInAt: string,
  expectedCheckOutAt: string,
  excludeBookingId?: string,
): Promise<boolean> {
  const existing = await byRoom(spreadsheetId, roomId);
  return existing
    .filter(b =>
      b.status !== 'cancelled' &&
      b.status !== 'checked_out' &&
      b.bookingId !== excludeBookingId,
    )
    .some(b =>
      windowsOverlap(b.checkInAt, b.expectedCheckOutAt, checkInAt, expectedCheckOutAt),
    );
}

// ─── Write ───────────────────────────────────────────────────────────────────────

/**
 * Create a new booking.
 *
 * Server responsibilities (mirrors API.md §6):
 *  1. Validate date range
 *  2. Re-check availability
 *  3. Calculate expectedDurationMinutes + baseAmount (skipped for custom hourly)
 *  4. Insert into sheet
 *
 * For ratePlanId === CUSTOM_RATE_PLAN_ID, the caller MUST supply totalAmount.
 * The repository persists that value directly without any rate-plan lookup.
 *
 * @throws Error if dates are invalid, overlap detected, room not found, or
 *         a custom booking is missing totalAmount.
 */
export async function create(
  spreadsheetId: string,
  input: Omit<Booking, 'bookingId' | 'expectedDurationMinutes' | 'baseAmount' | 'overtimeMinutes' | 'overtimeAmount' | 'totalAmount' | 'createdAt' | 'updatedAt'> & {
    /** Required when ratePlanId === CUSTOM_RATE_PLAN_ID; ignored otherwise. */
    totalAmount?: number;
  },
): Promise<Booking> {
  // 1. Validate range
  if (new Date(input.checkInAt) >= new Date(input.expectedCheckOutAt)) {
    throw new Error('checkInAt must be before expectedCheckOutAt');
  }

  const isCustom = input.ratePlanId === CUSTOM_RATE_PLAN_ID;

  // 2. Re-check overlap
  const overlap = await hasOverlap(
    spreadsheetId,
    input.roomId,
    input.checkInAt,
    input.expectedCheckOutAt,
  );
  if (overlap) {
    throw new Error(`Room ${input.roomId} is not available for the requested time`);
  }

  // 3. Calculate pricing — branch on custom vs predefined
  let expectedDurationMinutes: number;
  let baseAmount: number;
  let totalAmount: number;
  if (isCustom) {
    if (input.totalAmount === undefined || input.totalAmount < 0) {
      throw new Error('totalAmount is required for custom hourly bookings');
    }
    expectedDurationMinutes = diffMinutes(input.checkInAt, input.expectedCheckOutAt);
    baseAmount = 0;
    totalAmount = input.totalAmount;
  } else {
    ({ expectedDurationMinutes, baseAmount } = calculateBasePricing(
      input.ratePlanId,
      input.checkInAt,
      input.expectedCheckOutAt,
    ));
    totalAmount = baseAmount;
  }

  const bookingId = await generateId('BOOK', 'Bookings', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const booking: Booking = {
    ...input,
    bookingId,
    expectedDurationMinutes,
    baseAmount,
    overtimeMinutes: undefined,
    overtimeAmount: undefined,
    totalAmount,
    createdAt,
    updatedAt,
  };

  const existing = await sheets.getValues(spreadsheetId, `${SHEETS.Bookings}!A:A`);
  const nextRow = existing.length + 2;

  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Bookings}!A${nextRow}`,
    mapBookingToRow(booking),
  );

  return booking;
}

/**
 * Update mutable booking fields.
 * Re-checks overlap if roomId or dates change.
 *
 * For custom hourly bookings (ratePlanId === CUSTOM_RATE_PLAN_ID), pricing is
 * never recomputed — the receptionist-supplied total stays in place regardless
 * of date or plan changes.
 */
export async function update(
  spreadsheetId: string,
  bookingId: string,
  patch: Partial<Pick<Booking,
    | 'roomId'
    | 'checkInAt'
    | 'expectedCheckOutAt'
    | 'status'
    | 'source'
    | 'numGuests'
    | 'note'
  >> & { ratePlanId?: string; totalAmount?: number },
): Promise<Booking | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(b => b.bookingId === bookingId);
  if (idx === -1) return null;

  const existing = all[idx]!;

  const checkInAt = patch.checkInAt ?? existing.checkInAt;
  const expectedCheckOutAt = patch.expectedCheckOutAt ?? existing.expectedCheckOutAt;
  const roomId = patch.roomId ?? existing.roomId;

  // Re-check overlap if dates or room changed
  if (
    patch.checkInAt ||
    patch.expectedCheckOutAt ||
    patch.roomId
  ) {
    const overlap = await hasOverlap(
      spreadsheetId, roomId, checkInAt, expectedCheckOutAt, bookingId,
    );
    if (overlap) {
      throw new Error('Change would create a booking overlap');
    }
  }

  const isCustom = existing.ratePlanId === CUSTOM_RATE_PLAN_ID
    || patch.ratePlanId === CUSTOM_RATE_PLAN_ID;

  // Recalculate pricing only for predefined plans. Custom bookings keep their
  // manually-entered total even when dates move.
  let baseAmount = existing.baseAmount;
  let expectedDurationMinutes = existing.expectedDurationMinutes;
  let totalAmount: number;

  if (isCustom) {
    // If the patch carries a new totalAmount (rare, e.g. receptionist edits the
    // agreed price after creation), honour it; otherwise keep the stored value.
    totalAmount = patch.totalAmount ?? existing.totalAmount;
  } else {
    const ratePlanId = patch.ratePlanId ?? existing.ratePlanId;
    if (patch.checkInAt || patch.expectedCheckOutAt || patch.ratePlanId) {
      ({ expectedDurationMinutes, baseAmount } = calculateBasePricing(
        ratePlanId, checkInAt, expectedCheckOutAt,
      ));
    }
    totalAmount = baseAmount + (existing.overtimeAmount ?? 0);
  }

  const updated: Booking = {
    ...existing,
    ...patch,
    bookingId,                         // immutable
    customerId: existing.customerId,   // immutable
    expectedDurationMinutes,
    baseAmount,
    totalAmount,
    createdAt: existing.createdAt,     // immutable
    updatedAt: updatedTimestamp(),
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + BOOKINGS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Bookings}!A${sheetRow}:${col}`,
    [mapBookingToRow(updated)],
  );

  return updated;
}

/**
 * Record a guest checkout.
 *
 * - If actualCheckOutAt > expectedCheckOutAt → compute overtime
 * - Set status to 'checked_out'
 * - Return updated booking
 *
 * For custom hourly bookings (ratePlanId === CUSTOM_RATE_PLAN_ID), overtime
 * computation is skipped — the receptionist records any extra charges by hand
 * via a PATCH /api/bookings/:id with the new totalAmount.
 */
export async function checkout(
  spreadsheetId: string,
  bookingId: string,
  actualCheckOutAt: string,
): Promise<{ booking: Booking; overtimeMinutes: number; overtimeAmount: number } | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(b => b.bookingId === bookingId);
  if (idx === -1) return null;

  const existing = all[idx]!;

  let overtimeMinutes = 0;
  let overtimeAmount = 0;
  let totalAmount = existing.totalAmount;

  if (existing.ratePlanId !== CUSTOM_RATE_PLAN_ID) {
    // Compute overtime against the predefined rate plan.
    const durationMs = new Date(actualCheckOutAt).getTime() - new Date(existing.checkInAt).getTime();
    const actualMinutes = Math.round(durationMs / 60_000);
    overtimeMinutes = Math.max(0, actualMinutes - existing.expectedDurationMinutes);
    const overtimeHours = Math.ceil(overtimeMinutes / 60);
    const plan = getRatePlan(existing.ratePlanId);
    overtimeAmount = overtimeHours * plan.overtimeMinutePrice;
    totalAmount = existing.baseAmount + overtimeAmount;
  }

  const updated: Booking = {
    ...existing,
    actualCheckOutAt,
    overtimeMinutes: overtimeMinutes > 0 ? overtimeMinutes : undefined,
    overtimeAmount: overtimeAmount > 0 ? overtimeAmount : undefined,
    totalAmount,
    status: 'checked_out',
    updatedAt: updatedTimestamp(),
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + BOOKINGS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Bookings}!A${sheetRow}:${col}`,
    [mapBookingToRow(updated)],
  );

  return { booking: updated, overtimeMinutes, overtimeAmount };
}

// ─── Internal pricing helper ──────────────────────────────────────────────────────

function calculateBasePricing(
  ratePlanId: string,
  checkInAt: string,
  expectedCheckOutAt: string,
): { expectedDurationMinutes: number; baseAmount: number } {
  const plan = getRatePlan(ratePlanId);
  const expectedDurationMinutes = diffMinutes(checkInAt, expectedCheckOutAt);
  const extraMinutes = Math.max(0, expectedDurationMinutes - plan.baseMinutes);
  const extraAmount = extraMinutes * plan.extraMinutePrice;
  const baseAmount = plan.baseAmount + extraAmount;
  return { expectedDurationMinutes, baseAmount };
}
