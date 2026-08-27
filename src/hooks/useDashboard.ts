// ─── useDashboard ──────────────────────────────────────────────────────────────────
//
// Fetches the server-computed dashboard summary from the API.
// Polls every 60 seconds to keep data fresh without a full refresh.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/services/api';
import { ApiError } from '@/services/api';

export interface DashboardData {
  todayCheckIns: number;
  todayCheckOuts: number;
  availableRooms: number;
  occupiedRooms: number;
  roomsToClean: number;
  upcomingBookings: {
    bookingId: string;
    roomId: string;
    checkInAt: string;
    expectedCheckOutAt: string;
    status: string;
  }[];
}

const POLL_INTERVAL_MS = 60_000;

interface UseDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await dashboardApi.get();
      setData(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  return { data, loading, error, refetch };
}
