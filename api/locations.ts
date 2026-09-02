// ─── Locations API for Vercel ───────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sheets } from '@/lib/google-sheets/client';
import { SHEETS, LOCATIONS_HEADERS, mapRowToLocation } from '@/lib/google-sheets/types';
import type { Location } from '@/types/index';

const SAMPLE_LOCATIONS = [
  { locationId: 'LOC-0001', name: 'Bình Lợi Trung', description: 'Cụm homestay Bình Lợi Trung', publicAddress: 'Bình Lợi Trung, Bình Chánh, Hồ Chí Minh', phone: '+84 28 0000 0001', active: true },
];

async function getLocations(spreadsheetId: string): Promise<Location[]> {
  if (!spreadsheetId) {
    return SAMPLE_LOCATIONS as Location[];
  }
  try {
    const range = `${SHEETS.Locations}!A2:${String.fromCharCode(64 + LOCATIONS_HEADERS.length)}`;
    const rows = await sheets.getValues(spreadsheetId, range);
    return rows.map(mapRowToLocation).filter(l => l.active);
  } catch (error) {
    console.error('[api/locations] Error fetching from Sheets:', error);
    return SAMPLE_LOCATIONS as Location[];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' } });
  }

  const spreadsheetId = process.env.SPREADSHEET_ID || '';
  const locations = await getLocations(spreadsheetId);

  const publicLocations = locations.map(({ locationId, name, description, publicAddress }) => ({
    locationId,
    name,
    description,
    publicAddress,
  }));

  return res.json({ success: true, data: publicLocations });
}
