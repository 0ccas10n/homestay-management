// ─── useRooms ──────────────────────────────────────────────────────────────────────
//
// Fetches and manages rooms from the API.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { roomsApi } from '@/services/api';
import type { Room } from '@/types/index';
import { ApiError } from '@/services/api';

interface UseRoomsReturn {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRoom: (data: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'>) => Promise<Room>;
  updateRoom: (id: string, data: Partial<Room>) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
}

export function useRooms(): UseRoomsReturn {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roomsApi.getInternal();
      setRooms(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoom = useCallback(async (data: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'>) => {
    const created = await roomsApi.create(data);
    setRooms(prev => [...prev, created]);
    return created;
  }, []);

  const updateRoom = useCallback(async (id: string, data: Partial<Room>) => {
    const updated = await roomsApi.update(id, data);
    setRooms(prev => prev.map(r => r.roomId === id ? updated : r));
  }, []);

  const deleteRoom = useCallback(async (id: string) => {
    await roomsApi.delete(id);
    setRooms(prev => prev.filter(r => r.roomId !== id));
  }, []);

  return { rooms, loading, error, refetch, createRoom, updateRoom, deleteRoom };
}
