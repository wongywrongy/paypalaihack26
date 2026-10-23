# Rally

**Korean skincare. One box. Your currency.** A shopper builds a bag across three fictional Korean shops. Rally finds the lowest complete checkout cost, obtains the shopper's PayPal approval, then bargains within the shopper's saved choices. Code validates every term; the final capture cannot exceed the approved checkout total.

[Latest plan](PLAN.md) · [Architecture and data model](docs/ARCHITECTURE.md) · [Demo procedure](docs/DEMO.md) · [Owner action list](docs/ACTIONS.md) · [Executed evidence](EVIDENCE.md) · [Screenshots](docs/screenshots/README.md) · [MIT license](LICENSE)

## What works

The implementation follows **PLAN.md v2, October 22**: solo shopping, three Korean shops, 30 products, five destinations (USD/CAD/GBP/EUR/AUD), one Seoul parcel. The old group-order shopping routes are retired. Historical purchases and unresolved payment operations are preserved.

Shop → Ask for a routine → Bag → PayPal approval → live Deal → Paid → Track is connected to one FastAPI application and PostgreSQL. Exact sourcing includes shared shipping and import assumptions. Separate buyer/shop model contexts select bounded proposals; deterministic code controls prices, permissions, stock, consent and settlement. Negotiation events persist immediately and restore through SSE/polling. Separate shop workspaces, an AG Grid products view, hub handoffs, shop payouts, tracking, refunds and safe recovery controls are implemented.

**Verification is deliberately separate from implementation.** Local checks pass: 73 backend contracts against PostgreSQL, 94 desktop/mobile browser cases, production build/render/privacy checks, and USD/CAD browser journeys against the actual API/database with provider/model doubles. Genuine G1 sandbox USD/CAD authorization/capture, void, refund, shop payout and signed-webhook recovery passed earlier. The new shopper journey has **not yet passed with a hosted model and human PayPal approvals on Render**. G3/G4/G5 remain open; this is not yet ready to submit. See [the exact remaining actions](docs/ACTIONS.md).

[Rootlane design review](https://neo.taile1abc7.ts.net:20001/shop?test=recorded) · [Recorded deal](https://neo.taile1abc7.ts.net:20001/deal?test=recorded). This existing static review serves explicitly recorded events, with checkout disabled. It is distinct from the connected application. The existing Render service still runs the older application until the reviewed cutover.

## What is real and what is simulated

- **Real in connected mode:** configured model API calls; individual human PayPal sandbox approval; server-side authorization, final capture, void, refund and USD shop payouts; signature verification, reconciliation and persistent payment status. Sandbox uses test money. Outages retain an honest code fallback or unresolved recovery state.
- **Simulated:** shops, brands, catalog, stock and commercial policies; Seoul hub, shipping and delivery; dated FX, freight and import-cost schedules. These are complete fictional merchant-backed schedules, not live customs/FX or verified tax advice. Rally absorbs overruns within approved terms; overestimates may be refunded. There is no real cosmetics fulfillment.
- **Test-only:** injected provider/model doubles and the explicit `VITE_RALLY_TEST_HARNESS=1` plus `?test=recorded` review journey. Ordinary production builds exclude recorded receipts and private shop fixtures. A browser return, model decision or animation never establishes a payment.

Rally is the sandbox merchant of record, not an escrow or platform wallet. Capture follows the deal immediately, rather than holding ordinary authorizations during overseas delivery. Final partial capture leaves an uncaptured amount; no separate remainder-void event is invented, and bank release timing varies. Shops receive separate USD sandbox payouts after hub handoff. Fulfillment is independent of payment webhooks.

## Run locally

Use an existing PostgreSQL instance and a private environment file based on `.env.example`; never commit credentials. The two requirements files keep the permitted PayPal Agent Toolkit tracking handler without installing extra agent frameworks.

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/pip install --no-deps -r backend/toolkit-requirements.txt
npm ci --prefix frontend
npm run build --prefix frontend
# Load your private environment in each terminal, then:
PYTHONPATH=backend .venv/bin/python -m rally.db
PYTHONPATH=backend .venv/bin/uvicorn rally.api:app --host 127.0.0.1 --port 8000
PYTHONPATH=backend .venv/bin/python -m rally.worker
```

Open `http://localhost:8000/shop`, with `PUBLIC_URL=http://localhost:8000`. The API serves the built frontend. Use a hosted structured-output model for deployment. Named shop recipient emails and strong private workspace passwords are listed in `.env.example`. `RALLY_AUTO_FULFILLMENT=1` optionally schedules fictional hub steps and genuine sandbox payout/tracking jobs; it defaults off. [Demo instructions](docs/DEMO.md) explain both modes.

Migrations are additive in the dedicated `rally` schema and do not rewrite the original `public` data. Owned historical receipts remain accessible through the original cookie and `/api/purchases`; the hub has read-only legacy recovery metadata. No new legacy checkout is allowed. Never delete existing volumes or reuse the historical G1 run to manufacture new evidence.

Use only the [existing paid Render web, worker and database](docs/RENDER.md). No new services or capacity are required. The archived Blueprint is historical, not a provisioning instruction.

## Verification and benchmark

```bash
# RALLY_TEST_DATABASE_URL must point to an explicitly disposable test database.
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:render --prefix frontend
npm run test:browser --prefix frontend
PYTHONPATH=backend .venv/bin/python scripts/engine.py --fixture --country US
PYTHONPATH=backend .venv/bin/python scripts/benchmark.py --fixture --count 500 --output docs/benchmark.json
```

Published [fixture benchmark](docs/benchmark.json), seed **20261023**: 500 generated bags, 497 supported and three excluded; **zero charges above the hold, zero shops below authority**, and full term trading below checkout in 440 cases. Mean per-case reduction was 562 basis points. These are deterministic synthetic results, not measured customer savings or live-model evidence. Strategy B (two-model price haggling) was not run and is `null`; A is exact list-price sourcing, C removes shopper permissions, D enables them. The connected B/D benchmark is still required. It caches validated synthetic responses by prompt hash and performs no payment operations.

The five golden schedules are checkout/final: USD 11882/10679, CAD 16087/14449, GBP 9361/8415, EUR 11105/10030, AUD 17260/15504 minor units. The $2 mask reduces the US complete total by $1.07 through shared-shipping effects. Actual model decisions can differ or retain checkout terms; no universal saving is promised.

[Third-party notices](THIRD_PARTY_NOTICES.md) retain dependency attribution. Sandbox buyer logins must be supplied privately in the submission testing notes, never committed here.
