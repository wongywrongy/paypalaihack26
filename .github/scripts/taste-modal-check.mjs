import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '../../frontend/node_modules/@playwright/test/index.mjs';

// Keep the pinned runtime probes consistent with native modal and scroll clipping.
const path = resolve(process.argv[2]);
let source = readFileSync(path, 'utf8');
const originalSource = source;
const start = 'export function frame() {';
const loop = "  for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote, li, a, button, span, div')) {";
assert.equal(source.split(start).length, 2, 'Pinned frame signature changed');
assert.equal(source.split(loop).length, 2, 'Pinned coverage loop changed');
source = source.replace(start, start + "\n  const activeModal = document.activeElement?.closest('dialog:modal') || [...document.querySelectorAll('dialog:modal')].at(-1);");
source = source.replace(loop, loop + '\n    if (activeModal && !activeModal.contains(el)) continue;');
const edgeStart = "  const edgeText = boxes.filter((b) => b.kind === 'text'";
assert.equal(source.split(edgeStart).length, 2, 'Pinned edge-text filter changed');
source = source.replace(edgeStart, `  const horizontallyVisible = (box) => {
    let left = box.l, right = box.r;
    for (let parent = box.el; parent && parent !== B; parent = parent.parentElement) {
      if (!/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowX)) continue;
      const rect = parent.getBoundingClientRect();
      left = Math.max(left, rect.left + parent.clientLeft);
      right = Math.min(right, rect.left + parent.clientLeft + parent.clientWidth);
    }
    return right > left;
  };
${edgeStart} && horizontallyVisible(b)`);
// Owner explicitly pinned cada967's surfaces. Scope this reviewed exception to
// the exact negative-spread token and its surface selectors; other depth still fails.
const heavyShadow = 'if (darkGround ? a >= 0.45 : ((a >= 0.12 && blur >= 12) || y >= 8 || a >= 0.25))';
assert.equal(source.split(heavyShadow).length, 2, 'Pinned shadow classifier changed');
source = source.replace(heavyShadow, `if (!(part.trim() === 'rgba(23, 22, 26, 0.16) 0px 10px 28px -16px' && el.matches('.shop-group,.total-card,.auction-item,.catalog > li,.routine,.rules label,.delivery-card,.auction-sticky,.auction-feed,.auction-box,.receipt-card')) && (darkGround ? a >= 0.45 : ((a >= 0.12 && blur >= 12) || y >= 8 || a >= 0.25)))`);
writeFileSync(path, source);
const { frame, layout, app } = await import(pathToFileURL(path).href);
const { layout: originalLayout, app: originalApp } = await import('data:text/javascript;base64,' + Buffer.from(originalSource).toString('base64'));
const browser = await chromium.launch({ ...(process.env.RALLY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.RALLY_CHROMIUM_EXECUTABLE } : { channel: 'chrome' }), args: ['--no-sandbox'] });
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
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.setContent('<style>body{margin:0;font:16px Arial}.rail{position:absolute;left:134px;top:100px;width:500px;height:60px;overflow-x:auto}.label{position:absolute;left:590px;white-space:nowrap}</style><div class="rail"><span class="label">Mask</span></div>');
  assert((await page.evaluate(originalLayout)).edgeText.some(item => item.text === 'Mask'), 'Baseline must reproduce the clipped-text false positive');
  assert(!(await page.evaluate(layout)).edgeText.some(item => item.text === 'Mask'), 'Fully clipped scroll content must not count as visible edge text');
  await page.locator('.rail').evaluate(rail => { rail.style.width = '634px'; });
  assert((await page.evaluate(layout)).edgeText.some(item => item.text === 'Mask'), 'Visible edge text inside a scroll container must still fail');
  await page.setContent('<style>body{margin:0;font:16px Arial}span{position:absolute;right:8px;top:100px}</style><span>Ordinary edge</span>');
  assert((await page.evaluate(layout)).edgeText.some(item => item.text === 'Ordinary edge'), 'Ordinary visible edge text must still fail');
  console.log('Scroll-clipping probe regression passed: baseline reproduced; fully clipped text excluded; visible scroller and ordinary edge text still detected.');
  await page.setContent('<style>body{margin:0;background:#f7f4f0;font:16px Arial}div{width:300px;height:120px;padding:16px;margin:32px;background:white;box-shadow:0 1px 2px rgba(23,22,26,.04),0 10px 28px -16px rgba(23,22,26,.16)}</style><div class="shop-group">Reviewed Rally surface</div>');
  assert.equal((await page.evaluate(originalApp)).panels.heavyShadows, 1, 'Baseline must reproduce the pinned surface finding');
  assert.equal((await page.evaluate(app)).panels.heavyShadows, 0, 'Only the owner-approved surface token is an exception');
  await page.locator('div').evaluate(el => { el.className = 'unapproved'; });
  assert.equal((await page.evaluate(app)).panels.heavyShadows, 1, 'Unrelated elements with the same shadow must still fail');
  await page.locator('div').evaluate(el => { el.className = 'shop-group'; el.style.boxShadow = '0 10px 28px rgba(23,22,26,.16)'; });
  assert.equal((await page.evaluate(app)).panels.heavyShadows, 1, 'Stronger surface depth must still fail');
  console.log('Pinned surface regression passed: exact owner-approved token only; unrelated and stronger shadows still detected.');
} finally {
  await browser.close();
}
