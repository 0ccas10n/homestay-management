// ─── routeScanner.ts ─────────────────────────────────────────────────────────
//
// Discovers API route handler files under src/pages/api/** and maps them to
// Express routes. This mirrors the Vercel file-based routing convention:
//
//   src/pages/api/rooms.ts              → GET    /api/rooms
//   src/pages/api/rooms/index.ts        → POST   /api/rooms
//   src/pages/api/rooms/[id].ts         → PATCH  /api/rooms/:id
//                                          DELETE /api/rooms/:id
//   src/pages/api/auth/login.ts         → POST   /api/auth/login
//   src/pages/api/availability.ts       → GET    /api/availability
//
// The exported handler signature must match the Web Fetch API:
//
//   export async function GET(request: Request): Promise<Response> { ... }
//
// Dynamic segments ([id]) become Express `:id` parameters, accessible via
// request.url in the handler (e.g. new URL(request.url).pathname.split('/')).
//
// ──────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';

const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT', 'HEAD'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

export interface MountedRoute {
  method: HttpMethod;
  expressPath: string; // e.g. /api/rooms/:id
  filePath: string;    // absolute path to the handler file
}

/**
 * Convert an Express request into a Fetch API Request object that the
 * existing route handlers can consume unchanged. Body is taken from
 * req.body (which express.json() has already parsed) and re-serialized
 * because the existing handlers call request.json() directly.
 */
function buildFetchRequest(req: ExpressRequest, originalUrl: string): Request {
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost';
  const fullUrl = `${protocol}://${host}${originalUrl}`;

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
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  return new Request(fullUrl, init);
}

/**
 * Copy a Fetch API Response back into Express's res object.
 * Set-Cookie headers must be split because fetch's Headers joins them
 * with commas, which breaks cookie semantics.
 */
async function sendFetchResponse(fetchRes: Response, expressRes: ExpressResponse): Promise<void> {
  expressRes.status(fetchRes.status);
  fetchRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const parts = value.split(/,(?=[^;]+=[^;]+)/);
      for (const part of parts) expressRes.append('Set-Cookie', part.trim());
      return;
    }
    expressRes.setHeader(key, value);
  });

  const contentType = fetchRes.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    expressRes.send(await fetchRes.text());
  } else {
    expressRes.end(Buffer.from(await fetchRes.arrayBuffer()));
  }
}

/**
 * Walk src/pages/api/** and return one MountedRoute per (method, file) pair.
 * A cache-busting query string is appended to every dynamic import so that
 * tsx watch mode picks up edits in dev without restarting the server.
 */
export async function scanRoutes(apiRoot: string): Promise<MountedRoute[]> {
  const fs = await import('node:fs/promises');

  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...await walk(full));
      } else if (
        e.isFile() &&
        (e.name.endsWith('.ts') || e.name.endsWith('.js')) &&
        !e.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
    return out;
  }

  const files = await walk(apiRoot);
  const routes: MountedRoute[] = [];

  for (const abs of files) {
    const rel = path.relative(apiRoot, abs).replace(/\\/g, '/');
    // /api prefix is added so route paths line up with Vercel's convention
    // and with the Vite proxy target ('/api').
    const urlPath =
      '/api' +
      '/' +
      rel
        .replace(/\.(ts|js)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[(\w+)\]/g, ':$1');

    const mod: Record<string, unknown> = await import(
      pathToFileURL(abs).href + `?t=${Date.now()}`
    );

    for (const method of HTTP_METHODS) {
      if (typeof mod[method] === 'function') {
        routes.push({ method, expressPath: urlPath, filePath: abs });
      }
    }
  }

  return routes;
}

/**
 * Mount every discovered route on the Express app and respond to OPTIONS
 * preflights for the entire /api/* tree.
 */
export async function mountApiRoutes(app: Express, apiRoot: string): Promise<MountedRoute[]> {
  app.options('/api/*', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204);
  });

  const routes = await scanRoutes(apiRoot);

  for (const route of routes) {
    const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'options' | 'put' | 'head';
    app.route(route.expressPath)[method](
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const handlerMod: Record<string, any> = await import(
            pathToFileURL(route.filePath).href + `?t=${Date.now()}`
          );
          const handler = handlerMod[route.method];
          if (typeof handler !== 'function') {
            res.status(500).json({
              success: false,
              error: {
                code: 'NO_HANDLER',
                message: `${route.method} not exported from ${route.filePath}`,
              },
            });
            return;
          }

          const fetchReq = buildFetchRequest(req, req.originalUrl);
          const fetchRes: Response = await handler(fetchReq);
          await sendFetchResponse(fetchRes, res);
        } catch (err) {
          next(err);
        }
      },
    );
    const rel = path.relative(apiRoot, route.filePath).replace(/\\/g, '/');
    console.log(`  [api] ${route.method.padEnd(6)} ${route.expressPath}  ←  ${rel}`);
  }

  return routes;
}
