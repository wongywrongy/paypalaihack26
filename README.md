# Coalition

Coalition is a merchant-installed conditional group-buy widget on **Commonplace Supply**, an original fictional participating supplier. One exact Arc 991 calculator in Graphite costs an ordinary **$80 demo price** or **$65 per buyer** when exactly five approved buyers join. Shipping is included; tax is explicitly simulated at $0. Five simulated units are reserved before each fixed offer version is published.

**Simulated merchant and buyers; real PayPal sandbox operations; live AI recommendations** describes connected mode only. Fixture mode labels its payments and recommendations as simulated. Prices, inventory, tax, product/course attributes and fulfillment are simulated in both modes. A sandbox purchase does not ship a physical product.

No Amazon integration, novelty claim, atomic payment guarantee, guaranteed savings, escrow, pooled wallet, split payout, tiers, fees, subscriptions, or production-readiness claim is made. Configuring this one sandbox business account is not a production marketplace integration. Each future merchant needs its own payment onboarding.

## Current state and verification

This implementation reuses the existing React storefront, PayPal REST adapter, PostgreSQL jobs and original SVG product assets. It adds expiring checkout reservations, transactionally admitted commitments, frozen membership, withdrawal, immutable offer versions, SQLAlchemy connections, Alembic migrations, separate merchant attention flags, timestamp preflight, natural-language needs evaluation and evidence provenance.

The environment inspected on 2026-10-06 has **no PayPal or model credentials**. No genuine PayPal create, authorize, capture, void, refund, webhook or live-model result was fabricated. See [VERIFICATION.md](VERIFICATION.md) for actual executed checks and outstanding external acceptance gates. Render deployment has not been performed.

## Local setup

Requirements: Python 3.12+, Node 22+, Docker with Compose, and a persistent PostgreSQL 16 database. Keep the database volume; never delete unresolved payment history to reset a demo.

```bash
cp .env.example .env
# Set OPERATOR_TOKEN to a long random private value; keep .env out of source control.
# Fixture mode is explicitly simulated. Connected mode never falls back to fixtures.
docker compose up --build
```

Open `http://localhost:8000` and `/merchant` (the existing `/operator` alias also works). Publish a fixed offer in merchant controls. The ordinary supplier page is the complete buyer entry point; copy its `/?run=<run UUID>` offer URL for a class or club. Buyer preparation links belong only to the optional operator preparation process.

Without containerized application services:

```bash
docker compose up -d postgres
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci --prefix frontend
# Load the local .env you control, e.g. set -a; source .env; set +a
PYTHONPATH=backend .venv/bin/python -m coalition.db
PYTHONPATH=backend .venv/bin/uvicorn coalition.main:app --host 127.0.0.1 --port 8000
# In another terminal with the same environment:
PYTHONPATH=backend .venv/bin/python -m coalition.worker
# In another terminal:
npm run dev --prefix frontend
```

For Vite, use `PUBLIC_URL=http://localhost:5173`. For Docker's integrated static frontend, use `PUBLIC_URL=http://localhost:8000`. The seed command applies migrations and inserts exactly three catalog products; it does not approve buyers or create holds. Publish creates a distinct immutable offer and distinct simulated inventory batch for each run. Normal offers start a real 24-hour window. Demo preparation expires after 30 minutes; activation starts a real 90-second group deadline. Neither clock alters PayPal authorization timestamps.

`python scripts/serve_local.py` retains the optional existing Tailscale Serve workflow. A private tailnet address alone is insufficient for public PayPal webhook delivery.

## Credentials and connection boundaries

| Variable | Purpose |
|---|---|
| `COALITION_MODE` | `fixture` or `connected`, isolated per run and job |
| `DATABASE_URL` | PostgreSQL URL shared by API and worker |
| `PUBLIC_URL` | Exact supplier frontend origin, approval return URL and CORS/CSRF allowlist |
| `OPERATOR_TOKEN` | Protected merchant/admin access; kept in browser memory only |
| `PAYPAL_CLIENT_ID` | Sandbox REST app client ID; public SDK identifier |
| `PAYPAL_CLIENT_SECRET` | Server-only sandbox REST app secret |
| `PAYPAL_MERCHANT_ID` | Sandbox business account merchant ID, verified against provider payee |
| `PAYPAL_WEBHOOK_ID` | Webhook registered on the same sandbox REST app |
| `LLM_API_KEY` | Server-only Anthropic API key |
| `LLM_MODEL`, `LLM_BASE_URL` | One configurable model adapter; default Anthropic Messages API |
| `PAYPAL_PAYMENTS_RETRY_HOURS` | Verified Payments v2 replay retention; default `0` means reconcile, then review unknown capture/refund POSTs |
| `VITE_API_URL` | Static frontend's public API origin; empty for local same-origin proxy |

