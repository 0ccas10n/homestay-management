// ─── Google Sheets client with In-Memory Storage Fallback ─────────────────────────
//
// This module is SERVER-SIDE ONLY.
// Provides Google Sheets integration with an in-memory data store fallback
// initialized with comprehensive sample data.
// ──────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis';
import {
  LOCATIONS_HEADERS,
  ROOMS_HEADERS,
  CUSTOMERS_HEADERS,
  BOOKINGS_HEADERS,
  CLEANING_HEADERS,
  RATE_PLANS_HEADERS,
  RATE_PLAN_PRICES_HEADERS,
  USERS_HEADERS,
  EXPENSES_HEADERS,
  NOTIFICATIONS_HEADERS,
  mapLocationToRow,
  mapRoomToRow,
  mapCustomerToRow,
  mapBookingToRow,
  mapCleaningTaskToRow,
  mapRatePlanToRow,
  mapExpenseToRow,
  mapNotificationToRow,
} from './types';
import {
  rooms as sampleRooms,
  customers as sampleCustomers,
  bookings as sampleBookings,
  cleaningTasks as sampleCleaning,
  expenses as sampleExpenses,
  notifications as sampleNotifications,
  locations as sampleLocations,
  ratePlans as sampleRatePlans,
} from '@/data/sampleData';
import { ROOM_RATE_PRICES } from '../../../scripts/seedData';

// ─── In-memory store initialized with seed/sample data ─────────────────────────
const inMemoryStore = new Map<string, string[][]>();

function initInMemoryStore() {
  if (inMemoryStore.size > 0) return;

  // Locations
  inMemoryStore.set('Locations', [
    [...LOCATIONS_HEADERS],
    ...sampleLocations.map(mapLocationToRow),
  ]);

  // Rooms
  inMemoryStore.set('Rooms', [
    [...ROOMS_HEADERS],
    ...sampleRooms.map(mapRoomToRow),
  ]);

  // Customers
  inMemoryStore.set('Customers', [
    [...CUSTOMERS_HEADERS],
    ...sampleCustomers.map(mapCustomerToRow),
  ]);

  // Bookings
  inMemoryStore.set('Bookings', [
    [...BOOKINGS_HEADERS],
    ...sampleBookings.map(mapBookingToRow),
  ]);

  // Cleaning
  inMemoryStore.set('Cleaning', [
    [...CLEANING_HEADERS],
    ...sampleCleaning.map(mapCleaningTaskToRow),
  ]);

  // RatePlans
  inMemoryStore.set('RatePlans', [
    [...RATE_PLANS_HEADERS],
    ...sampleRatePlans.map(mapRatePlanToRow),
  ]);

  // RatePlanPrices
  // Build one row per (ratePlan, room) combination present in the rooms list
  // (ROOM-0001..ROOM-0012). Falls back to a 250k/350k/450k/550k ladder when a
  // room has no explicit pricing in ROOM_RATE_PRICES, so every bookable room
  // always has a complete RatePlanPrices matrix.
  const STANDARD_PRICES: Record<string, number> = {
    'RP-0001': 250_000,
    'RP-0002': 350_000,
    'RP-0003': 400_000,
    'RP-0004': 550_000,
  };
  let rppCounter = 1;
  const rppRows: string[][] = [];
  const sortedRoomIds = sampleRooms
    .map(r => r.roomId)
    .sort();
  for (const roomId of sortedRoomIds) {
    const roomPrices = ROOM_RATE_PRICES[roomId];
    for (const ratePlanId of ['RP-0001', 'RP-0002', 'RP-0003', 'RP-0004']) {
      const price = roomPrices?.[ratePlanId] ?? STANDARD_PRICES[ratePlanId] ?? 0;
      rppRows.push([
        `RPP-${String(rppCounter++).padStart(4, '0')}`,
        ratePlanId,
        roomId,
        String(price),
        'TRUE',
        '2026-01-01T00:00:00+07:00',
        '2026-01-01T00:00:00+07:00',
      ]);
    }
  }
  inMemoryStore.set('RatePlanPrices', [
    [...RATE_PLAN_PRICES_HEADERS],
    ...rppRows,
  ]);

  // Users
  inMemoryStore.set('Users', [
    [...USERS_HEADERS],
    ['USR-0001', 'Admin User', 'admin@homestay.local', 'PBKDF2$demo$hash', 'admin', 'TRUE', '2026-01-01T00:00:00+07:00', '2026-01-01T00:00:00+07:00'],
    ['USR-0002', 'Maria Santos', 'staff@homestay.local', 'PBKDF2$demo$hash', 'staff', 'TRUE', '2026-01-01T00:00:00+07:00', '2026-01-01T00:00:00+07:00'],
  ]);

  // Expenses
  inMemoryStore.set('Expenses', [
    [...EXPENSES_HEADERS],
    ...sampleExpenses.map(mapExpenseToRow),
  ]);

  // Notifications
  inMemoryStore.set('Notifications', [
    [...NOTIFICATIONS_HEADERS],
    ...sampleNotifications.map(mapNotificationToRow),
  ]);
}

