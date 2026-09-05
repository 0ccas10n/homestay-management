// ─── GET /api/availability ───────────────────────────────────────────────────────
// Public endpoint — no authentication required.
// Checks whether a specific room is available for a given datetime window.
// Exact datetime overlap detection is performed server-side per API.md §7.

import { hasOverlap, byRoom } from '@/lib/google-sheets/bookings.repository';
import { readAll as readAllRooms } from '@/lib/google-sheets/rooms.repository';
import { jsonSuccess, jsonError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId') || undefined;
  const checkIn = searchParams.get('checkIn') || undefined;
  const checkOut = searchParams.get('checkOut') || undefined;

  // Case 1: roomId + checkIn + checkOut -> Kiểm tra phòng cụ thể
  if (roomId && checkIn && checkOut) {
    if (new Date(checkIn) >= new Date(checkOut)) {
      return jsonError('INVALID_DATES', 'checkIn must be before checkOut', 422);
    }
    const overlap = await hasOverlap(SPREADSHEET_ID, roomId, checkIn, checkOut);
    return jsonSuccess({
      roomId,
      checkIn,
      checkOut,
      available: !overlap,
    });
  }

  // Case 2: checkIn + checkOut (không có roomId) -> Lọc tất cả các phòng đang trống
  if (!roomId && checkIn && checkOut) {
    if (new Date(checkIn) >= new Date(checkOut)) {
      return jsonError('INVALID_DATES', 'checkIn must be before checkOut', 422);
    }
    const allRooms = await readAllRooms(SPREADSHEET_ID);
    const activeRooms = (allRooms || []).filter(
      r => r && r.active !== false && String(r.active).toLowerCase() !== 'false' && r.status !== 'inactive'
    );

    const checks = await Promise.all(
      activeRooms.map(async room => {
        const overlap = await hasOverlap(SPREADSHEET_ID, room.roomId, checkIn, checkOut);
        return { roomId: room.roomId, available: !overlap };
      })
    );

    const availableRoomIds = checks.filter(c => c.available).map(c => c.roomId);
    return jsonSuccess({
      checkIn,
      checkOut,
      availableRoomIds,
    });
  }

  // Case 3: roomId (không có checkIn/checkOut) -> Trả về danh sách khoảng ngày đã kín lịch (đã làm sạch, không lộ thông tin cá nhân)
  if (roomId) {
    const bookings = await byRoom(SPREADSHEET_ID, roomId);
    const activeBookings = (bookings || []).filter(
      b => b && b.status !== 'cancelled' && b.status !== 'checked_out' && b.status !== 'no_show'
    );
    const bookedRanges = activeBookings.map(b => ({
      checkInAt: b.checkInAt,
      expectedCheckOutAt: b.expectedCheckOutAt,
    }));
    return jsonSuccess({
      roomId,
      bookedRanges,
    });
  }

  return jsonError('BAD_REQUEST', 'Vui lòng truyền roomId, hoặc checkIn & checkOut, hoặc cả ba tham số', 400);
}

