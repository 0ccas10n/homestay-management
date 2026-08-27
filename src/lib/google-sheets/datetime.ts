// ─── Timezone-aware datetime helpers ─────────────────────────────────────────────
//
// All datetimes in this application are stored as ISO 8601 strings with explicit
// timezone offset (e.g. "2026-08-28T14:00:00+07:00").
//
// Never use naive Date objects or strings without an offset.
// When displaying to the user, always render in the configured business timezone.
// When comparing, always use UTC milliseconds from Date.getTime().
//
// This module is SERVER-SIDE ONLY — do not import in client-side code.
// ──────────────────────────────────────────────────────────────────────────────

/** The default business timezone. Override via the BUSINESS_TZ env var. */
export const BUSINESS_TZ = process.env.BUSINESS_TZ ?? 'Asia/Ho_Chi_Minh';

/** Local timezone offset string, e.g. "+07:00". */
export const LOCAL_TZ_OFFSET = '+07:00';

/** Build an ISO 8601 string at a given local time on a given date. */
export function toIsoDateTime(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00${LOCAL_TZ_OFFSET}`;
}

/** Format a Date to "YYYY-MM-DD" in the business timezone. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format a Date to "HH:MM" in the business timezone. */
export function toTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Current timestamp as ISO 8601 string in business timezone. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Current date as "YYYY-MM-DD" string in business timezone. */
export function today(): string {
  return toDateString(new Date());
}

/** Minutes between two ISO datetime strings. */
export function diffMinutes(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
}

/**
 * Check whether two datetime windows overlap (open interval: [start, end)).
 * Used for availability/conflict detection.
 */
export function windowsOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

/**
 * Validate that checkInAt < expectedCheckOutAt and both are valid ISO strings.
 */
export function isValidBookingRange(checkInAt: string, expectedCheckOutAt: string): boolean {
  const a = new Date(checkInAt);
  const b = new Date(expectedCheckOutAt);
  return !isNaN(a.getTime()) && !isNaN(b.getTime()) && a < b;
}

/**
 * Generate a "created_at / updated_at" timestamp pair.
 */
export function timestamps(): { createdAt: string; updatedAt: string } {
  const ts = nowIso();
  return { createdAt: ts, updatedAt: ts };
}

/** Advance `updatedAt` to now. */
export function updatedTimestamp(): string {
  return nowIso();
}
