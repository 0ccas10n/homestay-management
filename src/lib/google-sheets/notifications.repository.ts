// ─── Notifications repository ──────────────────────────────────────────────────────
//
// CRUD for the Notifications sheet.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  NOTIFICATIONS_HEADERS,
  mapRowToNotification,
  mapNotificationToRow,
} from './types';
import type { Notification } from '@/types/index';
import { timestamps, updatedTimestamp } from './datetime';
import { generateId } from './id';

export async function readAll(spreadsheetId: string): Promise<Notification[]> {
  const range = `${SHEETS.Notifications}!A2:${String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(row => {
    const r = mapRowToNotification(row);
    return {
      notificationId:   r.notificationId,
      type:             r.type as Notification['type'],
      title:            r.title,
      message:          r.message,
      time:             r.time,
      read:             r.read,
      priority:         r.priority as Notification['priority'],
      relatedBookingId: r.relatedBookingId,
      relatedRoomId:    r.relatedRoomId,
      createdAt:        r.createdAt,
      updatedAt:        r.updatedAt,
    };
  });
}

export async function create(
  spreadsheetId: string,
  input: Omit<Notification, 'notificationId' | 'createdAt' | 'updatedAt'>,
): Promise<Notification> {
  const notificationId = await generateId('NOTIF', 'Notifications', spreadsheetId);
  const { createdAt, updatedAt } = timestamps();

  const notification: Notification = {
    ...input,
    notificationId,
    createdAt,
    updatedAt,
  };

  const existing = await sheets.getValues(spreadsheetId, `${SHEETS.Notifications}!A:A`);
  const nextRow = existing.length + 2;

  const r = mapRowToNotification([
    notificationId, input.type, input.title, input.message,
    input.time, input.read ? 'TRUE' : 'FALSE', input.priority,
    input.relatedBookingId ?? '', input.relatedRoomId ?? '',
    createdAt, updatedAt,
  ]);
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Notifications}!A${nextRow}`,
    mapNotificationToRow(r),
  );

  return notification;
}

export async function markRead(
  spreadsheetId: string,
  notificationId: string,
): Promise<Notification | null> {
  const all = await readAll(spreadsheetId);
  const idx = all.findIndex(n => n.notificationId === notificationId);
  if (idx === -1) return null;

  const updated: Notification = {
    ...all[idx]!,
    read: true,
    updatedAt: updatedTimestamp(),
  };

  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length);
  const r = mapRowToNotification([
    updated.notificationId, updated.type, updated.title, updated.message,
    updated.time, 'TRUE', updated.priority,
    updated.relatedBookingId ?? '', updated.relatedRoomId ?? '',
    updated.createdAt, updated.updatedAt,
  ]);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Notifications}!A${sheetRow}:${col}`,
    [mapNotificationToRow(r)],
  );

  return updated;
}

export async function markAllRead(spreadsheetId: string): Promise<void> {
  const all = await readAll(spreadsheetId);
  const col = String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length);

  await Promise.all(
    all.map(async (n, idx) => {
      if (!n.read) {
        const sheetRow = idx + 2;
        const r = mapRowToNotification([
          n.notificationId, n.type, n.title, n.message,
          n.time, 'TRUE', n.priority,
          n.relatedBookingId ?? '', n.relatedRoomId ?? '',
          n.createdAt, updatedTimestamp(),
        ]);
        await sheets.setValues(
          spreadsheetId,
          `${SHEETS.Notifications}!A${sheetRow}:${col}`,
          [mapNotificationToRow(r)],
        );
      }
    }),
  );
}
