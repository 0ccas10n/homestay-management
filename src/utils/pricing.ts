// ─── Pricing & availability utilities ──────────────────────────────────────────
//
// This module handles three concerns:
//  1. Duration / amount calculations from ISO 8601 datetimes  (canonical — data model)
//  2. Live countdown helpers using "HH:MM" strings             (Timeline UI — preserved as-is)
//  3. Overlap / conflict detection using ISO 8601 datetimes   (availability)
//
// All datetime logic uses ISO 8601 strings with explicit timezone offset (e.g. +07:00).
// ──────────────────────────────────────────────────────────────────────────────

import type { RatePlan, Booking } from '../types/index';
import { ratePlans } from '../data/hourlyData';

// ─── 1. Duration helpers (ISO 8601) ─────────────────────────────────────────────

/** Parse an ISO 8601 datetime string to a Date object. */
export function parseDateTime(iso: string): Date {
  return new Date(iso);
}

/**
 * Minutes between two ISO 8601 datetimes.
 * Handles timezone offsets correctly by using Date arithmetic.
 */
export function diffMinutes(startIso: string, endIso: string): number {
  const start = parseDateTime(startIso).getTime();
  const end = parseDateTime(endIso).getTime();
  return Math.round((end - start) / 60_000);
}

/**
 * Classify a stay duration for display purposes.
 * These are labels only — the data model stores exact datetimes.
 */
export type StayType = 'short_stay' | 'overnight' | 'multi_day';

export function classifyStay(expectedDurationMinutes: number): StayType {
  if (expectedDurationMinutes < 720)  return 'short_stay';
  if (expectedDurationMinutes < 1440) return 'overnight';
  return 'multi_day';
}

export function stayTypeLabel(type: StayType): string {
  return { short_stay: 'Short Stay', overnight: 'Overnight', multi_day: 'Multi-Day' }[type];
}

// ─── 2. Pricing calculation (ISO 8601) ─────────────────────────────────────────

export interface PriceBreakdown {
  ratePlanId: string;
  ratePlanName: string;
  ratePlanType: string;
  baseMinutes: number;
  baseAmount: number;
  extraMinutes: number;
  extraAmount: number;
  overtimeMinutes: number;
  overtimeHours: number;
  overtimeAmount: number;
  totalAmount: number;
  expectedDurationMinutes: number;
  expectedCheckOutAt: string;
}

/**
 * Calculate price for a booking from its exact datetimes.
 *
 * - `checkInAt` + `expectedCheckOutAt` determine base charge via the rate plan.
 * - `actualCheckOutAt` (if provided) triggers overtime calculation.
 *   Overtime is always relative to `expectedCheckOutAt`.
 *
 * @param ratePlanId   The rate plan to use.
 * @param checkInAt    ISO 8601 check-in datetime.
 * @param expectedCheckOutAt  ISO 8601 expected check-out datetime.
 * @param actualCheckOutAt    Optional — actual check-out datetime for overtime calc.
 */
export function calculatePrice(
  ratePlanId: string,
  checkInAt: string,
  expectedCheckOutAt: string,
  actualCheckOutAt?: string,
): PriceBreakdown {
  const plan = ratePlans.find(p => p.ratePlanId === ratePlanId) ?? ratePlans[0];
  const expectedDurationMinutes = diffMinutes(checkInAt, expectedCheckOutAt);

  // Base + extra charge
  const extraMinutes = Math.max(0, expectedDurationMinutes - plan.baseMinutes);
  const extraAmount = extraMinutes * plan.extraMinutePrice;
  const baseAmount = plan.baseAmount;

  // Overtime (only if actual check-out is after expected)
  let overtimeMinutes = 0;
  let overtimeHours = 0;
  let overtimeAmount = 0;

  if (actualCheckOutAt) {
    const actualDurationMinutes = diffMinutes(checkInAt, actualCheckOutAt);
    const diff = actualDurationMinutes - expectedDurationMinutes;
    overtimeMinutes = Math.max(0, diff);
    overtimeHours = Math.ceil(overtimeMinutes / 60);
    overtimeAmount = overtimeHours * plan.overtimeMinutePrice;
  }

  return {
    ratePlanId: plan.ratePlanId,
    ratePlanName: plan.name,
    ratePlanType: plan.type,
    baseMinutes: plan.baseMinutes,
    baseAmount,
    extraMinutes,
    extraAmount,
    overtimeMinutes,
    overtimeHours,
    overtimeAmount,
    totalAmount: baseAmount + extraAmount + overtimeAmount,
    expectedDurationMinutes,
    expectedCheckOutAt,
  };
}

