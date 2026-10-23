# Rally

**Korean skincare from Korean shops, shipped to you as one box.** Rally lets shoppers outside Korea buy from several Korean shops, including shops that only ship inside Korea, with one all-in price in their own currency, duty and tax prepaid, paid with PayPal. An agent builds the routine, picks the cheapest shop for each item and bargains with each shop's agent after checkout. PayPal holds the checkout price; the shopper is charged that or less.

[PLAN.md](PLAN.md) is the source of truth (version 2, October 22, 2026). It replaces the group-order version, which replaced Coalition. [AGENTS.md](AGENTS.md) defines track ownership and payment boundaries. [Design references](design/mockup/README.md) and the [scenario](design/scenario/seoul.py) describe three fictional shops (Haneul Beauty, Bada Market, Dalbit Official), about 30 products and five destinations.

## Current state

The v2 frontend replaces the group-order routes with Shop, Ship to, Ask, Bag, Deal, Paid, Track and Rally for shops. It includes the 30-product catalog, five destination currencies, category filters, persistent bag/rules, exact saved-scenario cost breakdowns and an event-driven Deal player. Generated catalog photographs use fictional labels. [Architecture and data boundaries](docs/ARCHITECTURE.md) distinguish implemented modules from later milestones.

**This is the design track, not the connected judge flow.** Ordinary builds cannot manufacture an approved hold or a paid order: checkout is unavailable until M3 integration, order screens require order data and shop screens require a scoped API response. CI explicitly enables a compile-time harness for recorded deal/receipt/tracking events and authenticated shop contract responses. No live model negotiates in that harness. The local quote display follows the reference scenario's cheapest-listed-item selection; it is not the M2 lowest-all-in sourcing engine.

[Open the Rootlane design review](https://neo.taile1abc7.ts.net:20001/shop?test=recorded) · [Watch the recorded deal](https://neo.taile1abc7.ts.net:20001/deal?test=recorded). [GD2 screenshots and independent critique](frontend/design/GD2.md) show the actual rendered views and verification limits.

**G1 passed on October 23:** real sandbox USD authorization, lower final capture, void, completed refund, successful shop payout and CAD authorization/final capture were independently verified. With the owner's approval, an original signed CAD webhook delivered to the existing Render receiver was replayed through Rally's local ASGI handler and durable worker; PayPal verified its signature and Rally reconciled the actual capture. This is genuine signed-delivery recovery, not a simulator event or proof of a deployed Rally checkout. [EVIDENCE.md](EVIDENCE.md) records provider IDs and provenance. The public service still runs Coalition, and the G1 ledger remains local. [Existing Render resources and cutover gates](docs/RENDER.md).

**Not ready for submission:** the live sourcing/negotiation engine and checkout integration are unfinished M2/M3 work; G1 now permits the engine work to begin. The finished sandbox judge app will retain its small Test mode label. On a host with database/provider access, start with `PYTHONPATH=backend python scripts/paypal_sandbox.py --env-file /private/rally.env preflight`; it checks connectivity without creating purchases or moving money. [Submission gates and first steps](docs/DEMO.md#before-submission).

## Real and simulated

- **Real when verified:** buyer-approved PayPal sandbox orders, holds, lower final captures, voids, refunds and payouts to shop sandbox accounts; signed webhooks and reconciliation; hosted model calls during each deal. Sandbox uses test money.
- **Simulated:** the three shops, six brands and their products, stock, prices and lowest prices; the Seoul hub, parcels and delivery; FX rates and shipping rate cards. Duty and import tax come from a dated rate table with sources; rows not yet verified are labeled estimates.
- **Test-only:** recorded deal/receipt/tracking events and private shop contract responses in the explicitly enabled GD2 harness, and provider doubles in unit/CI tests. They never establish payment success. An ordinary production build excludes that harness and all private shop fixture data.

Rally is the sandbox merchant of record. Money movement belongs to deterministic code and the payment ledger. The LLM never accepts a deal, never sees a shop's lowest prices or costs, and never moves money. The product UI reads as a real shop; the only sandbox marker is a "Test mode" pill, and this section is where simulation is disclosed.

## Development

Use the existing React/TypeScript, FastAPI, worker and PostgreSQL stack. Copy `.env.example` into a private local `.env` and fill server-side credentials without committing them. Configure a hosted model for deployment. Payouts require a separate shop sandbox account and enabled app capability.

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci --prefix frontend
npm run dev --prefix frontend
```

The frontend reads a generated public scenario through one typed module until M3 wires the real API. `frontend/scripts/project-scenario.mjs` allow-lists public fields; Vite rejects raw private scenario/test-fixture imports into the browser graph. Check projection freshness with `npm run test:render --prefix frontend` after changing the reference scenario.

For the recorded GD2 journey only, the explicitly enabled Rootlane design-review build supports `/shop?test=recorded` and `/deal?test=recorded`. It serves recorded events, not a connected payment or model session. For local inspection, start a separate test server with `VITE_RALLY_TEST_HARNESS=1 npm run dev --prefix frontend` and open `/deal?test=recorded`. That flag is deliberately absent from Render and the normal build. The documented CI path injects shop responses; it is not production authentication. Backend modules:

```bash
PYTHONPATH=backend .venv/bin/python -m rally.db
PYTHONPATH=backend .venv/bin/uvicorn rally.api:app --host 127.0.0.1 --port 8000
PYTHONPATH=backend .venv/bin/python -m rally.worker
```

Run processes in separate terminals after loading the private environment. PostgreSQL uses the dedicated `rally` schema. Existing public tables are preserved; no historical purchase data is migrated or deleted automatically. Do not remove existing volumes. Database initialization and test schemas must use the intended database; tests require an explicitly disposable test target.

Use the three existing paid Render resources listed in [docs/RENDER.md](docs/RENDER.md). The mismatched provisioning template is archived under `docs/archive/`; do not create a new Blueprint from it. The Docker image serves both frontend and API, so no extra storefront service is needed. Existing resource IDs, plans, storage and Compose volumes remain unchanged. External configuration or deployment changes require owner review.

## Verification

```bash
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:render --prefix frontend
npm run test:browser --prefix frontend
```

Unit/contract tests inject provider doubles; they need no payment credentials. PostgreSQL integration requires `RALLY_TEST_DATABASE_URL` pointing to an explicitly disposable database.

See the real-sandbox script in `scripts/` for its explicit human approval checkpoints. `verify` now requires the USD lifecycle, payout, genuine verified webhook and a received CAD payment; `verify-usd` reports only legacy USD evidence. Never claim G1 until provider-confirmed IDs and a verified webhook are recorded. The connected engine, live model stream, final Devpost submission, judge flow and benchmark are later milestones, not present capabilities. Earlier `frontend/design/*.md` records describe the retired group-order screens unless explicitly marked v2.

MIT licensed; [third-party notices](THIRD_PARTY_NOTICES.md) retain dependency attribution.
