// ─── Google Sheets row ↔ typed object mappers ────────────────────────────────────
//
// This module maps between:
//   - Raw Google Sheets row arrays  (string[][])
//   - Typed application objects     (src/types/index.ts)
//
// IMPORTANT rules:
//   - Sheet column order must match the indices below exactly.
//   - Header row (row 1) is skipped by all read operations (we read from A2 onward).
//   - ID columns use application-generated stable IDs, never spreadsheet row numbers.
//   - All timestamps are stored as ISO 8601 strings.
//   - Boolean columns store "TRUE" / "FALSE" (Google Sheets native).
//   - Empty cells become empty strings; the mapper provides defaults.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  Room,
  Customer,
  Booking,
  CleaningTask,
  RatePlan,
  RatePlanPrice,
  Location,
  User,
  Expense,
  Notification,
} from '@/types/index';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Null-coalesce an empty string to undefined. */
function emptyToUndefined(v: string | undefined): string | undefined {
  return v === '' || v === undefined ? undefined : v;
}

/** Parse a Google Sheets "TRUE"/"FALSE" string to boolean. */
function parseBool(v: string | undefined): boolean {
  return v?.toUpperCase() === 'TRUE';
}

// ─── Locations sheet ────────────────────────────────────────────────────────────
// Columns: location_id | name | description | public_address | phone | active | created_at | updated_at

export const LOCATIONS_HEADERS = [
  'location_id', 'name', 'description', 'public_address',
  'phone', 'active', 'created_at', 'updated_at',
] as const;

export function mapRowToLocation(row: string[]): Location {
  return {
    locationId:           row[0] ?? '',
    name:                 row[1] ?? '',
    description:          emptyToUndefined(row[2]),
    publicAddress:       emptyToUndefined(row[3]),
    phone:               emptyToUndefined(row[4]),
    active:               parseBool(row[5]),
    createdAt:           row[6] ?? '',
    updatedAt:           row[7] ?? '',
  };
}

export function mapLocationToRow(loc: Location): string[] {
  return [
    loc.locationId,
    loc.name,
    loc.description ?? '',
    loc.publicAddress ?? '',
    loc.phone ?? '',
    loc.active ? 'TRUE' : 'FALSE',
    loc.createdAt,
    loc.updatedAt,
  ];
}

// ─── Rooms sheet ─────────────────────────────────────────────────────────────────
// Columns: room_id | location_id | name | description | capacity | price_display |
//          status | active | image_url | floor | amenities | notes | created_at | updated_at

export const ROOMS_HEADERS = [
  'room_id', 'location_id', 'name', 'description', 'capacity', 'price_display',
  'status', 'active', 'image_url', 'floor', 'amenities', 'notes',
  'created_at', 'updated_at',
] as const;

export function mapRowToRoom(row: string[]): Room {
  const amenitiesStr = row[10] ?? '';
  return {
    roomId:          row[0] ?? '',
    locationId:      row[1] ?? '',
    name:            row[2] ?? '',
    description:     emptyToUndefined(row[3]),
    capacity:       parseInt(row[4] ?? '1', 10),
    priceDisplay:   emptyToUndefined(row[5]),
    status:         (row[6] ?? 'available') as Room['status'],
    active:          parseBool(row[7]),
    imageUrl:        emptyToUndefined(row[8]),
    floor:           row[9] ? parseInt(row[9], 10) : undefined,
    amenities:       amenitiesStr ? amenitiesStr.split('|') : [],
    notes:           emptyToUndefined(row[11]),
    createdAt:       row[12] ?? '',
    updatedAt:       row[13] ?? '',
  };
}

export function mapRoomToRow(room: Room): string[] {
  return [
    room.roomId,
    room.locationId,
    room.name,
    room.description ?? '',
    String(room.capacity),
    room.priceDisplay ?? '',
    room.status,
    room.active ? 'TRUE' : 'FALSE',
    room.imageUrl ?? '',
    room.floor !== undefined ? String(room.floor) : '',
    (room.amenities ?? []).join('|'),
    room.notes ?? '',
    room.createdAt,
    room.updatedAt,
  ];
}

// ─── Customers sheet ─────────────────────────────────────────────────────────────
// Columns: customer_id | name | phone | email | note | created_at | updated_at

