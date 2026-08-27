#!/usr/bin/env node
// ─── seed.ts ─────────────────────────────────────────────────────────────────────────
//
// Seeds the Google Sheets spreadsheet with real business data.
//
// Usage:
//   npx tsx scripts/seed.ts
//
// Prerequisites:
//   1. Copy .env.example to .env and fill in your credentials
//   2. Share the Google Sheets document with the service account email
//   3. Set SEED_ADMIN_PASSWORD in .env for the admin login
//
// This script is idempotent — running it multiple times is safe.
// ──────────────────────────────────────────────────────────────────────────────

import * as path from 'path';
import * as fs from 'fs';

// ─── Load .env manually (no dotenv dependency needed) ─────────────────────────────
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Verify required env vars ────────────────────────────────────────────────────
const required = [
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CLOUD_PROJECT_ID',
  'SESSION_SECRET',
  'SEED_ADMIN_PASSWORD',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('Missing required env vars:', missing.join(', '));
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

// ─── Imports (server-side only) ──────────────────────────────────────────────────
import { google } from 'googleapis';
import { generateSyncId } from '../src/lib/google-sheets/id';
import { hashPassword } from '../src/lib/google-sheets/password';
import { LOCATIONS, ROOMS, RATE_PLANS, ROOM_RATE_PRICES, SEED_ADMIN_EMAIL } from './seedData';

// ─── Sheets client ───────────────────────────────────────────────────────────────
function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return google.sheets({
    version: 'v4',
    auth,
  } as any);
}

// ─── Sheet operations ────────────────────────────────────────────────────────────
const sheets = createSheetsClient();
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

async function createSheet(title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets ?? [];
  if (existing.some(s => s.properties?.title === title)) {
    console.log(`  [skip] "${title}" already exists`);
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 26 } } } }],
    },
  });
  console.log(`  [created] "${title}"`);
}

