// ─── seedData.ts ─────────────────────────────────────────────────────────────────────
//
// Real business data for the Homestay Management app.
// All values match the types in src/types/index.ts.
//
// To update pricing, edit this file and re-run the seed script.
// ──────────────────────────────────────────────────────────────────────────────

// ─── Locations ─────────────────────────────────────────────────────────────────────

export const LOCATIONS = [
  {
    locationId: 'LOC-0001',
    name: 'Bình Lợi Trung',
    description: 'Bình Lợi Trung location',
    publicAddress: 'Bình Lợi Trung, Bình Thạnh, Hồ Chí Minh',
    phone: '+84 899884470',
    active: true,
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
  {
    locationId: 'LOC-0002',
    name: 'Thạnh Mỹ Tây',
    description: 'Thạnh Mỹ Tây location',
    publicAddress: 'Thạnh Mỹ Tây, Bình Chánh, Hồ Chí Minh',
    phone: '+84 8 0000 0002',
    active: true,
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
];

// ─── Rooms ─────────────────────────────────────────────────────────────────────────
//
// Room types:
//   Standard (Hiên): capacity 4, 1 double bed + 1 single bed
//   Deluxe (Yên):    capacity 5, 1 double bed + 2 single beds
//
// Amenities:
//   Standard: WiFi, AC, TV, Electric fan, Hot water, Parking
//   Deluxe:   WiFi, AC, TV, Electric fan, Hot water, Parking, Fridge

export const ROOMS = [
  // Bình Lợi Trung — Hiên rooms (Standard)
  {
    roomId: 'ROOM-0001',
    locationId: 'LOC-0001',
    name: 'Hiên 1',
    description: 'Standard room — 1 double bed + 1 single bed (max 4 guests)',
    capacity: 4,
    priceDisplay: 'Từ 350.000 ₫/đêm',
    status: 'available' as const,
    active: true,
    floor: 1,
    amenities: ['WiFi', 'AC', 'TV', 'Electric fan', 'Hot water', 'Parking'],
    notes: '',
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
  {
    roomId: 'ROOM-0002',
    locationId: 'LOC-0001',
    name: 'Hiên 2',
    description: 'Standard room — 1 double bed + 1 single bed (max 4 guests)',
    capacity: 4,
    priceDisplay: 'Từ 350.000 ₫/đêm',
    status: 'available' as const,
    active: true,
    floor: 1,
    amenities: ['WiFi', 'AC', 'TV', 'Electric fan', 'Hot water', 'Parking'],
    notes: '',
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
  {
    roomId: 'ROOM-0003',
    locationId: 'LOC-0001',
    name: 'Hiên 3',
    description: 'Standard room — 1 double bed + 1 single bed (max 4 guests)',
    capacity: 4,
    priceDisplay: 'Từ 350.000 ₫/đêm',
    status: 'available' as const,
    active: true,
    floor: 1,
    amenities: ['WiFi', 'AC', 'TV', 'Electric fan', 'Hot water', 'Parking'],
    notes: '',
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
  // Thạnh Mỹ Tây — Yên rooms (Deluxe)
  {
    roomId: 'ROOM-0004',
    locationId: 'LOC-0002',
    name: 'Yên 1',
    description: 'Deluxe room — 1 double bed + 2 single beds (max 5 guests)',
    capacity: 5,
    priceDisplay: 'Từ 450.000 ₫/đêm',
    status: 'available' as const,
    active: true,
    floor: 1,
    amenities: ['WiFi', 'AC', 'TV', 'Electric fan', 'Hot water', 'Parking', 'Fridge'],
    notes: '',
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
  {
    roomId: 'ROOM-0005',
    locationId: 'LOC-0002',
    name: 'Yên 2',
    description: 'Deluxe room — 1 double bed + 2 single beds (max 5 guests)',
    capacity: 5,
    priceDisplay: 'Từ 450.000 ₫/đêm',
    status: 'available' as const,
    active: true,
    floor: 1,
    amenities: ['WiFi', 'AC', 'TV', 'Electric fan', 'Hot water', 'Parking', 'Fridge'],
    notes: '',
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
  {
    roomId: 'ROOM-0006',
    locationId: 'LOC-0002',
    name: 'Yên 3',
    description: 'Deluxe room — 1 double bed + 2 single beds (max 5 guests)',
    capacity: 5,
    priceDisplay: 'Từ 450.000 ₫/đêm',
    status: 'available' as const,
    active: true,
    floor: 1,
    amenities: ['WiFi', 'AC', 'TV', 'Electric fan', 'Hot water', 'Parking', 'Fridge'],
    notes: '',
    createdAt: '2026-01-01T00:00:00+07:00',
    updatedAt: '2026-01-01T00:00:00+07:00',
  },
];

// ─── Rate Plans ────────────────────────────────────────────────────────────────────
//
// Pricing is per-room (not per-guest) unless otherwise noted.
//
// Plans:
//   RP-0001  Combo 4H      — 4 hours, base 250k/300k
//   RP-0002  Combo 6H      — 6 hours, base 350k/450k
//   RP-0003  Overnight     — 21:00–10:00 (13 hours), base 400k/500k
//   RP-0004  Full Day      — 14:00–12:00 next day (22 hours), base 750/850k
//
// Room types for pricing:
//   Standard (Hiên): LOC-0001 → basePrice1
//   Deluxe    (Yên): LOC-0002 → basePrice2
//
// Surcharges (applied at booking time, not stored in rate plan):
//   Overtime:    70,000 VND / hour past expected check-out
//   Extra guest: 100,000 VND / person from 3rd guest
//   Holiday:     100,000 VND flat per booking

export const RATE_PLANS = [
  // Combo 4H
  {
    ratePlanId: 'RP-0001',
    name: 'Combo 4H',
    type: 'hourly' as const,
    baseMinutes: 240,         // 4 hours
    baseAmount: 0,            // filled per room below
    extraMinutePrice: 0,      // fixed price
    overtimeMinutePrice: 0,    // handled by surcharge rule
    active: true,
  },
  // Combo 6H
  {
    ratePlanId: 'RP-0002',
    name: 'Combo 6H',
    type: 'hourly' as const,
    baseMinutes: 360,         // 6 hours
    baseAmount: 0,
    extraMinutePrice: 0,
    overtimeMinutePrice: 0,
    active: true,
  },
  // Overnight
  {
    ratePlanId: 'RP-0003',
    name: 'Overnight',
    type: 'overnight' as const,
    baseMinutes: 780,         // 13 hours (from 17:00 flexible)
    baseAmount: 0,
    extraMinutePrice: 0,
    overtimeMinutePrice: 0,
    overnightStart: '17:00',
    overnightEnd: '10:00',
    active: true,
  },
  // Full Day
  {
    ratePlanId: 'RP-0004',
    name: 'Full Day',
    type: 'daily' as const,
    baseMinutes: 1320,        // 22 hours (14:00–12:00 next day)
    baseAmount: 0,
    extraMinutePrice: 0,
    overtimeMinutePrice: 0,
    overnightStart: '14:00',
    overnightEnd: '12:00',
    active: true,
  },
];

// Per-room pricing for each rate plan (VND).
// Covers all 12 rooms in the in-memory fallback (ROOM-0001..ROOM-0012).
// Room types:
//   Standard (Hiên): capacity 4 — basePrice1 (cheaper tier)
//   Deluxe   (Yên):  capacity 5 — basePrice2 (premium tier)
export const ROOM_RATE_PRICES: Record<string, Record<string, number>> = {
  // Hiên rooms (Standard tier)
  'ROOM-0001': { 'RP-0001': 250_000, 'RP-0002': 350_000, 'RP-0003': 400_000, 'RP-0004': 550_000 },
  'ROOM-0002': { 'RP-0001': 250_000, 'RP-0002': 350_000, 'RP-0003': 400_000, 'RP-0004': 550_000 },
  'ROOM-0003': { 'RP-0001': 250_000, 'RP-0002': 350_000, 'RP-0003': 400_000, 'RP-0004': 550_000 },
  // Yên rooms (Deluxe tier)
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

// Surcharge rules (applied at booking creation)
export const SURCHARGES = {
  overtimePerHour: 70_000,       // VND / hour
  extraGuestFromThird: 100_000,  // VND / person
  holiday: 100_000,              // VND flat per booking
};

// ─── Users (admin seed account) ──────────────────────────────────────────────────
//
// Defaults — password is set via env var SEED_ADMIN_PASSWORD at runtime.
// The hash is generated by the seed script so you don't need to pre-compute it.
// ──────────────────────────────────────────────────────────────────────────────

export const SEED_ADMIN_EMAIL = 'admin@homestay.local';

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/** Get the price in VND for a given room + rate plan combo. */
export function getRoomRatePrice(roomId: string, ratePlanId: string): number {
  return ROOM_RATE_PRICES[roomId]?.[ratePlanId] ?? 0;
}

// ─── RatePlanPrices seed rows ─────────────────────────────────────────────────────
//
// Flatten `ROOM_RATE_PRICES` into the row shape the RatePlanPrices sheet expects.
// Each row pins one (ratePlanId, roomId) combination to a VND amount — the
// authoritative price the server reads via `findPrice()` when creating a
// daily booking. Missing rows mean that combination is not bookable.
//
// `priceVnd` is the nightly rate for daily plans, the all-inclusive rate for
// hourly/overnight plans. See docs/DATABASE.md §5 for the schema.

export const RATE_PLAN_PRICES_SEED: Array<{
  ratePlanId: string;
  roomId: string;
  priceVnd: number;
}> = Object.entries(ROOM_RATE_PRICES).flatMap(([roomId, planMap]) =>
  Object.entries(planMap).map(([ratePlanId, priceVnd]) => ({
    ratePlanId,
    roomId,
    priceVnd,
  })),
);

// ─── Pricing calculation helpers (mirror server logic) ────────────────────────────

/** Nights = ceil(minutes / 1440), min 1. Same as `bookings.repository.calculateBasePricing`. */
export function calcNights(checkInIso: string, checkOutIso: string): number {
  const minutes = Math.round(
    (new Date(checkOutIso).getTime() - new Date(checkInIso).getTime()) / 60_000,
  );
  return Math.max(1, Math.ceil(minutes / 1440));
}

/**
 * Compute the base stay charge for a daily booking using the same algorithm
 * as the server (`bookings.repository.calculateBasePricing`). Useful for
 * previews and reports.
 */
export function calcDailyBaseAmount(
  roomId: string,
  ratePlanId: string,
  checkInIso: string,
  checkOutIso: string,
  numGuests = 1,
): number {
  const priceVnd = getRoomRatePrice(roomId, ratePlanId);
  const nights = calcNights(checkInIso, checkOutIso);
  let total = nights * priceVnd;
  if (numGuests > 2) {
    total += (numGuests - 2) * 100_000 * nights; // EXTRA_GUEST_CHARGE_VND
  }
  return total;
}

/**
 * Write the per-(room, rate plan) prices to the RatePlanPrices sheet.
 * Idempotent: skips rows whose (ratePlanId, roomId) pair is already present
 * and active. Sets all seeded rows to `active = true`.
 */
export async function seedRatePlanPrices(
  sheets: { appendRow: (sid: string, range: string, row: string[]) => Promise<void>; getValues: (sid: string, range: string) => Promise<string[][]> },
  spreadsheetId: string,
): Promise<{ inserted: number; skipped: number }> {
  // Read existing rows so we don't double-insert.
  const existingRange = 'RatePlanPrices!A2:G';
  const existingRows = await sheets.getValues(spreadsheetId, existingRange).catch(() => []);
  const existing = new Set(
    existingRows
      .filter(r => r[1] && r[2])
      .map(r => `${r[1]}::${r[2]}`),
  );

  const ts = '2026-01-01T00:00:00+07:00';
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < RATE_PLAN_PRICES_SEED.length; i++) {
    const { ratePlanId, roomId, priceVnd } = RATE_PLAN_PRICES_SEED[i]!;
    const key = `${ratePlanId}::${roomId}`;
    if (existing.has(key)) { skipped++; continue; }

    // Generate a stable, sortable ID from the index.
    const id = `RPP-${String(i + 1).padStart(4, '0')}`;
    await sheets.appendRow(spreadsheetId, 'RatePlanPrices!A:A', [
      id, ratePlanId, roomId, String(priceVnd), 'TRUE', ts, ts,
    ]);
    inserted++;
  }

  return { inserted, skipped };
}
