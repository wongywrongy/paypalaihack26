// Deterministic public API fixtures; no actual model or PayPal operations.
import { test, expect, type Page } from "@playwright/test";
import catalog from "../../catalog.json" with { type: "json" };
import { mkdirSync } from "node:fs";

const product = catalog.find(p => p.id === "sony-wh-ch720n")!;
const delivery = new Date(Date.now() + 7 * 86400000).toISOString();
const closing = new Date(Date.now() + 1200000).toISOString();
function round(id: number, speaker: string, action: string, prices: number[], changes: any[] = []) {
  return { id, sequence: id - 10, speaker, action, valid: true, currency: "USD", timestamp: new Date().toISOString(),
    tiers: prices.map((total_each_cents, i) => ({ minimum_buyers: i === 0 ? 3 : 5, total_each_cents })), changes,
    explanation: speaker === "merchant" ? "Within the merchant's published quantity-price ranges." : "Within your maximum and delivery requirement. Human payment approval is still needed.",
    accepted_quote_reference: null };
}
async function setup(page: Page) {
  const calls = { negotiation: 0, payment: 0 };
  const journey: any = { request: { id: "request", raw_text: "Noise-canceling headphones under $100 for my iPhone 12. I can wait a week.", status: "completed", constraints: { max_total_minor: 9999, latest_arrival: delivery.slice(0, 10), required_features: ["Active noise cancellation"], device: "iPhone 12", flexibility: [] } },
    group: { id: "group", run_id: "run", profile: "small", status: "DRAFT" }, products: catalog.filter(p => p.catalog_active),
    assessments: [{ product_id: product.id, eligible: true, available: 55, requirements: [] }, { product_id: "bose-quietcomfort", eligible: true, available: 55, requirements: [] }],
    compatible_counts: { [product.id]: 4, "bose-quietcomfort": 2 }, compatible_count: 4,
    rounds: [], negotiation: null, status: null, eligible: true };
  const negotiation = (state: string, phase: string, error_kind: string | null = null) => ({ id: "negotiation", product_id: product.id, request_id: journey.request.id, status: state === "agreed" ? "accepted" : ["declined", "interrupted"].includes(state) ? "failed" : "running", state, phase, error_kind, error: null });
  const agree = (prices: number[]) => {
    journey.negotiation = negotiation("agreed", "agreed"); journey.group.status = "OPEN";
    const offer = { offer_id: "quote-fixture", version: 1, pricing_model: "tiers", product_id: product.id, title: product.title, variant: "Black", quantity: 1, merchant: "Commonplace Audio (fictional)", currency: "USD", total_minor: prices[0], minimum: 3, capacity: 5, delivery_days: 7, delivery_by: delivery, close_at: closing, tier_schedule: prices.map((total_each_cents, i) => ({ minimum_buyers: i === 0 ? 3 : 5, total_each_cents })), shipping_minor: 0, tax_minor: 0 };
    journey.status = { group: { ...journey.group, deadline: closing, activated: true, preparation_expires_at: closing }, offer, confirmed_count: 0, completed_captures: 0, commitment: null, authorization_pending: false, members: [], evidence: [], webhooks: [], buyer: { name: "You", prepared: false } };
    journey.rounds.at(-1).accepted_quote_reference = { id: offer.offer_id, version: offer.version };
  };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("commitments")) calls.payment++;
    if (path === "/api/negotiations") { calls.negotiation++; journey.negotiation = negotiation("negotiating", "preparing"); }
    return route.fulfill({ json: path === "/api/config" ? { mode: "fixture" } : path === "/api/session" ? { run_id: "run" } : path === "/api/status" ? journey.status : path === "/api/negotiations" ? { run_id: "run", id: "negotiation" } : journey });
  });
  await page.goto("/?product=" + product.id);
  await expect(page.getByRole("button", { name: "Negotiate for me", exact: true })).toBeEnabled();
  return { journey, calls, negotiation, agree };
}

