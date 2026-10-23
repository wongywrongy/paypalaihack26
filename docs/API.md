# Rally API

The generated `/openapi.json` is authoritative. All money is integer minor units plus explicit currency. This is one same-origin FastAPI application serving the built React app; no new microservices.

Call `GET /api/session` first to establish an HttpOnly cookie and receive its CSRF token. Mutations require that cookie plus `X-CSRF-Token`; a supplied Origin must match `PUBLIC_URL`. Never put tokens in share links. Shopper order/bag IDs are always checked against the server session.

| Routes | Behavior |
| --- | --- |
| GET /api/countries, /api/catalog?country=US | Public catalog, availability and dated complete scenario assumptions; no private policy |
| POST /api/assist, /api/quotes | Catalog-only routine or transient exact quote; text/country/items/rules validated |
| POST /api/bags, PATCH /api/bags/{id}, GET /api/bags/{id}/quote | Owned bag and immutable quote versions |
| POST /api/bags/{id}/checkout | Body `{quote_id}`; binds consent, reserves stock and creates idempotent PayPal order |
| POST /api/bags/{id}/checkout/approve | Body `{order_id}` (PayPal ID); provider verification/authorization, then durable negotiation job |
| GET /api/orders, /api/orders/{id} | Owned persistent history, exact receipt, independent payment and fulfillment status |
| GET /api/orders/{id}/deal, /api/orders/{id}/deal/stream | Persisted events; SSE event `deal`, numeric sequence ID, `after`/Last-Event-ID resume |
| POST /api/orders/{id}/cancel | Cancel pre-capture; confirmed authorization uses ledger void; ambiguous outcomes block release |
| POST /api/reset | Resets client shopping state; preserves purchases and receipts |
| POST /api/login, /api/logout | Rotate credentials while preserving owned order identity; rate-limited shop/hub login |
| GET /api/shops/{id}/products, /orders, /settings | Shop scope; only own floor/cost/stock and deals; judge read-only |
| PATCH /api/shops/{id}/settings | Permitted discount/sample policy; private writer credential required |
| POST /api/shops/{id}/orders/{order}/handoff | `{carrier,tracking}`; immutable arrival, confirmed funding, enqueues one payout |
| GET /api/hub/orders, /api/hub/recovery | Hub-only order/recovery metadata, never credentials/raw provider bodies |
| POST /api/hub/orders/{id}/ship, /true-up, /delivered | Hub-only export, `{actual_minor}` import adjustment, and independent delivery |
| POST /api/hub/recovery/{request_id}/reconcile | GET-only provider reconciliation of a saved logical operation |
| POST /api/hub/jobs/{id}/resume | Resume saved recovery job using its original keys |
| GET /api/purchases, /api/legacy/purchases | Original-cookie owned historical Coalition receipts |
| GET /api/hub/legacy/recovery | Read-only original-ledger unresolved metadata |
| POST /api/paypal/webhook | Persist original bytes before acknowledgement; verify signature and reconcile in worker |
| GET /api/health | Application health, `app: rally` |

409 means changed/expired consent, incompatible state or unresolved payment; 403 means CSRF/scope/read-only failure; provider failures return sanitized errors. Unknown provider outcomes never become success from a callback or model response. Retired Coalition checkout endpoints return 410.

See [architecture](ARCHITECTURE.md), [demo](DEMO.md) and [executed evidence](../EVIDENCE.md).
