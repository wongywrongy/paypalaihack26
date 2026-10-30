# Rally v4: a live marketplace, not a scripted demo

Owner-approved October 29, 2026. Builds on v3 shop bidding (docs/plan/BIDDING.md); where they disagree, this file wins. No new services, vendors or dependencies: PayPal sandbox, Bitdeer AI, Channel3, PostgreSQL, Render and AG Grid only.

## What is still scripted today

| Part | Today | Why it reads as a demo |
| --- | --- | --- |
| Shop listings | Seeded once from scenario.json; the products grid is read-only | Nobody can change a price, so every auction looks the same |
| Shop strategy | `discount_bp` and `sample_kit` plus hard-coded `PUBLIC_GOALS` | Shop agents have no owner and no intent anyone set |
| Shop agents | Stateless per order | They never react to winning or losing |
| Market prices | One committed Channel3 snapshot | Never refreshes |
| Merchant access | Judges get a read-only login | Judges can watch the shop side but never act on it |
| Fulfillment | Shop handoffs need private writer passwords | The real PayPal payout is never seen by a judge |

The auction itself and the routine assistant already call Bitdeer live, with code fallback. Keep that.

## The product after v4

Rally is a two-sided marketplace. Shoppers buy; three Korean shops (still fictional) run their storefronts in **Rally for shops**: they edit listings, tell their agent what they want in plain words, watch their agent bid live, hand off parcels, and get paid by real PayPal sandbox payouts. A judge can play both sides in two tabs and see their own change move the next auction.

## Workstreams

### L1 · Editable listings (AG Grid)

- Rally for shops → Products becomes an editable AG Grid: list price, lowest price (floor), stock, and older-packaging stock where the shop has it. Cost stays read-only (it anchors the floor).
- `PATCH /api/shops/{shop}/products/{offer_id}` with `{list_usd, floor_usd, stock, version}`. Writer sessions only, CSRF as today, optimistic concurrency (`version`), integer cents.
- Code bounds: `cost ≤ floor ≤ list`; list within 50–150% of the seeded list; stock 0–500. Rejections return a clear field message shown inline in the grid.
- New table `listing_changes` (who, when, offer, before, after) and a "Recent changes" panel. Quotes and auctions read the new values immediately; existing quotes and orders keep their frozen terms.
- "Reset to launch settings" per shop restores seeded values (audited).

### L2 · Merchant goals in plain language

- Rally for shops → Agent: a text box ("Clear my older snail essence this month, never below $15, happy to bundle"). Bitdeer (buyer-independent shop model) compiles it into a bounded `ShopStrategy`:
  `{max_round_discount_bp 0–2000, min_margin_over_floor_cents ≥ 0, prefer_older bool, bundles: off|allow|prefer, free_domestic: never|to_win|always, kit: bool}` plus a one-line summary.
- The merchant sees the compiled rules next to their words and presses **Apply**. Nothing applies without it. Code validates every field; the text is never executed or forwarded as an instruction.
- `bids.candidates` reads the strategy (discount steps, bundle preference, free-shipping willingness, older-stock priority). Floors from L1 always win. The shop model's payload carries the goal text and summary, never floors or costs.
- Store in `shop_policies.policy` (goal_text, strategy, applied_at, applied_by). Replace `PUBLIC_GOALS` with this; keep current values as the launch defaults.

### L3 · Agents with memory

- `shop_agent_memory` view (or table refreshed after each award): per shop, the last 20 auctions it joined: items, its final bid, the winner, the winning complete total, margin over floor, and which perk decided it.
- Each round's shop payload adds a short public summary: "Last 20: won 6 of 14 items; lost 3 to bundles; average margin over floor $2.10." The model may adapt within the strategy; code bounds are unchanged.
- Rally for shops → Activity: one row per auction (time, items, its bids, result, payout status) with the deciding reason ("Lost Cica Barrier Cream to Haneul's bundle by $1.07 all in").

### L4 · Live market reference

- Table `market_references(product_id, low, median, high, n, as_of)` plus a daily refresh job on the existing maintenance lane when `CHANNEL3_API_KEY` is set; fall back to the committed snapshot.
- Show only the median ("Typical US price $24"), and only when `n ≥ 5` and `high ≤ 2.5 × low`. Hide it otherwise. The agents get the same filtered reference.

### L5 · Real inventory consequences

- Captured orders consume stock (already via reservations); older-packaging stock runs out for real; out-of-stock offers leave the auction and the shop grid shows low stock.
- Shop catalog cards show "Only 3 left at Dalbit" from live stock, not seeded text.

### L6 · Judges can act as a merchant

- New judge writer role for **one shop** (Haneul Beauty): `RALLY_JUDGE_WRITER_PASSWORD`. It can edit Haneul listings and goals, see Activity, and record Haneul's parcel handoff (which sends a real sandbox payout). It cannot touch other shops, the hub, payments or recovery.
- Rate limit writes (e.g. 30 per 10 minutes per session). Edits are audited and resettable.
- Bada and Dalbit stay read-only to judges. The hub keeps its private password; `RALLY_AUTO_FULFILLMENT=1` advances hub steps after all shops hand off (still simulated logistics, disclosed in README).

### L7 · Remove demo crutches from the product path

- Production never reads design/scenario/auction.json or recorded events; "Watch the bidding again" replays the order's own saved events (already true; add a test).
- Bag lines stop naming a shop before bidding ("Best listed $21 · 3 shops bid").
- Shop home shows live marketplace facts from the database only when meaningful (≥ 10 completed orders): orders bid on, median saving vs hold. Otherwise nothing; no invented numbers.
- Recorded review harness stays test-only and is not linked anywhere.

## Bounds that do not change

LLM never accepts, never sees floors or costs, never moves money. Every PayPal mutation goes through the ledger with an idempotency key. Capture ≤ hold. Fictional shops and brands only. No new services or resources.

## Verification

- Backend contracts: listing edit bounds and concurrency; reset; strategy compile/validate/apply (malicious goal text cannot raise authority or leak floors); strategy changes the generated candidates; memory summary contents; market filter; judge writer scope (cannot write other shops, hub, recovery); rate limit.
- An end-to-end contract: edit Haneul's cream floor and goals → a new order's auction reflects them → capture ≤ hold → Haneul handoff → payout job queued with the right amount.
- Browser: editable grid (keyboard, validation messages), Agent goals apply flow, Activity feed, judge writer limits, reduced motion, 390/1440 px.
- Connected (owner env): one hosted run where a judge-style edit visibly changes the next auction; record in EVIDENCE.md.

## Milestones

- **L1 + L6 · Nov 2.** Editable listings, judge writer, reset, audit.
- **L2 + L3 · Nov 5.** Goals → strategy, memory, Activity.
- **L4 + L5 + L7 · Nov 7.** Market refresh and filter, live stock, crutch removal.
- **Hosted run + video capture · Nov 9.** Freeze Nov 10.
