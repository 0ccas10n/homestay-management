// ─── GET /api/locations ──────────────────────────────────────────────────────────
// Public endpoint — no authentication required.
// Returns active locations with only their public fields.

import { active } from '@/lib/google-sheets/locations.repository';
import { jsonSuccess } from '@/lib/api/response';
import type { Location } from '@/types/index';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET() {
  const locations = await active(SPREADSHEET_ID);

  // Strip all non-public fields per API.md §5
  const publicLocations: Pick<Location, 'locationId' | 'name' | 'description' | 'publicAddress'>[] =
    locations.map(({ locationId, name, description, publicAddress }) => ({
      locationId,
      name,
      description,
      publicAddress,
    }));

  return jsonSuccess(publicLocations);
}
