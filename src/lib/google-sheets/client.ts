// ─── Google Sheets client ────────────────────────────────────────────────────────
//
// This module is SERVER-SIDE ONLY.
// It must never be imported by any file under src/ that gets bundled for the browser.
// Access is restricted to /api/* serverless functions.
//
// Usage pattern:
//   import { sheets } from '@/lib/google-sheets/client';
//   const response = await sheets.spreadsheets.values.get({ spreadsheetId, range, ... });
//
// ──────────────────────────────────────────────────────────────────────────────

import { google, type GoogleConfigurable } from 'googleapis';

// Lazy singleton — client is created on first use, not at import time.
// This avoids initializing credentials that may not be present during static analysis.
let _client: ReturnType<typeof createSheetsClient> | null = null;

function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // Google private keys contain literal \n characters in the env var.
      // The SDK expects a real newline, so we restore them on read.
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  });

  return google.sheets({
    version: 'v4',
    auth,
    timeout: 15_000,
  } as GoogleConfigurable);
}

/** Returns the shared Google Sheets client. Create once, reuse across requests. */
export function getSheetsClient() {
  if (!_client) {
    _client = createSheetsClient();
  }
  return _client;
}

/** Convenience alias. */
export const sheets = {
  get client() {
    return getSheetsClient();
  },

  /**
   * Read all values from a worksheet range.
   * @param spreadsheetId  The Google Sheets document ID.
   * @param range          A1 notation range, e.g. "Rooms!A2:Z" or "Bookings!A1:K".
   */
  async getValues(spreadsheetId: string, range: string) {
    const response = await this.client.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values ?? [];
  },

  /**
   * Write values to a worksheet range.
   * Setting `range` alone overwrites only those cells; pass the full dimension
   * range to replace the entire sheet content.
   */
  async setValues(
    spreadsheetId: string,
    range: string,
    values: (string | number | boolean | null)[][],
  ) {
    await this.client.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  },

  /**
   * Append a row to a sheet.
   */
  async appendRow(spreadsheetId: string, range: string, row: (string | number | boolean | null)[]) {
    await this.client.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  },

  /**
   * Batch update cell values (clear + write).
   */
  async batchUpdate(
    spreadsheetId: string,
    ranges: string[],
    values: (string | number | boolean | null)[][],
  ) {
    await this.client.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: ranges.map((range, i) => ({ range, values: [values[i]] })),
      },
    });
  },

  /**
   * Create a new worksheet tab in a spreadsheet.
   * Fails silently if the sheet already exists (idempotent).
   *
   * @param spreadsheetId  The Google Sheets document ID.
   * @param title         Tab name (must match SHEETS enum values exactly).
   * @param rowCount      Initial row count (default 1000).
   */
  async createSheet(spreadsheetId: string, title: string, rowCount = 1000) {
    try {
      await this.client.spreadsheets.get({ spreadsheetId });
    } catch {
      throw new Error(`Spreadsheet ${spreadsheetId} not found`);
    }
    // Check if sheet already exists
    try {
      const meta = await this.client.spreadsheets.get({
        spreadsheetId,
        includeGridData: false,
      });
      const existing = meta.data.sheets ?? [];
      if (existing.some(s => s.properties?.title === title)) {
        console.log(`  Sheet "${title}" already exists — skipping creation.`);
        return;
      }
    } catch {
      // ignore
    }
    await this.client.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
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
    console.log(`  Created sheet: "${title}"`);
  },

  /**
   * Delete a worksheet tab by title.
   * Fails silently if the sheet doesn't exist.
   */
  async deleteSheet(spreadsheetId: string, title: string) {
    try {
      const meta = await this.client.spreadsheets.get({ spreadsheetId, includeGridData: false });
      const sheets = meta.data.sheets ?? [];
      const sheet = sheets.find(s => s.properties?.title === title);
      if (!sheet || sheet.properties?.sheetId === undefined) {
        console.log(`  Sheet "${title}" not found — skipping delete.`);
        return;
      }
      await this.client.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }],
        },
      });
      console.log(`  Deleted sheet: "${title}"`);
    } catch {
      // ignore
    }
  },
};
