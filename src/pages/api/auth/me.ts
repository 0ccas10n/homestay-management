// ─── GET /api/auth/me ────────────────────────────────────────────────────────────

import { requireAuth } from '@/lib/auth/middleware';
import { jsonSuccess } from '@/lib/api/response';

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof Response) return session;

  return jsonSuccess({
    userId: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
  });
}
