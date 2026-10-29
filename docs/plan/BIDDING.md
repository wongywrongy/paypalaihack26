# Rally v3: shops bid for every item

Owner-approved October 29, 2026. This plan replaces the per-shop exchange in PLAN.md ("Negotiation engine") for new orders. Everything else in PLAN.md still holds: one shopper, three fictional shops, five destinations, the Seoul hub, Rally as merchant of record, the PayPal hold as a hard ceiling, and code deciding every term.

Design reference: the Claude Design canvas "Rally — shopper flow" (phone flow plus the 1440 px desktop bidding board). Numbers below match `landed.calculate` exactly.

## The idea in one line

PayPal holds the shopper's maximum. Every shop that stocks an item bids for it in three open rounds. Rally's code picks the lowest complete delivered total, so a shop can win with a bundle or free shipping inside Korea, not only a lower unit price.

## Why this replaces the exchange

- Competition is the real source of a lower price. A shop bidding against two others has a reason to move; a shop being asked nicely does not.
- It shows judges a genuine multi-agent market: three shop agents with private authority, one buyer agent, code as the auctioneer, PayPal holding the money.
- The hold-as-ceiling idea gets sharper: bids can only go down from what the shopper approved.

## Decisions that change (PLAN.md "Decisions locked")

| Area | Was | Now |
| --- | --- | --- |
| The deal, live | Each shop's price meets Rally's offer, item by item | Shops bid on each item in 3 open rounds; the total counts down at each round; winners are awarded at the end |
| Shopper rules | "Older packaging is fine", "Add a small extra if it lowers my total" | "Older packaging" and "Bundles" (one shop may price two of your items together). Keys: `old_packaging_ok`, `bundles_ok` |
| Terms traded | Unit price, older packaging, bundle, sample kit, free domestic shipping, small add-on | Unit price, older packaging, bundle price across items, sample kit, free shipping inside Korea. The add-on mask is dropped |
| Sourcing | Checkout picks one shop per item; the deal haggles with that shop | Checkout still prices the cheapest complete listed allocation (that is the hold). The auction may move any item to another shop |
| Model | One hosted model | Bitdeer AI (OpenAI-compatible). Shop agents and the buyer agent may use different model families |

Unchanged: the LLM never accepts, never sees floors or costs, never moves money. Code validates every bid. Capture is at or below the hold. A failed, timed-out or invalid model selection uses code's top-ranked valid candidate, marked `chosen_by=CODE`.

## Protocol

Inputs: the immutable checkout quote (lines, breakdown, rate), destination, catalog with private authority, rules `{old_packaging_ok, bundles_ok}`.

1. **Start.** Code lists every eligible offer per item: shops that stock it, destination-allowed, plus the older variant when `old_packaging_ok`. Items with one eligible shop are not auctioned; they keep the listed price and show "Only at <shop>".
2. **Rounds 1–3.** Each round:
   - The buyer agent sends up to 3 asks (see Buyer agent). Round 1 has one ask per shop: "Bid on these items."
   - All shops bid in parallel. For each shop, code generates candidate bids from its authority, scores them, and sends the top 3 to the shop's model. The model picks one by index and writes a one-line public note. A shop may pass on any item.
   - Code validates each bid: offer exists and is in stock, `floor ≤ price ≤ list`, never higher than the same shop's previous bid for that item (bids only go down), the older variant only if permitted, a bundle only if `bundles_ok`, a free-shipping perk only from that shop.
   - The buyer-selected note is attached to every selected `ask`, including round 1. Code then computes the best complete allocation over all current bids (exact search, below) and emits a `round` event with leaders, the new total and a code-generated `round_note`. Public round and beat notes format money with destination symbols ($, C$, £, €, A$), using the locked rate for beat gaps.
3. **Award.** After round 3, code computes the final allocation, asserts `total ≤ hold`, and emits one `award` event plus `done`. If nothing beat the checkout, the checkout allocation stands. There is still no failed order.
Model failures are logged server-side and counted in the result (`model_failures`, `model_failures_by_role`); they do not emit shopper `error` events. Shops use the top-ranked valid candidate; the buyer uses the top asks and code's `round_note`. Only a shop with no valid candidate emits `error`.

4. **Bounds.** 3 rounds; one model call per shop per round, plus one buyer call per round; whole auction ≤ 30 s wall clock; per-call timeout 4 s; token budget per order as today. Rounds are paced for viewing: about 3.5 s each in the live event stream (the Deal screen also holds each event ≥ 600 ms).

