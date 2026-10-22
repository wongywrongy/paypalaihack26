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
    if (info.project.name === 'mobile') expect(page.viewportSize()?.width).toBe(390);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/' + route);
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();
    expect((await title.innerText()).replace(/\s+/g, ' ').trim()).toBe(heading);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText('Example', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(await page.evaluate(() => document.fonts.check('400 16px "Schibsted Grotesk"') && document.fonts.check('400 16px "IBM Plex Mono"'))).toBe(true);
    if (route !== 'receipt') {
      await expect.poll(
        () => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)),
        { timeout: 5_000, message: 'All product images must finish loading successfully' },
      ).toBe(true);
      expect(await page.locator('img').evaluateAll(images => images.every(image => image.currentSrc.endsWith('/assets/dalbit-products.webp') && image.naturalWidth === 1254 && image.naturalHeight === 1254))).toBe(true);
    }
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

test('product artwork uses the small derivative and retains its PNG fallback', async ({ page }) => {
  const images: string[] = [];
  page.on('request', request => { if (/dalbit-products\.(png|webp)(\?|$)/.test(request.url())) images.push(request.url()); });
  await page.goto('/invite');
  await expect.poll(() => page.locator('img').evaluateAll(elements => elements.every(image => image.complete && image.naturalWidth === 1254))).toBe(true);
  expect(images.some(url => url.endsWith('/assets/dalbit-products.webp'))).toBe(true);
  expect(images.some(url => url.endsWith('/assets/dalbit-products.png'))).toBe(false);
  for (const image of await page.locator('picture img').all()) await expect(image).toHaveAttribute('src', '/assets/dalbit-products.png');
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

test('mobile deal row labels stay visible at both scroll extremes with keyboard access', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/deal');
  await page.evaluate(() => document.fonts.ready);
  const region = page.getByRole('region', { name: 'Offers and agreed terms' });
  await expect(region).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(region).toBeFocused();
  await expect(region).toHaveCSS('outline-width', '3px');

  const labels = region.getByRole('rowheader');
  await expect(labels).toHaveCount(6);
  const checkPinnedLabels = async () => {
    const frame = (await region.boundingBox())!;
    for (const label of await labels.all()) {
      const cell = (await label.boundingBox())!;
      expect(cell.x).toBeCloseTo(frame.x, 0);
      expect(cell.width).toBeGreaterThanOrEqual(150);
      expect(cell.width).toBeLessThanOrEqual(160);
    }
  };
  await checkPinnedLabels();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(region).toBeFocused();
  await region.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await checkPinnedLabels();
  const agreed = region.locator('tbody tr').first().getByRole('cell').last();
  const frame = (await region.boundingBox())!;
  const finalPrice = (await agreed.boundingBox())!;
  expect(finalPrice.x).toBeGreaterThanOrEqual(frame.x + 156);
  expect(finalPrice.x + finalPrice.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
  if (info.project.name === 'mobile') {
    await expect.poll(
      () => region.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)),
    ).toBe(true);
    const dir = resolve('design/screenshots');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/deal-scrolled-mobile.png`, fullPage: true, animations: 'disabled', scale: 'css' });
  }
  await region.evaluate(element => { element.scrollLeft = 0; });
  await checkPinnedLabels();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('member primary path works with Tab and Enter only', async ({ page }) => {
  await page.goto('/invite');
  for (const route of ['tell', 'review', 'live', 'done', 'receipt']) {
    const primary = page.locator('.primary');
    await expect(primary).toBeVisible();
    for (let tabs = 0; tabs < 8; tabs++) {
      await page.keyboard.press('Tab');
      if (await primary.evaluate(element => element === document.activeElement)) break;
    }
    await expect(primary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${route}$`));
  }
  await expect(page.getByRole('heading', { name: 'Charged $66.66' })).toBeVisible();
});

