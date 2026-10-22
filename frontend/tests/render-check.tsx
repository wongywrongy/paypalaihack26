import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';
import { cents, fixture, money } from '../src/fixture';

const routes = [
  ['/invite', 'Haneul Beauty,'],
  ['/tell', 'What do you want?'],
  ['/review', 'Your order.'],
  ['/live', 'Working on a'],
  ['/ask', 'Same formula.'],
  ['/done', 'Deal reached.'],
  ['/receipt', 'All set.'],
  ['/deal', 'How the deal'],
  ['/missing', 'This page wandered off.'],
];

for (const [pathname, title] of routes) {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname } });
  const html = renderToStaticMarkup(<App />);
  assert.equal((html.match(/<h1>/g) || []).length, 1, pathname);
  assert.ok(html.includes(`<h1>${title}`), `${pathname}: expected route title`);
  assert.match(html, /[Ee]xample/, `${pathname}: explicit example label`);
  if (pathname !== '/deal') assert.equal((html.match(/class="primary"/g) || []).length, 1, pathname);
  console.log(`SSR ${pathname}: expected title, one heading, example label, action present`);
}

assert.equal(cents('1.3'), 130);
assert.equal(cents('0.01'), 1);
for (const invalid of ['-1', '1.234', '1e2', 'NaN', '']) assert.throws(() => cents(invalid));
assert.equal(fixture.costs.reduce((total, cost) => total + cost.cents, 0), fixture.total);
assert.equal(money(fixture.total), '$66.66');
assert.equal(fixture.max - fixture.total, 834);
assert.equal(fixture.saved, 5492);

const css = readFileSync('src/styles.css', 'utf8');
function color(token: string): string {
  const match = css.match(new RegExp(`--${token}:\\s*#([\\da-f]{3}|[\\da-f]{6})\\b`, 'i'));
  assert.ok(match, `Missing hex color token: ${token}`);
  return match[1].length === 3 ? [...match[1]].map(char => char + char).join('') : match[1];
}
function luminance(hex: string): number {
  return hex.match(/\w\w/g)!
    .map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
}
for (const [foreground, background] of [['muted', 'ground'], ['surface', 'accent'], ['ink', 'butter'], ['saving', 'mint']]) {
  const [light, dark] = [luminance(color(foreground)), luminance(color(background))].sort((a, b) => b - a);
  const contrast = (light + .05) / (dark + .05);
  assert.ok(contrast >= 4.5, `${foreground}/${background}: ${contrast.toFixed(2)}:1 is below 4.5:1`);
  console.log(`Static contrast ${foreground}/${background}: ${contrast.toFixed(2)}:1`);
}
console.log('SSR, fixture money and static token contrast passed. Browser layout, interactions and screenshots remain unverified; this does not pass GD.');
