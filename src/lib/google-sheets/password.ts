// ─── Password hashing ─────────────────────────────────────────────────────────────
//
// Uses the Web Crypto API (SubtleCrypto) for hashing.
// This module is SERVER-SIDE ONLY — never call these functions from browser code.
//
// Algorithm: PBKDF2-HMAC-SHA256, 100,000 iterations, 32-byte derived key.
// The salt is stored alongside the hash (base64-encoded).
//
// Storage format: "$algorithm$salt$hash" (so the hash is self-contained).
// ──────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'PBKDF2';
const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function ab2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash a plain-text password. Returns a storable hash string. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passwordBytes = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: ALGORITHM },
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: ALGORITHM, hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    KEY_BYTES * 8,
  );

  const saltB64 = arrayBufferToBase64(salt.buffer);
  const hashHex = ab2hex(derivedBits);

  return `${ALGORITHM}$${saltB64}$${hashHex}`;
}

/** Verify a plain-text password against a stored hash. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const [_alg, saltB64, hashHex] = storedHash.split('$');
    if (!_alg || !saltB64 || !hashHex) return false;

    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    const key = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: ALGORITHM },
      false,
      ['deriveBits'],
    );

    const derivedBits = await crypto.subtle.deriveBits(
      { name: ALGORITHM, hash: 'SHA-256', salt, iterations: ITERATIONS },
      key,
      KEY_BYTES * 8,
    );

    const computedHex = ab2hex(derivedBits);

    // Constant-time comparison to prevent timing attacks
    if (computedHex.length !== hashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
