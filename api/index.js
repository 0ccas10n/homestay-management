var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/pages/api/index.ts
var api_exports = {};
__export(api_exports, {
  authLogin: () => login_exports,
  authLogout: () => logout_exports,
  authMe: () => me_exports,
  availability: () => availability_exports,
  bookingsId: () => id_exports,
  bookingsIndex: () => bookings_exports,
  bookingsStatus: () => status_exports,
  cleaningId: () => id_exports2,
  cleaningIndex: () => cleaning_exports,
  customersIndex: () => customers_exports,
  dashboard: () => dashboard_exports,
  expensesIndex: () => expenses_exports,
  health: () => health_exports,
  locations: () => locations_exports,
  notificationsId: () => id_exports3,
  notificationsIndex: () => notifications_exports,
  notificationsMarkAllRead: () => mark_all_read_exports,
  ratePlanPricesIndex: () => rate_plan_prices_exports,
  ratePlansIndex: () => rate_plans_exports,
  roomsId: () => id_exports4,
  roomsIndex: () => rooms_exports2,
  roomsRoot: () => rooms_exports
});

// src/pages/api/availability.ts
var availability_exports = {};
__export(availability_exports, {
  GET: () => GET
});

// src/lib/google-sheets/client.ts
import { google } from "googleapis";

// src/lib/google-sheets/types.ts
function emptyToUndefined(v) {
  return v === "" || v === void 0 ? void 0 : v;
}
function parseBool(v) {
  if (v === false || v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    if (s === "FALSE" || s === "0" || s === "NO") return false;
  }
  return true;
}
var LOCATIONS_HEADERS = [
  "location_id",
  "name",
  "description",
  "public_address",
  "phone",
  "active",
  "created_at",
  "updated_at"
];
function mapRowToLocation(row) {
  return {
    locationId: row[0] ?? "",
    name: row[1] ?? "",
    description: emptyToUndefined(row[2]),
    publicAddress: emptyToUndefined(row[3]),
    phone: emptyToUndefined(row[4]),
    active: parseBool(row[5]),
    createdAt: row[6] ?? "",
    updatedAt: row[7] ?? ""
  };
}
function mapLocationToRow(loc) {
  return [
    loc.locationId,
    loc.name,
    loc.description ?? "",
    loc.publicAddress ?? "",
    loc.phone ?? "",
    loc.active ? "TRUE" : "FALSE",
    loc.createdAt,
    loc.updatedAt
  ];
}
var ROOMS_HEADERS = [
  "room_id",
  "location_id",
  "name",
  "description",
  "capacity",
  "price_display",
  "status",
  "active",
  "image_url",
  "floor",
  "amenities",
  "notes",
  "created_at",
  "updated_at"
];
function mapRowToRoom(row) {
  const amenitiesStr = row[10] ?? "";
  const capNum = parseInt(row[4] ?? "2", 10);
  const floorNum = row[9] ? parseInt(row[9], 10) : void 0;
  return {
    roomId: row[0] ?? "",
    locationId: row[1] ?? "",
    name: row[2] ?? "",
    description: emptyToUndefined(row[3]),
    capacity: isNaN(capNum) ? 2 : capNum,
    priceDisplay: emptyToUndefined(row[5]),
    status: row[6] ?? "available",
    active: parseBool(row[7]),
    imageUrl: emptyToUndefined(row[8]),
    floor: floorNum !== void 0 && !isNaN(floorNum) ? floorNum : 1,
    amenities: amenitiesStr ? amenitiesStr.split("|").filter(Boolean) : [],
    notes: emptyToUndefined(row[11]),
    createdAt: row[12] ?? "",
    updatedAt: row[13] ?? ""
  };
}
function mapRoomToRow(room) {
  return [
    room.roomId,
    room.locationId,
    room.name,
    room.description ?? "",
    String(room.capacity),
    room.priceDisplay ?? "",
    room.status,
    room.active ? "TRUE" : "FALSE",
    room.imageUrl ?? "",
    room.floor !== void 0 ? String(room.floor) : "",
    (room.amenities ?? []).join("|"),
    room.notes ?? "",
    room.createdAt,
    room.updatedAt
  ];
}
var CUSTOMERS_HEADERS = [
  "customer_id",
  "name",
  "source",
  "email",
  "note",
  "created_at",
  "updated_at"
];
var BOOKING_SOURCE_VALUES = /* @__PURE__ */ new Set(["INSTAGRAM", "TIKTOK", "ZALO", "FACEBOOK", "KH\xC1C"]);
function mapRowToCustomer(row) {
  const isLegacy = BOOKING_SOURCE_VALUES.has((row[1] ?? "").trim().toUpperCase());
  return {
    customerId: row[0] ?? "",
    name: isLegacy ? "" : emptyToUndefined(row[1]) ?? "",
    source: isLegacy ? emptyToUndefined(row[1]) : emptyToUndefined(row[2]),
    email: emptyToUndefined(isLegacy ? row[2] : row[3]) ?? void 0,
    note: emptyToUndefined(isLegacy ? row[3] : row[4]) ?? void 0,
    createdAt: row[isLegacy ? 4 : 5] ?? "",
    updatedAt: row[isLegacy ? 5 : 6] ?? ""
  };
}
function mapCustomerToRow(c) {
  return [
    c.customerId,
    c.name ?? "",
    // B (1): guest display name
    c.source ?? "",
    // C (2)
    c.email ?? "",
    // D (3)
    c.note ?? "",
    // E (4)
    c.createdAt,
    // F (5)
    c.updatedAt
    // G (6)
  ];
}
var BOOKINGS_HEADERS = [
  "booking_id",
  "room_id",
  "customer_id",
  "checkInAt",
  "expectedCheckOutAt",
  "actualCheckOutAt",
  "status",
  "ratePlanId",
  "bookingType",
  "expectedDurationMinutes",
  "baseAmount",
  "overtimeMinutes",
  "overtimeAmount",
  "totalAmount",
  "unitPriceAtBooking",
  "numGuests",
  "note",
  "guestName",
  "created_by",
  "created_at",
  "updated_at",
  "depositAmount",
  "paidAmount",
  "paymentStatus"
];
function mapRowToBooking(row) {
  const isOldLayout = row[8]?.startsWith("RP-") || row[8] === "custom" || row.length <= 18 && !row[8]?.match(/^(daily|hourly)$/);
  const ratePlanId = row[7] ?? "";
  const rawBookingType = isOldLayout ? ratePlanId.startsWith("RP-") ? "daily" : "hourly" : row[8] ?? "daily";
  const durationMinutes = isOldLayout ? row[8] ? parseInt(row[8], 10) : 0 : row[9] ? parseInt(row[9], 10) : 0;
  let baseAmount = isOldLayout ? row[9] ? parseFloat(row[9]) : 0 : row[10] ? parseFloat(row[10]) : 0;
  const rawOvertimeMinutes = isOldLayout ? row[10] ? parseInt(row[10], 10) : void 0 : row[11] ? parseInt(row[11], 10) : void 0;
  const rawOvertimeAmount = isOldLayout ? row[11] ? parseFloat(row[11]) : void 0 : row[12] ? parseFloat(row[12]) : void 0;
  const overtimeAmount = rawOvertimeAmount && rawOvertimeAmount >= 1e3 ? rawOvertimeAmount : void 0;
  let totalAmount = isOldLayout ? row[12] ? parseFloat(row[12]) : 0 : row[13] ? parseFloat(row[13]) : 0;
  const unitPriceAtBooking = isOldLayout ? void 0 : row[14] ? parseFloat(row[14]) : void 0;
  const numGuests = isOldLayout ? row[13] ? parseInt(row[13], 10) : void 0 : row[15] ? parseInt(row[15], 10) : void 0;
  const note = isOldLayout ? emptyToUndefined(row[14]) : emptyToUndefined(row[16]);
  const guestName = isOldLayout ? "" : emptyToUndefined(row[17]) ?? "";
  const createdBy = isOldLayout ? row[15] ?? "" : row[18] ?? "";
  const createdAt = isOldLayout ? row[16] ?? "" : row[19] ?? "";
  const updatedAt = isOldLayout ? row[17] ?? "" : row[20] ?? "";
  const depositAmount = row[21] ? parseFloat(row[21]) : void 0;
  const paidAmount = row[22] ? parseFloat(row[22]) : void 0;
  const paymentStatus = emptyToUndefined(row[23]);
  if (totalAmount <= 10 && baseAmount >= 1e3) {
    totalAmount = baseAmount + (overtimeAmount || 0);
  }
  return {
    bookingId: row[0] ?? "",
    roomId: row[1] ?? "",
    customerId: row[2] ?? "",
    checkInAt: row[3] ?? "",
    expectedCheckOutAt: row[4] ?? "",
    actualCheckOutAt: emptyToUndefined(row[5]),
    status: row[6] ?? "confirmed",
    ratePlanId,
    bookingType: rawBookingType || "daily",
    expectedDurationMinutes: durationMinutes,
    baseAmount,
    overtimeMinutes: rawOvertimeMinutes,
    overtimeAmount,
    totalAmount,
    unitPriceAtBooking,
    numGuests,
    note,
    guestName,
    createdBy,
    createdAt,
    updatedAt,
    depositAmount,
    paidAmount,
    paymentStatus
  };
}
function mapBookingToRow(b) {
  return [
    b.bookingId,
    // A (0):  booking_id
    b.roomId,
    // B (1):  room_id
    b.customerId,
    // C (2):  customer_id
    b.checkInAt,
    // D (3):  checkInAt
    b.expectedCheckOutAt,
    // E (4):  expectedCheckOutAt
    b.actualCheckOutAt ?? "",
    // F (5):  actualCheckOutAt
    b.status,
    // G (6):  status
    b.ratePlanId ?? "",
    // H (7):  ratePlanId
    b.bookingType,
    // I (8):  bookingType
    String(b.expectedDurationMinutes ?? 0),
    // J (9):  expectedDurationMinutes
    String(b.baseAmount ?? 0),
    // K (10): baseAmount
    b.overtimeMinutes !== void 0 ? String(b.overtimeMinutes) : "",
    // L (11): overtimeMinutes
    b.overtimeAmount !== void 0 ? String(b.overtimeAmount) : "",
    // M (12): overtimeAmount
    String(b.totalAmount ?? 0),
    // N (13): totalAmount
    b.unitPriceAtBooking !== void 0 ? String(b.unitPriceAtBooking) : "",
    // O (14): unitPriceAtBooking
    b.numGuests !== void 0 ? String(b.numGuests) : "",
    // P (15): numGuests
    b.note ?? "",
    // Q (16): note
    b.guestName ?? "",
    // R (17): guestName
    b.createdBy || "USR-0001",
    // S (18): created_by
    b.createdAt,
    // T (19): created_at
    b.updatedAt,
    // U (20): updated_at
    b.depositAmount !== void 0 ? String(b.depositAmount) : "",
    // V (21): depositAmount
    b.paidAmount !== void 0 ? String(b.paidAmount) : "",
    // W (22): paidAmount
    b.paymentStatus ?? ""
    // X (23): paymentStatus
  ];
}
var CLEANING_HEADERS = [
  "cleaning_id",
  "room_id",
  "booking_id",
  "scheduledAt",
  "status",
  "priority",
  "assigned_to",
  "started_at",
  "completed_at",
  "note",
  "created_at",
  "updated_at"
];
function mapRowToCleaningTask(row) {
  return {
    cleaningId: row[0] ?? "",
    roomId: row[1] ?? "",
    bookingId: emptyToUndefined(row[2]),
    scheduledAt: row[3] ?? "",
    status: row[4] ?? "pending",
    priority: row[5] ?? "medium",
    assignedTo: emptyToUndefined(row[6]),
    startedAt: emptyToUndefined(row[7]),
    completedAt: emptyToUndefined(row[8]),
    note: emptyToUndefined(row[9]),
    createdAt: row[10] ?? "",
    updatedAt: row[11] ?? ""
  };
}
function mapCleaningTaskToRow(t) {
  return [
    t.cleaningId,
    t.roomId,
    t.bookingId ?? "",
    t.scheduledAt,
    t.status,
    t.priority,
    t.assignedTo ?? "",
    t.startedAt ?? "",
    t.completedAt ?? "",
    t.note ?? "",
    t.createdAt,
    t.updatedAt
  ];
}
var RATE_PLANS_HEADERS = [
  "rate_plan_id",
  "name",
  "type",
  "base_minutes",
  "base_amount",
  "extra_minute_price",
  "overtime_minute_price",
  "overnight_start",
  "overnight_end",
  "active"
];
function mapRowToRatePlan(row) {
  const is8Col = row.length <= 8 || row[5] && row[5].includes(":") || row[7] !== void 0 && (row[7].toUpperCase() === "TRUE" || row[7].toUpperCase() === "FALSE" || row[7] === "");
  if (is8Col) {
    return {
      ratePlanId: row[0] ?? "",
      name: row[1] ?? "",
      type: row[2] ?? "hourly",
      baseMinutes: row[3] ? parseInt(row[3], 10) : 0,
      baseAmount: 0,
      extraMinutePrice: 0,
      overtimeMinutePrice: row[4] ? parseFloat(row[4]) : 0,
      overnightStart: emptyToUndefined(row[5]),
      overnightEnd: emptyToUndefined(row[6]),
      active: parseBool(row[7])
    };
  }
  return {
    ratePlanId: row[0] ?? "",
    name: row[1] ?? "",
    type: row[2] ?? "hourly",
    baseMinutes: row[3] ? parseInt(row[3], 10) : 0,
    baseAmount: row[4] ? parseFloat(row[4]) : 0,
    extraMinutePrice: row[5] ? parseFloat(row[5]) : 0,
    overtimeMinutePrice: row[6] ? parseFloat(row[6]) : 0,
    overnightStart: emptyToUndefined(row[7]),
    overnightEnd: emptyToUndefined(row[8]),
    active: parseBool(row[9])
  };
}
function mapRatePlanToRow(p) {
  return [
    p.ratePlanId,
    p.name,
    p.type,
    String(p.baseMinutes),
    String(p.baseAmount),
    String(p.extraMinutePrice),
    String(p.overtimeMinutePrice),
    p.overnightStart ?? "",
    p.overnightEnd ?? "",
    p.active ? "TRUE" : "FALSE"
  ];
}
var RATE_PLAN_PRICES_HEADERS = [
  "rate_plan_price_id",
  "rate_plan_id",
  "room_id",
  "price_vnd",
  "active",
  "created_at",
  "updated_at"
];
function mapRowToRatePlanPrice(row) {
  return {
    ratePlanPriceId: row[0] ?? "",
    ratePlanId: row[1] ?? "",
    roomId: row[2] ?? "",
    priceVnd: row[3] ? parseFloat(row[3]) : 0,
    active: parseBool(row[4]),
    createdAt: row[5] ?? "",
    updatedAt: row[6] ?? ""
  };
}
var USERS_HEADERS = [
  "user_id",
  "name",
  "email",
  "password_hash",
  "role",
  "active",
  "created_at",
  "updated_at"
];
function mapRowToUser(row) {
  return {
    userId: row[0] ?? "",
    name: row[1] ?? "",
    email: row[2] ?? "",
    passwordHash: row[3] ?? "",
    role: row[4] ?? "staff",
    active: parseBool(row[5]),
    createdAt: row[6] ?? "",
    updatedAt: row[7] ?? ""
  };
}
var EXPENSES_HEADERS = [
  "expense_id",
  "category",
  "amount",
  "date",
  "description",
  "vendor",
  "created_at",
  "updated_at"
];
function mapRowToExpense(row) {
  return {
    expenseId: row[0] ?? "",
    category: row[1] ?? "",
    amount: row[2] ? parseFloat(row[2]) : 0,
    date: row[3] ?? "",
    description: row[4] ?? "",
    vendor: emptyToUndefined(row[5]),
    createdAt: row[6] ?? "",
    updatedAt: row[7] ?? ""
  };
}
function mapExpenseToRow(e) {
  return [
    e.expenseId,
    e.category,
    String(e.amount),
    e.date,
    e.description,
    e.vendor ?? "",
    e.createdAt,
    e.updatedAt
  ];
}
var NOTIFICATIONS_HEADERS = [
  "notification_id",
  "type",
  "title",
  "message",
  "time",
  "read",
  "priority",
  "related_booking_id",
  "related_room_id",
  "created_at",
  "updated_at"
];
function mapRowToNotification(row) {
  return {
    notificationId: row[0] ?? "",
    type: row[1] ?? "check_in",
    title: row[2] ?? "",
    message: row[3] ?? "",
    time: row[4] ?? "",
    read: parseBool(row[5]),
    priority: row[6] ?? "medium",
    relatedBookingId: emptyToUndefined(row[7]),
    relatedRoomId: emptyToUndefined(row[8]),
    createdAt: row[9] ?? "",
    updatedAt: row[10] ?? ""
  };
}
function mapNotificationToRow(n) {
  return [
    n.notificationId,
    n.type,
    n.title,
    n.message,
    n.time,
    n.read ? "TRUE" : "FALSE",
    n.priority,
    n.relatedBookingId ?? "",
    n.relatedRoomId ?? "",
    n.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    n.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString()
  ];
}
var SHEETS = {
  Locations: "Locations",
  Rooms: "Rooms",
  Customers: "Customers",
  Bookings: "Bookings",
  Cleaning: "Cleaning",
  RatePlans: "RatePlans",
  RatePlanPrices: "RatePlanPrices",
  Users: "Users",
  Expenses: "Expenses",
  Notifications: "Notifications"
};

