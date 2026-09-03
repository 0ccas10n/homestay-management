// ─── useBookings ───────────────────────────────────────────────────────────────────
//
// Fetches and manages bookings from the API.
// Handles optimistic updates for status transitions (check-in, cancel).
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import { bookingsApi } from '@/services/api';
import type { Booking } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseBookingsOptions {
  /** Auto-fetch on mount. Default: true */
  autoFetch?: boolean;
}

interface UseBookingsReturn {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createBooking: (data: Parameters<typeof bookingsApi.create>[0]) => Promise<Booking>;
  updateBooking: (id: string, data: Parameters<typeof bookingsApi.update>[1]) => Promise<void>;
  /** Generic lifecycle transition — check-in, confirm, no-show, cancel, etc. */
  updateStatus: (id: string, status: Booking['status']) => Promise<void>;
  /** Records actualCheckOutAt, computes overtime server-side, and marks the room for cleaning. */
  checkOutBooking: (id: string, actualCheckOutAt?: string) => Promise<{ overtimeMinutes: number; overtimeAmount: number; message: string }>;
  cancelBooking: (id: string) => Promise<void>;
}

export function useBookings(options?: UseBookingsOptions): UseBookingsReturn {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingsApi.get();
      setBookings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.autoFetch !== false) {
      refetch().catch(() => {});
    }
  }, [refetch, options?.autoFetch]);

  const createBooking = useCallback(async (data: Parameters<typeof bookingsApi.create>[0]) => {
    const created = await bookingsApi.create(data);
    setBookings(prev => [created, ...prev]);
    return created;
  }, []);

  const updateBooking = useCallback(async (id: string, data: Parameters<typeof bookingsApi.update>[1]) => {
    const updated = await bookingsApi.update(id, data);
    setBookings(prev => prev.map(b => b.bookingId === id ? updated : b));
  }, []);

  const updateStatus = useCallback(async (id: string, status: Booking['status']) => {
    const booking = bookings.find(b => b.bookingId === id);
    if (booking) {
      const checkInTime = new Date(booking.checkInAt).getTime();
      const now = Date.now();
      const diffMins = (checkInTime - now) / 60000;
      
      if (status === 'checked_in' && diffMins > 120) {
        const hoursEarly = (diffMins / 60).toFixed(1);
        if (!window.confirm(`⚠️ Khách đang check-in SỚM ${hoursEarly} tiếng so với giờ dự kiến.\nBạn có chắc chắn muốn cho khách check-in sớm không?`)) {
          return false;
        }
      }
      
      if (status === 'no_show' && diffMins > -120) {
        if (!window.confirm(`⚠️ Chưa quá 2 tiếng kể từ giờ check-in dự kiến (hoặc chưa đến giờ).\nBạn có chắc chắn muốn đánh dấu No-show không?`)) {
          return false;
        }
      }
    }

    const res = await bookingsApi.updateStatus(id, status);
    setBookings(prev => prev.map(b =>
      b.bookingId === id ? res.booking : b,
    ));
    return true;
  }, [bookings]);

  const checkOutBooking = useCallback(async (id: string, actualCheckOutAt?: string) => {
    const res = await bookingsApi.checkout(id, actualCheckOutAt ?? new Date().toISOString());
    setBookings(prev => prev.map(b =>
      b.bookingId === id ? res.booking : b,
    ));
    return { overtimeMinutes: res.overtimeMinutes, overtimeAmount: res.overtimeAmount, message: res.message };
  }, []);

  const cancelBooking = useCallback(async (id: string) => {
    const res = await bookingsApi.updateStatus(id, 'cancelled');
    setBookings(prev => prev.map(b =>
      b.bookingId === id ? res.booking : b,
    ));
  }, []);

  return { bookings, loading, error, refetch, createBooking, updateBooking, updateStatus, checkOutBooking, cancelBooking };
}
