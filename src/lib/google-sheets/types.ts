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

/** Parse a Google Sheets "TRUE"/"FALSE" string to boolean. Defaults to true unless explicitly false. */
function parseBool(v: any): boolean {
  if (v === false || v === 0 || v === '0') return false;
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    if (s === 'FALSE' || s === '0' || s === 'NO') return false;
  }
  return true;
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
  const capNum = parseInt(row[4] ?? '2', 10);
  const floorNum = row[9] ? parseInt(row[9], 10) : undefined;
  return {
    roomId:          row[0] ?? '',
    locationId:      row[1] ?? '',
    name:            row[2] ?? '',
    description:     emptyToUndefined(row[3]),
    capacity:       isNaN(capNum) ? 2 : capNum,
    priceDisplay:   emptyToUndefined(row[5]),
    status:         (row[6] ?? 'available') as Room['status'],
    active:          parseBool(row[7]),
    imageUrl:        emptyToUndefined(row[8]),
    floor:           floorNum !== undefined && !isNaN(floorNum) ? floorNum : 1,
    amenities:       amenitiesStr ? amenitiesStr.split('|').filter(Boolean) : [],
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
// Columns: customer_id | name | source | email | note | created_at | updated_at
// IMPORTANT: layout is 7 columns. `name` is the guest's display name captured
// from the booking form's "Guest Name" field. Each booking creates / reuses a
// Customer row identified by the (name, source) pair — see customers.repository
// findOrCreate.

export const CUSTOMERS_HEADERS = [
  'customer_id',
  'name',
  'source',
  'email',
  'note',
  'created_at',
  'updated_at',
] as const;

// Known booking source values for legacy-layout detection
const BOOKING_SOURCE_VALUES = new Set(['INSTAGRAM', 'TIKTOK', 'ZALO', 'FACEBOOK', 'KHÁC']);

export function mapRowToCustomer(row: string[]): Customer {
  // Detect legacy 6-column layout (no `name` column) vs new 7-column layout.
  //
  // We CANNOT rely on row.length alone because Google Sheets API trims trailing
  // empty cells — a new-layout row with no email/note/updatedAt will be returned
  // with length < 7, making it look "legacy" and wiping out the guest name.
  //
  // Instead: if row[1] is a known source enum value (INSTAGRAM, TIKTOK, etc.)
  // then row[1] IS the source column → legacy layout (customer_id | source | …).
  // If row[1] is anything else (a name string, or empty), it's the new layout
  // (customer_id | name | source | …).
  const isLegacy = BOOKING_SOURCE_VALUES.has((row[1] ?? '').trim().toUpperCase());

  return {
    customerId:  row[0] ?? '',
    name:        isLegacy ? '' : (emptyToUndefined(row[1]) ?? ''),
    source:      (isLegacy ? emptyToUndefined(row[1]) : emptyToUndefined(row[2])) as Customer['source'],
    email:       emptyToUndefined(isLegacy ? row[2] : row[3]) ?? undefined,
    note:        emptyToUndefined(isLegacy ? row[3] : row[4]) ?? undefined,
    createdAt:   row[isLegacy ? 4 : 5] ?? '',
    updatedAt:   row[isLegacy ? 5 : 6] ?? '',
  };
}

export function mapCustomerToRow(c: Customer): string[] {
  return [
    c.customerId,
    c.name ?? '',        // B (1): guest display name
    c.source ?? '',      // C (2)
    c.email ?? '',       // D (3)
    c.note ?? '',        // E (4)
    c.createdAt,         // F (5)
    c.updatedAt,         // G (6)
  ];
}

// ─── Bookings sheet ──────────────────────────────────────────────────────────────
// Columns in Google Sheets:
// A (0):  booking_id
// B (1):  room_id
// C (2):  customer_id
// D (3):  checkInAt
// E (4):  expectedCheckOutAt
// F (5):  actualCheckOutAt
// G (6):  status
// H (7):  ratePlanId
// I (8):  bookingType
// J (9):  expectedDurationMinutes
// K (10): baseAmount
// L (11): overtimeMinutes
// M (12): overtimeAmount
// N (13): totalAmount
// O (14): unitPriceAtBooking
// P (15): numGuests
// Q (16): note
// R (17): guestName
// S (18): created_by
// T (19): created_at
// U (20): updated_at
// V (21): depositAmount
// W (22): paidAmount
// X (23): paymentStatus

export const BOOKINGS_HEADERS = [
  'booking_id',
  'room_id',
  'customer_id',
  'checkInAt',
  'expectedCheckOutAt',
  'actualCheckOutAt',
  'status',
  'ratePlanId',
  'bookingType',
  'expectedDurationMinutes',
  'baseAmount',
  'overtimeMinutes',
  'overtimeAmount',
  'totalAmount',
  'unitPriceAtBooking',
  'numGuests',
  'note',
  'guestName',
  'created_by',
  'created_at',
  'updated_at',
  'depositAmount',
  'paidAmount',
  'paymentStatus',
] as const;

export function mapRowToBooking(row: string[]): Booking {
  // ── Layout detection ─────────────────────────────────────────────────────────
  //
  // New 21-col layout (current):
  //   A(0)  booking_id
  //   B(1)  room_id
  //   C(2)  customer_id
  //   D(3)  checkInAt
  //   E(4)  expectedCheckOutAt
  //   F(5)  actualCheckOutAt
  //   G(6)  status
  //   H(7)  ratePlanId
  //   I(8)  bookingType          ← added in v2
  //   J(9)  expectedDurationMinutes
  //   K(10) baseAmount
  //   L(11) overtimeMinutes
  //   M(12) overtimeAmount
  //   N(13) totalAmount
  //   O(14) unitPriceAtBooking   ← added in v2
  //   P(15) numGuests
  //   Q(16) note
  //   R(17) guestName            ← added in v2
  //   S(18) created_by
  //   T(19) created_at
  //   U(20) updated_at
  //
  // Old 18-col layout (seed.ts initial):
  //   Columns 0–7 same, then:
  //   J(8)  expectedDurationMinutes (no bookingType col!)
  //   K(9)  baseAmount
  //   L(10) overtimeMinutes
  //   M(11) overtimeAmount
  //   N(12) totalAmount
  //   O(13) numGuests             (no unitPriceAtBooking col!)
  //   P(14) note
  //   Q(15) created_by            (no guestName col!)
  //   R(16) created_at
  //   S(17) updated_at
  //
  // Detect: col 8 holds an RP-XXXX id or 'custom' → old layout (no bookingType col)
  const isOldLayout = row[8]?.startsWith('RP-') || row[8] === 'custom' || (row.length <= 18 && !row[8]?.match(/^(daily|hourly)$/));

  const ratePlanId = row[7] ?? '';

  // bookingType: col I(8) in new layout; derive from ratePlanId in old layout
  const rawBookingType: string = isOldLayout
    ? (ratePlanId.startsWith('RP-') ? 'daily' : 'hourly')
    : (row[8] ?? 'daily');

  // Numeric fields — use fixed indices for new layout, shifted for old layout
  const durationMinutes = isOldLayout
    ? (row[8] ? parseInt(row[8], 10) : 0)
    : (row[9] ? parseInt(row[9], 10) : 0);
  let baseAmount = isOldLayout
    ? (row[9] ? parseFloat(row[9]) : 0)
    : (row[10] ? parseFloat(row[10]) : 0);
  const rawOvertimeMinutes = isOldLayout
    ? (row[10] ? parseInt(row[10], 10) : undefined)
    : (row[11] ? parseInt(row[11], 10) : undefined);
  const rawOvertimeAmount = isOldLayout
    ? (row[11] ? parseFloat(row[11]) : undefined)
    : (row[12] ? parseFloat(row[12]) : undefined);
  const overtimeAmount = (rawOvertimeAmount && rawOvertimeAmount >= 1000) ? rawOvertimeAmount : undefined;
  let totalAmount = isOldLayout
    ? (row[12] ? parseFloat(row[12]) : 0)
    : (row[13] ? parseFloat(row[13]) : 0);

  // unitPriceAtBooking: col O(14) in new layout — absent in old layout
  const unitPriceAtBooking = isOldLayout
    ? undefined
    : (row[14] ? parseFloat(row[14]) : undefined);

  // numGuests: col P(15) new / col O(13) old
  const numGuests = isOldLayout
    ? (row[13] ? parseInt(row[13], 10) : undefined)
    : (row[15] ? parseInt(row[15], 10) : undefined);

  // note: col Q(16) new / col P(14) old
  const note = isOldLayout
    ? emptyToUndefined(row[14])
    : emptyToUndefined(row[16]);

  // guestName: col R(17) in new layout — absent in old layout
  const guestName = isOldLayout
    ? ''
    : (emptyToUndefined(row[17]) ?? '');

  // created_by: col S(18) new / col Q(15) old
  const createdBy = isOldLayout ? (row[15] ?? '') : (row[18] ?? '');

  // created_at: col T(19) new / col R(16) old
  const createdAt = isOldLayout ? (row[16] ?? '') : (row[19] ?? '');

  // updated_at: col U(20) new / col S(17) old
  const updatedAt = isOldLayout ? (row[17] ?? '') : (row[20] ?? '');

  // Payment fields: cols V(21)/W(22)/X(23) — absent on rows written before this migration.
  const depositAmount = row[21] ? parseFloat(row[21]) : undefined;
  const paidAmount = row[22] ? parseFloat(row[22]) : undefined;
  const paymentStatus = emptyToUndefined(row[23]) as Booking['paymentStatus'] | undefined;

  // Auto-fix: if totalAmount is suspiciously small but baseAmount is valid, use baseAmount
  if (totalAmount <= 10 && baseAmount >= 1000) {
    totalAmount = baseAmount + (overtimeAmount || 0);
  }

  return {
    bookingId:                row[0]  ?? '',
    roomId:                   row[1]  ?? '',
    customerId:               row[2]  ?? '',
    checkInAt:                row[3]  ?? '',
    expectedCheckOutAt:        row[4]  ?? '',
    actualCheckOutAt:         emptyToUndefined(row[5]),
    status:                   (row[6]  ?? 'inquiry') as Booking['status'],
    ratePlanId:               ratePlanId,
    bookingType:              (rawBookingType as Booking['bookingType']) || 'daily',
    expectedDurationMinutes:  durationMinutes,
    baseAmount:               baseAmount,
    overtimeMinutes:          rawOvertimeMinutes,
    overtimeAmount:           overtimeAmount,
    totalAmount:              totalAmount,
    unitPriceAtBooking:       unitPriceAtBooking,
    numGuests:                numGuests,
    note:                     note,
    guestName:                guestName,
    createdBy:                createdBy,
    createdAt:                createdAt,
    updatedAt:                updatedAt,
    depositAmount:            depositAmount,
    paidAmount:               paidAmount,
    paymentStatus:            paymentStatus,
  };
}

export function mapBookingToRow(b: Booking): string[] {
  return [
    b.bookingId,                               // A (0):  booking_id
    b.roomId,                                  // B (1):  room_id
    b.customerId,                              // C (2):  customer_id
    b.checkInAt,                               // D (3):  checkInAt
    b.expectedCheckOutAt,                      // E (4):  expectedCheckOutAt
    b.actualCheckOutAt ?? '',                  // F (5):  actualCheckOutAt
    b.status,                                  // G (6):  status
    b.ratePlanId ?? '',                        // H (7):  ratePlanId
    b.bookingType,                             // I (8):  bookingType
    String(b.expectedDurationMinutes ?? 0),    // J (9):  expectedDurationMinutes
    String(b.baseAmount ?? 0),                 // K (10): baseAmount
    b.overtimeMinutes !== undefined ? String(b.overtimeMinutes) : '', // L (11): overtimeMinutes
    b.overtimeAmount  !== undefined ? String(b.overtimeAmount)  : '', // M (12): overtimeAmount
    String(b.totalAmount ?? 0),                // N (13): totalAmount
    b.unitPriceAtBooking !== undefined ? String(b.unitPriceAtBooking) : '', // O (14): unitPriceAtBooking
    b.numGuests !== undefined ? String(b.numGuests) : '',        // P (15): numGuests
    b.note ?? '',                              // Q (16): note
    b.guestName ?? '',                         // R (17): guestName
    b.createdBy || 'USR-0001',                 // S (18): created_by
    b.createdAt,                               // T (19): created_at
    b.updatedAt,                               // U (20): updated_at
    b.depositAmount !== undefined ? String(b.depositAmount) : '', // V (21): depositAmount
    b.paidAmount !== undefined ? String(b.paidAmount) : '',       // W (22): paidAmount
    b.paymentStatus ?? '',                     // X (23): paymentStatus
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
  // Check if 8-column format (as in the active Google Sheets):
  // [0: rate_plan_id, 1: name, 2: type, 3: base_minutes, 4: overtime_minute, 5: overnight_start, 6: overnight_end, 7: active]
  const is8Col = row.length <= 8 || (row[5] && row[5].includes(':')) || (row[7] !== undefined && (row[7].toUpperCase() === 'TRUE' || row[7].toUpperCase() === 'FALSE' || row[7] === ''));

  if (is8Col) {
    return {
      ratePlanId:            row[0]  ?? '',
      name:                   row[1]  ?? '',
      type:                  (row[2]  ?? 'hourly') as RatePlan['type'],
      baseMinutes:           row[3]  ? parseInt(row[3], 10) : 0,
      baseAmount:             0,
      extraMinutePrice:       0,
      overtimeMinutePrice:    row[4]  ? parseFloat(row[4]) : 0,
      overnightStart:        emptyToUndefined(row[5]),
      overnightEnd:         emptyToUndefined(row[6]),
      active:                 parseBool(row[7]),
    };
  }

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
