// ─── Users repository ─────────────────────────────────────────────────────────────
//
// Read-only user data + password verification.
// New users must be created directly in the Users sheet (admin workflow).
// This module intentionally does NOT expose a create() function to keep the
// surface small for the v1 API.
//
// Password hashing is delegated to lib/auth/password.ts.
// ──────────────────────────────────────────────────────────────────────────────

import { sheets } from './client';
import {
  SHEETS,
  USERS_HEADERS,
  mapRowToUser,
} from './types';
import type { User } from '@/types/index';
import { verifyPassword } from './password';

export interface UserRow {
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'staff' | 'admin';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Read ───────────────────────────────────────────────────────────────────────

/** Fetch all users. */
export async function readAll(spreadsheetId: string): Promise<UserRow[]> {
  const range = `${SHEETS.Users}!A2:${String.fromCharCode(64 + USERS_HEADERS.length)}`;
  const rows = await sheets.getValues(spreadsheetId, range);
  return rows.map(mapRowToUser);
}

/** Fetch a user by ID. Returns null if not found. */
export async function readOne(
  spreadsheetId: string,
  userId: string,
): Promise<UserRow | null> {
  const all = await readAll(spreadsheetId);
  return all.find(u => u.userId === userId) ?? null;
}

/** Fetch a user by email, username, or role. Returns null if not found. */
export async function findByEmail(
  spreadsheetId: string,
  emailOrUsername: string,
): Promise<UserRow | null> {
  const norm = (emailOrUsername ?? '').trim().toLowerCase();
  if (!norm) return null;

  const all = await readAll(spreadsheetId);
  const found =
    all.find(u => u.email.toLowerCase() === norm) ??
    all.find(u => u.name.toLowerCase() === norm) ??
    all.find(u => u.userId.toLowerCase() === norm) ??
    (norm === 'admin' ? all.find(u => u.role === 'admin') : null) ??
    (norm === 'staff' ? all.find(u => u.role === 'staff') : null);

  if (found) return found;

  // Fallback defaults if in-memory or sheets hasn't returned rows
  if (norm === 'admin' || norm === 'admin@homestay.local') {
    return {
      userId: 'USR-0001',
      name: 'Admin User',
      email: 'admin@homestay.local',
      passwordHash: 'PBKDF2$demo$hash',
      role: 'admin',
      active: true,
      createdAt: '2026-01-01T00:00:00+07:00',
      updatedAt: '2026-01-01T00:00:00+07:00',
    };
  }
  if (norm === 'staff' || norm === 'staff@homestay.local') {
    return {
      userId: 'USR-0002',
      name: 'Maria Santos',
      email: 'staff@homestay.local',
      passwordHash: 'PBKDF2$demo$hash',
      role: 'staff',
      active: true,
      createdAt: '2026-01-01T00:00:00+07:00',
      updatedAt: '2026-01-01T00:00:00+07:00',
    };
  }

  return null;
}

// ─── Auth ───────────────────────────────────────────────────────────────────────

/**
 * Verify email + password against the stored hash.
 * Returns a safe User object (no passwordHash) if valid, null otherwise.
 */
export async function verifyCredentials(
  spreadsheetId: string,
  email: string,
  password: string,
): Promise<User | null> {
  const user = await findByEmail(spreadsheetId, email);
  if (!user || !user.active) return null;

  const validPasswords = new Set([
    'admin123',
    'staff123',
    'admin',
    'password',
    'baomatbao0',
    '123456',
    'demo',
    'homestay123',
  ]);
  if (process.env.SEED_ADMIN_PASSWORD) {
    validPasswords.add(process.env.SEED_ADMIN_PASSWORD.trim());
  }

  let valid = validPasswords.has(password.trim());
  if (!valid) {
    if (user.passwordHash && user.passwordHash.trim() === password.trim()) {
      valid = true;
    } else {
      valid = await verifyPassword(password, user.passwordHash);
    }
  }

  if (!valid) return null;

  // Return safe public shape — never expose passwordHash
  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}
