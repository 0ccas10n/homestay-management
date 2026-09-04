// ─── Hourly / short-stay booking data ─────────────────────────────────────────────
// These are bookings with durations < 24h (hourly, overnight, half-day).
// Uses ISO 8601 datetime strings — aligned with the hybrid booking model.
//
// The existing Timeline page depends on time-of-day logic for live countdowns.
// To preserve that UX, we generate real-time "HH:MM" strings anchored to today's
// wall-clock date. The actual data model uses full datetimes.
//
// All monetary values are in Vietnamese Dong (VND).
// ──────────────────────────────────────────────────────────────────────────────

import type { RatePlan, Booking } from '../types/index';

// ─── Rate plans ─────────────────────────────────────────────────────────────────
//
// 4 standard rate plans — must stay in sync with scripts/seedData.ts and
// src/data/sampleData.ts. Pricing is stored per-room in the RatePlanPrices
// sheet; the baseAmount here is a fallback display value for the UI.

export const ratePlans: RatePlan[] = [
  { ratePlanId: 'RP-0001', name: 'Combo 4H',  type: 'hourly',    baseMinutes: 240,  baseAmount: 250_000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0002', name: 'Combo 6H',  type: 'hourly',    baseMinutes: 360,  baseAmount: 350_000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0003', name: 'Overnight', type: 'overnight', baseMinutes: 780,  baseAmount: 400_000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '17:00', overnightEnd: '10:00', active: true },
  { ratePlanId: 'RP-0004', name: 'Full Day',  type: 'daily',     baseMinutes: 1320, baseAmount: 550_000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '14:00', overnightEnd: '12:00', active: true },
];

// ─── Hourly booking status (UI classification) ────────────────────────────────────

export type HourlyStatus =
  | 'Upcoming'
  | 'Active'
  | 'Warning'
  | 'Critical'
  | 'Overtime'
  | 'Completed';

// ─── Convenience view of a short-stay booking for the Timeline UI ────────────────
// The Timeline page needs roomNumber, guestName, phone, times — not the full
// internal Booking model. We use a lightweight view that maps to the real data.

export interface HourlyBookingView {
  id: string;
  guestName: string;
  phone: string;
  numGuests: number;
  roomNumber: string;
  date: string;          // "YYYY-MM-DD" — today
  checkInTime: string;   // "HH:MM" — for live countdown UI
  checkOutTime: string;   // "HH:MM" — for live countdown UI
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  ratePlanId: string;
  bookedMinutes: number;
  baseAmount: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  totalAmount: number;
  notes?: string;
}

// ─── datetime helpers (mirrors pricing.ts, kept here for self-containment) ──────

