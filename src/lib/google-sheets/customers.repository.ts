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
  const range = `${SHEETS.Customers}!A2:${String.fromCharCode(64 + CUSTOMERS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToCustomer);
}

/** Fetch a single customer by ID. Returns null if not found. */
export async function readOne(
  spreadsheetId: string,
  customerId: string,
): Promise<Customer | null> {
  const all = await readAll(spreadsheetId);
  return all.find(c => c.customerId === customerId) ?? null;
}

/** Find a customer by phone number. Returns null if not found. */
export async function findByPhone(
  spreadsheetId: string,
  phone: string,
): Promise<Customer | null> {
  const all = await readAll(spreadsheetId);
  return all.find(c => c.phone?.replace(/\s/g, '') === phone.replace(/\s/g, '')) ?? null;
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

  const existing = await sheets.getValues(spreadsheetId, `${SHEETS.Customers}!A:A`);
  const nextRow = existing.length + 2;

  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Customers}!A${nextRow}`,
    mapCustomerToRow(customer),
  );

  return customer;
}

/**
 * Update a customer's mutable fields.
 */
export async function update(
  spreadsheetId: string,
  customerId: string,
  patch: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'note'>>,
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
export async function findOrCreate(
  spreadsheetId: string,
  input: Omit<Customer, 'customerId' | 'createdAt' | 'updatedAt'>,
): Promise<{ customer: Customer; created: boolean }> {
  if (input.phone) {
    const existing = await findByPhone(spreadsheetId, input.phone);
    if (existing) return { customer: existing, created: false };
  }
  const customer = await create(spreadsheetId, input);
  return { customer, created: true };
}
