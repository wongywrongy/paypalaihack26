# Coalition

Coalition turns headphone requirements into a compatible group purchase. Buyers review an immutable merchant quote, approve its maximum through PayPal, then receive the applicable lower tier at closing or an unwind when the group cannot complete.

**Simulated buyers and merchant offers. Live AI decisions. Real PayPal sandbox operations.** This describes connected mode only after configuration and actual execution. Fixture mode explicitly simulates AI and payments. Shipping is included, tax is simulated at $0, inventory and fulfillment are fictional, and all offers settle to one configured sandbox business account.

## Run locally

Python 3.12+, Node 22+ and PostgreSQL 16 are required. Existing dependencies and the single API/worker architecture are retained.

```bash
cp -n .env.example .env
# Configure DATABASE_URL, PUBLIC_URL and a private OPERATOR_TOKEN.
docker compose up --build
```

For a non-container development environment:

```bash
PYTHONPATH=backend .venv/bin/python -m coalition.db
PYTHONPATH=backend .venv/bin/uvicorn coalition.main:app --host 127.0.0.1 --port 8000
PYTHONPATH=backend .venv/bin/python -m coalition.worker
npm run dev --prefix frontend
```

Load your private environment into **both** API and worker. Use `PUBLIC_URL=http://localhost:5173` for Vite, or the integrated server origin for a built frontend. Do not delete database volumes or payment history to reset a demo.

Open `/` and shop directly; operator preparation is optional. A shopper cookie retains identity across selected deals and purchase history, while the URL selects a particular owned group. **Find another deal** starts/reuses a draft without moving existing commitments. Operator-prepared **small** runs provide five distinct simulated requests and protected buyer links; they never create connected authorizations. `/` is the Coalition storefront with six products visible before search, `/purchases` lists the session owner’s saved purchases, `/shop` is a compatibility link to the headphone storefront, `/checkout?run=…` is buyer-owned persistent checkout, and `/how-group-pricing-works` explains pricing. Old calculator runs retain their fixed $65 terms and settlement behavior.

The storefront folds editable requirements into a disclosure and keeps the accepted product, maximum price and group progress together. Missing budget or delivery timing opens a short clarification question and editable requirements. Unsupported requests, no matching products, provider failures and invalid model output have distinct saved states; legacy calculator quotes remain in their dedicated checkout. The active catalog uses real product photographs with manufacturer specification links. Models include Apple AirPods Max (2024 USB-C), Sony WH-CH720N, WH-CH520 and WH-1000XM5, Bose QuietComfort and QuietComfort Ultra (2nd Gen). List/group prices, merchant inventory and delivery remain simulated; these are not current brand offers or an affiliation. Photo/specification provenance is recorded in `docs/photography.json`. Retired fictional model identities and their images remain available for existing purchases.

## Model and payment configuration

The model adapter supports authenticated OpenAI-compatible `/v1/chat/completions` with `LLM_PROTOCOL=openai`. Set backend-only `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`. HTTPS is required outside localhost. Responses are validated against Pydantic schemas; provider schema constraints are used for fixed quotes. `LLM_PROTOCOL=anthropic` retains support for an Anthropic-compatible endpoint through the same adapter. There is no connected fallback to cached or fixture output.

For this GPU server, use the installed **qwen3:30b-a3b-instruct-2507-q4_K_M** with `LLM_PROTOCOL=ollama`. The model runs entirely on the RTX PRO 4000 GPU. Extraction uses a fully required provider schema with explicit nulls and grounded request-source spans, followed by local validation. Explicit numerical USD budgets are converted with Decimal; no unstated budget or arrival date is invented. Assessments use a required JSON-schema field for every product and indexed requirement; the server supplies the requirement names instead of relying on the model to copy them. Fixed negotiation proposals also use provider JSON-schema constraints. Thinking is disabled. The private `.env` is configured; API and worker must reload it to apply changes. Warm the model before a live demonstration: the observed cold load took about 47 seconds and exceeded the request timeout; an unavailable result remains visible and requires a retry.

