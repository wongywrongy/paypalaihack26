# Coalition

Coalition turns headphone requirements into a compatible group purchase. Buyers review an immutable merchant quote, approve its maximum through PayPal, then receive the applicable lower tier at closing or an unwind when the group cannot complete.

**Simulated buyers and merchant offers. Live AI decisions. Real PayPal sandbox operations.** This describes connected mode only after configuration and actual execution. Fixture mode explicitly simulates AI and payments. Shipping is included, tax is simulated at $0, inventory and fulfillment are fictional, and all offers settle to one configured sandbox business account.

## Run locally

Python 3.12+, Node 22+ and PostgreSQL 16 are required. Existing dependencies and the single API/worker architecture are retained.

```bash
cp .env.example .env
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

Open `/operator`, enter the private token and prepare a **small** run. Share its request URL. `/` is the Coalition storefront with six products visible before search, `/purchases` lists the session owner’s saved purchases, `/shop` preserves the optional merchant widget, `/checkout?run=…` is buyer-owned persistent checkout, and `/how-group-pricing-works` explains pricing. Old calculator runs retain their fixed $65 terms and settlement behavior.

The storefront folds editable requirements into a disclosure and keeps the accepted product, maximum price and group progress together. Failed evaluations show a retry state; legacy calculator quotes remain in their dedicated checkout. Illustrative AI-generated product photographs are disclosed in the sandbox badge and footer; their source prompt is recorded in `docs/photography.json`.

## Model and payment configuration

The model adapter supports authenticated OpenAI-compatible `/v1/chat/completions` with `LLM_PROTOCOL=openai`. Set backend-only `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`. HTTPS is required outside localhost. Responses are validated against Pydantic schemas; provider schema constraints are used for fixed quotes. `LLM_PROTOCOL=anthropic` retains support for an Anthropic-compatible endpoint through the same adapter. There is no connected fallback to cached or fixture output.

For this GPU server, use the installed **qwen3:30b-a3b-instruct-2507-q4_K_M** with `LLM_PROTOCOL=ollama`. The model runs entirely on the RTX PRO 4000 GPU. Variable-length extraction and assessments use JSON-only generation with local schema validation; fixed negotiation proposals also use provider JSON-schema constraints. Thinking is disabled. The private `.env` is configured; API and worker must reload it to apply changes. Warm the model before a live demonstration: the observed cold load took about 47 seconds and exceeded the request timeout; an unavailable result remains visible and requires a retry.

Native Ollama does not enforce bearer authentication. The existing API provides `POST /api/model/v1/chat/completions`, authenticated with `LLM_API_KEY`, restricted to the configured model and bounded input/output. Set `OLLAMA_UPSTREAM` to the same server's native origin, `LLM_BASE_URL=http://127.0.0.1:8000/api/model` for host development, and `LLM_CONTAINER_BASE_URL=http://api:8000/api/model` for Compose's private network. The native listener must be local/private; the authenticated route does not change an existing daemon's network exposure. No daemon configuration or GPU drivers were changed. For Render, use the host gateway's HTTPS origin plus `/api/model`, the same private bearer key and `LLM_PROTOCOL=ollama`; leave `OLLAMA_UPSTREAM` empty on Render. Configure authenticated private connectivity or a restricted HTTPS gateway before deployment.

The configured Cloudflare Tunnel endpoint is `https://coalition-model.wongworks.dev/api/model`. Use it as `LLM_BASE_URL` on both Render API and worker, with the same private `LLM_API_KEY`, `LLM_PROTOCOL=ollama` and the model above. The tunnel routes only the exact `/api/model/v1/chat/completions` path; all other paths return 404. Its connector is the enabled user service `coalition-model-tunnel.service`; inspect it with `systemctl --user status coalition-model-tunnel.service`. Connector credentials live in the ignored, private `.runtime/` directory and must never be committed. The GPU server and local API must remain available.

Check public DNS as well as authentication before calling a tunnel externally verified. A request from a Tailscale-connected host can use private MagicDNS and succeed while public resolvers still return NXDOMAIN. The earlier Funnel hostname failed that public-DNS check; local inference was not evidence of Render connectivity.

Run the actual model-only check without creating payment operations:

```bash
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python scripts/check_live_model.py
```

