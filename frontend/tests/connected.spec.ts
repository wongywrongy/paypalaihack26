import { expect, test } from '@playwright/test';
import { mockPublicApi, publicOrder, sdkScript } from './public-api';
import { mkdir } from 'node:fs/promises';
import { countryCodes, money } from '../src/fixture';

test('ordinary shopper flow uses server routine, quote, SDK6 approval, deal and receipt', async ({ page }) => {
  const api = await mockPublicApi(page, { paymentConfirmed: false });
  await page.goto('/shop');
  await expect(page.locator('.catalog > li')).toHaveCount(30);
  await page.getByRole('link', { name: /Ask for a routine/ }).click();
  await page.getByLabel('What would you like your routine to do?').fill('A gentle routine for sensitive dry skin');
  await page.getByRole('button', { name: 'Find my routine' }).click();
  await page.getByRole('link', { name: 'Add routine to bag' }).click();
  await expect(page.locator('.checkout-total > .money')).toHaveText('$118.82');
  await page.getByRole('button', { name: 'Pay with PayPal' }).click();
  await expect(page).toHaveURL(/\/deal\?order=order-public/);
  await page.getByRole('button', { name: 'Pause updates' }).click();
  await expect(page.getByRole('heading', { name: 'Updates paused' })).toBeVisible();
  await expect(page.getByText('Only your view is paused. Rally keeps working on your deal.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume updates' }).click();
  await expect(page.getByRole('heading', { name: 'Deal done', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Your deal is complete. Rally is confirming your payment with PayPal.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See your order' })).toHaveCount(0);
  api.paymentConfirmed = true;
  await expect(page.getByRole('link', { name: 'See your order' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('link', { name: 'See your order' }).click();
  await expect(page.locator('.hero-money')).toHaveText('$106.79');
  await page.reload(); await expect(page.locator('.hero-money')).toHaveText('$106.79');
  const writesBeforeReplay = api.calls.filter(call => call.method !== 'GET').length;
  await page.getByRole('link', { name: 'Watch how Rally got this price' }).click();
  await page.getByRole('button', { name: 'Pause updates' }).click();
  await expect(page.getByText('Only the replay is paused. Your saved order is unchanged.', { exact: true })).toBeVisible();
  await expect(page.getByText('Only your view is paused. Rally keeps working on your deal.', { exact: true })).toHaveCount(0);
  expect(api.calls.filter(call => call.method !== 'GET')).toHaveLength(writesBeforeReplay);
  await page.goto('/paid?order=order-public');
  await expect(page.locator('.hero-money')).toHaveText('$106.79');
  await page.getByRole('link', { name: 'Track order' }).click();
  await expect(page.getByRole('heading', { name: 'Your shops are packing' })).toBeVisible();
  expect(api.calls.find(call => call.path === '/api/assist')!.body.text).toContain('sensitive dry');
  expect(api.calls.find(call => call.path.endsWith('/checkout'))!.body).toEqual({ quote_id: 'quote-public' });
  expect(api.calls.find(call => call.path.endsWith('/checkout/approve'))!.body).toEqual({ order_id: 'PAYPAL-PUBLIC' });
});

test('canceling an authorized order waits for the server void and never claims a charge', async ({ page }) => {
  await mockPublicApi(page);
  let canceled = false;
  await page.route('**/api/orders/order-public', route => route.fulfill({ json: { ...publicOrder(), charged_minor: null, uncaptured_minor: 0, payment_state: canceled ? 'VOIDED' : 'AUTHORIZED', events: [] } }));
  await page.route('**/api/orders/order-public/deal/stream?*', route => route.fulfill({ contentType: 'text/event-stream', body: ': waiting\n\n' }));
  await page.route('**/api/orders/order-public/cancel', async route => { canceled = true; await route.fulfill({ json: { saved: true } }); });
  await page.goto('/deal?order=order-public');
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order canceled' })).toBeVisible();
  await expect(page.getByText(/You have not been charged.*bank’s release timing/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'See your order' })).toHaveCount(0);
});

test('refund receipts distinguish the completed refund from the original payment', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/orders/order-public', route => route.fulfill({ json: { ...publicOrder(), payment_state: 'REFUNDED', refunded_minor: 9000, refund_pending_minor: 0 } }));
  await page.goto('/paid?order=order-public');
  await expect(page.getByRole('heading', { name: 'Payment refunded' })).toBeVisible();
  await expect(page.locator('.hero-money')).toHaveText('$90.00');
  await expect(page.getByText('Original payment: $106.79', { exact: true })).toBeVisible();
});

test('a pending refund receipt refreshes only from the confirmed server result', async ({ page }) => {
  await mockPublicApi(page);
  let reads = 0;
  await page.route('**/api/orders/order-public', route => {
    reads += 1;
    return route.fulfill({ json: { ...publicOrder(), payment_state: reads === 1 ? 'REFUND_PENDING' : 'CHARGED', refunded_minor: reads === 1 ? 0 : 200, refund_pending_minor: reads === 1 ? 200 : 0 } });
  });
  await page.goto('/paid?order=order-public');
  await expect(page.getByRole('status')).toHaveText('A refund of $2.00 is being confirmed with PayPal.');
  await expect(page.getByText('Refunded to PayPal: $2.00', { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.hero-money')).toHaveText('$106.79');
});

test('SDK6 redirect return resumes approval without creating another PayPal order', async ({ page }) => {
  const api = await mockPublicApi(page);
  await page.route('https://www.sandbox.paypal.com/web-sdk/v6/core', route => route.fulfill({ contentType: 'application/javascript', body: sdkScript.replace('hasReturned: () => false', 'hasReturned: () => true').replace('resume: async () => {}', "resume: async () => { await callbacks.onApprove({ orderId: 'PAYPAL-RETURN' }); }") }));
  await page.route('**/api/orders/order-public', route => route.fulfill({ json: api.approved ? { ...publicOrder(), bag_id: 'bag-public' } : { ...publicOrder(), bag_id: 'bag-public', payment_state: 'AWAITING_APPROVAL', charged_minor: null, events: [], uncaptured_minor: 0 } }));
  await page.goto('/deal?order=order-public&token=PAYPAL-RETURN');
  await expect.poll(() => api.calls.filter(call => call.path.endsWith('/checkout/approve')).length).toBe(1);
  expect(api.calls.find(call => call.path.endsWith('/checkout/approve'))!.body).toEqual({ order_id: 'PAYPAL-RETURN' });
  expect(api.calls.filter(call => call.path.endsWith('/checkout'))).toHaveLength(0);
});

test('destination amounts are rendered once and history reopens immutable receipts', async ({ page }) => {
  await mockPublicApi(page, { country: 'CA' });
  await page.addInitScript(() => localStorage.setItem('rally-shopping-v2', JSON.stringify({ country: 'CA', items: ['dal-rice-toner'], rules: { old_packaging_ok: false, add_small_extras_if_cheaper: false } })));
  await page.goto('/paid?order=order-public');
  await expect(page.locator('.hero-money')).toHaveText('C$144.49');
  await expect(page.locator('.product-rows .item-price').first()).toHaveText('C$16.56');
  await page.getByRole('link', { name: 'Your orders', exact: true }).click();
  await page.getByRole('link', { name: /Order order-public/ }).click();
  await expect(page.locator('.hero-money')).toHaveText('C$144.49');
  await page.goto('/bag');
  await expect(page.locator('.product-rows li')).toHaveCount(1);
  await expect(page.getByRole('switch', { name: /Older packaging/ })).not.toBeChecked();
});

test('connected receipts retain exact server amounts in all five destination currencies', async ({ page }) => {
  for (const country of countryCodes) {
    await mockPublicApi(page, { country });
    const order = publicOrder(country);
    await page.goto('/paid?order=order-public');
    await expect(page.locator('.hero-money')).toHaveText(money(order.charged_minor!, order.currency));
    await expect(page.locator('.product-rows .item-price').first()).toHaveText(money(order.lines[0].unit, order.currency));
    await page.getByText('See breakdown', { exact: true }).click();
    await expect(page.locator('.total-row .money')).toHaveText(money(order.breakdown.total, order.currency));
  }
});

test('paid pages refuse a negotiation event without confirmed capture', async ({ page }) => {
  await mockPublicApi(page, { paymentConfirmed: false });
  await page.route('**/api/orders/order-public', route => route.fulfill({ json: { ...publicOrder(), charged_minor: null, payment_state: 'COMPLETING_PAYMENT' } }));
  await page.goto('/paid?order=order-public');
  await expect(page.getByRole('heading', { name: 'Your payment is being confirmed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You paid', exact: true })).toHaveCount(0);
});

test('unavailable catalog and rejected quotes have useful retry paths', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/catalog?*', route => route.fulfill({ status: 503, json: { detail: 'Your shops are temporarily unavailable.' } }));
  await page.goto('/shop');
  await expect(page.getByRole('status')).toHaveText('Your shops are temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('.catalog > li')).toHaveCount(0);
  await page.addInitScript(() => localStorage.setItem('rally-shopping-v2', JSON.stringify({ country: 'US', items: ['dal-rice-toner'], rules: { old_packaging_ok: true, add_small_extras_if_cheaper: true } })));
  await page.route('**/api/bags', route => route.fulfill({ status: 409, json: { detail: 'This item is out of stock. Remove it from your bag.' } }));
  await page.goto('/bag');
  await expect(page.getByRole('status')).toHaveText('This item is out of stock. Remove it from your bag.');
  await expect(page.getByRole('button', { name: 'Refresh your bag' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with PayPal' })).toHaveCount(0);
});

test('shop and hub sign-in never embed credentials or request private data before login', async ({ page }) => {
  const api = await mockPublicApi(page);
  await page.goto('/shops/products');
  await expect(page.getByRole('heading', { name: 'Your shop workspace' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveValue('');
  expect(api.calls.every(call => call.path === '/api/session')).toBe(true);
  await page.getByRole('link', { name: 'Hub sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Hub sign in' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveValue('');
});

test('shop private grid and controls respect read-only accounts', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/session', route => route.fulfill({ json: { csrf_token: 'shop-csrf', paypal_client_id: 'public-client', role: 'shop', shop_id: 'dalbit', read_only: true } }));
  await page.route('**/api/shops/dalbit/products', route => route.fulfill({ json: { currency: 'USD', products: [{ id: 'dal-rice-toner', offer_id: 'dalbit/dal-rice-toner', listed: 2100, lowest: 1600, cost: 900, stock: 20, days: 4, goal: 'Maintain margin' }] } }));
  await page.route('**/api/shops/dalbit/orders', route => route.fulfill({ json: { orders: [] } }));
  await page.route('**/api/shops/dalbit/settings', route => route.fulfill({ json: { discount_bp: 1000, sample_kit: true } }));
  await page.goto('/shops/products');
  await expect(page.getByText('Your account is read-only.', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Lowest price' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: '$16.00', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Agent settings', exact: true }).click();
  await expect(page.getByLabel('Maximum discount (%)')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save agent settings' })).toBeDisabled();
});

test('hub ship form sends tracking through the authenticated API', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/session', route => route.fulfill({ json: { csrf_token: 'hub-csrf', paypal_client_id: 'public-client', role: 'hub', read_only: false } }));
  await page.route('**/api/hub/orders', route => route.fulfill({ json: { orders: [{ ...publicOrder(), fulfillment_state: 'AT_HUB' }] } }));
  const writes: any[] = [];
  await page.route('**/api/hub/orders/order-public/ship', async route => { writes.push(route.request().postDataJSON()); await route.fulfill({ json: { queued: true } }); });
  await page.goto('/hub');
  await page.getByLabel('International carrier').fill('DHL');
  await page.getByLabel('Tracking number').fill('TEST-TRACK-1');
  await page.getByRole('button', { name: 'Ship box from Seoul' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ carrier: 'DHL', tracking: 'TEST-TRACK-1' });
});

test('connected surfaces reflow and keep their actions visible at phone, tablet and desktop widths', async ({ page }) => {
  await mockPublicApi(page);
  await page.addInitScript(() => localStorage.setItem('rally-shopping-v2', JSON.stringify({ country: 'US', items: ['dal-rice-toner'], rules: { old_packaging_ok: true, add_small_extras_if_cheaper: true } })));
  await mkdir('../.runtime/connected-screens', { recursive: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/shop', '/ask', '/bag', '/deal?order=order-public', '/paid?order=order-public', '/track?order=order-public', '/orders', '/shops/orders', '/hub']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      if (path === '/shop') await expect(page.locator('.catalog > li')).toHaveCount(30);
      else if (path === '/bag') await expect(page.getByRole('button', { name: 'Pay with PayPal' })).toBeVisible();
      else if (path.startsWith('/paid')) await expect(page.locator('.hero-money')).toBeVisible();
      else if (path.startsWith('/deal')) await expect(page.getByRole('heading', { name: 'Deal done', exact: true })).toBeVisible();
      else if (path === '/shops/orders' || path === '/hub') await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.locator('img[loading="lazy"]').evaluateAll(images => images.forEach(image => { (image as HTMLImageElement).loading = 'eager'; }));
      await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      const name = path.split('?')[0].replaceAll('/', '-') || 'shop';
      await page.screenshot({ path: `../.runtime/connected-screens/${width}${name}.png`, fullPage: path !== '/shop', animations: 'disabled' });
    }
  }
});

test('earlier purchases preserve owned original terms without reopening checkout', async ({ page }) => {
  await mockPublicApi(page);
  const terms = { title: 'Earlier skincare purchase', variant: 'Original bottle', currency: 'USD', total_minor: 6500, payment_terms: 'The originally agreed payment terms.', nested: { retained: '<script>private terms</script>' } };
  await page.route('**/api/legacy/purchases', route => route.fulfill({ json: { purchases: [{ id: 'owned-earlier', group_id: 'old-group', run_id: 'old-run', group_status: 'SETTLED', terms, amount_minor: 6500, currency: 'USD', captured_minor: 6000, authorization_status: 'AUTHORIZED', capture_status: 'COMPLETED', refund_status: null, void_status: null, created_at: '2026-10-20T12:00:00Z' }] } }));
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Earlier purchases', exact: true })).toBeVisible();
  await page.getByText('Original receipt and terms', { exact: true }).click();
  const original = page.getByLabel('Original agreed terms', { exact: true });
  await expect(original).toHaveText(JSON.stringify(terms, null, 2));
  expect(await page.locator('script').evaluateAll(elements => elements.some(element => element.textContent?.includes('private terms')))).toBe(false);
  await expect(page.getByRole('link', { name: /Approve|Checkout|Join/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await mkdir('../.runtime/connected-screens', { recursive: true });
  await page.screenshot({ path: `../.runtime/connected-screens/earlier-receipt-${page.viewportSize()!.width}.png`, fullPage: true });
});

test('hub recovery checks existing references and resumes only saved recovery jobs', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/session', route => route.fulfill({ json: { csrf_token: 'hub-csrf', paypal_client_id: 'public-client', role: 'hub', read_only: false } }));
  await page.route('**/api/hub/orders', route => route.fulfill({ json: { orders: [] } }));
  await page.route('**/api/hub/recovery', route => route.fulfill({ json: { operations: [{ id: 'op-1', kind: 'capture', status: 'unknown', provider_ref: 'CAPTURE-REF', request_id: 'order:owned/capture', order_id: 'owned', raw_provider_body: 'MUST-NOT-RENDER' }], jobs: [{ id: 42, kind: 'capture', status: 'recovery', error: 'RecoveryRequired' }], tracking: [{ order_id: 'owned', status: 'pending', request_id: 'tracking:owned' }], actions: 'Reconcile the saved operation first.' } }));
  await page.route('**/api/hub/legacy/recovery', route => route.fulfill({ json: { operations: [{ id: 'legacy-op', kind: 'refund', status: 'unknown', amount_minor: 6500, currency: 'USD' }], actions: 'Earlier operations are read-only.' } }));
  const writes: string[] = [];
  await page.route('**/api/hub/recovery/*/reconcile', async route => { writes.push(new URL(route.request().url()).pathname); await route.fulfill({ json: { reconciled: true } }); });
  await page.route('**/api/hub/jobs/42/resume', async route => { writes.push(new URL(route.request().url()).pathname); await route.fulfill({ json: { queued: true } }); });
  await page.goto('/hub');
  await page.getByRole('button', { name: 'Check PayPal status' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toBe('/api/hub/recovery/order%3Aowned%2Fcapture/reconcile');
  await page.getByRole('button', { name: 'Resume saved job' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toBe('/api/hub/jobs/42/resume');
  expect(await page.locator('body').innerText()).not.toContain('MUST-NOT-RENDER');
  await expect(page.getByText('Read-only. Review the original PayPal activity before resolving this payment.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Retry/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await mkdir('../.runtime/connected-screens', { recursive: true });
  await page.screenshot({ path: `../.runtime/connected-screens/hub-recovery-${page.viewportSize()!.width}.png`, fullPage: true });
});

test('terminal fallback restores authoritative checkout rows and clears rejected perks', async ({ page }) => {
  await mockPublicApi(page);
  const original = publicOrder();
  const fallback = { ...original, charged_minor: original.maximum_minor, uncaptured_minor: 0, lines: original.checkout.lines, breakdown: original.checkout.breakdown, extras: [], events: [...original.events, { id: 'fallback-error', seq: 100, t: 15, kind: 'error', total: original.maximum_minor, note: 'Original checkout terms retained.' }, { id: 'fallback-done', seq: 101, t: 15, kind: 'done', total: original.maximum_minor }] };
  await page.route('**/api/orders/order-public', route => route.fulfill({ json: fallback }));
  await page.goto('/deal?order=order-public');
  await expect(page.locator('.hero-money')).toHaveText('$118.82');
  await expect(page.getByText('Price held', { exact: true })).toHaveCount(4);
  await expect(page.getByText('You allowed older packaging', { exact: true })).toHaveCount(0);
  await expect(page.getByText('You allowed small extras', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Sample kit, 5 minis', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'See your order' }).click();
  await expect(page.locator('.product-rows li')).toHaveCount(4);
  await expect(page.getByText('Sample kit, 5 minis', { exact: true })).toHaveCount(0);
});
