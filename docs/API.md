# Coalition API

FastAPI's `/openapi.json` is the executable schema. Money uses integer USD minor units and timestamps are UTC.

Buyer commands require an owned HttpOnly session, exact allowed origin and `X-Coalition-Request: 1`. IDs and run links do not grant access to someone else's receipt. Operator commands additionally require `X-Operator-Token`.

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | Public configuration/disclosures, without secrets |
| `POST /api/session` | Restore/create shopper identity; optional owned `run_id` or protected preparation invite; `shopping:true` creates an independent draft; `new_deal:true` starts/reuses another draft |
| `GET /api/catalog` | Six real-model headphone products with simulated offers; retired models and private policies excluded |
| `POST /api/requests` | `{raw_text, edits?}` creates an owner-scoped version and durable matching job; identical active work is reused |
| `GET /api/journey` | Owned request, assessments, safe rounds, quote and verified progress |
| `GET /api/purchases` | Latest purchase per group for the authenticated owner across runs; no other buyer’s records |
| `POST /api/negotiations` | `{product_id}` matches a compatible open shopping group or queues a bounded draft; returns the selected `run_id` |
| `GET /api/status` | Buyer-owned commitment, immutable terms and provider evidence; 409 before a quote exists |
| `POST /api/commitments` | Exact context/terms consent; reserves an expiring slot and queues order creation; returns only `{id, amount_minor, currency}` |
| `POST /api/commitments/{id}/authorize` | Owned recorded order only; queues provider authorization |
| `POST /api/commitments/{id}/leave` | Withdraw before closure; queues safe unwind |
| `POST /api/paypal/webhook` | Verifies the app signature, persists original bytes and verified event durably before HTTP 200, then queues asynchronous processing |
| `POST /api/operator/runs` | `{scenario, demo, profile:"small", close_seconds}`; only five-person headphone preparation, default 600 seconds |
| `GET /api/operator/runs/{id}` | Protected jobs, negotiation attempts and payment evidence |
| `POST /api/operator/runs/{id}/activate` | Activates preparations, retaining tiered quote deadline |
| `POST /api/operator/runs/{id}/cleanup` | Unwind an open run; preserves unresolved records |
| `POST /api/operator/runs/{id}/refund-cleanup` | Explicit refund cleanup after a sandbox success |
| `POST /api/operator/jobs/{id}/retry` | Retry unresolved durable work with original operation identity |

Buyer API reads/mutations accept `?run=UUID` to select an **owned** buyer row without changing another tab’s selected checkout. The cookie identifies its owner independently of that group.

Matching statuses include `queued`, `running`, `clarification`, `completed`, `failed`, and `superseded`. `error_kind` distinguishes missing information, unsupported requirements, no matching products, provider failure and invalid model output. Clarification preserves raw text and completed answers; `clarification.fields` and `question` identify the next answer. Journey `availability` is `draft`, `open`, `unavailable`, `closed`, `canceled`, or `settled`.

Explicit request edits contain `max_total_minor`, `latest_arrival` (ISO date in UTC), `required_features`, `device` and `flexibility`. Budget and arrival can be null until clarification completes. Unknown mandatory assessments block checkout; evidence must support the specific requirement, and prices come from that product’s merchant policy. Constraint edits cannot modify an active approved agreement.

Accepted quote terms include immutable version, product/variant, sandbox payee, maximum total, `tier_schedule`, minimum/capacity, delivery date, closing time and reservation expiry. A settlement snapshot freezes member IDs, quote version and selected cents per buyer. Commitment `amount_minor` remains the approved maximum; `settlement_minor`, `authorized_minor`, `captured_minor` and `refunded_minor` have separate meanings.

Poll active work approximately every two seconds. Terminal views back off. Payment success requires every selected capture to be confirmed; pending approval, an authorization threshold or application timer is never provider evidence.

Protected preparation invitations use URL fragments (`#invite=…`), then are removed after session creation. Access logging and referrers are disabled to protect approval/invitation tokens; verified payer identities never enter buyer responses. Operator evidence includes matching and negotiation jobs alongside payment/deadline jobs.

The retired merchant-widget opportunity and optional calculator-assistant creation endpoints are absent. Historic calculator/large purchases retain owned status and recovery. New legacy/large run preparation returns 422.