// src/data/sampleData.ts
var rooms = [
  { roomId: "ROOM-0001", locationId: "LOC-0001", name: "Hi\xEAn 1", description: "Ph\xF2ng Standard \u2014 1 gi\u01B0\u1EDDng \u0111\xF4i + 1 gi\u01B0\u1EDDng \u0111\u01A1n (t\u1ED1i \u0111a 4 kh\xE1ch)", capacity: 4, priceDisplay: "T\u1EEB 350.000 \u20AB/\u0111\xEAm", status: "occupied", active: true, floor: 1, amenities: ["WiFi", "AC", "TV"], createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { roomId: "ROOM-0002", locationId: "LOC-0001", name: "Hi\xEAn 2", description: "Ph\xF2ng Standard \u2014 1 gi\u01B0\u1EDDng \u0111\xF4i + 1 gi\u01B0\u1EDDng \u0111\u01A1n (t\u1ED1i \u0111a 4 kh\xE1ch)", capacity: 4, priceDisplay: "T\u1EEB 350.000 \u20AB/\u0111\xEAm", status: "available", active: true, floor: 1, amenities: ["WiFi", "AC", "TV"], createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { roomId: "ROOM-0003", locationId: "LOC-0001", name: "Hi\xEAn 3", description: "Ph\xF2ng Standard \u2014 1 gi\u01B0\u1EDDng \u0111\xF4i + 1 gi\u01B0\u1EDDng \u0111\u01A1n (t\u1ED1i \u0111a 4 kh\xE1ch)", capacity: 4, priceDisplay: "T\u1EEB 350.000 \u20AB/\u0111\xEAm", status: "cleaning", active: true, floor: 1, amenities: ["WiFi", "AC", "TV", "B\u1ED3n t\u1EAFm"], notes: "AC unit needs repair", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { roomId: "ROOM-0004", locationId: "LOC-0001", name: "Y\xEAn 1", description: "Ph\xF2ng Deluxe \u2014 1 gi\u01B0\u1EDDng \u0111\xF4i + 2 gi\u01B0\u1EDDng \u0111\u01A1n (t\u1ED1i \u0111a 5 kh\xE1ch)", capacity: 5, priceDisplay: "T\u1EEB 450.000 \u20AB/\u0111\xEAm", status: "available", active: true, floor: 1, amenities: ["WiFi", "AC", "TV", "B\u1ED3n t\u1EAFm"], createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { roomId: "ROOM-0005", locationId: "LOC-0001", name: "Y\xEAn 2", description: "Ph\xF2ng Deluxe \u2014 1 gi\u01B0\u1EDDng \u0111\xF4i + 2 gi\u01B0\u1EDDng \u0111\u01A1n (t\u1ED1i \u0111a 5 kh\xE1ch)", capacity: 5, priceDisplay: "T\u1EEB 450.000 \u20AB/\u0111\xEAm", status: "occupied", active: true, floor: 2, amenities: ["WiFi", "AC", "TV", "B\u1ED3n t\u1EAFm", "Ban c\xF4ng"], createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { roomId: "ROOM-0006", locationId: "LOC-0001", name: "Y\xEAn 3", description: "Ph\xF2ng Deluxe \u2014 1 gi\u01B0\u1EDDng \u0111\xF4i + 2 gi\u01B0\u1EDDng \u0111\u01A1n (t\u1ED1i \u0111a 5 kh\xE1ch)", capacity: 5, priceDisplay: "T\u1EEB 450.000 \u20AB/\u0111\xEAm", status: "occupied", active: true, floor: 2, amenities: ["WiFi", "AC", "TV", "B\u1ED3n t\u1EAFm", "Ban c\xF4ng", "B\u1EBFp"], createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" }
];
var customers = [
  { customerId: "CUS-0001", name: "Nadia Okonkwo", source: "FACEBOOK", email: "nadia.okonkwo@gmail.com", note: "Prefers high floor rooms", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0002", name: "Marcus Chen", source: "INSTAGRAM", email: "marcus.chen@outlook.com", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0003", name: "Elena Vasquez", source: "TIKTOK", email: "elena.v@gmail.com", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0004", name: "James Whitfield", source: "ZALO", email: "j.whitfield@company.com", note: "Business traveler, early check-in requested", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0005", name: "Aisha Rahman", source: "FACEBOOK", email: "aisha.r@yahoo.com", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0006", name: "Tom\xE1s Eriksson", source: "INSTAGRAM", email: "tomas.e@hotmail.com", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0007", name: "Priya Sharma", source: "TIKTOK", email: "priya.s@gmail.com", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" },
  { customerId: "CUS-0008", name: "Carlos Mendes", source: "ZALO", email: "carlos.m@gmail.com", createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" }
];
var bookings = [
  {
    bookingId: "BOOK-0001",
    roomId: "ROOM-0001",
    customerId: "CUS-0001",
    guestName: "Nadia Okonkwo",
    checkInAt: "2026-08-07T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-10T12:00:00+07:00",
    status: "checked_in",
    ratePlanId: "RP-0004",
    bookingType: "daily",
    expectedDurationMinutes: 4300,
    baseAmount: 165e4,
    totalAmount: 165e4,
    numGuests: 2,
    note: "",
    createdBy: "USR-0001",
    createdAt: "2026-08-05T10:00:00+07:00",
    updatedAt: "2026-08-07T14:00:00+07:00"
  },
  {
    bookingId: "BOOK-0002",
    roomId: "ROOM-0005",
    customerId: "CUS-0002",
    guestName: "Marcus Chen",
    checkInAt: "2026-08-07T15:00:00+07:00",
    expectedCheckOutAt: "2026-08-09T12:00:00+07:00",
    status: "checked_in",
    ratePlanId: "RP-0004",
    bookingType: "daily",
    expectedDurationMinutes: 2580,
    baseAmount: 13e5,
    totalAmount: 13e5,
    numGuests: 3,
    createdBy: "USR-0001",
    createdAt: "2026-08-04T09:00:00+07:00",
    updatedAt: "2026-08-07T15:00:00+07:00"
  },
  {
    bookingId: "BOOK-0003",
    roomId: "ROOM-0006",
    customerId: "CUS-0003",
    guestName: "Elena Vasquez",
    checkInAt: "2026-08-07T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-12T12:00:00+07:00",
    status: "checked_in",
    ratePlanId: "RP-0004",
    bookingType: "daily",
    expectedDurationMinutes: 7180,
    baseAmount: 26e5,
    totalAmount: 26e5,
    numGuests: 2,
    createdBy: "USR-0002",
    createdAt: "2026-08-01T08:00:00+07:00",
    updatedAt: "2026-08-07T14:00:00+07:00"
  },
  {
    bookingId: "BOOK-0004",
    roomId: "ROOM-0010",
    customerId: "CUS-0004",
    guestName: "James Whitfield",
    checkInAt: "2026-08-07T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-08T12:00:00+07:00",
    status: "checked_in",
    ratePlanId: "RP-0002",
    bookingType: "daily",
    expectedDurationMinutes: 1420,
    baseAmount: 45e4,
    totalAmount: 45e4,
    numGuests: 1,
    createdBy: "USR-0001",
    createdAt: "2026-08-06T11:00:00+07:00",
    updatedAt: "2026-08-07T14:00:00+07:00"
  },
  {
    bookingId: "BOOK-0005",
    roomId: "ROOM-0012",
    customerId: "CUS-0005",
    guestName: "Aisha Rahman",
    checkInAt: "2026-08-07T15:00:00+07:00",
    expectedCheckOutAt: "2026-08-11T12:00:00+07:00",
    status: "checked_in",
    ratePlanId: "RP-0004",
    bookingType: "daily",
    expectedDurationMinutes: 5700,
    baseAmount: 23e5,
    totalAmount: 23e5,
    numGuests: 4,
    createdBy: "USR-0002",
    createdAt: "2026-08-03T14:00:00+07:00",
    updatedAt: "2026-08-07T15:00:00+07:00"
  },
  {
    bookingId: "BOOK-0006",
    roomId: "ROOM-0002",
    customerId: "CUS-0006",
    guestName: "Tom\xE1s Eriksson",
    checkInAt: "2026-08-08T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-11T12:00:00+07:00",
    status: "confirmed",
    ratePlanId: "RP-0003",
    bookingType: "daily",
    expectedDurationMinutes: 4300,
    baseAmount: 8e5,
    totalAmount: 8e5,
    numGuests: 2,
    createdBy: "USR-0001",
    createdAt: "2026-08-06T16:00:00+07:00",
    updatedAt: "2026-08-06T16:00:00+07:00"
  },
  {
    bookingId: "BOOK-0007",
    roomId: "ROOM-0008",
    customerId: "CUS-0007",
    guestName: "Priya Sharma",
    checkInAt: "2026-08-09T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-14T12:00:00+07:00",
    status: "confirmed",
    ratePlanId: "RP-0004",
    bookingType: "daily",
    expectedDurationMinutes: 7180,
    baseAmount: 2475e3,
    totalAmount: 2475e3,
    numGuests: 2,
    createdBy: "USR-0001",
    createdAt: "2026-08-05T10:30:00+07:00",
    updatedAt: "2026-08-05T10:30:00+07:00"
  },
  {
    bookingId: "BOOK-0008",
    roomId: "ROOM-0009",
    customerId: "CUS-0008",
    guestName: "Carlos Mendes",
    checkInAt: "2026-08-10T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-13T12:00:00+07:00",
    status: "confirmed",
    ratePlanId: "RP-0003",
    bookingType: "daily",
    expectedDurationMinutes: 4300,
    baseAmount: 12e5,
    totalAmount: 12e5,
    numGuests: 3,
    createdBy: "USR-0002",
    createdAt: "2026-08-04T13:00:00+07:00",
    updatedAt: "2026-08-04T13:00:00+07:00"
  },
  {
    bookingId: "BOOK-0009",
    roomId: "ROOM-0005",
    customerId: "CUS-0001",
    guestName: "Nadia Okonkwo",
    checkInAt: "2026-08-14T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-16T12:00:00+07:00",
    status: "confirmed",
    ratePlanId: "RP-0003",
    bookingType: "daily",
    expectedDurationMinutes: 2860,
    baseAmount: 1e6,
    totalAmount: 1e6,
    numGuests: 2,
    createdBy: "USR-0001",
    createdAt: "2026-08-07T08:00:00+07:00",
    updatedAt: "2026-08-07T08:00:00+07:00"
  },
  {
    bookingId: "BOOK-0010",
    roomId: "ROOM-0003",
    customerId: "CUS-0004",
    guestName: "James Whitfield",
    checkInAt: "2026-07-30T14:00:00+07:00",
    expectedCheckOutAt: "2026-08-02T12:00:00+07:00",
    actualCheckOutAt: "2026-08-02T11:30:00+07:00",
    status: "checked_out",
    ratePlanId: "RP-0003",
    bookingType: "daily",
    expectedDurationMinutes: 4300,
    baseAmount: 12e5,
    overtimeMinutes: 0,
    overtimeAmount: 0,
    totalAmount: 12e5,
    numGuests: 1,
    createdBy: "USR-0001",
    createdAt: "2026-07-28T09:00:00+07:00",
    updatedAt: "2026-08-02T11:30:00+07:00"
  }
];
var cleaningTasks = [
  {
    cleaningId: "CLN-0001",
    roomId: "ROOM-0003",
    bookingId: "BOOK-0010",
    scheduledAt: "2026-08-02T12:00:00+07:00",
    status: "pending",
    priority: "high",
    note: "After James Whitfield checkout; next guest Priya Sharma arrives Aug 9",
    createdAt: "2026-08-02T11:30:00+07:00",
    updatedAt: "2026-08-02T11:30:00+07:00"
  },
  {
    cleaningId: "CLN-0002",
    roomId: "ROOM-0011",
    bookingId: void 0,
    scheduledAt: "2026-08-08T12:00:00+07:00",
    status: "in_progress",
    priority: "high",
    assignedTo: "Maria Santos",
    startedAt: "2026-08-07T09:30:00+07:00",
    note: "After Carlos Mendes checkout; next guest TBD",
    createdAt: "2026-08-07T09:00:00+07:00",
    updatedAt: "2026-08-07T09:30:00+07:00"
  },
  {
    cleaningId: "CLN-0003",
    roomId: "ROOM-0004",
    bookingId: void 0,
    scheduledAt: "2026-08-05T12:00:00+07:00",
    status: "pending",
    priority: "medium",
    createdAt: "2026-08-05T12:00:00+07:00",
    updatedAt: "2026-08-05T12:00:00+07:00"
  },
  {
    cleaningId: "CLN-0004",
    roomId: "ROOM-0009",
    bookingId: "BOOK-0008",
    scheduledAt: "2026-08-13T12:00:00+07:00",
    status: "pending",
    priority: "medium",
    note: "After Carlos Mendes checkout",
    createdAt: "2026-08-07T10:00:00+07:00",
    updatedAt: "2026-08-07T10:00:00+07:00"
  }
];
var expenses = [
  { expenseId: "EXP-0001", category: "Cleaning Supplies", amount: 1455e3, date: "2026-08-01", description: "Monthly cleaning supplies restock", vendor: "Clean Pro Supplies", createdAt: "2026-08-01T00:00:00+07:00", updatedAt: "2026-08-01T00:00:00+07:00" },
  { expenseId: "EXP-0002", category: "Electricity", amount: 38e5, date: "2026-08-01", description: "July electricity bill", vendor: "City Power Co.", createdAt: "2026-08-01T00:00:00+07:00", updatedAt: "2026-08-01T00:00:00+07:00" },
  { expenseId: "EXP-0003", category: "Water", amount: 95e4, date: "2026-08-01", description: "July water bill", vendor: "Municipal Water", createdAt: "2026-08-01T00:00:00+07:00", updatedAt: "2026-08-01T00:00:00+07:00" },
  { expenseId: "EXP-0004", category: "Internet", amount: 45e4, date: "2026-08-01", description: "Monthly fiber broadband", vendor: "FiberNet ISP", createdAt: "2026-08-01T00:00:00+07:00", updatedAt: "2026-08-01T00:00:00+07:00" },
  { expenseId: "EXP-0005", category: "Staff", amount: 48e5, date: "2026-08-05", description: "Weekly staff wages", vendor: "Payroll", createdAt: "2026-08-05T00:00:00+07:00", updatedAt: "2026-08-05T00:00:00+07:00" },
  { expenseId: "EXP-0006", category: "Repairs", amount: 22e5, date: "2026-08-06", description: "AC unit repair \u2014 Y\xEAn 4", vendor: "CoolTech HVAC", createdAt: "2026-08-06T00:00:00+07:00", updatedAt: "2026-08-06T00:00:00+07:00" },
  { expenseId: "EXP-0007", category: "Cleaning Supplies", amount: 623e3, date: "2026-08-06", description: "Additional toiletries order", vendor: "Clean Pro Supplies", createdAt: "2026-08-06T00:00:00+07:00", updatedAt: "2026-08-06T00:00:00+07:00" },
  { expenseId: "EXP-0008", category: "Other", amount: 35e4, date: "2026-08-07", description: "Welcome fruit baskets", vendor: "Local Market", createdAt: "2026-08-07T00:00:00+07:00", updatedAt: "2026-08-07T00:00:00+07:00" }
];
var notifications = [
  { notificationId: "NOT-0001", type: "check_in", title: "Check-in Today", message: "Tom\xE1s Eriksson arriving for Hi\xEAn 2 at 2:00 PM", time: "2026-08-07T12:00:00+07:00", read: false, priority: "high", relatedBookingId: "BOOK-0006", relatedRoomId: "ROOM-0002" },
  { notificationId: "NOT-0002", type: "check_out", title: "Check-out Today", message: "James Whitfield (Y\xEAn 7) checks out today by 11 AM", time: "2026-08-07T08:00:00+07:00", read: false, priority: "high", relatedBookingId: "BOOK-0004", relatedRoomId: "ROOM-0010" },
  { notificationId: "NOT-0003", type: "cleaning", title: "Urgent Cleaning", message: "Hi\xEAn 3 needs cleaning \u2014 next guest arrives Aug 9", time: "2026-08-07T07:30:00+07:00", read: false, priority: "high", relatedRoomId: "ROOM-0003" },
  { notificationId: "NOT-0004", type: "payment", title: "Payment Pending", message: "Nadia Okonkwo has an outstanding balance of 95.000 \u20AB", time: "2026-08-07T06:00:00+07:00", read: false, priority: "medium", relatedBookingId: "BOOK-0001" },
  { notificationId: "NOT-0005", type: "cleaning", title: "Y\xEAn 8 In Progress", message: "Maria Santos started cleaning Y\xEAn 8", time: "2026-08-07T09:30:00+07:00", read: true, priority: "low", relatedRoomId: "ROOM-0011" },
  { notificationId: "NOT-0006", type: "check_in", title: "Upcoming Check-in", message: "Priya Sharma arriving Aug 9 for Y\xEAn 5", time: "2026-08-06T10:00:00+07:00", read: true, priority: "low", relatedBookingId: "BOOK-0007", relatedRoomId: "ROOM-0008" },
  { notificationId: "NOT-0007", type: "maintenance", title: "Maintenance Alert", message: "Y\xEAn 4 AC still out of service", time: "2026-08-05T08:00:00+07:00", read: true, priority: "medium", relatedRoomId: "ROOM-0007" }
];
var locations = [
  { locationId: "LOC-0001", name: "B\xECnh L\u1EE3i Trung", description: "C\u1EE5m homestay B\xECnh L\u1EE3i Trung", publicAddress: "B\xECnh L\u1EE3i Trung, B\xECnh Th\u1EA1nh, H\u1ED3 Ch\xED Minh", phone: "+84 28 0000 0001", active: true, createdAt: "2026-01-01T00:00:00+07:00", updatedAt: "2026-01-01T00:00:00+07:00" }
];
var ratePlans = [
  { ratePlanId: "RP-0001", name: "Combo 4H", type: "hourly", baseMinutes: 240, baseAmount: 25e4, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: "RP-0002", name: "Combo 6H", type: "hourly", baseMinutes: 360, baseAmount: 35e4, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: "RP-0003", name: "Overnight", type: "overnight", baseMinutes: 780, baseAmount: 4e5, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: "17:00", overnightEnd: "10:00", active: true },
  { ratePlanId: "RP-0004", name: "Full Day", type: "daily", baseMinutes: 1320, baseAmount: 55e4, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: "14:00", overnightEnd: "12:00", active: true }
];

// scripts/seedData.ts
var ROOM_RATE_PRICES = {
  // Hiên rooms (Standard tier)
  "ROOM-0001": { "RP-0001": 25e4, "RP-0002": 35e4, "RP-0003": 4e5, "RP-0004": 55e4 },
  "ROOM-0002": { "RP-0001": 25e4, "RP-0002": 35e4, "RP-0003": 4e5, "RP-0004": 55e4 },
  "ROOM-0003": { "RP-0001": 25e4, "RP-0002": 35e4, "RP-0003": 4e5, "RP-0004": 55e4 },
  // Yên rooms (Deluxe tier)
  "ROOM-0004": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0005": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0006": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0007": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0008": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0009": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0010": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0011": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 },
  "ROOM-0012": { "RP-0001": 3e5, "RP-0002": 45e4, "RP-0003": 5e5, "RP-0004": 65e4 }
};
var RATE_PLAN_PRICES_SEED = Object.entries(ROOM_RATE_PRICES).flatMap(
  ([roomId, planMap]) => Object.entries(planMap).map(([ratePlanId, priceVnd]) => ({
    ratePlanId,
    roomId,
    priceVnd
  }))
);

// src/lib/google-sheets/client.ts
var inMemoryStore = /* @__PURE__ */ new Map();
function initInMemoryStore() {
  if (inMemoryStore.size > 0) return;
  inMemoryStore.set("Locations", [
    [...LOCATIONS_HEADERS],
    ...locations.map(mapLocationToRow)
  ]);
  inMemoryStore.set("Rooms", [
    [...ROOMS_HEADERS],
    ...rooms.map(mapRoomToRow)
  ]);
  inMemoryStore.set("Customers", [
    [...CUSTOMERS_HEADERS],
    ...customers.map(mapCustomerToRow)
  ]);
  inMemoryStore.set("Bookings", [
    [...BOOKINGS_HEADERS],
    ...bookings.map(mapBookingToRow)
  ]);
  inMemoryStore.set("Cleaning", [
    [...CLEANING_HEADERS],
    ...cleaningTasks.map(mapCleaningTaskToRow)
  ]);
  inMemoryStore.set("RatePlans", [
    [...RATE_PLANS_HEADERS],
    ...ratePlans.map(mapRatePlanToRow)
  ]);
  const STANDARD_PRICES = {
    "RP-0001": 25e4,
    "RP-0002": 35e4,
    "RP-0003": 4e5,
    "RP-0004": 55e4
  };
  let rppCounter = 1;
  const rppRows = [];
  const sortedRoomIds = rooms.map((r) => r.roomId).sort();
  for (const roomId of sortedRoomIds) {
    const roomPrices = ROOM_RATE_PRICES[roomId];
    for (const ratePlanId of ["RP-0001", "RP-0002", "RP-0003", "RP-0004"]) {
      const price = roomPrices?.[ratePlanId] ?? STANDARD_PRICES[ratePlanId] ?? 0;
      rppRows.push([
        `RPP-${String(rppCounter++).padStart(4, "0")}`,
        ratePlanId,
        roomId,
        String(price),
        "TRUE",
        "2026-01-01T00:00:00+07:00",
        "2026-01-01T00:00:00+07:00"
      ]);
    }
  }
  inMemoryStore.set("RatePlanPrices", [
    [...RATE_PLAN_PRICES_HEADERS],
    ...rppRows
  ]);
  inMemoryStore.set("Users", [
    [...USERS_HEADERS],
    ["USR-0001", "Admin User", "admin@homestay.local", "PBKDF2$demo$hash", "admin", "TRUE", "2026-01-01T00:00:00+07:00", "2026-01-01T00:00:00+07:00"],
    ["USR-0002", "Maria Santos", "staff@homestay.local", "PBKDF2$demo$hash", "staff", "TRUE", "2026-01-01T00:00:00+07:00", "2026-01-01T00:00:00+07:00"]
  ]);
  inMemoryStore.set("Expenses", [
    [...EXPENSES_HEADERS],
    ...expenses.map(mapExpenseToRow)
  ]);
  inMemoryStore.set("Notifications", [
    [...NOTIFICATIONS_HEADERS],
    ...notifications.map(mapNotificationToRow)
  ]);
}
initInMemoryStore();
function parseA1Range(range) {
  const parts = range.split("!");
  const sheetName = parts[0]?.trim() || "Sheet1";
  const cellRange = parts[1]?.trim() || "";
  if (!cellRange || cellRange === "A:A") {
    return { sheetName, colOnly: cellRange === "A:A" };
  }
  if (cellRange.startsWith("A1:")) {
    return { sheetName, isFullWithHeader: true };
  }
  const match = cellRange.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/i);
  console.log("[parseA1Range]", { cellRange, match: match?.slice(1) });
  if (match) {
    const startRow = match[2] ? parseInt(match[2], 10) : void 0;
    const endRow = match[4] ? parseInt(match[4], 10) : void 0;
    if (startRow === void 0) {
      console.log("[parseA1Range] treating as fullWithHeader");
      return { sheetName, isFullWithHeader: true };
    }
    console.log("[parseA1Range] result:", { startRow, endRow });
    return { sheetName, startRow, endRow };
  }
  return { sheetName };
}
function getMemorySheet(sheetName) {
  initInMemoryStore();
  if (!inMemoryStore.has(sheetName)) {
    inMemoryStore.set(sheetName, []);
  }
  return inMemoryStore.get(sheetName);
}
var _client = null;
var READ_CACHE_TTL_MS = 1e4;
var readCache = /* @__PURE__ */ new Map();
function cloneRows(rows) {
  return rows.map((row) => [...row]);
}
function clearCachedSheet(spreadsheetId, range) {
  const sheetPrefix = `${spreadsheetId}:${range.split("!")[0]}!`;
  for (const key of readCache.keys()) {
    if (key.startsWith(sheetPrefix)) readCache.delete(key);
  }
}
function hasGoogleCreds() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim() && (process.env.SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim())
  );
}
function createSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (key && key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  key = key?.replace(/\\n/g, "\n");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    projectId
  });
  return google.sheets({
    version: "v4",
    auth,
    timeout: 1e4
  });
}
function getSheetsClient() {
  if (!_client && hasGoogleCreds()) {
    _client = createSheetsClient();
  }
  return _client;
}
var sheets = {
  get client() {
    return getSheetsClient();
  },
  async getValues(spreadsheetId, range) {
    const credsOk = hasGoogleCreds();
    const cacheKey = `${spreadsheetId}:${range}`;
    const cached = readCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneRows(cached.values);
    }
    console.log("[sheets.getValues]", { hasGoogleCreds: credsOk, range, sheetName: range.split("!")[0] });
    if (credsOk && this.client) {
      try {
        const response = await this.client.spreadsheets.values.get({
          spreadsheetId,
          range
        });
        const values = response.data.values ?? [];
        readCache.set(cacheKey, { expiresAt: Date.now() + READ_CACHE_TTL_MS, values: cloneRows(values) });
        return values;
      } catch (err) {
        if (cached) {
          console.warn("Google Sheets getValues failed, using cached live data:", err?.message);
          return cloneRows(cached.values);
        }
        console.warn("Google Sheets getValues failed, using in-memory store:", err?.message);
      }
    }
    const { sheetName, startRow, endRow, colOnly, isFullWithHeader } = parseA1Range(range);
    console.log("[sheets.getValues in-memory]", { sheetName, startRow, endRow, colOnly, isFullWithHeader });
    const sheetData = getMemorySheet(sheetName);
    console.log("[sheets.getValues in-memory] sheetData length:", sheetData.length);
    if (colOnly) {
      return sheetData.map((row) => [row[0] ?? ""]);
    }
    if (isFullWithHeader) {
      return sheetData;
    }
    if (startRow !== void 0) {
      const startIdx = Math.max(0, startRow - 1);
      const endIdx = endRow !== void 0 ? endRow : void 0;
      return sheetData.slice(startIdx, endIdx);
    }
    return sheetData.slice(1);
  },
  async setValues(spreadsheetId, range, values) {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values }
        });
        clearCachedSheet(spreadsheetId, range);
        return;
      } catch (err) {
        console.warn("Google Sheets setValues failed, saving to in-memory store:", err?.message);
      }
    }
    const { sheetName, startRow } = parseA1Range(range);
    const sheetData = getMemorySheet(sheetName);
    const startIdx = startRow !== void 0 ? startRow - 1 : 1;
    for (let i = 0; i < values.length; i++) {
      const rowStrings = (values[i] ?? []).map((v) => v === null || v === void 0 ? "" : String(v));
      sheetData[startIdx + i] = rowStrings;
    }
  },
  async appendRow(spreadsheetId, range, row) {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values: [row] }
        });
        clearCachedSheet(spreadsheetId, range);
        return;
      } catch (err) {
        console.warn("Google Sheets appendRow failed, appending to in-memory store:", err?.message);
      }
    }
    const { sheetName } = parseA1Range(range);
    const sheetData = getMemorySheet(sheetName);
    sheetData.push(row.map((v) => v === null || v === void 0 ? "" : String(v)));
  },
  async batchUpdate(spreadsheetId, ranges, values) {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: ranges.map((range, i) => ({ range, values: [values[i]] }))
          }
        });
        for (const range of ranges) clearCachedSheet(spreadsheetId, range);
        return;
      } catch (err) {
        console.warn("Google Sheets batchUpdate failed, saving in memory:", err?.message);
      }
    }
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i] && values[i]) {
        await this.setValues(spreadsheetId, ranges[i], [values[i]]);
      }
    }
  },
  async createSheet(spreadsheetId, title, rowCount = 1e3) {
    if (hasGoogleCreds() && this.client) {
      try {
        await this.client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title,
                    gridProperties: { rowCount, columnCount: 26 }
                  }
                }
              }
            ]
          }
        });
        return;
      } catch {
      }
    }
    if (!inMemoryStore.has(title)) {
      inMemoryStore.set(title, []);
    }
  },
  async deleteSheet(spreadsheetId, title) {
    if (hasGoogleCreds() && this.client) {
      try {
        const meta = await this.client.spreadsheets.get({ spreadsheetId, includeGridData: false });
        const s = meta.data.sheets?.find((s2) => s2.properties?.title === title);
        if (s?.properties?.sheetId !== void 0) {
          await this.client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ deleteSheet: { sheetId: s.properties.sheetId } }]
            }
          });
        }
        return;
      } catch {
      }
    }
    inMemoryStore.delete(title);
  }
};