### Bids

```json
{
  "shop_id": "haneul",
  "round": 3,
  "items": [
    {"offer_id": "haneul/mul-gel-cleanser", "unit_usd_cents": 1100},
    {"offer_id": "haneul/sae-cica-cream", "unit_usd_cents": 1800}
  ],
  "bundle": {"offer_ids": ["haneul/mul-gel-cleanser", "haneul/sae-cica-cream"], "price_usd_cents": 2900},
  "free_domestic": true,
  "extras": [],
  "pass": [],
  "note": "Cleanser and cream together for $29. Shipping in Korea free."
}
```

- A bundle is valid only if the shop wins every item in it. The award search treats it as one indivisible option. Bundle unit prices must sum exactly to the bundle price; each unit still respects its floor.
- `free_domestic` applies only if that shop wins at least one item. It costs the shop its domestic fee (shop utility).
- `extras` is the Dalbit sample kit, as today.

### Shop side (code authority, model picks)

Candidates per shop per round come from `shop_agent` authority: target prices from `discount_bp`, floors, aged-stock bonus (older variant, `days_on_shelf`), sample kit, free domestic shipping, and bundles over two items the shop sells in this bag. Each candidate gets:

- `utility` (existing formula, extended for bundles and free domestic shipping), and
- `wins`: the items awarded to this shop by the exact complete-cost search when this candidate replaces its standing bid. Rank by those all-in wins, the complete award objective (total, shops, kit), then utility; unit-price comparison never decides a win.

Policies include `bundle_discount_bp` (Haneul 500, Bada 0, Dalbit 300), `free_domestic`, and a private `utility_threshold` (default zero). Bundle discounts clamp each unit at its floor; select a two-item pair with the shop publicly runner-up on at least one item. Shipping and kit variants compete on the same delivered-cost search. Free shipping is allowed for any permitted shop only if utility on its actual awarded items meets its threshold. Persisted older policies inherit these new defaults without rewriting orders.

The model sees: the shop's display name, its public goals (e.g. "move older packaging", "prefer two-item orders"), the current public leaders and prices, the buyer's asks, and the candidates with `utility_rank` and `wins`. It never sees floors, costs or other shops' private data. Leading prices are public in an open auction.

### Buyer agent (Rally)

Code builds candidate asks each round: for each item, the runner-up shop and the gap to the leader; for each shop with two or more eligible items, a bundle ask (only when `bundles_ok`); the market reference when present (see Market reference). The buyer model picks up to 3 asks and writes the round note ("Round 1 best: $110.29 all in. Anyone lower?"). Asks are public text plus item ids; they never carry money authority.

### Award search

Exact search over, per item, every valid current bid (plus listed checkout as a fallback), with bundles as joint options. At most 8 items × 3 shops, plus bundles, stays small. Objective, in order: lowest complete total from `landed.calculate(lines, destination, catalog, extras=..., shipping={shop: domestic})`, then fewer shops, then perks (a sample kit wins a price tie), then the earlier bid. The same function produces round leaders and the final award.

`landed.calculate` already accepts per-shop `shipping` overrides. Pass `0` for a winning shop with `free_domestic`, and the normal threshold value otherwise.

## Reference scenario (the hero bag, US)

Bag: Low-pH Gel Cleanser, Rice Toner, Snail Essence, Cica Barrier Cream. Both rules on. Shops: Haneul (sells all 4), Bada (cleanser, toner, cream), Dalbit (toner, essence incl. older).

| t (s) | Shop | Bid |
| --- | --- | --- |
| 1.0 | Bada | cleanser 12, cream 18 |
| 1.5 | Dalbit | toner 20, essence 18 (older packaging) |
| 2.0 | Haneul | cleanser 13, toner 22, essence 23, cream 20 |
| 3.0 | Round 1 | best **$110.29** |
| 4.5 | Bada | cleanser 11, cream 17, toner 20 |
| 5.0 | Dalbit | toner 19 + sample kit, essence 17 |
| 5.5 | Haneul | cleanser 12, essence 21, cream 19; passes on toner |
| 6.5 | Round 2 | best **$105.42** |
| 8.0 | Bada | cream 16 |
| 8.5 | Dalbit | essence 16 |
| 9.0 | Haneul | bundle cleanser + cream $29 (11 + 18), free shipping in Korea |
| 10.5 | Award | Haneul wins cleanser + cream, Dalbit wins toner + essence (older) + kit: **$101.92** |

