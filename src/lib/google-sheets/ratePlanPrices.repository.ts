// ─── RatePlanPrices repository ──────────────────────────────────────────────────
//
// Read-only per-(room, rate plan) pricing. These rows override any abstract
// baseAmount/extraMinutePrice math from RatePlans; the booking form auto-fills
// totalAmount from this table.
//
// Like RatePlans, this is reference data — no create/update/delete here.
// Edit directly in the Google Sheet.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  RATE_PLAN_PRICES_HEADERS,
  mapRowToRatePlanPrice,
} from './types';
import type { RatePlanPrice } from '@/types/index';

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch every rate-plan price row. Returns [] on error. */
export async function readAll(spreadsheetId: string): Promise<RatePlanPrice[]> {
  const range = `${SHEETS.RatePlanPrices}!A2:${String.fromCharCode(64 + RATE_PLAN_PRICES_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToRatePlanPrice);
}

/** Fetch only the active rate-plan price rows. */
export async function active(spreadsheetId: string): Promise<RatePlanPrice[]> {
  const all = await readAll(spreadsheetId);
  return all.filter(p => p.active);
}

/**
 * Find the price (VND) for a specific (ratePlanId, roomId) combination.
 * Returns null when no active row exists — callers should treat that as
 * "no price configured for this room/plan" and prompt for manual entry.
 */
export async function findPrice(
  spreadsheetId: string,
  ratePlanId: string,
  roomId: string,
): Promise<RatePlanPrice | null> {
  const all = await active(spreadsheetId);
  return all.find(p => p.ratePlanId === ratePlanId && p.roomId === roomId) ?? null;
}
