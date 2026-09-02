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
  const isExplicitPublic = searchParams.get('public') === 'true' && !session;

  const rooms = await query(SPREADSHEET_ID, {
    locationId,
    active: isExplicitPublic ? true : undefined,
    status: isExplicitPublic ? 'available' : undefined,
  });

  if (isExplicitPublic) {
    return jsonSuccess(
      rooms.map(r => ({
        roomId:      r.roomId,
        locationId:  r.locationId,
        name:        r.name,
        description: r.description,
        capacity:    r.capacity,
        priceDisplay: r.priceDisplay,
        imageUrl:    r.imageUrl,
        amenities:   r.amenities,
      })),
    );
  }

  // Authenticated staff/admin or internal app dashboard: return full room data (including inactive)
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
      createdAt:   r.createdAt,
      updatedAt:   r.updatedAt,
    })),
  );
}