Round 2 uses Bada toner $20: at $19, its three-item subtotal clears free domestic shipping and the exact best total would instead be $104.42.

Bada's final option (cleanser 11 + cream 16, $3.50 domestic) totals $102.99, so Haneul's bundle wins by $1.07 all in although Bada bid less on the cream.

Golden schedules for this recorded scenario, checkout → final, minor units (verified with `landed.calculate`): **USD 11882 → 10192, CAD 16087 → 13825, GBP 9361 → 8055, EUR 11105 → 9621, AUD 17260 → 14835.**

All floors in the scenario hold: Bada cleanser ≥ 10.00, cream ≥ 16.00; Haneul cleanser ≥ 10.50, cream ≥ 16.50; Dalbit toner ≥ 16.00, older essence ≥ 12.00.

These are recorded-review results, available only with an explicit selector and `recorded_review=True`. Connected runs and normal index-0 fixture selectors never read auction.json. The generative hero currently finishes at $95.35 (within the $101.92 target), with Haneul winning cleanser/cream as a discounted bundle with free domestic shipping despite Bada’s lower cream unit price; Dalbit supplies toner/older essence and the kit. It does not reproduce the recording’s exact prices: policy discounts and earlier free-shipping competition generate different bids. All five recorded goldens remain replay contracts, not claimed live-model outcomes.

## Events (deal_events.data, schema v3)

All events keep today's envelope: `id`, `seq`, `t`, `kind`, `note`, `total` (current best complete total, shopper-currency minor units), `chosen_by` (`CODE` | `LLM` | `FIXTURE`). New fields:

| kind | actor | Extra fields |
| --- | --- | --- |
| `start` | rally | `v: 3`, `items: [pid]`, `shops: {pid: [shop]}`, `listed: {pid: {shop: unit}}` |
| `ask` | rally | `round`, `shop` or null, `items: [pid]` |
| `bid` | shop | `round`, `shop`, `items: {pid or pid:older: unit}`, `bundle: {items, price} or null`, `perks: {pid: ["older","kit","bundle","freeship"]}` |
| `pass` | shop | `round`, `shop`, `items: [pid]` |
| `round` | rally | `round`, `leaders: {pid: shop}` |
| `award` | rally | `winners: {pid: {shop, unit, variant, bundle}}`, `extras`, `domestic: {shop: minor}` |
| `error` | rally | `shop` (this shop has no valid candidate) |
| `done` | — | final `total` |

`winners[pid].bundle` is code-owned: true only when the exact award uses that indivisible bundle. Receipts use this flag, never a historical bid.

Units in events are shopper-currency minor units (converted at the locked quote rate), like today. The Deal screen picks the v3 reducer when the first event is `start` with `v: 3`; older orders keep the existing reducer and view.

## Final terms

`final_terms` keeps today's shape (`lines`, `extras`, `breakdown`) and adds `domestic_usd: {shop: cents}` and `auction: {rounds, winners}`. `_reserve` already moves reservations between offers, so winners at different shops work. `fulfillment.handoff` must use `final_terms.domestic_usd[shop]` when present instead of recomputing threshold shipping, so a shop that bid free domestic shipping is paid goods only.

## Models: Bitdeer AI

