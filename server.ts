import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { mountApiRoutes } from './server/routeScanner';
import { loadEnv } from './server/env';
import type { HandlerRegistry } from './server/routeScanner';

// Statically import all API handlers. esbuild bundles these (including resolving
// @/... path aliases) so they work in production without any loader.
import * as availability from './src/pages/api/availability';
import * as dashboard from './src/pages/api/dashboard';
import * as locations from './src/pages/api/locations';
import * as roomsRoot from './src/pages/api/rooms';
import * as authLogin from './src/pages/api/auth/login';
import * as authLogout from './src/pages/api/auth/logout';
import * as authMe from './src/pages/api/auth/me';
import * as bookingsIndex from './src/pages/api/bookings/index';
import * as bookingsStatus from './src/pages/api/bookings/status';
import * as bookingsId from './src/pages/api/bookings/[id]';
import * as cleaningIndex from './src/pages/api/cleaning/index';
import * as cleaningId from './src/pages/api/cleaning/[id]';
import * as customersIndex from './src/pages/api/customers/index';
import * as expensesIndex from './src/pages/api/expenses/index';
import * as notificationsIndex from './src/pages/api/notifications/index';
import * as notificationsMarkAllRead from './src/pages/api/notifications/mark-all-read';
import * as notificationsId from './src/pages/api/notifications/[id]';
import * as ratePlanPricesIndex from './src/pages/api/rate-plan-prices/index';
import * as ratePlansIndex from './src/pages/api/rate-plans/index';
import * as roomsIndex from './src/pages/api/rooms/index';
import * as roomsId from './src/pages/api/rooms/[id]';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the actual project root.
 *
 * In development, this file lives at the project root, so __dirname is the
 * root and `src/pages/api` is a direct child.
 *
 * In production this file has been bundled by esbuild to `dist/server.mjs`,
 * so __dirname is `dist/` and we need to walk up one level to reach the
 * project root. To stay correct if the bundle ever moves, we walk up until
 * we find `src/pages/api` (with a hard cap to avoid runaway loops).
 */
function resolveProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'src', 'pages', 'api'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume bundled layout (dist/<file>), root is the parent dir.
  return path.resolve(startDir, '..');
}

const ROOT = resolveProjectRoot(__dirname);
const apiRoot = path.join(ROOT, 'src', 'pages', 'api');

const PORT = 3000;

/**
 * Build a handler registry mapping absolute file paths to their loaded modules.
 * The paths must match what scanRoutes() discovers via the filesystem walk.
 */
function buildHandlerRegistry(baseDir: string): HandlerRegistry {
  const p = (...segments: string[]) => path.resolve(baseDir, ...segments);
  return {
    [p('src', 'pages', 'api', 'availability.ts')]: availability,
    [p('src', 'pages', 'api', 'dashboard.ts')]: dashboard,
    [p('src', 'pages', 'api', 'locations.ts')]: locations,
    [p('src', 'pages', 'api', 'rooms.ts')]: roomsRoot,
    [p('src', 'pages', 'api', 'auth', 'login.ts')]: authLogin,
    [p('src', 'pages', 'api', 'auth', 'logout.ts')]: authLogout,
    [p('src', 'pages', 'api', 'auth', 'me.ts')]: authMe,
    [p('src', 'pages', 'api', 'bookings', 'index.ts')]: bookingsIndex,
    [p('src', 'pages', 'api', 'bookings', 'status.ts')]: bookingsStatus,
    [p('src', 'pages', 'api', 'bookings', '[id].ts')]: bookingsId,
    [p('src', 'pages', 'api', 'cleaning', 'index.ts')]: cleaningIndex,
    [p('src', 'pages', 'api', 'cleaning', '[id].ts')]: cleaningId,
    [p('src', 'pages', 'api', 'customers', 'index.ts')]: customersIndex,
    [p('src', 'pages', 'api', 'expenses', 'index.ts')]: expensesIndex,
    [p('src', 'pages', 'api', 'notifications', 'index.ts')]: notificationsIndex,
    [p('src', 'pages', 'api', 'notifications', 'mark-all-read.ts')]: notificationsMarkAllRead,
    [p('src', 'pages', 'api', 'notifications', '[id].ts')]: notificationsId,
    [p('src', 'pages', 'api', 'rate-plan-prices', 'index.ts')]: ratePlanPricesIndex,
    [p('src', 'pages', 'api', 'rate-plans', 'index.ts')]: ratePlansIndex,
    [p('src', 'pages', 'api', 'rooms', 'index.ts')]: roomsIndex,
    [p('src', 'pages', 'api', 'rooms', '[id].ts')]: roomsId,
  };
}

async function startServer() {
  // Load .env into process.env before any handler imports
  loadEnv(path.join(ROOT, '.env'));

  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        env: process.env.NODE_ENV ?? 'development',
        spreadsheetId: process.env.SPREADSHEET_ID ? 'configured' : 'in-memory-fallback',
      },
    });
  });

  // Mount discovered API routes under /api/*
  console.log('\n  [api] Mounting route handlers…');
  await mountApiRoutes(app, apiRoot, buildHandlerRegistry(ROOT));

  // Error handling middleware for API routes
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);

    const isJsonParseError =
      err instanceof SyntaxError && (err as any).type === 'entity.parse.failed';

    if (isJsonParseError) {
      console.warn('[api] Malformed JSON body:', err.message);
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body is not valid JSON',
        },
      });
      return;
    }

    console.error('[api] Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err?.message ?? 'Unhandled server error',
      },
    });
  });

  // Vite middleware in dev or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
