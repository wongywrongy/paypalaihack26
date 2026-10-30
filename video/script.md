# Rally video narration

Generated from src/timeline.ts: edit cues and timings there. {name} is filled from the run data.

## problem (0s to 12s, impact)

- 00:00 Buying from three Korean shops means three checkouts, three parcels and three customs bills.
- 00:06 Many shops never ship abroad, and import fees can now surprise you at the door.

## title (12s to 18s, presentation)

- 00:12 Rally makes Korean shops compete for your order. One box, your currency.

## shop (18s to 48s, innovation, design)

- 00:18 This is Rally for shops. Every shop starts with a five-step setup guide.
- 00:25 The owner edits a product's lowest price in the listings grid, built on AG Grid.
- 00:31 That lowest price stays private. It is never sent to any model.
- 00:36 Then they tell the shop's agent what they want, in plain words.
- 00:42 A model compiles it into bounded rules. Nothing changes until the owner presses Apply.

## shopper (48s to 66s, design, PayPal)

- 00:48 Now the shopper. They open the storefront and add {items}.
- 00:54 The total is all-in: shipping, duty and tax, in their own currency.
- 00:59 They approve {held} themselves in PayPal sandbox. No agent can give that consent.

## bidding (66s to 106s, innovation, tech)

- 01:06 Every shop that stocks an item now bids for it, over {rounds} open rounds.
- 01:13 Each round, a buyer agent asks for better terms and {shop_count} shop agents answer.
- 01:20 Models choose among code-built options. Code awards the order.
- 01:27 A shop can win on price, a bundle, free shipping in Korea or older packaging.
- 01:34 Code checks every bid against the shop's private floor, live stock and the hold.
- 01:40 {result_line}

## money (106s to 128s, PayPal, impact)

- 01:46 The worker captures {charged}, never more than the hold.
- 01:50 The other {released} is left uncaptured, and the bank releases it on its own timing.
- 01:55 {shop_result}
- 02:00 That hand-off sends {payout_shop} a {payout} PayPal payout.
- 02:04 The shops and parcels are fictional. The payout is real sandbox test money.

## hood (128s to 153s, tech)

- 02:08 A PayPal approval becomes an Orders v2 authorization, handled by our FastAPI service.
- 02:14 A worker runs the auction, with every PayPal step in an idempotent PostgreSQL ledger.
- 02:20 Bitdeer models pick only candidate indexes. Code builds the options and makes the award.
- 02:26 Capture stays within the hold, Payouts pay the shops, and verified webhooks reconcile.
- 02:30 Models propose. Code decides. PayPal moves the money.

## close (153s to 170s, impact, presentation)

- 02:33 Korean cosmetics exports reached $11.4B in 2025, and small shops are moving online.
- 02:39 Rally works for any multi-merchant, cross-border cart.
- 02:44 Rally. Korean skincare, one box, your currency. The code is public and MIT licensed.
