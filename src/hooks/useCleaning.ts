// ─── useCleaning ──────────────────────────────────────────────────────────────────
//
// Fetches and manages cleaning tasks from the API.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import { cleaningApi } from '@/services/api';
import type { CleaningTask, CleaningStatus } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseCleaningOptions {
  autoFetch?: boolean;
}

interface UseCleaningReturn {
  tasks: CleaningTask[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTask: (data: Parameters<typeof cleaningApi.create>[0]) => Promise<CleaningTask>;
  transition: (id: string, status: CleaningStatus) => Promise<void>;
}

export function useCleaning(options?: UseCleaningOptions): UseCleaningReturn {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cleaningApi.get();
      setTasks(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load cleaning tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.autoFetch !== false) {
      refetch().catch(() => {});
    }
  }, [refetch, options?.autoFetch]);

  const createTask = useCallback(async (data: Parameters<typeof cleaningApi.create>[0]) => {
    const created = await cleaningApi.create(data);
    setTasks(prev => [...prev, created]);
    return created;
  }, []);

  const transition = useCallback(async (id: string, status: CleaningStatus) => {
    const updated = await cleaningApi.transition(id, { status });
    setTasks(prev => prev.map(t => t.cleaningId === id ? updated : t));
  }, []);

  return { tasks, loading, error, refetch, createTask, transition };
}
