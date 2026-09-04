// ─── Stable ID generation ───────────────────────────────────────────────────────
// Generates application-level IDs for every entity.
// These are the IDs stored in Google Sheets, NOT spreadsheet row numbers.
//
// ID format: PREFIX-NNNN
//   e.g. ROOM-0001, BOOK-0001, CUS-0001
// The zero-padded number is derived from the current highest ID in the sheet,
// not from row position, so IDs remain stable across insertions/deletions.
//
// Usage in repositories:
//   const id = await generateId('ROOM', 'Rooms', spreadsheetId);
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import { SHEETS } from './types';

const PREFIX_MAX = 999_999;

function pad(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Read all IDs from a sheet and return the next increment.
 * IDs are expected in the first column (A).
 *
 * @param prefix     Short uppercase string, e.g. 'ROOM', 'BOOK', 'CUS'
 * @param sheetName  Google Sheets tab name
 */
export async function generateId(
  prefix: string,
  sheetName: keyof typeof SHEETS,
  spreadsheetId: string,
): Promise<string> {
  const range = `${sheetName}!A:A`;
  const rows = await sheets.getValues(spreadsheetId, range);

  let max = 0;
  for (const row of rows) {
    const raw = row[0] ?? '';
    if (!raw.startsWith(prefix + '-')) continue;

    // Match e.g. "ROOM-0042" → "0042"
    const numPart = raw.slice(prefix.length + 1);
    const n = parseInt(numPart, 10);
    if (!isNaN(n) && n > max) max = n;
  }

  if (max >= PREFIX_MAX) {
    throw new Error(`${prefix}: ID namespace exhausted (max ${PREFIX_MAX})`);
  }

  return `${prefix}-${pad(max + 1)}`;
}

/**
 * Synchronous ID generation for use in test fixtures / server-side only.
 * Uses an in-memory counter — NOT safe across concurrent instances.
 * Use generateId() for production.
 */
let _syncCounters: Record<string, number> = {};

export function resetSyncCounters() {
  _syncCounters = {};
}

export function generateSyncId(prefix: string): string {
  const key = prefix;
  _syncCounters[key] = (_syncCounters[key] ?? 0) + 1;
  return `${prefix}-${pad(_syncCounters[key]!)}`;
}