export const CUSTOMERS_HEADERS = [
  'customer_id', 'name', 'phone', 'email', 'note', 'created_at', 'updated_at',
] as const;

export function mapRowToCustomer(row: string[]): Customer {
  return {
    customerId:  row[0] ?? '',
    name:        row[1] ?? '',
    phone:       emptyToUndefined(row[2]),
    email:       emptyToUndefined(row[3]),
    note:        emptyToUndefined(row[4]),
    createdAt:   row[5] ?? '',
    updatedAt:   row[6] ?? '',
  };
}

export function mapCustomerToRow(c: Customer): string[] {
  return [
    c.customerId,
    c.name,
    c.phone ?? '',
    c.email ?? '',
    c.note ?? '',
    c.createdAt,
    c.updatedAt,
  ];
}

// ─── Bookings sheet ──────────────────────────────────────────────────────────────
// Columns: booking_id | room_id | customer_id | checkInAt | expectedCheckOutAt |
//          actualCheckOutAt | status | source | ratePlanId | expectedDurationMinutes |
//          baseAmount | overtimeMinutes | overtimeAmount | totalAmount | numGuests |
//          note | created_by | created_at | updated_at

export const BOOKINGS_HEADERS = [
  'booking_id', 'room_id', 'customer_id', 'checkInAt', 'expectedCheckOutAt',
  'actualCheckOutAt', 'status', 'source', 'ratePlanId', 'expectedDurationMinutes',
  'baseAmount', 'overtimeMinutes', 'overtimeAmount', 'totalAmount', 'numGuests',
  'note', 'created_by', 'created_at', 'updated_at',
] as const;

export function mapRowToBooking(row: string[]): Booking {
  return {
    bookingId:                row[0]  ?? '',
    roomId:                   row[1]  ?? '',
    customerId:               row[2]  ?? '',
    checkInAt:                row[3]  ?? '',
    expectedCheckOutAt:        row[4]  ?? '',
    actualCheckOutAt:         emptyToUndefined(row[5]),
    status:                   (row[6]  ?? 'inquiry') as Booking['status'],
    source:                   (row[7]  ?? 'other') as Booking['source'],
    ratePlanId:               row[8]  ?? '',
    expectedDurationMinutes: row[9]  ? parseInt(row[9], 10) : 0,
    baseAmount:               row[10] ? parseFloat(row[10]) : 0,
    overtimeMinutes:          row[11] ? parseInt(row[11], 10) : undefined,
    overtimeAmount:            row[12] ? parseFloat(row[12]) : undefined,
    totalAmount:              row[13] ? parseFloat(row[13]) : 0,
    numGuests:                row[14] ? parseInt(row[14], 10) : undefined,
    note:                     emptyToUndefined(row[15]),
    createdBy:                row[16] ?? '',
    createdAt:                row[17] ?? '',
    updatedAt:                row[18] ?? '',
  };
}

export function mapBookingToRow(b: Booking): string[] {
  return [
    b.bookingId,
    b.roomId,
    b.customerId,
    b.checkInAt,
    b.expectedCheckOutAt,
    b.actualCheckOutAt ?? '',
    b.status,
    b.source,
    b.ratePlanId,
    String(b.expectedDurationMinutes),
    String(b.baseAmount),
    b.overtimeMinutes !== undefined ? String(b.overtimeMinutes) : '',
    b.overtimeAmount  !== undefined ? String(b.overtimeAmount)  : '',
    String(b.totalAmount),
    b.numGuests !== undefined ? String(b.numGuests) : '',
    b.note ?? '',
    b.createdBy,
    b.createdAt,
    b.updatedAt,
  ];
}

// ─── Cleaning sheet ──────────────────────────────────────────────────────────────
// Columns: cleaning_id | room_id | booking_id | scheduledAt | status | priority |
//          assigned_to | started_at | completed_at | note | created_at | updated_at

export const CLEANING_HEADERS = [
  'cleaning_id', 'room_id', 'booking_id', 'scheduledAt', 'status',
  'priority', 'assigned_to', 'started_at', 'completed_at', 'note',
  'created_at', 'updated_at',
] as const;