Native Ollama does not enforce bearer authentication. The existing API provides `POST /api/model/v1/chat/completions`, authenticated with `LLM_API_KEY`, restricted to the configured model and bounded input/output. Set `OLLAMA_UPSTREAM` to the same server's native origin, `LLM_BASE_URL=http://127.0.0.1:8000/api/model` for host development, and `LLM_CONTAINER_BASE_URL=http://api:8000/api/model` for Compose's private network. The native listener must be local/private; the authenticated route does not change an existing daemon's network exposure. No daemon configuration or GPU drivers were changed. For Render, use the host gateway's HTTPS origin plus `/api/model`, the same private bearer key and `LLM_PROTOCOL=ollama`; leave `OLLAMA_UPSTREAM` empty on Render. Configure authenticated private connectivity or a restricted HTTPS gateway before deployment.

The configured Cloudflare Tunnel endpoint is `https://coalition-model.wongworks.dev/api/model`. Use it as `LLM_BASE_URL` on both Render API and worker, with the same private `LLM_API_KEY`, `LLM_PROTOCOL=ollama` and the model above. The tunnel routes only the exact `/api/model/v1/chat/completions` path; all other paths return 404. Its connector is the enabled user service `coalition-model-tunnel.service`; inspect it with `systemctl --user status coalition-model-tunnel.service`. Connector credentials live in the ignored, private `.runtime/` directory and must never be committed. The GPU server and local API must remain available.

Check public DNS as well as authentication before calling a tunnel externally verified. A request from a Tailscale-connected host can use private MagicDNS and succeed while public resolvers still return NXDOMAIN. The earlier Funnel hostname failed that public-DNS check; local inference was not evidence of Render connectivity.

Run the actual model-only check without creating payment operations:

```bash
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python scripts/check_live_model.py
```

Connected payments require `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID` and `PAYPAL_WEBHOOK_ID`. Register public HTTPS `POST /api/paypal/webhook` on the same sandbox REST app. The retrieved registration points to `https://paypalaihack26.onrender.com/api/paypal/webhook`; that API must run this revision and share the checkout database before connected verification. Registration is not delivery proof. Only the client ID reaches the browser. Sandbox account creation is separate from human buyer approval.

The October 7 inspection found working sandbox app credentials, but the local configuration lacks the merchant ID. The existing sandbox webhook registration was retrieved read-only from PayPal; delivery is still unverified. No external configuration was changed during this review. The installed GPU model is configured through the authenticated local gateway. Genuine lower capture, final-authorization behavior, separate void/refund and webhook delivery remain external gates. See [VERIFICATION.md](VERIFICATION.md).

## Agreements and lifecycle

Six real headphone models with simulated merchant offers have versioned evidence. A live model extracts explicit requirements and assesses each candidate. Numeric budget/delivery constraints are independently enforced. Required unknowns block eligibility; explicit edits can relax a requirement. A model recommendation never approves a payment.

Buyer and merchant roles share one adapter with separate contexts. Only the merchant receives its private policy. At most three exchanges (six calls), 120 seconds, 6,000 output tokens and 24,000 total tokens are allowed per attempt. A crash terminates that attempt; an explicit retry creates a new bounded one. Public transcripts contain structured prices and server-written decisions, without private reasoning or floors.

Three materially different fictional merchants govern their own products:

| Policy | Products | 3-buyer permitted total | 5-buyer permitted total | Delivery | Initial inventory per product |
|---|---|---|---|---|---:|
| Commuter | Sony WH-CH720N, Bose QuietComfort | $89–$92 | $85–$88 | 6–7 days | 60 |
| Value | Sony WH-CH520 | $65–$75 | $61–$69 | 4–5 days | 20 |
| Studio | AirPods Max USB-C, Sony WH-1000XM5, Bose QuietComfort Ultra (2nd Gen) | $285–$310 | $265–$290 | 12 days | 24 |

Private floors narrow those public envelopes. Only quantity discounts are permitted; product, currency, variant and delivery changes are rejected. Different valid input can yield different prices or no agreement. The October 8 real-product model check negotiated Sony WH-CH720N **$92/$88**, WH-CH520 **$75/$69**, and WH-1000XM5 **$299/$279**, reached no agreement for a **$66 maximum**, clarified an incomplete request, and negotiated **$89/$88** from five distinct simulated requirements. It created **zero payment operations**. See `docs/model-verification-real-products.json`. Earlier fictional-catalog checks, including a $89/$85 observation, remain in `docs/model-verification-current.json` and `docs/model-verification-prior-success.json`; those prices are not a guarantee for a new negotiation.

Ordinary shopping first matches an eligible open group with compatible immutable terms and capacity, otherwise starts a bounded draft. Duplicate matching submissions and in-flight negotiations reuse their existing work. Acceptance reserves shared inventory atomically and creates an immutable quote. Stock is never recreated per run; remaining stock returns only after safe lifecycle resolution. Consent retains its evaluated request and exact product, variant, quote version, maximum, USD currency, delivery, closing deadline and tier schedule.

