// ─── Customers repository ──────────────────────────────────────────────────────────
//
// CRUD + lookup operations for the Customers sheet.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  CUSTOMERS_HEADERS,
  mapRowToCustomer,
  mapCustomerToRow,
} from './types';
import type { Customer } from '@/types/index';
import { timestamps, updatedTimestamp } from './datetime';
import { generateId } from './id';

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all customers. Returns [] on error. */
export async function readAll(spreadsheetId: string): Promise<Customer[]> {
  // Read from row 1 (include header) so we can build a header→index map.
  // This makes the function resilient to old sheet layouts (e.g. col 2 = 'phone'
  // instead of 'source') or to Google Sheets trimming trailing empty cells.
  const lastCol = String.fromCharCode(64 + CUSTOMERS_HEADERS.length);
  const rawRows = await sheets.getValues(spreadsheetId, `${SHEETS.Customers}!A1:${lastCol}`);
  if (!rawRows || rawRows.length === 0) return [];

  const headerRow = rawRows[0] || [];
  const dataRows = rawRows.slice(1);

  // Map header name → column index (case-insensitive, strip _/-/space).
  const headerMap = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    if (h) {
      const clean = String(h).toLowerCase().replace(/[\s_-]/g, '');
      headerMap.set(clean, idx);
    }
  });

  const col = (row: string[], ...names: string[]) => {
    for (const name of names) {
      const idx = headerMap.get(name.toLowerCase().replace(/[\s_-]/g, ''));
      if (idx !== undefined) return row[idx] ?? '';
    }
    return '';
  };

  return dataRows
    .filter(row => row && row.length > 0 && row[0]?.trim())
    .map(row => {
      // If header map has 'name' col, use it; otherwise fall back to mapRowToCustomer.
      const hasNameCol = headerMap.has('name');
      if (hasNameCol) {
        // Fallback: in the user's sheet, the 'source' data is stored in the 'phone' column.
        const rawSource = col(row, 'source', 'phone') || undefined;
        return {
          customerId: row[headerMap.get('customerid') ?? headerMap.get('customer_id') ?? 0] ?? '',
          name:       col(row, 'name') || undefined,
          source:     (rawSource as Customer['source']) ?? undefined,
          email:      col(row, 'email') || undefined,
          note:       col(row, 'note') || undefined,
          createdAt:  col(row, 'createdat', 'created_at'),
          updatedAt:  col(row, 'updatedat', 'updated_at'),
        } as Customer;
      }
      // Fallback: no header row (shouldn't happen), use fixed-index mapper.
      return mapRowToCustomer(row);
    });
}



/** Fetch a single customer by ID. Returns null if not found. */
export async function readOne(
  spreadsheetId: string,
  customerId: string,
): Promise<Customer | null> {
  const all = await readAll(spreadsheetId);
  return all.find(c => c.customerId === customerId) ?? null;
}

/** Find a customer by source (booking source). Returns null if not found. */
export async function findBySource(
  spreadsheetId: string,
  source: string,
): Promise<Customer | null> {
  const all = await readAll(spreadsheetId);
  return all.find(c => c.source === source) ?? null;
}

// ─── Write ───────────────────────────────────────────────────────────────────────

/** Create a new customer. Generates customerId, timestamps. */
export async function create(
  spreadsheetId: string,
  input: Omit<Customer, 'customerId' | 'createdAt' | 'updatedAt'>,
): Promise<Customer> {
  const customerId = await generateId('CUS', 'Customers', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const customer: Customer = {
    ...input,
    customerId,
    createdAt,
    updatedAt,
  };

  const row = mapCustomerToRow(customer);
  console.log('[customers.create] customerId=', customerId, 'name=', customer.name, 'row length=', row.length, 'row=', row);

  // Range is the whole column (Customers!A:A), not a specific row.
  // Pass a column-shaped range so Google Sheets `values.append` does a
  // pure append at the table's trailing edge instead of inserting a
  // phantom empty row above the new one. (See client.ts for context.)
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Customers}!A:A`,
    row,
  );

  return customer;
}

/**
 * Update a customer's mutable fields.
 */
export async function update(
  spreadsheetId: string,
  customerId: string,
  patch: Partial<Pick<Customer, 'source' | 'email' | 'note'>>,
): Promise<Customer | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(c => c.customerId === customerId);
  if (idx === -1) return null;

  const updated: Customer = {
    ...all[idx]!,
    ...patch,
    customerId,           // immutable
    createdAt: all[idx]!.createdAt, // immutable
    updatedAt: updatedTimestamp(),
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + CUSTOMERS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Customers}!A${sheetRow}:${col}`,
    [mapCustomerToRow(updated)],
  );

  return updated;
}

/**
 * Find or create a customer by phone.
 * Used during booking creation when a guest provides a phone number.
 */
/**
 * Create-or-reuse a customer.
 *
 * Match strategy (replaces the old `findBySource` lookup that was dropping the
 * `name` field): reuse the row whose (name, source) pair matches the input.
 * If neither name nor source is supplied the call is treated as a fresh
 * insert. When both name AND source are present and a row matches, that row
 * is reused; otherwise we always create a new row so each booking captures
 * the guest name typed into the form.
 *
 * For sheets already populated by older versions (where `name` is missing),
 * we additionally fall back to matching on `source` alone as long as the
 * input also has no `name` — that keeps legacy integrations working.
 */
export async function findOrCreate(
  spreadsheetId: string,
  input: Omit<Customer, 'customerId' | 'createdAt' | 'updatedAt'>,
): Promise<{ customer: Customer; created: boolean }> {
  const all = await readAll(spreadsheetId);
  const inputName = input.name?.trim() || undefined;
  const inputSource = input.source;

  let existing: Customer | undefined;

  if (inputName && inputSource) {
    // Preferred path: match by (name, source)
    existing = all.find(c =>
      c.name?.trim() === inputName && c.source === inputSource,
    );
  } else if (inputSource) {
    // Legacy fallback: caller has no name (e.g. from older API clients).
    // Match by source only to avoid generating duplicates for old flows.
    existing = all.find(c => c.source === inputSource && (!c.name || c.name.trim() === ''));
  }

  console.log('[findOrCreate] inputName=', inputName, 'inputSource=', inputSource, 'existing=', existing?.customerId, 'existing.name=', existing?.name);

  // If we found an existing customer but their name is empty and we now have a
  // name from the booking form, backfill the name so it shows up in the sheet.
  if (existing && inputName && (!existing.name || existing.name.trim() === '')) {
    console.log('[findOrCreate] backfilling name for existing customer', existing.customerId);
    const idx = all.findIndex(c => c.customerId === existing!.customerId);
    if (idx !== -1) {
      const patched: Customer = { ...existing, name: inputName };
      const lastCol = String.fromCharCode(64 + CUSTOMERS_HEADERS.length);
      const sheetRow = idx + 2; // +1 for 0-based index → 1-based, +1 for header row
      await sheets.setValues(
        spreadsheetId,
        `${SHEETS.Customers}!A${sheetRow}:${lastCol}`,
        [mapCustomerToRow(patched)],
      );
      console.log('[findOrCreate] name backfilled, sheetRow=', sheetRow, 'patched=', patched);
      return { customer: patched, created: false };
    }
  }


  if (existing) return { customer: existing, created: false };

  console.log('[findOrCreate] creating new customer with name=', inputName);
  const customer = await create(spreadsheetId, input);
  return { customer, created: true };
}

