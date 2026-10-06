// Explicit API fixtures test rendering and buyer navigation; never evidence of PayPal or PostgreSQL.
import { test, expect } from "@playwright/test";
import catalog from "../../catalog.json" with { type: "json" };
const offer = {
  offer_id: "campus-calculator-v1",
  product_id: "arc-991",
  title: catalog[0].title,
  variant: "Graphite",
  quantity: 1,
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
        default_run_id: "test-run",
        paypal_client_id: null,
        paypal_configured: false,
        llm_configured: false,
      };
    else if (path === "/api/opportunity")
      body = {
        ...status(),
        available:
          JSON.parse(route.request().postData() || "{}").selected_variant ===
          "Graphite",
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
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: catalog[0].title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Join for $65" }).click();
  const panel = page.getByRole("complementary", {
    name: "Coalition group purchase",
  });
  await expect(
    panel.getByText("FIXTURE DEMO · PAYMENTS & AI SIMULATED"),
  ).toBeVisible();
  await expect(panel.getByText("Shipping · within 7 days")).toBeVisible();
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
  await page.getByRole("button", { name: "View group status" }).click();
  await expect(
    page.getByRole("heading", { name: "Your group made it." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close group offer" }).click();
  await page.getByRole("button", { name: "Cloud", exact: true }).click();
  await expect(
    page.getByText("No exact group offer for this selection."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Desk & workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Form Task Lamp", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Everyday carry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Rove Everyday Bottle · 750 ml",
      exact: true,
    }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
});
