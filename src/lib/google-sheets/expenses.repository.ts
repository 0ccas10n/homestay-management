// ─── Expenses repository ──────────────────────────────────────────────────────────
//
// CRUD for the Expenses sheet.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  EXPENSES_HEADERS,
  mapRowToExpense,
  mapExpenseToRow,
} from './types';
import type { Expense } from '@/types/index';
import { timestamps, updatedTimestamp } from './datetime';
import { generateId } from './id';

// ─── Read ───────────────────────────────────────────────────────────────────────

export async function readAll(spreadsheetId: string): Promise<Expense[]> {
  const range = `${SHEETS.Expenses}!A2:${String.fromCharCode(64 + EXPENSES_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToExpense);
}

export async function readOne(
  spreadsheetId: string,
  expenseId: string,
): Promise<Expense | null> {
  const all = await readAll(spreadsheetId);
  return all.find(e => e.expenseId === expenseId) ?? null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────────

/** Filter by date range. Dates are "YYYY-MM-DD" strings. */
export async function query(
  spreadsheetId: string,
  filters?: {
    from?: string;  // "YYYY-MM-DD"
    to?: string;    // "YYYY-MM-DD"
    category?: string;
  },
): Promise<Expense[]> {
  let all = await readAll(spreadsheetId);

  if (filters?.from) all = all.filter(e => e.date >= filters.from);
  if (filters?.to)   all = all.filter(e => e.date <= filters.to);
  if (filters?.category) all = all.filter(e => e.category === filters.category);

  return all;
}

// ─── Write ───────────────────────────────────────────────────────────────────────

export async function create(
  spreadsheetId: string,
  input: Omit<Expense, 'expenseId' | 'createdAt' | 'updatedAt'>,
): Promise<Expense> {
  const expenseId = await generateId('EXP', 'Expenses', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const expense: Expense = {
    ...input,
    expenseId,
    createdAt,
    updatedAt,
  };

  const existing = await sheets.getValues(spreadsheetId, `${SHEETS.Expenses}!A:A`);
  const nextRow = existing.length + 2;

  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Expenses}!A${nextRow}`,
    mapExpenseToRow(expense),
  );

  return expense;
}

export async function update(
  spreadsheetId: string,
  expenseId: string,
  patch: Partial<Pick<Expense, 'category' | 'amount' | 'date' | 'description' | 'vendor'>>,
): Promise<Expense | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(e => e.expenseId === expenseId);
  if (idx === -1) return null;

  const updated: Expense = {
    ...all[idx]!,
    ...patch,
    expenseId,               // immutable
    createdAt: all[idx]!.createdAt, // immutable
    updatedAt: updatedTimestamp(),
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + EXPENSES_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Expenses}!A${sheetRow}:${col}`,
    [mapExpenseToRow(updated)],
  );

  return updated;
}
