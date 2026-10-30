import { test, expect, type Page } from '@playwright/test';
import { mockPublicApi, publicOrder } from './public-api';

// One window, one path: Home → storefront → receipt → hand-off → payout.
async function haneul(page: Page) {
  const { auctionEvents, auctionFinalLines } = await import('../src/fixture');
  const lines = auctionFinalLines.filter(line => line.shop === 'haneul');
  const order = { id: '7f3a9c21-0000-4000-8000-000000000001', country: 'US', currency: 'USD', payment_state: 'CHARGED', fulfillment_state: 'MERCHANT_CONFIRMED', maximum_minor: 11882, lines, checkout_lines: lines, events: auctionEvents, ship_by: '2026-11-05T12:00:00Z', lowest: {}, payout: { status: 'awaiting_handoff', amount_minor: 0, currency: 'USD' } };
  await page.route('**/api/session', r => r.fulfill({ json: { csrf_token: 'csrf', role: 'shop', shop_id: 'haneul', read_only: false } }));
  await page.route('**/api/shops/haneul/orders', r => r.fulfill({ json: { orders: [order] } }));
  await page.route('**/api/shops/haneul/products', r => r.fulfill({ json: { products: [], changes: [] } }));
  await page.route('**/api/shops/haneul/home', r => r.fulfill({ json: {
    steps: [{ key: 'prices', done: true, product_id: 'sae-cica-cream', floor_usd: 1750 }, { key: 'goal', done: true, summary: 'Prefer two-item bundles; free Korea shipping to win.' }, { key: 'order', done: false }, { key: 'handoff', done: false }, { key: 'paid', done: false }],
    goal: { goal_text: 'Win two-item bundles with free shipping in Korea.', applied_at: '2026-10-30T01:00:00Z', strategy: { max_round_discount_bp: 800, min_margin_over_floor_cents: 150, prefer_older: false, bundles: 'prefer', free_domestic: 'to_win', kit: false } },
    recent: [{ id: order.id, created_at: '2026-10-30T01:10:00Z', items: ['mul-gel-cleanser', 'sae-cica-cream', 'dal-rice-toner'], won: ['mul-gel-cleanser', 'sae-cica-cream'], total: 10192, currency: 'USD', reason: 'Won with a bundle and free Korea shipping.', payout_status: 'awaiting_handoff' }],
    payouts: { total_usd: 0, count: 0 } } }));
  return order;
}

test('Rally for shops home leads to the storefront, and orders hand off with one tap', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const order = await haneul(page);
  await page.goto('/shops');
  await expect(page.getByRole('heading', { name: 'Get your first Rally payout' })).toBeVisible();
  await expect(page.getByText('2 of 5')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open your storefront/ })).toHaveAttribute('href', '/shop');
  await expect(page.getByRole('link', { name: /Hand off/ })).toHaveCount(0);
  await expect(page.getByText('Prefers bundles')).toBeVisible();
  await page.screenshot({ path: `../.runtime/shops-home-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  let body: { carrier: string; tracking: string } | undefined;
  await page.route(`**/api/shops/haneul/orders/${order.id}/handoff`, async r => { body = r.request().postDataJSON(); await r.fulfill({ json: { queued: true } }); });
  await page.goto(`/shops/orders?order=${order.id}`);
  await expect(page.getByRole('heading', { name: 'You won 2 items' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Carrier' })).toHaveValue('Rally pickup');
  await page.screenshot({ path: `../.runtime/shops-order-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Record hand-off' }).click();
  await expect.poll(() => body?.carrier).toBe('Rally pickup');
  expect(body!.tracking).toMatch(/^PICKUP-RL-/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a shopper signed in to a shop sees that shop on the receipt and can switch sides', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPublicApi(page);
  const { auctionEvents, auctionFinalLines } = await import('../src/fixture');
  await page.route('**/api/session', r => r.fulfill({ json: { csrf_token: 'csrf', role: 'shop', shop_id: 'haneul', read_only: false } }));
  await page.route('**/api/orders/order-public', r => r.fulfill({ json: { ...publicOrder(), events: auctionEvents, lines: auctionFinalLines } }));
  await page.goto('/paid?order=order-public');
  await expect(page.getByText('Your shop bid on this order')).toBeVisible();
  await expect(page.getByText('Haneul Beauty won 2 of 4 items.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Hand off in Rally for shops/ })).toHaveAttribute('href', '/shops/orders?order=order-public');
  await expect(page.getByRole('link', { name: /Selling as Haneul Beauty/ })).toHaveAttribute('href', '/shops');
  await expect(page.getByText(/One box from 2 shops/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Replay bidding' })).toBeVisible();
  await page.screenshot({ path: `../.runtime/paid-linked-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
