import { orderNumber } from '../src/connected';
import { AuctionPlayback } from '../src/components/AuctionDeal';
import MarketRange from '../src/components/MarketRange';
import { applyAuctionEvent, initialAuction } from '../src/auction';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';
import { BagProvider } from '../src/state';
import { Orders, Products, Settings } from '../src/routes/shops/Workspace';
import shopData from './fixtures/shop-private.json' with { type: 'json' };
import type { ShopSnapshot } from '../src/shop-api';
import { applyEvent, initialDeal } from '../src/deal';
import { auctionEvents, auctionBreakdown, allowed, catalog, cents, countries, countryCodes, events, finalLines, hero, landed, listedLines, money, quote, recordedMode } from '../src/fixture';

const forbidden = /\b(example|preview|fixture|simulated|demo)\b/i;
function render(path: string, test = false) {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: path, search: test ? '?test=recorded' : '' } });
  return renderToStaticMarkup(<App />);
}
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  for (const country of ['__proto__', 'toString', 'constructor', null, { US: true }]) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => JSON.stringify({ country, items: [], rules: { old_packaging_ok: true, bundles_ok: true } }),
    } });
    const html = render('/shop');
    assert.ok(html.includes('Ship to United States · USD'), 'invalid persisted country recovers to US');
    assert.ok(html.includes('aria-label="Bag, 0 items"'), 'invalid state recovers to an empty bag');
  }
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
console.log('Persisted prototype-key and malformed destinations safely recover.');
for (const route of ['/shop','/ship-to','/ask','/bag','/deal','/paid','/track','/shops/orders','/shops/products','/shops/settings','/shops/activity','/missing']) {
  for (const test of [false,true]) {
    const html = render(route, test);
    assert.ok(html.includes('<h1'), route);
    assert.doesNotMatch(html.replace(/<[^>]*>/g,''), forbidden, route);
    if ((!test || !recordedMode()) && ['/deal','/paid','/track'].includes(route)) assert.ok(html.includes('Complete checkout to see your order here.'));
    if (!test && route.startsWith('/shops')) { assert.ok(html.includes('Loading your workspace')); assert.ok(!html.includes('Lowest price')); }
    console.log(`SSR ${route}: ${test ? 'recorded URL query' : 'ordinary URL'} render and copy guard passed`);
  }
}
for (const Page of [Orders, Products, Settings]) {
  const html = renderToStaticMarkup(<BagProvider><Page data={shopData as ShopSnapshot} /></BagProvider>);
  assert.doesNotMatch(html.replace(/<[^>]*>/g,''), forbidden);
  assert.ok(html.length > 500);
}
assert.equal(cents('1.3'),130); assert.equal(cents('0.01'),1);
for (const value of ['-1','1.234','1e2','NaN','','100000000000000000']) assert.throws(() => cents(value));
assert.equal(catalog.length,30);
for (const country of countryCodes) {
  const before = quote(hero.cart, country).breakdown;
  const after = landed(finalLines, country, 50);
  for (const [actual, expected] of [[before,countries[country].listed],[after,countries[country].deal]] as const) {
    for (const key of ['goods','domestic','shipping','duty','tax','fee','total'] as const) assert.equal(actual[key],cents(expected[key]), `${country} ${key}`);
    assert.equal(actual.goods+actual.domestic+actual.shipping+actual.duty+actual.tax+actual.fee, actual.total);
  }
}
assert.equal(money(landed(finalLines,'US',50).total),'$106.79');
assert.equal(allowed(catalog.find(item => item.id === 'mul-sun-essence')!,'US'),false);
assert.throws(() => quote(['mul-sun-essence'],'US'));
assert.throws(() => quote(['sae-mist-spray'],'CA'));
let state = initialDeal();
const totalChanges = [state.totalUsd];
for (const event of events) { state = applyEvent(state,event); if (totalChanges.at(-1) !== state.totalUsd) totalChanges.push(state.totalUsd); assert.equal(applyEvent(state,event), state, 'duplicate delivery is idempotent'); }
assert.deepEqual(totalChanges,[11882,11775,10679]);
assert.equal(state.done,true); assert.equal(state.elapsed,14);
for (const line of finalLines) assert.equal(state.shops[line.shop]!.lines[line.id].asking,line.unit);
assert.deepEqual(events.reduce(applyEvent,initialDeal()),state,'replay rebuilds final state');
const projection = readFileSync('src/data/public-scenario.json','utf8');
assert.doesNotMatch(projection,/"(?:private|floor|cost|shop_gain|profit|gain)"/);
assert.doesNotMatch(readFileSync('src/fixture.ts','utf8'),/design\/scenario/);
const css = readFileSync('src/styles.css','utf8');
const color=(token:string)=>{const hex=css.match(new RegExp(`--${token}:\\s*#([\\da-f]{3}|[\\da-f]{6})\\b`,'i'))![1];return hex.length===3?[...hex].map(c=>c+c).join(''):hex;};
const luminance=(hex:string)=>hex.match(/\w\w/g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
for(const [fg,bg] of [['muted','ground'],['surface','accent'],['ink','butter'],['saving','mint']]) { const [light,dark]=[luminance(color(fg)),luminance(color(bg))].sort((a,b)=>b-a); assert.ok((light+.05)/(dark+.05)>=4.5); }
console.log('All five currency golden quotes, public projection, event replay, scoped shop SSR and static contrast passed. Browser screenshots and real payments are separate gates.');

const auction = auctionEvents.reduce(applyAuctionEvent, initialAuction(11882));
assert.equal(auction.total, 10192); assert.equal(auction.done, true);
assert.equal(auction.items['mul-gel-cleanser'].winner, 'haneul');
assert.deepEqual(auctionEvents.filter(event => event.kind === 'round').map(event => event.total), [11029, 10542, 10192]);
assert.equal(applyAuctionEvent(auction, auctionEvents.at(-1)!), auction);
assert.throws(() => applyAuctionEvent(auction, { id: 'over-hold', seq: 99, t: 12, kind: 'done', total: 11883 }));
for (const [country, total] of Object.entries({ US: 10192, CA: 13825, GB: 8055, DE: 9621, AU: 14835 })) assert.equal(auctionBreakdown(country as keyof typeof countries).total, total);
console.log('Auction replay, round totals, winners, ceiling, idempotency and five currency goldens passed.');

const awarded = auctionEvents.find(event => event.kind === 'award')!;
if (awarded.kind === 'award') {
  const split = applyAuctionEvent(auction, { ...awarded, id: 'rival-cream', winners: { ...awarded.winners, 'mul-gel-cleanser': { shop: 'haneul', unit: 1100, variant: null, bundle: false }, 'sae-cica-cream': { shop: 'bada', unit: 1600, variant: null, bundle: false } } });
  assert.equal(split.items['mul-gel-cleanser'].lanes.find(lane => lane.won)!.perks.includes('bundle'), false, 'a partial bundle never appears as a receipt perk');
}

if (awarded.kind === 'award') {
  const winners = Object.fromEntries(Object.entries(awarded.winners).map(([pid, winner]) => [pid, { ...winner, unit: winner.unit - 50, bundle: false }]));
  const overridden = applyAuctionEvent(auction, { ...awarded, id: 'individual-award', winners });
  for (const item of Object.values(overridden.items)) assert.equal(item.lanes.find(lane => lane.won)!.perks.includes('bundle'), false);
}

assert.equal(renderToStaticMarkup(<MarketRange />), '');
assert.ok(renderToStaticMarkup(<MarketRange reference={{ low_usd_cents: 1800, median_usd_cents: 2200, high_usd_cents: 2600, n: 5, as_of: '2026-10-29' }} />).includes('$22'));

const orderId = 'a1b2c345-6789-4abc-9876-123456789abc';
assert.equal(orderNumber(orderId), 'RL-A1B2C');
assert.equal(orderNumber('RL-24817'), 'RL-24817');
const permittedNotes = new Set(auctionEvents.filter(event => ['bid', 'ask', 'round', 'award'].includes(event.kind)).map(event => event.note));
assert.ok(auction.feed.every(line => permittedNotes.has(line.text)));
for (const kind of ['error', 'done', 'pass'] as const) {
  const quiet = applyAuctionEvent(auction, { id: `quiet-${kind}`, seq: 100, t: 12, kind, shop: 'haneul', items: [], note: 'This must never be the live message.' });
  assert.deepEqual(quiet.feed, auction.feed);
}
const dealHtml = renderToStaticMarkup(<BagProvider><AuctionPlayback events={auctionEvents} maximum={11882} country="US" id={orderId} paid replayInitially={false} /></BagProvider>);
assert.ok(dealHtml.includes('Order RL-A1B2C'));
assert.ok(!dealHtml.includes('order choices saved at checkout'));
assert.ok(!dealHtml.includes(`Order ${orderId}`));
console.log('Short order header and bid/ask/round/award-only live messages passed.');

for (const [n, high] of [[4,2600],[5,5000]]) assert.equal(renderToStaticMarkup(<MarketRange reference={{low_usd_cents:1800,median_usd_cents:2200,high_usd_cents:high,n,as_of:'2026-10-30'}} />), '');
