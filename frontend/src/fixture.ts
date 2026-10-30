import data from './data/public-scenario.json' with { type: 'json' };
import reviewData from './data/recorded-review.json' with { type: 'json' };
// Node contract helpers and the explicit harness may read recordings; ordinary Vite builds erase them.
declare const __RALLY_TEST_HARNESS__: boolean;
const review = typeof __RALLY_TEST_HARNESS__ === 'undefined' || __RALLY_TEST_HARNESS__ ? reviewData : null;
export type CountryCode = keyof typeof data.countries;
export type ShopId = keyof typeof data.shops;
export type Currency = 'USD' | 'CAD' | 'GBP' | 'EUR' | 'AUD';
export type MarketReference = { median_usd_cents: number; low_usd_cents?: number; high_usd_cents?: number; n: number; as_of: string };
export type Product = { id: string; brand: string; name: string; size: string; category: string; weight_kg: string; prices: Partial<Record<ShopId,string>>; not_to?: string[]; aerosol?: boolean; old_packaging?: string; market?: MarketReference | null };
export type Rules = { old_packaging_ok: boolean; bundles_ok: boolean };
export type Line = { id: string; shop: ShopId; unit: number; variant?: string; added?: boolean; bundle?: boolean; bestListed?: number };
export type Breakdown = { currency: Currency; goods: number; domestic: number; shipping: number; duty: number; tax: number; fee: number; total: number };
export type DealEvent = { id: string; t: number; shop?: ShopId; actor?: 'rally' | 'shop'; kind: 'offer' | 'counter' | 'accept' | 'done'; lines?: Record<string,number>; extras?: string[]; domestic?: number; total?: number; note?: string; final?: boolean };
export const cents = (value: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid amount');
  const [whole, decimal = ''] = value.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds integer precision');
  return result;
};
export const catalog = data.catalog as Product[];
export const shops = data.shops;
export const countries = data.countries;
export const countryCodes = Object.keys(countries) as CountryCode[];
export const hero = { ...(review?.hero || {}), rules: { old_packaging_ok: true, bundles_ok: true } } as Omit<typeof reviewData.hero, 'rules'> & { rules: Rules };
// Recorded order identity and consent are an immutable checkout snapshot, never the current bag.
const recordedCountry = (review?.hero.country || 'US') as CountryCode;
export const recordedOrder = Object.freeze({ id: 'RL-24817', country: recordedCountry, destination: countries[recordedCountry].region || countries[recordedCountry].name, currency: countries[recordedCountry].currency as Currency, items: Object.freeze([...(review?.hero.cart || [])]), rules: Object.freeze({ ...hero.rules }) });
export const product = (id: string) => { const found = catalog.find(item => item.id === id); if (!found) throw new Error('Unknown product'); return found; };
export const allowed = (item: Product, country: CountryCode) => !item.aerosol && !item.not_to?.includes(country);
export const currency = (country: CountryCode): Currency => countries[country].currency as Currency;
export const local = (usd: number, country: CountryCode) => Math.floor((usd * cents(data.fx_usd[currency(country)]) + 50) / 100);
export const money = (minor: number, code: Currency = 'USD') => {
  const symbols = { USD: '$', CAD: 'C$', GBP: '£', EUR: '€', AUD: 'A$' };
  return symbols[code] + (minor / 100).toFixed(2);
};
export const price = (usd: number, country: CountryCode) => money(local(usd, country), currency(country));
export const localizeNote = (note: string, country: CountryCode) => note.replace(/\$(\d+(?:\.\d{1,2})?)/g, (_, amount: string) => price(cents(amount), country));
export const rates = {
  US: { tax: 925, duty: 1250, taxShipping: false, shipping: [1400,1700,2100,2500], summary: '12.5% duty · sales tax (est.)' },
  CA: { tax: 1300, duty: 0, taxShipping: true, shipping: [1500,1800,2200,2600], summary: 'No duty · 13% HST (est.)' },
  GB: { tax: 2000, duty: 0, taxShipping: true, shipping: [1500,1800,2300,2700], summary: 'No duty · 20% VAT (est.)' },
  DE: { tax: 1900, duty: 0, taxShipping: true, shipping: [1600,1900,2400,2800], summary: '€3 import duty · 19% VAT (est.)' },
  AU: { tax: 1000, duty: 0, taxShipping: true, shipping: [1400,1700,2200,2600], summary: 'No duty · 10% GST (est.)' },
};
const rounded = (amount: number, basisPoints: number) => Math.floor((amount * basisPoints + 5000) / 10000);
export function landed(lines: Line[], country: CountryCode, extraGrams = 0, shippingOverride?: Partial<Record<ShopId, number>>): Breakdown {
  if (!lines.length) return { currency: currency(country), goods: 0, domestic: 0, shipping: 0, duty: 0, tax: 0, fee: 0, total: 0 };
  const goods = lines.reduce((sum, line) => sum + line.unit, 0);
  const subtotals = new Map<ShopId,number>();
  for (const line of lines) subtotals.set(line.shop, (subtotals.get(line.shop) || 0) + line.unit);
  const domestic = [...subtotals].reduce((sum, [id, subtotal]) => sum + (shippingOverride?.[id] ?? (subtotal < cents(shops[id].free_over) ? cents(shops[id].domestic) : 0)), 0);
  const grams = 300 + extraGrams + lines.reduce((sum, line) => sum + Math.round(Number(product(line.id).weight_kg) * 1000), 0);
  const rate = rates[country];
  const shipping = grams <= 500 ? rate.shipping[0] : grams <= 1000 ? rate.shipping[1] : grams <= 1500 ? rate.shipping[2] : grams <= 2000 ? rate.shipping[3] : 3000;
  const duty = rounded(goods, rate.duty) + (country === 'DE' ? Math.floor((30000 + cents(data.fx_usd.EUR) / 2) / cents(data.fx_usd.EUR)) : 0);
  const tax = rounded(goods + (rate.taxShipping ? domestic + shipping + duty : 0), rate.tax);
  const parts = { goods, domestic, shipping, duty, tax, fee: cents(data.rally_fee_usd) };
  const converted = Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, local(value, country)])) as Omit<Breakdown,'currency'|'total'>;
  return { ...converted, currency: currency(country), total: Object.values(converted).reduce((sum, value) => sum + value, 0) };
}
export function quote(ids: string[], country: CountryCode): { lines: Line[]; breakdown: Breakdown } {
  if (ids.length > 8 || new Set(ids).size !== ids.length) throw new Error('A bag supports up to eight different products');
  const items = ids.map(product);
  if (items.some(item => !allowed(item, country))) throw new Error('An item cannot ship to this country');
  // GD2 follows the scenario's cheapest-listed-unit sourcing. M3 replaces this
  // local quote adapter with the engine's complete all-in sourcing response.
  const lines = items.map(item => {
    const [shop, value] = Object.entries(item.prices).sort((a,b) => cents(a[1]!) - cents(b[1]!))[0];
    return { id: item.id, shop: shop as ShopId, unit: cents(value!) };
  });
  return { lines, breakdown: landed(lines, country) };
}
export const listedLines = (review?.hero.listed.lines || []).map(line => ({ id: line.id, shop: line.shop as ShopId, unit: cents(line.unit) }));
export const finalLines: Line[] = (review?.hero.deal.lines || []).map(line => ({ id: line.id, shop: line.shop as ShopId, unit: cents(line.unit), variant: 'variant' in line ? 'older' : undefined, added: 'added_by_agent' in line ? line.added_by_agent : undefined }));
export const events: DealEvent[] = (review?.hero.events || []).map((event, index) => {
  const value = event as { t: number; shop?: string; actor?: string; kind: string; lines?: Record<string,string>; extras?: string[]; domestic?: string; total?: string; note?: string; final?: boolean };
  return { ...value, id: `hero-${index + 1}`, shop: value.shop as ShopId | undefined, actor: value.actor as DealEvent['actor'], kind: value.kind as DealEvent['kind'], lines: value.lines ? Object.fromEntries(Object.entries(value.lines).map(([id, unit]) => [id, cents(unit)])) : undefined, domestic: value.domestic === undefined ? undefined : cents(value.domestic), total: value.total === undefined ? undefined : cents(value.total) };
});
export const recordedMode = () => import.meta.env?.VITE_RALLY_TEST_HARNESS === '1' && typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === 'recorded';
export const href = (path: string) => path + (recordedMode() ? (path.includes('?') ? '&' : '?') + 'test=recorded' : '');

