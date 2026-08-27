// ─── Rate plans repository ───────────────────────────────────────────────────────
//
// Read-only rate plan data. These are reference data, not transactional records,
// so there is no create/update here — edit them directly in the sheet.
//
// Future: add admin CRUD when a Rate Plans management UI is built.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  RATE_PLANS_HEADERS,
  mapRowToRatePlan,
} from './types';
import type { RatePlan } from '@/types/index';

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all rate plans. Returns [] on error. */
export async function readAll(spreadsheetId: string): Promise<RatePlan[]> {
  const range = `${SHEETS.RatePlans}!A2:${String.fromCharCode(64 + RATE_PLANS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToRatePlan);
}

/** Fetch a single rate plan by ID. Returns null if not found. */
export async function readOne(
  spreadsheetId: string,
  ratePlanId: string,
): Promise<RatePlan | null> {
  const all = await readAll(spreadsheetId);
  return all.find(p => p.ratePlanId === ratePlanId) ?? null;
}

/** Fetch only active rate plans. */
export async function active(spreadsheetId: string): Promise<RatePlan[]> {
  const all = await readAll(spreadsheetId);
  return all.filter(p => p.active);
}
