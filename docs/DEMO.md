# Rally v2 verification and demo

[PLAN.md](../PLAN.md) version 2 is authoritative: one shopper, three fictional Korean shops, one box from Seoul. Group buying and the earlier group-order screens are retired. [EVIDENCE.md](../EVIDENCE.md) records actual execution; [ARCHITECTURE.md](ARCHITECTURE.md) distinguishes current code from later milestones.

## Before submission

The current hosted review is not submission-ready. The small **Test mode** label remains in the finished judge app because the agreed scope uses PayPal sandbox accounts and test money. Completing the product means proving genuine sandbox API operations and connecting the live engine, not removing that label.

The design journey is implemented. G1 still needs real USD/CAD holds and captures, void, refund, payout and a verified webhook. M2 must implement the sourcing and negotiation engine; M3 must connect it and PayPal checkout to these screens. The plan gates that main implementation on G1. M4/M5 operations and fresh-browser judge checks follow. There is no verified completion date for these unfinished gates.

First run this from the repository on a host terminal with PostgreSQL and PayPal access:

```bash
PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env preflight
```

This checks required settings, a read-only PostgreSQL connection and sandbox OAuth with five-second network timeouts. It prints configuration names and exception types, never values, tokens or raw errors. It creates no purchase or payment operation, changes no schema and does not prove G1. A blocked check exits with status 1; a successful check exits with status 0. Continue with the three-approval procedure below only after access is working. This session cannot grant itself host network access; the existing Rootlane service serves static frontend files only.

## GD2: design journey, no money movement

Use Node and the existing installed frontend dependencies:

```bash
npm ci --prefix frontend
npm run build --prefix frontend
npm run test:render --prefix frontend
npm run test:browser --prefix frontend
```

The browser suite supplies an explicit compile-time test harness to its development server and injects the authenticated shop response. CI also runs the actual Playwright CLI and pinned Taste inspector. Contract tests are not evidence of real agents, a human PayPal approval or a captured payment.

For manual design inspection, start a separate test server:

```bash
VITE_RALLY_TEST_HARNESS=1 npm run dev --prefix frontend
```

1. Open `/shop?test=recorded`. Filter categories, add/remove products and open Ship to. Change to Canada and inspect CAD amounts. US sunscreen and all air-shipping aerosol restrictions remain enforced.
2. Open Ask, review the saved routine and add it to the bag. The ordinary assistant is a local catalog routine, not a hosted model call.
3. On Bag, inspect the grouped shops, switches and all-in breakdown. Switches grant permission; they do not reduce the checkout hold before a shop agrees. Refresh to verify bag/country/rules persist. Checkout remains unavailable until M3; there is no look-alike PayPal button.
4. Open `/deal?test=recorded` directly for the recorded US order. It is isolated from edits to the current bag. Watch the two shops' item tracks, older packaging, the added mask, free Korea shipping, price-held items and totals **$118.82 → $117.75 → $106.79**. Pause/resume and replay. The events come from `hero.events`, not live agents.
5. After playback, See your order opens Paid and Track. Their fixed receipt and fulfillment data are test contracts. Refreshing the recorded Deal restarts playback; durable live stream recovery belongs to M3.
6. The Playwright shop tests inject the shop-scoped contract for `/shops/orders`, `/shops/products` and `/shops/settings`. Inspect both desktop and phone screenshots. Without that authenticated response, ordinary shop routes stay locked; private prices never enter the public bundle.

The ordinary production build has no test harness. A query parameter alone cannot enable recorded payments. `/deal`, `/paid` and `/track` require an order; no receipt is created by an animation, browser return or local bag edit. Keep the harness out of Render and ordinary production builds. The explicitly enabled Rootlane design-review build is an exception for this recorded journey; its checkout remains disabled.

Saved quote totals at checkout / after the recorded terms:

| Destination | Checkout | Recorded final |
| --- | --- | --- |
| United States | $118.82 | $106.79 |
| Canada | C$160.87 | C$144.49 |
| United Kingdom | £93.61 | £84.15 |
| Germany | €111.05 | €100.30 |
| Australia | A$172.60 | A$155.04 |

The calculator matches the reference scenario. These are not verified customs rates, live FX, actual savings or engine benchmark results. The recorded order uses the US schedule; other country golden checks run independently.

## Existing Rootlane environment

Rootlane manages the approved static frontend preview. It does not supply PayPal/Render API access, remote command execution, PostgreSQL access or payment callback configuration. Reuse the existing observed environment and its HTTPS link; do not create replacement services or routes.