export const auctionFinalLines: Line[] = (review?.auction.award.lines || []).map(line => {
  const [shop, key] = line.offer_id.split('/'), [id, variant] = key.split(':');
  return { id, shop: shop as ShopId, unit: line.unit_usd_cents, variant, bundle: shop === 'haneul', bestListed: Math.min(...Object.values(product(id).prices).map(value => cents(value!))) };
});
export const auctionBreakdown = (country: CountryCode) => landed(auctionFinalLines, country, 50, review?.auction.award.domestic_usd);
export const auctionEvents: import('./auction').AuctionEvent[] = (() => {
  if (!review) return [];
  const data = review;
  type Event = import('./auction').AuctionEvent;
  const rows: Event[] = [];
  let total = data.auction.golden.US[0];
  function add(event: Omit<Event, 'id' | 'seq' | 'total'>) { rows.push({ ...event, id: `auction-${rows.length + 1}`, seq: rows.length + 1, total } as Event); }
  add({ kind: 'start', v: 3, t: 0, note: 'Shops are bidding on your bag.', items: data.auction.cart, shops: Object.fromEntries(data.auction.cart.map(id => [id, Object.keys(product(id).prices)])), listed: Object.fromEntries(data.auction.cart.map(id => [id, Object.fromEntries(Object.entries(product(id).prices).map(([shop, value]) => [shop, cents(value!)]))])) } as Event);
  for (const round of data.auction.rounds) {
    for (const shop of (round.round === 1 ? ['bada', 'dalbit', 'haneul'] : [null])) add({ kind: 'ask', actor: 'rally', round: round.round, shop, items: data.auction.cart, t: Math.max(0, round.t - 3), note: 'Can you lower the complete delivered total?' } as Event);
    for (const bid of data.auction.bids.filter(bid => bid.round === round.round)) {
      const row = bid as typeof bid & { bundle?: { offer_ids: string[]; price_usd_cents: number }; free_domestic?: boolean; extras?: string[]; pass?: string[] };
      const items = Object.fromEntries(Object.entries(bid.items).filter((entry): entry is [string, number] => entry[1] !== undefined).map(([offer, unit]) => [offer.split('/')[1], unit]));
      const perks = Object.fromEntries(Object.keys(items).map(key => [key.split(':')[0], [...(key.endsWith(':older') ? ['older'] : []), ...(row.bundle?.offer_ids.some(offer => offer.split('/')[1] === key) ? ['bundle'] : []), ...(row.free_domestic ? ['freeship'] : []), ...(row.extras?.length ? ['kit'] : [])]]));
      add({ kind: 'bid', actor: 'shop', shop: bid.shop, round: bid.round, t: bid.t, items, perks, bundle: row.bundle ? { items: row.bundle.offer_ids.map(id => id.split('/')[1]), price: row.bundle.price_usd_cents } : null, note: bid.note } as Event);
      if (row.pass) add({ kind: 'pass', actor: 'shop', shop: bid.shop, round: bid.round, t: bid.t, items: row.pass.map(offer => offer.split('/')[1]), note: 'We pass on toner.' } as Event);
    }
    total = round.total_usd_cents;
    add({ kind: 'round', actor: 'rally', round: round.round, t: round.t, leaders: round.leaders as Record<string, ShopId>, note: `Best delivered total: ${money(total)}.` } as Event);
  }
  add({ kind: 'award', actor: 'rally', t: 10.5, winners: Object.fromEntries(auctionFinalLines.map(line => [line.id, { shop: line.shop, unit: line.unit, bundle: !!line.bundle, variant: line.variant === 'older' ? 'older' : null }])), extras: data.auction.award.extras, domestic: data.auction.award.domestic_usd, note: data.auction.award.note } as Event);
  add({ kind: 'done', t: 10.5, note: 'Bidding is complete.' });
  return rows;
})();