The primary profile has capacity five, minimum three and the actually negotiated two-tier schedule. New preparation accepts only five-person headphone runs. Existing large and calculator purchases retain their original immutable obligations and recovery paths; their regression setup is isolated in `tests/legacy_fixtures.py`.

Compatible requests and verified authorizations are separate counts.

The **new quote's closing time is fixed on acceptance**. Operator controls configure its window before negotiation (90–1,800 seconds; default 600). Activation retains that deadline rather than altering approved terms. Prepared approvals must refer to the same quote and remain fresh. Legacy calculator activation retains its original 90-second behavior.

`DRAFT → OPEN → SETTLING → SUCCEEDED`, or `OPEN/SETTLING → UNWINDING → FAILED`. At closing, admission stops; provider resources are retrieved without holding locks; valid membership and price freeze transactionally. No early settlement on reaching a tier. Capture failures never increase the price. All selected members must complete or the group unwinds.

Approved maximum, settlement amount and verified capture/refund amounts are distinct. Lower captures use `final_capture=true`. No remainder-void event is fabricated. “$4 not captured” does not claim a bank balance update. Refunds use the actual captured amount.

The existing durable operation keys, PostgreSQL leases, recovery controls, signature verification, event deduplication, buyer sessions and CSRF protections remain. One worker process runs one bounded model lane and two reserved payment/webhook/deadline lanes with independent connections and session job locks. Transactions and row locks end before provider calls. Verified webhook bytes and events are persisted before acknowledgement; current provider GET observations are labeled separately from signature-verified historical events. OAuth tokens are cached until a minute before expiry and HTTP connections are reused. Reconciliation uses bounded backoff and settled groups stop periodic payment fetching. Expensive mutations have a tighter rate limit. Access logging is disabled to protect invite/approval query tokens; API responses are private and referrers suppressed. Unknown payment responses require reconciliation; late confirmed captures during unwind are compensated. Unresolved operations keep cleanup visible. Inventory remains reserved until the relevant workflow resolves.

## Verification

```bash
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:browser --prefix frontend -- tests/buyer.spec.ts tests/checkout.spec.ts tests/storefront.spec.ts
# Use an isolated fixture API/worker database for this real-stack test:
COALITION_E2E_URL=http://127.0.0.1:8014 COALITION_OPERATOR_TOKEN=... \
  npm run test:browser --prefix frontend -- --grep 'negotiated stack|ordinary shopping' --workers=1
# The four additional fixture settlement/recovery scenarios (desktop):
COALITION_E2E_URL=http://127.0.0.1:8014 COALITION_OPERATOR_TOKEN=... \
  npm run test:browser --prefix frontend -- tests/stack.spec.ts --project=desktop --workers=1
```

October 8 checks: **77 PostgreSQL tests, zero skips**, build and focused lint passed. All 18 desktop/mobile browser regressions passed after correcting a test selector; the final four storefront checks passed again. Four desktop/mobile ordinary-shopping application cases passed with the real-product catalog and fixture payments. A historical Cabin One $85 receipt retained its original identity after the catalog change. Earlier checks also covered four desktop settlement/recovery cases and owned receipts surviving an API/worker restart. Genuine payment acceptance remains blocked; [VERIFICATION.md](VERIFICATION.md) records failures, limits and the Ponytail audit.

The automated `.github/workflows/verify.yml` gate runs PostgreSQL backend checks, focused lint, the frontend build and desktop/mobile fixture browser checks. Tests create disposable schemas and preserve existing history. Payment/model doubles prove application behavior, not external account behavior. [docs/DEMO.md](docs/DEMO.md) describes the live preparation and video gates.

## Deployment

`render.yaml` retains the static frontend, API, single worker and private PostgreSQL topology. Configure the model and PayPal values in the shared backend environment, `PUBLIC_URL` to the frontend origin, and `VITE_API_URL` to the public API. Use same-site custom domains so browser session cookies remain dependable. Deploy API and worker with the same code/configuration. Keep provider retry retention at its conservative default unless verified for the actual endpoints.

No new microservices, brokers, Redis, agent frameworks, wallets, escrow, split payouts or physical fulfillment integration are introduced. Hosting spend includes each configured service. Deployment and commercial readiness are not established by local tests.
