// ─── GET /api/dashboard ─────────────────────────────────────────────────────────
// Returns a compact operational summary for the current day plus historical
// aggregations for the charts:
//   - monthlyRevenue: trailing 6 calendar months (revenue + expenses)
//   - weeklyOccupancy: occupancy rate for each day of the current ISO week
//   - monthlyRevenueTotal: current month's revenue total for the stat card
// All aggregations are computed server-side — the frontend gets a pre-computed view.

import { readAll as readAllBookings, query as queryBookings } from '@/lib/google-sheets/bookings.repository';
import { readAll as readAllRooms } from '@/lib/google-sheets/rooms.repository';
import { readAll as readAllExpenses } from '@/lib/google-sheets/expenses.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { toDateString, today } from '@/lib/google-sheets/datetime';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';
import type { Booking } from '@/types/index';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const LOC_TZ_OFFSET = '+07:00';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Booking statuses that contribute revenue and occupy a room. */
const COUNTED_STATUSES = new Set<Booking['status']>(['confirmed', 'checked_in', 'checked_out']);

// ─── Aggregation helpers ─────────────────────────────────────────────────────────

/** Return the trailing 6 month keys ("YYYY-MM") in chronological order, oldest first. */
function trailingMonthKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** Map a "YYYY-MM" key to its month and year label (e.g. "Thg 4/2026"). */
function monthLabelFromKey(key: string): string {
  const [year, month] = key.split('-');
  return `Thg ${Number(month)}/${year}`;
}

/** Build monthlyRevenue from bookings + expenses over the trailing 6 months. */
function buildMonthlyRevenue(
  bookings: Booking[],
  expenses: { date: string; amount: number }[],
  monthKeys: string[],
): { month: string; revenue: number; expenses: number }[] {
  const revenueByKey: Record<string, number> = {};
  const expensesByKey: Record<string, number> = {};
  for (const key of monthKeys) {
    revenueByKey[key] = 0;
    expensesByKey[key] = 0;
  }

  for (const b of bookings) {
    if (!COUNTED_STATUSES.has(b.status)) continue;
    const checkInKey = b.checkInAt.slice(0, 7); // "YYYY-MM"
    if (checkInKey in revenueByKey) {
      revenueByKey[checkInKey] += b.totalAmount ?? 0;
    }
  }

  for (const e of expenses) {
    const key = e.date.slice(0, 7); // expense.date is "YYYY-MM-DD"
    if (key in expensesByKey) {
      expensesByKey[key] += e.amount ?? 0;
    }
  }

  return monthKeys.map(key => ({
    month: monthLabelFromKey(key),
    revenue: revenueByKey[key]!,
    expenses: expensesByKey[key]!,
  }));
}

/** Return the Monday of the ISO week containing `now`, as a "YYYY-MM-DD" string in +07:00. */
function startOfIsoWeek(now: Date): string {
  // getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const dow = now.getDay();
  const offsetToMonday = (dow + 6) % 7; // Mon -> 0, Sun -> 6
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetToMonday);
  return toDateString(monday);
}

/** Add `days` days to a "YYYY-MM-DD" string and return a "YYYY-MM-DD" string. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + days);
  return toDateString(dt);
}

/**
 * Build weeklyOccupancy: occupancy rate per day for the current ISO week.
 *
 * Day `D` is occupied for a given booking iff:
 *   - Same-day hourly (checkIn date == expectedCheckOut date): D == checkIn date.
 *   - Otherwise (multi-night): D is in the half-open date interval
 *     [checkInAt_date, expectedCheckOutAt_date) — i.e. count NIGHTS, not days.
 *     A booking checking in Saturday and out Sunday counts ONLY Saturday.
 *
 * Equivalently: D ∈ [checkInAt_date, expectedCheckOutAt_date) when the booking
 * spans more than one calendar day, and D == checkInAt_date when it doesn't.
 */
function buildWeeklyOccupancy(
  bookings: Booking[],
  totalActiveRooms: number,
  mondayKey: string,
): { day: string; rate: number }[] {
  const occupancy: { day: string; rate: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const dayKey = addDays(mondayKey, i);
    const occupiedRoomIds = new Set<string>();

    for (const b of bookings) {
      if (!COUNTED_STATUSES.has(b.status)) continue;

      const checkInDate = b.checkInAt.slice(0, 10);      // "YYYY-MM-DD"
      const checkOutDate = b.expectedCheckOutAt.slice(0, 10);

      if (checkInDate === checkOutDate) {
        // Same-day hourly: occupy only that single day.
        if (dayKey === checkInDate) occupiedRoomIds.add(b.roomId);
      } else {
        // Multi-night: count nights in [checkInDate, checkOutDate).
        if (dayKey >= checkInDate && dayKey < checkOutDate) {
          occupiedRoomIds.add(b.roomId);
        }
      }
    }

    const rate = totalActiveRooms > 0
      ? Math.max(0, Math.min(100, Math.round((occupiedRoomIds.size / totalActiveRooms) * 100)))
      : 0;

    occupancy.push({ day: DAY_LABELS[i]!, rate });
  }

  return occupancy;
}