initInMemoryStore();

function parseA1Range(range: string): { sheetName: string; startRow?: number; endRow?: number; colOnly?: boolean; isFullWithHeader?: boolean } {
  const parts = range.split('!');
  const sheetName = parts[0]?.trim() || 'Sheet1';
  const cellRange = parts[1]?.trim() || '';

  if (!cellRange || cellRange === 'A:A') {
    return { sheetName, colOnly: cellRange === 'A:A' };
  }

  if (cellRange.startsWith('A1:')) {
    return { sheetName, isFullWithHeader: true };
  }

  // Patterns:
  //   A2       → startRow=2, endRow=undefined
  //   A2:J2    → startRow=2, endRow=2
  //   A2:J     → startRow=2, endRow=undefined (column-only end, treat as row range)
  //   A:J      → startRow=undefined, endRow=undefined (full column range without row numbers)
  const match = cellRange.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/i);
  console.log('[parseA1Range]', { cellRange, match: match?.slice(1) });
  if (match) {
    const startRow = match[2] ? parseInt(match[2], 10) : undefined;
    const endRow   = match[4] ? parseInt(match[4], 10) : undefined;
    // If startRow is undefined (no row after first column, e.g. "A:J"),
    // treat as full-with-header to return all rows.
    if (startRow === undefined) {
      console.log('[parseA1Range] treating as fullWithHeader');
      return { sheetName, isFullWithHeader: true };
    }
    console.log('[parseA1Range] result:', { startRow, endRow });
    return { sheetName, startRow, endRow };
  }

  return { sheetName };
}

function getMemorySheet(sheetName: string): string[][] {
  initInMemoryStore();
  if (!inMemoryStore.has(sheetName)) {
    inMemoryStore.set(sheetName, []);
  }
  return inMemoryStore.get(sheetName)!;
}

// Lazy Google Sheets client
let _client: ReturnType<typeof createSheetsClient> | null = null;
const READ_CACHE_TTL_MS = 10_000;
const readCache = new Map<string, { expiresAt: number; values: string[][] }>();

function cloneRows(rows: string[][]): string[][] {
  return rows.map(row => [...row]);
}

function clearCachedSheet(spreadsheetId: string, range: string): void {
  const sheetPrefix = `${spreadsheetId}:${range.split('!')[0]}!`;
  for (const key of readCache.keys()) {
    if (key.startsWith(sheetPrefix)) readCache.delete(key);
  }
}

function hasGoogleCreds(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
    process.env.GOOGLE_PRIVATE_KEY?.trim() &&
    (process.env.SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim())
  );
}

function createSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  
  if (key && key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  key = key?.replace(/\\n/g, '\n');

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    projectId,
  });

  return google.sheets({
    version: 'v4',
    auth,
    timeout: 10_000,
  });
}

export function getSheetsClient() {
  if (!_client && hasGoogleCreds()) {
    _client = createSheetsClient();
  }
  return _client;
}