Currently missing: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID`, `LLM_API_KEY`. Connected checkout needs the PayPal values. Missing AI configuration makes only the assistant unavailable. Five separate sandbox buyer account logins and actual buyer approvals are also required for success. Creating an account does not authorize an agent to spend from it.

Only the public client ID reaches the browser. REST secrets and model keys remain server-side. Model calls receive offer data and buyer requirements, never payment credentials or executable payment tools. Catalog and buyer text are treated as untrusted data. Buyer commands require session ownership and a custom CSRF request header, with exact origin validation and restrictive CORS. Session cookies are HttpOnly, secure on HTTPS, and expire after one day. Write commands have PostgreSQL-backed per-session/IP rate limits; there is no Redis. Deployment must preserve legitimate proxy/client identity and add edge abuse limits before public production exposure.

## Small architecture

Frontend: React, TypeScript, Vite, Tailwind and an adapted Magic UI NumberTicker used only for confirmed commitment changes. Static USD totals never animate. The page has normal simulated purchase controls beside the Coalition offer. One sheet reviews terms, displays PayPal approval and persists backend-derived status across refresh. Polling uses two seconds during active workflows, thirty seconds for terminal groups. Keyboard controls, reduced motion and a mobile bottom sheet are included.

Backend: FastAPI/Pydantic, SQLAlchemy-managed connections with explicit existing PostgreSQL SQL, and Alembic versioned migrations. Modules: `offers`, `groups`, `payments`, `assistant`, `demo` and protected commands in `main`. The API validates and queues commands; one persistent Python worker handles settlement, compensation, deadlines, webhooks and reconciliation. No ORM duplication, provider framework, Redis, Celery, event broker or separate agent platform is introduced.

Tables include products, immutable offers, explicit runs/buyers/sessions, groups, commitments, payment_operations, webhook_events, jobs, ai_decisions, payment_observations and rate_limits. Money is integer cents. Timestamps are UTC. Unique indexes protect logical operations, provider IDs, event receipts, active buyer participation and one active group per new immutable offer. Migration 001 adopts the existing schema without dropping history; migration 002 marks old groups as legacy so preexisting fixture runs remain reviewable. New groups use the new uniqueness rules. Migration downgrade refuses destructive removal of financial history.

PostgreSQL owns workflow state; PayPal owns payment truth. All admission, closure, deadline and withdrawal commands lock the same group row. Locks are released before external calls. An authorization arriving after closure, withdrawal or its five-minute slot reservation is stored, excluded, and scheduled for void. Payer checks prevent one PayPal payer being admitted twice. Reservations never count as buyers. The fifth admitted authorization freezes five members and queues settlement in the same transaction. Prepared demo commitments freeze only when the operator activates the run.

The worker claims durable jobs with leases, reclaiming expired leases after crashes. Every external mutation has a persisted logical operation and stable UUID request key before dispatch. Reconciliation fetches current resources and uses the same observation/admission functions as authenticated API results and verified webhooks. Unknown captures cannot be interpreted as declines or retried under a new key. Operations also have short leases to prevent concurrent dispatch. Run exactly one persistent worker as configured; horizontal worker scaling is outside this MVP.

## Workflow and recovery

| Group state | Meaning |
|---|---|
| `OPEN` | Buyers can reserve, authorize or leave; demo preparation is an explicit activation flag |
| `SETTLING` | Five admitted members frozen; participation locked |
| `SUCCEEDED` | Five completed captures; release for simulated fulfillment |
| `UNWINDING` | Refund completed captures; void remaining authorizations; reconcile ambiguity |
| `FAILED` | All payment obligations resolved, allowing inventory release |

`needs_attention` is separate from state. Payment authorization/capture/refund/void statuses remain separate from group state. Pending refunds or unknown captures retain `UNWINDING` and reserved inventory. Capture/refund jobs use bounded retries; pending/unknown results escalate after fifteen minutes of reconciliation. Exhausted jobs require protected merchant review. Provider reversals after `SUCCEEDED` leave that workflow state intact and flag a payment exception; initial settlement is never blindly replayed.

Before capturing, the worker verifies the frozen offer, five members, inventory, amount, currency, business merchant and current authorization resources. Real `create_time` and `expiration_time` must leave five minutes of margin inside the authorization expiry and the three-day honor window. Unknown or unsuitable timestamps prevent capture. This deliberately conservative MVP does not reauthorize old holds. All captures are exactly $65 with `final_capture: true`. Only five completed captures release simulated fulfillment.

An expired underfilled group voids eligible authorizations. A definitive settlement failure refunds completed captures in full and voids the rest. Pending/timeout responses are unresolved. Once unwinding starts, new captures are forbidden; late-discovered captures are refunded. Hold release and refund availability depend on PayPal and the buyer's bank, and are never promised to be instant.

The adapter uses direct `httpx` REST calls for Orders v2 create/authorize/status, Payments v2 authorization/capture/refund status, capture, void, refund and webhook verification. The browser SDK handles approval with `intent=authorize`; the backend confirms authorization. These choices follow [PayPal's auth/capture guide](https://developer.paypal.com/v5/checkout/auth-capture), [Payments v2](https://developer.paypal.com/api/payments/v2), [webhook documentation](https://developer.paypal.com/api/rest/webhooks/) and [idempotency reference](https://developer.paypal.com/api/rest/reference/idempotency).

Orders replay is capped conservatively at five hours against the six-hour Orders default retention. Payments v2's current schema does not specify a retention duration. Unknown capture/refund operations therefore reconcile automatically but **do not replay automatically by default**. Configure a verified retention only when established for the app/endpoints; the original UUID is always reused. Void is checked with an authoritative GET before another attempt. Local uniqueness and provider GETs remain necessary even with idempotency headers.

## Real webhook evidence

Register a **public HTTPS** `POST /api/paypal/webhook` endpoint on the same sandbox app. Subscribe to `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED` and `PAYMENT.CAPTURE.REFUND.*` event types available for your app. Record the returned webhook ID in both API and worker configuration. A webhook simulator alone cannot prove an actual app-generated payment receipt.

The endpoint durably records the payload and signature headers, deduplicates, queues verification and promptly acknowledges receipt. Unverified messages cannot change payments. The worker verifies authenticity with PayPal, then fetches current provider resources to handle stale/out-of-order events. Unknown events stay recorded without changing arbitrary commitments. Matching resource paths must be sandbox HTTPS URLs and payment IDs must correlate to one recorded commitment. Provider GET observations are tagged `webhook`, `api`, `reconciliation` or `fixture`. The sheet and merchant ledger show redacted resource IDs, source and UTC receipt timestamps; API-confirmed outcomes are never relabeled as webhook-confirmed.

For the judge demonstration, show the evidence panel before and after a genuine webhook receipt arrives; alternatively show a pending payment resolved by a verified webhook observation. Polling a verified receipt into the UI is a genuine webhook-driven UI change, even if the API already confirmed the payment. This external gate remains unverified until credentials and a public endpoint are supplied.

## Optional assistant

“Does this fit my needs?” accepts natural-language budget, delivery deadline and requirements. A real runtime call uses Anthropic's [structured output API](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) and Pydantic validation. It returns a recommendation, extracted constraints, supplied evidence, one concise explanation and at most one necessary question. Code independently checks explicit numeric budget/day expressions, amounts, eligible offer identity, availability, exact variants, required features and known course compatibility. Missing course/exam policy stays unknown. An unsupported required capability or unknown required approval cannot become an acceptance merely from a model's product-name inference.

Try `Below $70, delivery within 2 days, exact Arc 991 in Graphite.` The live model should reject seven-day delivery; code independently rejects it even if the model accepts. Try a specified course requiring exam approval: compatibility remains unknown. A model failure explicitly leaves the assistant unavailable while normal offer browsing and buyer-approved checkout remain usable. Recommendations never authorize payment. A substitute would require fresh exact-offer consent; external catalog results cannot become merchant offers automatically. Structured decisions and short explanations are logged, not hidden chain of thought.

The distribution hypothesis is a participating supplier sharing one offer with an existing class or club. The widget does not prove customer acquisition or merchant profitability. Channel3, additional sponsors and discovery are deferred because this local offer flow does not need them. PayPal is the core payment integration; Render is the hosting target. A Postman collection is included for API inspection.

## Checks, API and demo

```bash
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
# Real PostgreSQL integration (creates and drops isolated test schemas only):
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
npm run build --prefix frontend
npm run test:browser --prefix frontend
# Against a running PostgreSQL-backed fixture API + worker:
COALITION_E2E_URL=http://localhost:8000 COALITION_OPERATOR_TOKEN=<private-token> \
  npm run test:browser --prefix frontend -- --grep 'real stack'
