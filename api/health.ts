import type { VercelRequest, VercelResponse } from '@vercel/node';

// Health check for Vercel
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    success: true,
    data: {
      status: 'ok',
      env: process.env.NODE_ENV ?? 'production',
      spreadsheetId: process.env.SPREADSHEET_ID ? 'configured' : 'in-memory-fallback',
    },
  });
}
