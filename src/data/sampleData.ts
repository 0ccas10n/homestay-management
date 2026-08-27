// ─── Shared type exports ─────────────────────────────────────────────────────────
// Re-export canonical types for use throughout the app.
export type {
  RoomStatus,
  BookingStatus,
  BookingSource,
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

export const rooms: Room[] = [
  { roomId: 'ROOM-0001', locationId: 'LOC-0001', name: 'Room 101', description: 'Standard room, ground floor', capacity: 2, priceDisplay: '$65/night', status: 'occupied',      active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0002', locationId: 'LOC-0001', name: 'Room 102', description: 'Standard room, ground floor', capacity: 2, priceDisplay: '$65/night', status: 'available',     active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0003', locationId: 'LOC-0001', name: 'Room 103', description: 'Deluxe room with bathtub',    capacity: 3, priceDisplay: '$95/night', status: 'cleaning',      active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV', 'Bathtub'], notes: 'AC unit needs repair', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0004', locationId: 'LOC-0001', name: 'Room 104', description: 'Standard room, ground floor', capacity: 2, priceDisplay: '$65/night', status: 'available',     active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0005', locationId: 'LOC-0001', name: 'Room 201', description: 'Deluxe with balcony',         capacity: 3, priceDisplay: '$95/night', status: 'occupied',      active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bathtub', 'Balcony'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0006', locationId: 'LOC-0001', name: 'Room 202', description: 'Suite with kitchen',          capacity: 4, priceDisplay: '$145/night', status: 'occupied',     active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bathtub', 'Balcony', 'Kitchen'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0007', locationId: 'LOC-0001', name: 'Room 203', description: 'Standard, under maintenance', capacity: 2, priceDisplay: '$65/night', status: 'maintenance',  active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV'], notes: 'AC unit needs repair', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0008', locationId: 'LOC-0001', name: 'Room 204', description: 'Deluxe with bathtub',        capacity: 3, priceDisplay: '$95/night', status: 'available',     active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bathtub'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0009', locationId: 'LOC-0001', name: 'Room 301', description: 'Suite with kitchen',          capacity: 4, priceDisplay: '$145/night', status: 'available',     active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bathtub', 'Balcony', 'Kitchen'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0010', locationId: 'LOC-0001', name: 'Room 302', description: 'Deluxe with balcony',         capacity: 3, priceDisplay: '$95/night', status: 'occupied',      active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bathtub', 'Balcony'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0011', locationId: 'LOC-0001', name: 'Room 303', description: 'Standard room',              capacity: 2, priceDisplay: '$65/night', status: 'cleaning',      active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { roomId: 'ROOM-0012', locationId: 'LOC-0001', name: 'Room 304', description: 'Suite with jacuzzi',         capacity: 4, priceDisplay: '$145/night', status: 'occupied',      active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bathtub', 'Balcony', 'Kitchen', 'Jacuzzi'], createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
];

// ─── Customers ──────────────────────────────────────────────────────────────────

import type { Customer } from '../types/index';

