# Rally — build plan

Source of truth for coding agents. Mirrors the shared plan doc as of Oct 22, 2026. Reference screens: [`design/mockup/`](design/mockup/README.md). Reference numbers: [`design/scenario/`](design/scenario/).

## Summary

Rally turns a group-chat order into one negotiated, prepaid group order. Each person says what they want and their max, approves a PayPal hold, and agents negotiate the whole order with the shop. Everyone pays their max or less; the shop is paid when it ships.

- **Deadline:** Nov 12, 2026, 12:00 PM PT on Devpost. Judging runs Dec 1–15, so the hosted demo must stay up and free to test until then.
- **Pass/fail first:** the project must fit the theme, use the PayPal developer platform (sandbox) centrally, and use an AI tool.
- **Then five equal criteria:** technological implementation, design, potential impact, innovation, presentation.
- **Submission:** hosted working demo with test logins, public repo with an open-source license visible in the About section, a YouTube video under 3 minutes with no third-party trademarks or unlicensed music, and a text description.
- **Prize targets:** grand prize; honorable mentions Best Use of Agentic Commerce and Best Use of PayPal + AI; sponsor prize AG Grid for the organizer order sheet. A project can win one grand or honorable mention plus one sponsor prize.
- **Scope:** one market (Korean skincare), one fictional shop (plus an optional second), pools of up to about 30 people, USD, PayPal sandbox only. Real shops, real customs filing, multi-shop pools and other currencies are out.

