# Rally

**Korean skincare. One box. Your currency.** A shopper builds a bag across three fictional Korean shops. Rally finds the lowest complete checkout cost, obtains the shopper's PayPal approval, then runs three open bidding rounds across every shop that stocks each item. Code validates every term; the final capture cannot exceed the approved checkout total.

[Live marketplace plan](docs/plan/LIVE.md) · [Shop bidding plan](docs/plan/BIDDING.md) · [Build plan](PLAN.md) · [Architecture and data model](docs/ARCHITECTURE.md) · [Demo procedure](docs/DEMO.md) · [Owner action list](docs/ACTIONS.md) · [Executed evidence](EVIDENCE.md) · [Screenshots](docs/screenshots/README.md) · [MIT license](LICENSE)

## Judges: one window, five steps

Rally is a two-sided marketplace for fictional Korean skincare shops. Shoppers authorize a maximum through PayPal sandbox; live Bitdeer shop agents compete over three open rounds. Code awards the lowest complete delivered total, including bundles and shipping, and captures at or below that maximum. Merchants set prices and goals in Rally for shops and get paid by PayPal payouts.

Use one browser window. Rally for shops opens on **Home**, whose setup guide walks the whole loop and ticks each step off from saved data:

1. Open [Rally for shops](https://paypalaihack26.onrender.com/shops) and sign in to **Haneul Beauty** with the writer password from the private testing notes.
2. **Set your prices.** Open products and change Cica Barrier Cream's lowest price (Enter to save). Edits are bounded, versioned and audited.
3. **Give your agent a goal.** Pick a suggestion or write your own, press **Review rules**, see which rules your words changed, then **Apply**.
4. **Win a Rally order.** Press **Open your storefront**, put cleanser and cream in a bag with bundles allowed, and approve the PayPal hold with the private **Personal sandbox buyer**. Watch the shops bid. Your receipt shows **Your shop bid on this order**; Haneul can still lose, because the lowest complete total wins.
5. **Hand off and get paid.** Press **Hand off in Rally for shops**, keep **Rally pickup** and press **Record hand-off**. That queues Haneul's USD sandbox payout; Home shows it as paid when PayPal confirms.

The **Selling** chip in the shopper header switches back to Rally for shops at any point. **Reset to launch settings** (the ⋯ menu on Home, Products or Agent) restores Haneul's listings and rules, and restarts the setup guide; orders and payouts are kept. Hub actions, other shops and payment recovery stay owner-only.

## What works

Editable AG Grid listings have field validation, optimistic versions, audit history and per-shop reset. A Haneul-only judge writer can edit listings/goals and record its own parcel handoff, with a 30-write/10-minute session limit. It cannot change another shop, the hub, payments or recovery. Goals compile through the shop model to bounded rules and require explicit Apply. Floors and payment authority remain code-owned.

Shop agents receive public summaries of their last 20 auctions. Activity displays saved bids, awards, deciding complete totals and payout status. Reservations deplete current and older-packaging stock. Bag lines show a best listed price and bidder count rather than assigning a shop before bidding. Marketplace savings facts appear only after ten completed bidding orders and use median percentage savings so currencies are not mixed.

Channel3 refreshes comparable US prices daily on the existing maintenance lane when its key is set. Auctions use PostgreSQL references with snapshot fallback, never network searches. Only a median with at least five comparables and high ≤ 2.5 × low is displayed or sent to agents. The October 30 connected refresh returned 13 aggregates from 30 searches, but none qualified for display; no price was invented to fill the cards.

Executed checks and provider limitations are recorded in [EVIDENCE.md](EVIDENCE.md). The historical [connected auction benchmark](docs/benchmark-auction-connected.json) and fixture benchmark remain separate evidence; neither establishes a hosted v4 end-to-end run.

## What is real and what is simulated

- **Real integrations:** human-approved PayPal sandbox authorization, capture, refunds and shop payouts; live Bitdeer model calls; live Channel3 searches and eligible price references; PostgreSQL listing/goal edits, stock reservations, audit, events and payment reconciliation. Sandbox money is test money. Code fallback handles model failures; uncertain payment outcomes require recovery.
- **Fictional:** shops, brands and products, the starting inventory and commercial schedules, parcels, Seoul hub and logistics. FX, freight and duty schedules are dated assumptions, not live customs quotes. There is no physical cosmetics fulfillment.
- **Test-only:** injected provider/model doubles and the explicit recorded-review build. Ordinary production bundles contain no authored auction/exchange events. A browser return, animation or model note never establishes payment.

Rally is the sandbox merchant of record, not an escrow or wallet. Capture follows bidding. The uncaptured remainder of the hold is released according to the bank’s timing. Real sandbox payouts follow each winning shop’s explicit handoff; optional automatic logistics advance **hub steps only after every winning shop has handed off**. No existing order or payment record is rewritten.

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
npm run test:browser --prefix frontend -- --workers=2
PYTHONPATH=backend .venv/bin/python scripts/engine.py --fixture --country US
PYTHONPATH=backend .venv/bin/python scripts/benchmark.py --fixture --count 500 --output docs/benchmark-auction.json
```

Published [auction fixture benchmark](docs/benchmark-auction.json), seed **20261023**: 500 generated bags, 497 supported and 3 excluded. Strategy E finishes below checkout in 497 cases. **Zero charges above hold, zero awarded units below shop authority, zero split bundles.** Totals below are aggregate local-currency minor units over the same bags:

| Currency | A: listed exact sourcing | D: exchange | E: bidding |
| --- | ---: | ---: | ---: |
| AUD | 2094138 | 1969852 | 1824828 |
| CAD | 2048482 | 1932390 | 1779554 |
| EUR | 1368774 | 1300253 | 1203972 |
| GBP | 1083665 | 1023761 | 946554 |
| USD | 1529002 | 1430461 | 1318212 |

The separate connected E sample requests 25 generated bags (24 supported, one excluded). Only E uses hosted models; C/D remain deterministic comparisons and B is not executed. The paced, cached verification made 98 HTTP requests: 97 validated and one timed out; two additional attempts hit the prompt-token budget before HTTP. Four auction selections fell back to CODE (including one response that validated after the auction's call deadline). The report preserves the initial unpaced run's 88 failures and keeps `hosted_benchmark_verified=false`. Financial invariants were zero in both runs. This sample is not a 500-case connected benchmark.

These are synthetic fixture results, not customer savings or live-model evidence. B is not executed in fixture mode. The [v2 fixture report](docs/benchmark.json) and exchange tests remain available; use `RALLY_DEAL_MODE=exchange` for new exchange quotes. Quote modes and historical orders are preserved. The connected B/D/E benchmark caches validated public prompts by model role, model id and response format; it performs no payments.

Auction checkout/final goldens are USD **11882/10192**, CAD **16087/13825**, GBP **9361/8055**, EUR **11105/9621**, AUD **17260/14835**. The reference's round-2 Bada toner is $20 (owner-approved correction); $19 would clear its shipping threshold and change that round's exact optimum. These exact goldens belong to the recorded-review fixture only. Normal index-0 bidding is generative and currently reaches **USD $95.35**, with Haneul’s bundle/free shipping and Dalbit’s kit; it never reads the recording. Actual model selections can differ. Failed, timed-out or invalid selections use code’s best-ranked valid candidate, marked CODE, with server-side failure counts.

## Private model and market setup

Fill the ignored local `.env` from `.env.example`. For the existing Render web/worker, the owner sets `LLM_BASE_URL=https://api-inference.bitdeer.ai`, `LLM_PROTOCOL=openai`, `LLM_API_KEY`, and `LLM_MODEL_SHOP` / `LLM_MODEL_BUYER` (or their `LLM_MODEL` fallback). Obtain exact model ids with authenticated `GET /v1/models`. Start with `LLM_RESPONSE_FORMAT=json_schema`; run the connected engine and verify actual LLM events before treating it as proof. If the provider rejects structured schema output, use `json_object` and rerun; Pydantic still validates. On October 30, 2026, DeepSeek V4.1 Flash validated the complete auction with json_schema; a small json_object probe also passed. Bitdeer DeepSeek requests explicitly disable reasoning. Both tested roles use deepseek-ai/DeepSeek-V4.1-Flash; the GLM non-reasoning configuration was rejected, so it was not selected.

```bash
PYTHONPATH=backend python scripts/engine.py --env-file .env
PYTHONPATH=backend python scripts/benchmark.py --connected --auction-only --env-file .env --count 25 --output docs/benchmark-auction-connected.json
# CHANNEL3_API_KEY is dev-only, read solely from this private file:
PYTHONPATH=backend python scripts/market_snapshot.py --env-file .env
npm run scenario:project --prefix frontend
```

The importer uses the current [Channel3 search contract](https://channel3.ai/docs/api-reference/v1/search), filters comparable category/size and in-stock USD offers, and requires at least three distinct comparable products. Only price aggregates, count, date and the generic query are committed. No retailer names, listing titles, images or URLs are stored. Missing/poor results hide the US market range. Runtime reads the committed snapshot and never calls Channel3. After a real import, commit the snapshot/projection and restart the application to load it. The committed snapshot has 12 qualifying product ranges dated October 30, 2026. The owner still configures the existing Render services and performs the hosted USD then CAD run with human PayPal sandbox approval.


[Third-party notices](THIRD_PARTY_NOTICES.md) retain dependency attribution. Sandbox buyer logins must be supplied privately in the submission testing notes, never committed here.
