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

/** Fetch a user by email. Returns null if not found. */
export async function findByEmail(
  spreadsheetId: string,
  email: string,
): Promise<UserRow | null> {
  const all = await readAll(spreadsheetId);
  return all.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
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

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  // Return safe public shape — never expose passwordHash
  const { passwordHash: _, ...safeUser } = user;
  return safeUser as User;
}
