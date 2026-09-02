// ─── Catch-all Vercel Serverless Function ─────────────────────────────────────
// This file replaces the multiple fragmented API files. It acts as a single
// Serverless Function that maps Vercel HTTP requests to the Fetch API handlers
// in src/pages/api/**.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as handlers from '../src/pages/api/index';

// Build the request URL from VercelRequest
function buildFetchRequest(req: VercelRequest): Request {
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost';
  const fullUrl = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) headers.set(k, v.join(', '));
    else headers.set(k, String(v));
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    // req.body is already parsed by Vercel if it's JSON, so we need to stringify it
    // because our Fetch API handlers expect to call request.json()
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  return new Request(fullUrl, init);
}

// Convert Fetch API Response to VercelResponse
async function sendFetchResponse(fetchRes: Response, res: VercelResponse): Promise<void> {
  res.status(fetchRes.status);
  
  fetchRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const parts = value.split(/,(?=[^;]+=[^;]+)/);
      const existing = res.getHeader('set-cookie');
      let newCookies = parts.map(p => p.trim());
      if (existing) {
        if (Array.isArray(existing)) newCookies = [...existing, ...newCookies];
        else newCookies = [existing as string, ...newCookies];
      }
      res.setHeader('set-cookie', newCookies);
      return;
    }
    res.setHeader(key, value);
  });

  const contentType = fetchRes.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const text = await fetchRes.text();
    res.send(text);
  } else if (contentType.includes('text/')) {
    res.setHeader('Content-Type', contentType);
    res.send(await fetchRes.text());
  } else {
    res.send(Buffer.from(await fetchRes.arrayBuffer()));
  }
}

const routeTable = [
  { pattern: /^\/api\/availability\/?$/, modules: [handlers.availability] },
  { pattern: /^\/api\/dashboard\/?$/, modules: [handlers.dashboard] },
  { pattern: /^\/api\/locations\/?$/, modules: [handlers.locations] },
  { pattern: /^\/api\/rooms\/?$/, modules: [handlers.roomsRoot, handlers.roomsIndex] },
  { pattern: /^\/api\/rooms\/([^\/]+)\/?$/, modules: [handlers.roomsId] },
  { pattern: /^\/api\/auth\/login\/?$/, modules: [handlers.authLogin] },
  { pattern: /^\/api\/auth\/logout\/?$/, modules: [handlers.authLogout] },
  { pattern: /^\/api\/auth\/me\/?$/, modules: [handlers.authMe] },
  { pattern: /^\/api\/bookings\/?$/, modules: [handlers.bookingsIndex] },
  { pattern: /^\/api\/bookings\/status\/?$/, modules: [handlers.bookingsStatus] },
  { pattern: /^\/api\/bookings\/([^\/]+)\/?$/, modules: [handlers.bookingsId] },
  { pattern: /^\/api\/cleaning\/?$/, modules: [handlers.cleaningIndex] },
  { pattern: /^\/api\/cleaning\/([^\/]+)\/?$/, modules: [handlers.cleaningId] },
  { pattern: /^\/api\/customers\/?$/, modules: [handlers.customersIndex] },
  { pattern: /^\/api\/expenses\/?$/, modules: [handlers.expensesIndex] },
  { pattern: /^\/api\/notifications\/?$/, modules: [handlers.notificationsIndex] },
  { pattern: /^\/api\/notifications\/mark-all-read\/?$/, modules: [handlers.notificationsMarkAllRead] },
  { pattern: /^\/api\/notifications\/([^\/]+)\/?$/, modules: [handlers.notificationsId] },
  { pattern: /^\/api\/rate-plan-prices\/?$/, modules: [handlers.ratePlanPricesIndex] },
  { pattern: /^\/api\/rate-plans\/?$/, modules: [handlers.ratePlansIndex] },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS, PUT, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse path (ignore query string)
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const method = (req.method || 'GET').toUpperCase();
  
  let handlerFn: any = null;

  for (const route of routeTable) {
    const match = urlPath.match(route.pattern);
    if (match) {
      // Find the first module in this route that exports the requested HTTP method
      for (const mod of route.modules) {
        if (mod && typeof (mod as any)[method] === 'function') {
          handlerFn = (mod as any)[method];
          break;
        }
      }
      if (handlerFn) break;
    }
  }

  if (!handlerFn) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route not found or method not supported: ${method} ${urlPath}` } });
  }

  try {
    const fetchReq = buildFetchRequest(req);
    const fetchRes = await handlerFn(fetchReq);
    await sendFetchResponse(fetchRes, res);
  } catch (err: any) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Internal server error' } });
  }
}
