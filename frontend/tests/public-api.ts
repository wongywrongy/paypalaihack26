import type { Page } from '@playwright/test';
import { allowed, catalog, cents, countries, countryCodes, events, finalLines, hero, landed, listedLines, local, quote, rates, shops, type CountryCode } from '../src/fixture';
import type { Order, Quote } from '../src/connected';
export function publicQuote(items: string[], country: CountryCode = 'US'): Quote {
  const value = quote(items, country);
  return { id: 'quote-public', country, currency: value.breakdown.currency, expires_at: '2099-01-01T12:15:00Z', lines: value.lines.map(line => ({ ...line, unit: local(line.unit, country) })), breakdown: value.breakdown };
}
export function publicOrder(country: CountryCode = 'US'): Order {
  const checkout = publicQuote(hero.cart, country);
  const breakdown = landed(finalLines, country, 50);
  return {
    id: 'order-public', country, currency: breakdown.currency, state: 'CHARGED', payment_state: 'CHARGED', fulfillment_state: 'MERCHANT_CONFIRMED', maximum_minor: checkout.breakdown.total,
    charged_minor: breakdown.total, uncaptured_minor: checkout.breakdown.total - breakdown.total, checkout,
    lines: finalLines.map(line => ({ ...line, unit: local(line.unit, country) })), breakdown,
    events: events.map((event, index) => ({ ...event, seq: index + 1, total: event.total === undefined ? undefined : event.total === 11882 ? checkout.breakdown.total : event.total === 10679 ? breakdown.total : landed([...listedLines, finalLines.find(line => line.added)!], country).total, lines: event.lines && Object.fromEntries(Object.entries(event.lines).map(([id, amount]) => [id, local(amount, country)])) })),
    tracking: [{ title: 'Payment confirmed', note: 'Your order is saved.', complete: true }, { title: 'Shops are packing', note: 'On their way to the Seoul hub next.', complete: false, current: true }], ship_by: '2026-10-29T12:00:00Z',
  };
}
export const sdkScript = `
customElements.define('paypal-button', class extends HTMLElement {
  connectedCallback() { this.setAttribute('role', 'button'); this.tabIndex=0; this.textContent='Pay with PayPal'; }
});
window.paypal = {createInstance: async () => ({
 findEligibleMethods: async () => ({isEligible: method => method === 'paypal'}),
 createPayPalOneTimePaymentSession: callbacks => ({hasReturned: () => false, resume: async () => {}, start: async (options, promise) => {const order = await promise; await callbacks.onApprove({orderId:order.orderId});}})
})};`;
export async function mockPublicApi(page: Page, options: { paymentConfirmed?: boolean; country?: CountryCode } = {}) {
  const control = { paymentConfirmed: options.paymentConfirmed ?? true, approved: false, streamed: false, calls: [] as { path: string; method: string; body: any }[] };
  let bag = publicQuote([], options.country || 'US');
  await page.route('https://www.sandbox.paypal.com/web-sdk/v6/core', route => route.fulfill({ contentType: 'application/javascript', body: sdkScript }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method();
    const body = method === 'GET' ? undefined : route.request().postDataJSON();
    control.calls.push({ path, method, body });
    const respond = (json: unknown, status = 200) => route.fulfill({ json, status });
    if (path === '/api/session') return respond({ csrf_token: 'csrf-test', paypal_client_id: 'public-client', role: 'shopper', read_only: false });
    if (path === '/api/countries') return respond({ countries: countryCodes.map(code => ({ code, name: countries[code].name, region: countries[code].region, currency: countries[code].currency, summary: rates[code].summary })) });
    if (path === '/api/catalog') {
      const country = (url.searchParams.get('country') || 'US') as CountryCode;
      return respond({ prices_currency: 'USD', shops, products: catalog.map(item => ({ ...item, price: local(Math.min(...Object.values(item.prices).map(value => cents(value!))), country), currency: countries[country].currency, available: allowed(item, country) })) });
    }
    if (path === '/api/assist') {
      const value = publicQuote(hero.cart, body.country);
      return respond({ request: body.text, items: value.lines.map((line, index) => ({ id: line.id, shop: line.shop, reason: ['A gentle first cleanse.', 'Hydrates dry-feeling skin.', 'A light daily essence.', 'Supports your skin barrier.'][index], step: ['Cleanse', 'Tone', 'Treat', 'Moisturize'][index] })), quote: value });
    }
    if (path === '/api/quotes') return respond(publicQuote(body.items, body.country));
    if (path === '/api/bags' || path === '/api/bags/bag-public' && method === 'PATCH') { bag = publicQuote(body.items, body.country); return respond({ id: 'bag-public', quote: bag }); }
    if (path === '/api/bags/bag-public/checkout') return respond({ paypal_order_id: 'PAYPAL-PUBLIC', approval_url: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-PUBLIC', client_id: 'public-client', currency: bag.currency, order_id: 'order-public' });
    if (path === '/api/bags/bag-public/checkout/approve') {
      control.approved = true;
      return respond({ ...publicOrder(bag.country), payment_state: 'NEGOTIATING', state: 'NEGOTIATING', charged_minor: null, events: [], uncaptured_minor: 0 });
    }
    if (path.endsWith('/deal/stream')) {
      control.streamed = true;
      const list = publicOrder(bag.country).events;
      return route.fulfill({ contentType: 'text/event-stream', body: list.map(event => `id: ${event.id}\nevent: deal\ndata: ${JSON.stringify(event)}\n\n`).join('') });
    }
    if (path === '/api/orders/order-public') {
      const order = publicOrder(control.approved ? bag.country : options.country || 'US');
      return respond(control.approved && !control.streamed ? { ...order, charged_minor: null, payment_state: 'NEGOTIATING', events: [], uncaptured_minor: 0 } : control.paymentConfirmed ? order : { ...order, charged_minor: null, payment_state: 'COMPLETING_PAYMENT', uncaptured_minor: 0 });
    }
    if (path === '/api/legacy/purchases') return respond({ purchases: [] });
    if (path === '/api/orders') return respond({ orders: [publicOrder(options.country || 'US')] });
    if (path === '/api/reset') return respond({ cleared: true });
    return respond({ detail: 'Sign in to your workspace.' }, 401);
  });
  return control;
}
