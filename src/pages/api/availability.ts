// ─── GET /api/availability ───────────────────────────────────────────────────────
// Public endpoint — no authentication required.
// Checks whether a specific room is available for a given datetime window.
// Exact datetime overlap detection is performed server-side per API.md §7.

import { hasOverlap } from '@/lib/google-sheets/bookings.repository';
import { availabilityQuerySchema, parseQuery } from '@/lib/api/validation';
import { jsonSuccess, jsonError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const parsed = parseQuery(request.url, availabilityQuerySchema);
  if (parsed instanceof Response) return parsed;

  const { roomId, checkIn, checkOut } = parsed;

  const overlap = await hasOverlap(SPREADSHEET_ID, roomId, checkIn, checkOut);

  return jsonSuccess({
    roomId,
    checkIn,
    checkOut,
    available: !overlap,
  });
}
