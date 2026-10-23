import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '../../frontend/node_modules/@playwright/test/index.mjs';

// Scope only the runtime coverage probe to the active native modal, like browser hit-testing.
const path = resolve(process.argv[2]);
let source = readFileSync(path, 'utf8');
const start = 'export function frame() {';
const loop = "  for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote, li, a, button, span, div')) {";
assert.equal(source.split(start).length, 2, 'Pinned frame signature changed');
assert.equal(source.split(loop).length, 2, 'Pinned coverage loop changed');
source = source.replace(start, start + "\n  const activeModal = document.activeElement?.closest('dialog:modal') || [...document.querySelectorAll('dialog:modal')].at(-1);");
source = source.replace(loop, loop + '\n    if (activeModal && !activeModal.contains(el)) continue;');
writeFileSync(path, source);
const { frame } = await import(pathToFileURL(path).href);
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const style = '<style>body{margin:0}h1{font:32px/1.4 sans-serif;margin:20px}dialog{width:500px;height:250px} .cover{position:absolute;inset:0;background:white;z-index:2}</style>';
  await page.setContent(style + '<h1>Background title</h1><dialog><h1>Covered modal title</h1><div class="cover"></div></dialog>');
  await page.locator('dialog').evaluate(dialog => dialog.showModal());
  const modal = await page.evaluate(frame);
  assert(!modal.covered.some(item => item.text === 'Background title'), 'Native modal background is intentionally inert');
  assert(modal.covered.some(item => item.text === 'Covered modal title'), 'Coverage failures inside the modal must remain detectable');
  await page.setContent(style + '<h1>Covered ordinary title</h1><div class="cover"></div>');
  const ordinary = await page.evaluate(frame);
  assert(ordinary.covered.some(item => item.text === 'Covered ordinary title'), 'Ordinary coverage failures must remain detectable');
  console.log('Native-modal probe regression passed: inert background excluded; covered modal and ordinary text still detected.');
} finally {
  await browser.close();
}