export const customers: Customer[] = [
  { customerId: 'CUS-0001', name: 'Nadia Okonkwo',     phone: '+1 (415) 820-3341',    email: 'nadia.okonkwo@gmail.com',      nationality: 'Nigerian',        totalBookings: 4, note: 'Prefers high floor rooms', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0002', name: 'Marcus Chen',        phone: '+1 (650) 775-4422',    email: 'marcus.chen@outlook.com',     nationality: 'Chinese-American', totalBookings: 2, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0003', name: 'Elena Vasquez',       phone: '+34 612 334 891',     email: 'elena.v@gmail.com',           nationality: 'Spanish',          totalBookings: 1, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0004', name: 'James Whitfield',      phone: '+44 7700 900432',     email: 'j.whitfield@company.com',     nationality: 'British',         totalBookings: 7, note: 'Business traveler, early check-in requested', createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0005', name: 'Aisha Rahman',        phone: '+60 12-345-6789',    email: 'aisha.r@yahoo.com',          nationality: 'Malaysian',        totalBookings: 3, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0006', name: 'Tomás Eriksson',      phone: '+46 70 123 45 67',   email: 'tomas.e@hotmail.com',        nationality: 'Swedish',          totalBookings: 1, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0007', name: 'Priya Sharma',         phone: '+91 98765 43210',    email: 'priya.s@gmail.com',          nationality: 'Indian',           totalBookings: 2, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
  { customerId: 'CUS-0008', name: 'Carlos Mendes',        phone: '+55 11 9 8765-4321', email: 'carlos.m@gmail.com',        nationality: 'Brazilian',         totalBookings: 5, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
];

// ─── Bookings (datetime model) ─────────────────────────────────────────────────

import type { Booking } from '../types/index';

export const bookings: Booking[] = [
  {
    bookingId: 'BOOK-0001', roomId: 'ROOM-0001', customerId: 'CUS-0001',
    checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-10T12:00:00+07:00',
    status: 'checked_in', source: 'walk_in', ratePlanId: 'RP-0003',
    expectedDurationMinutes: 4300, baseAmount: 435, totalAmount: 435,
    numGuests: 2, note: '', createdBy: 'USR-0001',
    createdAt: '2026-08-05T10:00:00+07:00', updatedAt: '2026-08-07T14:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0002', roomId: 'ROOM-0005', customerId: 'CUS-0002',
    checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-09T12:00:00+07:00',
    status: 'checked_in', source: 'walk_in', ratePlanId: 'RP-0003',
    expectedDurationMinutes: 2580, baseAmount: 290, totalAmount: 290,
    numGuests: 3, createdBy: 'USR-0001',
    createdAt: '2026-08-04T09:00:00+07:00', updatedAt: '2026-08-07T15:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0003', roomId: 'ROOM-0006', customerId: 'CUS-0003',
    checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-12T12:00:00+07:00',
    status: 'checked_in', source: 'phone', ratePlanId: 'RP-0004',
    expectedDurationMinutes: 7180, baseAmount: 725, totalAmount: 725,
    numGuests: 2, createdBy: 'USR-0002',
    createdAt: '2026-08-01T08:00:00+07:00', updatedAt: '2026-08-07T14:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0004', roomId: 'ROOM-0010', customerId: 'CUS-0004',
    checkInAt: '2026-08-07T14:00:00+07:00', expectedCheckOutAt: '2026-08-08T12:00:00+07:00',
    status: 'checked_in', source: 'phone', ratePlanId: 'RP-0002',
    expectedDurationMinutes: 1420, baseAmount: 95, totalAmount: 95,
    numGuests: 1, createdBy: 'USR-0001',
    createdAt: '2026-08-06T11:00:00+07:00', updatedAt: '2026-08-07T14:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0005', roomId: 'ROOM-0012', customerId: 'CUS-0005',
    checkInAt: '2026-08-07T15:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00',
    status: 'checked_in', source: 'walk_in', ratePlanId: 'RP-0004',
    expectedDurationMinutes: 5700, baseAmount: 580, totalAmount: 580,
    numGuests: 4, createdBy: 'USR-0002',
    createdAt: '2026-08-03T14:00:00+07:00', updatedAt: '2026-08-07T15:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0006', roomId: 'ROOM-0002', customerId: 'CUS-0006',
    checkInAt: '2026-08-08T14:00:00+07:00', expectedCheckOutAt: '2026-08-11T12:00:00+07:00',
    status: 'confirmed', source: 'phone', ratePlanId: 'RP-0003',
    expectedDurationMinutes: 4300, baseAmount: 195, totalAmount: 195,
    numGuests: 2, createdBy: 'USR-0001',
    createdAt: '2026-08-06T16:00:00+07:00', updatedAt: '2026-08-06T16:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0007', roomId: 'ROOM-0008', customerId: 'CUS-0007',
    checkInAt: '2026-08-09T14:00:00+07:00', expectedCheckOutAt: '2026-08-14T12:00:00+07:00',
    status: 'confirmed', source: 'walk_in', ratePlanId: 'RP-0004',
    expectedDurationMinutes: 7180, baseAmount: 475, totalAmount: 475,
    numGuests: 2, createdBy: 'USR-0001',
    createdAt: '2026-08-05T10:30:00+07:00', updatedAt: '2026-08-05T10:30:00+07:00',
  },
  {
    bookingId: 'BOOK-0008', roomId: 'ROOM-0009', customerId: 'CUS-0008',
    checkInAt: '2026-08-10T14:00:00+07:00', expectedCheckOutAt: '2026-08-13T12:00:00+07:00',
    status: 'confirmed', source: 'phone', ratePlanId: 'RP-0003',
    expectedDurationMinutes: 4300, baseAmount: 435, totalAmount: 435,
    numGuests: 3, createdBy: 'USR-0002',
    createdAt: '2026-08-04T13:00:00+07:00', updatedAt: '2026-08-04T13:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0009', roomId: 'ROOM-0005', customerId: 'CUS-0001',
    checkInAt: '2026-08-14T14:00:00+07:00', expectedCheckOutAt: '2026-08-16T12:00:00+07:00',
    status: 'confirmed', source: 'walk_in', ratePlanId: 'RP-0003',
    expectedDurationMinutes: 2860, baseAmount: 190, totalAmount: 190,
    numGuests: 2, createdBy: 'USR-0001',
    createdAt: '2026-08-07T08:00:00+07:00', updatedAt: '2026-08-07T08:00:00+07:00',
  },
  {
    bookingId: 'BOOK-0010', roomId: 'ROOM-0003', customerId: 'CUS-0004',
    checkInAt: '2026-07-30T14:00:00+07:00', expectedCheckOutAt: '2026-08-02T12:00:00+07:00',
    actualCheckOutAt: '2026-08-02T11:30:00+07:00',
    status: 'checked_out', source: 'phone', ratePlanId: 'RP-0003',
    expectedDurationMinutes: 4300, baseAmount: 285, overtimeMinutes: 0, overtimeAmount: 0, totalAmount: 285,
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

export const expenses: Expense[] = [
  { expenseId: 'EXP-0001', category: 'Cleaning Supplies', amount: 145.50,  date: '2026-08-01', description: 'Monthly cleaning supplies restock',       vendor: 'Clean Pro Supplies', createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0002', category: 'Electricity',      amount: 380.00,  date: '2026-08-01', description: 'July electricity bill',                    vendor: 'City Power Co.',    createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0003', category: 'Water',            amount: 95.00,   date: '2026-08-01', description: 'July water bill',                           vendor: 'Municipal Water',  createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0004', category: 'Internet',         amount: 89.99,   date: '2026-08-01', description: 'Monthly fiber broadband',                  vendor: 'FiberNet ISP',      createdAt: '2026-08-01T00:00:00+07:00', updatedAt: '2026-08-01T00:00:00+07:00' },
  { expenseId: 'EXP-0005', category: 'Staff',            amount: 1200.00, date: '2026-08-05', description: 'Weekly staff wages',                      vendor: 'Payroll',           createdAt: '2026-08-05T00:00:00+07:00', updatedAt: '2026-08-05T00:00:00+07:00' },
  { expenseId: 'EXP-0006', category: 'Repairs',          amount: 220.00,  date: '2026-08-06', description: 'AC unit repair — Room 203',              vendor: 'CoolTech HVAC',     createdAt: '2026-08-06T00:00:00+07:00', updatedAt: '2026-08-06T00:00:00+07:00' },
  { expenseId: 'EXP-0007', category: 'Cleaning Supplies', amount: 62.30,  date: '2026-08-06', description: 'Additional toiletries order',              vendor: 'Clean Pro Supplies', createdAt: '2026-08-06T00:00:00+07:00', updatedAt: '2026-08-06T00:00:00+07:00' },
  { expenseId: 'EXP-0008', category: 'Other',            amount: 55.00,   date: '2026-08-07', description: 'Welcome fruit baskets',                    vendor: 'Local Market',      createdAt: '2026-08-07T00:00:00+07:00', updatedAt: '2026-08-07T00:00:00+07:00' },
];

// ─── Notifications ─────────────────────────────────────────────────────────────

import type { Notification } from '../types/index';

export const notifications: Notification[] = [
  { notificationId: 'NOT-0001', type: 'check_in',    title: 'Check-in Today',       message: 'Tomás Eriksson arriving for Room 102 at 2:00 PM',     time: '2026-08-07T12:00:00+07:00', read: false, priority: 'high',   relatedBookingId: 'BOOK-0006', relatedRoomId: 'ROOM-0002' },
  { notificationId: 'NOT-0002', type: 'check_out',   title: 'Check-out Today',      message: 'James Whitfield (Room 302) checks out today by 11 AM', time: '2026-08-07T08:00:00+07:00', read: false, priority: 'high',   relatedBookingId: 'BOOK-0004', relatedRoomId: 'ROOM-0010' },
  { notificationId: 'NOT-0003', type: 'cleaning',     title: 'Urgent Cleaning',       message: 'Room 103 needs cleaning — next guest arrives Aug 9',   time: '2026-08-07T07:30:00+07:00', read: false, priority: 'high',   relatedRoomId: 'ROOM-0003' },
  { notificationId: 'NOT-0004', type: 'payment',     title: 'Payment Pending',       message: 'Nadia Okonkwo has an outstanding balance of $95',     time: '2026-08-07T06:00:00+07:00', read: false, priority: 'medium', relatedBookingId: 'BOOK-0001' },
  { notificationId: 'NOT-0005', type: 'cleaning',     title: 'Room 303 In Progress', message: 'Maria Santos started cleaning Room 303',              time: '2026-08-07T09:30:00+07:00', read: true,  priority: 'low',    relatedRoomId: 'ROOM-0011' },
  { notificationId: 'NOT-0006', type: 'check_in',    title: 'Upcoming Check-in',    message: 'Priya Sharma arriving Aug 9 for Room 204',           time: '2026-08-06T10:00:00+07:00', read: true,  priority: 'low',    relatedBookingId: 'BOOK-0007', relatedRoomId: 'ROOM-0008' },
  { notificationId: 'NOT-0007', type: 'maintenance',  title: 'Maintenance Alert',    message: 'Room 203 AC still out of service',                  time: '2026-08-05T08:00:00+07:00', read: true,  priority: 'medium', relatedRoomId: 'ROOM-0007' },
];

// ─── Locations ─────────────────────────────────────────────────────────────────

import type { Location } from '../types/index';

export const locations: Location[] = [
  { locationId: 'LOC-0001', name: 'Downtown', description: 'Main downtown location', publicAddress: '123 Main St, District 1', phone: '+84 28 1234 5678', active: true, createdAt: '2026-01-01T00:00:00+07:00', updatedAt: '2026-01-01T00:00:00+07:00' },
];

// ─── Rate Plans ─────────────────────────────────────────────────────────────────

import type { RatePlan } from '../types/index';

export const ratePlans: RatePlan[] = [
  { ratePlanId: 'RP-0001', name: 'Quick Stay',  type: 'hourly',   baseMinutes: 120,  baseAmount: 25,  extraMinutePrice: 0.20, overtimeMinutePrice: 0.20, active: true },
  { ratePlanId: 'RP-0002', name: 'Short Stay',  type: 'hourly',   baseMinutes: 180,  baseAmount: 35,  extraMinutePrice: 0.17, overtimeMinutePrice: 0.17, active: true },
  { ratePlanId: 'RP-0003', name: 'Half Day',     type: 'hourly',   baseMinutes: 360,  baseAmount: 55,  extraMinutePrice: 0.15, overtimeMinutePrice: 0.15, active: true },
  { ratePlanId: 'RP-0004', name: 'Overnight',   type: 'overnight', baseMinutes: 720,  baseAmount: 55,  extraMinutePrice: 0.15, overtimeMinutePrice: 0.15, overnightStart: '22:00', overnightEnd: '10:00', active: true },
  { ratePlanId: 'RP-0005', name: 'Full Day',    type: 'daily',     baseMinutes: 1440, baseAmount: 65,  extraMinutePrice: 0.10, overtimeMinutePrice: 0.10, active: true },
];

// ─── Chart / report data ────────────────────────────────────────────────────────

export const revenueData = [
  { month: 'Mar', revenue: 7840,  expenses: 2100 },
  { month: 'Apr', revenue: 8620,  expenses: 2300 },
  { month: 'May', revenue: 9100,  expenses: 2150 },
  { month: 'Jun', revenue: 11200, expenses: 2400 },
  { month: 'Jul', revenue: 12450, expenses: 2680 },
  { month: 'Aug', revenue: 8340,  expenses: 2248 },
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

export const expenseByCategory = [
  { name: 'Staff',      value: 1200   },
  { name: 'Electricity', value: 380    },
  { name: 'Cleaning',   value: 207.80 },
  { name: 'Repairs',    value: 220    },
  { name: 'Water',      value: 95     },
  { name: 'Internet',   value: 89.99  },
  { name: 'Other',      value: 55     },
];