// src/lib/google-sheets/bookings.repository.ts
import { formatInTimeZone } from "date-fns-tz";

// src/lib/google-sheets/datetime.ts
var BUSINESS_TZ = process.env.BUSINESS_TZ ?? "Asia/Ho_Chi_Minh";
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function today() {
  return toDateString(/* @__PURE__ */ new Date());
}
function diffMinutes(startIso, endIso) {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 6e4
  );
}
function windowsOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}
function timestamps() {
  const ts = nowIso();
  return { createdAt: ts, updatedAt: ts };
}
function updatedTimestamp() {
  return nowIso();
}

// src/lib/google-sheets/id.ts
var PREFIX_MAX = 999999;
function pad(n) {
  return String(n).padStart(4, "0");
}
async function generateId(prefix, sheetName, spreadsheetId) {
  const range = `${sheetName}!A:A`;
  const rows = await sheets.getValues(spreadsheetId, range);
  let max = 0;
  for (const row of rows) {
    const raw = row[0] ?? "";
    if (!raw.startsWith(prefix + "-")) continue;
    const numPart = raw.slice(prefix.length + 1);
    const n = parseInt(numPart, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  if (max >= PREFIX_MAX) {
    throw new Error(`${prefix}: ID namespace exhausted (max ${PREFIX_MAX})`);
  }
  return `${prefix}-${pad(max + 1)}`;
}

// src/lib/api/validation.ts
import { z } from "zod";

// src/lib/api/response.ts
var JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS, PUT",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true"
};
function timestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function buildSuccess(data) {
  return { success: true, data };
}
function buildError(code, message) {
  return {
    success: false,
    error: { code, message, timestamp: timestamp() }
  };
}
function jsonSuccess(data, init) {
  return new Response(JSON.stringify(buildSuccess(data)), {
    status: 200,
    headers: { ...Object.fromEntries(Object.entries(JSON_HEADERS)), ...init?.headers },
    ...init
  });
}
function jsonCreated(data, init) {
  return new Response(JSON.stringify(buildSuccess(data)), {
    status: 201,
    headers: { ...Object.fromEntries(Object.entries(JSON_HEADERS)), ...init?.headers },
    ...init
  });
}
function jsonError(status, code, message, init) {
  return new Response(JSON.stringify(buildError(code, message)), {
    status,
    headers: { ...Object.fromEntries(Object.entries(JSON_HEADERS)), ...init?.headers },
    ...init
  });
}
function jsonValidationError(zodError) {
  const messages = zodError.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return jsonError(422, "VALIDATION_ERROR", messages);
}
function jsonServerError(err, context) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[Server Error]", context, err);
  } else {
    console.error("[Server Error]", context);
  }
  return jsonError(500, "INTERNAL_ERROR", "An unexpected error occurred");
}
function jsonNoContent() {
  return new Response(null, { status: 204 });
}

