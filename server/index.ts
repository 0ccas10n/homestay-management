// ─── Local API server ─────────────────────────────────────────────────────────
//
// Stand-in for the Vercel Serverless Functions runtime so the app can run end
// to end against Google Sheets without deploying. The route scanner discovers
// every file under src/pages/api/** and mounts it on Express, preserving the
// existing Web Fetch API handler signatures.
//
// Usage (from package.json scripts):
//   npm run dev:server      # API on http://localhost:8787
//   npm run dev:all         # Vite on :8443 + API on :8787, auto-proxied
//
// ──────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { mountApiRoutes } from './routeScanner';
import { loadEnv } from './env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const apiRoot = path.join(ROOT, 'src', 'pages', 'api');

async function main() {
  // Load .env into process.env before any handler imports.
  // `--env-file=.env` does this in newer Node, but tsx sometimes swallows it;
  // doing it explicitly also keeps us compatible with older Node versions.
  loadEnv(path.join(ROOT, '.env'));

  const port = Number(process.env.API_PORT ?? 8787);

  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        env: process.env.NODE_ENV ?? 'development',
        spreadsheetId: process.env.SPREADSHEET_ID ? 'configured' : 'missing',
      },
    });
  });

  console.log('\n  [api] Mounting route handlers…');
  await mountApiRoutes(app, apiRoot);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;

    // body-parser raises SyntaxError with `type === 'entity.parse.failed'` when
    // the request body isn't valid JSON. Convert that into a 400 so a malformed
    // payload from a client doesn't take the whole process down.
    const isJsonParseError =
      err instanceof SyntaxError &&
      (err as any).type === 'entity.parse.failed';

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

  app.listen(port, '0.0.0.0', () => {
    console.log(`\n  [api] Listening on http://localhost:${port}`);
    console.log(`  [api] Health check: http://localhost:${port}/api/health`);
    console.log(`  [api] Press Ctrl+C to stop.\n`);
  });
}

main().catch((err) => {
  console.error('[api] Fatal startup error:', err);
  process.exit(1);
});
