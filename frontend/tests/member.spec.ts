import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import shopSnapshot from './fixtures/shop-private.json' with { type: 'json' };
import { applyEvent, initialDeal } from '../src/deal';
import { allowed, catalog, cents, countries, countryCodes, events, finalLines, hero, landed, quote } from '../src/fixture';
import { mockPublicApi } from './public-api';
test.beforeEach(async ({ page }) => { await mockPublicApi(page); });
const forbidden = /\b(example|preview|fixture|simulated|demo)\b/i;
const recorded = (path: string) => `${path}?test=recorded`;
const financialRequest = (url: string) => { const parsed = new URL(url); return /(^|\.)paypal\.com$/.test(parsed.hostname) || parsed.pathname.startsWith('/api/'); };
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (await target.evaluate(element => element === document.activeElement)) break; }
  await expect(target).toBeFocused();
}
async function screenshot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  // Capture the complete catalog deliberately; ordinary browsing keeps native lazy loading.
  await page.locator('img[loading="lazy"]').evaluateAll(images => images.forEach(image => { (image as HTMLImageElement).loading = 'eager'; }));
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), { timeout: 10000 }).toBe(true);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const dir = resolve('../.runtime/frontend-screenshots'); await mkdir(dir,{ recursive:true });
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path:`${dir}/${name}.png`, fullPage:true, animations:'disabled', scale:'css' });
  await page.screenshot({ path:`${dir}/${name}-page.jpg`, fullPage:true, type:'jpeg', quality:70, animations:'disabled', scale:'css' });
  await page.screenshot({ path:`${dir}/${name}-fold.jpg`, fullPage:false, type:'jpeg', quality:75, animations:'disabled', scale:'css' });
}
async function shopContract(page: Page) {
  await page.route('**/api/shops/dalbit/workspace', route => route.fulfill({ json: shopSnapshot }));
}

test('public quotes match all five currency golden breakdowns and enforce restrictions', () => {
  expect(catalog).toHaveLength(30);
  for (const country of countryCodes) {
    for (const [actual, expected] of [[quote(hero.cart,country).breakdown,countries[country].listed],[landed(finalLines,country,50),countries[country].deal]] as const) {
      for (const key of ['goods','domestic','shipping','duty','tax','fee','total'] as const) expect(actual[key],`${country}:${key}`).toBe(cents(expected[key]));
      expect(actual.goods+actual.domestic+actual.shipping+actual.duty+actual.tax+actual.fee).toBe(actual.total);
    }
  }
  expect(() => quote(['mul-sun-essence'],'US')).toThrow();
  expect(() => quote(['sae-mist-spray'],'CA')).toThrow();
  expect(() => quote([...hero.cart,...hero.cart],'US')).toThrow();
});
test('recorded events rebuild exact final terms and duplicate delivery is harmless', () => {
  let state=initialDeal(); const totals=[state.totalUsd];
  for(const event of events) { state=applyEvent(state,event); if(totals.at(-1)!==state.totalUsd)totals.push(state.totalUsd); expect(applyEvent(state,event)).toBe(state); }
  expect(totals).toEqual([11882,11775,10679]); expect(state.done).toBe(true);
  for(const line of finalLines)expect(state.shops[line.shop]!.lines[line.id].asking).toBe(line.unit);
  expect(events.reduce(applyEvent,initialDeal())).toEqual(state);
});

for (const route of ['shop','ship-to','ask','bag','deal','paid','track']) {
  test(`${route} renders the new shopping flow with readable copy and images`, async ({ page },info) => {
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(recorded('/'+route));
    await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
    await expect(page.getByText('Test mode',{exact:true})).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(forbidden);
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    if(route==='ship-to')await expect(page.getByRole('dialog',{name:'Ship to'})).toBeVisible();
    await screenshot(page,`${route}-${info.project.name}`);
    expect(errors).toEqual([]);
  });
}
for(const tab of ['orders','products','settings']) {
  test(`authenticated shop ${tab} is scoped and renders from the shop contract`,async({page},info)=>{
    await shopContract(page);
    await page.goto(recorded('/shops/'+tab));
    await expect(page.getByRole('heading',{level:1})).toHaveText(tab==='settings'?'Agent settings':tab[0].toUpperCase()+tab.slice(1));
    expect(await page.locator('body').innerText()).not.toMatch(forbidden);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    if(tab==='products') { await expect(page.getByRole('columnheader',{name:'Lowest price'})).toBeVisible();await expect(page.getByRole('cell',{name:'$16.00',exact:true})).toHaveCount(1); }
    if(tab==='settings') { await expect(page.getByLabel('Never go below my lowest price')).toBeChecked();await expect(page.getByLabel('Never go below my lowest price')).toBeDisabled(); }
    await screenshot(page,`shops-${tab}-${info.project.name}`);
  });
}

