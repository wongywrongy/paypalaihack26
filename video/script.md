# Rally video narration

Generated from src/timeline.ts: edit cues and timings there. {name} is filled from the run data.

## problem (0s to 12s, impact)

- 00:00 Three Korean shops means three checkouts, three parcels and three customs bills.
- 00:07 Many shops never ship abroad, and import fees can surprise you at the door.

## title (12s to 18s, presentation)

- 00:12 Rally turns them into one checkout. Korean shops compete for your order.

## shop (18s to 48s, innovation, design)

- 00:18 I'm Haneul Beauty, a Seoul shop. Rally walks me through five steps to my first payout.
- 00:25 In Products, an AG Grid sheet, I edit my lowest price and save.
- 00:31 My lowest price is private: no shopper, shop or model sees it.
- 00:36 On Agent, I say what I want in plain words and press Review rules.
- 00:42 A model writes bounded rules, marked From your goal. Nothing applies until I press Apply.

## shopper (48s to 66s, design, PayPal)

- 00:48 I press Open your storefront. Now I am the shopper, with {item_count} in my bag.
- 00:54 One price for everything, delivered, duties included.
- 00:59 PayPal holds {held}. That total is the ceiling. The agents can only bid it down.

## bidding (66s to 106s, innovation, tech)

- 01:06 Every shop that stocks an item now bids for it, over {rounds} open rounds.
- 01:13 Each round, a buyer agent asks for better terms and {shop_count} shop agents answer.
- 01:20 Models choose among code-built options. Code awards the order.
- 01:27 A shop can win on price, a bundle, free shipping in Korea or older packaging.
- 01:34 Code checks every bid against each shop's private limits, live stock and the hold.
- 01:40 {result_line}

## money (106s to 128s, PayPal, impact)

- 01:46 {capture_line}
- 01:50 {receipt_line}
- 01:55 {shop_result}
- 01:59 PayPal pays {payout_shop} {payout}.
- 02:04 Price, goal, order, hand-off, payout. That's the whole loop.

## hood (128s to 153s, tech)

- 02:08 A PayPal approval becomes an Orders v2 authorization in FastAPI.
- 02:13 A worker runs the auction, with every PayPal step in an idempotent ledger.
- 02:19 Bitdeer models pick only candidate indexes. Code makes the award.
- 02:24 Capture stays within the hold, Payouts pay shops, webhooks reconcile.
- 02:29 Models propose. Code decides. PayPal moves the money.

## close (153s to 170s, impact, presentation)

- 02:33 Korean cosmetics exports hit a record, and small shops are moving online.
- 02:39 Rally works for any multi-merchant, cross-border cart.
- 02:44 Rally. Korean skincare, one box, your currency. Open source, MIT licensed.
