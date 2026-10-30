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

const production = await build({ logLevel: 'silent', build: { write: false } });
for (const chunk of production.output.filter(item => item.type === 'chunk')) {
  for (const [id, module] of Object.entries(chunk.modules)) {
    if (id.endsWith('/recorded-review.json')) assert.equal(module.renderedLength, 0, 'Production must erase the recorded review');
  }
}
console.log('Production contains no authored auction or exchange recording.');
