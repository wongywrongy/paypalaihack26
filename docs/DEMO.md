# Rally v2 verification and demo

[PLAN.md v2](../PLAN.md) is authoritative: one shopper, three fictional Korean shops, one box from Seoul. Group purchasing and the earlier shopping routes are retired. [Owner actions](ACTIONS.md), [architecture](ARCHITECTURE.md), [API](API.md) and [executed evidence](../EVIDENCE.md) distinguish implementation from genuine provider proof.

## Before submission

The connected product and operations are implemented and locally verified. G1 passed genuine USD/CAD payment capability checks earlier; **G3/G4/G5 remain open** until the hosted model and new UI flow run on the existing Render services with human sandbox approvals. The small Test mode label stays because the scope is PayPal sandbox, not live-money commerce.

## Connected judge journey

1. Complete [private configuration and the reviewed existing-service cutover](ACTIONS.md). Verify both deploys are live, `/api/health` reports `app: rally`, and the same database's additive `rally` schema is present. Keep the production review harness disabled. Confirm legacy receipts/recovery access before retiring the old deployment.
2. Open `/shop` in a fresh browser. Select a destination; browse or ask for a routine. Requests use the configured model, stock and explicit budget validation. A model outage uses code fallback; do not present that as a successful live model decision. For the reproducible golden bag add `mul-gel-cleanser`, `dal-rice-toner`, `dal-snail-essence`, `sae-cica-cream`; enable both saved permissions. The US complete checkout schedule is $118.82.
3. Review the exact items, destination, permissions, complete breakdown and approved maximum. Click the actual PayPal JS SDK v6 button and manually sign in with a **personal sandbox buyer**. Approve this order only. Do not use the receiving business account or automate approval. The server verifies provider ownership, merchant, amount and currency, then authorizes and queues negotiation.
4. Watch `/deal?order=<saved order id>`. Buyer/shop contexts choose real proposals; code checks the complete total, shop authority, shopper permissions and stock. Actual decisions may accept immediately, counter, decline a concession or retain checkout terms. Never force the connected outcome to $106.79. Pause/replay affects presentation only. Refresh restores persisted events.
5. Wait for **confirmed capture** before calling the order paid. The worker uses final capture, at or below the approved maximum. Check the durable capture and independent provider GET, exact currency/amount, signed webhook verification and reconciliation. The unused amount is uncaptured, not a separate void; bank release timing varies. Refresh Paid and Your orders, reset the bag and create another bag; the old receipt must remain.
6. With the corresponding private shop login, view that shop's deal/products and record its fictional handoff. The payment worker submits one genuine USD sandbox payout to its configured business recipient; confirm batch **and item** status. A read-only judge login cannot change policy or hand off parcels, and cannot see another shop's private data.
7. Use the hub login after all shops arrive and all payouts confirm. Record fictional export tracking. The worker invokes the PayPal Agent Toolkit tracking handler through the guarded Orders v2 transport, then confirms the expected tracker with provider GET. PayPal tracking is not evidence of real shipping.
8. Record an import total lower than the quoted duty+tax to test a partial refund; confirm pending versus completed refund separately. A higher import total produces no shopper charge. Do not repeatedly change a saved true-up: it is immutable. Optionally approve scheduled fictional hub steps after this manual lifecycle is proved; details are in ACTIONS.md.
9. Repeat in fresh browser contexts for CAD, GBP, EUR and AUD, verifying the actual human approval and provider amount in each currency. Supply test logins privately in submission notes. Capture screenshots/video of actual outcomes, not fixture totals over a real receipt.

The live model smoke CLI uses the same adapter without moving money:

```bash
PYTHONPATH=backend python scripts/engine.py --env-file /private/rally.env --country US
# Explicit deterministic selector, never live-model evidence:
PYTHONPATH=backend python scripts/engine.py --fixture --country US
# No payments. Hosted calls can incur model cost; cache makes identical reruns repeatable.
PYTHONPATH=backend python scripts/benchmark.py --connected --env-file /private/rally.env --count 500 --output /private/connected-benchmark.json
```

The fixture benchmark in `docs/benchmark.json` deliberately leaves strategy B null. A connected benchmark passes only with real B/D model results, no model failures, code-validated shop authority and zero ceiling violations; code fallback alone is insufficient.

## Cancellation, recovery and deadlines

