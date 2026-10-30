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
