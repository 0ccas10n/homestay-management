// ─── Cleaning tasks repository ────────────────────────────────────────────────────
//
// CRUD for the Cleaning sheet.
// Cleaning tasks are created automatically after a booking is created (by the API layer).
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  CLEANING_HEADERS,
  mapRowToCleaningTask,
  mapCleaningTaskToRow,
} from './types';
import type { CleaningTask, CleaningStatus } from '@/types/index';
import { timestamps, updatedTimestamp } from './datetime';
import { generateId } from './id';

// ─── Read ───────────────────────────────────────────────────────────────────────

export async function readAll(spreadsheetId: string): Promise<CleaningTask[]> {
  const range = `${SHEETS.Cleaning}!A2:${String.fromCharCode(64 + CLEANING_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToCleaningTask);
}

export async function readOne(
  spreadsheetId: string,
  cleaningId: string,
): Promise<CleaningTask | null> {
  const all = await readAll(spreadsheetId);
  return all.find(c => c.cleaningId === cleaningId) ?? null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────────

export async function query(
  spreadsheetId: string,
  filters?: {
    roomId?: string;
    bookingId?: string;
    status?: CleaningStatus;
  },
): Promise<CleaningTask[]> {
  let all = await readAll(spreadsheetId);

  if (filters?.roomId)    all = all.filter(t => t.roomId === filters.roomId);
  if (filters?.bookingId) all = all.filter(t => t.bookingId === filters.bookingId);
  if (filters?.status)    all = all.filter(t => t.status === filters.status);

  return all;
}

/** Tasks due today or overdue (scheduledAt <= now). */
export async function dueToday(spreadsheetId: string): Promise<CleaningTask[]> {
  const now = new Date().toISOString();
  const all = await readAll(spreadsheetId);
  return all.filter(t =>
    t.status !== 'completed' &&
    t.status !== 'cancelled' &&
    t.scheduledAt <= now,
  );
}

// ─── Write ───────────────────────────────────────────────────────────────────────

/**
 * Create a cleaning task.
 * Typically called by the API when a booking is confirmed — scheduledAt is derived
 * from the booking's expectedCheckOutAt.
 */
export async function create(
  spreadsheetId: string,
  input: Omit<CleaningTask, 'cleaningId' | 'createdAt' | 'updatedAt'>,
): Promise<CleaningTask> {
  const cleaningId = await generateId('CLN', 'Cleaning', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const task: CleaningTask = {
    ...input,
    cleaningId,
    createdAt,
    updatedAt,
  };

  const existing = await sheets.getValues(spreadsheetId, `${SHEETS.Cleaning}!A:A`);
  const nextRow = existing.length + 2;

  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Cleaning}!A${nextRow}`,
    mapCleaningTaskToRow(task),
  );

  return task;
}

/**
 * Transition a task through its lifecycle:
 *   pending → in_progress (staff picks it up)
 *   in_progress → completed (staff finishes)
 *   * → cancelled
 *
 * Automatically sets startedAt / completedAt.
 */
export async function transition(
  spreadsheetId: string,
  cleaningId: string,
  newStatus: CleaningStatus,
): Promise<CleaningTask | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(t => t.cleaningId === cleaningId);
  if (idx === -1) return null;

  const existing = all[idx]!;
  const now = updatedTimestamp();

  const patch: Partial<CleaningTask> = { status: newStatus };

  if (newStatus === 'in_progress' && existing.status === 'pending') {
    patch.startedAt = now;
  }
  if (newStatus === 'completed') {
    patch.completedAt = now;
  }

  const updated: CleaningTask = {
    ...existing,
    ...patch,
    cleaningId: existing.cleaningId,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + CLEANING_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Cleaning}!A${sheetRow}:${col}`,
    [mapCleaningTaskToRow(updated)],
  );

  return updated;
}