- Cancel an unapproved checkout: stock releases once and a delayed approval callback cannot authorize it. A completed authorization canceled before capture uses a verified void. Capture already underway blocks ordinary cancellation.
- A failed/interrupted model attempt retains checkout terms with persisted error events. The outcome is recoverable and cannot fabricate acceptance or payment.
- For an ambiguous provider mutation, inspect Hub recovery. Reconcile the **saved operation** first; resume its saved job only after resolving the cause. Never invent a new key to repeat an unknown charge/refund/payout. Missing provider IDs require provider activity review.
- A definitively failed capture voids the remaining hold. An unknown capture does not release stock, ship or blindly capture again.
- Unshipped orders past `ship_by` receive a full remaining refund through the worker; export is blocked. Use an isolated disposable test database to shorten deadlines, never rewrite live consent or timestamps to make a demo pass. Pending refunds remain pending until provider confirmation.
- Original Coalition receipts require the original `coalition_session` cookie. `/api/purchases` remains read-only; hub legacy recovery retains unresolved metadata. New retired checkout requests return 410.

## GD2: recorded review, no money movement

The existing Rootlane link is static-only: [Shop](https://neo.taile1abc7.ts.net:20001/shop?test=recorded) / [recorded Deal](https://neo.taile1abc7.ts.net:20001/deal?test=recorded). It uses the explicit compile-time review harness and recorded reference events; checkout is disabled. Shop pages remain locked unless a scoped API is present. Rootlane does not supply GitHub/Render API access, database access or callback changes.

Normal production URLs use the actual API in every build. `?test=recorded` alone cannot enable recorded receipts in an ordinary production build. To inspect locally, explicitly set `VITE_RALLY_TEST_HARNESS=1 npm run dev --prefix frontend` and use that query parameter. The fixture golden schedules are checkout/final: USD 11882/10679, CAD 16087/14449, GBP 9361/8415, EUR 11105/10030, AUD 17260/15504 minor units. They are complete scenario assumptions, not verified live customs/FX or guaranteed savings.

## G1: three human PayPal approvals


**Current status:** G1 passed at 08:45 UTC on October 23. USD authorization/capture/void/refund, CAD authorization/capture and the corrected $0.50 payout were independently confirmed. The genuine CAD webhook had reached the existing Render receiver. After explicit owner approval, its original bytes and signature headers were replayed through the local Rally ASGI handler and durable worker; PayPal signature verification and capture GET reconciliation both succeeded. The full verifier exited successfully. No financial operation was replayed. This proves payment capability and signed-event recovery; direct delivery to a deployed Rally API and the connected judge journey remain G3 work. [Reuse the existing Render resources](RENDER.md); do not provision another stack.

Keep `DATABASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID` and the separate shop's `PAYPAL_SHOP_EMAIL` private, with `RALLY_MODE=connected`. `start` applies the existing additive migrations in Rally's dedicated schema before reading run data or calling PayPal. It preserves existing purchases and payment operations. Do not point tests at a real purchase database or delete any volumes.

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
5. After the USD refund, run `--run RUN-UUID cad-start --return-url https://YOUR-HOST/paid --cancel-url https://YOUR-HOST/bag`. This can run while a payout configuration issue is being corrected. A human approves **CAD C$2** with a CAD buyer. Run `--run RUN-UUID cad-charge`: authorize C$2 and final-capture **C$1**. Final verification still requires the successful payout.
6. After genuine webhook delivery/reconciliation, run `--run RUN-UUID verify`. It independently reads the provider resources and requires the completed USD lifecycle, successful payout batch/item, signature-verified reconciled webhook and **completed CAD receipt**. Pending CAD does not pass. Record its actual evidence line in EVIDENCE.md only after success.

Append each suffix to:

```bash
PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env
```

On interruption or ambiguity, use `--run RUN-UUID reconcile STEP`, then the original command with its original operation identity. Inspect unknown provider outcomes before retrying; never invent replacement keys. Existing USD runs remain resumable. `verify-usd` reports scoped legacy USD evidence and explicitly does not pass v2 G1.

For an earlier `start` failure caused by missing tables (`UndefinedTable`), use the updated script with `--run` and the original UUID, return URL and cancel URL. It initializes the schema and reuses the original logical operation; an unresolved operation still blocks provider retries until reconciled. A migration error stops before any payment ledger call. Do not drop or recreate an existing schema to repair this failure.

For `SELF_PAY_NOT_ALLOWED`, the configured shop recipient is the sending business account. Set `PAYPAL_SHOP_EMAIL` privately to a different sandbox business account. After the original payout is provider-confirmed failed, `--run RUN-UUID retry-payout` permits one explicit $0.50 recipient correction with a separate stable `payout-correction` operation. It preserves the original denied request and batch. Repeated calls cannot create another correction; pending/unknown outcomes require `reconcile payout-correction`, and a changed recipient after submission is rejected. The final verifier follows the correction and still requires its batch and item to succeed. Later events for the original denied batch cannot overwrite the current payout summary.

The G1 script retains the existing pool/member storage solely as a capability probe; it is not the v2 purchasing engine. A PayPal browser return cannot confirm a payment. Final capture's uncaptured amount is not a separate remainder-void event, and bank hold release timing is not guaranteed.
