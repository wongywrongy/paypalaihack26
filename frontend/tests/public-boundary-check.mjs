import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { build } from 'vite';
// Exercise the actual production module-graph guard, not just a text scan of JSON.
for (const entry of ['../design/scenario/scenario.json', 'tests/fixtures/shop-private.json']) {
  await assert.rejects(
    () => build({ logLevel: 'silent', build: { write: false, rollupOptions: { input: resolve(entry) } } }),
    /Private scenario\/test data must not enter the browser module graph/,
  );
}
console.log('Production bundling rejects raw scenario and private test-fixture entry points.');
