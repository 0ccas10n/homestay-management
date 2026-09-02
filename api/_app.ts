// ─── Catch-all Vercel Serverless Function ─────────────────────────────────────
// This file replaces the multiple fragmented API files. It acts as a single
// Serverless Function that maps Vercel HTTP requests to the Fetch API handlers
// in src/pages/api/**.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as handlers from '../src/pages/api/index';

// Convert Fetch API Request to Vercel Request is done inside handler
function buildFetchRequest(req: VercelRequest): Request {
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost';
  const fullUrl = `${protocol}://${host}${req.url}`;
  
  const init: RequestInit = {
    method: req.method,
    headers: new Headers(req.headers as any),
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    // If Vercel already parsed the body as an object (e.g. JSON), stringify it
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      init.body = JSON.stringify(req.body);
      // Ensure content-type is set if not present
      if (!init.headers?.has('content-type')) {
        (init.headers as Headers).set('content-type', 'application/json');
      }
    } else {
      init.body = req.body;
    }
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

// A static list of routes mapping to their export names in src/pages/api/index
const routeTable = [
  { pattern: /^\/api\/availability\/?$/, exportName: 'availability' },
  { pattern: /^\/api\/dashboard\/?$/, exportName: 'dashboard' },
  { pattern: /^\/api\/health\/?$/, exportName: 'health' },
  { pattern: /^\/api\/locations\/?$/, exportName: 'locations' },
  { pattern: /^\/api\/rooms\/?$/, exportNames: ['roomsRoot', 'roomsIndex'] },
  { pattern: /^\/api\/rooms\/([^\/]+)\/?$/, exportName: 'roomsId' },
  { pattern: /^\/api\/auth\/login\/?$/, exportName: 'authLogin' },
  { pattern: /^\/api\/auth\/logout\/?$/, exportName: 'authLogout' },
  { pattern: /^\/api\/auth\/me\/?$/, exportName: 'authMe' },
  { pattern: /^\/api\/bookings\/?$/, exportName: 'bookingsIndex' },
  { pattern: /^\/api\/bookings\/status\/?$/, exportName: 'bookingsStatus' },
  { pattern: /^\/api\/bookings\/([^\/]+)\/?$/, exportName: 'bookingsId' },
  { pattern: /^\/api\/cleaning\/?$/, exportName: 'cleaningIndex' },
  { pattern: /^\/api\/cleaning\/([^\/]+)\/?$/, exportName: 'cleaningId' },
  { pattern: /^\/api\/customers\/?$/, exportName: 'customersIndex' },
  { pattern: /^\/api\/expenses\/?$/, exportName: 'expensesIndex' },
  { pattern: /^\/api\/notifications\/?$/, exportName: 'notificationsIndex' },
  { pattern: /^\/api\/notifications\/mark-all-read\/?$/, exportName: 'notificationsMarkAllRead' },
  { pattern: /^\/api\/notifications\/([^\/]+)\/?$/, exportName: 'notificationsId' },
  { pattern: /^\/api\/rate-plan-prices\/?$/, exportName: 'ratePlanPricesIndex' },
  { pattern: /^\/api\/rate-plans\/?$/, exportName: 'ratePlansIndex' },
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

  try {
    // Parse path (ignore query string)
    const urlPath = req.url ? req.url.split('?')[0] : '';
    const method = (req.method || 'GET').toUpperCase();
    
    let handlerFn: any = null;

    for (const route of routeTable) {
      const match = urlPath.match(route.pattern);
      if (match) {
        const exportNames = route.exportNames || [route.exportName];
        for (const name of exportNames) {
          const mod = (handlers as any)[name!];
          if (mod && typeof mod[method] === 'function') {
            handlerFn = mod[method];
            break;
          }
        }
        if (handlerFn) break;
      }
    }

    if (!handlerFn) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route not found or method not supported: ${method} ${urlPath}` } });
    }

    const fetchReq = buildFetchRequest(req);
    const fetchRes = await handlerFn(fetchReq);
    await sendFetchResponse(fetchRes, res);
  } catch (err: any) {
    console.error('API Error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: err?.message || 'Internal server error',
        stack: err?.stack
      } 
    });
  }
}
