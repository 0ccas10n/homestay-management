// ─── useAuth hook ─────────────────────────────────────────────────────────────────
//
// Lives in its own file so the AuthProvider module only exports the component,
// which keeps Vite's Fast Refresh happy (HMR requires components-only exports).
//
// ──────────────────────────────────────────────────────────────────────────────

import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
