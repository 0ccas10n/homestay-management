// ─── GET /api/dashboard ─────────────────────────────────────────────────────────
// Returns a compact operational summary for the current day.
// All aggregations are computed server-side — the frontend gets a pre-computed view.

import { query as queryBookings } from '@/lib/google-sheets/bookings.repository';
import { query as queryRooms } from '@/lib/google-sheets/rooms.repository';
import { dueToday as cleaningDueToday } from '@/lib/google-sheets/cleaning.repository';
import { requireAuth } from '@/lib/auth/middleware';
import { toDateString, toIsoDateTime, today } from '@/lib/google-sheets/datetime';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const LOC_TZ_OFFSET = '+07:00';

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  try {
    const now = new Date();
    const dateStr = today();

    // Define "today" in business timezone: starts at 00:00, ends at 23:59
    const todayStart = `${dateStr}T00:00:00${LOC_TZ_OFFSET}`;
    const todayEnd   = `${dateStr}T23:59:59${LOC_TZ_OFFSET}`;

    // All bookings that could overlap with today
    const [allBookings, rooms] = await Promise.all([
      queryBookings(SPREADSHEET_ID, { from: todayStart, to: todayEnd }),
      queryRooms(SPREADSHEET_ID),
    ]);

    const [pendingCleanings, upcomingBookings] = await Promise.all([
      cleaningDueToday(SPREADSHEET_ID),
      queryBookings(SPREADSHEET_ID, {
        status: 'confirmed',
        from: todayEnd,
        to:   `${dateStr}T23:59:59${LOC_TZ_OFFSET}`,
      }),
    ]);

    const activeStatuses = new Set(['confirmed', 'checked_in']);
    const occupiedRoomIds = new Set(
      allBookings
        .filter(b => activeStatuses.has(b.status))
        .map(b => b.roomId),
    );

    const occupiedRooms    = rooms.filter(r => occupiedRoomIds.has(r.roomId));
    const availableRooms   = rooms.filter(r => !occupiedRoomIds.has(r.roomId) && r.active && r.status !== 'inactive');
    const roomsToCleanCount = pendingCleanings.length;

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

    return jsonSuccess({
      todayCheckIns:    allBookings.filter(b => b.status === 'confirmed' && b.checkInAt.startsWith(dateStr)).length,
      todayCheckOuts:   allBookings.filter(b => b.status === 'checked_in').length,
      availableRooms:   availableRooms.length,
      occupiedRooms:    occupiedRooms.length,
      roomsToClean:     roomsToCleanCount,
      upcomingBookings: upcoming,
    });
  } catch (err) {
    return jsonServerError(err, 'GET /api/dashboard');
  }
}
