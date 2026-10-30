# Connected-contract screenshots — October 23, 2026

These are actual rendered React journeys against the local FastAPI application and PostgreSQL, **without intercepted API responses**. The SDK, PayPal provider and model are controlled doubles; these images do not prove genuine sandbox payments or live model decisions. Fictional fulfillment was recorded separately. Product images were eagerly loaded/decoded and fonts ready before capture.

| Surface | Desktop | Mobile |
| --- | --- | --- |
| Discovery | [Catalog](desktop-shop.png) | — |
| Checkout | [Bag](desktop-bag.png) | [CAD bag](mobile-bag.png) |
| Exchange | [Paused replay of persisted offers](desktop-deal-active-replay.png) | — |
| Agreement | [Completed negotiated terms](desktop-deal.png) | — |
| Receipt | — | [CAD paid order](mobile-paid.png) |
| Tracking | [Independent shipment state](desktop-tracking.png) | — |

The exchange frame is honestly marked replay, not a claim that a provider negotiation was running at capture time. Saved US order `d4390bf6-9ca8-48f6-8e17-ee5f38dae2de` held 11882 and captured 10679 minor units; CAD order `4702b7f5-0120-4b4c-8c0d-08534a8d7c14` held 16087 and captured 14449. The corrected active-replay frame uses a separate USD order `6536241b-b1d2-4264-b33a-722d8418896a` with the same 11882/10679 schedule. Replay did not change any capture. These disposable fixture orders are separate from the genuine G1 IDs in EVIDENCE.md.

Native screen-reader speech, physical touch devices and genuine hosted-provider flows are not covered by these captures.
