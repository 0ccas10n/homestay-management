// ─── GET /api/rate-plan-prices ──────────────────────────────────────────────────
// Returns the per-(room, rate plan) VND prices. Supports optional filtering by
// ratePlanId and/or roomId via query params. Requires authentication.

import { readAll, active, findPrice } from '@/lib/google-sheets/ratePlanPrices.repository';
import { optionalAuth } from '@/lib/auth/middleware';
import { jsonSuccess, jsonServerError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function GET(request: Request) {
  await optionalAuth(request);

  try {
    const { searchParams } = new URL(request.url);
    const ratePlanId = searchParams.get('ratePlanId') ?? undefined;
    const roomId     = searchParams.get('roomId')     ?? undefined;
    const onlyActive = searchParams.get('active') !== 'false';

    // Single-price fast path: when both ids are provided, return the matched
    // row directly (or null) — useful for the booking form's auto-fill.
    if (ratePlanId && roomId) {
      const match = await findPrice(SPREADSHEET_ID, ratePlanId, roomId);
      return jsonSuccess(match);
    }

    const all = onlyActive ? await active(SPREADSHEET_ID) : await readAll(SPREADSHEET_ID);
    const filtered = all.filter(p =>
      (!ratePlanId || p.ratePlanId === ratePlanId) &&
      (!roomId     || p.roomId === roomId),
    );

    return jsonSuccess(filtered);
  } catch (err) {
    return jsonServerError(err, 'GET /api/rate-plan-prices');
  }
}