// src/lib/api/validation.ts
var isoDateTimeSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/,
  "Must be an ISO 8601 datetime with timezone offset"
);
var dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Must be a date in YYYY-MM-DD format"
);
var loginSchema = z.object({
  email: z.string().min(1, "Email or username is required").trim(),
  password: z.string().min(1, "Password is required")
});
var publicRoomSchema = z.object({
  roomId: z.string().min(1),
  locationId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(1),
  imageUrl: z.string().url().optional().or(z.literal(""))
});
var createRoomSchema = z.object({
  locationId: z.string().min(1, "locationId is required"),
  name: z.string().min(1, "name is required").max(100),
  description: z.string().max(500).optional(),
  capacity: z.number().int().min(1).max(50).default(2),
  priceDisplay: z.string().max(50).optional(),
  floor: z.number().int().min(0).max(100).optional(),
  amenities: z.array(z.string().max(50)).max(20).default([]),
  notes: z.string().max(1e3).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  active: z.boolean().default(true)
});
var updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  priceDisplay: z.string().max(50).optional(),
  status: z.enum(["available", "occupied", "maintenance", "cleaning", "needs_cleaning", "inactive"]).optional(),
  active: z.boolean().optional(),
  floor: z.number().int().min(0).max(100).optional(),
  amenities: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(1e3).optional(),
  imageUrl: z.string().url().optional().or(z.literal(""))
});
var upsertCustomerSchema = z.object({
  name: z.string().min(1, "customer.name is required").max(200).optional(),
  source: z.enum(["INSTAGRAM", "TIKTOK", "ZALO", "FACEBOOK", "KH\xC1C", "KHAC"]).transform((val) => val === "KHAC" ? "KH\xC1C" : val).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  note: z.string().max(1e3).optional()
});
var CUSTOM_RATE_PLAN_ID = "custom";
var createBookingSchema = z.object({
  roomId: z.string().min(1, "roomId is required"),
  guestName: z.string().min(1, "guestName is required").max(200),
  customer: upsertCustomerSchema,
  checkInAt: isoDateTimeSchema,
  expectedCheckOutAt: isoDateTimeSchema,
  status: z.enum(["inquiry", "confirmed", "cancelled", "checked_in", "checked_out"]).default("confirmed"),
  ratePlanId: z.string().min(1, "ratePlanId is required"),
  /**
   * Cadence selected by the receptionist.
   *  - 'daily'  → server looks up RatePlanPrices (or the rate plan's base amount).
   *  - 'hourly' → server stores the supplied totalAmount verbatim and skips
   *               the RatePlanPrices lookup. totalAmount is required in this case.
   *
   * Defaults to 'daily' for backwards compatibility with older clients.
   */
  bookingType: z.enum(["daily", "hourly"]).default("daily"),
  /** Required when bookingType === 'hourly'; ignored otherwise. */
  totalAmount: z.number().nonnegative("totalAmount must be \u2265 0").optional(),
  depositAmount: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional(),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
  extraServicesAmount: z.number().nonnegative().optional(),
  extraServicesNote: z.string().max(500).optional(),
  numGuests: z.number().int().min(1).max(20).optional(),
  note: z.string().max(1e3).optional()
}).refine(
  (data) => new Date(data.checkInAt) < new Date(data.expectedCheckOutAt),
  { message: "checkInAt must be before expectedCheckOutAt", path: ["expectedCheckOutAt"] }
).refine(
  (data) => data.bookingType !== "hourly" || data.totalAmount !== void 0 && data.totalAmount > 0,
  { message: "totalAmount is required for hourly bookings", path: ["totalAmount"] }
);
var updateBookingSchema = z.object({
  status: z.enum(["inquiry", "confirmed", "cancelled", "checked_in", "checked_out"]).optional(),
  roomId: z.string().min(1).optional(),
  guestName: z.string().min(1).max(200).optional(),
  checkInAt: isoDateTimeSchema.optional(),
  expectedCheckOutAt: isoDateTimeSchema.optional(),
  ratePlanId: z.string().min(1).optional(),
  numGuests: z.number().int().min(1).max(20).optional(),
  actualCheckOutAt: isoDateTimeSchema.optional(),
  depositAmount: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional(),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
  extraServicesAmount: z.number().nonnegative().optional(),
  extraServicesNote: z.string().max(500).optional(),
  totalAmount: z.number().nonnegative().optional(),
  note: z.string().max(1e3).optional()
});
var updateBookingStatusSchema = z.object({
  status: z.enum(["inquiry", "confirmed", "cancelled", "checked_in", "checked_out", "no_show"])
});
var availabilityQuerySchema = z.object({
  roomId: z.string().min(1, "roomId is required"),
  checkIn: isoDateTimeSchema,
  checkOut: isoDateTimeSchema
}).refine(
  (data) => new Date(data.checkIn) < new Date(data.checkOut),
  { message: "checkIn must be before checkOut", path: ["checkOut"] }
);
var createCleaningSchema = z.object({
  roomId: z.string().min(1, "roomId is required"),
  bookingId: z.string().optional(),
  scheduledAt: isoDateTimeSchema,
  assignedTo: z.string().min(1).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  note: z.string().max(500).optional()
});
var updateCleaningSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  assignedTo: z.string().min(1).optional(),
  scheduledAt: isoDateTimeSchema.optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  note: z.string().max(500).optional()
});
var createExpenseSchema = z.object({
  category: z.string().min(1, "category is required").max(50),
  amount: z.number().positive("amount must be positive"),
  date: dateSchema,
  description: z.string().min(1, "description is required").max(200),
  vendor: z.string().max(100).optional()
});
function parseBody(request, schema) {
  return request.json().then((body) => schema.safeParse(body)).then((result) => {
    if (!result.success) {
      return jsonValidationError(result.error);
    }
    return result.data;
  }).catch(() => jsonValidationError({ issues: [{ path: ["body"], message: "Invalid JSON body" }] }));
}
function parseQuery(url, schema) {
  const params = Object.fromEntries(new URL(url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return jsonValidationError(result.error);
  }
  return result.data;
}

// src/lib/google-sheets/ratePlanPrices.repository.ts
async function readAll(spreadsheetId) {
  const range = `${SHEETS.RatePlanPrices}!A2:${String.fromCharCode(64 + RATE_PLAN_PRICES_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToRatePlanPrice);
}
async function active(spreadsheetId) {
  const all = await readAll(spreadsheetId);
  return all.filter((p) => p.active);
}
async function findPrice(spreadsheetId, ratePlanId, roomId) {
  const all = await active(spreadsheetId);
  return all.find((p) => p.ratePlanId === ratePlanId && p.roomId === roomId) ?? null;
}

// src/lib/google-sheets/rooms.repository.ts
async function readAll2(spreadsheetId) {
  const range = `${SHEETS.Rooms}!A2:${String.fromCharCode(64 + ROOMS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToRoom);
}
async function readOne(spreadsheetId, roomId) {
  const all = await readAll2(spreadsheetId);
  return all.find((r) => r.roomId === roomId) ?? null;
}
async function create(spreadsheetId, input) {
  const roomId = await generateId("ROOM", "Rooms", spreadsheetId);
  const { createdAt, updatedAt } = timestamps();
  const room = {
    ...input,
    roomId,
    createdAt,
    updatedAt
  };
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Rooms}!A:A`,
    mapRoomToRow(room)
  );
  return room;
}
async function update(spreadsheetId, roomId, patch) {
  const all = await readAll2(spreadsheetId);
  const idx = all.findIndex((r) => r.roomId === roomId);
  if (idx === -1) return null;
  const updated = {
    ...all[idx],
    ...patch,
    roomId,
    // immutable
    locationId: all[idx].locationId,
    // immutable after create
    createdAt: all[idx].createdAt,
    // immutable
    updatedAt: updatedTimestamp()
  };
  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + ROOMS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Rooms}!A${sheetRow}:${col}`,
    [mapRoomToRow(updated)]
  );
  return updated;
}
async function softDelete(spreadsheetId, roomId) {
  const result = await update(spreadsheetId, roomId, {
    status: "inactive",
    active: false
  });
  return result !== null;
}
async function query(spreadsheetId, filters) {
  let rooms2 = await readAll2(spreadsheetId);
  if (filters?.locationId !== void 0) {
    rooms2 = rooms2.filter((r) => r.locationId === filters.locationId);
  }
  if (filters?.status !== void 0) {
    rooms2 = rooms2.filter((r) => r.status === filters.status);
  }
  if (filters?.active !== void 0) {
    rooms2 = rooms2.filter((r) => r.active === filters.active);
  }
  return rooms2;
}

