// ─── Route-level authorization middleware ─────────────────────────────────────────
//
// These functions are used inside Vercel API route handlers to protect endpoints.
//
// Usage pattern (Vercel /api route handler):
//   export async function POST(request: Request) {
//     const session = await requireAuth(request);
//     if (session instanceof Response) return session; // auth failed — short-circuit
//     // ... handler logic, session is typed as Session
//   }
//
// Note: `requireRole` calls `requireAuth` internally, so you only need the outermost guard.
//
// All guards return a Response on failure (401 / 403) and a Session on success,
// so you can use `instanceof Response` to short-circuit with `return`.
//
// ──────────────────────────────────────────────────────────────────────────────

import { getSession, type Session } from './session';
import { jsonError } from '@/lib/api/response';

/**
 * Guard: requires a valid, non-expired session cookie.
 * Use in every protected endpoint.
 *
 * Returns `Session` on success, `Response(401)` on failure.
 */
export async function requireAuth(request: Request): Promise<Session | Response> {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return session;
}

/**
 * Guard: requires a valid session AND a specific role.
 * Use for endpoints restricted to `admin` (or any future role).
 *
 * Returns `Session` on success, `Response(401 | 403)` on failure.
 */
export async function requireRole(
  request: Request,
  role: 'admin' | 'staff',
): Promise<Session | Response> {
  const session = await requireAuth(request);
  if (session instanceof Response) return session; // 401 already

  if (session.role !== role) {
    return jsonError(403, 'FORBIDDEN', `This action requires ${role} privileges`);
  }

  return session;
}

/**
 * Optional auth: reads the session if present but does not require it.
 * Use in endpoints that behave differently for authenticated vs anonymous users.
 *
 * Returns `{ session: Session | null }`.
 */
export async function optionalAuth(request: Request): Promise<{ session: Session | null }> {
  const session = await getSession(request);
  return { session };
}
