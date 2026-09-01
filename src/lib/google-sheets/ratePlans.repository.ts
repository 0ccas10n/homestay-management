import { sheets } from './client';
import {
  SHEETS,
  RATE_PLANS_HEADERS,
  mapRowToRatePlan,
} from './types';
import type { RatePlan } from '@/types/index';
import { ratePlans as sampleRatePlans } from '@/data/sampleData';

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all rate plans. Returns fallback rate plans if empty or on error. */
export async function readAll(spreadsheetId: string): Promise<RatePlan[]> {
  try {
    const range = `${SHEETS.RatePlans}!A2:J`;
    const rows = await sheets.getValues(spreadsheetId, range);
    if (!rows || rows.length === 0) {
      return sampleRatePlans;
    }
    const plans = rows
      .filter(r => r && r[0]?.trim())
      .map(mapRowToRatePlan);
    return plans.length > 0 ? plans : sampleRatePlans;
  } catch (err) {
    console.warn('[ratePlans.readAll] Error fetching rate plans, using fallback:', err);
    return sampleRatePlans;
  }
}

/** Fetch a single rate plan by ID. Returns null if not found. */
export async function readOne(
  spreadsheetId: string,
  ratePlanId: string,
): Promise<RatePlan | null> {
  const all = await readAll(spreadsheetId);
  return all.find(p => p.ratePlanId === ratePlanId) ?? sampleRatePlans.find((p: RatePlan) => p.ratePlanId === ratePlanId) ?? null;
}

/** Fetch only active rate plans. */
export async function active(spreadsheetId: string): Promise<RatePlan[]> {
  const all = await readAll(spreadsheetId);
  const activePlans = all.filter(p => p.active !== false);
  return activePlans.length > 0 ? activePlans : sampleRatePlans;
}
