// Real API/worker/PostgreSQL with explicitly simulated model and payments.
import { test, expect, type APIRequestContext } from "@playwright/test";

const token = process.env.COALITION_OPERATOR_TOKEN;
const stackUrl = process.env.COALITION_E2E_URL;
test.skip(!token || !stackUrl, "Requires isolated fixture API/worker/PostgreSQL.");
async function operator(request: APIRequestContext, path: string, body?: unknown) {
  const response = await request.fetch("/api/operator" + path, {
    method: body === undefined ? "GET" : "POST", data: body,
    headers: { "X-Coalition-Request": "1", "X-Operator-Token": token!, Origin: new URL(stackUrl!).origin },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

for (const scenario of ["success", "deadline", "partial", "refund_pending"]) {
  test(`headphone stack: ${scenario}, compensation and durable refresh`, async ({ page, request }) => {
    test.setTimeout(180_000);
    expect((await (await request.get("/api/config")).json()).mode).toBe("fixture");
    const run = await operator(request, "/runs", { scenario, close_seconds: 90 });
    const path = "/runs/" + run.run_id;
    let evidence: any;
    const refresh = async () => evidence = await operator(request, path);
    await page.goto(run.preparation_links.find((b: any) => b.name === "Sam").url);
    await page.getByRole("button", { name: "Explore Sony WH-CH720N" }).click();
    await expect(page.getByRole("button", { name: "Get group price" })).toBeEnabled();
    await page.getByRole("button", { name: "Get group price" }).click();
    await expect(page.getByRole("heading", { name: "Your group deal" })).toBeVisible();
    await page.getByRole("link", { name: "Review deal", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Coalition group purchase" });
    const approve = async () => {
      await panel.getByRole("checkbox").check();
      await panel.getByRole("button", { name: "Simulate $89 authorization" }).click();
      await expect(panel.getByRole("heading", { name: "Your place is confirmed." })).toBeVisible();
    };
    // Keep Sam among the first four captures in compensation scenarios.
    if (scenario !== "success") await approve();
    if (scenario !== "deadline") {
      await operator(request, path + "/fixture-prepare", {});
      await expect.poll(async () => (await refresh()).buyers.filter((b: any) => b.admitted && !b.withdrawn).length).toBe(scenario === "success" ? 4 : 5);
    }
    await operator(request, path + "/activate", {});
    if (scenario === "success") await approve();
    const outcome = scenario === "success" ? "SUCCEEDED" : scenario === "refund_pending" ? "UNWINDING" : "FAILED";
    await expect.poll(async () => (await refresh()).group.status, { timeout: 115_000 }).toBe(outcome);
    const captured = evidence.buyers.filter((b: any) => b.capture_status === "COMPLETED");
    expect(captured).toHaveLength(scenario === "success" ? 5 : scenario === "deadline" ? 0 : 4);
    if (scenario === "success") {
      await expect(panel.getByText("Paid $85.00 USD")).toBeVisible();
      const status = await (await page.request.get("/api/status?run=" + run.run_id)).json();
      const catalog = await (await request.get("/api/catalog")).json();
      const product = catalog.find((p: any) => p.id === status.offer.product_id);
      for (let i = 0; i < 2; i++) {
        const response = await page.request.post("/api/commitments?run=" + run.run_id, {
          headers: { "X-Coalition-Request": "1" }, data: {
            group_id: status.group.id, accepted_terms: status.offer,
            context: { product_id: product.id, title: product.title, selected_variant: "Graphite", quantity: 1, currency: "USD", displayed_price_minor: product.price_minor },
          },
        });
        expect(response.ok()).toBeTruthy();
        expect((await response.json()).id).toBe(status.commitment.id);
        const authorized = await page.request.post(`/api/commitments/${status.commitment.id}/authorize?run=${run.run_id}`, {
          headers: { "X-Coalition-Request": "1" }, data: { order_id: status.commitment.order_id },
        });
        expect((await authorized.json()).status).toBe("already_authorized");
      }
      expect((await refresh()).operations.filter((p: any) => p.kind === "capture")).toHaveLength(5);
      await page.reload();
      await expect(panel.getByText("Paid $85.00 USD")).toBeVisible();
      await operator(request, path + "/refund-cleanup", {});
      await expect.poll(async () => (await refresh()).group.status).toBe("FAILED");
      await expect(panel.getByRole("heading", { name: "Your refund is confirmed." })).toBeVisible({ timeout: 15_000 });
    } else if (scenario === "refund_pending") {
      await expect(panel.getByRole("heading", { name: "Refund is pending" })).toBeVisible();
      expect(captured.every((b: any) => b.refund_status === "PENDING")).toBe(true);
      const archive = await request.post("/api/operator" + path + "/archive", {
        data: {}, headers: { "X-Operator-Token": token!, "X-Coalition-Request": "1", Origin: new URL(stackUrl!).origin },
      });
      expect(archive.status()).toBe(409);
      await operator(request, path + "/fixture-refunds", {});
      await expect.poll(async () => (await refresh()).group.status).toBe("FAILED");
      await expect(panel.getByRole("heading", { name: "Your refund is confirmed." })).toBeVisible();
    } else if (scenario === "partial") {
      expect(captured.every((b: any) => b.refund_status === "COMPLETED")).toBe(true);
      expect(evidence.buyers.filter((b: any) => b.void_status === "VOIDED")).toHaveLength(1);
      await expect(panel.getByRole("heading", { name: "Your refund is confirmed." })).toBeVisible();
    } else {
      expect(evidence.buyers.filter((b: any) => b.void_status === "VOIDED")).toHaveLength(1);
      await expect(panel.getByRole("heading", { name: "Authorization canceled." })).toBeVisible();
    }
    const operations = evidence.operations.map((p: any) => p.id).sort();
    await page.reload();
    await operator(request, path + "/archive", {});
    expect((await refresh()).operations.map((p: any) => p.id).sort()).toEqual(operations);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
