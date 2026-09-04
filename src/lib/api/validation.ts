// ─── Shared Zod validation schemas ─────────────────────────────────────────────────
//
// All schemas here are used by both Vercel API route handlers and (optionally)
// by client-side form validation libraries.
//
// For schemas that differ between public/internal endpoints (e.g. rooms),
// define both variants in the same file and name them explicitly.
//
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { BookingStatus, CleaningStatus, RoomStatus, RatePlanType } from '@/types/index';
import { jsonValidationError } from './response';

// ─── Common primitives ───────────────────────────────────────────────────────────

/** ISO 8601 datetime string with timezone offset, e.g. "2026-08-28T14:00:00+07:00" */
export const isoDateTimeSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/,
  'Must be an ISO 8601 datetime with timezone offset',
);

/** "YYYY-MM-DD" date string */
export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Must be a date in YYYY-MM-DD format',
);

// ─── Auth ───────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

// ─── Rooms ──────────────────────────────────────────────────────────────────────

/** Public rooms — omits all internal/operational fields per API.md §6 */
export const publicRoomSchema = z.object({
  roomId:       z.string().min(1),
  locationId:   z.string().min(1),
  name:         z.string().min(1),
  description:  z.string().optional(),
  capacity:     z.number().int().min(1),
  imageUrl:     z.string().url().optional().or(z.literal('')),
});

export const createRoomSchema = z.object({
  locationId:  z.string().min(1, 'locationId is required'),
  name:        z.string().min(1, 'name is required').max(100),
  description: z.string().max(500).optional(),
  capacity:    z.number().int().min(1).max(50).default(2),
  priceDisplay: z.string().max(50).optional(),
  floor:       z.number().int().min(0).max(100).optional(),
  amenities:   z.array(z.string().max(50)).max(20).default([]),
  notes:       z.string().max(1000).optional(),
  imageUrl:    z.string().url().optional().or(z.literal('')),
  active:      z.boolean().default(true),
});

export const updateRoomSchema = z.object({
  name:         z.string().min(1).max(100).optional(),
  description:  z.string().max(500).optional(),
  capacity:     z.number().int().min(1).max(50).optional(),
  priceDisplay: z.string().max(50).optional(),
  status:       z.enum(['available', 'occupied', 'maintenance', 'cleaning', 'needs_cleaning', 'inactive']).optional(),
  active:       z.boolean().optional(),
  floor:        z.number().int().min(0).max(100).optional(),
  amenities:    z.array(z.string().max(50)).max(20).optional(),
  notes:        z.string().max(1000).optional(),
  imageUrl:     z.string().url().optional().or(z.literal('')),
});

// ─── Customers ───────────────────────────────────────────────────────────────────

export const upsertCustomerSchema = z.object({
  name:   z.string().min(1, 'customer.name is required').max(200).optional(),
  source: z.enum(['INSTAGRAM', 'TIKTOK', 'ZALO', 'FACEBOOK', 'KHÁC', 'KHAC'])
    .transform(val => (val === 'KHAC' ? 'KHÁC' : val))
    .optional(),
  email:  z.string().email().max(200).optional().or(z.literal('')),
  note:   z.string().max(1000).optional(),
});

// ─── Bookings ────────────────────────────────────────────────────────────────────

/** Sentinel ratePlanId used when the receptionist enters a custom hourly price. */
export const CUSTOM_RATE_PLAN_ID = 'custom';

export const createBookingSchema = z.object({
  roomId:              z.string().min(1, 'roomId is required'),
  guestName:           z.string().min(1, 'guestName is required').max(200),
  customer:             upsertCustomerSchema,
  checkInAt:           isoDateTimeSchema,
  expectedCheckOutAt:  isoDateTimeSchema,
  status:              z.enum(['inquiry', 'confirmed', 'cancelled', 'checked_in', 'checked_out']).default('confirmed'),
  ratePlanId:          z.string().min(1, 'ratePlanId is required'),
  /**
   * Cadence selected by the receptionist.
   *  - 'daily'  → server looks up RatePlanPrices (or the rate plan's base amount).
   *  - 'hourly' → server stores the supplied totalAmount verbatim and skips
   *               the RatePlanPrices lookup. totalAmount is required in this case.
   *
   * Defaults to 'daily' for backwards compatibility with older clients.
   */
  bookingType:         z.enum(['daily', 'hourly']).default('daily'),
  /** Required when bookingType === 'hourly'; ignored otherwise. */
  totalAmount:         z.number().nonnegative('totalAmount must be ≥ 0').optional(),
  depositAmount:       z.number().nonnegative().optional(),
  paidAmount:          z.number().nonnegative().optional(),
  paymentStatus:       z.enum(['unpaid', 'partial', 'paid']).optional(),
  extraServicesAmount: z.number().nonnegative().optional(),
  extraServicesNote:   z.string().max(500).optional(),
  numGuests:           z.number().int().min(1).max(20).optional(),
  note:                z.string().max(1000).optional(),
}).refine(
  data => new Date(data.checkInAt) < new Date(data.expectedCheckOutAt),
  { message: 'checkInAt must be before expectedCheckOutAt', path: ['expectedCheckOutAt'] },
).refine(
  data => data.bookingType !== 'hourly'
    || (data.totalAmount !== undefined && data.totalAmount > 0),
  { message: 'totalAmount is required for hourly bookings', path: ['totalAmount'] },
);

