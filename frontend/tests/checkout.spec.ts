// Explicit API/provider doubles: state and layout checks, never sandbox payment evidence.
import { test, expect } from "@playwright/test";
import catalog from "../../catalog.json" with { type: "json" };
import { mkdirSync } from "node:fs";

async function setup(page: any) {
  const offer = { offer_id: "test-offer", product_id: "arc-991", title: catalog[0].title, variant: "Graphite", quantity: 1, merchant: "Commonplace Supply", total_minor: 6500, currency: "USD", minimum: 5, capacity: 5, delivery_days: 7, tax_minor: 0, payment_terms: "Conditional authorization" };
  const state: any = { group: { id: "test-group", run_id: "test-run", mode: "connected", status: "OPEN", activated: true, demo: false, deadline: new Date(Date.now() + 86400000).toISOString() }, offer, ordinary_price_minor: 8000, confirmed_count: 3, completed_captures: 0, commitment: null, authorization_pending: false, decision: null, buyer: { name: "You", prepared: false }, webhooks: [], members: [], evidence: [ { kind: "authorization", status: "CREATED", evidence_source: "api", resource_id: "…latest", updated_at: "2026-10-07T01:20:00Z" }, { kind: "authorization", status: "CREATED", evidence_source: "reconciliation", resource_id: "…older", updated_at: "2026-10-07T01:19:00Z" } ] };
  const members = (n: number) => Array.from({ length: n }, (_, i) => ({ position: i + 1, is_you: i === 4, authorization_status: "CREATED", capture_status: null, refund_status: null, void_status: null, capture_operation_status: null }));
  state.members = members(3);
  const commands: string[] = [];
  await page.route("**/api/**", async (route: any) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/api/config") body = { mode: "connected", paypal_configured: true, paypal_client_id: "test-client", llm_configured: false };
    else if (path === "/api/session") body = { run_id: "test-run" };
    else if (path === "/api/opportunity") body = { ...state, available: true };
    else if (path === "/api/status") body = state;
    else if (path === "/api/commitments") {
      expect(route.request().postDataJSON().accepted_terms).toEqual(offer);
      state.commitment = { id: "test-commitment", active: true, admitted: false, withdrawn: false, order_id: "test-order", authorization_id: null, accepted_terms: offer };
      body = state.commitment;
    } else if (path.endsWith("/authorize")) { commands.push(path); expect(route.request().postDataJSON().order_id).toBe("test-order"); state.authorization_pending = true; }
    else if (path.endsWith("/leave")) { state.commitment.active = false; state.commitment.withdrawn = true; }
    await route.fulfill({ json: body });
  });
  await page.route("https://www.paypal.com/sdk/js?**", (route: any) => route.fulfill({ contentType: "application/javascript", body: `window.paypal = { Buttons: options => ({ render: async element => { for (const [label, action] of [['Test PayPal approval', () => options.onApprove({orderID: options.createOrder()})], ['Test PayPal cancellation', options.onCancel]]) {const button = document.createElement('button'); button.textContent = label; button.onclick = action; element.append(button);} }, close() {} }) };` }));
  return { state, members, commands };
}

