// ─── Backfill script: repair bookings with missing/zero unit price snapshot ────
//
// Run with:  pnpm tsx scripts/recalculate-bookings.ts
//
// What this does:
//   For every row in the Bookings sheet:
//     1. Read `unitPriceAtBooking`. If it's missing or 0, look up the per-room
//        price from RatePlanPrices (or ROOM_RATE_PRICES as a last-resort
//        fallback) using the row's `roomId` and `ratePlanId`.
//     2. Recompute:
//          expectedDurationMinutes = round((expectedCheckOutAt − checkInAt) / 60_000)
//          nights                  = max(1, ceil(expectedDurationMinutes / 1440))
//          baseAmount              = nights × unitPrice + extraGuestSurcharge
//          totalAmount             = baseAmount + overtimeAmount (when checked out)
//     3. Write the updated row back to the sheet.
//
// Skips hourly bookings (bookingType === 'hourly') — those keep the
// receptionist-entered totalAmount as the unitPrice snapshot.

import { sheets } from '../src/lib/google-sheets/client';
import { BOOKINGS_HEADERS, mapRowToBooking, mapBookingToRow } from '../src/lib/google-sheets/types';
import { readAll as readAllRatePlanPrices } from '../src/lib/google-sheets/ratePlanPrices.repository';
import { ROOM_RATE_PRICES } from './seedData';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? '';
const EXTRA_GUEST_CHARGE_VND = 100_000; // mirrors bookings.repository
const OVERTIME_HOURLY_RATE    = 70_000;   // mirrors bookings.repository

function diffMinutes(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
}

function nightsFor(checkInIso: string, checkOutIso: string): number {
  const m = diffMinutes(checkInIso, checkOutIso);
  return Math.max(1, Math.ceil(m / 1440));
}

interface BackfillResult {
  bookingId: string;
  before: { unitPriceAtBooking?: number; baseAmount: number; totalAmount: number };
  after:  { unitPriceAtBooking?: number; baseAmount: number; totalAmount: number };
  changed: boolean;
  reason: string;
}

async function main(): Promise<void> {
  if (!SPREADSHEET_ID && !process.env.NODE_ENV) {
    // In-memory store mode: SPREADSHEET_ID isn't required.
  }

  const dryRun = process.argv.includes('--dry-run');

  console.log('Reading bookings + rate plan prices…');
  const priceRows = await readAllRatePlanPrices(SPREADSHEET_ID || 'memory');
  const priceIndex = new Map<string, number>();
  for (const p of priceRows) {
    if (!p.active) continue;
    priceIndex.set(`${p.ratePlanId}::${p.roomId}`, p.priceVnd);
  }

  const range = `Bookings!A2:${String.fromCharCode(64 + BOOKINGS_HEADERS.length)}`;
  const rows = await sheets.getValues(SPREADSHEET_ID || 'memory', range);
  if (rows.length === 0) {
    console.log('No bookings found, nothing to do.');
    return;
  }

  const headerLength = BOOKINGS_HEADERS.length;
  const lastCol = String.fromCharCode(64 + headerLength);

  const results: BackfillResult[] = [];
  const updates: { range: string; row: string[] }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    // Pad the row to headerLength so mapRowToBooking reads the same indices
    // it would in production (the existing schema uses fixed column indices).
    while (row.length < headerLength) row.push('');
    const booking = mapRowToBooking(row);

    const isHourly = booking.bookingType === 'hourly';
    const { unitPriceAtBooking, baseAmount, totalAmount } = booking;
    const before = { unitPriceAtBooking, baseAmount, totalAmount };

    let reason = 'noop';
    let newUnitPrice = unitPriceAtBooking;
    let newBase = baseAmount;
    let newTotal = totalAmount;
    let changed = false;

    if (isHourly) {
      // Hourly: keep manual totalAmount as the snapshot.
      if (!newUnitPrice || newUnitPrice <= 0) {
        newUnitPrice = totalAmount;
        changed = newUnitPrice !== unitPriceAtBooking;
        reason = 'hourly: snapshot was empty, copied from totalAmount';
      } else {
        reason = 'hourly: snapshot present, kept as-is';
      }
    } else {
      // Daily: look up the authoritative price.
      const key = `${booking.ratePlanId}::${booking.roomId}`;
      let price = priceIndex.get(key);
      if (price === undefined || price <= 0) {
        // Last-resort fallback from in-memory seed data.
        price = ROOM_RATE_PRICES[booking.roomId]?.[booking.ratePlanId] ?? 0;
      }

      if (!price || price <= 0) {
        reason = 'SKIPPED: no price in RatePlanPrices and no fallback in seedData';
      } else {
        newUnitPrice = price;
        const nights = nightsFor(booking.checkInAt, booking.expectedCheckOutAt);
        newBase = nights * price;
        if (booking.numGuests && booking.numGuests > 2) {
          newBase += (booking.numGuests - 2) * EXTRA_GUEST_CHARGE_VND * nights;
        }
        const overtime = booking.overtimeAmount ?? 0;
        newTotal = newBase + overtime;
        changed =
          newUnitPrice !== unitPriceAtBooking ||
          Math.abs(newBase - baseAmount) > 0.5 ||
          Math.abs(newTotal - totalAmount) > 0.5;
        reason = `daily: ${nights} đêm × ${price.toLocaleString('vi-VN')} ₫`;
      }
    }

    if (changed) {
      const updated: typeof booking = {
        ...booking,
        unitPriceAtBooking: newUnitPrice,
        baseAmount: newBase,
        totalAmount: newTotal,
      };
      const sheetRow = i + 2; // +1 for header, +1 for 1-indexing
      updates.push({
        range: `Bookings!A${sheetRow}:${lastCol}`,
        row: mapBookingToRow(updated),
      });
    }

    results.push({
      bookingId: booking.bookingId,
      before,
      after: { unitPriceAtBooking: newUnitPrice, baseAmount: newBase, totalAmount: newTotal },
      changed,
      reason,
    });
  }

  // Apply updates one row at a time so we don't have to worry about batch
  // range ordering.
  for (const u of updates) {
    if (dryRun) continue;
    await sheets.setValues(SPREADSHEET_ID || 'memory', u.range, [u.row]);
  }

  // Summary
  const changedCount = results.filter(r => r.changed).length;
  const skippedCount = results.filter(r => r.reason.startsWith('SKIPPED')).length;

  console.log('');
  console.log(`Bookings scanned : ${results.length}`);
  console.log(`Updated          : ${changedCount}${dryRun ? ' (DRY RUN — not written)' : ''}`);
  console.log(`Skipped (no price): ${skippedCount}`);
  console.log('');
  for (const r of results) {
    if (r.changed || r.reason.startsWith('SKIPPED')) {
      console.log(
        `${r.bookingId.padEnd(12)} ${r.reason.padEnd(60)}`,
        `unitPrice: ${(r.before.unitPriceAtBooking ?? 0).toString().padStart(10)} → ${(r.after.unitPriceAtBooking ?? 0).toString().padStart(10)}`,
        `baseAmount: ${r.before.baseAmount.toString().padStart(10)} → ${r.after.baseAmount.toString().padStart(10)}`,
        `totalAmount: ${r.before.totalAmount.toString().padStart(10)} → ${r.after.totalAmount.toString().padStart(10)}`,
      );
    }
  }
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});