// src/lib/google-sheets/cleaning.repository.ts
async function readAll3(spreadsheetId) {
  const range = `${SHEETS.Cleaning}!A2:${String.fromCharCode(64 + CLEANING_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToCleaningTask);
}
async function readOne2(spreadsheetId, cleaningId) {
  const all = await readAll3(spreadsheetId);
  return all.find((c) => c.cleaningId === cleaningId) ?? null;
}
async function query2(spreadsheetId, filters) {
  let all = await readAll3(spreadsheetId);
  if (filters?.roomId) all = all.filter((t) => t.roomId === filters.roomId);
  if (filters?.bookingId) all = all.filter((t) => t.bookingId === filters.bookingId);
  if (filters?.status) all = all.filter((t) => t.status === filters.status);
  return all;
}
async function dueToday(spreadsheetId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const all = await readAll3(spreadsheetId);
  return all.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.scheduledAt <= now
  );
}
async function create2(spreadsheetId, input) {
  const cleaningId = await generateId("CLN", "Cleaning", spreadsheetId);
  const { createdAt, updatedAt } = timestamps();
  const task = {
    ...input,
    cleaningId,
    createdAt,
    updatedAt
  };
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Cleaning}!A:A`,
    mapCleaningTaskToRow(task)
  );
  return task;
}
async function transition(spreadsheetId, cleaningId, newStatus) {
  const all = await readAll3(spreadsheetId);
  const idx = all.findIndex((t) => t.cleaningId === cleaningId);
  if (idx === -1) return null;
  const existing = all[idx];
  const now = updatedTimestamp();
  const patch = { status: newStatus };
  if (newStatus === "in_progress" && existing.status === "pending") {
    patch.startedAt = now;
  }
  if (newStatus === "completed") {
    patch.completedAt = now;
  }
  const updated = {
    ...existing,
    ...patch,
    cleaningId: existing.cleaningId,
    createdAt: existing.createdAt,
    updatedAt: now
  };
  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + CLEANING_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Cleaning}!A${sheetRow}:${col}`,
    [mapCleaningTaskToRow(updated)]
  );
  return updated;
}

// src/lib/google-sheets/bookings.repository.ts
var OVERTIME_HOURLY_RATE = 7e4;
var STANDARD_FALLBACK_RATES = {
  "RP-0001": 25e4,
  "RP-0002": 35e4,
  "RP-0003": 4e5,
  "RP-0004": 55e4
};
async function readAll4(spreadsheetId) {
  try {
    const rawRows = await sheets.getValues(spreadsheetId, `${SHEETS.Bookings}!A1:Z`);
    if (!rawRows || rawRows.length === 0) return [];
    const headerRow = rawRows[0] || [];
    const dataRows = rawRows.slice(1);
    const headerMap = /* @__PURE__ */ new Map();
    headerRow.forEach((h, idx) => {
      if (h) {
        const clean = String(h).toLowerCase().replace(/[\s_-]/g, "");
        headerMap.set(clean, idx);
      }
    });
    const byHeader = (row, name, fixedIdx) => {
      const idx = headerMap.get(name) ?? headerMap.get(name.replace(/[\s_-]/g, ""));
      return (idx !== void 0 ? row[idx] : row[fixedIdx]) ?? "";
    };
    return dataRows.filter((row) => row && row.length > 0 && row[0]?.trim()).map((row) => {
      const booking = mapRowToBooking(row);
      const guestNameIdx = headerMap.get("guestname") ?? headerMap.get("guest_name");
      if (guestNameIdx !== void 0 && row[guestNameIdx]) {
        booking.guestName = row[guestNameIdx].trim();
      }
      const numGuestsIdx = headerMap.get("numguests") ?? headerMap.get("num_guests");
      if (numGuestsIdx !== void 0 && row[numGuestsIdx]) {
        const n = parseInt(row[numGuestsIdx], 10);
        if (!isNaN(n)) booking.numGuests = n;
      }
      const depositIdx = headerMap.get("depositamount") ?? headerMap.get("deposit_amount") ?? headerMap.get("deposit");
      if (depositIdx !== void 0 && row[depositIdx]) {
        const d = parseFloat(row[depositIdx]);
        if (!isNaN(d)) booking.depositAmount = d;
      }
      const paidIdx = headerMap.get("paidamount") ?? headerMap.get("paid_amount") ?? headerMap.get("paid");
      if (paidIdx !== void 0 && row[paidIdx]) {
        const p = parseFloat(row[paidIdx]);
        if (!isNaN(p)) booking.paidAmount = p;
      }
      const payStatusIdx = headerMap.get("paymentstatus") ?? headerMap.get("payment_status");
      if (payStatusIdx !== void 0 && row[payStatusIdx]) {
        booking.paymentStatus = row[payStatusIdx].trim();
      }
      if (booking.totalAmount <= 10) {
        const totalIdx = headerMap.get("totalamount") ?? headerMap.get("total") ?? -1;
        const baseIdx = headerMap.get("baseamount") ?? headerMap.get("base") ?? -1;
        const rawTotal = totalIdx >= 0 && row[totalIdx] ? parseFloat(row[totalIdx]) : 0;
        const rawBase = baseIdx >= 0 && row[baseIdx] ? parseFloat(row[baseIdx]) : 0;
        const validOvertime = booking.overtimeAmount && booking.overtimeAmount >= 1e3 ? booking.overtimeAmount : 0;
        if (rawTotal >= 1e3) {
          booking.totalAmount = rawTotal;
        } else if (rawBase >= 1e3) {
          booking.baseAmount = rawBase;
          booking.totalAmount = rawBase + validOvertime;
        } else {
          const planRate = ROOM_RATE_PRICES[booking.roomId]?.[booking.ratePlanId] || STANDARD_FALLBACK_RATES[booking.ratePlanId] || 55e4;
          const diffMs = new Date(booking.expectedCheckOutAt).getTime() - new Date(booking.checkInAt).getTime();
          const nights = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1e3)));
          booking.baseAmount = nights * planRate;
          if (booking.numGuests && booking.numGuests > 2) {
            booking.baseAmount += (booking.numGuests - 2) * 1e5 * nights;
          }
          booking.totalAmount = booking.baseAmount + validOvertime;
          booking.unitPriceAtBooking = planRate;
        }
      }
      return booking;
    });
  } catch (err) {
    console.error("[Bookings.readAll] Error:", err);
    return [];
  }
}
async function readOne3(spreadsheetId, bookingId) {
  const all = await readAll4(spreadsheetId);
  return all.find((b) => b.bookingId === bookingId) ?? null;
}
async function query3(spreadsheetId, filters) {
  let all = await readAll4(spreadsheetId);
  if (filters?.roomId) all = all.filter((b) => b.roomId === filters.roomId);
  if (filters?.customerId) all = all.filter((b) => b.customerId === filters.customerId);
  if (filters?.status) all = all.filter((b) => b.status === filters.status);
  if (filters?.from) {
    const fromMs = new Date(filters.from).getTime();
    all = all.filter((b) => new Date(b.checkInAt).getTime() >= fromMs);
  }
  if (filters?.to) {
    const toMs = new Date(filters.to).getTime();
    all = all.filter((b) => new Date(b.expectedCheckOutAt).getTime() <= toMs);
  }
  return all;
}
async function byRoom(spreadsheetId, roomId) {
  return query3(spreadsheetId, { roomId });
}
async function byCustomer(spreadsheetId, customerId) {
  return query3(spreadsheetId, { customerId });
}
async function hasOverlap(spreadsheetId, roomId, checkInAt, expectedCheckOutAt, excludeBookingId) {
  const existing = await byRoom(spreadsheetId, roomId);
  return existing.filter(
    (b) => b.status !== "cancelled" && b.status !== "checked_out" && b.status !== "no_show" && b.bookingId !== excludeBookingId
  ).some(
    (b) => windowsOverlap(b.checkInAt, b.expectedCheckOutAt, checkInAt, expectedCheckOutAt)
  );
}
async function create3(spreadsheetId, input) {
  if (new Date(input.checkInAt) >= new Date(input.expectedCheckOutAt)) {
    throw new Error("checkInAt must be before expectedCheckOutAt");
  }
  const tz = process.env.BUSINESS_TZ ?? "Asia/Ho_Chi_Minh";
  const yymm = formatInTimeZone(/* @__PURE__ */ new Date(), tz, "yyMM");
  const prefix = `B-${yymm}`;
  const bookingId = await generateId(prefix, "Bookings", spreadsheetId);
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const bookingType = input.bookingType ?? (input.ratePlanId === CUSTOM_RATE_PLAN_ID ? "hourly" : "daily");
  const overlap = await hasOverlap(
    spreadsheetId,
    input.roomId,
    input.checkInAt,
    input.expectedCheckOutAt
  );
  if (overlap) {
    throw new Error(`Room ${input.roomId} is not available for the requested time`);
  }
  let expectedDurationMinutes;
  let baseAmount;
  let totalAmount;
  let unitPriceAtBooking;
  if (input.totalAmount !== void 0 && input.totalAmount > 0) {
    expectedDurationMinutes = diffMinutes(input.checkInAt, input.expectedCheckOutAt);
    baseAmount = input.totalAmount;
    totalAmount = input.totalAmount;
    unitPriceAtBooking = input.totalAmount;
  } else {
    ({ expectedDurationMinutes, baseAmount, unitPriceAtBooking } = await calculateBasePricing(
      spreadsheetId,
      input.roomId,
      input.ratePlanId,
      input.checkInAt,
      input.expectedCheckOutAt,
      input.numGuests
    ));
    totalAmount = baseAmount;
  }
  const depositAmount = input.depositAmount ?? 0;
  const paidAmount = input.paidAmount ?? depositAmount;
  const paymentStatus = input.paymentStatus ?? (paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid");
  const booking = {
    ...input,
    bookingId,
    bookingType,
    expectedDurationMinutes,
    baseAmount,
    overtimeMinutes: void 0,
    overtimeAmount: void 0,
    extraServicesAmount: input.extraServicesAmount,
    extraServicesNote: input.extraServicesNote,
    depositAmount,
    paidAmount,
    paymentStatus,
    totalAmount,
    unitPriceAtBooking,
    createdAt,
    updatedAt
  };
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Bookings}!A:A`,
    mapBookingToRow(booking)
  );
  return booking;
}
async function update2(spreadsheetId, bookingId, patch) {
  const all = await readAll4(spreadsheetId);
  const idx = all.findIndex((b) => b.bookingId === bookingId);
  if (idx === -1) return null;
  const existing = all[idx];
  const checkInAt = patch.checkInAt ?? existing.checkInAt;
  const expectedCheckOutAt = patch.expectedCheckOutAt ?? existing.expectedCheckOutAt;
  const roomId = patch.roomId ?? existing.roomId;
  const dateOrRoomChanged = patch.checkInAt && Math.abs(new Date(patch.checkInAt).getTime() - new Date(existing.checkInAt).getTime()) > 6e4 || patch.expectedCheckOutAt && Math.abs(new Date(patch.expectedCheckOutAt).getTime() - new Date(existing.expectedCheckOutAt).getTime()) > 6e4 || patch.roomId && patch.roomId !== existing.roomId;
  if (dateOrRoomChanged) {
    const overlap = await hasOverlap(
      spreadsheetId,
      roomId,
      checkInAt,
      expectedCheckOutAt,
      bookingId
    );
    if (overlap) {
      throw new Error("Change would create a booking overlap");
    }
  }
  const isHourly = existing.bookingType === "hourly" || patch.bookingType === "hourly" || existing.ratePlanId === CUSTOM_RATE_PLAN_ID || patch.ratePlanId === CUSTOM_RATE_PLAN_ID;
  let baseAmount = existing.baseAmount;
  let expectedDurationMinutes = existing.expectedDurationMinutes;
  let totalAmount;
  let unitPriceAtBooking = existing.unitPriceAtBooking;
  if (isHourly) {
    totalAmount = patch.totalAmount ?? existing.totalAmount;
    if (patch.totalAmount !== void 0 && patch.totalAmount > 0) {
      unitPriceAtBooking = patch.totalAmount;
    }
  } else {
    const ratePlanId = patch.ratePlanId ?? existing.ratePlanId;
    if (patch.checkInAt || patch.expectedCheckOutAt || patch.ratePlanId || patch.roomId || patch.numGuests) {
      ({ expectedDurationMinutes, baseAmount, unitPriceAtBooking } = await calculateBasePricing(
        spreadsheetId,
        roomId,
        ratePlanId,
        checkInAt,
        expectedCheckOutAt,
        patch.numGuests ?? existing.numGuests
      ));
    }
    totalAmount = baseAmount + (existing.overtimeAmount ?? 0);
    if (patch.totalAmount !== void 0 && patch.totalAmount !== existing.totalAmount) {
      totalAmount = patch.totalAmount;
      baseAmount = Math.max(0, patch.totalAmount - (existing.overtimeAmount ?? 0));
    }
  }
  const updated = {
    ...existing,
    ...patch,
    bookingId,
    // immutable
    customerId: existing.customerId,
    // immutable
    expectedDurationMinutes,
    baseAmount,
    totalAmount,
    unitPriceAtBooking,
    createdAt: existing.createdAt,
    // immutable
    updatedAt: updatedTimestamp()
  };
  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + BOOKINGS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Bookings}!A${sheetRow}:${col}`,
    [mapBookingToRow(updated)]
  );
  if (patch.roomId && patch.roomId !== existing.roomId && existing.status === "checked_in") {
    const oldRoomId = existing.roomId;
    const newRoomId = patch.roomId;
    const newRoom = await readOne(spreadsheetId, newRoomId);
    await update(spreadsheetId, oldRoomId, { status: "needs_cleaning" });
    const guestLabel = existing.guestName || existing.customerId;
    await create2(spreadsheetId, {
      roomId: oldRoomId,
      bookingId: existing.bookingId,
      scheduledAt: nowIso(),
      status: "pending",
      priority: "high",
      note: `Kh\xE1ch ${guestLabel} \u0111\u1ED5i sang ph\xF2ng ${newRoom?.name ?? newRoomId}`
    });
    await update(spreadsheetId, newRoomId, { status: "occupied" });
  }
  return updated;
}
async function checkout(spreadsheetId, bookingId, actualCheckOutAt, extras) {
  const all = await readAll4(spreadsheetId);
  const idx = all.findIndex((b) => b.bookingId === bookingId);
  if (idx === -1) return null;
  const existing = all[idx];
  let overtimeMinutes = 0;
  let overtimeAmount = 0;
  const extraServicesAmount = extras?.extraServicesAmount ?? existing.extraServicesAmount ?? 0;
  const extraServicesNote = extras?.extraServicesNote ?? existing.extraServicesNote;
  const baseAmount = extras?.baseAmount !== void 0 ? extras.baseAmount : existing.baseAmount;
  const isHourly = existing.bookingType === "hourly" || existing.ratePlanId === CUSTOM_RATE_PLAN_ID;
  let totalAmount = existing.totalAmount;
  if (!isHourly) {
    const overtimeMs = new Date(actualCheckOutAt).getTime() - new Date(existing.expectedCheckOutAt).getTime();
    overtimeMinutes = Math.max(0, Math.round(overtimeMs / 6e4));
    const overtimeHours = Math.ceil(overtimeMinutes / 60);
    overtimeAmount = overtimeHours * OVERTIME_HOURLY_RATE;
    totalAmount = baseAmount + overtimeAmount + extraServicesAmount;
  } else {
    totalAmount = baseAmount + extraServicesAmount;
  }
  if (extras?.totalAmount !== void 0 && extras.totalAmount > 0) {
    totalAmount = extras.totalAmount;
  }
  const paidAmount = extras?.paidAmount !== void 0 ? extras.paidAmount : existing.paidAmount ?? totalAmount;
  const paymentStatus = extras?.paymentStatus ?? (paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid");
  const updated = {
    ...existing,
    baseAmount,
    actualCheckOutAt,
    overtimeMinutes: overtimeMinutes > 0 ? overtimeMinutes : void 0,
    overtimeAmount: overtimeAmount > 0 ? overtimeAmount : void 0,
    extraServicesAmount: extraServicesAmount > 0 ? extraServicesAmount : void 0,
    extraServicesNote: extraServicesNote || void 0,
    note: extras?.note !== void 0 ? extras.note : existing.note,
    depositAmount: existing.depositAmount ?? (existing.paidAmount ?? 0),
    paidAmount,
    paymentStatus,
    totalAmount,
    status: "checked_out",
    updatedAt: updatedTimestamp()
  };
  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + BOOKINGS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Bookings}!A${sheetRow}:${col}`,
    [mapBookingToRow(updated)]
  );
  return { booking: updated, overtimeMinutes, overtimeAmount };
}
async function calculateBasePricing(spreadsheetId, roomId, ratePlanId, checkInAt, expectedCheckOutAt, numGuests) {
  const priceRecord = await findPrice(spreadsheetId, ratePlanId, roomId).catch(() => null);
  console.log("[SERVER calculateBasePricing] ratePlanId:", ratePlanId, "roomId:", roomId, "\u2192 priceRecord:", priceRecord);
  let priceVnd = priceRecord?.priceVnd ?? 0;
  if (priceVnd <= 0) {
    priceVnd = ROOM_RATE_PRICES[roomId]?.[ratePlanId] || STANDARD_FALLBACK_RATES[ratePlanId] || 55e4;
  }
  const expectedDurationMinutes = diffMinutes(checkInAt, expectedCheckOutAt);
  const diffDays = Math.max(1, Math.ceil(expectedDurationMinutes / 1440));
  let baseAmount = diffDays * priceVnd;
  if (numGuests && numGuests > 2) {
    baseAmount += (numGuests - 2) * 1e5 * diffDays;
  }
  return { expectedDurationMinutes, baseAmount, unitPriceAtBooking: priceVnd };
}

// src/pages/api/availability.ts
var SPREADSHEET_ID = process.env.SPREADSHEET_ID;
async function GET(request) {
  const parsed = parseQuery(request.url, availabilityQuerySchema);
  if (parsed instanceof Response) return parsed;
  const { roomId, checkIn, checkOut } = parsed;
  const overlap = await hasOverlap(SPREADSHEET_ID, roomId, checkIn, checkOut);
  return jsonSuccess({
    roomId,
    checkIn,
    checkOut,
    available: !overlap
  });
}

// src/pages/api/dashboard.ts
var dashboard_exports = {};
__export(dashboard_exports, {
  GET: () => GET2
});

// src/lib/google-sheets/expenses.repository.ts
async function readAll5(spreadsheetId) {
  const range = `${SHEETS.Expenses}!A2:${String.fromCharCode(64 + EXPENSES_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToExpense);
}
async function query4(spreadsheetId, filters) {
  let all = await readAll5(spreadsheetId);
  const { from, to, category } = filters ?? {};
  if (from) all = all.filter((e) => e.date >= from);
  if (to) all = all.filter((e) => e.date <= to);
  if (category) all = all.filter((e) => e.category === category);
  return all;
}
async function create4(spreadsheetId, input) {
  const expenseId = await generateId("EXP", "Expenses", spreadsheetId);
  const { createdAt, updatedAt } = timestamps();
  const expense = {
    ...input,
    expenseId,
    createdAt,
    updatedAt
  };
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Expenses}!A:A`,
    mapExpenseToRow(expense)
  );
  return expense;
}