test("merchant accepts first offer; completed exchange stays open and checkout uses exact quote", async ({ page }) => {
  const h = await setup(page);
  await expect(page.getByText("4 compatible requests · 0 payments authorized")).toBeVisible();
  await expect(page.getByText(/No price agreed yet/)).toBeVisible();
  await page.getByRole("button", { name: "Negotiate for me", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Preparing your offer" })).toBeVisible();
  h.journey.rounds = [round(11, "buyer", "offered", [9200, 8800])];
  h.journey.negotiation = h.negotiation("negotiating", "waiting_for_merchant");
  await expect(page.getByText("Waiting for the merchant", { exact: true })).toBeVisible({ timeout: 12000 });
  await expect(page.locator('[data-round-id="11"]')).toBeVisible();
  h.journey.rounds.push(round(12, "merchant", "accepted", [9200, 8800]));
  h.journey.negotiation.phase = "evaluating_offer";
  await expect(page.locator('[data-round-id="12"][data-action="accepted"]')).toBeVisible();
  h.journey.rounds.push(round(13, "buyer", "accepted", [9200, 8800])); h.agree([9200, 8800]);
  await expect(page.getByRole("heading", { name: "Agreement reached", exact: true })).toBeVisible();
  await expect(page.locator(".negotiation-transcript")).toHaveAttribute("open", "");
  await expect(page.locator('[data-action="countered"]')).toHaveCount(0);
  await expect(page.getByText(/merchant accepted your agent’s offer/)).toBeVisible();
  await page.getByRole("link", { name: "Review agreement & authorize", exact: true }).click();
  await expect(page.getByRole("heading", { name: product.title, exact: true })).toBeVisible();
  await expect(page.locator(".receipt-total")).toContainText("$92");
  expect(h.journey.status.offer).toMatchObject({ offer_id: "quote-fixture", version: 1, total_minor: 9200 });
  expect(h.calls).toEqual({ negotiation: 1, payment: 0 });
});

test("batched rounds animate in order once; counter and agreement restore after refresh", async ({ page }, info) => {
  const h = await setup(page);
  await page.getByRole("button", { name: "Negotiate for me", exact: true }).click();
  await expect(page.getByText("Preparing your offer", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as any).beamRounds = [];
    const observer = new MutationObserver(() => {
      const id = document.querySelector(".agent-connection")?.getAttribute("data-active-round");
      const seen = (window as any).beamRounds;
      if (id && seen.at(-1) !== id) seen.push(id);
    }); observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-active-round"] });
  });
  h.journey.rounds = [round(11, "buyer", "offered", [9200, 8800]), round(12, "merchant", "countered", [9000, 8700], [{ field: "tier_price", minimum_buyers: 3, from_minor: 9200, to_minor: 9000 }, { field: "tier_price", minimum_buyers: 5, from_minor: 8800, to_minor: 8700 }])];
  h.journey.negotiation.phase = "evaluating_offer";
  await expect(page.locator(".proposal-round")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => (window as any).beamRounds)).toEqual(["11", "12"]);
  await expect(page.getByText("3-buyer price: $92 → $90")).toBeVisible();
  mkdirSync("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/negotiation-active-${info.project.name}.png`, fullPage: true });
  await page.reload();
  await expect(page.locator(".proposal-round")).toHaveCount(2);
  await expect(page.locator(".agent-connection svg[aria-hidden]")).toHaveCount(1); // Only the static direction icon; no replayed beam.
  h.journey.rounds.push(round(13, "buyer", "accepted", [9000, 8700])); h.agree([9000, 8700]);
  await expect(page.getByRole("heading", { name: "Agreement reached", exact: true })).toBeVisible();
  await expect(page.getByText(/Could drop to/)).toContainText("$87");
  await expect(page.getByText("$59 less than the simulated list price.")).toBeVisible();
  await page.screenshot({ path: `../.impeccable/review/negotiation-agreed-${info.project.name}.png`, fullPage: true });
  h.journey.rounds.push(h.journey.rounds[1]);
  await page.reload();
  await expect(page.locator(".negotiation-transcript")).not.toHaveAttribute("open", "");
  await page.getByText("View negotiation · 3 exchanges").click();
  await expect(page.locator(".proposal-round")).toHaveCount(3);
  expect(h.calls).toEqual({ negotiation: 1, payment: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  h.journey.request.id = "joining-request";
  await page.reload();
  await expect(page.getByText("You matched an existing negotiated agreement. Review its terms before approving payment.")).toBeVisible();
  await expect(page.locator(".agent-connection")).toContainText("Group buying agent");
  await expect(page.getByRole("link", { name: "Review agreement & authorize", exact: true })).toBeVisible();
  expect(h.calls).toEqual({ negotiation: 1, payment: 0 });
});

test("decline and interruption preserve requirements and require an explicit retry", async ({ page }) => {
  const h = await setup(page);
  await page.getByRole("button", { name: "Negotiate for me", exact: true }).click();
  h.journey.rounds = [round(11, "buyer", "offered", [9200, 8800]), round(12, "merchant", "declined", [])];
  h.journey.negotiation = h.negotiation("declined", "declined", "no_agreement");
  await expect(page.getByText("No agreement reached", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adjust requirements" }).click();
  await expect(page.getByLabel("Maximum delivered total · USD")).toHaveValue("99.99");
  expect(h.calls.negotiation).toBe(1);
  h.journey.negotiation = h.negotiation("interrupted", "interrupted", "provider_failure");
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review agreement & authorize" })).toHaveCount(0);
  expect(h.calls.negotiation).toBe(1);
  await page.getByRole("button", { name: "Retry connection" }).click();
  expect(h.calls.negotiation).toBe(2);
  const previous = h.negotiation("declined", "declined", "no_agreement");
  h.journey.request.id = "edited-request";
  h.journey.request.constraints.max_total_minor = 9000;
  h.journey.negotiation = previous;
  await page.reload();
  await expect(page.getByRole("button", { name: "Negotiate for me", exact: true })).toBeEnabled();
  await expect(page.getByText("No agreement reached", { exact: true })).toHaveCount(0);
  expect(h.calls.negotiation).toBe(2);
  expect(h.calls.payment).toBe(0);
});

test("keyboard and reduced motion expose every offer without beams or payment approval", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const h = await setup(page);
  const button = page.getByRole("button", { name: "Negotiate for me", exact: true });
  await button.focus(); await page.keyboard.press("Enter");
  h.journey.rounds = [round(11, "buyer", "offered", [9200, 8800]), round(12, "merchant", "accepted", [9200, 8800]), round(13, "buyer", "accepted", [9200, 8800])]; h.agree([9200, 8800]);
  await expect(page.getByRole("heading", { name: "Agreement reached", exact: true })).toBeVisible();
  await page.getByText("View negotiation · 3 exchanges").click();
  await expect(page.locator(".proposal-round")).toHaveCount(3);
  await expect(page.locator(".agent-connection svg defs")).toHaveCount(0);
  const link = page.getByRole("link", { name: "Review agreement & authorize", exact: true });
  await link.focus(); await expect(link).toBeFocused();
  expect(h.calls).toEqual({ negotiation: 1, payment: 0 });
});
