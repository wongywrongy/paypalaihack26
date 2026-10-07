// No API interception: these checks require the real PostgreSQL-backed fixture stack.
// Connected PayPal approvals and live AI have their own proof gate; this never simulates them.
import { test, expect, type APIRequestContext } from "@playwright/test";

const token = process.env.COALITION_OPERATOR_TOKEN;
const stackUrl = process.env.COALITION_E2E_URL;
test.skip(
  !token || !stackUrl,
  "Set COALITION_E2E_URL and COALITION_OPERATOR_TOKEN for real-stack checks.",
);

async function operator(
  request: APIRequestContext,
  path: string,
  body?: unknown,
) {
  const response = await request.fetch("/api/operator" + path, {
    method: body === undefined ? "GET" : "POST",
    data: body,
    headers: {
      "X-Coalition-Request": "1",
      "X-Operator-Token": token!,
      Origin: new URL(stackUrl!).origin,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

for (const scenario of ["success", "deadline", "partial", "refund_pending"]) {
  test(`real stack: ${scenario}, receipts, and durable refresh`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const configResponse = await request.get("/api/config");
    expect(configResponse.ok()).toBeTruthy();
    const config = await configResponse.json();
    test.skip(
      config.mode !== "fixture",
      "Fault scenarios and automated approval are fixture-only.",
    );
    const run = await operator(request, "/runs", { scenario, profile: "legacy" });
    const path = "/runs/" + run.run_id;
    let evidence: any;
    const refresh = async () => {
      evidence = await operator(request, path);
      return evidence;
    };
    const authorized = () =>
      evidence.buyers.filter(
        (b: any) =>
          b.admitted &&
          !b.withdrawn &&
          b.authorization_id &&
          ["CREATED", "CAPTURED"].includes(b.authorization_status) &&
          b.void_status !== "VOIDED" &&
          b.refund_status !== "COMPLETED",
      ).length;
    await expect
      .poll(
        async () =>
          (await refresh()).buyers.every(
            (b: any) => b.decision_status === "completed",
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    expect(
      evidence.buyers.find((b: any) => b.name === "Sam").result.decision,
    ).toBe("reject");

    await page.goto("/?run=" + run.run_id);
    await page.getByRole("link", { name: "Join for $65" }).click();
    const panel = page.getByRole("complementary", {
      name: "Coalition group purchase",
    });
    const approve = async () => {
      await panel.getByRole("checkbox").check();
      const button = panel.getByRole("button", {
        name: "Simulate $65 authorization",
      });
      await expect(button).toBeEnabled({ timeout: 30_000 });
      await button.click();
    };
    // Make the judge a captured member in compensation scenarios, to check their actual refund receipt.
    if (scenario === "partial" || scenario === "refund_pending") {
      await approve();
      await expect(
        panel.getByRole("heading", { name: "Your place is confirmed." }),
      ).toBeVisible({ timeout: 30_000 });
    }
    await operator(request, path + "/fixture-prepare", {});
    const prepared =
      scenario === "partial" || scenario === "refund_pending" ? 5 : 4;
    await expect
      .poll(
        async () => {
          await refresh();
          return authorized();
        },
        { timeout: 30_000 },
      )
      .toBe(prepared);
    expect(evidence.group.status).toBe("OPEN");
    expect(evidence.group.activated).toBe(false);
    expect(evidence.group.deadline).toBeNull();
    expect(evidence.buyers.some((b: any) => b.capture_id)).toBe(false);
    await operator(request, path + "/activate", {});
    if (scenario === "success") await approve();

    const outcome =
      scenario === "success"
        ? "SUCCEEDED"
        : scenario === "refund_pending"
          ? "UNWINDING"
          : "FAILED";
    await expect
      .poll(async () => (await refresh()).group.status, {
        timeout: scenario === "deadline" ? 110_000 : 30_000,
      })
      .toBe(outcome);
    const captured = evidence.buyers.filter(
      (b: any) => b.capture_status === "COMPLETED",
    );
    expect(captured.length).toBe(
      scenario === "success" ? 5 : scenario === "deadline" ? 0 : 4,
    );

    if (scenario === "success") {
      await expect(panel.getByText("Paid $65.00 USD")).toBeVisible({
        timeout: 10_000,
      });
      const commitment = evidence.buyers.find((b: any) => b.name === "You");
      // Duplicate join/authorization requests retain the existing IDs and operation count.
      const status = await (await page.request.get("/api/status")).json();
      for (let i = 0; i < 2; i++) {
        const duplicate = await page.request.post("/api/commitments", {
          headers: { "X-Coalition-Request": "1" },
          data: {
            group_id: status.group.id,
            accepted_terms: status.offer,
            context: {
              product_id: "arc-991",
              title: status.offer.title,
              selected_variant: "Graphite",
              displayed_price_minor: 8000,
              currency: "USD",
              quantity: 1,
            },
          },
        });
        expect(duplicate.ok()).toBeTruthy();
        expect((await duplicate.json()).id).toBe(commitment.commitment_id);
        const authorization = await page.request.post(
          `/api/commitments/${commitment.commitment_id}/authorize`,
          {
            headers: { "X-Coalition-Request": "1" },
            data: { order_id: status.commitment.order_id },
          },
        );
        expect((await authorization.json()).status).toBe("already_authorized");
      }
      await refresh();
      expect(
        evidence.operations.filter((op: any) => op.kind === "capture").length,
      ).toBe(5);
      const archive = await request.post("/api/operator" + path + "/archive", {
        data: {},
        headers: {
          "X-Operator-Token": token!,
          "X-Coalition-Request": "1",
          Origin: new URL(stackUrl!).origin,
        },
      });
      expect(archive.status()).toBe(409);
      await page.reload();
      await expect(panel.getByText("Paid $65.00 USD")).toBeVisible();
      await operator(request, path + "/refund-cleanup", {});
      await expect
        .poll(async () => (await refresh()).group.status, { timeout: 30_000 })
        .toBe("FAILED");
      await expect(
        panel.getByRole("heading", { name: "Your refund is confirmed." }),
      ).toBeVisible({ timeout: 10_000 });
    } else if (scenario === "refund_pending") {
      await expect
        .poll(
          async () => {
            await refresh();
            return evidence.buyers.filter(
              (b: any) =>
                b.capture_status === "COMPLETED" &&
                b.refund_status === "PENDING",
            ).length;
          },
          { timeout: 30_000 },
        )
        .toBe(4);
      await expect(
        panel.getByRole("heading", { name: "Refund is pending" }),
      ).toBeVisible({ timeout: 10_000 });
      const archive = await request.post("/api/operator" + path + "/archive", {
        data: {},
        headers: {
          "X-Operator-Token": token!,
          "X-Coalition-Request": "1",
          Origin: new URL(stackUrl!).origin,
        },
      });
      expect(archive.status()).toBe(409);
      await operator(request, path + "/fixture-refunds", {});
      await expect
        .poll(async () => (await refresh()).group.status, { timeout: 30_000 })
        .toBe("FAILED");
      await expect(
        panel.getByRole("heading", { name: "Your refund is confirmed." }),
      ).toBeVisible({ timeout: 10_000 });
    } else if (scenario === "partial") {
      expect(captured.every((b: any) => b.refund_status === "COMPLETED")).toBe(
        true,
      );
      expect(
        evidence.buyers.filter((b: any) => b.void_status === "VOIDED").length,
      ).toBe(1);
      await expect(
        panel.getByRole("heading", { name: "Your refund is confirmed." }),
      ).toBeVisible({ timeout: 10_000 });
    } else {
      expect(
        evidence.buyers.filter((b: any) => b.void_status === "VOIDED").length,
      ).toBe(4);
      await expect(
        panel.getByRole("heading", { name: "This group has closed." }),
      ).toBeVisible({ timeout: 10_000 });
    }
    const beforeArchive = evidence.operations.map((op: any) => op.id).sort();
    await operator(request, path + "/archive", {});
    await refresh();
    expect(evidence.operations.map((op: any) => op.id).sort()).toEqual(
      beforeArchive,
    );
  });
}
