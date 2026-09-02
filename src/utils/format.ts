// ─── Shared display formatters ─────────────────────────────────────────────────────
//
// Centralised Intl.NumberFormat instances so every page renders VND the same way.
// VND has no fractional units, so we suppress cents via maximumFractionDigits: 0.

/**
 * Vietnamese Dong currency formatter.
 *
 * Examples:
 *   formatVnd(0)        → "0 ₫"
 *   formatVnd(250000)   → "250.000 ₫"
 *   formatVnd(1500000)  → "1.500.000 ₫"
 */
export const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/** Convenience wrapper for ad-hoc formatting. */
export function formatVnd(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '—';
  return vndFormatter.format(amount);
}

/**
 * Get the accurate total amount in VND for a booking.
 * Auto-corrects legacy or corrupted database records that store small values like 1 or 2 (which were night counts).
 */
export function getBookingTotal(b: any): number {
  if (!b) return 0;
  // Overtime amount in VND is at least 1,000 VND (ignore if it's small like 118 minutes)
  const validOvertime = (typeof b.overtimeAmount === 'number' && b.overtimeAmount >= 1000) ? b.overtimeAmount : 0;

  if (typeof b.totalAmount === 'number' && b.totalAmount >= 1000) {
    // If totalAmount was tainted by small overtime like 118, remove the small cents/minutes
    if (b.totalAmount % 1000 !== 0 && typeof b.baseAmount === 'number' && b.baseAmount >= 1000) {
      return b.baseAmount + validOvertime;
    }
    return b.totalAmount;
  }
  if (typeof b.baseAmount === 'number' && b.baseAmount >= 1000) {
    return b.baseAmount + validOvertime;
  }

  const ROOM_FALLBACK_RATES: Record<string, Record<string, number>> = {
    'ROOM-0001': { 'RP-0001': 250_000, 'RP-0002': 350_000, 'RP-0003': 400_000, 'RP-0004': 550_000 },
    'ROOM-0002': { 'RP-0001': 250_000, 'RP-0002': 350_000, 'RP-0003': 400_000, 'RP-0004': 550_000 },
    'ROOM-0003': { 'RP-0001': 250_000, 'RP-0002': 350_000, 'RP-0003': 400_000, 'RP-0004': 550_000 },
    'ROOM-0004': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0005': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0006': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0007': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0008': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0009': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0010': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0011': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
    'ROOM-0012': { 'RP-0001': 300_000, 'RP-0002': 450_000, 'RP-0003': 500_000, 'RP-0004': 650_000 },
  };
  const STANDARD_RATES: Record<string, number> = {
    'RP-0001': 250_000,
    'RP-0002': 350_000,
    'RP-0003': 400_000,
    'RP-0004': 550_000,
  };
  const rate = ROOM_FALLBACK_RATES[b.roomId]?.[b.ratePlanId] || STANDARD_RATES[b.ratePlanId] || 550_000;
  if (b.checkInAt && b.expectedCheckOutAt) {
    const diffMs = new Date(b.expectedCheckOutAt).getTime() - new Date(b.checkInAt).getTime();
    const nights = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    let base = nights * rate;
    if (b.numGuests && b.numGuests > 2) {
      base += (b.numGuests - 2) * 100_000 * nights;
    }
    return base + (b.overtimeAmount || 0);
  }
  return rate;
}

/**
 * Turns a raw snake_case status/priority value into a human-readable label.
 * Examples: "checked_in" → "Checked In", "no_show" → "No Show", "high" → "High".
 * Already-formatted input (e.g. "Checked In") passes through unchanged.
 */
export function formatStatusLabel(status: string | undefined | null): string {
  if (!status) return '';
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
