# Coalition API

The running FastAPI `/docs` and `/openapi.json` describe request schemas. Integer USD cents, UUID references, UTC timestamps. Every write except the signed webhook needs `X-Coalition-Request: 1` and the allowed frontend `Origin`. Buyer requests use the HttpOnly session cookie. Merchant requests also require `X-Operator-Token`; never put that token in a URL or persistent browser storage.

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | Mode, available run and public SDK configuration; never secrets |
| `GET /api/catalog` | Three simulated products |
| `POST /api/session` | Restore/create buyer for ordinary `run_id`; optional operator preparation token |
| `POST /api/opportunity` | Validate product context, return exact eligible group |
| `GET /api/status` | Backend payment state, recommendation and redacted judge evidence |
| `POST /api/commitments` | Reserve five-minute slot; exact published terms and product context required |
| `POST /api/commitments/{id}/authorize` | Verify owned order reference and enqueue provider authorization |
| `POST /api/commitments/{id}/leave` | Atomically exclude while OPEN and queue cancellation |
| `POST /api/assistant` | Queue structured runtime evaluation of `request_text`; independent of checkout |
| `POST /api/paypal/webhook` | Durable signature-verification queue; only verified events affect payments |
| `GET/POST /api/operator/runs` | Protected run listing / immutable fixed offer publication (`scenario`, `demo`) |
| `GET /api/operator/runs/{id}` | Redacted payment/observation/event/job evidence |
| `POST /api/operator/runs/{id}/activate` | Start prepared demo's real 90-second group deadline |
| `POST /api/operator/runs/{id}/cancel` | Cancel while OPEN using the shared unwind workflow |
| `POST /api/operator/runs/{id}/cleanup` | Cancel OPEN or resume UNWINDING; frozen SETTLING returns 409 |
| `POST /api/operator/runs/{id}/refund-cleanup` | Explicit sandbox refund cleanup of an already successful run |
| `POST /api/operator/runs/{id}/archive` | Archive only resolved history; records remain |
| `POST /api/operator/runs/{id}/preparation-links` | Optional operator-only preparation sessions |
| `POST /api/operator/jobs/{id}/retry` | Retry exhausted job with original operation IDs; expired replay window stays blocked |
| `POST /api/operator/commitments/{id}/confirm-refund` | Verify a completed manually recovered refund's capture relationship |
| `POST /api/operator/runs/{id}/fixture-prepare` | Fixture-only simulated preparation; impossible in connected mode |
| `POST /api/operator/runs/{id}/fixture-refunds` | Fixture-only pending refund completion |

Publishing body: `{"scenario":"success","demo":false}` for the ordinary 24-hour window. `demo:true` permits preparation followed by 90-second activation. Connected scenarios: `success`, `deadline`. Fixture-only faults: `partial`, `refund_pending`.

Reserve body example (replace `accepted_terms` with the complete exact `offer` returned by status):

```json
{
  "group_id": "GROUP_UUID",
  "context": {
    "product_id": "arc-991",
    "title": "Arc 991 Scientific Calculator",
    "selected_variant": "Graphite",
    "displayed_price_minor": 8000,
    "currency": "USD",
    "quantity": 1
  },
  "accepted_terms": {}
}
```

The reservation response is not payment proof. Poll status for the server-created order. PayPal SDK approval supplies an order reference; post `{"order_id":"..."}` to authorize. The worker fetches PayPal, checks identity and immutable amounts, then records an admitted authorization only if deadline/slot/capacity allow. A 200 command response means accepted/queued, not payment success.

Errors: 401 session/signature problems, 403 CSRF/origin/merchant access, 404 wrong owner or missing reference, 409 closed group/expired slot/changed terms, 422 invalid context/body, 429 rate limit, 503 assistant unavailable. Provider errors remain visible through backend operation/payment state. A timeout or pending result does not mean a decline.
