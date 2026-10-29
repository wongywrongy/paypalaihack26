import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const source = JSON.parse(readFileSync(new URL('../../design/scenario/scenario.json', import.meta.url), 'utf8'));
const market = JSON.parse(readFileSync(new URL('../../design/scenario/market.json', import.meta.url), 'utf8'));
const auction = JSON.parse(readFileSync(new URL('../../design/scenario/auction.json', import.meta.url), 'utf8'));
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
// Build-time allowlist: the raw scenario (including shop economics) never enters Vite's graph.
const projection = {
  auction: pick(auction, ['cart', 'rules', 'bids', 'rounds', 'award', 'golden']),
  fx_usd: source.fx_usd,
  rally_fee_usd: source.rally_fee_usd,
  shops: Object.fromEntries(Object.entries(source.shops).map(([id, shop]) => [id, pick(shop, ['name', 'city', 'kind', 'ships_abroad', 'domestic', 'free_over'])])),
  catalog: source.catalog.map(product => ({ ...pick(product, ['id', 'brand', 'name', 'size', 'category', 'weight_kg', 'prices', 'old_packaging', 'not_to', 'aerosol']), ...(market[product.id] ? { market: pick(market[product.id], ['low_usd_cents', 'median_usd_cents', 'high_usd_cents', 'n', 'as_of']) } : {}) })),
  countries: Object.fromEntries(Object.entries(source.countries).map(([id, country]) => [id, pick(country, ['name', 'region', 'currency', 'tax_name', 'duty_note', 'deal', 'listed'])])),
  hero: pick(source.hero, ['country', 'request', 'cart', 'rules', 'listed', 'deal', 'hold', 'charged', 'released', 'mask_saves', 'direct', 'saved_vs_listed', 'saved_vs_direct', 'events']),
};
const target = new URL('src/data/public-scenario.json', root);
const text = JSON.stringify(projection, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== text) throw new Error('Public scenario is stale; run npm run scenario:project');
  console.log('Public projection matches the scenario allowlist; private shop economics excluded.');
} else writeFileSync(target, text);