async function writeSheet(title: string, headers: string[], rows: (string | number | boolean)[][]) {
  const lastCol = String.fromCharCode(64 + headers.length);
  const range = `${title}!A1:${lastCol}${rows.length + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...rows] },
  });
  console.log(`  [written] "${title}" — ${rows.length} data rows`);
}

// ─── Column helpers ──────────────────────────────────────────────────────────────
const bool = (v: boolean) => (v ? 'TRUE' : 'FALSE');
const amenityJoin = (a: string[]) => a.join('|');
const now = new Date().toISOString();

// ─── Seed functions ──────────────────────────────────────────────────────────────

async function seedLocations() {
  console.log('\n[1/10] Locations...');
  await createSheet('Locations');
  await writeSheet('Locations', [
    'location_id', 'name', 'description', 'public_address', 'phone', 'active', 'created_at', 'updated_at',
  ], LOCATIONS.map(l => [
    l.locationId, l.name, l.description ?? '', l.publicAddress ?? '', l.phone ?? '',
    bool(l.active), l.createdAt, l.updatedAt,
  ]));
}

async function seedRooms() {
  console.log('\n[2/10] Rooms...');
  await createSheet('Rooms');
  await writeSheet('Rooms', [
    'room_id', 'location_id', 'name', 'description', 'capacity', 'price_display',
    'status', 'active', 'image_url', 'floor', 'amenities', 'notes',
    'created_at', 'updated_at',
  ], ROOMS.map(r => [
    r.roomId, r.locationId, r.name, r.description ?? '', r.capacity, r.priceDisplay ?? '',
    r.status, bool(r.active), r.imageUrl ?? '', r.floor ?? '',
    amenityJoin(r.amenities ?? []), r.notes ?? '', r.createdAt, r.updatedAt,
  ]));
}

async function seedRatePlans() {
  console.log('\n[3/10] Rate Plans...');
  await createSheet('RatePlans');
  await writeSheet('RatePlans', [
    'rate_plan_id', 'name', 'type', 'base_minutes', 'base_amount',
    'extra_minute_price', 'overtime_minute_price',
    'overnight_start', 'overnight_end', 'active',
  ], RATE_PLANS.map(rp => [
    rp.ratePlanId, rp.name, rp.type, rp.baseMinutes, rp.baseAmount,
    rp.extraMinutePrice, rp.overtimeMinutePrice,
    rp.overnightStart ?? '', rp.overnightEnd ?? '', bool(rp.active),
  ]));
}

async function seedRatePlanPrices() {
  console.log('\n[4/10] Rate Plan Prices...');
  await createSheet('RatePlanPrices');
  await writeSheet('RatePlanPrices', [
    'rate_plan_price_id', 'rate_plan_id', 'room_id', 'price_vnd', 'active',
  ], Object.entries(ROOM_RATE_PRICES).flatMap(([roomId, prices]) =>
    Object.entries(prices).map(([ratePlanId, price]) => [
      generateSyncId('RPP'), ratePlanId, roomId, price, 'TRUE',
    ]),
  ));
}

async function seedUsers() {
  console.log('\n[5/10] Admin User...');
  await createSheet('Users');
  const passwordHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD!);
  await writeSheet('Users', [
    'user_id', 'name', 'email', 'password_hash', 'role', 'active', 'created_at', 'updated_at',
  ], [[
    generateSyncId('USR'), 'Admin', SEED_ADMIN_EMAIL, passwordHash, 'admin', 'TRUE', now, now,
  ]]);
  console.log(`  admin email: ${SEED_ADMIN_EMAIL}`);
  console.log(`  admin password: ${process.env.SEED_ADMIN_PASSWORD}`);
}

async function seedBookings() {
  console.log('\n[6/10] Bookings (headers only)...');
  await createSheet('Bookings');
  await writeSheet('Bookings', [
    'booking_id', 'room_id', 'customer_id', 'checkInAt', 'expectedCheckOutAt',
    'actualCheckOutAt', 'status', 'source', 'ratePlanId', 'expectedDurationMinutes',
    'baseAmount', 'overtimeMinutes', 'overtimeAmount', 'totalAmount', 'numGuests',
    'note', 'created_by', 'created_at', 'updated_at',
  ], []);
}

async function seedCleaning() {
  console.log('\n[7/10] Cleaning (headers only)...');
  await createSheet('Cleaning');
  await writeSheet('Cleaning', [
    'cleaning_id', 'room_id', 'booking_id', 'scheduledAt', 'status',
    'priority', 'assigned_to', 'started_at', 'completed_at', 'note',
    'created_at', 'updated_at',
  ], []);
}

async function seedCustomers() {
  console.log('\n[8/10] Customers (headers only)...');
  await createSheet('Customers');
  await writeSheet('Customers', [
    'customer_id', 'name', 'phone', 'email', 'note', 'created_at', 'updated_at',
  ], []);
}

async function seedNotifications() {
  console.log('\n[9/10] Notifications (headers only)...');
  await createSheet('Notifications');
  await writeSheet('Notifications', [
    'notification_id', 'type', 'title', 'message', 'time', 'read', 'priority',
    'related_booking_id', 'related_room_id', 'created_at', 'updated_at',
  ], []);
}

async function seedExpenses() {
  console.log('\n[10/10] Expenses (headers only)...');
  await createSheet('Expenses');
  await writeSheet('Expenses', [
    'expense_id', 'category', 'amount', 'date', 'description', 'vendor', 'created_at', 'updated_at',
  ], []);
}

// ─── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(50));
  console.log('  Homestay Management — Seed Script');
  console.log('='.repeat(50));
  console.log(`\nSpreadsheet: ${SPREADSHEET_ID}`);

  await seedLocations();
  await seedRooms();
  await seedRatePlans();
  await seedRatePlanPrices();
  await seedUsers();
  await seedBookings();
  await seedCleaning();
  await seedCustomers();
  await seedNotifications();
  await seedExpenses();

  console.log('\n' + '='.repeat(50));
  console.log('Seed complete!');
  console.log(`Login: ${SEED_ADMIN_EMAIL} / ${process.env.SEED_ADMIN_PASSWORD}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('\nSeed failed:', err?.message ?? err);
  process.exit(1);
});
