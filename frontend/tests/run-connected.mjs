import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
await build({ entryPoints: ['tests/connected-check.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'test-results/connected-check.mjs', define: { 'import.meta.env': '{}' } });
execFileSync(process.execPath, ['test-results/connected-check.mjs'], { stdio: 'inherit' });
