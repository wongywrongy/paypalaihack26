# Executed verification — 2026-10-06

The repository already contained the Commonplace React storefront, a PayPal REST adapter, explicit PostgreSQL transitions/jobs, original product assets and tests. Those were reused. Connections now use SQLAlchemy and migrations use Alembic. New coordination, evidence and assistant behavior is described in [README.md](README.md).

## Local results

| Check | Actual result |
|---|---|
| Python invariant and PostgreSQL integration suite | 37 passed; isolated disposable schemas, including migrations and seed |
| TypeScript and Vite production build | Passed |
| Python lint (`E4,E7,E9,F,I`, excluding import-order accommodation `E402`) | Passed |
| Mocked buyer browser tests | 2 passed: desktop and mobile |
| PostgreSQL/API/worker browser success, partial-capture and pending-refund scenarios | 6 passed: desktop and mobile; final receipt polling fix included |
| Separate real 90-second group deadline browser scenarios | 2 passed: desktop and mobile; provider actions were fixtures |
| Responsive screenshot confirmation | Desktop product page, mobile sheet and protected merchant page inspected; no horizontal overflow |
| Docker image build with Node 22 / Python 3.12 | Passed after repairing inherited malformed optional-package lockfile entries |
| Built-container migration/seed/API smoke check | Passed against the disposable schema; seed remains exactly three products |
| Existing private Tailscale deployment | API and worker rebuilt and started; non-destructive migrations applied; health and matching frontend bundle verified through the existing port 8766 route |

The first full browser run found that a completed receipt polled too slowly to display subsequent sandbox-demo refund cleanup. The open sheet now keeps two-second polling. The success checks passed after that fix. The tests also exposed and cover merchant cleanup racing with frozen settlement: cleanup now returns 409 during SETTLING. A provider-confirmed void/expiry releases an OPEN slot without changing frozen membership.

The payment tests use deterministic provider doubles. They cover lost capture responses and process restart after remote success, duplicate capture prevention, pending capture reconciliation, partial captures followed by refunds/voids, late captures during unwinding, refund failure and separate needs_attention, duplicate payer/commands/events, wrong ownership/order/amount/currency/merchant, simultaneous capacity/deadline/withdrawal races, immutable terms/inventory, reclaimable worker leases, verified-versus-rejected webhook processing and source attribution. Mocked model acceptance cannot bypass explicit budget/delivery constraints or unknown required course compatibility. Missing assistant configuration does not block ordinary checkout.

The full-stack browser checks run the actual FastAPI server and persistent worker against PostgreSQL. Only payment/model behavior is explicitly simulated. Deadline tests wait for the actual group clock; they do not simulate PayPal authorization expiry. Disposable test schemas are separate from existing demo/payment history.

Commands used:

```bash
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:browser --prefix frontend -- --grep 'buyer' --workers=1
# Fixture API/worker used port 8012 and a disposable database schema.
# Set COALITION_OPERATOR_TOKEN to that verification server's private token.
COALITION_E2E_URL=http://localhost:8012 npm run test:browser --prefix frontend \
  -- --grep 'real stack' --workers=1
# After fixing open-receipt polling, reran both layouts for these scenarios:
COALITION_E2E_URL=http://localhost:8012 npm run test:browser --prefix frontend \
  -- --grep 'real stack: (success|partial|refund_pending)' --workers=1
docker compose build api
```

## External results and remaining gates

**No genuine PayPal sandbox call, PayPal webhook receipt, live model recommendation or Render deployment has been verified in this environment.** No successful external result has been fabricated. Current missing variables are exactly:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MERCHANT_ID`
- `PAYPAL_WEBHOOK_ID`
- `LLM_API_KEY`

Also required: five distinct sandbox buyer accounts with human approvals, a public HTTPS API webhook endpoint registered on the same sandbox REST app, and a Render account/configured paid services if deploying there.

The adapter uses PayPal sandbox Orders v2 AUTHORIZE, Payments v2 capture/void/refund/status and PayPal's webhook-signature verification endpoint. SDK buttons obtain buyer approval; the backend verifies provider resources. Official endpoint and idempotency references are linked in [README.md](README.md). Payments v2 schema does not supply a blanket replay retention guarantee; the default forbids blind replay of an unknown capture/refund POST and requires reconciliation or merchant review. The assistant uses Anthropic Messages structured outputs, with local validation. Configuration alone is not proof of a successful call.

Complete [docs/DEMO.md](docs/DEMO.md), then run `scripts/check_connected.py` against the genuine success/refund and deadline/void run IDs. This read-only gate requires current provider lifecycle resources, five distinct payer captures and full cleanup refunds, a separate void, processed verified payment webhook receipts, and live recommendation acceptance/rejection. A judge must observe a genuine webhook-driven UI receipt/state update; local doubles cannot satisfy that acceptance gate.

Render configuration, a Postman collection, OpenAPI export, migrations, environment example, seed command and local setup are supplied. Production gaps remain documented in the README. Existing unresolved financial records must be retained; archive is permitted only after confirmed resolution.

On the user's follow-up, the existing Tailscale proxy was present but its port-8000 API was down. Ran `docker compose up --build --detach --wait --wait-timeout 180`, preserved the database volume and prior runs, and verified both container payment modules match the workspace. The private preview uses the existing tailnet host on port 8766. Published a fresh normal 24-hour fixture offer because the prior default run was legacy. This is a simulated preview, not PayPal/model proof or a public webhook endpoint.
