// ─── Notifications repository ──────────────────────────────────────────────────────
//
// CRUD for the Notifications sheet.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  NOTIFICATIONS_HEADERS,
  mapRowToNotification,
} from './types';
import type { Notification } from '@/types/index';
import { generateId } from './id';

/** Read raw sheet rows (includes createdAt/updatedAt columns) for read-back. */
async function readRawRows(spreadsheetId: string): Promise<string[][]> {
  const range = `${SHEETS.Notifications}!A2:${String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length)}`;
  return sheets.getValues(spreadsheetId, range);
}

export async function readAll(spreadsheetId: string): Promise<Notification[]> {
  const rows = await readRawRows(spreadsheetId);
  return rows.map(row => {
    const r = mapRowToNotification(row);
    return {
      notificationId:   r.notificationId,
      type:             r.type     as Notification['type'],
      title:            r.title,
      message:          r.message,
      time:             r.time,
      read:             r.read,
      priority:         r.priority as Notification['priority'],
      relatedBookingId: r.relatedBookingId,
      relatedRoomId:    r.relatedRoomId,
    };
  });
}

export async function create(
  spreadsheetId: string,
  input: Omit<Notification, 'notificationId'>,
): Promise<Notification> {
  const notificationId = await generateId('NOTIF', 'Notifications', spreadsheetId);
  const { timestamps } = await import('./datetime');
  const { createdAt, updatedAt } = timestamps();

  const notification: Notification = {
    ...input,
    notificationId,
  };

  // Pass a column-shaped range (Notifications!A:A) so Google Sheets `values.append`
  // does a pure append at the table's trailing edge. (See client.ts.)
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Notifications}!A:A`,
    [
      notificationId, input.type, input.title, input.message,
      input.time, input.read ? 'TRUE' : 'FALSE', input.priority,
      input.relatedBookingId ?? '', input.relatedRoomId ?? '',
      createdAt, updatedAt,
    ],
  );

  return notification;
}

export async function markRead(
  spreadsheetId: string,
  notificationId: string,
): Promise<Notification | null> {
  const { updatedTimestamp } = await import('./datetime');
  const rows = await readRawRows(spreadsheetId);
  const idx = rows.findIndex(row => row[0] === notificationId);
  if (idx === -1) return null;

  const original = rows[idx]!;
  const originalCreatedAt = original[9] ?? '';

  const updated: Notification = {
    notificationId:   original[0]!,
    type:             (original[1] ?? 'check_in') as Notification['type'],
    title:            original[2] ?? '',
    message:          original[3] ?? '',
    time:             original[4] ?? '',
    read:             true,
    priority:         (original[6] ?? 'medium') as Notification['priority'],
    relatedBookingId: original[7] || undefined,
    relatedRoomId:    original[8] || undefined,
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Notifications}!A${sheetRow}:${col}`,
    [
      [
        updated.notificationId, updated.type, updated.title, updated.message,
        updated.time, 'TRUE', updated.priority,
        updated.relatedBookingId ?? '', updated.relatedRoomId ?? '',
        originalCreatedAt, updatedTimestamp(),
      ],
    ],
  );

  return updated;
}

export async function markAllRead(spreadsheetId: string): Promise<void> {
  const { updatedTimestamp } = await import('./datetime');
  const rows = await readRawRows(spreadsheetId);
  const col = String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length);

  await Promise.all(
    rows.map(async (row, idx) => {
      const isRead = (row[5] ?? '').toUpperCase() === 'TRUE';
      if (!isRead) {
        const sheetRow = idx + 2;
        const newRow = [...row];
        newRow[5] = 'TRUE';
        newRow[10] = updatedTimestamp();
        await sheets.setValues(
          spreadsheetId,
          `${SHEETS.Notifications}!A${sheetRow}:${col}`,
          [newRow],
        );
      }
    }),
  );
}
