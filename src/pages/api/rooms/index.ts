// ─── POST /api/rooms ─────────────────────────────────────────────────────────────
// Create a new room. Requires admin role.

import { create } from '@/lib/google-sheets/rooms.repository';
import { createRoomSchema, parseBody } from '@/lib/api/validation';
import { requireRole } from '@/lib/auth/middleware';
import { jsonCreated, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function POST(request: Request) {
  const session = await requireRole(request, 'admin');
  if (session instanceof Response) return session;

  const parsed = await parseBody(request, createRoomSchema);
  if (parsed instanceof Response) return parsed;

  try {
    const room = await create(SPREADSHEET_ID, {
      locationId:   parsed.locationId,
      name:         parsed.name,
      description:  parsed.description,
      capacity:    parsed.capacity,
      priceDisplay: parsed.priceDisplay,
      status:      'available',
      active:      parsed.active,
      imageUrl:    parsed.imageUrl,
      floor:       parsed.floor,
      amenities:   parsed.amenities,
      notes:       parsed.notes,
    });
    return jsonCreated(room);
  } catch (err) {
    return jsonServerError(err, 'POST /api/rooms');
  }
}