test("persistent checkout restores owned approval, verifies every capture, and keeps controls stable", async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const { state, members } = await setup(page);
  mkdirSync("../.impeccable/review", { recursive: true });
  const screen = async (name: string) => page.screenshot({ path: `../.impeccable/review/${name}-${info.project.name}.png`, fullPage: true });
  await page.goto("/shop");
  const widget = page.getByRole("region", { name: "Coalition group offer" });
  await expect(widget.getByText("3 of 5 committed")).toBeVisible();
  await expect(widget.getByText("Save $15")).toBeVisible();
  const join = widget.getByRole("link", { name: "Join for $65" });
  const bounds = await join.boundingBox(); expect(bounds!.y + bounds!.height).toBeLessThan(page.viewportSize()!.height);
  await screen("merchant");
  await join.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/checkout\?run=test-run$/);
  const checkout = page.getByRole("complementary", { name: "Coalition group purchase" });
  await expect(page.getByRole("heading", { name: catalog[0].title, exact: true })).toBeVisible();
  await expect(page.getByText("Graphite · Quantity 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivery within 7 days", { exact: true })).toBeVisible();
  await expect(checkout.locator(".position-number")).toHaveText(["1", "2", "3", "4", "5"]);
  await expect(checkout.locator(".payment-event").getByText(/api · …latest/)).toBeVisible();
  await expect(checkout.getByText(/reconciliation · …older/)).not.toBeVisible();
  const controls = checkout.locator(".primary-control");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".checkout-payment")).toHaveCSS("transform", "none");
  const before = await controls.boundingBox();
  await screen("checkout");
  await checkout.getByText("Activity & payment evidence", { exact: true }).click();
  await expect(checkout.getByText(/reconciliation · …older/)).toBeVisible();
  await checkout.getByText("Activity & payment evidence", { exact: true }).click();
  state.confirmed_count = 4; state.members = members(4);
  await expect(checkout.getByText("4 of 5 committed")).toBeVisible({ timeout: 7000 });
  await expect(checkout.locator(".commitment-track > svg")).toHaveCount(0, { timeout: 5000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const after = await controls.boundingBox(); expect(after!.y).toBeCloseTo(before!.y, 0);
  await expect(checkout.getByRole("button", { name: "Continue with PayPal" })).toBeDisabled();
  await checkout.getByRole("checkbox").check();
  await checkout.getByRole("button", { name: "Continue with PayPal" }).click();
  await checkout.getByRole("button", { name: "Test PayPal cancellation" }).click();
  await expect(checkout.getByRole("alert")).toContainText("PayPal approval canceled");
  await checkout.getByRole("button", { name: "Test PayPal approval", exact: true }).click();
  await expect(checkout.getByRole("heading", { name: "Verifying authorization" })).toBeVisible();
  await page.reload();
  await expect(checkout.getByRole("heading", { name: "Verifying authorization" })).toBeVisible();
  await expect(checkout.getByText("4 of 5 committed")).toBeVisible();
  await expect(checkout.getByRole("button", { name: "Test PayPal approval", exact: true })).toHaveCount(0);
  state.authorization_pending = false; state.confirmed_count = 5; state.members = members(5);
  state.commitment = { ...state.commitment, admitted: true, authorization_id: "test-auth", authorization_status: "CREATED" }; state.group.status = "SETTLING";
  state.members[0].capture_status = "COMPLETED"; state.members[1].capture_status = "PENDING"; state.members[2].capture_operation_status = "unknown"; state.completed_captures = 1;
  await expect(checkout.getByRole("heading", { name: "Completing payments" })).toBeVisible({ timeout: 7000 });
  await expect(checkout.getByText("Verifying outcome")).toBeVisible();
  await expect(checkout.getByRole("region", { name: "Payment receipt" })).toHaveCount(0);
  await screen("settling");
  state.group.status = "SUCCEEDED"; state.commitment.capture_id = "test-capture"; state.commitment.capture_status = "COMPLETED";
  // A premature group flag cannot bypass the receipt's all-captures guard.
  await expect(checkout.getByRole("heading", { name: "Verifying final payments" })).toBeVisible({ timeout: 7000 });
  await expect(checkout.getByRole("region", { name: "Payment receipt" })).toHaveCount(0);
  state.completed_captures = 5; state.members.forEach((m: any) => m.capture_status = "COMPLETED");
  await expect(checkout.getByText("Paid $65.00 USD")).toBeVisible({ timeout: 12000 });
  await screen("receipt");
  await page.reload();
  await expect(checkout.getByText("Paid $65.00 USD")).toBeVisible();
  await expect(checkout.locator(".commitment-track > svg")).toHaveCount(0);
  await expect(checkout.locator(".final-receipt")).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  state.group.status = "UNWINDING"; state.commitment.refund_id = "test-refund"; state.commitment.refund_status = "PENDING"; state.members[4].refund_status = "PENDING";
  await expect(checkout.getByRole("heading", { name: "Refund is pending" })).toBeVisible({ timeout: 12000 });
  await expect(checkout.getByRole("region", { name: "Payment receipt" })).toHaveCount(0);
  state.commitment.refund_status = "COMPLETED"; state.members.forEach((m: any) => m.refund_status = "COMPLETED"); state.group.status = "FAILED"; state.confirmed_count = 0;
  await expect(checkout.getByRole("heading", { name: "Your refund is confirmed." })).toBeVisible({ timeout: 7000 });
  await expect(checkout.getByText("0 of 5 committed")).toBeVisible();
  await expect(checkout.locator(".commitment-track > svg")).toHaveCount(0);
  await screen("refund");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test("PayPal redirects only authorize the session-owned matching order and restore cancellation", async ({ page }) => {
  const { state, commands } = await setup(page);
  state.commitment = { id: "test-commitment", active: true, admitted: false, order_id: "test-order", authorization_id: null, accepted_terms: state.offer };
  await page.goto("/shop?run=test-run&paypal_return=1&token=someone-elses-order");
  await expect(page).toHaveURL(/\/checkout\?run=test-run$/);
  await expect(page.getByText(/does not match your payment/)).toBeVisible(); expect(commands).toEqual([]);
  await page.goto("/checkout?run=test-run&paypal_return=1&token=test-order");
  await expect(page).toHaveURL(/\/checkout\?run=test-run$/);
  await expect(page.getByRole("heading", { name: "Verifying authorization" })).toBeVisible(); expect(commands).toEqual(["/api/commitments/test-commitment/authorize"]);
  state.authorization_pending = false;
  await page.goto("/shop?run=test-run&paypal_cancel=1");
  await expect(page).toHaveURL(/\/checkout\?run=test-run$/);
  await expect(page.getByText(/PayPal approval canceled/)).toBeVisible();
  await page.getByRole("button", { name: "Leave group", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cancellation in progress" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "Cancellation in progress" })).toBeVisible();
  state.commitment.void_status = "VOIDED";
  await expect(page.getByRole("heading", { name: "Authorization canceled." })).toBeVisible({ timeout: 7000 });
});

test("checkout layout remains readable at desktop, mobile, and narrow widths", async ({ page }, info) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/checkout?run=test-run");
  const action = page.getByRole("button", { name: "Continue with PayPal" });
  await expect(action).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  mkdirSync("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/${info.project.name}.png`, fullPage: true });
  await page.screenshot({ path: `../.impeccable/review/${info.project.name}-viewport.png` });
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 720 });
    await expect(action).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: "../.impeccable/review/narrow.png", fullPage: true });
  }
  await page.setViewportSize({ width: 820, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(action).toBeVisible();
});

test("failed PayPal loading has a working retry without another commitment", async ({ page }) => {
  const { state } = await setup(page);
  let loads = 0;
  await page.route("https://www.paypal.com/sdk/js?**", async route => {
    loads++;
    if (loads === 1) await route.abort("failed");
    else await route.fulfill({ contentType: "application/javascript", body: `window.paypal={Buttons:()=>({render:async el=>{const b=document.createElement('button');b.textContent='PayPal loaded after retry';el.append(b)},close(){}})}` });
  });
  await page.goto("/checkout?run=test-run");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue with PayPal" }).click();
  await expect(page.getByRole("alert")).toContainText("PayPal SDK could not load");
  const original = state.commitment.id;
  await page.getByRole("button", { name: "Retry PayPal approval" }).click();
  await expect(page.getByRole("button", { name: "PayPal loaded after retry" })).toBeVisible();
  expect(loads).toBe(2); expect(state.commitment.id).toBe(original);
});

test("optional assistant follows payment controls in keyboard order", async ({ page }) => {
  await setup(page);
  await page.route("**/api/config", route => route.fulfill({ json: { mode: "fixture", paypal_configured: false, llm_configured: false } }));
  await page.goto("/checkout?run=test-run");
  const consent = page.getByRole("checkbox");
  await consent.check(); await consent.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Simulate $65 authorization" })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByText("Activity & payment evidence", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByText("Optional · Does this fit my needs?", { exact: true })).toBeFocused();
});
