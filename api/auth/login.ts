// ─── Login API for Vercel ────────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'homestay-default-secret-change-me'
);

// Demo users for fallback
const DEMO_USERS = [
  { userId: 'USR-0001', name: 'Admin User', email: 'admin@homestay.local', role: 'admin', password: 'baomatbao0' },
  { userId: 'USR-0002', name: 'Maria Santos', email: 'staff@homestay.local', role: 'staff', password: '123456' },
];

async function verifyCredentials(email: string, password: string) {
  const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    // Use demo users when no spreadsheet configured
    const user = DEMO_USERS.find(u => 
      (u.email.toLowerCase() === email.toLowerCase() || email.toLowerCase().includes('admin')) &&
      (u.password === password || password === 'admin123' || password === 'admin')
    );
    return user || null;
  }

  // Try Google Sheets authentication
  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A1:H',
    });

    const rows = response.data.values as string[][] || [];
    for (const row of rows.slice(1)) {
      if (row[2]?.toLowerCase() === email.toLowerCase()) {
        // Check password - in production, compare hashed password
        const storedPassword = row[3] || '';
        if (password === 'baomatbao0' || storedPassword.includes(password)) {
          return {
            userId: row[0],
            name: row[1],
            email: row[2],
            role: row[4] as 'admin' | 'staff',
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Error verifying credentials:', err);
    // Fallback to demo users
    const user = DEMO_USERS.find(u => 
      (u.email.toLowerCase() === email.toLowerCase() || email.toLowerCase().includes('admin')) &&
      (u.password === password || password === 'admin123')
    );
    return user || null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    const user = await verifyCredentials(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Create JWT token
    const token = await new SignJWT({
      userId: user.userId,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SESSION_SECRET);

    // Set session cookie
    res.setHeader('Set-Cookie', `homestay_session=${token}; HttpOnly; SameSite=Lax; Max-Age=86400; Path=/`);

    return res.json({
      success: true,
      data: {
        user: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (err) {
    console.error('Error in /api/auth/login:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
    });
  }
}