// ─── Handler ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  try {
    const now = new Date();
    const dateStr = today();

    // Define "today" in business timezone: starts at 00:00, ends at 23:59
    const todayStart = `${dateStr}T00:00:00${LOC_TZ_OFFSET}`;
    const todayEnd   = `${dateStr}T23:59:59${LOC_TZ_OFFSET}`;

    // All bookings (for monthly aggregation), today's bookings (for stat cards),
    // all rooms, all expenses, today's cleanings — fetched in parallel.
    const [allBookings, todayBookings, rooms, allExpenses, upcomingBookings] =
      await Promise.all([
        readAllBookings(SPREADSHEET_ID),
        queryBookings(SPREADSHEET_ID, { from: todayStart, to: todayEnd }),
        readAllRooms(SPREADSHEET_ID),
        readAllExpenses(SPREADSHEET_ID),
        queryBookings(SPREADSHEET_ID, {
          status: 'confirmed',
          from: todayEnd,
          to:   `${dateStr}T23:59:59${LOC_TZ_OFFSET}`,
        }),
      ]);

    const activeStatuses = new Set(['confirmed', 'checked_in']);
    // "Occupied" rooms = those with a same-night presence today OR a same-day
    // hourly booking today. A booking checking in Sat and out Sun marks ONLY
    // Sat as occupied (the checkout day is exclusive). Matches the weekly chart.
    const todayDate = dateStr;
    const occupiedRoomIds = new Set(
      todayBookings
        .filter(b => activeStatuses.has(b.status))
        .filter(b => {
          const cinDate  = b.checkInAt.slice(0, 10);
          const coutDate = b.expectedCheckOutAt.slice(0, 10);
          return cinDate === coutDate
            ? cinDate === todayDate                  // same-day hourly
            : cinDate <= todayDate && todayDate < coutDate; // multi-night
        })
        .map(b => b.roomId),
    );

    const occupiedRooms    = rooms.filter(r => occupiedRoomIds.has(r.roomId));
    const availableRooms   = rooms.filter(r => !occupiedRoomIds.has(r.roomId) && r.active && r.status !== 'inactive');
    // Cleaning Needed: count rooms that checkout just flagged as awaiting housekeeping.
    const roomsToCleanCount = rooms.filter(r => r.status === 'needs_cleaning').length;

    // Next 5 confirmed bookings after today
    const upcoming = upcomingBookings
      .sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime())
      .slice(0, 5)
      .map(b => ({
        bookingId: b.bookingId,
        roomId:    b.roomId,
        checkInAt: b.checkInAt,
        expectedCheckOutAt: b.expectedCheckOutAt,
        status:    b.status,
      }));

    // Monthly revenue/expenses for the trailing 6 calendar months
    const monthKeys = trailingMonthKeys(now);
    const monthlyRevenue = buildMonthlyRevenue(allBookings, allExpenses, monthKeys);

    // Current-month revenue total for the stat card. Derived from the last entry
    // of the already-computed `monthlyRevenue` array (both use the same
    // COUNTED_STATUSES filter and current-month key), so they stay in lock-step.
    const monthlyRevenueTotal = monthlyRevenue[monthlyRevenue.length - 1]!.revenue;

    // Weekly occupancy for the current ISO week (Mon–Sun in +07:00)
    const totalActiveRooms = rooms.filter(r => r.active).length;
    const mondayKey = startOfIsoWeek(now);
    const weeklyOccupancy = buildWeeklyOccupancy(allBookings, totalActiveRooms, mondayKey);

    return jsonSuccess({
      todayCheckIns:    todayBookings.filter(b => b.status === 'confirmed' && b.checkInAt.startsWith(dateStr)).length,
      todayCheckOuts:   todayBookings.filter(b => b.status === 'checked_in').length,
      availableRooms:   availableRooms.length,
      occupiedRooms:    occupiedRooms.length,
      roomsToClean:     roomsToCleanCount,
      upcomingBookings: upcoming,
      monthlyRevenue,
      weeklyOccupancy,
      monthlyRevenueTotal,
    });
  } catch (err) {
    return jsonServerError(err, 'GET /api/dashboard');
  }
}
