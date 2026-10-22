import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cents, fixture, money } from '../src/fixture';

test('fixture money reconciles to the cent and rejects malformed amounts', () => {
  expect(cents('1.3')).toBe(130);
  expect(cents('0.01')).toBe(1);
  for (const invalid of ['-1', '1.234', '1e2', 'NaN', '']) expect(() => cents(invalid)).toThrow();
  expect(fixture.costs.reduce((total, cost) => total + cost.cents, 0)).toBe(fixture.total);
  expect(fixture.total).toBeLessThanOrEqual(fixture.max);
  expect(money(fixture.total)).toBe('$66.66');
  expect(money(fixture.saved)).toBe('$54.92');
});

const screens = [
  ['invite', 'Haneul Beauty, Seoul to you.'],
  ['tell', 'What do you want?'],
  ['review', 'Your order. Your limit.'],
  ['live', 'Working on a better group price.'],
  ['ask', 'Same formula. Old bottle for less?'],
  ['done', 'Deal reached.'],
  ['receipt', 'All set.'],
  ['deal', 'How the deal was made.'],
] as const;

for (const [route, heading] of screens) {
  test(`${route} renders the fixture without overflow`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/' + route);
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();
    expect((await title.innerText()).replace(/\s+/g, ' ').trim()).toBe(heading);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText('Example', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('400 16px "Schibsted Grotesk"') && document.fonts.check('400 16px "IBM Plex Mono"'))).toBe(true);
    if (route !== 'receipt') expect(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    if (route !== 'deal') {
      await expect(page.locator('.primary')).toHaveCount(1);
      const box = await page.locator('.primary').boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
    const dir = resolve('design/screenshots');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${route}-${info.project.name}.png`, fullPage: true, animations: 'disabled', scale: 'css' });
  });
}

test('member preview reaches the receipt without moving money', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/') || request.url().includes('paypal.com')) requests.push(request.url()); });
  await page.goto('/invite');
  await page.getByRole('link', { name: 'Join the order' }).click();
  await expect(page.getByLabel('Your example request')).toHaveValue('Snail essence, the rice toner and a box of cica masks. Under $75 all in.');
  await page.getByRole('link', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Your max, all in')).toHaveValue('$75.00');
  await page.getByRole('link', { name: 'Preview the $75.00 hold' }).click();
  await expect(page.getByText('Still under your max')).toBeVisible();
  await page.getByRole('link', { name: 'See the example deal' }).click();
  await expect(page.locator('.hero-money')).toHaveText('$66.66');
  await expect(page.locator('.savings')).toContainText('$54.92');
  await page.getByText('See full breakdown', { exact: true }).click();
  for (const amount of ['$51.00', '$3.26', '$6.38', '$1.30', '$4.72']) await expect(page.getByRole('definition').filter({ hasText: amount })).toBeVisible();
  await page.getByRole('link', { name: 'See your receipt' }).click();
  await expect(page.getByRole('heading', { name: 'Charged $66.66' })).toBeVisible();
  await expect(page.getByText(/The other \$8.34/)).toBeVisible();
  expect(requests).toEqual([]);
});

test('question safely defaults to new and permits an explicit old-bottle choice', async ({ page }) => {
  await page.goto('/ask');
  await expect(page.getByRole('radio', { name: /New bottle/ })).toBeChecked();
  await page.getByRole('button', { name: 'Keep the new bottle' }).click();
  await expect(page.getByRole('status')).toContainText('You kept the new bottle.');
  await page.reload();
  await page.getByRole('radio', { name: /Old bottle/ }).check();
  await page.getByRole('button', { name: 'Switch to the old bottle' }).click();
  await expect(page.getByRole('status')).toHaveText('You chose the old bottle for this preview. The example deal still shows Aisha’s original answer: keep new.');
  await expect(page.getByRole('radio', { name: /Old bottle/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Change this preview choice' }).click();
  await expect(page.getByRole('radio', { name: /Old bottle/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /New bottle/ })).toBeEnabled();
  await page.getByRole('radio', { name: /New bottle/ }).check();
  await page.getByRole('button', { name: 'Keep the new bottle' }).click();
  await expect(page.getByRole('status')).toHaveText('You kept the new bottle.');
});

test('unknown routes have a recovery action', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page wandered off.');
  await page.getByRole('link', { name: 'Open the group order' }).click();
  await expect(page).toHaveURL(/\/invite$/);
});
