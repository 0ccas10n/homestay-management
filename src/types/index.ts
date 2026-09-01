// ─── Core shared types ──────────────────────────────────────────────────────────
// These types align with docs/DATABASE.md and docs/API.md.
// All datetime fields use ISO 8601 strings with explicit timezone offset.
// ──────────────────────────────────────────────────────────────────────────────

// ─── Location ──────────────────────────────────────────────────────────────────

export interface Location {
  locationId: string;
  name: string;
  description?: string;
  publicAddress?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export type RoomStatus =
  | 'available'
  | 'occupied'
  | 'cleaning'
  | 'needs_cleaning'
  | 'maintenance'
  | 'inactive';

export interface Room {
  roomId: string;
  locationId: string;
  name: string;
  description?: string;
  capacity: number;
  priceDisplay?: string;
  status: RoomStatus;
  active: boolean;
  imageUrl?: string;
  floor?: number;
  amenities?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export type BookingSource = 'INSTAGRAM' | 'TIKTOK' | 'ZALO' | 'FACEBOOK' | 'KHÁC';


export interface Customer {
  customerId: string;
  /** Guest display name. Captured from the booking form's Guest Name field. */
  name?: string;
  source?: BookingSource;
  email?: string;
  /** Optional contact phone. Stored in the same Notes column for now until a
   * dedicated phone column is added to the Customers sheet. */
  phone?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Booking ───────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'inquiry'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

/**
 * Booking cadence selected by the receptionist at creation time.
 *
 *  - 'daily'  → price comes from RatePlanPrices (auto-calculated by the server).
 *  - 'hourly' → price is supplied manually in the `totalAmount` field and the
 *               server bypasses RatePlanPrices for this booking.
 */
export type BookingType = 'daily' | 'hourly';

export interface Booking {
  bookingId: string;
  roomId: string;
  customerId: string;
  guestName: string;
  checkInAt: string;          // ISO 8601, e.g. "2026-08-28T14:00:00+07:00"
  expectedCheckOutAt: string; // ISO 8601
  actualCheckOutAt?: string;  // Recorded at departure; undefined until checked out
  status: BookingStatus;
  ratePlanId: string;
  /** Cadence selected at creation: 'daily' (auto-priced) or 'hourly' (manual price). */
  bookingType: BookingType;
  expectedDurationMinutes: number;
  baseAmount: number;
  overtimeMinutes?: number;
  overtimeAmount?: number;
  totalAmount: number;
  /**
   * Snapshot of the per-night VND price (from RatePlanPrices.priceVnd) at the
   * moment this booking was created. Stored on the row so historical reports
   * stay accurate even if RatePlanPrices changes later. For hourly bookings
   * this stores the manual totalAmount as the snapshot (it's the only price
   * that applies to the entire stay).
   */
  unitPriceAtBooking?: number;
  numGuests?: number;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Rate Plan ─────────────────────────────────────────────────────────────────

export type RatePlanType = 'hourly' | 'overnight' | 'daily';

export interface RatePlan {
  ratePlanId: string;
  name: string;
  type: RatePlanType;
  /** Minutes included in the base charge */
  baseMinutes: number;
  /** Charge for the base period */
  baseAmount: number;
  /** Charge per extra minute beyond baseMinutes */
  extraMinutePrice: number;
  /** Charge per minute past expectedCheckOutAt (overtime) */
  overtimeMinutePrice: number;
  /** For overnight plans: window start time, e.g. "22:00" (HH:MM, local) */
  overnightStart?: string;
  /** For overnight plans: window end time, e.g. "10:00" */
  overnightEnd?: string;
  active: boolean;
}

/**
 * Per-room, per-rate-plan pricing.
 * The authoritative source of truth for the VND price of a (room, rate plan)
 * combination. Overrides the abstract baseAmount / extraMinutePrice on the
 * RatePlan when this row exists.
 */
export interface RatePlanPrice {
  ratePlanPriceId: string;
  ratePlanId: string;
  roomId: string;
  /** Final price in Vietnamese Dong — never a derived calculation. */
  priceVnd: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Cleaning ─────────────────────────────────────────────────────────────────

export type CleaningStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type CleaningPriority = 'high' | 'medium' | 'low';

export interface CleaningTask {
  cleaningId: string;
  roomId: string;
  bookingId?: string;
  scheduledAt: string;   // ISO 8601 — driven by booking's expectedCheckOutAt
  status: CleaningStatus;
  priority: CleaningPriority;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole = 'staff' | 'admin';

export interface User {
  userId: string;
  name: string;
  email: string;
  // passwordHash is never exposed to the client
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense {
  expenseId: string;
  category: string;
  amount: number;
  date: string;  // ISO date string "YYYY-MM-DD"
  description: string;
  vendor?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'check_in'
  | 'check_out'
  | 'cleaning'
  | 'maintenance'
  | 'payment'
  | 'late';

export type NotificationPriority = 'high' | 'medium' | 'low';

export interface Notification {
  notificationId: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;   // ISO 8601
  read: boolean;
  priority: NotificationPriority;
  relatedBookingId?: string;
  relatedRoomId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── API response envelope ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
