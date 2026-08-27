// ─── useNotifications ────────────────────────────────────────────────────────────
//
// Fetches notifications and handles mark-read / mark-all-read actions.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { notificationsApi } from '@/services/api';
import type { Notification } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationsApi.getAll();
      setNotifications(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.notificationId === id ? { ...n, read: true } : n),
    );
    try {
      await notificationsApi.markRead(id);
    } catch {
      // Revert on failure
      setNotifications(prev =>
        prev.map(n => n.notificationId === id ? { ...n, read: false } : n),
      );
      throw new Error('Failed to mark notification as read');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const prev = [...notifications];
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      setNotifications(prev => prev); // revert
      throw new Error('Failed to mark all as read');
    }
  }, [notifications]);

  return { notifications, loading, error, refetch, markRead, markAllRead };
}
