# Rally demo gates

Use [PLAN.md](../PLAN.md#codex-prompts) for the current prompts and scope. The retired Coalition demo is not a Rally payment demonstration.

1. **Design / GD:** run the frontend scenario preview. Inspect Invite, Tell, Review, Live, Ask, Done, Receipt and the deal room at 390 px. It uses the committed scenario; it does not authorize a payment. Capture actual Playwright screenshots and fix the Impeccable critique before claiming GD.
2. **Payments / G1:** configure the sandbox merchant ID, separate shop payout email, app credentials and webhook. Run `scripts/paypal_sandbox.py --help` and its explicit lifecycle commands. The human approves each designated order in PayPal; server code confirms the hold, lower final capture, separate void, refund, payout and signature-verified webhook. Record actual IDs and results in EVIDENCE.md. A pending or ambiguous outcome remains unresolved.
3. **Engine / G2:** begins after G1. Implement the CP-SAT/cost engine and pass the golden test and seeded ten-member CLI; the scenario JSON alone does not prove this engine exists.
4. **Wiring / G3:** connect member screens to the API and complete the hosted flow with a real sandbox hold. Later gates add tracking/payout protections, benchmark, judge flow and submission artifacts.

Never delete existing database volumes to prepare a demo. The new application uses its own `rally` schema. Deployment, PayPal configuration or route changes require owner review and approval. Do not replay real mutations to manufacture a success; reconcile unknown outcomes first.

## G1: the two human approvals

Use an execution host that can reach PostgreSQL and PayPal. Keep `DATABASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID` and the separate shop's `PAYPAL_SHOP_EMAIL` in a private environment file, with `RALLY_MODE=connected`. Payouts must be enabled and the sending sandbox business balance funded. The API and worker must be running, with a genuine webhook configured for `/api/paypal/webhook`; the script does not register it or change provider settings.

From the repository root, substitute your private file and the approved HTTPS host:

```bash
PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env start \
  --return-url https://YOUR-HOST/receipt --cancel-url https://YOUR-HOST/review
```

1. Save the printed run UUID. Open the returned sandbox approval URL and approve **$2** using a sandbox personal buyer account.
2. Run `PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env --run RUN-UUID charge`. It authorizes $2, makes a **$1 final capture**, then prints a second $2 approval URL.
3. Approve the second order in the browser. Run the same command prefix with `void-refund` instead of `charge`. It authorizes and voids the second hold, then refunds the first $1 capture.
4. Run the prefix with `payout --carrier SANDBOX --tracking G1-CHECK`. This records **simulated tracking** and sends **$0.50 sandbox money** to the configured shop. This independent capability check uses the prefunded sandbox balance; it does not prove pool settlement economics.
5. Run the prefix with `verify`. It independently reads provider resources and requires a completed refund, successful payout batch **and item**, and a genuine signature-verified, reconciled webhook. Record its actual evidence line in EVIDENCE.md only after success.

A pending or interrupted step needs `reconcile STEP`, then its original command. If reconciliation cannot identify the provider resource, inspect sandbox activity; do not create a replacement key. The unused amount after a final capture is not a separate void transaction, and bank hold release timing is not guaranteed. The current member screens remain labeled previews until M3; a browser return to them does not establish payment success.

Provider references checked October 22, 2026: [authorization timing](https://developer.paypal.com/payment-methods/auth-honor/), [final capture](https://developer.paypal.com/api/payments/v2/authorizations-capture/), [void](https://developer.paypal.com/api/payments/v2/authorizations-void/), [refund](https://developer.paypal.com/api/payments/v2/captures-refund), and [idempotency](https://developer.paypal.com/api/rest/requests/). Documentation checks are not sandbox execution evidence.
