// ─── JWT session management ─────────────────────────────────────────────────────────
//
// Creates and verifies signed JWT session tokens stored in HTTP-only cookies.
// This module is SERVER-SIDE ONLY.
//
// Token contents (payload):
//   { sub: userId, name, email, role, iat, exp }
//
// Cookie: session=<jwt>; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=<maxAge>
//
// SESSION_SECRET must be at least 32 bytes of entropy.
//
// Expiry: 24 hours (configurable via SESSION_TTL_SECONDS).
// ──────────────────────────────────────────────────────────────────────────────

import { SignJWT, type JWTPayload } from 'jose';
import { jwtVerify } from 'jose';
import type { User } from '@/types/index';

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? (() => { throw new Error('SESSION_SECRET env var is required'); })(),
);

// Session TTL in seconds. Default: 24 hours.
const TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 86_400);

// Cookie attribute constants
const COOKIE_NAME = 'session';
const COOKIE_PATH = '/';
// In dev (http://localhost) cookies must be lax AND non-secure to round-trip
// between the Vite origin (where the browser is) and the proxied API origin
// (where Set-Cookie is emitted). SameSite=Strict would drop them entirely.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const COOKIE_SAMESITE: 'Strict' | 'Lax' = IS_PRODUCTION ? 'Strict' : 'Lax';
const COOKIE_SECURE = IS_PRODUCTION;

/** What is embedded in the JWT payload. */
interface SessionPayload extends JWTPayload {
  sub: string;    // userId
  name: string;
  email: string;
  role: 'staff' | 'admin';
}

/** A verified, decoded session — safe to use in route handlers. */
export interface Session {
  userId: string;
  name: string;
  email: string;
  role: 'staff' | 'admin';
  /** Unix timestamp (seconds) — when the token expires. */
  expiresAt: number;
}

// ─── Create ─────────────────────────────────────────────────────────────────────

/**
 * Create a signed JWT for a user and return the full Set-Cookie header value.
 * Call this after a successful login.
 *
 * @example
 * const cookie = await createSessionCookie(user);
 * return new Response(null, { headers: { 'Set-Cookie': cookie } });
 */
export async function createSessionCookie(user: User): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  } satisfies Omit<SessionPayload, 'iat' | 'exp' | 'sub'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET);

  const maxAge = TTL_SECONDS;
  const flags = [
    `HttpOnly`,
    `SameSite=${COOKIE_SAMESITE}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
  ];
  if (COOKIE_SECURE) flags.push('Secure');
  return `${COOKIE_NAME}=${token}; ${flags.join('; ')}`;
}

// ─── Read & Verify ──────────────────────────────────────────────────────────────

/** Parse and verify the session cookie from a Request. Returns null if missing/invalid/expired. */
export async function getSession(request: Request): Promise<Session | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const raw = parseCookie(cookieHeader)[COOKIE_NAME];
  if (!raw) return null;

  return verifyToken(raw);
}

/**
 * Verify a raw JWT string and return a Session, or null if invalid/expired.
 * Use this when the token is passed in an Authorization header instead of a cookie
 * (e.g. for server-to-server calls, though currently we use cookies everywhere).
 */
export async function verifyToken(raw: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(raw, SECRET, { algorithms: ['HS256'] });
    const p = payload as SessionPayload;
    return {
      userId:    p.sub,
      name:      p.name ?? '',
      email:     p.email ?? '',
      role:      p.role ?? 'staff',
      expiresAt: p.exp ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Destroy ────────────────────────────────────────────────────────────────────

/**
 * Return a Set-Cookie header that immediately invalidates the session.
 * Use this on logout.
 */
export function destroySessionCookie(): string {
  return (
    `${COOKIE_NAME}=; ` +
    `HttpOnly; ` +
    `SameSite=${COOKIE_SAMESITE}; ` +
    `Secure; ` +
    `Path=${COOKIE_PATH}; ` +
    `Max-Age=0`
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

/** Minimal cookie parser — handles one or more cookie strings. */
function parseCookie(cookie: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of cookie.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = val;
  }
  return result;
}
