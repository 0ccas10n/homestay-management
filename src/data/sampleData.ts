// ─── Shared type exports ─────────────────────────────────────────────────────────
// Re-export canonical types for use throughout the app.
export type {
  RoomStatus,
  BookingStatus,
  CleaningStatus,
  CleaningPriority,
  NotificationType,
  NotificationPriority,
  ApiSuccess,
  ApiError,
  ApiResponse,
} from '../types/index';

// ─── Rooms ─────────────────────────────────────────────────────────────────────

import type { Room, RoomStatus } from '../types/index';

// All monetary values are in Vietnamese Dong (VND).
// priceDisplay is a Vietnamese-locale string for UI rendering.
export const rooms: Room[] = [
  { roomId: 'ROOM-0001', locationId: 'LOC-0001', name: 'Hiên 1', description: 'Phòng Standard — 1 giường đôi + 1 giường đơn (tối đa 4 khách)', capacity: 4, priceDisplay: 'Từ 350.000 ₫/đêm', status: 'occupied',     active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0002', locationId: 'LOC-0001', name: 'Hiên 2', description: 'Phòng Standard — 1 giường đôi + 1 giường đơn (tối đa 4 khách)', capacity: 4, priceDisplay: 'Từ 350.000 ₫/đêm', status: 'available',    active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0003', locationId: 'LOC-0001', name: 'Hiên 3', description: 'Phòng Standard — 1 giường đôi + 1 giường đơn (tối đa 4 khách)', capacity: 4, priceDisplay: 'Từ 350.000 ₫/đêm', status: 'cleaning',     active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'], notes: 'AC unit needs repair', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0004', locationId: 'LOC-0001', name: 'Yên 1', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'available',    active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0005', locationId: 'LOC-0001', name: 'Yên 2', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied',     active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0006', locationId: 'LOC-0001', name: 'Yên 3', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied',     active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công', 'Bếp'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0007', locationId: 'LOC-0001', name: 'Yên 4', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'maintenance',  active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'], notes: 'AC unit needs repair', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0008', locationId: 'LOC-0001', name: 'Yên 5', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'available',    active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0009', locationId: 'LOC-0001', name: 'Yên 6', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'available',    active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công', 'Bếp'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0010', locationId: 'LOC-0001', name: 'Yên 7', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied',     active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0011', locationId: 'LOC-0001', name: 'Yên 8', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'cleaning',     active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0012', locationId: 'LOC-0001', name: 'Yên 9', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn (tối đa 5 khách)',  capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied',     active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công', 'Bếp', 'Jacuzzi'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
];

// ─── Customers ──────────────────────────────────────────────────────────────────

import type { Customer } from '../types/index';

export const customers: Customer[] = [
  { customerId: 'CUS-0001', name: 'Nadia Okonkwo',     source: 'FACEBOOK',  email: 'nadia.okonkwo@gmail.com',      note: 'Prefers high floor rooms', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0002', name: 'Marcus Chen',        source: 'INSTAGRAM', email: 'marcus.chen@outlook.com',     createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0003', name: 'Elena Vasquez',     source: 'TIKTOK',   email: 'elena.v@gmail.com',           createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0004', name: 'James Whitfield',   source: 'ZALO',     email: 'j.whitfield@company.com',     note: 'Business traveler, early check-in requested', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0005', name: 'Aisha Rahman',      source: 'FACEBOOK', email: 'aisha.r@yahoo.com',          createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0006', name: 'Tomás Eriksson',    source: 'INSTAGRAM',email: 'tomas.e@hotmail.com',        createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0007', name: 'Priya Sharma',       source: 'TIKTOK',   email: 'priya.s@gmail.com',          createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0008', name: 'Carlos Mendes',     source: 'ZALO',     email: 'carlos.m@gmail.com',        createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
];

// ─── Bookings (datetime model) ─────────────────────────────────────────────────

import type { Booking } from '../types/index';

// All amounts are in VND.
export const bookings: Booking[] = [
  {
    bookingId: 'BOOK-0001', roomId: 'ROOM-0001', customerId: 'CUS-0001',
    guestName: 'Nadia Okonkwo',
    checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-10T12:00:00+07:00',
    status: 'checked_in', ratePlanId: 'RP-0004',
    bookingType: 'daily',
    expectedDurationMinutes: 4300, baseAmount: 1_650_000, totalAmount: 1_650_000,
    numGuests: 2, note: '', createdBy: 'USR-0001',
    createdAt: '2026-08-05T10:00:00+07:00', updatedAt: '2026-08-07T14:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0002', roomId: 'ROOM-0005', customerId: 'CUS-0002',
    guestName: 'Marcus Chen',
    checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-09T12:00:00+07:00',
    status: 'checked_in', ratePlanId: 'RP-0004',
    bookingType: 'daily',
    expectedDurationMinutes: 2580, baseAmount: 1_300_000, totalAmount: 1_300_000,
    numGuests: 3, createdBy: 'USR-0001',
    createdAt: '2026-08-04T09:00:00+07:00', updatedAt: '2026-08-07T15:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0003', roomId: 'ROOM-0006', customerId: 'CUS-0003',
    guestName: 'Elena Vasquez',
    checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-12T12:00:00+07:00',
    status: 'checked_in', ratePlanId: 'RP-0004',
    bookingType: 'daily',
    expectedDurationMinutes: 7180, baseAmount: 2_600_000, totalAmount: 2_600_000,
    numGuests: 2, createdBy: 'USR-0002',
    createdAt: '2026-08-01T08:00:00+07:00', updatedAt: '2026-08-07T14:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0004', roomId: 'ROOM-0010', customerId: 'CUS-0004',
    guestName: 'James Whitfield',
    checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-08T12:00:00+07:00',
    status: 'checked_in', ratePlanId: 'RP-0002',
    bookingType: 'daily',
    expectedDurationMinutes: 1420, baseAmount: 450_000, totalAmount: 450_000,
    numGuests: 1, createdBy: 'USR-0001',
    createdAt: '2026-08-06T11:00:00+07:00', updatedAt: '2026-08-07T14:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0005', roomId: 'ROOM-0012', customerId: 'CUS-0005',
    guestName: 'Aisha Rahman',
    checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00',
    status: 'checked_in', ratePlanId: 'RP-0004',
    bookingType: 'daily',
    expectedDurationMinutes: 5700, baseAmount: 2_300_000, totalAmount: 2_300_000,
    numGuests: 4, createdBy: 'USR-0002',
    createdAt: '2026-08-03T14:00:00+07:00', updatedAt: '2026-08-07T15:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0006', roomId: 'ROOM-0002', customerId: 'CUS-0006',
    guestName: 'Tomás Eriksson',
    checkInAt: '2026-08-08T14:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00',
    status: 'confirmed', ratePlanId: 'RP-0003',
    bookingType: 'daily',
    expectedDurationMinutes: 4300, baseAmount: 800_000, totalAmount: 800_000,
    numGuests: 2, createdBy: 'USR-0001',
    createdAt: '2026-08-06T16:00:00+07:00', updatedAt: '2026-08-06T16:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0007', roomId: 'ROOM-0008', customerId: 'CUS-0007',
    guestName: 'Priya Sharma',
    checkInAt: '2026-08-09T14:00:00+07:00', expectedCheckOutAt: '2026-08-14T12:00:00+07:00',
    status: 'confirmed', ratePlanId: 'RP-0004',
    bookingType: 'daily',
    expectedDurationMinutes: 7180, baseAmount: 2_475_000, totalAmount: 2_475_000,
    numGuests: 2, createdBy: 'USR-0001',
    createdAt: '2026-08-05T10:30:00+07:00', updatedAt: '2026-08-05T10:30:00+07:00',
  },
  {
    bookingId: 'BOOK-0008', roomId: 'ROOM-0009', customerId: 'CUS-0008',
    guestName: 'Carlos Mendes',
    checkInAt: '2026-08-10T14:00:00+07:00', expectedCheckOutAt: '2026-08-13T12:00:00+07:00',
    status: 'confirmed', ratePlanId: 'RP-0003',
    bookingType: 'daily',
    expectedDurationMinutes: 4300, baseAmount: 1_200_000, totalAmount: 1_200_000,
    numGuests: 3, createdBy: 'USR-0002',
    createdAt: '2026-08-04T13:00:00+07:00', updatedAt: '2026-08-04T13:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0009', roomId: 'ROOM-0005', customerId: 'CUS-0001',
    guestName: 'Nadia Okonkwo',
    checkInAt: '2026-08-14T14:00:00+07:00', expectedCheckOutAt: '2026-08-16T12:00:00+07:00',
    status: 'confirmed', ratePlanId: 'RP-0003',
    bookingType: 'daily',
    expectedDurationMinutes: 2860, baseAmount: 1_000_000, totalAmount: 1_000_000,
    numGuests: 2, createdBy: 'USR-0001',
    createdAt: '2026-08-07T08:00:00+07:00', updatedAt: '2026-08-07T08:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0010', roomId: 'ROOM-0003', customerId: 'CUS-0004',
    guestName: 'James Whitfield',
    checkInAt: '2026-07-30T14:00:00+07:00', expectedCheckOutAt: '2026-08-02T12:00:00+07:00',
    actualCheckOutAt: '2026-08-02T11:30:00+07:00',
    status: 'checked_out', ratePlanId: 'RP-0003',
    bookingType: 'daily',
    expectedDurationMinutes: 4300, baseAmount: 1_200_000, overtimeMinutes: 0, overtimeAmount: 0, totalAmount: 1_200_000,
    numGuests: 1, createdBy: 'USR-0001',
    createdAt: '2026-07-28T09:00:00+07:00', updatedAt: '2026-08-02T11:30:00+07:00',
  },
];

// ─── Cleaning Tasks (datetime model) ────────────────────────────────────────────

import type { CleaningTask } from '../types/index';

export const cleaningTasks: CleaningTask[] = [
  {
    cleaningId: 'CLN-0001', roomId: 'ROOM-0003', bookingId: 'BOOK-0010',
    scheduledAt: '2026-08-02T12:00:00+07:00',
    status: 'pending', priority: 'high',
    note: 'After James Whitfield checkout; next guest Priya Sharma arrives Aug 9',
    createdAt: '2026-08-02T11:30:00+07:00', updatedAt: '2026-08-02T11:30:00+07:00',
  },
  {
    cleaningId: 'CLN-0002', roomId: 'ROOM-0011', bookingId: undefined,
    scheduledAt: '2026-08-08T12:00:00+07:00',
    status: 'in_progress', priority: 'high',
    assignedTo: 'Maria Santos',
    startedAt: '2026-08-07T09:30:00+07:00',
    note: 'After Carlos Mendes checkout; next guest TBD',
    createdAt: '2026-08-07T09:00:00+07:00', updatedAt: '2026-08-07T09:30:00+07:00',
  },
  {
    cleaningId: 'CLN-0003', roomId: 'ROOM-0004', bookingId: undefined,
    scheduledAt: '2026-08-05T12:00:00+07:00',
    status: 'pending', priority: 'medium',
    createdAt: '2026-08-05T12:00:00+07:00', updatedAt: '2026-08-05T12:00:00+07:00',
  },
  {
    cleaningId: 'CLN-0004', roomId: 'ROOM-0009', bookingId: 'BOOK-0008',
    scheduledAt: '2026-08-13T12:00:00+07:00',
    status: 'pending', priority: 'medium',
    note: 'After Carlos Mendes checkout',
    createdAt: '2026-08-07T10:00:00+07:00', updatedAt: '2026-08-07T10:00:00+07:00',
  },
];

// ─── Expenses ──────────────────────────────────────────────────────────────────

import type { Expense } from '../types/index';

// All amounts in VND. Range targets: 100,000 ₫ – 5,000,000 ₫ per expense.
export const expenses: Expense[] = [
  { expenseId: 'EXP-0001', category: 'Cleaning Supplies', amount: 1_455_000, date: '2026-08-01', description: 'Monthly cleaning supplies restock',       vendor: 'Clean Pro Supplies', createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0002', category: 'Electricity',      amount: 3_800_000, date: '2026-08-01', description: 'July electricity bill',                    vendor: 'City Power Co.',    createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0003', category: 'Water',            amount:   950_000, date: '2026-08-01', description: 'July water bill',                          vendor: 'Municipal Water',   createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0004', category: 'Internet',         amount:   450_000, date: '2026-08-01', description: 'Monthly fiber broadband',                  vendor: 'FiberNet ISP',      createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0005', category: 'Staff',            amount: 4_800_000, date: '2026-08-05', description: 'Weekly staff wages',                       vendor: 'Payroll',           createdAt: '2026-08-05T00:00:00+07:00', updatedAt: '2026-08-05T00:00:00+07:00' },
  { expenseId: 'EXP-0006', category: 'Repairs',          amount: 2_200_000, date: '2026-08-06', description: 'AC unit repair — Yên 4',                  vendor: 'CoolTech HVAC',     createdAt: '2026-08-06T00:00:00+07:00', updatedAt: '2026-08-06T00:00:00+07:00' },
  { expenseId: 'EXP-0007', category: 'Cleaning Supplies', amount:   623_000, date: '2026-08-06', description: 'Additional toiletries order',              vendor: 'Clean Pro Supplies', createdAt: '2026-08-06T00:00:00+07:00', updatedAt: '2026-08-06T00:00:00+07:00' },
  { expenseId: 'EXP-0008', category: 'Other',            amount:   350_000, date: '2026-08-07', description: 'Welcome fruit baskets',                    vendor: 'Local Market',      createdAt: '2026-08-07T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
];

// ─── Notifications ─────────────────────────────────────────────────────────────

import type { Notification } from '../types/index';

export const notifications: Notification[] = [
  { notificationId: 'NOT-0001', type: 'check_in',    title: 'Check-in Today',       message: 'Tomás Eriksson arriving for Hiên 2 at 2:00 PM',          time: '2026-08-07T12:00:00+07:00', read: false, priority: 'high',   relatedBookingId: 'BOOK-0006', relatedRoomId: 'ROOM-0002' },
  { notificationId: 'NOT-0002', type: 'check_out',   title: 'Check-out Today',      message: 'James Whitfield (Yên 7) checks out today by 11 AM',       time: '2026-08-07T08:00:00+07:00', read: false, priority: 'high',   relatedBookingId: 'BOOK-0004', relatedRoomId: 'ROOM-0010' },
  { notificationId: 'NOT-0003', type: 'cleaning',     title: 'Urgent Cleaning',       message: 'Hiên 3 needs cleaning — next guest arrives Aug 9',         time: '2026-08-07T07:30:00+07:00', read: false, priority: 'high',   relatedRoomId: 'ROOM-0003' },
  { notificationId: 'NOT-0004', type: 'payment',     title: 'Payment Pending',       message: 'Nadia Okonkwo has an outstanding balance of 95.000 ₫',    time: '2026-08-07T06:00:00+07:00', read: false, priority: 'medium', relatedBookingId: 'BOOK-0001' },
  { notificationId: 'NOT-0005', type: 'cleaning',     title: 'Yên 8 In Progress',    message: 'Maria Santos started cleaning Yên 8',                      time: '2026-08-07T09:30:00+07:00', read: true,  priority: 'low',    relatedRoomId: 'ROOM-0011' },
  { notificationId: 'NOT-0006', type: 'check_in',    title: 'Upcoming Check-in',    message: 'Priya Sharma arriving Aug 9 for Yên 5',                     time: '2026-08-06T10:00:00+07:00', read: true,  priority: 'low',    relatedBookingId: 'BOOK-0007', relatedRoomId: 'ROOM-0008' },
  { notificationId: 'NOT-0007', type: 'maintenance',  title: 'Maintenance Alert',    message: 'Yên 4 AC still out of service',                            time: '2026-08-05T08:00:00+07:00', read: true,  priority: 'medium', relatedRoomId: 'ROOM-0007' },
];

// ─── Locations ─────────────────────────────────────────────────────────────────

import type { Location } from '../types/index';

export const locations: Location[] = [
  { locationId: 'LOC-0001', name: 'Bình Lợi Trung', description: 'Cụm homestay Bình Lợi Trung', publicAddress: 'Bình Lợi Trung, Bình Chánh, Hồ Chí Minh', phone: '+84 28 0000 0001', active: true, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-01-01T00:00:00+07:00' },
];

// ─── Rate Plans ─────────────────────────────────────────────────────────────────

import type { RatePlan } from '../types/index';

// 4 standard rate plans aligned with scripts/seedData.ts and hourlyData.ts.
// Pricing is stored per-room in the RatePlanPrices sheet (see
// src/lib/google-sheets/client.ts and scripts/seedData.ts).
export const ratePlans: RatePlan[] = [
  { ratePlanId: 'RP-0001', name: 'Combo 4H',   type: 'hourly',    baseMinutes: 240,  baseAmount: 250_000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0002', name: 'Combo 6H',   type: 'hourly',    baseMinutes: 360,  baseAmount: 350_000, extraMinutePrice: 0, overtimeMinutePrice: 0, active: true },
  { ratePlanId: 'RP-0003', name: 'Overnight',  type: 'overnight', baseMinutes: 780,  baseAmount: 400_000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '21:00', overnightEnd: '10:00', active: true },
  { ratePlanId: 'RP-0004', name: 'Full Day',   type: 'daily',     baseMinutes: 1320, baseAmount: 550_000, extraMinutePrice: 0, overtimeMinutePrice: 0, overnightStart: '14:00', overnightEnd: '12:00', active: true },
];

// ─── Chart / report data ────────────────────────────────────────────────────────

// All values in VND. Range targets: monthly revenue 15,000,000 ₫ – 50,000,000 ₫.
export const revenueData = [
  { month: 'Mar', revenue: 17_840_000, expenses: 8_100_000 },
  { month: 'Apr', revenue: 19_620_000, expenses: 8_300_000 },
  { month: 'May', revenue: 22_100_000, expenses: 8_650_000 },
  { month: 'Jun', revenue: 28_400_000, expenses: 9_240_000 },
  { month: 'Jul', revenue: 32_450_000, expenses: 9_680_000 },
  { month: 'Aug', revenue: 24_340_000, expenses: 9_248_000 },
];

export const occupancyData = [
  { day: 'Mon', rate: 75 },
  { day: 'Tue', rate: 83 },
  { day: 'Wed', rate: 92 },
  { day: 'Thu', rate: 67 },
  { day: 'Fri', rate: 100 },
  { day: 'Sat', rate: 100 },
  { day: 'Sun', rate: 58 },
];

// Expense breakdown in VND.
export const expenseByCategory = [
  { name: 'Staff',       value: 4_800_000 },
  { name: 'Electricity', value: 3_800_000 },
  { name: 'Cleaning',    value: 2_078_000 },
  { name: 'Repairs',     value: 2_200_000 },
  { name: 'Water',       value:   950_000 },
  { name: 'Internet',    value:   450_000 },
  { name: 'Other',       value:   350_000 },
];