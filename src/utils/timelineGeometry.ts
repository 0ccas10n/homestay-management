// ─── timelineGeometry ─────────────────────────────────────────────────────────────
//
// Shared geometry helper for Timeline and CalendarView booking blocks.
//
// Computes the visible segment of a booking inside an arbitrary date window
// using date-fns so the math is precise to the minute, not the day.
//
// Conventions:
//   - `windowStart` / `windowEnd` are YYYY-MM-DD date strings representing
//     midnight at the start of each day. `windowEnd` is EXCLUSIVE.
//   - `b.checkInAt` and `b.expectedCheckOutAt` are full ISO 8601 datetimes
//     with a timezone offset. `expectedCheckOutAt` is EXCLUSIVE — the
//     checkout minute does not count toward occupancy.
//   - Returned `leftPct` / `widthPct` are percentages of the window width,
//     so the caller can render with `left: ${leftPct}%; width: ${widthPct}%;`.
//   - Returns `null` when the booking has no intersection with the window.
// ──────────────────────────────────────────────────────────────────────────────

import { parseISO, differenceInMinutes } from 'date-fns';
import type { Booking } from '@/types/index';

export interface BlockGeometry {
  leftPct: number;
  widthPct: number;
}

export function bookingBlock(
  b: Booking,
  windowStart: string,
  windowEnd: string,
): BlockGeometry | null {
  const cinMs = parseISO(b.checkInAt).getTime();
  const coutMs = parseISO(b.expectedCheckOutAt).getTime(); // exclusive
  const tzOffset = b.checkInAt.includes('+')
    ? b.checkInAt.slice(b.checkInAt.lastIndexOf('+'))
    : (b.checkInAt.includes('-') && b.checkInAt.length > 19 ? b.checkInAt.slice(19) : '+07:00');
  const wStart = parseISO(`${windowStart}T00:00:00${tzOffset}`).getTime();
  const wEnd = parseISO(`${windowEnd}T00:00:00${tzOffset}`).getTime();

  const totalMin = differenceInMinutes(wEnd, wStart);
  if (totalMin <= 0) return null;

  // Clip the booking to the visible window.
  const segStart = Math.max(cinMs, wStart);
  const segEnd = Math.min(coutMs, wEnd);
  if (segStart >= segEnd) return null;

  return {
    leftPct: (differenceInMinutes(segStart, wStart) / totalMin) * 100,
    widthPct: (differenceInMinutes(segEnd, segStart) / totalMin) * 100,
  };
}

/**
 * Assign overlapping bookings to vertical "lanes" so they stack
 * side-by-side instead of overdrawing each other.
 *
 * Algorithm (greedy interval scheduling):
 *   - Sort bookings by checkInAt ascending.
 *   - For each booking, place it in the lowest-index lane whose previous
 *     booking has already ended (lane's `endTime <= this.start`).
 *   - If no such lane exists, open a new one at the end.
 *
 * Used by Timeline's RoomRow to render multi-day overlap stacks per room,
 * and by CalendarView's week rows for the same purpose. Returning the result
 * keyed by bookingId keeps the caller's render loop O(n).
 */
export interface LaneAssignment {
  /** bookingId → lane index (0-based). */
  blockLanes: Map<string, number>;
  /** Total lanes used by the bookings (always ≥ 1). */
  total: number;
}

export function assignLanes(
  bookings: Booking[],
  windowStart: string,
  windowEnd: string,
): LaneAssignment {
  const blockLanes = new Map<string, number>();
  const lanes: number[] = []; // each lane's last-end-time in ms

  // Only consider bookings that have visible geometry in the window.
  const visible = bookings
    .map(b => ({ b, geom: bookingBlock(b, windowStart, windowEnd) }))
    .filter((x): x is { b: Booking; geom: BlockGeometry } => x.geom !== null)
    .sort(
      (a, b) => parseISO(a.b.checkInAt).getTime() - parseISO(b.b.checkInAt).getTime(),
    );

  for (const { b } of visible) {
    const start = parseISO(b.checkInAt).getTime();
    const end = parseISO(b.expectedCheckOutAt).getTime();
    const freeIdx = lanes.findIndex(endTime => endTime <= start);
    if (freeIdx === -1) {
      lanes.push(end);
      blockLanes.set(b.bookingId, lanes.length - 1);
    } else {
      lanes[freeIdx] = end;
      blockLanes.set(b.bookingId, freeIdx);
    }
  }

  return { blockLanes, total: Math.max(1, lanes.length) };
}
