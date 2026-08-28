// ─── AuthContext declaration ───────────────────────────────────────────────────────
//
// The Context object is exported here (not from AuthContext.tsx) so that file
// can export only the AuthProvider component — this lets Vite Fast Refresh
// treat each module as a component-only unit and avoid full-page reloads.
//
// ──────────────────────────────────────────────────────────────────────────────

import { createContext } from 'react';
import type { User } from '@/types/index';

export interface AuthContextValue {
  user: User | null;
  /** True while checking session on mount */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch the current user from the server (e.g. after 401 retry). */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
