// ─── Rooms repository ─────────────────────────────────────────────────────────────
//
// CRUD operations for the Rooms sheet.
// All functions require a spreadsheetId passed in — never rely on a global.
// All mutations use USER_ENTERED so Google Sheets formulas recalculate.
//
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  ROOMS_HEADERS,
  mapRowToRoom,
  mapRoomToRow,
  type mapRowToRoom as MapRow,
} from './types';
import type { Room, RoomStatus } from '@/types/index';
import { updatedTimestamp } from './datetime';

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all rooms (including inactive). Returns [] on error. */
export async function readAll(spreadsheetId: string): Promise<Room[]> {
  const range = `${SHEETS.Rooms}!A2:${String.fromCharCode(64 + ROOMS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToRoom);
}

/** Fetch a single room by ID. Returns null if not found. */
export async function readOne(
  spreadsheetId: string,
  roomId: string,
): Promise<Room | null> {
  const all = await readAll(spreadsheetId);
  return all.find(r => r.roomId === roomId) ?? null;
}

// ─── Write ───────────────────────────────────────────────────────────────────────

/**
 * Create a new room. Generates roomId, createdAt, updatedAt.
 * Validates that locationId exists in the Locations sheet.
 */
export async function create(
  spreadsheetId: string,
  input: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'>,
): Promise<Room> {
  const { timestamps } = await import('./datetime');
  const { generateId } = await import('./id');

  const roomId = await generateId('ROOM', 'Rooms', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const room: Room = {
    ...input,
    roomId,
    createdAt,
    updatedAt,
  };

  const headerRange = `${SHEETS.Rooms}!A1:${String.fromCharCode(64 + ROOMS_HEADERS.length)}`;
  const dataStartRange = `${SHEETS.Rooms}!A2:${String.fromCharCode(64 + ROOMS_HEADERS.length)}`;

  // Read current row count to append after last row
  const existing = await sheets.getValues(spreadsheetId, `${SHEETS.Rooms}!A:A`);
  const nextRow = existing.length + 2; // +1 for header, +1 for 1-indexing

  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Rooms}!A${nextRow}`,
    mapRoomToRow(room),
  );

  return room;
}

/**
 * Update a room's mutable fields (status, active, notes, etc.).
 * Set fields to undefined to leave them unchanged.
 */
export async function update(
  spreadsheetId: string,
  roomId: string,
  patch: Partial<Pick<Room, 'name' | 'description' | 'capacity' | 'priceDisplay' | 'status' | 'active' | 'imageUrl' | 'floor' | 'amenities' | 'notes'>>,
): Promise<Room | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(r => r.roomId === roomId);
  if (idx === -1) return null;

  const updated: Room = {
    ...all[idx]!,
    ...patch,
    roomId,           // immutable
    locationId: all[idx]!.locationId, // immutable after create
    createdAt: all[idx]!.createdAt,   // immutable
    updatedAt: updatedTimestamp(),
  };

  // Sheet row = idx + 2 (header at row 1, 1-indexed)
  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + ROOMS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Rooms}!A${sheetRow}:${col}`,
    [mapRoomToRow(updated)],
  );

  return updated;
}

/**
 * Soft-delete: mark a room as inactive + maintenance status.
 */
export async function softDelete(spreadsheetId: string, roomId: string): Promise<boolean> {
  const result = await update(spreadsheetId, roomId, {
    status: 'inactive',
    active: false,
  });
  return result !== null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────────

/** Active rooms only, optionally filtered by location and/or status. */
export async function query(
  spreadsheetId: string,
  filters?: { locationId?: string; status?: RoomStatus; active?: boolean },
): Promise<Room[]> {
  let rooms = await readAll(spreadsheetId);

  if (filters?.locationId !== undefined) {
    rooms = rooms.filter(r => r.locationId === filters.locationId);
  }
  if (filters?.status !== undefined) {
    rooms = rooms.filter(r => r.status === filters.status);
  }
  if (filters?.active !== undefined) {
    rooms = rooms.filter(r => r.active === filters.active);
  }

  return rooms;
}

/** Rooms available for booking (active, not occupied/maintenance/inactive, not in cleaning). */
export async function availableForBooking(
  spreadsheetId: string,
  locationId?: string,
): Promise<Room[]> {
  return query(spreadsheetId, {
    locationId,
    active: true,
    status: 'available',
  });
}
