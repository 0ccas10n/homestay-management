// ─── useBookings ───────────────────────────────────────────────────────────────────
//
// Fetches and manages bookings from the API.
// Handles optimistic updates for status transitions (check-in, cancel).
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { bookingsApi } from '@/services/api';
import type { Booking } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseBookingsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
}

interface UseBookingsReturn {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createBooking: (data: Parameters<typeof bookingsApi.create>[0]) => Promise<Booking>;
  updateBooking: (id: string, data: Parameters<typeof bookingsApi.update>[1]) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
}

export function useBookings(_options?: UseBookingsOptions): UseBookingsReturn {
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

  const createBooking = useCallback(async (data: Parameters<typeof bookingsApi.create>[0]) => {
    const created = await bookingsApi.create(data);
    setBookings(prev => [created, ...prev]);
    return created;
  }, []);

  const updateBooking = useCallback(async (id: string, data: Parameters<typeof bookingsApi.update>[1]) => {
    const updated = await bookingsApi.update(id, data);
    setBookings(prev => prev.map(b => b.bookingId === id ? updated : b));
  }, []);

  const cancelBooking = useCallback(async (id: string) => {
    const res = await bookingsApi.updateStatus(id, 'cancelled');
    setBookings(prev => prev.map(b =>
      b.bookingId === id ? res.booking : b,
    ));
  }, []);

  return { bookings, loading, error, refetch, createBooking, updateBooking, cancelBooking };
}