export function mapRowToCleaningTask(row: string[]): CleaningTask {
  return {
    cleaningId:  row[0]  ?? '',
    roomId:       row[1]  ?? '',
    bookingId:   emptyToUndefined(row[2]),
    scheduledAt:  row[3]  ?? '',
    status:      (row[4]  ?? 'pending') as CleaningTask['status'],
    priority:    (row[5]  ?? 'medium') as CleaningTask['priority'],
    assignedTo:  emptyToUndefined(row[6]),
    startedAt:   emptyToUndefined(row[7]),
    completedAt: emptyToUndefined(row[8]),
    note:        emptyToUndefined(row[9]),
    createdAt:   row[10] ?? '',
    updatedAt:   row[11] ?? '',
  };
}

export function mapCleaningTaskToRow(t: CleaningTask): string[] {
  return [
    t.cleaningId,
    t.roomId,
    t.bookingId ?? '',
    t.scheduledAt,
    t.status,
    t.priority,
    t.assignedTo ?? '',
    t.startedAt ?? '',
    t.completedAt ?? '',
    t.note ?? '',
    t.createdAt,
    t.updatedAt,
  ];
}

// ─── Rate Plans sheet ───────────────────────────────────────────────────────────
// Columns: rate_plan_id | name | type | base_minutes | base_amount |
//          extra_minute_price | overtime_minute_price | overnight_start |
//          overnight_end | active

export const RATE_PLANS_HEADERS = [
  'rate_plan_id', 'name', 'type', 'base_minutes', 'base_amount',
  'extra_minute_price', 'overtime_minute_price',
  'overnight_start', 'overnight_end', 'active',
] as const;

export function mapRowToRatePlan(row: string[]): RatePlan {
  return {
    ratePlanId:            row[0]  ?? '',
    name:                   row[1]  ?? '',
    type:                  (row[2]  ?? 'hourly') as RatePlan['type'],
    baseMinutes:           row[3]  ? parseInt(row[3], 10) : 0,
    baseAmount:             row[4]  ? parseFloat(row[4]) : 0,
    extraMinutePrice:       row[5]  ? parseFloat(row[5]) : 0,
    overtimeMinutePrice:    row[6]  ? parseFloat(row[6]) : 0,
    overnightStart:        emptyToUndefined(row[7]),
    overnightEnd:         emptyToUndefined(row[8]),
    active:                 parseBool(row[9]),
  };
}

export function mapRatePlanToRow(p: RatePlan): string[] {
  return [
    p.ratePlanId,
    p.name,
    p.type,
    String(p.baseMinutes),
    String(p.baseAmount),
    String(p.extraMinutePrice),
    String(p.overtimeMinutePrice),
    p.overnightStart ?? '',
    p.overnightEnd ?? '',
    p.active ? 'TRUE' : 'FALSE',
  ];
}

// ─── RatePlanPrices sheet ─────────────────────────────────────────────────────────
// Columns: rate_plan_price_id | rate_plan_id | room_id | price_vnd | active |
//          created_at | updated_at
//
// Authoritative price lookup: each row pins a single (ratePlanId, roomId) pair
// to a VND amount. Missing rows mean the combination is not bookable yet.

export const RATE_PLAN_PRICES_HEADERS = [
  'rate_plan_price_id', 'rate_plan_id', 'room_id', 'price_vnd', 'active',
  'created_at', 'updated_at',
] as const;

export function mapRowToRatePlanPrice(row: string[]): RatePlanPrice {
  return {
    ratePlanPriceId: row[0]  ?? '',
    ratePlanId:       row[1]  ?? '',
    roomId:           row[2]  ?? '',
    priceVnd:         row[3]  ? parseFloat(row[3]) : 0,
    active:           parseBool(row[4]),
    createdAt:        row[5]  ?? '',
    updatedAt:        row[6]  ?? '',
  };
}

export function mapRatePlanPriceToRow(p: RatePlanPrice): string[] {
  return [
    p.ratePlanPriceId,
    p.ratePlanId,
    p.roomId,
    String(p.priceVnd),
    p.active ? 'TRUE' : 'FALSE',
    p.createdAt,
    p.updatedAt,
  ];
}

// ─── Users sheet ─────────────────────────────────────────────────────────────────
// Columns: user_id | name | email | password_hash | role | active | created_at | updated_at

