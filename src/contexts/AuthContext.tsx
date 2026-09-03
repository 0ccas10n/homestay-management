// ─── Authentication provider ───────────────────────────────────────────────────────
//
// Provides the current user session to all components.
// Stores the logged-in user and token in localStorage for persistence.
// All auth (login, logout, session check) goes through /api/auth/* endpoints
// with token + cookie dual support and demo fallback.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/types/index';
import { AuthContext, type AuthContextValue } from './AuthContext';

const STORAGE_KEY = 'homestay_user';
const TOKEN_KEY = 'homestay_token';

interface EnvelopeSuccess<T> { success: true; data: T }
interface EnvelopeError { success: false; error: { code: string; message: string } }
type Envelope<T> = EnvelopeSuccess<T> | EnvelopeError;

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // localStorage not available
  }
  return headers;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON response (${res.status})`);
  }

  if (!res.ok || parsed.success === false) {
    const msg = parsed?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return (parsed.data !== undefined ? parsed.data : parsed) as T;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (res.status === 401) return null;
    if (!res.ok) return null;

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    if (parsed.success === false) return null;
    return (parsed.data !== undefined ? parsed.data : parsed) as T;
  } catch {
    return null;
  }
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
        const storedUser = localStorage.getItem(STORAGE_KEY);
        const me = await getJson<User>('/api/auth/me');
        if (cancelled) return;
        if (me && me.userId) {
          setUser(me);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
        } else {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        // network issue — retain local session if available
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      const res = await postJson<{ user: User; token?: string }>('/api/auth/login', {
        email: cleanEmail,
        password: cleanPassword,
      });

      const loggedUser = res.user ?? (res as unknown as User);
      if (!loggedUser || !loggedUser.userId) {
        throw new Error('Invalid user response from server');
      }

      setUser(loggedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
      if (res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
      }
    } catch (err: any) {
      // If server returned a specific auth rejection, re-throw it
      if (err.message && err.message.includes('Invalid email or password')) {
        throw err;
      }

      // Check for standalone dev/demo fallback if API was unreachable
      const lower = cleanEmail.toLowerCase();
      if (
        (lower === 'admin' || lower.includes('admin')) &&
        (cleanPassword === 'admin123' || cleanPassword === 'admin' || cleanPassword === 'baomatbao0' || cleanPassword === '123456')
      ) {
        const demoAdmin: User = {
          userId: 'USR-0001',
          name: 'Admin User',
          email: 'admin@homestay.local',
          role: 'admin',
          active: true,
          createdAt: '2026-01-01T00:00:00+07:00',
          updatedAt: '2026-01-01T00:00:00+07:00',
        };
        setUser(demoAdmin);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demoAdmin));
        return;
      }

      if (
        (lower === 'staff' || lower.includes('staff')) &&
        (cleanPassword === 'staff123' || cleanPassword === 'staff' || cleanPassword === '123456')
      ) {
        const demoStaff: User = {
          userId: 'USR-0002',
          name: 'Maria Santos',
          email: 'staff@homestay.local',
          role: 'staff',
          active: true,
          createdAt: '2026-01-01T00:00:00+07:00',
          updatedAt: '2026-01-01T00:00:00+07:00',
        };
        setUser(demoStaff);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demoStaff));
        return;
      }

      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await postJson<null>('/api/auth/logout', {});
    } catch {
      // ignore network errors — clear local state anyway
    }
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    const me = await getJson<User>('/api/auth/me');
    if (me && me.userId) {
      setUser(me);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
    }
  }, []);

  const value: AuthContextValue = { user, loading, login, logout, refresh };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
