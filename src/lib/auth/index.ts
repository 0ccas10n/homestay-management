// ─── Auth layer barrel ────────────────────────────────────────────────────────────

export { createSessionCookie, destroySessionCookie, getSession, verifyToken }
  from './session';
export type { Session } from './session';

export { requireAuth, requireRole, optionalAuth } from './middleware';