export const USERS_HEADERS = [
  'user_id', 'name', 'email', 'password_hash', 'role', 'active', 'created_at', 'updated_at',
] as const;

export interface UserRow {
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'staff' | 'admin';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapRowToUser(row: string[]): UserRow {
  return {
    userId:       row[0] ?? '',
    name:         row[1] ?? '',
    email:        row[2] ?? '',
    passwordHash: row[3] ?? '',
    role:        (row[4] ?? 'staff') as 'staff' | 'admin',
    active:       parseBool(row[5]),
    createdAt:    row[6] ?? '',
    updatedAt:    row[7] ?? '',
  };
}

// Note: passwordHash is never serialized back from the User type (it's server-only).

// ─── Expenses sheet ──────────────────────────────────────────────────────────────
// Columns: expense_id | category | amount | date | description | vendor | created_at | updated_at

export const EXPENSES_HEADERS = [
  'expense_id', 'category', 'amount', 'date', 'description', 'vendor', 'created_at', 'updated_at',
] as const;

export function mapRowToExpense(row: string[]): Expense {
  return {
    expenseId:    row[0] ?? '',
    category:     row[1] ?? '',
    amount:       row[2] ? parseFloat(row[2]) : 0,
    date:         row[3] ?? '',
    description:  row[4] ?? '',
    vendor:       emptyToUndefined(row[5]),
    createdAt:    row[6] ?? '',
    updatedAt:    row[7] ?? '',
  };
}

export function mapExpenseToRow(e: Expense): string[] {
  return [
    e.expenseId,
    e.category,
    String(e.amount),
    e.date,
    e.description,
    e.vendor ?? '',
    e.createdAt,
    e.updatedAt,
  ];
}

// ─── Notifications sheet ──────────────────────────────────────────────────────────
// Columns: notification_id | type | title | message | time | read | priority |
//          related_booking_id | related_room_id | created_at | updated_at

export const NOTIFICATIONS_HEADERS = [
  'notification_id', 'type', 'title', 'message', 'time', 'read', 'priority',
  'related_booking_id', 'related_room_id', 'created_at', 'updated_at',
] as const;

export function mapRowToNotification(row: string[]): {
  notificationId: string; type: string; title: string; message: string;
  time: string; read: boolean; priority: string;
  relatedBookingId?: string; relatedRoomId?: string;
  createdAt: string; updatedAt: string;
} {
  return {
    notificationId:   row[0]  ?? '',
    type:             row[1]  ?? 'check_in',
    title:            row[2]  ?? '',
    message:          row[3]  ?? '',
    time:             row[4]  ?? '',
    read:             parseBool(row[5]),
    priority:         row[6]  ?? 'medium',
    relatedBookingId: emptyToUndefined(row[7]),
    relatedRoomId:    emptyToUndefined(row[8]),
    createdAt:        row[9]  ?? '',
    updatedAt:        row[10] ?? '',
  };
}

export function mapNotificationToRow(n: Notification): string[] {
  return [
    n.notificationId,
    n.type,
    n.title,
    n.message,
    n.time,
    n.read ? 'TRUE' : 'FALSE',
    n.priority,
    n.relatedBookingId ?? '',
    n.relatedRoomId ?? '',
    n.createdAt ?? new Date().toISOString(),
    n.updatedAt ?? new Date().toISOString(),
  ];
}

// ─── Sheet ranges ────────────────────────────────────────────────────────────────
// Use these as the `range` argument to sheets.getValues / setValues.

export const SHEETS = {
  Locations:    'Locations',
  Rooms:       'Rooms',
  Customers:   'Customers',
  Bookings:    'Bookings',
  Cleaning:    'Cleaning',
  RatePlans:   'RatePlans',
  RatePlanPrices: 'RatePlanPrices',
  Users:       'Users',
  Expenses:    'Expenses',
  Notifications: 'Notifications',
} as const;

export function sheetDataRange(sheetName: string, headersCount: number): string {
  // Columns: A..Z based on header count
  const lastCol = String.fromCharCode(64 + headersCount);
  return `${sheetName}!A${lastCol}`;
}

export function sheetFullRange(sheetName: string, headersCount: number): string {
  const lastCol = String.fromCharCode(64 + headersCount);
  return `${sheetName}!A1:${lastCol}`;
}