test('catalog filters, adds, removes and preserves the real local bag',async({page})=>{
  await page.goto('/shop');
  await page.getByRole('button',{name:'Toner',exact:true}).click();
  await expect(page.locator('.catalog > li')).toHaveCount(3);
  await page.getByRole('button',{name:'Add Rice Toner',exact:true}).click();
  await page.getByRole('link',{name:'Bag, 1 item'}).click();
  await expect(page.locator('.bag-item')).toContainText('Rice Toner');
  await expect(page.getByText(/Best listed.*3 shops bid/)).toBeVisible();
  const total=await page.locator('.checkout-total > .money').innerText();
  await page.reload();await expect(page.locator('.checkout-total > .money')).toHaveText(total);
  await page.getByRole('button',{name:'Remove Rice Toner'}).click();
  await expect(page.getByText('Your bag is empty.',{exact:false})).toBeVisible();
});
test('country sheet supports native keyboard, Escape and exact local prices',async({page})=>{
  await page.goto(recorded('/shop'));
  const trigger=page.getByRole('button',{name:/Ship to United States/});
  await trigger.click();const dialog=page.getByRole('dialog',{name:'Ship to'});
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  await trigger.focus();
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('radio',{name:/Canada/}).check();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.getByRole('button',{name:/Ship to Canada · CAD/})).toBeVisible();
  await expect(page.locator('.catalog > li').filter({ has: page.getByRole('heading', { name: 'Rice Toner', exact: true }) }).getByText('from C$28.98',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'View bag · 4 items'}).click();
  await expect(page.locator('.checkout-total > .money')).toHaveText('C$160.87');
  await page.reload();await expect(page.locator('.checkout-total > .money')).toHaveText('C$160.87');
});
test('country change removes restricted products and blocked products cannot be added',async({page})=>{
  await page.goto('/shop');await page.getByRole('button',{name:/Ship to United States/}).click();
  await page.getByRole('radio',{name:/Canada/}).check();await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Sun',exact:true}).click();
  await page.getByRole('button',{name:'Add Watery Sun Essence SPF 50+',exact:true}).click();
  await page.getByRole('button',{name:/Ship to Canada/}).click();await page.getByRole('radio',{name:/United States/}).check();await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.getByRole('status').filter({ hasText: '1 item removed' })).toContainText('1 item removed');
  await expect(page.getByRole('button',{name:'Add Watery Sun Essence SPF 50+',exact:true})).toBeDisabled();
  await expect(page.getByRole('link',{name:'Bag, 0 items'})).toBeVisible();
});
test('routine and permissions persist while checkout remains the ceiling and cannot fake payment',async({page})=>{
  const financial:string[]=[];page.on('request',request=>{if(financialRequest(request.url()))financial.push(request.url());});
  await page.goto('/shop');await page.getByRole('link',{name:/Ask for a routine/}).click();
  await page.getByLabel('What would you like your routine to do?').fill('A gentle routine for dry skin');
  await page.getByRole('button', { name: 'Find my routine' }).click();
  await page.getByRole('link',{name:'Add routine to bag'}).click();
  await expect(page.locator('.checkout-total > .money')).toHaveText('$118.82');
  await page.getByRole('switch',{name:/Older packaging/}).uncheck();
  await page.getByRole('switch',{name:/Bundles/}).uncheck();
  await page.reload();await expect(page.getByRole('switch',{name:/Older packaging/})).not.toBeChecked();
  await expect(page.locator('.checkout-total > .money')).toHaveText('$118.82');
  await expect(page.getByRole('button',{name:'Pay with PayPal'})).toBeVisible();
  await page.goto('/paid');await expect(page.getByRole('heading',{name:'Your order is not available'})).toBeVisible();
  expect(financial.filter(url => /\/checkout|\/approve|\/capture/.test(new URL(url).pathname))).toEqual([]);
});
test('auction follows bids, pauses and replays without financial requests', async ({ page }, info) => {
  const financial: string[] = []; page.on('request', request => { if (financialRequest(request.url())) financial.push(request.url()); });
  await page.clock.install(); await page.goto(recorded('/deal'));
  await expect(page.getByRole('heading', { name: 'Shops are bidding' })).toBeVisible();
  await page.clock.runFor(6000);
  await expect(page.locator('.auction-item')).toHaveCount(4);
  await expect(page.getByRole('status')).toHaveText('Your total, all in: $110.29');
  const pause = page.getByRole('button', { name: 'Pause bidding' });
  expect((await pause.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await pause.click(); await page.clock.runFor(30000);
  await expect(page.getByRole('heading', { name: 'Bidding paused' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Your total, all in: $110.29');
  await screenshot(page, `deal-live-${info.project.name}`);
  await page.getByRole('button', { name: 'Resume bidding' }).click(); await page.clock.runFor(14000);
  await expect(page.getByRole('heading', { name: 'Bidding complete' })).toBeVisible();
  await expect(page.locator('.hero-money')).toHaveText('$101.92');
  await expect(page.locator('.auction-lane.won')).toHaveCount(4);
  await expect(page.getByText('Won by Haneul Beauty', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Outbid', { exact: true })).toBeVisible();
  await expect(page.locator('.bid-floor')).toHaveCount(0);
  if (info.project.name === 'desktop') expect(await page.locator('.auction-board').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
  await screenshot(page, `deal-done-${info.project.name}`);
  await page.getByRole('button', { name: 'Watch the bidding again' }).click(); await page.clock.runFor(20000);
  await expect(page.getByRole('status')).toHaveText('Your total, all in: $101.92');
  await page.getByRole('link', { name: 'See your order' }).click(); await expect(page.locator('.hero-money')).toHaveText('$101.92');
  await expect(page.getByText('Haneul Beauty · Bundle', { exact: true })).toHaveCount(2);
  await page.getByText('See breakdown', { exact: true }).click(); await expect(page.locator('.breakdown').getByRole('definition').filter({ hasText: '$101.92' })).toBeVisible();
  await page.getByRole('link', { name: 'Track order' }).click(); await expect(page.getByRole('heading', { name: 'Packing in Seoul' })).toBeVisible();
  expect(financial).toEqual([]);
});
test('reduced motion applies auction states without sliding or counting', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.install(); await page.goto(recorded('/deal'));
  await page.clock.runFor(1200);
  for (const marker of await page.locator('.bid-marker').all()) await expect(marker).toHaveCSS('transition-duration', '0s');
  await page.clock.runFor(20000); await expect(page.locator('.hero-money')).toHaveText('$101.92');
});
test('ordinary private routes are locked without fetching shop economics',async({page})=>{
  const calls:string[]=[];page.on('request',request=>{if(request.url().includes('/api/'))calls.push(request.url());});
  for(const route of ['/shops/orders','/shops/products','/shops/settings']) {await page.goto(route);await expect(page.getByText(/Sign in to your shop account/)).toBeVisible();}
  expect(calls.every(url => new URL(url).pathname === '/api/session')).toBe(true);
});
test('a rejected shop session never renders private product prices',async({page})=>{
  await page.route('**/api/shops/dalbit/workspace',route=>route.fulfill({status:401,json:{error:'sign in required'}}));
  await page.goto(recorded('/shops/products'));await expect(page.getByRole('heading',{name:'Your shop workspace'})).toBeVisible();await expect(page.getByRole('columnheader',{name:'Lowest price'})).toHaveCount(0);
});
for(const width of [320,768])test(`all shopper routes reflow at ${width}px with readable decision text`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  for(const route of ['shop','ask','bag','deal','paid','track']) {
    await page.goto(recorded('/'+route));await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await page.locator('.product-copy,.tile-copy,.deal-product > div').evaluateAll(elements=>elements.every(element=>element.scrollWidth<=element.clientWidth+1))).toBe(true);
    expect(await page.locator('.brand,.fine,.deal-product small,.product-copy small,.rule-tag,.test-mode').evaluateAll(elements=>elements.every(element=>parseFloat(getComputedStyle(element).fontSize)>=11.99))).toBe(true);
  }
});
test('ordinary text resized to 200 percent reflows without hiding money',async({page})=>{
  await page.setViewportSize({width:390,height:1000});
  for(const route of ['shop','ask','bag','deal','paid','track']) {
    await page.goto(recorded('/'+route));await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();await page.addStyleTag({content:':root{font-size:187.5%!important}'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(await page.locator('.hero-money,.product-copy,.tile-copy').evaluateAll(elements=>elements.every(element=>element.scrollWidth<=element.clientWidth+1))).toBe(true);
  }
});
test('the SVG icon is served as a real resource',async({page})=>{
  await page.goto('/shop');const url=await page.locator('link[rel=icon]').evaluate((element:HTMLLinkElement)=>element.href);const response=await page.request.get(url);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml/);
});


test('recorded order keeps its checkout consent and currency separate from the editable bag', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('rally-shopping-v2',JSON.stringify({country:'CA',items:['dal-rice-toner'],rules:{old_packaging_ok:false,bundles_ok:false}})));
  await page.goto(recorded('/deal'));
  await expect(page.locator('.header-title')).toHaveText('Order RL-24817');
  await expect(page.getByText(/order choices saved at checkout/)).toHaveCount(0);
  await page.clock.runFor(20000);
  await expect(page.locator('.hero-money')).toHaveText('$101.92');
  await page.getByRole('link',{name:'See your order'}).click();
  await expect(page.locator('.hero-money')).toHaveText('$101.92');
  await page.goto('/bag');
  await expect(page.locator('.product-rows li')).toHaveCount(1);
  await expect(page.getByRole('switch',{name:/Older packaging/})).not.toBeChecked();
  await expect(page.getByRole('switch',{name:/Bundles/})).not.toBeChecked();
  await expect(page.locator('.checkout-total > .money')).toContainText('C$');
});


test('prototype and malformed saved destinations recover to a valid empty US bag', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/shop');
  for (const country of ['__proto__', 'toString', 'constructor', null, { US: true }]) {
    await page.evaluate(value => localStorage.setItem('rally-shopping-v2', JSON.stringify({ country: value, items: [], rules: { old_packaging_ok: true, bundles_ok: true } })), country);
    await page.reload();
    await expect(page.getByRole('button', { name: /Ship to United States · USD/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bag, 0 items' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('catalog defers lower product images and loads them without changing their reserved size', async ({ page }) => {
  await page.goto('/shop'); await page.evaluate(() => document.fonts.ready);
  const images = page.locator('.catalog img'); await expect(images).toHaveCount(30);
  for (let index = 0; index < 4; index++) await expect(images.nth(index)).toHaveAttribute('loading', 'eager');
  for (let index = 4; index < 30; index++) await expect(images.nth(index)).toHaveAttribute('loading', 'lazy');
  const last = images.last(); const before = (await last.boundingBox())!;
  await last.scrollIntoViewIfNeeded();
  await expect.poll(() => last.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(last).toHaveAttribute('decoding', 'async');
  expect((await last.boundingBox())!.height).toBeCloseTo(before.height, 1);
});


test('category rail stays in one row and native keyboard focus reveals every category', async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 664 });
    await page.goto('/shop'); await page.evaluate(() => document.fonts.ready);
    const rail = page.getByRole('navigation', { name: 'Product categories' });
    const choices = rail.getByRole('button');
    await expect(choices).toHaveCount(13);
    if (width === 390) {
      const firstPhoto = (await page.locator('.catalog img').first().boundingBox())!;
      expect(firstPhoto.y + 64).toBeLessThanOrEqual(664);
    }
    const textBounds = (element: HTMLElement | SVGElement) => {
      const range = document.createRange(); range.selectNodeContents(element);
      const rect = range.getBoundingClientRect(); return { left: rect.left, right: rect.right };
    };
    if (width === 768) {
      const mask = rail.getByRole('button', { name: 'Mask', exact: true });
      const clip = (await rail.boundingBox())!;
      const before = await mask.evaluate(textBounds);
      // Native overflow clips this raw text completely; it is not painted at the viewport edge.
      expect(before.left).toBeGreaterThanOrEqual(clip.x + clip.width);
      await tabTo(page, mask);
      const revealed = await mask.evaluate(textBounds);
      expect(revealed.left).toBeGreaterThanOrEqual(16);
      expect(revealed.right).toBeLessThanOrEqual(width - 16);
      expect(revealed.right).toBeLessThanOrEqual(clip.x + clip.width);
    }
    const care = rail.getByRole('button', { name: 'Care', exact: true });
    await tabTo(page, care);
    const frame = (await rail.boundingBox())!, focused = (await care.boundingBox())!;
    expect(focused.x).toBeGreaterThanOrEqual(frame.x);
    expect(focused.x + focused.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(await rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('.catalog > li')).toHaveCount(1);
    for (let index = 1; index < 13; index++) await page.keyboard.press('Shift+Tab');
    await expect(rail.getByRole('button', { name: 'All', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.catalog > li')).toHaveCount(30);
    await page.addStyleTag({ content: ':root{font-size:187.5%!important}' });
    expect(await rail.evaluate(element => getComputedStyle(element).flexWrap)).toBe('nowrap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('shop auction lanes expose only its own lowest prices', async ({ page }) => {
  await shopContract(page); await page.goto(recorded('/shops/orders'));
  await expect(page.locator('.auction-item')).toHaveCount(4);
  await expect(page.locator('.bid-floor')).toHaveCount(2);
  await expect(page.getByText('Your lowest:', { exact: false })).toHaveCount(2);
  await expect(page.locator('.auction-box')).toContainText('Dalbit Official');
  await page.goto(recorded('/deal'));
  await expect(page.locator('.bid-floor')).toHaveCount(0);
});

test('adding a routine preserves unique existing selections and refuses overflow without dropping items', async ({ page }) => {
  await page.goto('/shop');
  const existing = ['byeol-vitc', 'dal-rice-toner'];
  await page.evaluate(items => localStorage.setItem('rally-shopping-v2', JSON.stringify({ country: 'US', items, rules: { old_packaging_ok: false, bundles_ok: true } })), existing);
  await page.goto('/ask');
  await page.getByLabel('What would you like your routine to do?').fill('A gentle routine for dry skin');
  await page.getByRole('button', { name: 'Find my routine' }).click();
  await page.getByRole('link', { name: 'Add routine to bag' }).click();
  await expect(page.locator('.product-rows li')).toHaveCount(5);
  await expect(page.locator('.product-copy strong').filter({ hasText: 'Vitamin C Serum' })).toHaveCount(1);
  await expect(page.locator('.product-copy strong').filter({ hasText: 'Rice Toner' })).toHaveCount(1);
  await expect(page.getByRole('switch', { name: /Older packaging/ })).not.toBeChecked();
  const full = catalog.filter(item => allowed(item, 'US') && !hero.cart.includes(item.id)).slice(0,8).map(item => item.id);
  await page.evaluate(items => localStorage.setItem('rally-shopping-v2', JSON.stringify({ country: 'US', items, rules: { old_packaging_ok: true, bundles_ok: true } })), full);
  await page.goto('/ask');
  await page.getByLabel('What would you like your routine to do?').fill('A gentle routine for dry skin');
  await page.getByRole('button', { name: 'Find my routine' }).click();
  await expect(page.getByRole('button', { name: 'Add routine to bag' })).toBeDisabled();
  await expect(page.getByText('This routine would make 12 items. Your bag can hold eight. Remove 4 items before adding it.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit bag' }).click();
  await expect(page.locator('.product-rows li')).toHaveCount(8);
  expect((await page.locator('.product-copy strong').allTextContents()).sort()).toEqual(full.map(id => catalog.find(item => item.id === id)!.name).sort());
});

test('compact phone bidding header leaves the item lanes readable while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.clock.install(); await page.goto(recorded('/deal')); await page.clock.runFor(6000);
  await page.getByRole('button', { name: 'Pause bidding' }).click();
  const reveal = async () => page.evaluate(() => {
    const header = document.querySelector('.auction-sticky')!.getBoundingClientRect();
    const content = document.querySelector('.auction-content')!.getBoundingClientRect();
    window.scrollBy(0, content.top - header.height - 8);
  });
  await reveal();
  const lastLane = page.locator('.auction-item').first().locator('.auction-lane').last();
  expect((await lastLane.boundingBox())!.y + (await lastLane.boundingBox())!.height).toBeLessThanOrEqual(664);
  const dir = resolve('../.runtime/frontend-screenshots'); await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/auction-compact-live.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Resume bidding' }).click(); await page.clock.runFor(20000);
  await reveal(); await page.screenshot({ path: `${dir}/auction-compact-done.png`, animations: 'disabled' });
  await expect(page.locator('.auction-box')).toContainText('Your box');
  expect((await page.locator('.auction-actions').boundingBox())!.y).toBeGreaterThan((await page.locator('.auction-box').boundingBox())!.y);
});
