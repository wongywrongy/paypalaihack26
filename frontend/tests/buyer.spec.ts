// Explicit API fixtures test rendering and buyer navigation; never evidence of PayPal or PostgreSQL.
import { test, expect } from "@playwright/test";
import catalog from "../../catalog.json" with { type: "json" };
const offer = {
  offer_id: "campus-calculator-v1",
  product_id: "arc-991",
  title: catalog[0].title,
  variant: "Graphite",
  quantity: 1,
  merchant: "Commonplace Supply",
  total_minor: 6500,
  currency: "USD",
  minimum: 5,
  capacity: 5,
  delivery_days: 7,
  payment_terms: "Authorize $65. Conditional capture.",
};
test("buyer reviews exact terms, approves fixture, refreshes and sees completed outcome", async ({
  page,
}) => {
  let orderCreated = false,
    authorized = false,
    completed = false;
  const status = () => ({
    group: {
      id: "test-group",
      run_id: "test-run",
      mode: "fixture",
      status: completed ? "SUCCEEDED" : "OPEN",
      activated: true,
      demo: true,
      deadline: new Date(Date.now() + 90000).toISOString(),
      failure_reason: null,
    },
    offer,
    authorization_pending: false,
    members: Array.from({ length: authorized ? 5 : 4 }, (_, i) => ({ position: i + 1, is_you: i === 4, authorization_status: "CREATED", capture_status: completed ? "COMPLETED" : null, refund_status: null, void_status: null })),
    evidence: [], webhooks: [],
    ordinary_price_minor: 8000,
    confirmed_count: authorized ? 5 : 4,
    completed_captures: completed ? 5 : 0,
    commitment:
      orderCreated || authorized
        ? {
            id: "test-commitment",
            active: true,
            admitted: authorized,
            withdrawn: false,
            order_id: "FIXTURE-order",
            authorization_id: authorized ? "FIXTURE-authorization" : null,
            authorization_status: authorized ? "CREATED" : null,
            capture_id: completed ? "FIXTURE-capture" : null,
            capture_status: completed ? "COMPLETED" : null,
            refund_id: null,
            refund_status: null,
            void_status: null,
            error: null,
          }
        : null,
    decision: {
      status: "completed",
      mode: "fixture",
      result: {
        decision: "accept",
        explanation: "Exact model, within budget and delivery window.",
        unresolved_concerns: [],
      },
    },
    activity: [],
    buyer: { name: "You", prepared: false },
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/api/config")
      body = {
        mode: "fixture",
        paypal_client_id: null,
        paypal_configured: false,
        llm_configured: false,
      };
    else if (path === "/api/status") body = status();
    else if (path === "/api/commitments") {
      orderCreated = true;
      body = { id: "test-commitment", order_id: "FIXTURE-order" };
    } else if (path.endsWith("/authorize")) {
      authorized = true;
      body = { status: "authorization_queued" };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/checkout?run=test-run");
  await expect(
    page.getByRole("heading", { name: catalog[0].title, exact: true }),
  ).toBeVisible();
  const panel = page.getByRole("complementary", {
    name: "Coalition group purchase",
  });
  await expect(
    page.getByText("FIXTURE DEMO · SIMULATED PAYMENTS"),
  ).toBeVisible();
  await expect(page.getByText("Delivery within 7 days", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Simulate $65 authorization" }),
  ).toBeDisabled();
  await panel.getByRole("checkbox").check();
  await panel
    .getByRole("button", { name: "Simulate $65 authorization" })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Your place is confirmed." }),
  ).toBeVisible({ timeout: 10000 });
  completed = true;
  await expect(
    panel.getByRole("heading", { name: "Your group made it." }),
  ).toBeVisible({ timeout: 10000 });
  await expect(panel.getByText("Paid $65.00 USD")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your group made it." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to storefront" })).toHaveAttribute("href", /\/\?run=test-run/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
});

test("historical checkout needs no retired assistant; operator prepares only five-person headphones", async ({ page }) => {
  let assistantRequests = 0;
  const group = {
    id: "test-group", run_id: "test-run", mode: "connected", status: "OPEN",
    activated: true, demo: false, deadline: new Date(Date.now() + 86400000).toISOString(),
    inventory_reserved: 5, needs_attention: false, preparation_expires_at: new Date(Date.now() + 1800000).toISOString(),
  };
  const status = {
    group, offer, members: [], authorization_pending: false, evidence: [], webhooks: [], ordinary_price_minor: 8000, confirmed_count: 0, completed_captures: 0, commitment: null,
    decision: { status: "completed", mode: "connected", result: { decision: "accept", explanation: "Historical recommendation" } },
    activity: [], buyer: { name: "You", prepared: false },
  };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/api/config") body = { mode: "connected", paypal_configured: true, paypal_client_id: "test-client", llm_configured: false };
    else if (path === "/api/session") body = { run_id: "test-run" };
    else if (path === "/api/status") body = status;
    else if (path === "/api/assistant") assistantRequests++;
    else if (path === "/api/operator/runs") body = route.request().method() === "GET" ? [] : {
      run_id: "test-run", judge_url: "/?run=test-run",
      preparation_links: [{ name: "Maya", buyer_id: "maya", url: "/?run=test-run&invite=maya" }],
    };
    else if (path === "/api/operator/runs/test-run") body = {
      group, buyers: [{ id: "maya", name: "Maya", prepared: true, decision_status: "completed", result: status.decision.result }],
      jobs: [], operations: [], observations: [], events: [],
    };
    await route.fulfill({ json: body });
  });
  await page.goto("/checkout?run=test-run");
  const panel = page.getByRole("complementary", { name: "Coalition group purchase" });
  await expect(page.getByText("AI recommendations coming soon", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Evaluate this offer" })).toHaveCount(0);
  await expect(panel.getByText("Live recommendation", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Historical recommendation")).toHaveCount(0);
  await panel.getByRole("checkbox").check();
  await expect(panel.getByRole("button", { name: "Continue with PayPal" })).toBeEnabled();
  await page.screenshot({ path: `/tmp/coalition-placeholder-${test.info().project.name}.png` });
  await page.reload();
  await expect(page.getByText("AI recommendations coming soon", { exact: true })).toHaveCount(0);
  expect(assistantRequests).toBe(0);

  await page.goto("/merchant");
  await expect(page.getByText(/AI recommendations disabled/)).toBeVisible();
  await page.getByLabel("Operator token").fill("test-operator");
  await page.getByRole("button", { name: "Open operator controls" }).click();
  await page.getByRole("button", { name: "Prepare run" }).click();
  await expect(page.getByText("Prepare sandbox buyers", { exact: true })).toBeVisible();
  await expect(page.getByText(/AI recommendations are disabled for this payment demo/)).toBeVisible();
  await expect(page.getByText("Not enabled", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sam’s live recommendation/)).toHaveCount(0);
  await expect(page.getByText("Historical recommendation")).toHaveCount(0);
  await expect(page.getByRole("option", { name: /Large illustrative|Preserved calculator/ })).toHaveCount(0);
  expect(assistantRequests).toBe(0);
});
