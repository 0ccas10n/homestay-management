import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { mountApiRoutes } from './server/routeScanner';
import { loadEnv } from './server/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const apiRoot = path.join(ROOT, 'src', 'pages', 'api');

const PORT = 3000;

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
  await mountApiRoutes(app, apiRoot);

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
