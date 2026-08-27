// ─── Locations repository ────────────────────────────────────────────────────────
//
// Read-only locations. Edit directly in the sheet.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  LOCATIONS_HEADERS,
  mapRowToLocation,
} from './types';
import type { Location } from '@/types/index';

// ─── Read ───────────────────────────────────────────────────────────────────────

export async function readAll(spreadsheetId: string): Promise<Location[]> {
  const range = `${SHEETS.Locations}!A2:${String.fromCharCode(64 + LOCATIONS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToLocation);
}

export async function readOne(
  spreadsheetId: string,
  locationId: string,
): Promise<Location | null> {
  const all = await readAll(spreadsheetId);
  return all.find(l => l.locationId === locationId) ?? null;
}

/** Active locations only (used for public website). */
export async function active(spreadsheetId: string): Promise<Location[]> {
  const all = await readAll(spreadsheetId);
  return all.filter(l => l.active);
}
