// ─── Standardized API response helpers ─────────────────────────────────────────────
//
// Every Vercel route handler should use these instead of raw `Response.json()`.
// They ensure the envelope format defined in API.md §2.
//
// Usage:
//   return jsonSuccess({ userId: 'USR-0001', name: '...', role: 'admin' });
//   return jsonError(400, 'VALIDATION_ERROR', 'checkInAt is required');
//
// jsonSuccess / jsonError automatically set CORS and JSON content-type headers.
//
// ──────────────────────────────────────────────────────────────────────────────

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  // Allow the Vercel deployment domain and localhost in dev
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
} as const;

/** ISO datetime used in error responses. */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Build a success response body.
 * @param data  The payload — anything serializable to JSON.
 */
function buildSuccess(data: unknown): object {
  return { success: true, data };
}

/**
 * Build an error response body.
 * Stack traces are intentionally omitted (API.md §2).
 */
function buildError(code: string, message: string): object {
  return {
    success: false,
    error: { code, message, timestamp: timestamp() },
  };
}

// ─── Response constructors ───────────────────────────────────────────────────────

/** Return a 2xx response with the standard envelope. */
export function jsonSuccess(
  data: unknown,
  init?: ResponseInit,
): Response {
  return new Response(JSON.stringify(buildSuccess(data)), {
    status: 200,
    headers: { ...Object.fromEntries(Object.entries(JSON_HEADERS)), ...init?.headers },
    ...init,
  });
}

/** Return a 201 Created response. */
export function jsonCreated(
  data: unknown,
  init?: ResponseInit,
): Response {
  return new Response(JSON.stringify(buildSuccess(data)), {
    status: 201,
    headers: { ...Object.fromEntries(Object.entries(JSON_HEADERS)), ...init?.headers },
    ...init,
  });
}

/**
 * Return an error response with a specific HTTP status.
 * Use this in all error paths — never return a bare `throw`.
 *
 * @param status  HTTP status code (400, 401, 403, 404, 409, 422, 500, etc.)
 * @param code    Machine-readable error code, e.g. 'VALIDATION_ERROR', 'NOT_FOUND'
 * @param message Human-readable explanation (safe to show in the UI)
 */
export function jsonError(
  status: number,
  code: string,
  message: string,
  init?: ResponseInit,
): Response {
  return new Response(JSON.stringify(buildError(code, message)), {
    status,
    headers: { ...Object.fromEntries(Object.entries(JSON_HEADERS)), ...init?.headers },
    ...init,
  });
}

/** Handle a Zod validation error, returning a 422 response. */
export function jsonValidationError(zodError: { issues: { path: (string | number)[]; message: string }[] }): Response {
  const messages = zodError.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return jsonError(422, 'VALIDATION_ERROR', messages);
}

/**
 * Handle a generic unexpected error.
 * Logs to stderr but never exposes the stack trace to the client.
 */
export function jsonServerError(err: unknown, context?: string): Response {
  if (process.env.NODE_ENV !== 'production') {
    // Log full error in development for debugging
    console.error('[Server Error]', context, err);
  } else {
    console.error('[Server Error]', context);
  }
  return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

/**
 * Return an empty 204 No Content response.
 * Use for DELETE actions that don't return a body.
 */
export function jsonNoContent(): Response {
  return new Response(null, { status: 204 });
}