Connected payments require `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID` and `PAYPAL_WEBHOOK_ID`. Register public HTTPS `POST /api/paypal/webhook` on the same sandbox REST app. The retrieved registration points to `https://paypalaihack26.onrender.com/api/paypal/webhook`; that API must run this revision and share the checkout database before connected verification. Registration is not delivery proof. Only the client ID reaches the browser. Sandbox account creation is separate from human buyer approval.

The October 7 inspection found sandbox app credentials, but no merchant ID. The existing sandbox webhook registration was retrieved from PayPal and its ID configured; delivery is still unverified. The installed GPU model is configured through the authenticated local gateway. Genuine lower capture, final-authorization behavior, separate void/refund and webhook delivery remain external gates. See [VERIFICATION.md](VERIFICATION.md).

## Agreements and lifecycle

Six fictional headphone offers have versioned evidence. A live model extracts explicit requirements and assesses each candidate. Numeric budget/delivery constraints are independently enforced. Required unknowns block eligibility; explicit edits can relax a requirement. A model recommendation never approves a payment.

Buyer and merchant roles share one adapter and separate contexts. At most three exchanges (six calls), 120 seconds, at most 6,000 output tokens and 24,000 total tokens are allowed per attempt. A crash terminates that attempt; retries create a visibly new one. Merchant policy permits first-tier prices $89–$92 and second-tier prices $85–$88, with base prices $92/$88. The canonical target is $89/$85; actual authorized alternate agreements are retained honestly. Private policy never enters the public transcript.

Acceptance reserves shared inventory atomically and creates an immutable quote. Stock is not recreated per run. Final matching applies to the maximum amount and agreed delivery date. Approval preserves exact product, variant, quote version and maximum total.

| Profile | Capacity | Canonical tiers | Below minimum |
|---|---:|---|---|
| Small live | 5 | 3–4 buyers: $89; 5 buyers: $85 | Unwind below 3 |
| Large illustrative | 60 | 25–49: $89; 50–60: $85 | Unwind below 25 |

Compatible requests and verified authorizations are separate counts. The large profile never multiplies five payments into fifty.

The **new quote's closing time is fixed on acceptance**. Operator controls configure its window before negotiation (90–1,800 seconds; default 600). Activation retains that deadline rather than altering approved terms. Prepared approvals must refer to the same quote and remain fresh. Legacy calculator activation retains its original 90-second behavior.

`DRAFT → OPEN → SETTLING → SUCCEEDED`, or `OPEN/SETTLING → UNWINDING → FAILED`. At closing, admission stops; provider resources are retrieved without holding locks; valid membership and price freeze transactionally. No early settlement on reaching a tier. Capture failures never increase the price. All selected members must complete or the group unwinds.

Approved maximum, settlement amount and verified capture/refund amounts are distinct. Lower captures use `final_capture=true`. No remainder-void event is fabricated. “$4 not captured” does not claim a bank balance update. Refunds use the actual captured amount.

The existing durable operation keys, PostgreSQL leases, retries, reconciliation, signature verification, event deduplication, buyer sessions, CSRF checks and rate limits remain. Unknown payment responses require reconciliation; late confirmed captures during unwind are compensated. Unresolved operations keep cleanup visible. Inventory remains reserved until the relevant workflow resolves.

## Verification

```bash
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:browser --prefix frontend -- --grep 'buyer|persistent checkout|PayPal'
# Use an isolated fixture API/worker database for this real-stack test:
COALITION_E2E_URL=http://127.0.0.1:8014 COALITION_OPERATOR_TOKEN=... \
  npm run test:browser --prefix frontend -- --grep 'negotiated stack' --workers=2
```

Tests create disposable schemas and preserve existing history. Payment/model doubles prove application behavior, not external account behavior. [docs/DEMO.md](docs/DEMO.md) describes the live preparation and video gates.

## Deployment

`render.yaml` retains the static frontend, API, single worker and private PostgreSQL topology. Configure the model and PayPal values in the shared backend environment, `PUBLIC_URL` to the frontend origin, and `VITE_API_URL` to the public API. Use same-site custom domains so browser session cookies remain dependable. Deploy API and worker with the same code/configuration. Keep provider retry retention at its conservative default unless verified for the actual endpoints.

No new microservices, brokers, Redis, agent frameworks, wallets, escrow, split payouts or physical fulfillment integration are introduced. Hosting spend includes each configured service. Deployment and commercial readiness are not established by local tests.
