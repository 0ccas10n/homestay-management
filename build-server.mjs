// build-server.mjs
// Bundles server.ts (including all API handlers) with @/ path aliases resolved.
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  outfile: 'dist/server.mjs',
  alias: {
    '@': './src',
  },
});