export const updateBookingSchema = z.object({
  status:              z.enum(['inquiry', 'confirmed', 'cancelled', 'checked_in', 'checked_out']).optional(),
  roomId:              z.string().min(1).optional(),
  guestName:           z.string().min(1).max(200).optional(),
  checkInAt:           isoDateTimeSchema.optional(),
  expectedCheckOutAt:  isoDateTimeSchema.optional(),
  ratePlanId:          z.string().min(1).optional(),
  numGuests:           z.number().int().min(1).max(20).optional(),
  actualCheckOutAt:    isoDateTimeSchema.optional(),
  depositAmount:       z.number().nonnegative().optional(),
  paidAmount:          z.number().nonnegative().optional(),
  paymentStatus:       z.enum(['unpaid', 'partial', 'paid']).optional(),
  extraServicesAmount: z.number().nonnegative().optional(),
  extraServicesNote:   z.string().max(500).optional(),
  totalAmount:         z.number().nonnegative().optional(),
  note:                z.string().max(1000).optional(),
});

/**
 * Body schema for PATCH /api/bookings/:id/status — the dedicated lifecycle
 * transition endpoint. Limited to a single `status` field so callers can't
 * accidentally mutate dates or pricing at the same time.
 */
export const updateBookingStatusSchema = z.object({
  status: z.enum(['inquiry', 'confirmed', 'cancelled', 'checked_in', 'checked_out', 'no_show']),
});

// ─── Availability ────────────────────────────────────────────────────────────────

export const availabilityQuerySchema = z.object({
  roomId:   z.string().min(1, 'roomId is required'),
  checkIn:  isoDateTimeSchema,
  checkOut: isoDateTimeSchema,
}).refine(
  data => new Date(data.checkIn) < new Date(data.checkOut),
  { message: 'checkIn must be before checkOut', path: ['checkOut'] },
);

// ─── Cleaning ────────────────────────────────────────────────────────────────────

export const createCleaningSchema = z.object({
  roomId:      z.string().min(1, 'roomId is required'),
  bookingId:   z.string().optional(),
  scheduledAt: isoDateTimeSchema,
  assignedTo:  z.string().min(1).optional(),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
  note:        z.string().max(500).optional(),
});

export const updateCleaningSchema = z.object({
  status:      z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  assignedTo:  z.string().min(1).optional(),
  scheduledAt: isoDateTimeSchema.optional(),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
  note:        z.string().max(500).optional(),
});

// ─── Expenses ────────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  category:    z.string().min(1, 'category is required').max(50),
  amount:      z.number().positive('amount must be positive'),
  date:        dateSchema,
  description: z.string().min(1, 'description is required').max(200),
  vendor:      z.string().max(100).optional(),
});

// ─── Helper: safe parse ──────────────────────────────────────────────────────────

/**
 * Parse a Zod schema and return the parsed value, or a 422 Response if invalid.
 * Use at the top of every route handler that accepts a body.
 *
 * @example
 * const parsed = parseBody(request, createBookingSchema);
 * if (parsed instanceof Response) return parsed;
 * // parsed is typed as the schema output
 */
export function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T | Response> {
  return request.json()
    .then(body => schema.safeParse(body))
    .then(result => {
      if (!result.success) {
        return jsonValidationError(result.error) as unknown as T | Response;
      }
      return result.data;
    })
    .catch(() => jsonValidationError({ issues: [{ path: ['body'], message: 'Invalid JSON body' }] }) as unknown as T | Response);
}

/**
 * Parse query string parameters with a Zod schema.
 * Returns the parsed object, or a 422 Response on failure.
 *
 * @example
 * const q = parseQuery(request.url, availabilityQuerySchema);
 * if (q instanceof Response) return q;
 */
export function parseQuery<T>(
  url: string,
  schema: z.ZodType<T>,
): T | Response {
  const params = Object.fromEntries(new URL(url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return jsonValidationError(result.error);
  }
  return result.data;
}
