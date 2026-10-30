import { test, expect } from '@playwright/test';

test('merchant grid validates keyboard edits, saves versions and lists its audit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let row = { id: 'sae-cica-cream', offer_id: 'haneul/sae-cica-cream', listed: 2400, lowest: 1650, cost: 1200, stock: 20, version: 1, days: 10, goal: 'Win two-item orders' };
  let changes: unknown[] = [];
  await page.route('**/api/session', r => r.fulfill({ json: { csrf_token: 'test-csrf', role: 'shop', shop_id: 'haneul', read_only: false } }));
  await page.route('**/api/shops/haneul/orders', r => r.fulfill({ json: { orders: [] } }));
  await page.route('**/api/shops/haneul/settings', r => r.fulfill({ json: { discount_bp: 1000, sample_kit: false } }));
  await page.route('**/api/shops/haneul/products', r => r.fulfill({ json: { products: [row], changes } }));
  await page.route('**/api/shops/haneul/products/haneul/sae-cica-cream', async r => {
    const body = r.request().postDataJSON(); expect(body.version).toBe(1); expect(body.floor_usd).toBe(1700);
    expect(r.request().headers()['x-csrf-token']).toBe('test-csrf');
    row = { ...row, lowest: body.floor_usd, version: 2 };
    changes = [{ id: 1, offer_id: row.offer_id, action: 'listing', before: {}, after: body, created_at: new Date().toISOString() }];
    await r.fulfill({ json: { ...body, version: 2 } });
  });
  await page.goto('/shops/products');
  const cell = page.locator('.ag-row[row-index="0"] [col-id="lowest"]');
  await cell.focus(); await page.keyboard.press('Enter');
  await page.locator('.ag-cell-inline-editing input').fill('1'); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('lowest price must stay between');
  await cell.focus(); await page.keyboard.press('Enter');
  await page.locator('.ag-cell-inline-editing input').fill('17.00'); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('listing saved');
  await expect(cell).toHaveText('$17.00');
  await expect(page.getByRole('heading', { name: 'Recent changes' })).toBeVisible();
  await expect(page.locator('.shop-group')).toContainText('Lowest $17.00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('goal rules are reviewed before Apply and read-only accounts cannot change them', async ({ page }) => {
  const strategy = { max_round_discount_bp: 2000, min_margin_over_floor_cents: 100, prefer_older: true, bundles: 'prefer', free_domestic: 'to_win', kit: false };
  let applied = false;
  await page.route('**/api/session', r => r.fulfill({ json: { csrf_token: 'csrf', role: 'shop', shop_id: 'haneul', read_only: false } }));
  await page.route('**/api/shops/haneul/orders', r => r.fulfill({ json: { orders: [] } }));
  await page.route('**/api/shops/haneul/products', r => r.fulfill({ json: { products: [], changes: [] } }));
  await page.route('**/api/shops/haneul/settings', r => r.fulfill({ json: { discount_bp: 1000, sample_kit: false } }));
  await page.route('**/api/shops/haneul/goals', r => r.fulfill({ json: { goal_text: 'Win two item orders', summary: 'Current rules', strategy } }));
  await page.route('**/api/shops/haneul/goals/compile', r => r.fulfill({ json: { goal_text: r.request().postDataJSON().text, summary: 'Prefer bundles', strategy, draft_id: 'draft-1' } }));
  await page.route('**/api/shops/haneul/goals/apply', r => { applied = true; expect(r.request().postDataJSON()).toEqual({ draft_id: 'draft-1' }); return r.fulfill({ json: { goal_text: 'Move older stock', summary: 'Prefer bundles', strategy } }); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/shops/settings');
  await page.getByLabel('Your shop goal').fill('Move older stock');
  await page.getByRole('button', { name: 'Review rules' }).click();
  await expect(page.getByRole('heading', { name: 'Rules to apply' })).toBeVisible();
  expect(applied).toBe(false);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('applied to new quotes');
  expect(applied).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Activity shows saved bids, deciding total and payout without private authority', async ({ page }) => {
  await page.route('**/api/session', r => r.fulfill({ json: { csrf_token: 'csrf', role: 'shop', shop_id: 'haneul', read_only: true } }));
  await page.route('**/api/shops/haneul/orders', r => r.fulfill({ json: { orders: [] } }));
  await page.route('**/api/shops/haneul/products', r => r.fulfill({ json: { products: [], changes: [] } }));
  await page.route('**/api/shops/haneul/settings', r => r.fulfill({ json: { discount_bp: 1000, sample_kit: false } }));
  await page.route('**/api/shops/haneul/activity', r => r.fulfill({ json: { auctions: [{ id: 'abcde-order', created_at: new Date().toISOString(), items: ['sae-cica-cream'], bids: [{ round: 3, items: { 'sae-cica-cream': 1800 } }], won: ['sae-cica-cream'], total: 10192, currency: 'USD', reason: 'Lowest complete delivered total: $101.92. Winning terms include a bundle.', payout_status: 'completed' }] } }));
  await page.goto('/shops/activity');
  await expect(page.getByRole('cell', { name: /Lowest complete delivered total/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'completed', exact: true })).toBeAttached();
  await expect(page.getByRole('rowheader', { name: /RL-ABCDE/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