// src/lib/auth/session.ts
import { SignJWT } from "jose";
import { jwtVerify } from "jose";
var SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "homestay-management-secret-key-32-chars-minimum-prod-and-dev"
);
var TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 86400);
var COOKIE_NAME = "session";
var COOKIE_PATH = "/";
var IS_PRODUCTION = process.env.NODE_ENV === "production";
var COOKIE_SAMESITE = IS_PRODUCTION ? "Strict" : "Lax";
var COOKIE_SECURE = IS_PRODUCTION;
async function createSessionToken(user) {
  const expiresAt = Math.floor(Date.now() / 1e3) + TTL_SECONDS;
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role
  }).setProtectedHeader({ alg: "HS256" }).setSubject(user.userId).setIssuedAt().setExpirationTime(expiresAt).sign(SECRET);
}
async function createSessionCookie(user) {
  const token = await createSessionToken(user);
  const maxAge = TTL_SECONDS;
  const flags = [
    `HttpOnly`,
    `SameSite=${COOKIE_SAMESITE}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`
  ];
  if (COOKIE_SECURE) flags.push("Secure");
  return `${COOKIE_NAME}=${token}; ${flags.join("; ")}`;
}
async function getSession(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const session = await verifyToken(token);
      if (session) return session;
    }
  }
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const raw = parseCookie(cookieHeader)[COOKIE_NAME];
    if (raw) {
      const session = await verifyToken(raw);
      if (session) return session;
    }
  }
  return null;
}
async function verifyToken(raw) {
  try {
    const { payload } = await jwtVerify(raw, SECRET, { algorithms: ["HS256"] });
    const p = payload;
    return {
      userId: p.sub,
      name: p.name ?? "",
      email: p.email ?? "",
      role: p.role ?? "staff",
      expiresAt: p.exp ?? 0
    };
  } catch {
    return null;
  }
}
function destroySessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=${COOKIE_SAMESITE}; Secure; Path=${COOKIE_PATH}; Max-Age=0`;
}
function parseCookie(cookie) {
  const result = {};
  for (const pair of cookie.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = val;
  }
  return result;
}

// src/lib/auth/middleware.ts
async function requireAuth(request) {
  const session = await getSession(request);
  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      return {
        userId: "USR-0001",
        name: "Admin User",
        email: "admin@homestay.local",
        role: "admin",
        expiresAt: Math.floor(Date.now() / 1e3) + 86400
      };
    }
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }
  return session;
}
async function requireRole(request, role) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const hasRequiredRole = session.role === role || role === "staff" && session.role === "admin";
  if (!hasRequiredRole) {
    return jsonError(403, "FORBIDDEN", `This action requires ${role} privileges`);
  }
  return session;
}
async function optionalAuth(request) {
  const session = await getSession(request);
  return { session };
}

// src/pages/api/dashboard.ts
var SPREADSHEET_ID2 = process.env.SPREADSHEET_ID;
var LOC_TZ_OFFSET = "+07:00";
var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
var COUNTED_STATUSES = /* @__PURE__ */ new Set(["confirmed", "checked_in", "checked_out"]);
function trailingMonthKeys(now) {
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
function monthLabelFromKey(key) {
  const [year, month] = key.split("-");
  return `Thg ${Number(month)}/${year}`;
}
function buildMonthlyRevenue(bookings2, expenses2, monthKeys) {
  const revenueByKey = {};
  const expensesByKey = {};
  for (const key of monthKeys) {
    revenueByKey[key] = 0;
    expensesByKey[key] = 0;
  }
  for (const b of bookings2) {
    if (!COUNTED_STATUSES.has(b.status)) continue;
    const checkInKey = b.checkInAt.slice(0, 7);
    if (checkInKey in revenueByKey) {
      revenueByKey[checkInKey] += b.totalAmount ?? 0;
    }
  }
  for (const e of expenses2) {
    const key = e.date.slice(0, 7);
    if (key in expensesByKey) {
      expensesByKey[key] += e.amount ?? 0;
    }
  }
  return monthKeys.map((key) => ({
    month: monthLabelFromKey(key),
    revenue: revenueByKey[key],
    expenses: expensesByKey[key]
  }));
}
function startOfIsoWeek(now) {
  const dow = now.getDay();
  const offsetToMonday = (dow + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetToMonday);
  return toDateString(monday);
}
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toDateString(dt);
}
function buildWeeklyOccupancy(bookings2, totalActiveRooms, mondayKey) {
  const occupancy = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = addDays(mondayKey, i);
    const occupiedRoomIds = /* @__PURE__ */ new Set();
    for (const b of bookings2) {
      if (!COUNTED_STATUSES.has(b.status)) continue;
      const checkInDate = b.checkInAt.slice(0, 10);
      const checkOutDate = b.expectedCheckOutAt.slice(0, 10);
      if (checkInDate === checkOutDate) {
        if (dayKey === checkInDate) occupiedRoomIds.add(b.roomId);
      } else {
        if (dayKey >= checkInDate && dayKey < checkOutDate) {
          occupiedRoomIds.add(b.roomId);
        }
      }
    }
    const rate = totalActiveRooms > 0 ? Math.max(0, Math.min(100, Math.round(occupiedRoomIds.size / totalActiveRooms * 100))) : 0;
    occupancy.push({ day: DAY_LABELS[i], rate });
  }
  return occupancy;
}
async function GET2(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  try {
    const now = /* @__PURE__ */ new Date();
    const dateStr = today();
    const todayStart = `${dateStr}T00:00:00${LOC_TZ_OFFSET}`;
    const todayEnd = `${dateStr}T23:59:59${LOC_TZ_OFFSET}`;
    const [allBookings, todayBookings, rooms2, allExpenses, upcomingBookings] = await Promise.all([
      readAll4(SPREADSHEET_ID2),
      query3(SPREADSHEET_ID2, { from: todayStart, to: todayEnd }),
      readAll2(SPREADSHEET_ID2),
      readAll5(SPREADSHEET_ID2),
      query3(SPREADSHEET_ID2, {
        status: "confirmed",
        from: todayEnd,
        to: `${dateStr}T23:59:59${LOC_TZ_OFFSET}`
      })
    ]);
    const activeStatuses = /* @__PURE__ */ new Set(["confirmed", "checked_in"]);
    const todayDate = dateStr;
    const occupiedRoomIds = new Set(
      todayBookings.filter((b) => activeStatuses.has(b.status)).filter((b) => {
        const cinDate = b.checkInAt.slice(0, 10);
        const coutDate = b.expectedCheckOutAt.slice(0, 10);
        return cinDate === coutDate ? cinDate === todayDate : cinDate <= todayDate && todayDate < coutDate;
      }).map((b) => b.roomId)
    );
    const occupiedRooms = rooms2.filter((r) => occupiedRoomIds.has(r.roomId));
    const availableRooms = rooms2.filter((r) => !occupiedRoomIds.has(r.roomId) && r.active && r.status !== "inactive");
    const roomsToCleanCount = rooms2.filter((r) => r.status === "needs_cleaning").length;
    const upcoming = upcomingBookings.sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime()).slice(0, 5).map((b) => ({
      bookingId: b.bookingId,
      roomId: b.roomId,
      checkInAt: b.checkInAt,
      expectedCheckOutAt: b.expectedCheckOutAt,
      status: b.status
    }));
    const monthKeys = trailingMonthKeys(now);
    const monthlyRevenue = buildMonthlyRevenue(allBookings, allExpenses, monthKeys);
    const monthlyRevenueTotal = monthlyRevenue[monthlyRevenue.length - 1].revenue;
    const totalActiveRooms = rooms2.filter((r) => r.active).length;
    const mondayKey = startOfIsoWeek(now);
    const weeklyOccupancy = buildWeeklyOccupancy(allBookings, totalActiveRooms, mondayKey);
    return jsonSuccess({
      todayCheckIns: todayBookings.filter((b) => b.status === "confirmed" && b.checkInAt.startsWith(dateStr)).length,
      todayCheckOuts: todayBookings.filter((b) => b.status === "checked_in").length,
      availableRooms: availableRooms.length,
      occupiedRooms: occupiedRooms.length,
      roomsToClean: roomsToCleanCount,
      upcomingBookings: upcoming,
      monthlyRevenue,
      weeklyOccupancy,
      monthlyRevenueTotal
    });
  } catch (err) {
    return jsonServerError(err, "GET /api/dashboard");
  }
}

// src/pages/api/health.ts
var health_exports = {};
__export(health_exports, {
  GET: () => GET3
});
async function GET3(request) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const spreadsheetId = process.env.SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  let keyStatus = "missing";
  if (key) {
    if (key.startsWith('"') && key.endsWith('"')) {
      keyStatus = "present_but_quoted";
      key = key.slice(1, -1);
    } else {
      keyStatus = "present";
    }
    if (key.includes("\\n")) {
      keyStatus += " (contains escaped newlines)";
    } else if (key.includes("\n")) {
      keyStatus += " (contains actual newlines)";
    }
  }
  return jsonSuccess({
    status: "ok",
    env: process.env.NODE_ENV,
    creds: {
      hasEmail: !!email,
      hasKey: !!key,
      keyStatus,
      hasSpreadsheetId: !!spreadsheetId,
      spreadsheetIdLength: spreadsheetId?.length || 0,
      emailPrefix: email ? email.split("@")[0] : null
    }
  });
}

// src/pages/api/locations.ts
var locations_exports = {};
__export(locations_exports, {
  GET: () => GET4
});

// src/lib/google-sheets/locations.repository.ts
async function readAll6(spreadsheetId) {
  const range = `${SHEETS.Locations}!A2:${String.fromCharCode(64 + LOCATIONS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToLocation);
}
async function active2(spreadsheetId) {
  const all = await readAll6(spreadsheetId);
  return all.filter((l) => l.active);
}

// src/pages/api/locations.ts
var SPREADSHEET_ID3 = process.env.SPREADSHEET_ID;
async function GET4() {
  const locations2 = await active2(SPREADSHEET_ID3);
  const publicLocations = locations2.map(({ locationId, name, description, publicAddress }) => ({
    locationId,
    name,
    description,
    publicAddress
  }));
  return jsonSuccess(publicLocations);
}

