# Coalition API

FastAPI's `/openapi.json` is the executable schema. Money uses integer USD minor units and timestamps are UTC.

Buyer commands require an owned HttpOnly session, exact allowed origin and `X-Coalition-Request: 1`. IDs and run links do not grant access to someone else's receipt. Operator commands additionally require `X-Operator-Token`.

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | Public configuration/disclosures, without secrets |
| `POST /api/session` | Restore/create run-owned buyer; optional protected preparation invite; `shopping:true` selects a headphone run instead of a restored legacy run |
| `GET /api/catalog` | Fictional products; private policies excluded |
| `POST /api/requests` | `{raw_text, edits?}` creates a version and durable matching job |
| `GET /api/journey` | Owned request, assessments, safe rounds, quote and verified progress |
| `GET /api/purchases` | Latest purchase per group for the authenticated owner across runs; no other buyer’s records |
| `POST /api/negotiations` | `{product_id}` queues a bounded attempt for the run |
| `POST /api/opportunity` | Validates merchant-widget product context against accepted quote |
| `GET /api/status` | Buyer-owned commitment, immutable terms and provider evidence; 409 before a quote exists |
| `POST /api/commitments` | Exact context/terms consent; reserves an expiring slot and queues order creation |
| `POST /api/commitments/{id}/authorize` | Owned recorded order only; queues provider authorization |
| `POST /api/commitments/{id}/leave` | Withdraw before closure; queues safe unwind |
| `POST /api/paypal/webhook` | Durable inbox; signature verification and processing are asynchronous |
| `POST /api/operator/runs` | `{scenario, demo, profile, close_seconds}`; default small/600 seconds |
| `GET /api/operator/runs/{id}` | Protected jobs, negotiation attempts and payment evidence |
| `POST /api/operator/runs/{id}/activate` | Activates preparations, retaining tiered quote deadline |
| `POST /api/operator/runs/{id}/cleanup` | Unwind an open run; preserves unresolved records |
| `POST /api/operator/runs/{id}/refund-cleanup` | Explicit refund cleanup after a sandbox success |
| `POST /api/operator/jobs/{id}/retry` | Retry unresolved durable work with original operation identity |

Explicit request edits contain `max_total_minor`, `latest_arrival` (ISO date in UTC), `required_features`, `device` and `flexibility`. Unknown mandatory assessments block checkout. Constraint edits cannot modify an active approved agreement.

Accepted quote terms include immutable version, product/variant, sandbox payee, maximum total, `tier_schedule`, minimum/capacity, delivery date, closing time and reservation expiry. A settlement snapshot freezes member IDs, quote version and selected cents per buyer. Commitment `amount_minor` remains the approved maximum; `settlement_minor`, `authorized_minor`, `captured_minor` and `refunded_minor` have separate meanings.

Poll active work approximately every two seconds. Terminal views back off. Payment success requires every selected capture to be confirmed; pending approval, an authorization threshold or application timer is never provider evidence.
