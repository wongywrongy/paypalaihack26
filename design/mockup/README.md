# Rally mockup (version 2)

Reference screens for the design track, exported from the mockup canvas on Oct 22, 2026. They set the flow, copy, hierarchy and numbers. The build should look better than this, not identical.

![Shopper flow: shop, ship to, ask Rally, bag, the deal live, deal done, paid, track](flow.png)

- `screens/*.png`: renders at 2x (shopper screens 390 px wide, Rally for shops 1280 px wide).
- `html/*.html`: static HTML for each screen; open `html/index.html`. Fonts load from Google Fonts. The live deal is interactive only on the canvas; here it is two stills (`4-deal-live` at 0:09, `4b-deal-done` at 0:14).
- `html/img/*.svg`: fallback product illustrations. Replace them with real product imagery (PLAN.md, "Design direction").
- Every number and every deal message comes from `design/scenario/seoul.py` (output: `design/scenario/scenario.json`, `hero.events` for the live deal).
- The copy is product copy. Keep it real: no "Example", "preview", "fixture", "simulated" or "demo" in the UI. The only sandbox marker is the "Test mode" pill.
- There are no explainer pages in the product. The deal is shown while it happens; proof for judges (decision rights, scorecard, benchmark) goes in the README, Devpost text and video.

| Screen | File | Who sees it |
| --- | --- | --- |
| 1 · Shop | `1-shop` | Shopper |
| 1b · Ship to (sheet) | `1b-ship-to` | Shopper |
| 2 · Ask Rally | `2-ask-rally` | Shopper |
| 3 · Bag and checkout | `3-bag` | Shopper |
| 4 · The deal, live | `4-deal-live` | Shopper, right after PayPal approves |
| 4b · Deal done | `4b-deal-done` | Shopper; also opened from Paid ("Watch how Rally got this price") |
| 5 · Paid | `5-paid` | Shopper |
| 6 · Track | `6-track` | Shopper |
| Rally for shops · Orders | `shops-orders` | Shop (lowest prices and costs are private to the shop) |

Shops, brands and products are fictional. The retired group-order mockup is in git history before commit `0576a61`.
