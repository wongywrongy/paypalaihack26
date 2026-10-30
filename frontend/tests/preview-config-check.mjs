import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';

const originalEnv = {
  ROOTLANE_PREVIEW_ORIGIN: process.env.ROOTLANE_PREVIEW_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
};
async function config(origin) {
  if (origin === undefined) delete process.env.ROOTLANE_PREVIEW_ORIGIN;
  else process.env.ROOTLANE_PREVIEW_ORIGIN = origin;
  return resolveConfig({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'silent',
  }, 'serve', 'production', 'production', true);
}

try {
  const local = await config();
  assert.deepEqual(local.preview.allowedHosts, []);
  assert.equal(local.server.proxy['/api'], 'http://127.0.0.1:8000');
  const remote = await config('https://neo.taile1abc7.ts.net:20001/');
  assert.deepEqual(remote.preview.allowedHosts, ['neo.taile1abc7.ts.net']);
  assert.deepEqual(remote.server.allowedHosts, []);
  assert.equal(remote.server.proxy['/api'], 'http://127.0.0.1:8000');
  await assert.rejects(() => config('https://.example.test'), /one exact hostname/);
  await assert.rejects(() => config('https://*.example.test'), /one exact hostname/);
  await assert.rejects(() => config('invalid-origin'), /Invalid URL/);
  console.log('Preview config passed: local defaults, exact Rootlane hostname, unchanged dev proxy, wildcard and malformed origin rejection.');
} finally {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