test('question keeps its status region and keyboard focus through repeated choices', async ({ page }) => {
  await page.goto('/ask');
  const status = page.getByRole('status');
  await expect(status).toBeEmpty();
  const statusNode = (await status.elementHandle())!;
  const newBottle = page.getByRole('radio', { name: 'New bottle', exact: true });
  const oldBottle = page.getByRole('radio', { name: 'Old bottle', exact: true });
  const continuation = page.getByRole('link', { name: 'Back to the example deal' });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(newBottle).toBeFocused();

  for (const choice of ['old', 'new', 'old']) {
    await page.keyboard.press(choice === 'old' ? 'ArrowRight' : 'ArrowLeft');
    const selected = choice === 'old' ? oldBottle : newBottle;
    await expect(selected).toBeChecked();
    await expect(selected).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: choice === 'old' ? 'Switch to the old bottle' : 'Keep the new bottle' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(continuation).toBeFocused();
    await expect(status).toContainText(choice === 'old' ? 'for this preview' : 'You kept the new bottle.');
    expect(await statusNode.evaluate(element => element.isConnected)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Change this preview choice' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(selected).toBeEnabled();
    await expect(selected).toBeFocused();
    await expect(status).toBeEmpty();
  }
});

test('mobile table jumps are reversible and keyboard operable with either motion preference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/deal');
    const region = page.getByRole('region', { name: 'Offers and agreed terms' });
    const agreed = page.getByRole('button', { name: 'Show agreed terms' });
    await expect(agreed).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Opening offer in view');
    expect(await region.evaluate(element => element.scrollLeft)).toBe(0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(agreed).toBeFocused();
    await page.keyboard.press('Enter');
    const opening = page.getByRole('button', { name: 'Show opening offer' });
    await expect(opening).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Agreed terms in view');
    expect(await region.evaluate(element => Math.abs(element.scrollWidth - element.clientWidth - element.scrollLeft) <= 1)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(agreed).toBeFocused();
    expect(await region.evaluate(element => element.scrollLeft)).toBe(0);
    await agreed.click();
    await expect(opening).toBeVisible();
    await opening.click();
    await expect(page.getByRole('status')).toHaveText('Opening offer in view');
    expect(await region.evaluate(element => element.scrollLeft)).toBe(0);
    const target = (await agreed.boundingBox())!;
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [320, 768]) {
  test(`all routes reflow with readable decision text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [route] of screens) {
      await page.goto('/' + route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const [selector, floor] of [
        ['.product-copy span,.bottle-options .muted,.preview-note,.progress li,.example,th small', 12],
        ['.product-copy strong,.mini-products strong,.bottle-options strong', 14],
        ['.product-price', 13],
      ] as const) {
        expect(await page.locator(selector).evaluateAll((elements, minimum) => elements.every(element => parseFloat(getComputedStyle(element).fontSize) >= minimum - .01), floor)).toBe(true);
      }
      expect(await page.locator('.product-copy,.mini-products strong,.bottle-options strong,.bottle-options .muted').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    }
  });
}

test('all routes reflow with ordinary text resized to 200 percent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route] of screens) {
    await page.goto('/' + route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: ':root { font-size: 187.5% !important; }' });
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(await page.locator('.product-copy span,.bottle-options .muted,.preview-note,.progress li,.example,th small').evaluateAll(elements => elements.every(element => parseFloat(getComputedStyle(element).fontSize) >= 23.99))).toBe(true);
    expect(await page.locator('.product-copy,.mini-products strong,.bottle-options strong,.bottle-options .muted,.hero-money').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    await expect(page.locator('.primary')).toHaveCount(route === 'deal' ? 0 : 1);
  }
});

test('pointer feedback is gated and keyboard and reduced-motion feedback stays immediate', async ({ page }) => {
  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/invite');
    const primary = page.getByRole('link', { name: 'Join the order' });
    const finePointer = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    await primary.hover();
    await expect(primary).toHaveCSS('transition-property', 'background-color');
    await expect(primary).toHaveCSS('background-color', finePointer ? 'rgb(142, 26, 71)' : 'rgb(180, 35, 90)');
    const target = (await primary.boundingBox())!;
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.down();
    await expect(primary).toHaveCSS('background-color', 'rgb(142, 26, 71)');
    await expect(primary).toHaveCSS('transition-duration', '0s');
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.goto('/invite');
    await expect(primary).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(primary).toBeFocused();
    await expect(primary).toHaveCSS('transition-duration', '0s');
    await expect(primary).toHaveCSS('outline-width', '3px');
    await expect(primary).toHaveCSS('transform', 'none');
  }
});

test('unknown routes have a recovery action', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page wandered off.');
  await page.getByRole('link', { name: 'Open the group order' }).click();
  await expect(page).toHaveURL(/\/invite$/);
});
