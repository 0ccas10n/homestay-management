// ─── env.ts ────────────────────────────────────────────────────────────────────
//
// Minimal .env loader — we deliberately do NOT install `dotenv` for this single
// use case. The format is straightforward (KEY=value, # comments, optional
// surrounding double quotes) and keeping the surface minimal reduces the risk
// of behavior drift between Vite's loader and ours.
//
// Loaded values are only added to process.env if not already present, so values
// injected by the shell or by tsx's --env-file take precedence.
//
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.warn(`[env] ${filePath} not found — relying on existing process.env`);
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  let count = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      value.length >= 2 &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) {
      process.env[key] = value;
      count++;
    }
  }

  console.log(`[env] Loaded ${count} variable(s) from ${path.basename(filePath)}`);
}
