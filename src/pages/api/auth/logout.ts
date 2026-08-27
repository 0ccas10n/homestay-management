// ─── POST /api/auth/logout ───────────────────────────────────────────────────────

import { destroySessionCookie } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess } from '@/lib/api/response';

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  return jsonSuccess(null, { headers: { 'Set-Cookie': destroySessionCookie() } });
}