- Base URL `https://api-inference.bitdeer.ai` (the adapter appends `/v1/chat/completions`); `Authorization: Bearer`. List model ids with `GET /v1/models`.
- Shop agents: DeepSeek V4.1 Flash, non-reasoning (fast; reasoning variants take ~9 s to answer). Buyer agent: GLM-5.3 or the same Flash model. Different families for the two sides make "independent agents" literal.
- Settings: `LLM_MODEL_SHOP`, `LLM_MODEL_BUYER` (both fall back to `LLM_MODEL`), `LLM_RESPONSE_FORMAT=json_schema|json_object` (Bitdeer's docs do not confirm `json_schema`; the adapter must support `json_object` with the schema in the system prompt, and keep validating with pydantic).
- First task before any auction work: run `scripts/engine.py --env-file <private>` against Bitdeer and record whether structured output works. Credentials stay in the private env file and Render; never in the repo or chat.

## Market reference: Channel3 (phase 2, optional at runtime)

The shops and brands are fictional, so Channel3 never supplies a seller or a product we sell. It supplies a **US market range for comparable products** (same category, similar size), which both agents use and the item card shows ("US market $18–26").

- `scripts/market_snapshot.py` (dev-only) queries Channel3 for each catalog product with a category + size + key-ingredient query, filters to the right category and size, and writes `design/scenario/market.json`: `{pid: {"low_usd_cents", "median_usd_cents", "high_usd_cents", "n", "as_of", "query"}}`. No retailer names, titles, images or URLs are stored.
- Runtime reads the committed snapshot (`backend/rally/market.py`); the deal path never calls Channel3, so it stays fast and deterministic.
- Use `CHANNEL3_API_KEY` only in the private env. Check the current API at channel3.ai/docs before writing the client; prefer `httpx` over a new SDK dependency.
- If results are poor for a product, store nothing for it. The UI hides the range when absent.

## Frontend

- **Bag:** items listed one by one (no shop grouping); each shows best listed price and "N shops bid". Switches "Older packaging" and "Bundles". Line under the PayPal button: "PayPal holds $X. Shops can only bid it down."
- **Deal:** the header shows `RL-` plus the first five uppercase order-id characters (the full id stays in API calls/links). No checkout-choices metadata line. The live message uses only bid, ask, round and award notes; errors and terminal markers never replace it.
- **Deal (v3 view):** sticky header with round dots, clock, the big total counting down at each round, a "less" chip, the hold line, and one live message line. One card per item with a lane per eligible shop: marker position by price, leader in berry, new bid flash, Pass state, perk chips (butter for shopper-permitted terms: Older packaging, Bundle; mint for gifts: Sample kit, Ships free in Korea). At award: winning lane mint, others dimmed, item pill "Won by <shop>", saving vs best listed. Then "Your box" (per shop: items, perks, amount; "Outbid" for shops that won nothing), "See your order", "Watch the bidding again".
- **Desktop ≥ 1100 px:** the two-column bidding board from the design (total and feed left, 2×2 item grid right). This is the layout for the video.
- **Paid:** each line shows the winning shop, older packaging / bundle tags, struck best-listed price; hold / charged / released strip as today.
- **Rally for shops:** the shop's order view shows the same lanes from its side, plus its private floor line on each lane (only for that shop) and its result: won items and payout, or outbid.
- Reduced motion: every state appears without sliding. Contrast ≥ 4.5:1, targets ≥ 44 px, as today. Copy rules from AGENTS.md apply (no "demo", "simulated", etc.).

## Benchmark

Add strategy **E: shop bidding** to `sim/benchmark.py`. Report per currency A (listed exact sourcing), D (current exchange), E (auction), and invariants: `charge_above_hold == 0`, `shop_below_authority == 0`, `bundle_split_violations == 0`. Fixture run is committed; the connected run (Bitdeer, no payments, cached by prompt hash) is the evidence for the README and video.

## Milestones (submission Nov 12, 12:00 PT)

- **B0 · Oct 31** — Bitdeer adapter settings and model check pass (owner supplies key). Existing Rally deploy (G3) can proceed in parallel on `rally`.
- **B1 · Nov 3** — Auction engine, award search, schemas, fixture golden tests for all five currencies. Exchange engine kept behind `RALLY_DEAL_MODE=exchange`.
- **B2 · Nov 5** — Worker integration, v3 events, final terms, payout domestic fix, Deal v3 phone + desktop, Paid, Bag, shop workspace view. Browser tests updated.
- **B3 · Nov 7** — Channel3 snapshot + market range on item cards and in agent payloads; connected benchmark E with Bitdeer.
- **B4 · Nov 9** — Hosted run on Render with a human PayPal sandbox approval (USD, then CAD); evidence in EVIDENCE.md; video capture.
- **Freeze · Nov 10.**

## Out of scope

Real shops or real brand names (video rules forbid unlicensed trademarks, and simulated agents must not speak for real merchants). Group buying. Sealed bids. Live Channel3 calls in the deal path. Tavily. New services or Render resources.

## Risks

- **Model latency.** A failed, timed-out or invalid selection falls back to code's best-ranked valid bid; the buyer falls back to the top asks and code's round note. The auction still ends on time.
- **Bitdeer structured output.** `json_object` fallback plus pydantic validation; invalid output counts as a failed call.
- **Combinatorics.** Bundles limited to two items per shop and one bundle per shop per round.
- **Existing tests assume the old rules keys.** Update them deliberately; keep the exchange engine's own tests under `RALLY_DEAL_MODE=exchange`.
