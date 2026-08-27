// ─── Authentication context ─────────────────────────────────────────────────────────
//
// Provides the current user session to all components.
// Stores the logged-in user in localStorage for persistence across page reloads.
// No server calls required — all auth is handled client-side.
//
// Usage in components:
//   const { user, login, logout, loading } = useAuth();
//
// Usage to protect a route:
//   const { loading } = useAuth();
//   if (loading) return <Spinner />;
//   if (!user) return <Navigate to="/login" />;
//
// This context is CLIENT-SIDE ONLY.
// ──────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@/types/index';

const STORAGE_KEY = 'homestay_user';

// Seeded admin credentials — must match .env SEED_ADMIN_PASSWORD
const SEED_ADMIN: User = {
  userId: 'USR-ADMIN-001',
  name: 'Admin',
  email: 'admin@homestay.local',
  role: 'admin',
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SEED_PASSWORD = 'baomatbao0';

interface AuthContextValue {
  user: User | null;
  /** True while checking session on mount */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored) as User);
      }
    } catch {
      // Corrupt storage — treat as logged out
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (email === SEED_ADMIN.email && password === SEED_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ADMIN));
      setUser(SEED_ADMIN);
      return;
    }
    throw new Error('Invalid email or password');
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
