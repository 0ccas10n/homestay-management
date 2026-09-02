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
// In production, handlers are bundled by esbuild and passed as `handlerModules`.
// In development, handlers are loaded via tsx and passed the same way.
//
// ──────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';

const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT', 'HEAD'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

export interface MountedRoute {
  method: HttpMethod;
  expressPath: string; // e.g. /api/rooms/:id
  filePath: string;   // absolute path to the handler file
}

/**
 * Map of absolute handler file path → loaded module.
 * Passed in from server.ts so handlers are pre-bundled by esbuild.
 */
export type HandlerRegistry = Record<string, Record<string, unknown>>;

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
  if (contentType.includes('application/json')) {
    expressRes.setHeader('Content-Type', 'application/json; charset=utf-8');
    const text = await fetchRes.text();
    expressRes.end(text);
  } else if (contentType.includes('text/')) {
    expressRes.setHeader('Content-Type', contentType);
    expressRes.end(await fetchRes.text());
  } else {
    expressRes.end(Buffer.from(await fetchRes.arrayBuffer()));
  }
}

/**
 * Walk src/pages/api/** and return one MountedRoute per (method, file) pair.
 * Only scans the filesystem to discover URL paths; handler functions come
 * from the pre-loaded `handlerModules` registry.
 */
export async function scanRoutes(
  apiRoot: string,
  handlerModules: HandlerRegistry,
): Promise<MountedRoute[]> {
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
        !e.name.endsWith('.d.ts') &&
        e.name !== 'index.ts' // barrel file is not a handler
      ) {
        out.push(full);
      }
    }
    return out;
  }

  const files = await walk(apiRoot);
  const routes: MountedRoute[] = [];

  for (const abs of files) {
    const mod = handlerModules[abs];
    if (!mod) continue; // skip if not in registry (e.g. this file itself)

    const rel = path.relative(apiRoot, abs).replace(/\\/g, '/');
    // /api prefix is added so route paths line up with Vercel's convention
    // and with the Vite proxy target ('/api').
    const urlPath =
      '/api' +
      '/' +
      rel
        .replace(/\.(ts|js|mjs)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[(\w+)\]/g, ':$1');

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
export async function mountApiRoutes(
  app: Express,
  apiRoot: string,
  handlerModules: HandlerRegistry,
): Promise<MountedRoute[]> {
  app.use('/api', (req, res, next) => {
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
      return res.sendStatus(204);
    }
    next();
  });

  const routes = await scanRoutes(apiRoot, handlerModules);

  for (const route of routes) {
    const mod = handlerModules[route.filePath];
    const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'options' | 'put' | 'head';
    app.route(route.expressPath)[method](
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          const handler = mod[route.method] as ((req: Request) => Promise<Response>) | undefined;
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