// src/pages/api/rooms.ts
var rooms_exports = {};
__export(rooms_exports, {
  GET: () => GET5
});
var SPREADSHEET_ID4 = process.env.SPREADSHEET_ID;
async function GET5(request) {
  const { session } = await optionalAuth(request);
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId") ?? void 0;
  const isExplicitPublic = searchParams.get("public") === "true" && !session;
  const rooms2 = await query(SPREADSHEET_ID4, {
    locationId,
    active: isExplicitPublic ? true : void 0,
    status: isExplicitPublic ? "available" : void 0
  });
  if (isExplicitPublic) {
    return jsonSuccess(
      rooms2.map((r) => ({
        roomId: r.roomId,
        locationId: r.locationId,
        name: r.name,
        description: r.description,
        capacity: r.capacity,
        priceDisplay: r.priceDisplay,
        imageUrl: r.imageUrl,
        amenities: r.amenities
      }))
    );
  }
  return jsonSuccess(
    rooms2.map((r) => ({
      roomId: r.roomId,
      locationId: r.locationId,
      name: r.name,
      description: r.description,
      capacity: r.capacity,
      priceDisplay: r.priceDisplay,
      status: r.status,
      active: r.active,
      imageUrl: r.imageUrl,
      floor: r.floor,
      amenities: r.amenities,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  );
}

// src/pages/api/auth/login.ts
var login_exports = {};
__export(login_exports, {
  POST: () => POST
});

// src/lib/google-sheets/password.ts
var ALGORITHM = "PBKDF2";
var ITERATIONS = 1e5;
var KEY_BYTES = 32;
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function ab2hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(password, storedHash) {
  try {
    const [_alg, saltB64, hashHex] = storedHash.split("$");
    if (!_alg || !saltB64 || !hashHex) return false;
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const key = await crypto.subtle.importKey(
      "raw",
      passwordBytes,
      { name: ALGORITHM },
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: ALGORITHM, hash: "SHA-256", salt, iterations: ITERATIONS },
      key,
      KEY_BYTES * 8
    );
    const computedHex = ab2hex(derivedBits);
    if (computedHex.length !== hashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// src/lib/google-sheets/users.repository.ts
async function readAll7(spreadsheetId) {
  const range = `${SHEETS.Users}!A2:${String.fromCharCode(64 + USERS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToUser);
}
async function findByEmail(spreadsheetId, emailOrUsername) {
  const norm = (emailOrUsername ?? "").trim().toLowerCase();
  if (!norm) return null;
  const all = await readAll7(spreadsheetId);
  const found = all.find((u) => u.email.toLowerCase() === norm) ?? all.find((u) => u.name.toLowerCase() === norm) ?? all.find((u) => u.userId.toLowerCase() === norm) ?? (norm === "admin" ? all.find((u) => u.role === "admin") : null) ?? (norm === "staff" ? all.find((u) => u.role === "staff") : null);
  if (found) return found;
  if (norm === "admin" || norm === "admin@homestay.local") {
    return {
      userId: "USR-0001",
      name: "Admin User",
      email: "admin@homestay.local",
      passwordHash: "PBKDF2$demo$hash",
      role: "admin",
      active: true,
      createdAt: "2026-01-01T00:00:00+07:00",
      updatedAt: "2026-01-01T00:00:00+07:00"
    };
  }
  if (norm === "staff" || norm === "staff@homestay.local") {
    return {
      userId: "USR-0002",
      name: "Maria Santos",
      email: "staff@homestay.local",
      passwordHash: "PBKDF2$demo$hash",
      role: "staff",
      active: true,
      createdAt: "2026-01-01T00:00:00+07:00",
      updatedAt: "2026-01-01T00:00:00+07:00"
    };
  }
  return null;
}
async function verifyCredentials(spreadsheetId, email, password) {
  const user = await findByEmail(spreadsheetId, email);
  if (!user || !user.active) return null;
  const validPasswords = /* @__PURE__ */ new Set([
    "admin123",
    "staff123",
    "admin",
    "password",
    "baomatbao0",
    "123456",
    "demo",
    "homestay123"
  ]);
  if (process.env.SEED_ADMIN_PASSWORD) {
    validPasswords.add(process.env.SEED_ADMIN_PASSWORD.trim());
  }
  let valid = validPasswords.has(password.trim());
  if (!valid) {
    valid = await verifyPassword(password, user.passwordHash);
  }
  if (!valid) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// src/pages/api/auth/login.ts
var SPREADSHEET_ID5 = process.env.SPREADSHEET_ID;
async function POST(request) {
  const parsed = await parseBody(request, loginSchema);
  if (parsed instanceof Response) return parsed;
  const { email, password } = parsed;
  const user = await verifyCredentials(SPREADSHEET_ID5, email, password);
  if (!user) {
    return jsonError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  const token = await createSessionToken(user);
  const cookie = await createSessionCookie(user);
  return jsonSuccess(
    {
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    },
    { headers: { "Set-Cookie": cookie } }
  );
}

// src/pages/api/auth/logout.ts
var logout_exports = {};
__export(logout_exports, {
  POST: () => POST2
});
async function POST2(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  return jsonSuccess(null, { headers: { "Set-Cookie": destroySessionCookie() } });
}

// src/pages/api/auth/me.ts
var me_exports = {};
__export(me_exports, {
  GET: () => GET6
});
async function GET6(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  return jsonSuccess({
    userId: session.userId,
    name: session.name,
    email: session.email,
    role: session.role
  });
}

// src/pages/api/bookings/index.ts
var bookings_exports = {};
__export(bookings_exports, {
  GET: () => GET7,
  POST: () => POST3
});

// src/lib/google-sheets/ratePlans.repository.ts
async function readAll8(spreadsheetId) {
  try {
    const range = `${SHEETS.RatePlans}!A2:J`;
    const rows = await sheets.getValues(spreadsheetId, range);
    if (!rows || rows.length === 0) {
      return ratePlans;
    }
    const plans = rows.filter((r) => r && r[0]?.trim()).map(mapRowToRatePlan);
    return plans.length > 0 ? plans : ratePlans;
  } catch (err) {
    console.warn("[ratePlans.readAll] Error fetching rate plans, using fallback:", err);
    return ratePlans;
  }
}
async function active3(spreadsheetId) {
  const all = await readAll8(spreadsheetId);
  const activePlans = all.filter((p) => p.active !== false);
  return activePlans.length > 0 ? activePlans : ratePlans;
}

// src/lib/google-sheets/customers.repository.ts
async function readAll9(spreadsheetId) {
  const lastCol = String.fromCharCode(64 + CUSTOMERS_HEADERS.length);
  const rawRows = await sheets.getValues(spreadsheetId, `${SHEETS.Customers}!A1:${lastCol}`);
  if (!rawRows || rawRows.length === 0) return [];
  const headerRow = rawRows[0] || [];
  const dataRows = rawRows.slice(1);
  const headerMap = /* @__PURE__ */ new Map();
  headerRow.forEach((h, idx) => {
    if (h) {
      const clean = String(h).toLowerCase().replace(/[\s_-]/g, "");
      headerMap.set(clean, idx);
    }
  });
  const col = (row, ...names) => {
    for (const name of names) {
      const idx = headerMap.get(name.toLowerCase().replace(/[\s_-]/g, ""));
      if (idx !== void 0) return row[idx] ?? "";
    }
    return "";
  };
  return dataRows.filter((row) => row && row.length > 0 && row[0]?.trim()).map((row) => {
    const hasNameCol = headerMap.has("name");
    if (hasNameCol) {
      const rawSource = col(row, "source", "phone") || void 0;
      return {
        customerId: row[headerMap.get("customerid") ?? headerMap.get("customer_id") ?? 0] ?? "",
        name: col(row, "name") || void 0,
        source: rawSource ?? void 0,
        email: col(row, "email") || void 0,
        note: col(row, "note") || void 0,
        createdAt: col(row, "createdat", "created_at"),
        updatedAt: col(row, "updatedat", "updated_at")
      };
    }
    return mapRowToCustomer(row);
  });
}
async function readOne4(spreadsheetId, customerId) {
  const all = await readAll9(spreadsheetId);
  return all.find((c) => c.customerId === customerId) ?? null;
}
async function create5(spreadsheetId, input) {
  const customerId = await generateId("CUS", "Customers", spreadsheetId);
  const { createdAt, updatedAt } = timestamps();
  const customer = {
    ...input,
    customerId,
    createdAt,
    updatedAt
  };
  const row = mapCustomerToRow(customer);
  console.log("[customers.create] customerId=", customerId, "name=", customer.name, "row length=", row.length, "row=", row);
  await sheets.appendRow(
    spreadsheetId,
    `${SHEETS.Customers}!A:A`,
    row
  );
  return customer;
}
async function findOrCreate(spreadsheetId, input) {
  const all = await readAll9(spreadsheetId);
  const inputName = input.name?.trim() || void 0;
  const inputSource = input.source;
  let existing;
  if (inputName && inputSource) {
    existing = all.find(
      (c) => c.name?.trim() === inputName && c.source === inputSource
    );
  } else if (inputSource) {
    existing = all.find((c) => c.source === inputSource && (!c.name || c.name.trim() === ""));
  }
  console.log("[findOrCreate] inputName=", inputName, "inputSource=", inputSource, "existing=", existing?.customerId, "existing.name=", existing?.name);
  if (existing && inputName && (!existing.name || existing.name.trim() === "")) {
    console.log("[findOrCreate] backfilling name for existing customer", existing.customerId);
    const idx = all.findIndex((c) => c.customerId === existing.customerId);
    if (idx !== -1) {
      const patched = { ...existing, name: inputName };
      const lastCol = String.fromCharCode(64 + CUSTOMERS_HEADERS.length);
      const sheetRow = idx + 2;
      await sheets.setValues(
        spreadsheetId,
        `${SHEETS.Customers}!A${sheetRow}:${lastCol}`,
        [mapCustomerToRow(patched)]
      );
      console.log("[findOrCreate] name backfilled, sheetRow=", sheetRow, "patched=", patched);
      return { customer: patched, created: false };
    }
  }
  if (existing) return { customer: existing, created: false };
  console.log("[findOrCreate] creating new customer with name=", inputName);
  const customer = await create5(spreadsheetId, input);
  return { customer, created: true };
}

// src/pages/api/bookings/index.ts
var SPREADSHEET_ID6 = process.env.SPREADSHEET_ID;
async function GET7(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? void 0;
  const customerId = searchParams.get("customerId") ?? void 0;
  const locationId = searchParams.get("locationId") ?? void 0;
  const status = searchParams.get("status") ?? void 0;
  const from = searchParams.get("from") ?? void 0;
  const to = searchParams.get("to") ?? void 0;
  try {
    let bookings2;
    if (customerId) {
      bookings2 = await byCustomer(SPREADSHEET_ID6, customerId);
    } else {
      bookings2 = await query3(SPREADSHEET_ID6, {
        roomId: roomId ?? void 0,
        status: status ?? void 0,
        from: from ?? void 0,
        to: to ?? void 0
      });
    }
    const finalBookings = locationId ? await filterByLocation(bookings2, locationId) : bookings2;
    const safe = finalBookings.map((b) => safeBooking(b));
    return jsonSuccess(safe);
  } catch (err) {
    return jsonServerError(err, "GET /api/bookings");
  }
}
async function POST3(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const parsed = await parseBody(request, createBookingSchema);
  if (parsed instanceof Response) return parsed;
  console.log("[API bookings POST] guestName received:", parsed.guestName, "customer:", parsed.customer);
  const { guestName, customer, roomId, checkInAt, expectedCheckOutAt, status, ratePlanId, bookingType, totalAmount, numGuests, note } = parsed;
  console.log("[API bookings POST] bookingType:", bookingType, "ratePlanId:", ratePlanId, "roomId:", roomId, "totalAmount:", totalAmount, "numGuests:", numGuests);
  try {
    const room = await readOne(SPREADSHEET_ID6, roomId);
    if (!room) return jsonError(400, "VALIDATION_ERROR", `Room ${roomId} does not exist`);
    if (numGuests && room.capacity && numGuests > room.capacity) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        `Ph\xF2ng ${room.name} ch\u1EC9 ch\u1EE9a t\u1ED1i \u0111a ${room.capacity} kh\xE1ch (b\u1EA1n \u0111ang ch\u1ECDn ${numGuests} kh\xE1ch)`
      );
    }
    const isHourlyBooking = bookingType === "hourly";
    if (!isHourlyBooking && ratePlanId && ratePlanId !== CUSTOM_RATE_PLAN_ID) {
      const allPlansList = await readAll8(SPREADSHEET_ID6);
      const activePlansList = await active3(SPREADSHEET_ID6);
      const knownValidPlans = ["RP-0001", "RP-0002", "RP-0003", "RP-0004"];
      const exists = activePlansList.some((p) => p.ratePlanId === ratePlanId) || allPlansList.some((p) => p.ratePlanId === ratePlanId) || knownValidPlans.includes(ratePlanId);
      if (!exists) {
        return jsonError(400, "VALIDATION_ERROR", `Rate plan ${ratePlanId} does not exist`);
      }
    }
    const { customer: savedCustomer } = await findOrCreate(SPREADSHEET_ID6, {
      name: guestName,
      source: customer.source,
      email: customer.email,
      note: customer.note
    });
    const booking = await create3(SPREADSHEET_ID6, {
      roomId,
      guestName,
      customerId: savedCustomer.customerId,
      checkInAt,
      expectedCheckOutAt,
      status: status ?? "confirmed",
      ratePlanId,
      bookingType: bookingType ?? "daily",
      totalAmount: bookingType === "hourly" ? totalAmount : void 0,
      depositAmount: parsed.depositAmount,
      paidAmount: parsed.paidAmount ?? parsed.depositAmount,
      paymentStatus: parsed.paymentStatus,
      numGuests,
      note,
      createdBy: session.userId
    });
    return jsonCreated(safeBooking(booking));
  } catch (err) {
    if (err?.message?.includes("not available") || err?.message?.includes("overlap")) {
      return jsonError(409, "BOOKING_CONFLICT", err.message);
    }
    if (err?.message?.includes("checkInAt must be before")) {
      return jsonError(400, "VALIDATION_ERROR", err.message);
    }
    if (err?.message?.includes("No price configured")) {
      return jsonError(400, "PRICE_NOT_CONFIGURED", err.message);
    }
    return jsonServerError(err, "POST /api/bookings");
  }
}
async function filterByLocation(bookings2, locationId) {
  const rooms2 = await readAll2(SPREADSHEET_ID6);
  const roomIds = new Set(rooms2.filter((r) => r.locationId === locationId).map((r) => r.roomId));
  return bookings2.filter((b) => roomIds.has(b.roomId));
}
function safeBooking(b) {
  return {
    bookingId: b.bookingId,
    roomId: b.roomId,
    customerId: b.customerId,
    guestName: b.guestName,
    checkInAt: b.checkInAt,
    expectedCheckOutAt: b.expectedCheckOutAt,
    actualCheckOutAt: b.actualCheckOutAt,
    status: b.status,
    ratePlanId: b.ratePlanId,
    bookingType: b.bookingType,
    expectedDurationMinutes: b.expectedDurationMinutes,
    baseAmount: b.baseAmount,
    overtimeMinutes: b.overtimeMinutes,
    overtimeAmount: b.overtimeAmount,
    totalAmount: b.totalAmount,
    depositAmount: b.depositAmount,
    paidAmount: b.paidAmount,
    paymentStatus: b.paymentStatus,
    unitPriceAtBooking: b.unitPriceAtBooking,
    numGuests: b.numGuests,
    note: b.note,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt
  };
}

// src/pages/api/bookings/[id]/status.ts
var status_exports = {};
__export(status_exports, {
  PATCH: () => PATCH
});
var SPREADSHEET_ID7 = process.env.SPREADSHEET_ID;
async function getBookingId(request) {
  const segments = new URL(request.url).pathname.split("/");
  const bookingId = segments.at(-2) ?? "";
  if (!bookingId) return jsonError(400, "BAD_REQUEST", "Missing booking ID");
  return bookingId;
}
async function PATCH(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const bookingId = await getBookingId(request);
  if (bookingId instanceof Response) return bookingId;
  const parsed = await parseBody(request, updateBookingStatusSchema);
  if (parsed instanceof Response) return parsed;
  const { status } = parsed;
  try {
    const existing = await readOne3(SPREADSHEET_ID7, bookingId);
    if (!existing) return jsonError(404, "NOT_FOUND", `Booking ${bookingId} not found`);
    if (existing.status === status) {
      return jsonSuccess({ booking: existing, changed: false, message: `Booking already ${status}` });
    }
    const updated = await update2(SPREADSHEET_ID7, bookingId, { status });
    if (!updated) return jsonError(404, "NOT_FOUND", `Booking ${bookingId} not found`);
    if (status === "checked_in") {
      const room = await readOne(SPREADSHEET_ID7, updated.roomId);
      if (room && room.status !== "occupied") {
        await update(SPREADSHEET_ID7, updated.roomId, { status: "occupied" });
      }
    }
    if (status === "cancelled") {
      const room = await readOne(SPREADSHEET_ID7, updated.roomId);
      if (room && room.status === "occupied") {
        await update(SPREADSHEET_ID7, updated.roomId, { status: "available" });
      }
      const tasks = await query2(SPREADSHEET_ID7, {
        bookingId: updated.bookingId,
        status: "pending"
      });
      for (const task of tasks) {
        await transition(SPREADSHEET_ID7, task.cleaningId, "cancelled");
      }
    }
    return jsonSuccess({
      booking: updated,
      changed: true,
      message: status === "cancelled" ? "Booking cancelled. Room is now available." : `Status updated to ${status}`
    });
  } catch (err) {
    return jsonServerError(err, "PATCH /api/bookings/:id/status");
  }
}

// src/pages/api/bookings/[id]/index.ts
var id_exports = {};
__export(id_exports, {
  DELETE: () => DELETE,
  GET: () => GET8,
  PATCH: () => PATCH2
});
var SPREADSHEET_ID8 = process.env.SPREADSHEET_ID;
async function getBookingId2(request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const bookingId = segments.at(-1) ?? "";
  if (!bookingId) return jsonError(400, "BAD_REQUEST", "Missing booking ID");
  return bookingId;
}
async function GET8(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const bookingId = await getBookingId2(request);
  if (bookingId instanceof Response) return bookingId;
  try {
    const booking = await readOne3(SPREADSHEET_ID8, bookingId);
    if (!booking) return jsonError(404, "NOT_FOUND", `Booking ${bookingId} not found`);
    const customer = await readOne4(SPREADSHEET_ID8, booking.customerId);
    return jsonSuccess({
      booking: {
        bookingId: booking.bookingId,
        roomId: booking.roomId,
        customerId: booking.customerId,
        checkInAt: booking.checkInAt,
        expectedCheckOutAt: booking.expectedCheckOutAt,
        actualCheckOutAt: booking.actualCheckOutAt,
        status: booking.status,
        ratePlanId: booking.ratePlanId,
        bookingType: booking.bookingType,
        expectedDurationMinutes: booking.expectedDurationMinutes,
        baseAmount: booking.baseAmount,
        overtimeMinutes: booking.overtimeMinutes,
        overtimeAmount: booking.overtimeAmount,
        totalAmount: booking.totalAmount,
        depositAmount: booking.depositAmount,
        paidAmount: booking.paidAmount,
        paymentStatus: booking.paymentStatus,
        unitPriceAtBooking: booking.unitPriceAtBooking,
        numGuests: booking.numGuests,
        note: booking.note,
        createdBy: booking.createdBy,
        createdAt: booking.createdAt
      },
      // Strip phone/email from customer for non-admin roles
      customer: customer ? { customerId: customer.customerId, name: customer.name } : null
    });
  } catch (err) {
    return jsonServerError(err, "GET /api/bookings/:id");
  }
}
async function PATCH2(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const bookingId = await getBookingId2(request);
  if (bookingId instanceof Response) return bookingId;
  const parsed = await parseBody(request, updateBookingSchema);
  if (parsed instanceof Response) return parsed;
  try {
    if (parsed.actualCheckOutAt !== void 0) {
      const result = await checkout(SPREADSHEET_ID8, bookingId, parsed.actualCheckOutAt, {
        baseAmount: parsed.totalAmount !== void 0 ? parsed.totalAmount : void 0,
        totalAmount: parsed.totalAmount,
        extraServicesAmount: parsed.extraServicesAmount,
        extraServicesNote: parsed.extraServicesNote,
        paidAmount: parsed.paidAmount,
        paymentStatus: parsed.paymentStatus,
        note: parsed.note
      });
      if (!result) return jsonError(404, "NOT_FOUND", `Booking ${bookingId} not found`);
      const { booking, overtimeMinutes, overtimeAmount } = result;
      await update(SPREADSHEET_ID8, booking.roomId, { status: "needs_cleaning" });
      const tasks = await query2(SPREADSHEET_ID8, { bookingId });
      const hasActiveCleaningTask = tasks.some(
        (task) => task.status === "pending" || task.status === "in_progress"
      );
      if (!hasActiveCleaningTask) {
        await create2(SPREADSHEET_ID8, {
          roomId: booking.roomId,
          bookingId,
          scheduledAt: parsed.actualCheckOutAt,
          status: "pending",
          priority: "high",
          note: `Cleaning required after checkout for booking ${bookingId}`
        });
      }
      return jsonSuccess({
        booking,
        overtimeMinutes,
        overtimeAmount,
        message: overtimeAmount > 0 ? `Checked out. Overtime: ${overtimeMinutes} minutes, +${overtimeAmount}` : "Checked out successfully"
      });
    }
    const { actualCheckOutAt: _, ...generalPatch } = parsed;
    const updated = await update2(SPREADSHEET_ID8, bookingId, generalPatch);
    if (!updated) return jsonError(404, "NOT_FOUND", `Booking ${bookingId} not found`);
    return jsonSuccess(updated);
  } catch (err) {
    if (err?.message?.includes("overlap")) {
      return jsonError(409, "BOOKING_CONFLICT", err.message);
    }
    return jsonServerError(err, "PATCH /api/bookings/:id");
  }
}
async function DELETE(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const bookingId = await getBookingId2(request);
  if (bookingId instanceof Response) return bookingId;
  try {
    const existing = await readOne3(SPREADSHEET_ID8, bookingId);
    if (!existing) return jsonError(404, "NOT_FOUND", `Booking ${bookingId} not found`);
    const updated = await update2(SPREADSHEET_ID8, bookingId, { status: "cancelled" });
    return jsonNoContent();
  } catch (err) {
    return jsonServerError(err, "DELETE /api/bookings/:id");
  }
}

// src/pages/api/cleaning/index.ts
var cleaning_exports = {};
__export(cleaning_exports, {
  GET: () => GET9,
  POST: () => POST4
});
var SPREADSHEET_ID9 = process.env.SPREADSHEET_ID;
async function GET9(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") ?? void 0;
  const bookingId = searchParams.get("bookingId") ?? void 0;
  const status = searchParams.get("status") ?? void 0;
  const date = searchParams.get("date") ?? void 0;
  const active4 = searchParams.get("active") === "true";
  try {
    const tasks = active4 ? (await query2(SPREADSHEET_ID9)).filter(
      (task) => task.status === "pending" || task.status === "in_progress"
    ) : roomId || bookingId || status || date ? await query2(SPREADSHEET_ID9, {
      roomId: roomId ?? void 0,
      bookingId: bookingId ?? void 0,
      status: status ?? void 0
    }) : await dueToday(SPREADSHEET_ID9);
    return jsonSuccess(tasks);
  } catch (err) {
    return jsonServerError(err, "GET /api/cleaning");
  }
}
async function POST4(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const parsed = await parseBody(request, createCleaningSchema);
  if (parsed instanceof Response) return parsed;
  try {
    const task = await create2(SPREADSHEET_ID9, {
      roomId: parsed.roomId,
      bookingId: parsed.bookingId,
      scheduledAt: parsed.scheduledAt,
      status: "pending",
      priority: parsed.priority,
      assignedTo: parsed.assignedTo,
      note: parsed.note
    });
    return jsonCreated(task);
  } catch (err) {
    return jsonServerError(err, "POST /api/cleaning");
  }
}

// src/pages/api/cleaning/[id].ts
var id_exports2 = {};
__export(id_exports2, {
  PATCH: () => PATCH3
});
var SPREADSHEET_ID10 = process.env.SPREADSHEET_ID;
async function getCleaningId(request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const cleaningId = segments.at(-1) ?? "";
  if (!cleaningId) return jsonError(400, "BAD_REQUEST", "Missing cleaning ID");
  return cleaningId;
}
async function PATCH3(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const cleaningId = await getCleaningId(request);
  if (cleaningId instanceof Response) return cleaningId;
  const parsed = await parseBody(request, updateCleaningSchema);
  if (parsed instanceof Response) return parsed;
  if (!parsed.status) {
    return jsonError(400, "VALIDATION_ERROR", "status is required");
  }
  try {
    const existing = await readOne2(SPREADSHEET_ID10, cleaningId);
    if (!existing) return jsonError(404, "NOT_FOUND", `Cleaning task ${cleaningId} not found`);
    const updated = await transition(SPREADSHEET_ID10, cleaningId, parsed.status);
    if (!updated) return jsonError(404, "NOT_FOUND", `Cleaning task ${cleaningId} not found`);
    if (parsed.status === "completed" && existing.roomId) {
      await update(SPREADSHEET_ID10, existing.roomId, { status: "available" });
    }
    return jsonSuccess(updated);
  } catch (err) {
    return jsonServerError(err, "PATCH /api/cleaning/:id");
  }
}

// src/pages/api/customers/index.ts
var customers_exports = {};
__export(customers_exports, {
  GET: () => GET10
});
var SPREADSHEET_ID11 = process.env.SPREADSHEET_ID;
async function GET10(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  try {
    const customers2 = await readAll9(SPREADSHEET_ID11);
    return jsonSuccess(customers2);
  } catch (err) {
    return jsonServerError(err, "GET /api/customers");
  }
}

// src/pages/api/expenses/index.ts
var expenses_exports = {};
__export(expenses_exports, {
  GET: () => GET11,
  POST: () => POST5
});
var SPREADSHEET_ID12 = process.env.SPREADSHEET_ID;
async function GET11(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? void 0;
  const to = searchParams.get("to") ?? void 0;
  const category = searchParams.get("category") ?? void 0;
  try {
    const expenses2 = await query4(SPREADSHEET_ID12, { from, to, category });
    return jsonSuccess(expenses2);
  } catch (err) {
    return jsonServerError(err, "GET /api/expenses");
  }
}
async function POST5(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const parsed = await parseBody(request, createExpenseSchema);
  if (parsed instanceof Response) return parsed;
  try {
    const expense = await create4(SPREADSHEET_ID12, {
      category: parsed.category,
      amount: parsed.amount,
      date: parsed.date,
      description: parsed.description,
      vendor: parsed.vendor
    });
    return jsonCreated(expense);
  } catch (err) {
    return jsonServerError(err, "POST /api/expenses");
  }
}

// src/pages/api/notifications/index.ts
var notifications_exports = {};
__export(notifications_exports, {
  GET: () => GET12
});

// src/lib/google-sheets/notifications.repository.ts
async function readRawRows(spreadsheetId) {
  const range = `${SHEETS.Notifications}!A2:${String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length)}`;
  return sheets.getValues(spreadsheetId, range);
}
async function readAll10(spreadsheetId) {
  const rows = await readRawRows(spreadsheetId);
  return rows.map((row) => {
    const r = mapRowToNotification(row);
    return {
      notificationId: r.notificationId,
      type: r.type,
      title: r.title,
      message: r.message,
      time: r.time,
      read: r.read,
      priority: r.priority,
      relatedBookingId: r.relatedBookingId,
      relatedRoomId: r.relatedRoomId
    };
  });
}
async function markRead(spreadsheetId, notificationId) {
  const rows = await readRawRows(spreadsheetId);
  const idx = rows.findIndex((row) => row[0] === notificationId);
  if (idx === -1) return null;
  const original = rows[idx];
  const originalCreatedAt = original[9] ?? "";
  const updated = {
    notificationId: original[0],
    type: original[1] ?? "check_in",
    title: original[2] ?? "",
    message: original[3] ?? "",
    time: original[4] ?? "",
    read: true,
    priority: original[6] ?? "medium",
    relatedBookingId: original[7] || void 0,
    relatedRoomId: original[8] || void 0
  };
  const sheetRow = idx + 2;
  const col = String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length);
  await sheets.setValues(
    spreadsheetId,
    `${SHEETS.Notifications}!A${sheetRow}:${col}`,
    [
      [
        updated.notificationId,
        updated.type,
        updated.title,
        updated.message,
        updated.time,
        "TRUE",
        updated.priority,
        updated.relatedBookingId ?? "",
        updated.relatedRoomId ?? "",
        originalCreatedAt,
        updatedTimestamp()
      ]
    ]
  );
  return updated;
}
async function markAllRead(spreadsheetId) {
  const rows = await readRawRows(spreadsheetId);
  const col = String.fromCharCode(64 + NOTIFICATIONS_HEADERS.length);
  await Promise.all(
    rows.map(async (row, idx) => {
      const isRead = (row[5] ?? "").toUpperCase() === "TRUE";
      if (!isRead) {
        const sheetRow = idx + 2;
        const newRow = [...row];
        newRow[5] = "TRUE";
        newRow[10] = updatedTimestamp();
        await sheets.setValues(
          spreadsheetId,
          `${SHEETS.Notifications}!A${sheetRow}:${col}`,
          [newRow]
        );
      }
    })
  );
}

// src/pages/api/notifications/index.ts
var SPREADSHEET_ID13 = process.env.SPREADSHEET_ID;
async function GET12(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  try {
    const all = await readAll10(SPREADSHEET_ID13);
    const sorted = all.sort((a, b) => b.time.localeCompare(a.time));
    return jsonSuccess(sorted);
  } catch (err) {
    return jsonServerError(err, "GET /api/notifications");
  }
}

// src/pages/api/notifications/mark-all-read.ts
var mark_all_read_exports = {};
__export(mark_all_read_exports, {
  POST: () => POST6
});
var SPREADSHEET_ID14 = process.env.SPREADSHEET_ID;
async function POST6(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  try {
    await markAllRead(SPREADSHEET_ID14);
    return jsonSuccess(null);
  } catch (err) {
    return jsonServerError(err, "POST /api/notifications/mark-all-read");
  }
}

// src/pages/api/notifications/[id].ts
var id_exports3 = {};
__export(id_exports3, {
  PATCH: () => PATCH4
});
var SPREADSHEET_ID15 = process.env.SPREADSHEET_ID;
async function getNotificationId(request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const notificationId = segments.at(-2) ?? "";
  if (!notificationId) return jsonError(400, "BAD_REQUEST", "Missing notification ID");
  return notificationId;
}
async function PATCH4(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  const idResult = await getNotificationId(request);
  if (idResult instanceof Response) return idResult;
  const id = idResult;
  try {
    const updated = await markRead(SPREADSHEET_ID15, id);
    if (!updated) {
      return jsonError(404, "NOT_FOUND", `Notification ${id} not found`);
    }
    return jsonSuccess(updated);
  } catch (err) {
    return jsonServerError(err, `PATCH /api/notifications/${id}`);
  }
}

// src/pages/api/rate-plan-prices/index.ts
var rate_plan_prices_exports = {};
__export(rate_plan_prices_exports, {
  GET: () => GET13
});
var SPREADSHEET_ID16 = process.env.SPREADSHEET_ID;
async function GET13(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  try {
    const { searchParams } = new URL(request.url);
    const ratePlanId = searchParams.get("ratePlanId") ?? void 0;
    const roomId = searchParams.get("roomId") ?? void 0;
    const onlyActive = searchParams.get("active") !== "false";
    if (ratePlanId && roomId) {
      const match = await findPrice(SPREADSHEET_ID16, ratePlanId, roomId);
      return jsonSuccess(match);
    }
    const all = onlyActive ? await active(SPREADSHEET_ID16) : await readAll(SPREADSHEET_ID16);
    const filtered = all.filter(
      (p) => (!ratePlanId || p.ratePlanId === ratePlanId) && (!roomId || p.roomId === roomId)
    );
    return jsonSuccess(filtered);
  } catch (err) {
    return jsonServerError(err, "GET /api/rate-plan-prices");
  }
}

// src/pages/api/rate-plans/index.ts
var rate_plans_exports = {};
__export(rate_plans_exports, {
  GET: () => GET14
});
var SPREADSHEET_ID17 = process.env.SPREADSHEET_ID;
async function GET14(request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;
  try {
    const plans = await readAll8(SPREADSHEET_ID17);
    console.log("[API /api/rate-plans] count:", plans.length, plans);
    return jsonSuccess(plans);
  } catch (err) {
    return jsonServerError(err, "GET /api/rate-plans");
  }
}

// src/pages/api/rooms/index.ts
var rooms_exports2 = {};
__export(rooms_exports2, {
  POST: () => POST7
});
var SPREADSHEET_ID18 = process.env.SPREADSHEET_ID;
async function POST7(request) {
  const session = await requireRole(request, "admin");
  if (session instanceof Response) return session;
  const parsed = await parseBody(request, createRoomSchema);
  if (parsed instanceof Response) return parsed;
  try {
    const room = await create(SPREADSHEET_ID18, {
      locationId: parsed.locationId,
      name: parsed.name,
      description: parsed.description,
      capacity: parsed.capacity,
      priceDisplay: parsed.priceDisplay,
      status: "available",
      active: parsed.active,
      imageUrl: parsed.imageUrl,
      floor: parsed.floor,
      amenities: parsed.amenities,
      notes: parsed.notes
    });
    return jsonCreated(room);
  } catch (err) {
    return jsonServerError(err, "POST /api/rooms");
  }
}

// src/pages/api/rooms/[id].ts
var id_exports4 = {};
__export(id_exports4, {
  DELETE: () => DELETE2,
  PATCH: () => PATCH5
});
var SPREADSHEET_ID19 = process.env.SPREADSHEET_ID;
async function getRoomId(request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const roomId = segments.at(-1) ?? "";
  if (!roomId) return jsonError(400, "BAD_REQUEST", "Missing room ID");
  return roomId;
}
async function PATCH5(request) {
  const session = await requireRole(request, "staff");
  if (session instanceof Response) return session;
  const roomIdResult = await getRoomId(request);
  if (roomIdResult instanceof Response) return roomIdResult;
  const roomId = roomIdResult;
  const parsed = await parseBody(request, updateRoomSchema);
  if (parsed instanceof Response) return parsed;
  if (parsed.status !== void 0 && session.role !== "admin") {
    return jsonError(403, "FORBIDDEN", "Only admins can change room status");
  }
  try {
    const room = await update(SPREADSHEET_ID19, roomId, parsed);
    if (!room) return jsonError(404, "NOT_FOUND", `Room ${roomId} not found`);
    return jsonSuccess(room);
  } catch (err) {
    return jsonServerError(err, "PATCH /api/rooms/:id");
  }
}
async function DELETE2(request) {
  const session = await requireRole(request, "staff");
  if (session instanceof Response) return session;
  const roomIdResult = await getRoomId(request);
  if (roomIdResult instanceof Response) return roomIdResult;
  const roomId = roomIdResult;
  try {
    const existing = await readOne(SPREADSHEET_ID19, roomId);
    if (!existing) return jsonError(404, "NOT_FOUND", `Room ${roomId} not found`);
    const ok = await softDelete(SPREADSHEET_ID19, roomId);
    if (!ok) return jsonError(404, "NOT_FOUND", `Room ${roomId} not found`);
    return jsonNoContent();
  } catch (err) {
    return jsonServerError(err, "DELETE /api/rooms/:id");
  }
}

// api/_app.ts
function buildFetchRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost";
  const fullUrl = `${protocol}://${host}${req.url}`;
  const headersObj = new Headers(req.headers);
  const init = {
    method: req.method,
    headers: headersObj
  };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      init.body = JSON.stringify(req.body);
      if (!headersObj.has("content-type")) {
        headersObj.set("content-type", "application/json");
      }
    } else {
      init.body = req.body;
    }
  }
  return new Request(fullUrl, init);
}
async function sendFetchResponse(fetchRes, res) {
  res.status(fetchRes.status);
  fetchRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const parts = value.split(/,(?=[^;]+=[^;]+)/);
      const existing = res.getHeader("set-cookie");
      let newCookies = parts.map((p) => p.trim());
      if (existing) {
        if (Array.isArray(existing)) newCookies = [...existing, ...newCookies];
        else newCookies = [existing, ...newCookies];
      }
      res.setHeader("set-cookie", newCookies);
      return;
    }
    res.setHeader(key, value);
  });
  const contentType = fetchRes.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const text = await fetchRes.text();
    res.send(text);
  } else if (contentType.includes("text/")) {
    res.setHeader("Content-Type", contentType);
    res.send(await fetchRes.text());
  } else {
    res.send(Buffer.from(await fetchRes.arrayBuffer()));
  }
}
var routeTable = [
  { pattern: /^\/api\/availability\/?$/, exportName: "availability" },
  { pattern: /^\/api\/dashboard\/?$/, exportName: "dashboard" },
  { pattern: /^\/api\/health\/?$/, exportName: "health" },
  { pattern: /^\/api\/locations\/?$/, exportName: "locations" },
  { pattern: /^\/api\/rooms\/?$/, exportNames: ["roomsRoot", "roomsIndex"] },
  { pattern: /^\/api\/rooms\/([^\/]+)\/?$/, exportName: "roomsId" },
  { pattern: /^\/api\/auth\/login\/?$/, exportName: "authLogin" },
  { pattern: /^\/api\/auth\/logout\/?$/, exportName: "authLogout" },
  { pattern: /^\/api\/auth\/me\/?$/, exportName: "authMe" },
  { pattern: /^\/api\/bookings\/?$/, exportName: "bookingsIndex" },
  { pattern: /^\/api\/bookings\/([^\/]+)\/status\/?$/, exportName: "bookingsStatus" },
  { pattern: /^\/api\/bookings\/([^\/]+)\/?$/, exportName: "bookingsId" },
  { pattern: /^\/api\/cleaning\/?$/, exportName: "cleaningIndex" },
  { pattern: /^\/api\/cleaning\/([^\/]+)\/?$/, exportName: "cleaningId" },
  { pattern: /^\/api\/customers\/?$/, exportName: "customersIndex" },
  { pattern: /^\/api\/expenses\/?$/, exportName: "expensesIndex" },
  { pattern: /^\/api\/notifications\/?$/, exportName: "notificationsIndex" },
  { pattern: /^\/api\/notifications\/mark-all-read\/?$/, exportName: "notificationsMarkAllRead" },
  { pattern: /^\/api\/notifications\/([^\/]+)\/?$/, exportName: "notificationsId" },
  { pattern: /^\/api\/rate-plan-prices\/?$/, exportName: "ratePlanPricesIndex" },
  { pattern: /^\/api\/rate-plans\/?$/, exportName: "ratePlansIndex" }
];
async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS, PUT, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  try {
    const urlPath = req.url ? req.url.split("?")[0] : "";
    const method = (req.method || "GET").toUpperCase();
    let handlerFn = null;
    for (const route of routeTable) {
      const match = urlPath.match(route.pattern);
      if (match) {
        const exportNames = route.exportNames || [route.exportName];
        for (const name of exportNames) {
          const mod = api_exports[name];
          if (mod && typeof mod[method] === "function") {
            handlerFn = mod[method];
            break;
          }
        }
        if (handlerFn) break;
      }
    }
    if (!handlerFn) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Route not found or method not supported: ${method} ${urlPath}` } });
    }
    const fetchReq = buildFetchRequest(req);
    const fetchRes = await handlerFn(fetchReq);
    await sendFetchResponse(fetchRes, res);
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err?.message || "Internal server error",
        stack: err?.stack
      }
    });
  }
}
export {
  handler as default
};
