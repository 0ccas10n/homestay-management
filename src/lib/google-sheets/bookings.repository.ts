// ─── Bookings repository ──────────────────────────────────────────────────────────
//
// CRUD + conflict detection for the Bookings sheet.
// Implements the open-interval overlap rule from DATABASE.md §10:
//   Existing booking: [checkInAt, expectedCheckOutAt)
//   Requested stay:   [requestedCheckIn, requestedCheckOut)
//   They overlap when: existingStart < requestedEnd && existingEnd > requestedStart
//
// Checkout: records actualCheckOutAt, computes overtime, updates totalAmount.
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
 *  3. Calculate expectedDurationMinutes + baseAmount
 *  4. Insert into sheet
 *
 * @throws Error if dates are invalid, overlap detected, or room/customer/rate-plan not found.
 */
export async function create(
  spreadsheetId: string,
  input: Omit<Booking, 'bookingId' | 'expectedDurationMinutes' | 'baseAmount' | 'overtimeMinutes' | 'overtimeAmount' | 'totalAmount' | 'createdAt' | 'updatedAt'>,
): Promise<Booking> {
  // 1. Validate range
  if (new Date(input.checkInAt) >= new Date(input.expectedCheckOutAt)) {
    throw new Error('checkInAt must be before expectedCheckOutAt');
  }

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

  // 3. Calculate pricing
  const { expectedDurationMinutes, baseAmount } = calculateBasePricing(
    input.ratePlanId,
    input.checkInAt,
    input.expectedCheckOutAt,
  );

  const bookingId = await generateId('BOOK', 'Bookings', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const booking: Booking = {
    ...input,
    bookingId,
    expectedDurationMinutes,
    baseAmount,
    overtimeMinutes: undefined,
    overtimeAmount: undefined,
    totalAmount: baseAmount,
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
  >> & { ratePlanId?: string },
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

  // Recalculate pricing if rate plan, check-in, or check-out changed
  let baseAmount = existing.baseAmount;
  let expectedDurationMinutes = existing.expectedDurationMinutes;
  const ratePlanId = patch.ratePlanId ?? existing.ratePlanId;

  if (patch.checkInAt || patch.expectedCheckOutAt || patch.ratePlanId) {
    ({ expectedDurationMinutes, baseAmount } = calculateBasePricing(
      ratePlanId, checkInAt, expectedCheckOutAt,
    ));
  }

  const updated: Booking = {
    ...existing,
    ...patch,
    bookingId,                         // immutable
    customerId: existing.customerId,   // immutable
    expectedDurationMinutes,
    baseAmount,
    totalAmount: baseAmount + (existing.overtimeAmount ?? 0),
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

  // Compute overtime
  const durationMs = new Date(actualCheckOutAt).getTime() - new Date(existing.checkInAt).getTime();
  const actualMinutes = Math.round(durationMs / 60_000);
  const overtimeMinutes = Math.max(0, actualMinutes - existing.expectedDurationMinutes);
  const overtimeHours = Math.ceil(overtimeMinutes / 60);
  const plan = getRatePlan(existing.ratePlanId);
  const overtimeAmount = overtimeHours * plan.overtimeMinutePrice;

  const updated: Booking = {
    ...existing,
    actualCheckOutAt,
    overtimeMinutes: overtimeMinutes > 0 ? overtimeMinutes : undefined,
    overtimeAmount: overtimeAmount > 0 ? overtimeAmount : undefined,
    totalAmount: existing.baseAmount + overtimeAmount,
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