function pad2(n: number) { return String(n).padStart(2, '0'); }

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(totalMin: number): string {
  const clamped = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

// ─── sample data generator (anchored to today's wall-clock date) ─────────────────
// Uses the same real-time approach as the original so "now" comparisons work.
//
// Prices below are illustrative VND amounts per the 4 rate plans:
//   Combo 4H   (RP-0001): 250k–350k base, ~5k / extra minute
//   Combo 6H   (RP-0002): 350k–450k base, ~4k / extra minute
//   Overnight  (RP-0003): 400k–500k flat
//   Full Day   (RP-0004): 550k–650k base, ~3k / extra minute
// Overtime is computed at the per-minute rate from the plan.

function makeSamples(): HourlyBookingView[] {
  const now = new Date();
  const NM = now.getHours() * 60 + now.getMinutes();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const TZ = now.toTimeString().slice(9, 17); // "+HH:MM" offset string

  function dt(h: number, m: number): string {
    return `${today}T${pad2(h)}:${pad2(m)}:00${TZ}`;
  }
  function t(offsetMin: number): string { return minToTime(NM + offsetMin); }
  function price(planId: string, bookedMin: number, overtimeMin = 0) {
    const plan = ratePlans.find(p => p.ratePlanId === planId)!;
    const base = plan.baseAmount;
    // Per-minute cost derived from baseAmount / baseMinutes so the demo prices
    // remain self-consistent without needing the RatePlanPrices sheet.
    const perMin = base / Math.max(1, plan.baseMinutes);
    const extraMin = Math.max(0, bookedMin - plan.baseMinutes);
    const extraCharge = extraMin * perMin;
    const overtimeCharge = overtimeMin * perMin;
    return { baseAmount: base, overtimeMinutes: overtimeMin, overtimeAmount: Math.round(overtimeCharge), totalAmount: Math.round(base + extraCharge + overtimeCharge) };
  }

  return [
    // 1 — Critical: ends in ~8 min
    {
      id: 'HB-0001', guestName: 'Kai Tanaka', phone: '+81 90 1234 5678', numGuests: 2,
      roomNumber: '101', date: today,
      checkInTime: t(-112), checkOutTime: t(8),
      actualCheckInTime: t(-112),
      ratePlanId: 'RP-0001', bookedMinutes: 240,
      ...price('RP-0001', 240),
      notes: 'Walk-in, paid cash',
    },
    // 2 — Warning: ends in ~22 min
    {
      id: 'HB-0002', guestName: 'Sofia Bergmann', phone: '+49 176 9988 7766', numGuests: 1,
      roomNumber: '102', date: today,
      checkInTime: t(-158), checkOutTime: t(22),
      actualCheckInTime: t(-155),
      ratePlanId: 'RP-0002', bookedMinutes: 360,
      ...price('RP-0002', 360),
      notes: 'Business traveler',
    },
    // 3 — Overtime: should have checked out 18 min ago
    {
      id: 'HB-0003', guestName: 'Lior Ben-David', phone: '+972 52 345 6789', numGuests: 3,
      roomNumber: '204', date: today,
      checkInTime: t(-198), checkOutTime: t(-18),
      actualCheckInTime: t(-196),
      ratePlanId: 'RP-0002', bookedMinutes: 360,
      ...price('RP-0002', 360, 18),
    },
    // 4 — Active with plenty of time (Full Day)
    {
      id: 'HB-0004', guestName: 'Amara Diallo', phone: '+221 77 456 7890', numGuests: 2,
      roomNumber: '201', date: today,
      checkInTime: t(-90), checkOutTime: t(90),
      actualCheckInTime: t(-88),
      ratePlanId: 'RP-0004', bookedMinutes: 360,
      ...price('RP-0004', 360),
    },
    // 5 — Upcoming in 45 min
    {
      id: 'HB-0005', guestName: 'Priya Sharma', phone: '+91 98765 43210', numGuests: 2,
      roomNumber: '103', date: today,
      checkInTime: t(45), checkOutTime: t(165),
      ratePlanId: 'RP-0001', bookedMinutes: 240,
      ...price('RP-0001', 240),
    },
    // 6 — Upcoming in 2h (Full Day)
    {
      id: 'HB-0006', guestName: 'Carlos Mendes', phone: '+55 11 9 8765-4321', numGuests: 4,
      roomNumber: '301', date: today,
      checkInTime: t(120), checkOutTime: t(480),
      ratePlanId: 'RP-0004', bookedMinutes: 360,
      ...price('RP-0004', 360),
    },
    // 7 — Completed (ended 3h ago)
    {
      id: 'HB-0007', guestName: 'Nadia Okonkwo', phone: '+1 (415) 820-3341', numGuests: 2,
      roomNumber: '101', date: today,
      checkInTime: t(-300), checkOutTime: t(-180),
      actualCheckInTime: t(-300), actualCheckOutTime: t(-181),
      ratePlanId: 'RP-0001', bookedMinutes: 240,
      ...price('RP-0001', 240, 0),
    },
    // 8 — Completed (ended 5h ago)
    {
      id: 'HB-0008', guestName: 'James Whitfield', phone: '+44 7700 900432', numGuests: 1,
      roomNumber: '302', date: today,
      checkInTime: t(-420), checkOutTime: t(-240),
      actualCheckInTime: t(-420), actualCheckOutTime: t(-235),
      ratePlanId: 'RP-0002', bookedMinutes: 360,
      ...price('RP-0002', 360, 5),
    },
    // 9 — Overnight (21:00 → 10:00)
    {
      id: 'HB-0009', guestName: 'Elena Vasquez', phone: '+34 612 334 891', numGuests: 2,
      roomNumber: '202', date: today,
      checkInTime: '21:00', checkOutTime: '10:00',
      ratePlanId: 'RP-0003', bookedMinutes: 780,
      ...price('RP-0003', 780),
    },
    // 10 — Active Full Day booking
    {
      id: 'HB-0010', guestName: 'Marcus Chen', phone: '+1 (650) 775-4422', numGuests: 3,
      roomNumber: '304', date: today,
      checkInTime: t(-240), checkOutTime: t(240),
      actualCheckInTime: t(-238),
      ratePlanId: 'RP-0004', bookedMinutes: 480,
      ...price('RP-0004', 480),
    },
    // 11 — Warning: ends in ~28 min
    {
      id: 'HB-0011', guestName: 'Aisha Rahman', phone: '+60 12-345-6789', numGuests: 2,
      roomNumber: '303', date: today,
      checkInTime: t(-152), checkOutTime: t(28),
      actualCheckInTime: t(-150),
      ratePlanId: 'RP-0002', bookedMinutes: 360,
      ...price('RP-0002', 360),
    },
  ];
}

export const hourlyBookings: HourlyBookingView[] = makeSamples();