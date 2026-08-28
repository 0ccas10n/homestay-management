// ─── Authentication provider ───────────────────────────────────────────────────────
//
// Provides the current user session to all components.
// Stores the logged-in user in localStorage for persistence across page reloads.
// All auth (login, logout, session check) goes through the real /api/auth/* endpoints.
//
// Usage in components:
//   import { useAuth } from '@/contexts/useAuth';
//   const { user, login, logout, loading } = useAuth();
//
// Usage to protect a route:
//   const { loading } = useAuth();
//   if (loading) return <Spinner />;
//   if (!user) return <Navigate to="/login" />;
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/types/index';
import { AuthContext, type AuthContextValue } from './AuthContext';

const STORAGE_KEY = 'homestay_user';

interface EnvelopeSuccess<T> { success: true; data: T }
interface EnvelopeError { success: false; error: { code: string; message: string } }
type Envelope<T> = EnvelopeSuccess<T> | EnvelopeError;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || parsed.success === false) {
    const err = parsed as EnvelopeError;
    throw new Error(err.error?.message ?? `Request failed (${res.status})`);
  }
  return (parsed as EnvelopeSuccess<T>).data;
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: 'include' });
  if (res.status === 401) return null;
  const parsed = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || parsed.success === false) return null;
  return (parsed as EnvelopeSuccess<T>).data;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Verify the stored session against the server on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getJson<User>('/api/auth/me');
        if (cancelled) return;
        if (me) {
          setUser(me);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
        } else {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await postJson<{ user: User }>('/api/auth/login', { email, password });
    setUser(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, []);

  const logout = useCallback(async () => {
    try {
      await postJson<null>('/api/auth/logout', {});
    } catch {
      // ignore network errors — clear local state anyway
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const me = await getJson<User>('/api/auth/me');
    setUser(me);
    if (me) localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AuthContextValue = { user, loading, login, logout, refresh };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
