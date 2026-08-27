// ─── GET /api/rooms ──────────────────────────────────────────────────────────────
// Public + authenticated handler — no middleware needed.
// Returns public fields for unauthenticated users, full data for authenticated users.

import { query } from '@/lib/google-sheets/rooms.repository';
import { optionalAuth } from '@/lib/auth/middleware';
import { jsonSuccess } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  const { session } = await optionalAuth(request);

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId') ?? undefined;

  const rooms = await query(SPREADSHEET_ID, {
    locationId,
    active: true,
  });

  if (session) {
    // Authenticated: return full room data including internal status fields
    return jsonSuccess(
      rooms.map(r => ({
        roomId:      r.roomId,
        locationId:  r.locationId,
        name:        r.name,
        description: r.description,
        capacity:    r.capacity,
        priceDisplay: r.priceDisplay,
        status:      r.status,
        active:      r.active,
        imageUrl:    r.imageUrl,
        floor:       r.floor,
        amenities:   r.amenities,
        notes:       r.notes,
      })),
    );
  }

  // Public: return only non-internal fields per API.md §6
  return jsonSuccess(
    rooms
      .filter(r => r.status !== 'inactive')
      .map(r => ({
        roomId:      r.roomId,
        locationId:  r.locationId,
        name:        r.name,
        description: r.description,
        capacity:    r.capacity,
        imageUrl:    r.imageUrl,
      })),
  );
}
