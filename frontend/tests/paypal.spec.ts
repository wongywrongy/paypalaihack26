import { expect, test } from '@playwright/test';

test('SDK6 uses server order, destination eligibility and server approval callback', async ({ page }) => {
  await page.route('https://www.sandbox.paypal.com/web-sdk/v6/core', route => route.fulfill({ contentType: 'application/javascript', body: `
    customElements.define('paypal-button', class extends HTMLElement {
      connectedCallback() { this.setAttribute('role','button'); this.tabIndex = 0; this.textContent = 'Pay with PayPal'; }
    });
    window.sdkCalls = [];
    window.paypal = { createInstance: async config => {
      window.sdkCalls.push(config);
      return {
        findEligibleMethods: async config => { window.sdkCalls.push(config); return { isEligible: method => method === 'paypal' }; },
        createPayPalOneTimePaymentSession: callbacks => ({ hasReturned: () => false, resume: async () => {}, start: async (options, promise) => {
          if (!(promise instanceof Promise)) throw new Error('SDK6 requires an invoked promise');
          const order = await promise; window.sdkCalls.push(order);
          await callbacks.onApprove({ orderId: order.orderId });
        } })
      };
    } };
  ` }));
  await page.goto('/shop?test=recorded');
  await page.evaluate(async () => {
    const reactPath = '/node_modules/.vite/deps/react.js';
    const rootPath = '/node_modules/.vite/deps/react-dom_client.js';
    const componentPath = '/src/components/PayPalApproval.tsx';
    const [{ default: { createElement } }, { default: { createRoot } }, { default: PayPalApproval }] = await Promise.all([import(reactPath), import(rootPath), import(componentPath)]);
    const host = document.createElement('div'); host.id = 'sdk-check'; document.body.append(host);
    createRoot(host).render(createElement(PayPalApproval, {
      clientId: 'public-client', currency: 'CAD',
      createOrder: async () => { host.dataset.created = 'server-order'; return { orderId: 'SERVER-PAYPAL-ORDER' }; },
      approveOrder: async (orderId: string) => { host.dataset.approved = orderId; },
      onError: (message: string) => { host.dataset.error = message; },
    }));
  });
  const host = page.locator('#sdk-check');
  await host.getByRole('button', { name: 'Pay with PayPal' }).click();
  await expect(host).toHaveAttribute('data-approved', 'SERVER-PAYPAL-ORDER');
  expect(await page.evaluate(() => (window as Window & { sdkCalls?: unknown[] }).sdkCalls)).toEqual([
    { clientId: 'public-client', components: ['paypal-payments'], pageType: 'checkout' },
    { currencyCode: 'CAD' }, { orderId: 'SERVER-PAYPAL-ORDER' },
  ]);
  await expect(host).toHaveAttribute('data-error', '');
});
