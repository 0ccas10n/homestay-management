// ─── POST /api/auth/login ────────────────────────────────────────────────────────

import { verifyCredentials } from '@/lib/google-sheets/users.repository';
import { createSessionCookie } from '@/lib/auth/session';
import { loginSchema, parseBody } from '@/lib/api/validation';
import { jsonSuccess, jsonError } from '@/lib/api/response';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function POST(request: Request) {
  const parsed = await parseBody(request, loginSchema);
  if (parsed instanceof Response) return parsed;

  const { email, password } = parsed;

  const user = await verifyCredentials(SPREADSHEET_ID, email, password);
  if (!user) {
    return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const cookie = await createSessionCookie(user);
  return jsonSuccess(
    {
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    { headers: { 'Set-Cookie': cookie } },
  );
}