/**
 * Legacy signature for the Timeline UI (HH:MM strings + hours).
 * Converts to ISO 8601 internally and delegates to the main overload.
 *
 * @deprecated Use calculatePrice above for new code.
 */
export function calculatePriceLegacy(
  ratePlanId: string,
  checkInTime: string,
  bookedHours: number,
  actualOutTime?: string,
): PriceBreakdown {
  const plan = ratePlans.find(p => p.ratePlanId === ratePlanId) ?? ratePlans[0];

  // Build ISO datetimes anchored to today for the calculation window
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tz = now.toTimeString().slice(9, 17); // "+HH:MM"

  function dt(time: string, offsetDays = 0): string {
    if (offsetDays !== 0) {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}T${time}:00${tz}`;
    }
    return `${today}T${time}:00${tz}`;
  }

  // Checkout may be next day (e.g. overnight plan)
  const [inH, inM] = checkInTime.split(':').map(Number);
  const totalCheckoutMin = inH * 60 + inM + Math.round(bookedHours * 60);
  const checkoutDayOffset = totalCheckoutMin >= 1440 ? 1 : 0;
  const checkoutTime = `${String(Math.floor((totalCheckoutMin % 1440) / 60)).padStart(2, '0')}:${String(totalCheckoutMin % 60).padStart(2, '0')}`;

  const checkInAt = dt(checkInTime);
  const expectedCheckOutAt = dt(checkoutTime, checkoutDayOffset);

  const expectedDurationMinutes = diffMinutes(checkInAt, expectedCheckOutAt);
  const extraMinutes = Math.max(0, expectedDurationMinutes - plan.baseMinutes);
  const extraAmount = extraMinutes * plan.extraMinutePrice;
  const baseAmount = plan.baseAmount;

  let overtimeMinutes = 0;
  let overtimeHours = 0;
  let overtimeAmount = 0;

  if (actualOutTime) {
    const [outH, outM] = actualOutTime.split(':').map(Number);
    const totalActualOutMin = outH * 60 + outM;
    const actualDayOffset = totalActualOutMin <= inH * 60 + inM && bookedHours > 12 ? 1 : 0;
    const actualOutIso = dt(actualOutTime, actualDayOffset);
    const actualDurationMinutes = diffMinutes(checkInAt, actualOutIso);
    const diff = actualDurationMinutes - expectedDurationMinutes;
    overtimeMinutes = Math.max(0, diff);
    overtimeHours = Math.ceil(overtimeMinutes / 60);
    overtimeAmount = overtimeHours * plan.overtimeMinutePrice;
  }

  return {
    ratePlanId: plan.ratePlanId,
    ratePlanName: plan.name,
    ratePlanType: plan.type,
    baseMinutes: plan.baseMinutes,
    baseAmount,
    extraMinutes,
    extraAmount,
    overtimeMinutes,
    overtimeHours,
    overtimeAmount,
    totalAmount: baseAmount + extraAmount + overtimeAmount,
    expectedDurationMinutes,
    expectedCheckOutAt,
  };
}

/** Get a rate plan by ID. Falls back to the first plan. */
export function getRatePlan(planId: string): RatePlan {
  return ratePlans.find(p => p.ratePlanId === planId) ?? ratePlans[0];
}

// ─── 3. Overlap / conflict detection (ISO 8601) ─────────────────────────────────

/**
 * Check whether a requested time window overlaps any active booking for a room.
 * Uses the open-interval rule: [checkInAt, expectedCheckOutAt).
 *
 * A booking that ends exactly when another starts does NOT count as an overlap.
 */
export function hasOverlap(
  roomId: string,
  checkInAt: string,
  expectedCheckOutAt: string,
  existingBookings: Pick<Booking, 'bookingId' | 'roomId' | 'checkInAt' | 'expectedCheckOutAt' | 'status'>[],
  excludeBookingId?: string,
): boolean {
  return existingBookings
    .filter(b =>
      b.roomId === roomId &&
      b.status !== 'cancelled' &&
      b.status !== 'checked_out' &&
      b.bookingId !== excludeBookingId,
    )
    .some(b => {
      // Open interval: [checkIn, expectedCheckOut)
      const existingStart = parseDateTime(b.checkInAt).getTime();
      const existingEnd   = parseDateTime(b.expectedCheckOutAt).getTime();
      const requestedStart = parseDateTime(checkInAt).getTime();
      const requestedEnd   = parseDateTime(expectedCheckOutAt).getTime();
      return existingStart < requestedEnd && existingEnd > requestedStart;
    });
}

/**
 * Check whether a proposed datetime range is valid
 * (checkIn must be before checkOut).
 */
export function isValidRange(checkInAt: string, expectedCheckOutAt: string): boolean {
  return parseDateTime(checkInAt) < parseDateTime(expectedCheckOutAt);
}

// ─── 4. Overtime countdown helpers ─────────────────────────────────────────────

/**
 * Minutes remaining until the expected check-out.
 * Handles overnight stays where checkOutAt is before checkInAt on the clock.
 */
export function minutesUntilCheckout(
  checkInAt: string,
  expectedCheckOutAt: string,
  now: Date = new Date(),
): number {
  const checkOutMs = parseDateTime(expectedCheckOutAt).getTime();
  const nowMs     = now.getTime();
  return Math.round((checkOutMs - nowMs) / 60_000);
}

/**
 * Format a minutes value as a human-readable countdown string.
 * e.g. -45 → "Overtime 45m",  90 → "1h 30m"
 */
export function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return minutes < 0 ? `Overtime ${abs}m` : `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes < 0 ? 'Overtime ' : '';
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

// ─── 5. Live countdown helpers (HH:MM strings — Timeline UI) ──────────────────────
// These are preserved verbatim from the original pricing.ts so the Timeline page
// continues to work without changes.
// ─────────────────────────────────────────────────────────────────────────────

export type HourlyStatus =
  | 'Upcoming'
  | 'Active'
  | 'Warning'
  | 'Critical'
  | 'Overtime'
  | 'Completed';

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(totalMin: number): string {
  const clamped = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Compute the live HourlyStatus for a booking, given the current clock minutes.
 * Overload 1: object signature (used by Timeline page)
 * Overload 2: individual params signature (general use)
 */
export function getBookingStatus(
  booking: { checkInTime: string; checkOutTime: string; actualCheckOutTime?: string },
  nowMin: number,
): HourlyStatus;
export function getBookingStatus(
  checkInTime: string,
  checkOutTime: string,
  actualCheckOutTime: string | undefined,
  nowMin: number,
): HourlyStatus;
export function getBookingStatus(
  checkInTimeOrBooking: string | { checkInTime: string; checkOutTime: string; actualCheckOutTime?: string },
  nowMinOrCheckOut: number | string,
  actualCheckOutTime?: string,
  nowMin?: number,
): HourlyStatus {
  let checkInTime: string;
  let checkOutTime: string;
  let actualCheckOut: string | undefined;
  let currentNowMin: number;

  if (typeof checkInTimeOrBooking === 'object') {
    checkInTime = checkInTimeOrBooking.checkInTime;
    checkOutTime = checkInTimeOrBooking.checkOutTime;
    actualCheckOut = checkInTimeOrBooking.actualCheckOutTime;
    currentNowMin = nowMinOrCheckOut as number;
  } else {
    checkInTime = checkInTimeOrBooking;
    checkOutTime = nowMinOrCheckOut as string;
    actualCheckOut = actualCheckOutTime;
    currentNowMin = nowMin as number;
  }

  const inMin  = timeToMin(checkInTime);
  const outMin = timeToMin(checkOutTime);

  const isOvernight = outMin < inMin;
  const effectiveOut  = isOvernight ? outMin + 1440 : outMin;
  const effectiveNow = isOvernight && currentNowMin < outMin ? currentNowMin + 1440 : currentNowMin;

  if (effectiveNow < inMin) return 'Upcoming';

  const minutesLeft = effectiveOut - effectiveNow;
  if (minutesLeft < 0) return actualCheckOut ? 'Completed' : 'Overtime';
  if (minutesLeft <= 15) return 'Critical';
  if (minutesLeft <= 30) return 'Warning';
  return 'Active';
}

export function getStatusColor(status: HourlyStatus): string {
  return {
    Upcoming: '#8B5CF6',
    Active: '#2563EB',
    Warning: '#F59E0B',
    Critical: '#EF4444',
    Overtime: '#7F1D1D',
    Completed: '#94A3B8',
  }[status] as string;
}

export function getStatusBg(status: HourlyStatus): string {
  return {
    Upcoming: '#EDE9FE',
    Active: '#DBEAFE',
    Warning: '#FEF3C7',
    Critical: '#FEE2E2',
    Overtime: '#FEE2E2',
    Completed: '#F1F5F9',
  }[status] as string;
}

/**
 * Conflict detection for the Timeline UI (HH:MM strings).
 * Kept for backwards compatibility with the Timeline page's live conflict checks.
 */
export function hasConflict(
  roomNumber: string,
  checkInTime: string,
  checkOutTime: string,
  existingBookings: { id: string; roomNumber: string; checkInTime: string; checkOutTime: string; actualCheckOutTime?: string }[],
  excludeId?: string,
): boolean {
  const newIn  = timeToMin(checkInTime);
  const newOut = timeToMin(checkOutTime);
  const newOutAdj = newOut <= newIn ? newOut + 1440 : newOut;

  return existingBookings
    .filter(b =>
      b.roomNumber === roomNumber &&
      b.id !== excludeId &&
      !b.actualCheckOutTime,
    )
    .some(b => {
      const bIn  = timeToMin(b.checkInTime);
      const bOut = timeToMin(b.checkOutTime);
      const bOutAdj = bOut <= bIn ? bOut + 1440 : bOut;
      return newIn < bOutAdj && newOutAdj > bIn;
    });
}

/**
 * Minutes until checkout for the Timeline page (HH:MM strings).
 * Overload 1: booking object signature (used by Timeline page)
 * Overload 2: individual params signature (general use)
 */
export function minutesUntilCheckoutUI(
  booking: { checkInTime: string; checkOutTime: string },
  nowMin: number,
): number;
export function minutesUntilCheckoutUI(
  checkInTime: string,
  checkOutTime: string,
  nowMin: number,
): number;
export function minutesUntilCheckoutUI(
  checkInTimeOrBooking: string | { checkInTime: string; checkOutTime: string },
  nowMinOrCheckOut: number | string,
  nowMin?: number,
): number {
  let checkInTime: string;
  let checkOutTime: string;
  let currentNowMin: number;

  if (typeof checkInTimeOrBooking === 'object') {
    checkInTime = checkInTimeOrBooking.checkInTime;
    checkOutTime = checkInTimeOrBooking.checkOutTime;
    currentNowMin = nowMinOrCheckOut as number;
  } else {
    checkInTime = checkInTimeOrBooking;
    checkOutTime = nowMinOrCheckOut as string;
    currentNowMin = nowMin as number;
  }

  const inMin  = timeToMin(checkInTime);
  const outMin = timeToMin(checkOutTime);
  const isOvernight = outMin < inMin;
  const effectiveOut  = isOvernight ? outMin + 1440 : outMin;
  const effectiveNow = isOvernight && currentNowMin < outMin ? currentNowMin + 1440 : currentNowMin;
  return effectiveOut - effectiveNow;
}
