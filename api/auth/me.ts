// ─── Auth me API for Vercel ─────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'homestay-default-secret-change-me'
);

// Demo users
const DEMO_USERS: Record<string, { userId: string; name: string; email: string; role: 'admin' | 'staff' }> = {
  'USR-0001': { userId: 'USR-0001', name: 'Admin User', email: 'admin@homestay.local', role: 'admin' },
  'USR-0002': { userId: 'USR-0002', name: 'Maria Santos', email: 'staff@homestay.local', role: 'staff' },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    // Get token from Authorization header or cookie
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/homestay_session=([^;]+)/);
      token = match?.[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    const { payload } = await jwtVerify(token, SESSION_SECRET);
    const userId = (payload as any).userId;

    if (!userId || !DEMO_USERS[userId]) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session' },
      });
    }

    return res.json({ success: true, data: DEMO_USERS[userId] });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }
}
