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
import { CUSTOM_RATE_PLAN_ID } from '@/lib/api/validation';
import { findPrice } from './ratePlanPrices.repository';
import { ROOM_RATE_PRICES } from '../../../scripts/seedData';

// ─── Surcharge constants (同步 seedData.ts SURCHARGE_RULES) ───────────────────────
const OVERTIME_HOURLY_RATE = 70_000; // VND per overtime hour past expected check-out

// Standard fallback rates when RatePlanPrices is not yet seeded
const STANDARD_FALLBACK_RATES: Record<string, number> = {
  'RP-0001': 250_000,
  'RP-0002': 350_000,
  'RP-0003': 400_000,
  'RP-0004': 550_000,
};

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all bookings. Returns [] on error. */
export async function readAll(spreadsheetId: string): Promise<Booking[]> {
  try {
    const rawRows = await sheets.getValues(spreadsheetId, `${SHEETS.Bookings}!A1:Z`);
    if (!rawRows || rawRows.length === 0) return [];

    const headerRow = rawRows[0] || [];
    const dataRows = rawRows.slice(1);

    // Build a header-name → column-index map so we can read by field name
    // regardless of whether the sheet has 18-col (old seed) or 21-col (new) layout.
    const headerMap = new Map<string, number>();
    headerRow.forEach((h, idx) => {
      if (h) {
        const clean = String(h).toLowerCase().replace(/[\s_-]/g, '');
        headerMap.set(clean, idx);
      }
    });

    // Convenience: get a cell value by header name, fallback to fixedIdx if header missing.
    const byHeader = (row: string[], name: string, fixedIdx: number): string => {
      const idx = headerMap.get(name) ?? headerMap.get(name.replace(/[\s_-]/g, ''));
      return (idx !== undefined ? row[idx] : row[fixedIdx]) ?? '';
    };

    return dataRows
      .filter(row => row && row.length > 0 && row[0]?.trim())
      .map(row => {
        const booking = mapRowToBooking(row);

        // Override guestName using the header map — this is the reliable source
        // of truth when the sheet layout doesn't match the fixed indices expected
        // by mapRowToBooking (e.g. old 18-col sheet written by the original seed).
        const guestNameIdx = headerMap.get('guestname') ?? headerMap.get('guest_name');
        if (guestNameIdx !== undefined && row[guestNameIdx]) {
          booking.guestName = row[guestNameIdx].trim();
        }

        // Similarly fix numGuests if headerMap resolves it differently.
        const numGuestsIdx = headerMap.get('numguests') ?? headerMap.get('num_guests');
        if (numGuestsIdx !== undefined && row[numGuestsIdx]) {
          const n = parseInt(row[numGuestsIdx], 10);
          if (!isNaN(n)) booking.numGuests = n;
        }

        // Auto-fix if totalAmount is <= 10 (e.g. 1 or 2 VND caused by column shift from nights or num_guests)
        if (booking.totalAmount <= 10) {
          const totalIdx = headerMap.get('totalamount') ?? headerMap.get('total') ?? -1;
          const baseIdx = headerMap.get('baseamount') ?? headerMap.get('base') ?? -1;

          const rawTotal = totalIdx >= 0 && row[totalIdx] ? parseFloat(row[totalIdx]) : 0;
          const rawBase = baseIdx >= 0 && row[baseIdx] ? parseFloat(row[baseIdx]) : 0;

          const validOvertime = (booking.overtimeAmount && booking.overtimeAmount >= 1000) ? booking.overtimeAmount : 0;

          if (rawTotal >= 1000) {
            booking.totalAmount = rawTotal;
          } else if (rawBase >= 1000) {
            booking.baseAmount = rawBase;
            booking.totalAmount = rawBase + validOvertime;
          } else {
            const planRate = ROOM_RATE_PRICES[booking.roomId]?.[booking.ratePlanId] || STANDARD_FALLBACK_RATES[booking.ratePlanId] || 550_000;
            const diffMs = new Date(booking.expectedCheckOutAt).getTime() - new Date(booking.checkInAt).getTime();
            const nights = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
            booking.baseAmount = nights * planRate;
            if (booking.numGuests && booking.numGuests > 2) {
              booking.baseAmount += (booking.numGuests - 2) * 100_000 * nights;
            }
            booking.totalAmount = booking.baseAmount + validOvertime;
            booking.unitPriceAtBooking = planRate;
          }
        }
        return booking;
      });
  } catch (err) {
    console.error('[Bookings.readAll] Error:', err);
    return [];
  }
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
 *     - For `bookingType: 'hourly'`: skip rate-plan pricing, persist the
 *       caller-supplied `totalAmount` verbatim.
 *     - For `bookingType: 'daily'`:  compute pricing from the rate plan.
 *  4. Insert into sheet
 *
 * Backwards compatibility:
 *   - If the caller doesn't supply `bookingType` but does supply
 *     `ratePlanId === CUSTOM_RATE_PLAN_ID` (the legacy sentinel), the booking
 *     is treated as `bookingType: 'hourly'` with the custom totalAmount.
 *   - If `bookingType === 'hourly'` the caller MUST supply `totalAmount`.
 *
 * @throws Error if dates are invalid, overlap detected, room not found, or
 *         an hourly booking is missing totalAmount.
 */
export async function create(
  spreadsheetId: string,
  input: Omit<Booking, 'bookingId' | 'expectedDurationMinutes' | 'baseAmount' | 'overtimeMinutes' | 'overtimeAmount' | 'totalAmount' | 'createdAt' | 'updatedAt'> & {
    /** Required when bookingType === 'hourly'; ignored otherwise. */
    totalAmount?: number;
  },
): Promise<Booking> {
  // 1. Validate range
  if (new Date(input.checkInAt) >= new Date(input.expectedCheckOutAt)) {
    throw new Error('checkInAt must be before expectedCheckOutAt');
  }

  // Resolve effective bookingType — honour the new field, but fall back to the
  // legacy CUSTOM_RATE_PLAN_ID sentinel for older callers.
  const bookingType: Booking['bookingType'] =
    input.bookingType ?? (input.ratePlanId === CUSTOM_RATE_PLAN_ID ? 'hourly' : 'daily');

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

  // 3. Calculate pricing — honor caller-supplied totalAmount when present
  //    (e.g. receptionist entered a custom hourly total); otherwise look up
  //    the real room-specific price from the RatePlanPrices sheet via the
  //    updated calculateBasePricing helper.
  let expectedDurationMinutes: number;
  let baseAmount: number;
  let totalAmount: number;
  /** Per-night VND snapshot for daily bookings; manual total for hourly. */
  let unitPriceAtBooking: number;

  if (input.totalAmount !== undefined && input.totalAmount > 0) {
    expectedDurationMinutes = diffMinutes(input.checkInAt, input.expectedCheckOutAt);
    // For hourly/custom bookings the receptionist enters a single price that
    // covers the entire stay. Store it in both baseAmount and totalAmount so
    // the sheet is consistent and reports can sum baseAmount reliably.
    baseAmount = input.totalAmount;
    totalAmount = input.totalAmount;
    unitPriceAtBooking = input.totalAmount;
  } else {
    ({ expectedDurationMinutes, baseAmount, unitPriceAtBooking } =
      await calculateBasePricing(
        spreadsheetId,
        input.roomId,
        input.ratePlanId,
        input.checkInAt,
        input.expectedCheckOutAt,
        input.numGuests,
      ));
    totalAmount = baseAmount;
  }

  const bookingId = await generateId('BOOK', 'Bookings', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const booking: Booking = {
    ...input,
    bookingId,
    bookingType,
    expectedDurationMinutes,
    baseAmount,
    overtimeMinutes: undefined,
    overtimeAmount: undefined,
    totalAmount,
    unitPriceAtBooking,
    createdAt,
    updatedAt,
  };

  // Range is the WHOLE COLUMN (e.g. Bookings!A:A), not a specific row.
  // Pass a column-shaped range so Google Sheets `values.append` does a
  // pure append at the table's trailing edge instead of inserting a
  // phantom empty row above the new one. (See client.ts for context.)
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Bookings}!A:A`,
    mapBookingToRow(booking),
  );

  return booking;
}

/**
 * Update mutable booking fields.
 * Re-checks overlap if roomId or dates change.
 *
 * For hourly bookings (bookingType === 'hourly' or legacy CUSTOM_RATE_PLAN_ID),
 * pricing is never recomputed — the receptionist-supplied total stays in place
 * regardless of date or plan changes.
 */
export async function update(
  spreadsheetId: string,
  bookingId: string,
  patch: Partial<Pick<Booking,
    | 'roomId'
    | 'checkInAt'
    | 'expectedCheckOutAt'
    | 'status'
    | 'numGuests'
    | 'note'
    | 'bookingType'
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

  // Hourly if either the existing row or the patch says so — or legacy sentinel.
  const isHourly =
    existing.bookingType === 'hourly' ||
    patch.bookingType === 'hourly' ||
    existing.ratePlanId === CUSTOM_RATE_PLAN_ID ||
    patch.ratePlanId === CUSTOM_RATE_PLAN_ID;

  // Recalculate pricing only for daily bookings. Hourly ones keep their
  // manually-entered total even when dates move.
  let baseAmount = existing.baseAmount;
  let expectedDurationMinutes = existing.expectedDurationMinutes;
  let totalAmount: number;
  // Keep the unit-price snapshot in sync when the (room, rate plan) pair that
  // determines it actually changes. Otherwise leave the original snapshot
  // intact so historical reports stay anchored to what was priced at create.
  let unitPriceAtBooking = existing.unitPriceAtBooking;

  if (isHourly) {
    // If the patch carries a new totalAmount (rare, e.g. receptionist edits the
    // agreed price after creation), honour it; otherwise keep the stored value.
    totalAmount = patch.totalAmount ?? existing.totalAmount;
    if (patch.totalAmount !== undefined && patch.totalAmount > 0) {
      unitPriceAtBooking = patch.totalAmount;
    }
  } else {
    const ratePlanId = patch.ratePlanId ?? existing.ratePlanId;
    if (patch.checkInAt || patch.expectedCheckOutAt || patch.ratePlanId || patch.roomId || patch.numGuests) {
      ({ expectedDurationMinutes, baseAmount, unitPriceAtBooking } =
        await calculateBasePricing(
          spreadsheetId,
          roomId,
          ratePlanId,
          checkInAt,
          expectedCheckOutAt,
          patch.numGuests ?? existing.numGuests,
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
    unitPriceAtBooking,
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
 * For hourly bookings (bookingType === 'hourly' or legacy CUSTOM_RATE_PLAN_ID),
 * overtime computation is skipped — the receptionist records any extra charges
 * by hand via a PATCH /api/bookings/:id with the new totalAmount.
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

  const isHourly =
    existing.bookingType === 'hourly' ||
    existing.ratePlanId === CUSTOM_RATE_PLAN_ID;

  if (!isHourly) {
    // Overtime = how many minutes past expectedCheckOutAt the guest actually left.
    // DATABASE.md §10: overtimeMinutes = actualCheckOutAt − expectedCheckOutAt
    const overtimeMs = new Date(actualCheckOutAt).getTime() - new Date(existing.expectedCheckOutAt).getTime();
    overtimeMinutes = Math.max(0, Math.round(overtimeMs / 60_000));
    const overtimeHours = Math.ceil(overtimeMinutes / 60);
    overtimeAmount = overtimeHours * OVERTIME_HOURLY_RATE;
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

/**
 * Look up the per-(room, rate plan) price from the RatePlanPrices sheet and
 * compute the base stay charge.
 *
 * Pricing model:
 *   - Stay length = round(checkIn → expectedCheckOut) / 1440 minutes,
 *     with a floor of 1 day.
 *   - Base stay = diffDays × priceVnd (priceVnd is the nightly rate).
 *   - Extra guest surcharge: 100,000 VND per extra guest per night when
 *     numGuests > 2 (the first 2 guests are included in priceVnd).
 *
 * @returns expectedDurationMinutes (raw diff in minutes, for the sheet) and
 *          baseAmount (the unrounded total to charge for the stay).
 */
async function calculateBasePricing(
  spreadsheetId: string,
  roomId: string,
  ratePlanId: string,
  checkInAt: string,
  expectedCheckOutAt: string,
  numGuests?: number,
): Promise<{ expectedDurationMinutes: number; baseAmount: number; unitPriceAtBooking: number }> {
  // 1. Look up the room-specific price for this rate plan.
  const priceRecord = await findPrice(spreadsheetId, ratePlanId, roomId).catch(() => null);
  console.log('[SERVER calculateBasePricing] ratePlanId:', ratePlanId, 'roomId:', roomId, '→ priceRecord:', priceRecord);
  
  let priceVnd = priceRecord?.priceVnd ?? 0;
  if (priceVnd <= 0) {
    priceVnd = ROOM_RATE_PRICES[roomId]?.[ratePlanId] || STANDARD_FALLBACK_RATES[ratePlanId] || 550_000;
  }

  // 2. Compute length of stay in nights (24h slices, min 1).
  //    Use Math.ceil so a 25h stay bills as 2 nights, not 1 — consistent with
  //    pricing.ts and the principle that any started day is a full billable day.
  const expectedDurationMinutes = diffMinutes(checkInAt, expectedCheckOutAt);
  const diffDays = Math.max(1, Math.ceil(expectedDurationMinutes / 1440));

  // 3. Base stay charge.
  let baseAmount = diffDays * priceVnd;

  // 4. Extra guest surcharge: 100,000 VND / extra guest / night, > 2 guests.
  if (numGuests && numGuests > 2) {
    baseAmount += (numGuests - 2) * 100_000 * diffDays;
  }

  // 5. Snapshot the per-night unit price for this booking row.
  //    Stored verbatim so historical reports survive later RatePlanPrices edits.
  return { expectedDurationMinutes, baseAmount, unitPriceAtBooking: priceVnd };
}
