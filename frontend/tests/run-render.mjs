import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
for (const enabled of ['0', '1']) {
  await build({ entryPoints: ['tests/render-check.tsx'], bundle: true, platform: 'node', jsx: 'automatic', outfile: 'test-results/render-check.cjs', define: { 'import.meta.env': JSON.stringify({ VITE_RALLY_TEST_HARNESS: enabled }) } });
  console.log(enabled === '1' ? 'Checking explicit CI harness build.' : 'Checking ordinary production mode, including query-string bypass rejection.');
  execFileSync(process.execPath, ['test-results/render-check.cjs'], { stdio: 'inherit' });
}
