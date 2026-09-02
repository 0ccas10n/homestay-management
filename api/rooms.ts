// ─── Rooms API for Vercel ────────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dynamic import for shared code
async function getRooms() {
  // Use in-memory data as fallback when Google Sheets not configured
  const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    // Return sample data when no spreadsheet configured
    return getSampleRooms();
  }

  // Try to fetch from Google Sheets
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
      range: 'Rooms!A2:N',
    });

    const rows = response.data.values as string[][] || [];
    return rows.map(row => ({
      roomId: row[0] || '',
      locationId: row[1] || '',
      name: row[2] || '',
      description: row[3] || '',
      capacity: parseInt(row[4]) || 1,
      priceDisplay: row[5] || '',
      status: (row[6] as any) || 'available',
      active: row[7]?.toUpperCase() !== 'FALSE',
      imageUrl: row[8] || '',
      floor: row[9] ? parseInt(row[9]) : undefined,
      amenities: row[10] ? row[10].split('|') : [],
      notes: row[11] || '',
    }));
  } catch (err) {
    console.error('Error fetching rooms:', err);
    return getSampleRooms();
  }
}

function getSampleRooms() {
  return [
    { roomId: 'ROOM-0001', locationId: 'LOC-0001', name: 'Hiên 1', description: 'Phòng Standard — 1 giường đôi + 1 giường đơn', capacity: 4, priceDisplay: 'Từ 350.000 ₫/đêm', status: 'available', active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'] },
    { roomId: 'ROOM-0002', locationId: 'LOC-0001', name: 'Hiên 2', description: 'Phòng Standard — 1 giường đôi + 1 giường đơn', capacity: 4, priceDisplay: 'Từ 350.000 ₫/đêm', status: 'available', active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV'] },
    { roomId: 'ROOM-0003', locationId: 'LOC-0001', name: 'Hiên 3', description: 'Phòng Standard — 1 giường đôi + 1 giường đơn', capacity: 4, priceDisplay: 'Từ 350.000 ₫/đêm', status: 'cleaning', active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'] },
    { roomId: 'ROOM-0004', locationId: 'LOC-0001', name: 'Yên 1', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'available', active: true, floor: 1, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'] },
    { roomId: 'ROOM-0005', locationId: 'LOC-0001', name: 'Yên 2', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied', active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công'] },
    { roomId: 'ROOM-0006', locationId: 'LOC-0001', name: 'Yên 3', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied', active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công', 'Bếp'] },
    { roomId: 'ROOM-0007', locationId: 'LOC-0001', name: 'Yên 4', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'maintenance', active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'] },
    { roomId: 'ROOM-0008', locationId: 'LOC-0001', name: 'Yên 5', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'available', active: true, floor: 2, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm'] },
    { roomId: 'ROOM-0009', locationId: 'LOC-0001', name: 'Yên 6', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'available', active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công', 'Bếp'] },
    { roomId: 'ROOM-0010', locationId: 'LOC-0001', name: 'Yên 7', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied', active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công'] },
    { roomId: 'ROOM-0011', locationId: 'LOC-0001', name: 'Yên 8', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'cleaning', active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV'] },
    { roomId: 'ROOM-0012', locationId: 'LOC-0001', name: 'Yên 9', description: 'Phòng Deluxe — 1 giường đôi + 2 giường đơn', capacity: 5, priceDisplay: 'Từ 450.000 ₫/đêm', status: 'occupied', active: true, floor: 3, amenities: ['WiFi', 'AC', 'TV', 'Bồn tắm', 'Ban công', 'Bếp', 'Jacuzzi'] },
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    const rooms = await getRooms();
    
    // Filter by locationId if provided
    const locationId = req.query.locationId as string | undefined;
    const filtered = locationId ? rooms.filter(r => r.locationId === locationId) : rooms;
    
    // Filter active rooms
    const activeRooms = filtered.filter(r => r.active);

    return res.json({ success: true, data: activeRooms });
  } catch (err) {
    console.error('Error in /api/rooms:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rooms' },
    });
  }
}