A normal frontend build can expose browsing and the bag. A static preview cannot run the G1 lifecycle or the connected M3 flow. The [existing link](https://neo.taile1abc7.ts.net:20001/shop?test=recorded) serves the v2 design-review build; use `/shop?test=recorded` for browsing and `/deal?test=recorded` for recorded negotiation. This explicit review build enables the harness, while ordinary production builds exclude it. Private shop contracts are supplied only in CI, so shop pages remain locked on the static preview. Any new build publication must preserve the existing index/assets for rollback and verify readiness; a reserved link alone is not a running app.

## G1: three human PayPal approvals

**Current blocker:** this coding runtime cannot connect to PostgreSQL or PayPal. Credentials are configured privately; no real mutation or provider ID has been produced. Run `preflight` above and this procedure on an approved host that reaches both services and receives genuine webhooks.

Keep `DATABASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID` and the separate shop's `PAYPAL_SHOP_EMAIL` private, with `RALLY_MODE=connected`. Apply the additive Rally schema migrations with `PYTHONPATH=backend python -m rally.db` after loading that environment. Do not point tests at a real purchase database or delete any volumes.

Before execution, the owner must review the Rally sandbox account's Payment Receiving Preferences for CAD, enabled Payouts capability/funded balance, and the app's webhook destination/event subscriptions. This implementation did not change those settings. Run the API and worker on the approved host, with the configured webhook reaching `/api/paypal/webhook`.

Use the same command prefix each time; substitute the private file, approved HTTPS URLs and saved run UUID:

```bash
PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env start \
  --return-url https://YOUR-HOST/paid --cancel-url https://YOUR-HOST/bag
```

1. Save the printed run UUID. In the returned sandbox URL, a human approves **USD $2** using a personal sandbox buyer.
2. Run `--run RUN-UUID charge`. Server code authorizes USD $2, final-captures **USD $1** and prints a second USD $2 approval URL.
3. A human approves that second order. Run `--run RUN-UUID void-refund`: authorize/void the second hold, refund the first USD $1 capture.
4. Run `--run RUN-UUID payout --carrier SANDBOX --tracking G1-CHECK`. The recorded shipment is simulated; the **USD $0.50 payout** is a genuine sandbox capability probe using the prefunded balance. Wait for successful batch and item, reconciling pending results.
5. Run `--run RUN-UUID cad-start --return-url https://YOUR-HOST/paid --cancel-url https://YOUR-HOST/bag`. A human approves **CAD C$2** with a CAD buyer. Run `--run RUN-UUID cad-charge`: authorize C$2 and final-capture **C$1**.
6. After genuine webhook delivery/reconciliation, run `--run RUN-UUID verify`. It independently reads the provider resources and requires the completed USD lifecycle, successful payout batch/item, signature-verified reconciled webhook and **completed CAD receipt**. Pending CAD does not pass. Record its actual evidence line in EVIDENCE.md only after success.

Append each suffix to:

```bash
PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env
```

On interruption or ambiguity, use `--run RUN-UUID reconcile STEP`, then the original command with its original operation identity. Inspect unknown provider outcomes before retrying; never invent replacement keys. Existing USD runs remain resumable. `verify-usd` reports scoped legacy USD evidence and explicitly does not pass v2 G1.

The G1 script retains the existing pool/member storage solely as a capability probe; it is not the v2 purchasing engine. A PayPal browser return cannot confirm a payment. Final capture's uncaptured amount is not a separate remainder-void event, and bank hold release timing is not guaranteed.

## After G1

M2 replaces the retired domain with catalog, landed-cost and exact sourcing/negotiation modules. G2 must reconcile the reference scenario's cheapest-unit selection with lowest-all-in sourcing before claiming an optimal result. M3 then wires genuine checkout, the hosted model and the persistent SSE deal stream. M4 adds hub payouts, tracking, refund deadlines and the benchmark. None is established by GD2 playback.

Official provider references: [supported currencies and pending foreign-currency payments](https://developer.paypal.com/api/codes/currency), [authorization timing](https://developer.paypal.com/payment-methods/auth-honor/), [final capture](https://developer.paypal.com/api/payments/v2/authorizations-capture/), [void](https://developer.paypal.com/api/payments/v2/authorizations-void/), [refund](https://developer.paypal.com/api/payments/v2/captures-refund) and [idempotency](https://developer.paypal.com/api/rest/requests/). Documentation checks are not sandbox execution.
