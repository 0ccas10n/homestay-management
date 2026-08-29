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
  let rppCounter = 1;
  const rppRows: string[][] = [];
  for (const [roomId, prices] of Object.entries(ROOM_RATE_PRICES)) {
    for (const [ratePlanId, price] of Object.entries(prices)) {
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

  const match = cellRange.match(/[A-Z]+(\d+)(?::[A-Z]*(\d*))?/i);
  if (match) {
    const startRow = parseInt(match[1], 10);
    const endRow = match[2] ? parseInt(match[2], 10) : undefined;
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
const hasGoogleCreds = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_PRIVATE_KEY &&
  process.env.SPREADSHEET_ID,
);

function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  });

  return google.sheets({
    version: 'v4',
    auth,
    timeout: 10_000,
  });
}

export function getSheetsClient() {
  if (!_client && hasGoogleCreds) {
    _client = createSheetsClient();
  }
  return _client;
}

export const sheets = {
  get client() {
    return getSheetsClient();
  },

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    if (hasGoogleCreds && this.client) {
      try {
        const response = await this.client.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        return (response.data.values as string[][]) ?? [];
      } catch (err) {
        console.warn('Google Sheets getValues failed, using in-memory store:', (err as Error)?.message);
      }
    }

    // In-memory fallback
    const { sheetName, startRow, endRow, colOnly, isFullWithHeader } = parseA1Range(range);
    const sheetData = getMemorySheet(sheetName);

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
    if (hasGoogleCreds && this.client) {
      try {
        await this.client.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
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
    if (hasGoogleCreds && this.client) {
      try {
        await this.client.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [row] },
        });
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
    if (hasGoogleCreds && this.client) {
      try {
        await this.client.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: ranges.map((range, i) => ({ range, values: [values[i]] })),
          },
        });
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
    if (hasGoogleCreds && this.client) {
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
    if (hasGoogleCreds && this.client) {
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