export const sheets = {
  get client() {
    return getSheetsClient();
  },

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const credsOk = hasGoogleCreds();
    const cacheKey = `${spreadsheetId}:${range}`;
    const cached = readCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneRows(cached.values);
    }

    console.log('[sheets.getValues]', { hasGoogleCreds: credsOk, range, sheetName: range.split('!')[0] });
    if (credsOk && this.client) {
      try {
        const response = await this.client.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        const values = (response.data.values as string[][]) ?? [];
        readCache.set(cacheKey, { expiresAt: Date.now() + READ_CACHE_TTL_MS, values: cloneRows(values) });
        return values;
      } catch (err) {
        if (cached) {
          console.warn('Google Sheets getValues failed, using cached live data:', (err as Error)?.message);
          return cloneRows(cached.values);
        }
        console.warn('Google Sheets getValues failed, using in-memory store:', (err as Error)?.message);
      }
    }

    // In-memory fallback
    const { sheetName, startRow, endRow, colOnly, isFullWithHeader } = parseA1Range(range);
    console.log('[sheets.getValues in-memory]', { sheetName, startRow, endRow, colOnly, isFullWithHeader });
    const sheetData = getMemorySheet(sheetName);
    console.log('[sheets.getValues in-memory] sheetData length:', sheetData.length);

    if (colOnly) {
      return sheetData.map(row => [row[0] ?? '']);
    }

    if (isFullWithHeader) {
      return sheetData;
    }

    if (startRow !== undefined) {
      const startIdx = Math.max(0, startRow - 1);
      const endIdx = endRow !== undefined ? endRow : undefined;
      return sheetData.slice(startIdx, endIdx);
    }

    // Default to skipping header row
    return sheetData.slice(1);
  },

  async setValues(
    spreadsheetId: string,
    range: string,
    values: (string | number | boolean | null)[][],
  ): Promise<void> {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values },
        });
        clearCachedSheet(spreadsheetId, range);
        return;
      } catch (err) {
        console.warn('Google Sheets setValues failed, saving to in-memory store:', (err as Error)?.message);
      }
    }

    const { sheetName, startRow } = parseA1Range(range);
    const sheetData = getMemorySheet(sheetName);

    const startIdx = startRow !== undefined ? startRow - 1 : 1;
    for (let i = 0; i < values.length; i++) {
      const rowStrings = (values[i] ?? []).map(v => (v === null || v === undefined ? '' : String(v)));
      sheetData[startIdx + i] = rowStrings;
    }
  },

  async appendRow(
    spreadsheetId: string,
    range: string,
    row: (string | number | boolean | null)[],
  ): Promise<void> {
    if (hasGoogleCreds() && this.client) {
      // ─── BUG FIX ─────────────────────────────────────────────────────────
      // The previous implementation called `values.append` with an explicit
      // single-row range (e.g. `Bookings!A10`). Google Sheets then performed
      // an INSERT shift and inserted a phantom blank row above the new row
      // whenever the target row was past the end of existing data, producing
      // an extra "empty/meaningless" row in the sheet for every booking.
      //
      // Repository call sites must now pass a column-shaped range (e.g.
      // `Bookings!A:A`), so we forward `range` as-is. (See repositories for
      // the column-shape convention.)
      try {
        await this.client.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
        clearCachedSheet(spreadsheetId, range);
        return;
      } catch (err) {
        console.warn('Google Sheets appendRow failed, appending to in-memory store:', (err as Error)?.message);
      }
    }

    const { sheetName } = parseA1Range(range);
    const sheetData = getMemorySheet(sheetName);
    sheetData.push(row.map(v => (v === null || v === undefined ? '' : String(v))));
  },

  async batchUpdate(
    spreadsheetId: string,
    ranges: string[],
    values: (string | number | boolean | null)[][],
  ): Promise<void> {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: ranges.map((range, i) => ({ range, values: [values[i]] })),
          },
        });
        for (const range of ranges) clearCachedSheet(spreadsheetId, range);
        return;
      } catch (err) {
        console.warn('Google Sheets batchUpdate failed, saving in memory:', (err as Error)?.message);
      }
    }

    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i] && values[i]) {
        await this.setValues(spreadsheetId, ranges[i]!, [values[i]!]);
      }
    }
  },

  async createSheet(spreadsheetId: string, title: string, rowCount = 1000): Promise<void> {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title,
                    gridProperties: { rowCount, columnCount: 26 },
                  },
                },
              },
            ],
          },
        });
        return;
      } catch {
        // ignore
      }
    }

    if (!inMemoryStore.has(title)) {
      inMemoryStore.set(title, []);
    }
  },

  async deleteSheet(spreadsheetId: string, title: string): Promise<void> {
    if (hasGoogleCreds() && this.client) {
      try {
        const meta = await this.client.spreadsheets.get({ spreadsheetId, includeGridData: false });
        const s = meta.data.sheets?.find(s => s.properties?.title === title);
        if (s?.properties?.sheetId !== undefined) {
          await this.client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ deleteSheet: { sheetId: s.properties.sheetId } }],
            },
          });
        }
        return;
      } catch {
        // ignore
      }
    }

    inMemoryStore.delete(title);
  },
};
