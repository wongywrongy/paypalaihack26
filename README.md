# Rally

**Korean skincare. One box. Your currency.** A shopper builds a bag across three fictional Korean shops. Rally finds the lowest complete checkout cost, obtains the shopper's PayPal approval, then runs three open bidding rounds across every shop that stocks each item. Code validates every term; the final capture cannot exceed the approved checkout total.

[Shop bidding plan](docs/plan/BIDDING.md) · [Build plan](PLAN.md) · [Architecture and data model](docs/ARCHITECTURE.md) · [Demo procedure](docs/DEMO.md) · [Owner action list](docs/ACTIONS.md) · [Executed evidence](EVIDENCE.md) · [Screenshots](docs/screenshots/README.md) · [MIT license](LICENSE)

## What works

New orders follow **[BIDDING.md v3, October 29](docs/plan/BIDDING.md)**: solo shopping, three Korean shops, 30 products, five destinations (USD/CAD/GBP/EUR/AUD), one Seoul parcel. The old group-order shopping routes are retired. Historical purchases and unresolved payment operations are preserved.

Shop → Ask for a routine → Bag → PayPal approval → live Deal → Paid → Track is connected to one FastAPI application and PostgreSQL. Exact sourcing includes shared shipping and import assumptions. Separate buyer/shop Bitdeer-compatible model contexts select candidate indexes and write public notes; deterministic code controls prices, permissions, stock, consent and settlement. Negotiation events persist immediately and restore through SSE/polling. Separate shop workspaces, an AG Grid products view, hub handoffs, shop payouts, tracking, refunds and safe recovery controls are implemented.

**Verification is separate from implementation.** The v3 local gate passes 102 Python contracts against disposable PostgreSQL, 100 desktop/mobile browser tests, Ruff, build and render checks. The no-payment 500-case fixture benchmark is committed. Bitdeer structured output and the connected benchmark remain unverified because credentials/model ids were not supplied. The optional Channel3 importer is implemented; its committed snapshot is empty pending a key and a real import. Genuine G1 sandbox USD/CAD payment evidence is historical and does not establish a hosted v3 run. Human PayPal sandbox approvals on Render remain required; see [executed evidence](EVIDENCE.md).

[Rootlane design review](https://neo.taile1abc7.ts.net:20001/shop?test=recorded) · [Recorded deal](https://neo.taile1abc7.ts.net:20001/deal?test=recorded). These links are the previously approved v2 static review, not hosted v3 verification. Recorded checkout is disabled. It is distinct from the connected application. The existing Render service still runs the older application until the reviewed cutover.

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
PYTHONPATH=backend .venv/bin/python scripts/benchmark.py --fixture --count 500 --output docs/benchmark-auction.json
```

Published [auction fixture benchmark](docs/benchmark-auction.json), seed **20261023**: 500 generated bags, 497 supported and 3 excluded. Strategy E finishes below checkout in 497 cases. **Zero charges above hold, zero awarded units below shop authority, zero split bundles.** Totals below are aggregate local-currency minor units over the same bags:

| Currency | A: listed exact sourcing | D: exchange | E: bidding |
| --- | ---: | ---: | ---: |
| AUD | 2094138 | 1969852 | 1886227 |
| CAD | 2048482 | 1932390 | 1845747 |
| EUR | 1368774 | 1300253 | 1246152 |
| GBP | 1083665 | 1023761 | 979008 |
| USD | 1529002 | 1430461 | 1367476 |

These are synthetic fixture results, not customer savings or live-model evidence. B is not executed in fixture mode. The [v2 fixture report](docs/benchmark.json) and exchange tests remain available; use `RALLY_DEAL_MODE=exchange` for new exchange quotes. Quote modes and historical orders are preserved. The connected B/D/E benchmark caches validated public prompts by model role, model id and response format; it performs no payments.

Auction checkout/final goldens are USD **11882/10192**, CAD **16087/13825**, GBP **9361/8055**, EUR **11105/9621**, AUD **17260/14835**. The reference's round-2 Bada toner is $20 (owner-approved correction); $19 would clear its shipping threshold and change that round's exact optimum. Actual model choices can differ or retain checkout terms.

## Private model and market setup

Fill the ignored local `.env` from `.env.example`. For the existing Render web/worker, the owner sets `LLM_BASE_URL=https://api-inference.bitdeer.ai`, `LLM_PROTOCOL=openai`, `LLM_API_KEY`, and `LLM_MODEL_SHOP` / `LLM_MODEL_BUYER` (or their `LLM_MODEL` fallback). Obtain exact model ids with authenticated `GET /v1/models`. Start with `LLM_RESPONSE_FORMAT=json_schema`; run the connected engine and verify actual LLM events before treating it as proof. If the provider rejects structured schema output, use `json_object` and rerun; Pydantic still validates. No provider format has been verified in this change.

```bash
PYTHONPATH=backend python scripts/engine.py --env-file .env
PYTHONPATH=backend python scripts/benchmark.py --connected --env-file .env --count 500 --output docs/benchmark-bitdeer.json
# CHANNEL3_API_KEY is dev-only, read solely from this private file:
PYTHONPATH=backend python scripts/market_snapshot.py --env-file .env
npm run scenario:project --prefix frontend
```

The importer uses the current [Channel3 search contract](https://channel3.ai/docs/api-reference/v1/search), filters comparable category/size and in-stock USD offers, and requires at least three distinct comparable products. Only price aggregates, count, date and the generic query are committed. No retailer names, listing titles, images or URLs are stored. Missing/poor results hide the US market range. Runtime reads the committed snapshot and never calls Channel3. After a real import, commit the snapshot/projection and restart the application to load it. The owner still needs the connected model/benchmark checks and a hosted USD then CAD run with human PayPal sandbox approval.


[Third-party notices](THIRD_PARTY_NOTICES.md) retain dependency attribution. Sandbox buyer logins must be supplied privately in the submission testing notes, never committed here.