Rules: [Devpost rules](https://paypalaihackathon.devpost.com/rules), [resources](https://paypalaihackathon.devpost.com/resources).

## Decisions locked

These are settled; ask before reopening any of them.

| Area | Decision | Why |
| --- | --- | --- |
| Market | Korean skincare. Fictional shop Haneul Beauty (Seoul) and product line Dalbit. No sunscreen. | Recognizable; free samples and old-packaging stock are natural trade chips. Video rules ban real brands. The US regulates sunscreen as an OTC drug. |
| Codebase | New app in the same repo. Salvage only the adapters listed under Architecture. | The old code assumes one product, one unit per buyer, fixed 3/5 tiers. |
| Money flow | Rally is the merchant of record in sandbox. Per member: Orders v2 authorize for their max, capture their share at deal close with final capture, void on no deal. Shop paid by Payouts after tracking is added. Full refund if not shipped by the ship-by date. | Offers are binding, buyers are protected, and it avoids PayPal partner-only features (delayed disbursement, platform fees). |
| Max | Enforced in code on every capture, not only by the hold. | PayPal allows capturing up to 115% of a hold or $75 more, whichever is less. |
| Timing | Holds lock and the deal closes within 72 hours of the first authorization. Reauthorize only if a run slips. | PayPal's 3-day honor period. |
| Pricing rule | One price per item variant per pool. A member's max can only exclude them, never raise their price. | Nobody gains by understating their max. |
| Flexibility | Members who accept a cheaper variant pay that variant's price. | Rewards the flexibility that unlocks the deal. |
| Decision rights | LLM: language and ideas. CP-SAT solver: assignment and cost splits. Code: acceptance and every limit. PayPal: money. | The LLM never accepts a deal and never sees the shop's lowest prices. |
| Customs | Duty estimated at 12.5% (current total on Korean cosmetics) and held as a reserve. Overestimates refunded; underestimates absorbed by Rally. Customs fee and tax are configurable estimates. | Keeps the max a hard ceiling. |
| Terms traded | Item prices, variant swaps (old bottle), shipping option (express or the shop's shared freight), extras (sample kits). At most 3 rounds. | Enough to show real trading while staying explainable in a 3-minute video. |
| Model | A hosted model API for the deployed demo; self-hosted only for development. Keep the provider-agnostic adapter. | The demo must stay up through Dec 15. |
| Hosting | Render (existing render.yaml) with Postgres. | Already set up; Render is also a sponsor. |

## Member flow and simplicity rules

A member sees six screens and one optional question. All bargaining detail lives behind one link, "See how the deal is going." Screens: [`design/mockup/screens/`](design/mockup/screens/).

1. **Invite** — shop name, product photos with list prices, "9 friends are in," one line on how it works, button: Join the order.
2. **Tell us** — free-text box ("Snail essence, the rice toner and a box of cica masks. Under $75 all in."), parsed items shown as product tiles, the max as a chip, and at most one question with tap answers ("Would you take the old bottle if it's cheaper?").
3. **Review and approve** — basket, two plain-language toggles ("Take the old bottle if $4+ cheaper," "Use slower shipping"), the max field, "Ordering alone: about $121.58," and the PayPal button for a hold of the max.
4. **Negotiating** — a three-step progress bar, one highlighted card when a rule is applied ("Old bottle is $5 cheaper. You said that's fine, so we switched you."), and "Still under your max."
5. **Deal reached** — one big number ("You pay $66.66"), the saving vs ordering alone, item list with photos and the free extra, and the full cost breakdown behind a toggle.
6. **Receipt** — four-step timeline (hold, charge, ships, pick up) and two protections (refund if not shipped; customs difference refunded).

**Quick question** (only when needed): two product photos side by side, two buttons, and "No answer in 10 minutes keeps your choice."

Simplicity rules for every member screen:

- One primary action and one big number per screen.
- Products and photos lead; numbers support them.
- Breakdowns, rounds and agent logs are one tap away, never on the main path.
- Plain words only: "max," "hold," "charged," "old bottle." Never "mandate," "utility," "authorization," "walk-away" or "round" in member copy.
- At most one question per screen; every question has a safe default.

Behind-the-scenes screens (organizer, shop, judges): How the deal was made, Organizer order sheet, Shop agent console, Deal scorecard, Benchmark, Who decides what. These may be denser but follow the same visual system.

## Architecture and repo changes

Keep the current stack and hosting; rebuild the domain. One FastAPI API, one worker process, Postgres, React + Vite + TypeScript, deployed on Render.

![Architecture: agents propose, code decides, PayPal moves money](docs/plan/architecture.png)

The language model only reaches the model API; only the code-owned acceptance step reaches PayPal's money calls.

Added dependencies: OR-Tools (CP-SAT solver), the PayPal Agent Toolkit (Python), AG Grid (React, organizer sheet). Nothing else new.

**Keep (copy into the new layout, then adapt):**

- `backend/coalition/model.py` → `rally/llm.py`: provider-agnostic structured-output adapter with schema validation.
- From `payments.py`: OAuth token caching, the request helper with `PayPal-Request-Id` idempotency, webhook signature verification. Drop its commitment-coupled state machine.
- `tests/fixtures/paypal_official.json` contract fixtures.
- The worker's job-claim and lease pattern (`worker.py`, `db.enqueue`), collapsed to one lane.
- Frontend: `PayPalApproval.tsx`, the Magic UI pieces (animated list, number ticker, blur fade), Playwright config.
- `render.yaml`, `Dockerfile`, `compose.yaml`, `.github/workflows/verify.yml` (adapted), `LICENSE`.

**Delete:** headphone catalog and photos, calculator and legacy runs, `tests/legacy_fixtures.py`, all six migrations, `docs/model-verification-*.json`, the long `VERIFICATION.md` (replace with a short `EVIDENCE.md`), operator persona preparation, and `assistant.py`, `demo.py`, `groups.py`, `matching.py`, `negotiation.py`, `shopping.py`, `offers.py`.

**New layout:**

```text
backend/rally/
  config.py          settings, feature flags (fixture vs connected)
  db.py              connection, migration runner, job queue
  migrations/001_init.sql
  llm.py             structured JSON output, schema-validated, bounded tokens
  catalog.py         shops, products, variants, extras, freight options, seed
  elicit.py          free text -> items, rules, max; at most one question
  pools.py           pool state machine
  landed.py          deterministic costs, rate table, exact cent splits
  solver.py          CP-SAT: variant assignment, inclusion, offer candidates
  negotiation/
    schema.py        Offer, Line, Freight, Extra (strict pydantic)
    buyer.py         group agent: solver candidates + LLM move choice
    seller.py        shop agent: utility in code, LLM sees scores only
    engine.py        rounds, acceptance, questions, deadlines
  payments/
    paypal.py        OAuth, orders, authorize, capture, void, refund, payouts
    ledger.py        payment operations, idempotency, reconciliation
    webhooks.py
  toolkit.py         Agent Toolkit: shipment tracking, transaction list
  worker.py
  api.py
  sim/generator.py   random pools for the benchmark
  sim/benchmark.py   strategies A-D, metrics
frontend/src/routes/
  Invite Tell Review Live Ask Done Receipt
  DealRoom OrderSheet ShopConsole Scorecard Benchmark WhoDecides
AGENTS.md  PRODUCT.md  DESIGN.md  README.md  EVIDENCE.md
```

**API surface:**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/pools | Organizer creates a pool (shop, lock time, ship-by date) |
| GET | /api/pools/{id} | Public invite: shop, products, member count |
| POST | /api/pools/{id}/members | Join with free text; returns parsed items, rules, max, question |
| PATCH | /api/members/{id} | Edit items, rules, max before lock |
| POST | /api/members/{id}/hold | Create the PayPal order (intent AUTHORIZE, amount = max) |
| POST | /api/members/{id}/hold/approve | Authorize after buyer approval |
| GET | /api/pools/{id}/live | Member view: progress, applied rules, still under max |
| POST | /api/questions/{id}/answer | Answer a quick question |
| GET | /api/pools/{id}/deal | How the deal was made: rounds by term, log |
| GET | /api/pools/{id}/sheet | Organizer order sheet |
| GET | /api/shops/{id}/console | Shop agent console (shop auth) |
| POST | /api/pools/{id}/ship | Shop adds tracking; triggers payout |
| POST | /api/paypal/webhook | Verified PayPal events |
| POST | /api/demo/seed | Seed 9 simulated members so a judge is the 10th |
| GET | /api/bench | Benchmark results |

## Data model

One fresh migration, `001_init.sql`. Money is integer cents everywhere. Columns marked private are readable only through shop-scoped endpoints and the seller utility code, never by any LLM prompt.

| Table | Key columns | Notes |
| --- | --- | --- |
| shops | id, name, country, payout_email | Haneul Beauty, Seoul, KR |
| products | id, shop_id, name, hts_code, origin, image_url, list_price | HTS 3304 for skincare |
| variants | id, product_id, label, weight_g, stock, days_on_shelf, unit_cost (private), lowest_price (private) | "new bottle" and "old bottle" are two variants |
| shop_extras | id, shop_id, name, unit_cost (private), stock | Sample kit of 5 minis |
| freight_options | id, shop_id, kind, departs_on, transit_days, price_rule, cost_rule (private) | Express (any day, at cost) and shared freight (fixed departure) |
| communities | id, name | Glass Skin Club |
| pools | id, community_id, shop_id, organizer_id, state, lock_at, deal_deadline, ship_by, deliver_to | One delivery address per pool |
| members | id, pool_id, display_name, raw_text, max_cents, state | raw_text kept for the source spans |
| member_items | id, member_id, product_id, qty, preferred_variant_id | |
| member_rules | id, member_id, kind, params, source_span | kinds: variant_swap {from, to, min_discount}, slow_shipping {arrive_by} |
| holds | id, member_id, order_id, authorization_id, amount_cents, status, honor_until, expires_at | One active hold per member |
| rounds | id, pool_id, n, actor, offer, message, valid, created_at | offer = the strict JSON schema below |
| questions | id, member_id, round_id, payload, answer, default_answer, deadline | |
| deals | id, pool_id, terms, version, accepted_at | Immutable once written |
| allocations | id, deal_id, member_id, lines, freight, duty, fee, tax, total | total <= member max, checked in code before insert |
| payment_ops | id, kind, member_id, pool_id, request_id (unique), status, provider_ref, request, response | Every PayPal mutation goes through here |
| payouts | id, pool_id, batch_id, amount_cents, status | |
| shipments | id, pool_id, carrier, tracking_number, shipped_at | |
| webhook_events | id, event_id (unique), type, raw, verified, processed_at | Persist before acknowledging |
| jobs | id, kind, payload, run_at, lease_until, attempts | Worker queue |
| rate_table | id, origin, hts_prefix, duty_bp, source_url, as_of | KR, 3304 → 1250 bp, as of 2026-10-12 |
| bench_runs | id, strategy, seed, metrics | Benchmark output |

Pool states: OPEN → LOCKED → NEGOTIATING → AGREED → CHARGED → SHIPPED → DELIVERED. Failure paths: NEGOTIATING → NO_DEAL → VOIDED, and CHARGED → NOT_SHIPPED → REFUNDED.

## Negotiation engine

The engine is code with an LLM inside it, not an LLM chat. Offers are strict JSON, the solver builds and scores them, code accepts or rejects, and the LLM chooses among scored options and writes the words.

**Offer schema** (both sides send exactly this; anything else is rejected):

```json
{
  "round": 2,
  "actor": "buyer",
  "lines": [
    {"variant_id": "essence-old", "qty": 7, "unit_cents": 1600},
    {"variant_id": "essence-new", "qty": 1, "unit_cents": 2100},
    {"variant_id": "rice-toner", "qty": 7, "unit_cents": 1900},
    {"variant_id": "cica-masks", "qty": 8, "unit_cents": 1300}
  ],
  "freight": {"option_id": "shared-nov14", "price_cents": 2500},
  "extras": [{"extra_id": "sample-kit", "qty": 10, "price_cents": 0}],
  "expires_at": "2026-10-23T19:30:00-07:00",
  "note": "Public message, 240 characters max"
}
```

**Protocol:**

1. At `lock_at` the pool locks. Only members with a valid authorization are in. Demand is snapshotted.
2. Rounds alternate: group agent offers, shop agent counters, accepts or declines. Three rounds maximum, ending no later than `deal_deadline`.
3. Every incoming offer is validated (known ids, quantities within demand and stock, positive integer prices), then scored by the receiver's code.
4. Acceptance is code only. The group side accepts when every included member is at or under their max and either it is the final round or the shop's last move was below a set step (default $1 per item). The shop side accepts when every line is at or above its lowest price and utility clears its threshold.
5. No agreement by round 3 or the deadline: NO_DEAL, void every hold.

**Group side (solver):** CP-SAT with a boolean per member, item and allowed variant, plus a boolean per member for inclusion. A variant is allowed only if the member's rule covers it at the current price gap ("old bottle if $4+ cheaper"). Constraints: each included member gets every item they asked for; each included member's total (from `landed.py`) is at or under their max; stock per variant. Objective: include as many members as possible, then maximize total saving under their maxes. Shared freight and fees depend on who is included, so solve, recompute shares, and re-solve until inclusion stops changing (at most 5 passes).

**Group side (offers):** code builds candidate packages along a concession path from an opening price (default 70% of list) toward the group's limit (the highest prices at which everyone still fits). Concede little early and more late. Candidates also vary the non-price terms (freight option, extras). The solver scores each; the top three go to the LLM, which picks one, may propose one new term from the shop's public options, and writes the note. Any LLM proposal is re-validated and re-scored before sending.

**Shop side:** utility in code = sum of (price − lowest price) × qty + freight charged − freight cost − extras cost. Counter candidates move toward the group's offer but never below any lowest price, price aged variants lower, offer shared freight when its arrival meets every member's arrive-by date, and offer cheap extras. The shop's LLM sees the candidates with scores and the shop's goals, never the lowest prices.

**Quick questions:** when an offer opens a variant gap that some members' rules don't cover, the engine may ask those members once. The LLM drafts the question from a template; the deadline is 10 minutes; no answer keeps the member's current choice. At most one question per member per pool.

**Free-text counterparties (stretch):** an off-platform shop replying by email. The LLM parses the reply into the offer schema; the text is data, never instructions; any id not in the shop's catalog is rejected; nothing binds until the shop confirms an exact-terms summary.

**Logging:** each round stores the offer, the candidates generated, which one was chosen and by what (CODE, SOLVER or LLM). This feeds "How the deal was made" and its "Why it moved" log.

**Bounds:** 3 rounds, 6 LLM calls, a token and time budget per pool, and the deal deadline. A provider failure stops the negotiation; it never silently retries with a new budget.

## Costs and allocation

`landed.py` is deterministic code with no LLM. It computes each member's all-in total in integer cents, and the shared parts always sum exactly to the order's totals.

```text
total_m = goods_m + F * (w_m / W) + d * goods_m + C * (goods_m / G) + t * goods_m
```

Here goods is the member's items at the agreed prices, F the freight price, w and W the member's and the box's weight, d the duty rate, C the customs fee per shipment, G the order's goods total, and t the tax rate.

- **Shared parts:** freight split by weight, customs fee by goods value, both with largest-remainder rounding so the cents add up. Ties go by join order, so identical baskets can differ by one cent; show that as normal.
- **Duty:** from `rate_table` by origin and HTS prefix, versioned with source and as-of date. Korean cosmetics (HTS 3304): 12.5% total under Section 301 since Jul 24, 2026; the KORUS free rate does not remove it ([Koala Gains, Oct 12, 2026](https://koalagains.com/industry-tariff-report/chapters/33-essential-oils-and-cosmetics/tariff-updates)).
- **Customs fee ($10 per shipment) and tax (9.25%):** illustrative config values, labeled "est." in the UI.
- **Customs reserve:** duty and fee are held by Rally. After delivery, if the real bill is lower, refund each member's share of the difference; if higher, Rally absorbs it. A member is never charged above their max.
- **Ordering alone (baseline):** list prices + express shipping for the member's own parcel (weight rate card) + the full customs fee + duty + tax.
- **Listed prices (baseline):** the shop's public bulk prices + express shipping for the whole box split by weight. Then drop everyone over their max, recompute shares, and repeat until stable. That loop is what actually happens without bargaining.

**Golden test** (must match the mockup to the cent; reference implementation and full numbers in [`design/scenario/`](design/scenario/)):

| Check | Expected |
| --- | --- |
| "You": items / freight / duty / fee / tax | $51.00 / $3.26 / $6.38 / $1.30 / $4.72 |
| "You": total | $66.66 (max $75.00) |
| Pool total, negotiated | $513.52 (goods $393, freight $25, fee $10, duty $49.14, tax $36.38) |
| Pool total, each ordering alone | $1,035.40 |
| Pool total, listed prices if all 10 bought | $664.13 |
| Listed prices after dropouts | 10 → 5 → 0 members (order fails) |
| Shop gain over lowest prices | negotiated +$97.00, listed (all 10) +$92.00 |

## PayPal integration

PayPal is the backbone, not a checkout button: every member's money is held, charged, released, refunded or paid out through it, and agents never touch money directly. Prove the whole lifecycle in sandbox in week 1; the old repo never completed a real authorize-and-capture.

**Sandbox accounts:** Rally business account (app credentials, merchant of record), Haneul Beauty business account (receives payouts), at least four personal buyer accounts (demo plus judges). Confirm Payouts is enabled for the sandbox app.

| Step | Call | Guard |
| --- | --- | --- |
| Hold | `POST /v2/checkout/orders` with intent AUTHORIZE, amount = max; buyer approves in the JS SDK v6 button; then `POST /v2/checkout/orders/{id}/authorize` | `PayPal-Request-Id` = hold:{member}:{version}. Store authorization id, expiry, honor_until (+3 days). |
| Lock check | `GET /v2/payments/authorizations/{id}` | Only CREATED authorizations count as in. |
| Charge | `POST /v2/payments/authorizations/{id}/capture` with the allocation total and `final_capture: true` | Code asserts amount ≤ max and ≤ authorized amount before calling. Request id = capture:{allocation}. |
| Release | `POST /v2/payments/authorizations/{id}/void` | For excluded members and NO_DEAL. Confirm VOIDED with a GET. |
| Tracking | Agent Toolkit `create_shipment_tracking` on each member's capture | Runs when the shop submits tracking. |
| Pay the shop | `POST /v1/payments/payouts`, one item: items + freight to the shop's sandbox email | Only after tracking exists. |
| Not shipped | `POST /v2/payments/captures/{id}/refund` (full) | Triggered at ship_by if no tracking. |
| Customs true-up | `POST /v2/payments/captures/{id}/refund` with the member's share of the difference | Only refunds, never extra charges. |
| Webhooks | `POST /v1/notifications/verify-webhook-signature`; events: authorization created and voided, capture completed, denied and refunded, payouts batch and item | Persist raw event before returning 200, dedupe by event id, reconcile with a GET. |

Agent Toolkit scope: shipment tracking and the organizer ledger (`list_transactions`). The toolkit has no authorize, capture, void or payout tools, so money movement stays in `payments/paypal.py`, behind code checks. That split is also the pitch: agents negotiate, code and PayPal move money.

Fixture mode (recorded responses from the contract fixtures) exists only for tests and CI. The hosted demo always runs against the real sandbox.

## Design direction

Design is a scored criterion and the video sells the idea, so every UI task uses the Impeccable and taste skills, and products lead every member screen.

**Install in Codex before any UI work:**

```bash
npx skills add pbakaus/impeccable
codex plugin marketplace add Leonxlnx/taste-skill
codex plugin add taste-skill@taste-skill
# then start a new Codex session so the skills load
```

**How to use them:**

- `PRODUCT.md` and `DESIGN.md` (Impeccable's context files) are drafts written from the mockup. Refine them with Impeccable before the first screen.
- Build each screen with taste's `design-taste-frontend` skill (`gpt-taste` is its stricter variant for GPT-based agents), then refine with Impeccable's commands (for example layout, typeset, colorize, quieter).
- Before each milestone demo, run an Impeccable critique and fix what it finds before adding features.

**Keep from the mockup:** warm off-white ground (#F7F4F0), near-black ink (#17161A), one berry accent for actions (#B4235A), butter (#FFE9A8) only for "your rule was applied" moments, mint (#E2F2EA on #0B5A3C) only for savings. Schibsted Grotesk for text, IBM Plex Mono for money. The skills may refine this; they should not add a second accent.

**Images:** product photos make or break the first screen.

- Products are fictional (Dalbit), so no image may show a real brand or logo; the video rules ban third-party trademarks.
- Best option: photograph unbranded amber pump bottles, frosted toner bottles and a mask box, then add a simple "Dalbit" label.
- Second option: generate product renders with an image model (taste's image skills live in `Leonxlnx/imagegen-skills`). Check every render for stray logos or text.
- Openly licensed photos (CC0 or CC BY with credit) are fine for mood and backgrounds, never as product shots.
- The mockup's illustrations (`design/mockup/html/img/`) are the fallback, not the target.

**Non-negotiables:** mobile first at 390 px; contrast at least 4.5:1; touch targets at least 44 px; reduced motion respected; real buttons, links and labels; no emoji, gradient washes or left-border cards. Motion is limited to the final price counting up and a calm progress bar; no confetti.

## Seed data, demo and judge access

Seed exactly the mockup scenario so the golden test, the demo and the video tell one story. Machine-readable version: `design/scenario/scenario.json`.

**Shop catalog** (Haneul Beauty, Seoul; prices in USD; private columns never leave shop-scoped code):

| Variant | List | Listed bulk | Lowest (private) | Cost (private) | Stock | Days on shelf | Weight |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dalbit Snail Essence 100 ml, new bottle | $25 | $22 | $19 | $9 | 120 | 20 | 200 g |
| Dalbit Snail Essence 100 ml, old bottle | $25 | $22 | $10 | $9 | 40 | 150 | 200 g |
| Dalbit Rice Toner 150 ml | $24 | $21 | $17 | $8 | 200 | 45 | 250 g |
| Dalbit Cica Sheet Masks, box of 10 | $18 | $16 | $11 | $6 | 150 | 60 | 300 g |

Extras: sample kit of 5 minis, costs the shop $1.50, 300 on hand. Freight: express at cost by weight (up to 0.5 kg $24, 1 kg $30, 2 kg $42, 5 kg $68, 10 kg $105; parcel packaging 0.15 kg, box packaging 0.5 kg); shared freight leaves Nov 14, costs the shop about $10 for this box, arrives around Nov 21.

**Members** (all accept slower shipping that arrives by Nov 28):

| Person | Items | Bottle rule | Max |
| --- | --- | --- | --- |
| You | essence, toner, masks | old if $4+ cheaper | $75 |
| Leo | essence ×2 | either | $50 |
| Aisha | essence, toner | new only | $62 |
| Noah | toner, masks | — | $56 |
| Sam | essence, masks ×2 | either | $70 |
| Priya | essence ×2 | old if $4+ cheaper | $50 |
| Jun | toner ×2 | — | $62 |
| Elena | toner, masks | — | $52 |
| Omar | masks ×3 | — | $78 |
| Kai | essence, toner | either | $62 |

**Video beats** (under 3 minutes, no real brands, no unlicensed music):

1. 0:00–0:15 — The problem: group orders in a group chat, a spreadsheet, chasing payments, surprise customs.
2. 0:15–0:45 — Join: invite, type the request, one question, approve the PayPal hold (real sandbox popup).
3. 0:45–1:25 — Negotiation: the deal room beside the phone; the old-bottle rule applies, Aisha's question, shared freight and sample kits, code accepts.
4. 1:25–1:50 — Result: "You pay $66.66," saved $54.92; scorecard shows both sides ahead and listed prices failing.
5. 1:50–2:20 — Money: captures with the hold released, tracking added, shop paid by payout, organizer sheet.
6. 2:20–2:50 — Under the hood: who decides what, and the benchmark result.

**Judge access:**

- Hosted URL plus a "Try it as the 10th member" button that seeds the other 9 and compresses the timers (lock 2 minutes after the judge joins, deal window 5 minutes).
- The judge's hold is a real sandbox authorization; give sandbox buyer logins in the Devpost testing notes.
- The 9 seeded members use fixture holds, labeled "simulated" in the organizer sheet. The video shows a run where every hold is a real sandbox approval.
- Shop console and organizer sheet reachable from a small "Behind the scenes" menu, with a read-only shop login.

## Benchmark

The benchmark decides whether the bargaining is real: the full engine must beat listed prices on completed orders and combined gain, with zero over-max charges. If it does not, fix the engine before polishing the UI.

- **Generator** (`sim/generator.py`, seeded and published): 200 pools of 5–30 members. Random shop situations (stock age, costs, lowest prices, a shared-freight date, extras cost) and random members (items, bottle rule, shipping rule, max drawn around their ordering-alone total). No LLM calls inside the generator.
- **Same pools for every strategy.** The LLM step in strategies B and D uses the real hosted model; cache responses by prompt hash so reruns are free and repeatable.

| Strategy | What it does |
| --- | --- |
| A · Listed prices | Shop's public bulk prices and express shipping; members over their max drop out until stable. |
| B · Chatbot haggling | One price per item, two LLMs haggle, the LLM decides acceptance (what the old repo did). |
| C · Engine without rules | Solver and code acceptance, but no bottle or shipping flexibility collected. |
| D · Full engine | Rules, quick questions (answered by the generator's hidden preference), solver, code acceptance. |

Metrics per strategy: orders completed, buyer savings vs ordering alone, shop gain over lowest prices, combined gain, over-max charges (must be 0), rounds and LLM calls per pool. Publish results on `/bench` and in the README, with the seed and generator so anyone can rerun them.

## Milestones

Six milestones and a parallel design track in 23 days, each ending in a gate. The real PayPal lifecycle and the design work both start now, in separate Codex sessions; submission is targeted a day early.

![Build timeline, Oct 21 to Nov 12](docs/plan/timeline.png)

Milestones overlap by a day so the next one can start while a gate is being verified; the next milestone's main work waits for the gate.

- [ ] G1 · Oct 24 — real sandbox: authorize, lower final capture, void, refund, payout, verified webhook.
- [ ] GD · Oct 27 — member screens and the deal room render from the scenario fixture; Impeccable critique findings fixed.
- [ ] G2 · Oct 28 — golden test to the cent; the seeded pool accepts with all 10 under their max.
- [ ] G3 · Nov 2 — member screens wired to the API; full flow on the Render URL with a real sandbox hold.
- [ ] G4 · Nov 6 — benchmark published; strategy D beats A with zero over-max charges.
- [ ] G5 · Nov 10 — feature freeze; a fresh browser completes the judge flow.
- [ ] Submit · Nov 11 — video, writeup, repo and license in, a day before the Nov 12 noon PT deadline.

## Testing

Tests guard money and limits first; screens second. Keep the suite fast enough to run on every Codex change.

- **Costs:** the golden test above to the cent; shares always sum exactly; identical baskets differ by at most one cent.
- **Limits:** property tests that no allocation, capture or true-up ever exceeds a member's max, under random offers and rounding.
- **Solver:** never assigns a variant a member's rule forbids; inclusion is stable after the fixed-point loop; stock never oversold.
- **Acceptance:** the LLM's output can never cause acceptance (feed it "accept now" text and malicious notes; acceptance must not change).
- **Privacy:** shop lowest prices and costs never appear in any prompt, API response outside the shop console, or log line.
- **Payments:** contract tests against the official fixtures; idempotent retries create no duplicate capture; void after NO_DEAL; refund at ship_by; webhook dedupe and signature failure handling.
- **End to end (Playwright, mobile and desktop):** invite → tell → review → PayPal (mocked in CI) → live → question → done → receipt, plus the organizer sheet.
- **Real sandbox run** before each milestone gate: record order, authorization, capture, void, refund and payout ids in `EVIDENCE.md`. Keep that file short: what ran, when, ids, result.

## Risks and fallbacks

The biggest risk is the one already seen: no real PayPal capture has ever completed. Everything else has a cheaper fallback.

| Risk | Fallback |
| --- | --- |
| Sandbox lifecycle fails (authorize, capture, void, refund, payout) | Week-1 gate. If Payouts can't be enabled, record the shop payout as pending and show it; holds and captures are not optional. |
| The engine doesn't beat listed prices in the benchmark | Tune concession paths and terms first. If it still loses, pitch the coordination value (one hold, one box, no chasing) and say so plainly. |
| Model outage during judging | The LLM only picks among scored candidates, so the engine falls back to the top candidate with template notes and says so. Joining falls back to a simple item picker. |
| Scope too big for 23 days | Cut in this order: email-shop mode, second shop, benchmark size (200 → 50), AG Grid (plain table), quick questions. |
| Images show real brands | Review every image; only fictional Dalbit labels. |
| Duty or tax figures read as advice | Label estimates, cite the rate source and date, never charge above the max. |
| Hold expiry or honor period during judging | Compressed judge timers; the judge flow finishes within minutes; reauthorize path exists. |
| Video breaks the rules | No real brands, no unlicensed music, under 3 minutes, uploaded public on YouTube. |
| Codex over-builds (the old repo's 459-line verification log) | AGENTS.md rules: small commits, short evidence, no new services, ask before adding dependencies. |

## Codex prompts

This plan, `AGENTS.md`, draft `PRODUCT.md` and `DESIGN.md`, the mockup (`design/mockup/`) and the scenario numbers (`design/scenario/`) are on branch `rally`. Run the design track and the backend track (M1, then M2) in separate Codex sessions at the same time; each owns its own folders. After that, paste one prompt per milestone, and don't start a milestone until the previous gate passes.

**Design track — start now, owns `frontend/`:**

```text
Design track. You own frontend/ only; the backend track owns backend/, tests/ and scripts/.
Install the skills first (PLAN.md "Design direction"), then start a new session.
1) Read PLAN.md, AGENTS.md, PRODUCT.md, DESIGN.md and every image in design/mockup/screens.
   PRODUCT.md and DESIGN.md are drafts from the mockup: refine them with Impeccable before building.
2) Remove the old Coalition storefront UI from frontend/src and the browser tests it makes obsolete.
   Keep components/PayPalApproval.tsx, components/magicui/ and the Playwright setup.
3) Build the member screens (Invite, Tell, Review, Live, Ask, Done, Receipt) as routes that read
   design/scenario/scenario.json through one typed fixture module, so M3 can swap in the API later.
   Use taste's design-taste-frontend skill, then refine with Impeccable's commands.
4) Keep every member screen simple: one primary action, one big number, products and photos lead,
   breakdowns one tap away, plain words only. Improve the product imagery per "Design direction";
   the mockup's illustrations are the fallback.
5) Then build How the deal was made the same way.
Add Playwright screenshots at 390 px for every member screen and run an Impeccable critique.
Gate GD: all member screens and the deal room render from the fixture; critique findings fixed.
```

**M0 + M1 — backend track, start now, owns `backend/`, `tests/`, `scripts/`:**

```text
Backend track. Read PLAN.md and AGENTS.md. You are on branch rally. You own backend/, tests/ and
scripts/; the design track owns frontend/.
1) Apply "Architecture and repo changes" for the backend: copy the salvaged adapters into
   backend/rally/, delete the listed old backend code and tests, create migrations/001_init.sql from
   "Data model", and keep CI green (update .github/workflows/verify.yml as needed).
2) Build payments/paypal.py, ledger.py and webhooks.py from "PayPal integration".
3) Add a script that runs, against the real sandbox: create order (AUTHORIZE) -> I approve in
   the browser -> authorize -> capture a lower amount with final_capture -> a second order voided
   -> refund a capture -> payout to the shop sandbox account -> receive and verify a webhook.
Stop and tell me exactly what to approve. Record ids in EVIDENCE.md. Gate G1: every step succeeds.
```

**M2 — engine without UI:**

```text
Implement catalog.py (seed from "Seed data"), landed.py, solver.py (OR-Tools CP-SAT) and
negotiation/ from "Negotiation engine" and "Costs and allocation". Use a fixture LLM first.
Add a CLI that runs the seeded pool end to end and prints rounds, allocations and the scorecard.
Gate G2: the golden test passes to the cent, every property test in "Testing" passes, and the
CLI run accepts a deal with all 10 members under their max.
```

**M3 — wire the member app:**

```text
Wire the member screens from the design track to the real API: elicit.py on the hosted model for
Tell, the PayPal JS SDK v6 button (reuse PayPalApproval.tsx) to the hold endpoints on Review, and
polling for Live. Keep the fixture module for tests. Use the impeccable and taste skills for any UI
change and run an Impeccable critique before the gate.
Gate G3: the full member flow works on the hosted Render URL with a real sandbox hold.
```

**M4 — behind the scenes, payouts, benchmark:**

```text
Use the impeccable and taste skills for UI. Build How the deal was made, Organizer order sheet
(AG Grid), Shop console, Scorecard, Who decides what. Add shipment tracking via the PayPal Agent
Toolkit, payout after tracking, refund at ship_by, customs true-up. Build sim/generator.py and
sim/benchmark.py and the /bench page.
Gate G4: benchmark published; strategy D beats A on orders completed and combined gain with zero
over-max charges. If not, stop and report before touching UI.
```

**M5 — judge-ready:**

```text
Add judge mode ("Try it as the 10th member", compressed timers, labeled simulated holds), the
model-outage fallback, final product images per "Design direction", README with setup and test
logins, and a final Impeccable critique on every screen. Make the LICENSE visible in the GitHub
About section. Gate G5: feature freeze; a fresh browser completes the judge flow on Render.
```