```

Tests cover duplicate commands/events, ownership/amount/currency, capacity races, deadline/admission races, withdrawal/closure races, immutable terms/inventory, lease reclaim, duplicate capture prevention, pending/lost capture response, restart after remote success, partial capture compensation, late capture during unwind and failed/pending refunds. `tests/test_recovery.py` uses deterministic provider doubles; none of its calls are sandbox payment evidence.

Interactive API docs: `/docs`; OpenAPI: `/openapi.json`. See [docs/API.md](docs/API.md), [docs/coalition.postman_collection.json](docs/coalition.postman_collection.json) and [docs/DEMO.md](docs/DEMO.md). Read-only external proof, after both genuine scenarios and refund cleanup:

```bash
# Load connected server environment and use the same database.
PYTHONPATH=backend .venv/bin/python scripts/check_connected.py SUCCESS_RUN DEADLINE_RUN
```

This gate checks current provider resource amounts, five distinct payer captures/refunds, a separate confirmed void, genuine processed payment webhook receipts and live model acceptance/rejection. It does not approve, charge or fabricate evidence. Never archive or delete unresolved holds. Cleanup cancels open groups or resumes unwinding; it cannot interrupt frozen settlement. Retry an exhausted settlement job to reconcile its current provider truth. Records and request IDs remain available. An explicit sandbox refund-cleanup action exists for already purchased demo runs.

## Render deployment

`render.yaml` supplies a static storefront, FastAPI service, one background worker and managed PostgreSQL. Paid compute/database plans are explicit; do not assume hosting costs are free. Review [current Render Blueprint fields and plan IDs](https://render.com/docs/blueprint-spec) and pricing before deployment.

1. Create a Blueprint from this repository. API pre-deploy applies migrations and seeds the catalog. On first deployment, ensure that completes before starting the worker.
2. Configure the shared environment group with the server variables above. Set `PUBLIC_URL` to the exact storefront HTTPS origin. Set static-site `VITE_API_URL` to the public API HTTPS origin and rebuild the frontend.
3. Prefer same-site custom domains such as `shop.example.com` / `api.example.com`. Separate `*.onrender.com` origins are cross-site and browser third-party-cookie restrictions can block session cookies. CORS is configured for one exact frontend origin; never use `*` with credentials.
4. Register the public API webhook, copy its app-specific ID into the shared group, and restart both backend services. Publish a fresh offer and perform human sandbox buyer approvals.
5. Run the genuine success, deadline/void, refund and webhook/AI proof gates. Deployment configuration is supplied but has not been deployed or validated against a Render account here.

Local Docker can serve the bundled frontend through FastAPI; the Render target splits the static frontend and API. No external write or paid deployment has been performed automatically.

For a manually created Docker web service, create a separate Render Background Worker from the same repository and region. Leave Root Directory empty, use `./Dockerfile`, and override Docker Command with `python -m coalition.worker`. Copy the web service's server environment variables, including the exact same `DATABASE_URL` and `COALITION_MODE=connected`; the default Docker command only starts the website. No worker port or public URL is needed. Keep `PUBLIC_URL` set to the storefront origin on both services.

A missing `LLM_API_KEY` marks recommendations unavailable without repeatedly retrying AI jobs; payment jobs continue. Add the Anthropic key to both backend services to enable live recommendations. For AI jobs exhausted by an earlier deployment, use their protected merchant **Retry job** controls after redeploying the worker. This retains existing offers, buyers and payment records.

## Known production gaps

This is a recoverable sandbox MVP, not a production commerce service. Inventory/fulfillment/tax are simulated. Buyer identity is a session plus provider payer, not a production account system. Merchant access uses one private operator token rather than OIDC/RBAC. There is one worker; large-scale scheduling, horizontal concurrency, endpoint rate quotas, edge abuse controls, monitoring/alerting, dispute handling, retention policies, audited accounting, accessibility audit and real merchant onboarding need further work before production. The model's language extraction is probabilistic; displayed constraints and explicit buyer consent remain essential. Unknown provider results can require manual intervention rather than blind mutation replay.

The existing MIT [LICENSE](LICENSE) is retained under its existing ownership. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for assets and adapted components.
