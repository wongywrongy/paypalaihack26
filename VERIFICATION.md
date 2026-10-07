# Coalition — verification record

## Required assessment keys — October 7, 2026

The user's 18:15 UTC log confirms the prior coverage correction was deployed but both assessment attempts still failed exact-name coverage. HTTP 200 proves connectivity, not a valid assessment. The exact failed response was not retained. Protected evidence locates that request in the already-FAILED large run; its earlier requests also failed and have no stored parsed constraints.

Replaced free-form assessment arrays with a provider JSON schema requiring every catalog product and every indexed requirement (`r0`, `r1`, etc.). The model supplies verdicts, evidence references and concise rationales; code restores each authoritative requirement name. Missing/renamed fields and unexpected fields fail schema validation. Identical repeated requirement labels are deduplicated; differently named requirements remain distinct, including a feature about iPhone compatibility and the separate device requirement. The existing source/unknown guards and bounded retry remain. No requirement is treated as satisfied because its assessment was omitted.

Executed: 54 backend tests passed in disposable PostgreSQL schemas, including required-field rejection, exact identity mapping, duplicate-label handling, unknown eligibility, retry success and exhausted retry with no stored assessments. Focused Ruff checks passed. Nine full matching evaluations using the changed code and public GPU tunnel completed: four canonical simulated buyers, three varied requests, and $86/$100 edits. The simultaneous-two-device requirement stayed unknown and excluded all offers; $86 also excluded all offers. A separate live empty-requirement schema check passed. No payment operations were initiated. These are isolated live-code checks, not a claim of a new Render deployment.

Prepared fresh small production run `af1abafe-dabb-4ab3-af51-b056c6ad2fcb`, preserving older runs and obligations. It has four simulated request jobs and no approved payments; preparation alone does not prove their successful evaluation under this revision. Redeploy both Render services with this commit before production verification. Genuine payment acceptance gates remain outstanding.

## Matching coverage correction — October 7, 2026

The later production log at 17:53 UTC shows successful HTTP 200 model calls followed by `Assessment must cover each requirement in order.` The previous successful production journey did not establish continued matching reliability. That validator conflated reordered responses with missing, duplicate or renamed requirements; the exact failed model response was not retained, so the log alone cannot distinguish those cases.

Matching now verifies exact requirement-name coverage, rejects duplicates and unexpected names, and restores the buyer's display order without changing verdicts or sources. Invalid assessment coverage/schema receives at most one additional live model call with validation feedback. Both attempts must cover every catalog product exactly once; no assessment rows are stored until the whole response passes. Unresolved invalid output still fails closed, and documented unknown requirements remain ineligible.

Executed: all 53 backend tests passed against disposable PostgreSQL schemas, including all six order permutations, rejected missing/duplicate/extra/renamed requirements, corrected retry success and two-invalid-response failure with zero stored assessments. Focused Ruff checks passed. Four simulated buyers and two budget edits completed through the actual public Cloudflare model endpoint using the changed code in an isolated database schema: each initial request had one eligible offer, $86 had none, and $100 restored one. No payment operations. Eight earlier live assessment probes using the old prompt did not reproduce the exact production mismatch; the controlled regression establishes the validator behavior.

The correction requires a new Render deployment of the API and worker. These results do not claim the changed validator has already been verified on Render or that future malformed model output cannot occur. The earlier genuine-payment gates remain outstanding.

## Render model connectivity and live journey — October 7, 2026

The reported `httpx.ConnectError: [Errno -2] Name or service not known` prevented the Render worker from reaching the model. The Tailscale hostname resolved privately but remained NXDOMAIN on public resolvers. With explicit user approval, configured a dedicated Cloudflare Tunnel at `https://coalition-model.wongworks.dev/api/model`. It forwards only `/api/model/v1/chat/completions` to the existing authenticated gateway. Anonymous model calls return 401; unrelated paths return 404. The connector is an enabled, restarting user systemd service. Private connector credentials are excluded through `.runtime/`. Removed the unused public Tailscale port 443 mapping, preserving the private application mapping.

After the user redeployed both Render services with the new base URL, exercised the actual production frontend, API, database, worker and live GPU model without intercepting responses. Fresh small run `fa2a56c4-d7ce-40d9-afa0-a0cc66ac9be4` selected Cabin Pro for the flights/iPhone request. Editing the maximum to $86 excluded every offer; restoring $100 restored eligibility. Live buyer/merchant/buyer exchanges proposed $92/$88, countered with $89/$85, then accepted the validated merchant quote. The stored agreement reserves five units and requires three authorizations at $89 or five at $85. Three initial simulated-request evaluations failed; new live evaluations completed for all four prepared personas, retaining earlier failure records.

The dedicated checkout retained the exact product and terms after refresh. Mobile checks at 390px with reduced motion found no horizontal overflow, invalid dates or false highest-tier label. Editing to $86 after acceptance hid the executable deal while preserving the immutable quote; restoring $100 restored it. Anonymous status reads returned 401. Evidence snapshots showed OPEN, no needs-attention flag, zero payment operations and zero authorizations. Screenshots are `/tmp/coalition-production-search.png`, `coalition-production-quote.png`, `coalition-production-checkout.png`, `coalition-production-mobile.png` and `coalition-production-mobile-checkout.png`.

These checks verify deployed live matching, negotiation and checkout presentation. No PayPal approval, authorization, capture, void, refund or webhook was initiated in this run; genuine payment acceptance gates remain outstanding. Earlier unresolved payment records were preserved. The accepted run closes at its stored application deadline; it is a finite demonstration, not a permanent offer.

## Storefront correction — October 7, 2026

Replaced the technical request layout with the user-specified Coalition storefront. Six products and illustrative studio photographs appear before search; editable requirements and completed negotiation history are expandable. The accepted photograph, price, real authorization count and review action share one product panel. The sandbox badge/footer disclose simulation and AI-generated imagery; source prompt and asset provenance are in `docs/photography.json`.

Shopping sessions move from restored legacy runs to an available headphone run without deleting earlier commitments. The journey endpoint does not label calculator terms as a headphone result. The frontend requires a completed matching request for the exact tiered product before presenting an accepted deal; failed evaluations show the requested retry copy. Invalid/missing dates are never formatted as a date, and the highest-tier label requires an actual positive qualifying count. `/api/purchases` filters by authenticated owner across runs.

Executed checks: 51 backend tests passed, including legacy suppression, shopping-run selection, explicit legacy-invite preservation and owned purchase-history access. TypeScript/Vite and focused Ruff checks passed. Eighteen desktop/mobile browser regressions passed with intercepted API/provider fixtures; two integrated browser journeys passed against an isolated PostgreSQL/API/worker stack, including request edits, accepted terms, the actual 90-second application deadline, lower fixture capture and persistent receipt. The four storefront cases were also rerun after the review fixes; these are repeats, not additional distinct tests.

The design detector returned no findings. Independent finish review found stale fit labels after failed requests and mismatched alternate-product selection; both were fixed and scored resolved, with a ship disposition limited to those fixes. DESIGN.md and the schema-v2 sidecar now reflect the shipped storefront. Current desktop/mobile evidence is in `.impeccable/review/storefront-*` and `negotiated-*`. Private preview smoke checks found no JavaScript errors or horizontal overflow and initiated no payment. Earlier genuine PayPal verification gates remain unchanged; fixture captures are not sandbox provider proof.

## Current request-first implementation — October 7, 2026

Historical entries below refer to earlier revisions. These are the current executed results and remaining gates.

| Check | Actual result |
|---|---|
| Backend suite, isolated PostgreSQL schemas | 50 passed; provider doubles. Includes forward migrations, frozen $89/$85 tiers, partial failure/refund, stock conflicts, request edits, mandatory unknowns, one-unit limit, ownership uniqueness, token bounds and legacy recovery. |
| Existing checkout/navigation/SDK browser regressions | 10 passed across desktop/mobile; explicitly intercepted API/provider responses. |
| New request-first integrated browser journey | 2 passed across desktop/mobile; actual API, worker and PostgreSQL in a disposable fixture schema. Merchant-context entry, $86 exclusion, $100 eligibility, quote/inventory, four disclosed prepared fixture approvals plus hero, real 90-second application close, $85 capture receipt, refresh and reduced motion. |
| Live GPU model | Five synthetic buyers independently evaluated; live $86 edit excluded all offers, restoring $99.99 restored one. Merchant countered the $92/$88 buyer proposal with $89/$85, buyer accepted. Three role calls, 5.22 seconds, 5,262 total tokens. No payment operations. See `docs/model-verification.json`. |
| Model authentication | Unauthorized gateway request rejected; actual structured inference completed through authenticated existing API. Ollama model observed at 100% GPU, 21 GB loaded, 32,768 context. Native listener exposure was not changed. |
| TypeScript/Vite build and Python lint | Passed. |
| Private Compose deployment | Non-destructive migrations applied; API/worker healthy, authenticated GPU inference verified from containers; existing Tailscale preview checked on desktop/mobile without overflow or JavaScript errors. Remains fixture mode. |
| Design review | Existing-world extension, detector `[]`; independent finish fix-list review: ship. Request/receipt desktop/mobile evidence in `.impeccable/review/negotiated-*.png`. Updated PRODUCT.md, DESIGN.md and schema-v2 sidecar. |
| PayPal app metadata | Genuine sandbox OAuth access and webhook-registration retrieval verified. Existing Render webhook ID configured privately. No authorization, capture, void, refund or received webhook is claimed from that read. |

The code retains one API, one worker, PostgreSQL leases and the existing payment operation infrastructure. No database/payment history was deleted. Earlier connected run obligations remain durable. Invalid output and bounded no-agreement paths were also observed while calibrating the live model; no failed attempt was presented as acceptance.

Genuine **authorize $89 → final capture $85**, resulting authorization state, separate void/refund and webhook delivery still require a configured `PAYPAL_MERCHANT_ID`, fresh exact-quote human approvals, and deployment of this revision on the public webhook API using the same purchase database. The model gateway needs restricted native Ollama access and authenticated connectivity before remote Render use. Public Render deployment, complete hosting-spend accounting, a genuine end-to-end video and current submission compliance have not been verified. The local preview remains explicitly fixture mode.

# Executed verification — 2026-10-06

The repository already contained the Commonplace React storefront, a PayPal REST adapter, explicit PostgreSQL transitions/jobs, original product assets and tests. Those were reused. Connections now use SQLAlchemy and migrations use Alembic. New coordination, evidence and assistant behavior is described in [README.md](README.md).

## Local results

| Check | Actual result |
|---|---|
| Python invariant and PostgreSQL integration suite | 37 passed; isolated disposable schemas, including migrations and seed |
| TypeScript and Vite production build | Passed |
| Python lint (`E4,E7,E9,F,I`, excluding import-order accommodation `E402`) | Passed |
| Mocked buyer browser tests | 2 passed: desktop and mobile |
| PostgreSQL/API/worker browser success, partial-capture and pending-refund scenarios | 6 passed: desktop and mobile; final receipt polling fix included |
| Separate real 90-second group deadline browser scenarios | 2 passed: desktop and mobile; provider actions were fixtures |
| Responsive screenshot confirmation | Desktop product page, mobile sheet and protected merchant page inspected; no horizontal overflow |
| Docker image build with Node 22 / Python 3.12 | Passed after repairing inherited malformed optional-package lockfile entries |
| Built-container migration/seed/API smoke check | Passed against the disposable schema; seed remains exactly three products |
| Existing private Tailscale deployment | API and worker rebuilt and started; non-destructive migrations applied; health and matching frontend bundle verified through the existing port 8766 route |

The first full browser run found that a completed receipt polled too slowly to display subsequent sandbox-demo refund cleanup. The open sheet now keeps two-second polling. The success checks passed after that fix. The tests also exposed and cover merchant cleanup racing with frozen settlement: cleanup now returns 409 during SETTLING. A provider-confirmed void/expiry releases an OPEN slot without changing frozen membership.

The payment tests use deterministic provider doubles. They cover lost capture responses and process restart after remote success, duplicate capture prevention, pending capture reconciliation, partial captures followed by refunds/voids, late captures during unwinding, refund failure and separate needs_attention, duplicate payer/commands/events, wrong ownership/order/amount/currency/merchant, simultaneous capacity/deadline/withdrawal races, immutable terms/inventory, reclaimable worker leases, verified-versus-rejected webhook processing and source attribution. Mocked model acceptance cannot bypass explicit budget/delivery constraints or unknown required course compatibility. Missing assistant configuration does not block ordinary checkout.

The full-stack browser checks run the actual FastAPI server and persistent worker against PostgreSQL. Only payment/model behavior is explicitly simulated. Deadline tests wait for the actual group clock; they do not simulate PayPal authorization expiry. Disposable test schemas are separate from existing demo/payment history.

Commands used:

```bash
COALITION_TEST_DATABASE_URL=postgresql://coalition:coalition@localhost:5432/coalition \
  PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:browser --prefix frontend -- --grep 'buyer' --workers=1
# Fixture API/worker used port 8012 and a disposable database schema.
# Set COALITION_OPERATOR_TOKEN to that verification server's private token.
COALITION_E2E_URL=http://localhost:8012 npm run test:browser --prefix frontend \
  -- --grep 'real stack' --workers=1
# After fixing open-receipt polling, reran both layouts for these scenarios:
COALITION_E2E_URL=http://localhost:8012 npm run test:browser --prefix frontend \
  -- --grep 'real stack: (success|partial|refund_pending)' --workers=1
docker compose build api
```

## External results and remaining gates

**No genuine PayPal sandbox call, PayPal webhook receipt, live model recommendation or Render deployment has been verified in this environment.** No successful external result has been fabricated. Current missing variables are exactly:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MERCHANT_ID`
- `PAYPAL_WEBHOOK_ID`
- `LLM_API_KEY`

Also required: five distinct sandbox buyer accounts with human approvals, a public HTTPS API webhook endpoint registered on the same sandbox REST app, and a Render account/configured paid services if deploying there.

The adapter uses PayPal sandbox Orders v2 AUTHORIZE, Payments v2 capture/void/refund/status and PayPal's webhook-signature verification endpoint. SDK buttons obtain buyer approval; the backend verifies provider resources. Official endpoint and idempotency references are linked in [README.md](README.md). Payments v2 schema does not supply a blanket replay retention guarantee; the default forbids blind replay of an unknown capture/refund POST and requires reconciliation or merchant review. The assistant uses Anthropic Messages structured outputs, with local validation. Configuration alone is not proof of a successful call.

Complete [docs/DEMO.md](docs/DEMO.md), then run `scripts/check_connected.py` against the genuine success/refund and deadline/void run IDs. This read-only gate requires current provider lifecycle resources, five distinct payer captures and full cleanup refunds, a separate void, processed verified payment webhook receipts, and live recommendation acceptance/rejection. A judge must observe a genuine webhook-driven UI receipt/state update; local doubles cannot satisfy that acceptance gate.

Render configuration, a Postman collection, OpenAPI export, migrations, environment example, seed command and local setup are supplied. Production gaps remain documented in the README. Existing unresolved financial records must be retained; archive is permitted only after confirmed resolution.

On the user's follow-up, the existing Tailscale proxy was present but its port-8000 API was down. Ran `docker compose up --build --detach --wait --wait-timeout 180`, preserved the database volume and prior runs, and verified both container payment modules match the workspace. The private preview uses the existing tailnet host on port 8766. Published a fresh normal 24-hour fixture offer because the prior default run was legacy. This is a simulated preview, not PayPal/model proof or a public webhook endpoint.


## Render follow-up — 2026-10-07

Read-only checks of the user's deployment confirmed `/api/health`, `/api/config`, `/api/catalog`, buyer session setup and status responses. CORS accepts the configured HTTPS storefront origin. Connected-mode configuration reports all four PayPal values present, but no LLM key. The public PayPal JavaScript SDK returned HTTP 200; this does not prove server credentials, buyer approval, authorization, capture, void, refund or webhook verification. No payment was initiated by these checks.

Fixed missing-key handling for prepared AI jobs: a missing `LLM_API_KEY` now records assistant unavailability and finishes the job without repeated retries or group payment attention. The merchant table displays the recorded reason. Regression coverage verifies all five AI jobs finish without model calls or error logs and the following group job still runs. Existing exhausted AI jobs retain their records and can be retried from protected merchant controls.

Ran all 38 backend checks against isolated local PostgreSQL schemas (passed), TypeScript/Vite production build (passed), and focused Ruff checks (passed). These recovery tests use provider doubles and do not prove genuine PayPal payment operations.


## Payment-only placeholder — 2026-10-07

At the user's request, connected mode with a blank model key now displays an AI-coming-soon placeholder, hides the input and historical recommendation results, and retains ordinary PayPal checkout. Merchant copy marks recommendations disabled and omits Sam's live rejection instructions. New connected offers with a blank key create five buyer invitations and deadline work without AI decisions/jobs. Existing records remain intact. No local model was installed or started.

All 39 backend checks passed against isolated PostgreSQL schemas. Four desktop/mobile browser cases passed using explicit API fixtures, including refresh persistence, no assistant requests, enabled PayPal checkout controls after consent, and disabled merchant recommendation copy. TypeScript/Vite production build and focused Ruff checks passed. These checks do not prove a genuine PayPal payment. The full external acceptance gate still requires live AI and cannot be satisfied by this placeholder; the payment-only demo documents that limitation.

## Storefront checkout redesign — October 7, 2026

Implemented a 40/60 desktop checkout, offer-first mobile order, white Coalition surface, solid indigo action, numbered authorization track, and official Magic UI components with finite backend-driven motion and reduced-motion handling. Savings now use the backend catalog price. Latest recorded provider observations and expandable history retain source labels. No illustrative buyer activity was introduced.

Validation: production frontend build; six desktop/mobile browser checks using explicitly intercepted API/provider responses, covering consent, fixture approval, completed outcome, selection eligibility, disabled AI, count stability, keyboard focus/Escape, PayPal SDK cancellation, withdrawal, pending capture, pending and completed refund, reduced motion, and horizontal overflow. The offer action is checked above the fold at 1280×720 and 390×664. Desktop/mobile full-page screenshots are saved under `/tmp/coalition-checkout-*.png` and `/tmp/coalition-recovery-*.png`; existing buyer-flow screenshots remain under `/tmp/coalition-placeholder-*.png`. All 39 backend tests passed against isolated PostgreSQL schemas with deterministic payment doubles. These checks are implementation evidence, not genuine PayPal sandbox transaction or webhook evidence.


## Persistent Coalition checkout — 2026-10-07

Replaced the inline storefront payment flow with a compact merchant widget and dedicated `/checkout?run=<run UUID>` surface. Desktop checkout keeps summary left (40%) and payment right (60%); mobile combines them into one focused surface. The run URL scopes an offer while an HttpOnly buyer session retains payment ownership. Database-backed accepted terms and queued authorization survive refresh. PayPal return/cancel URLs use `/checkout`, and legacy root callbacks route there with owned-order validation.

Anonymous backend member records now drive the five positions and each capture/refund outcome. Success requires all five actual completed captures and the current buyer's completed payment; pending, canceled, reversed and refunded states retain their accurate records. Official Magic UI Blur Fade joins Animated Beam, Number Ticker and Animated List using existing dependencies. Motion is finite and reduced-motion aware; refresh does not celebrate success, and timestamp-only reconciliations do not animate activity. Latest payment evidence stays expandable. Optional assistance follows payment in DOM and visual keyboard order. Failed SDK loads have a retry control that preserves the commitment, and approval guidance reflects the current state.

| Check | Actual result |
|---|---|
| Backend suite against isolated PostgreSQL schemas | 39 passed; deterministic provider doubles |
| New database-backed queued-authorization regression, executed separately | 1 passed; 40 distinct backend checks across the two executions |
| Browser lifecycle and navigation checks with intercepted API/provider responses | 8 passed across desktop/mobile |
| Additional SDK retry, keyboard order and layout checks, executed separately | 6 passed across desktop/mobile; includes overflow at 320px and 820px |
| Final SDK retry recheck after clearing the prior error on retry | 2 passed across desktop/mobile; repeat checks, not additional distinct cases |
| PostgreSQL/API/worker browser scenarios through the existing private Tailscale route | 3 desktop scenarios passed: success with durable receipt and refund cleanup, partial-capture compensation, pending refund followed by confirmation |
| TypeScript/Vite production build | Passed |
| Ruff (`E4,E7,E9,F,I`, ignoring `E402`) | Passed |
| Design detector | No findings (`[]`) |
| Finish fix-list review | Ship disposition after all three material fixes and stale approval guidance were resolved; limited to that fix list, not a fresh global audit |

The eight lifecycle checks and six further checks were separate browser executions, not one fourteen-case run. They explicitly mock API and provider responses. The three full-stack scenarios use the actual PostgreSQL database, API and persistent worker through `https://neo.taile1abc7.ts.net:8443`, with explicit fixture payment/model behavior. None proves genuine PayPal approvals, payment operations, webhook delivery or live AI. Existing external acceptance gates above remain unchanged.

Compared the checkout, merchant widget, numbered track, PayPal approval and motion sources, global stylesheet, backend anonymous-member/authorization-job state, and provider return URLs with the incumbent DESIGN.md and supplied direction. Current composition evidence is `.impeccable/review/desktop.png`, `mobile.png`, `narrow.png`, `desktop-viewport.png` and `mobile-viewport.png`. Earlier `checkout-*`, `merchant-*`, `settling-*`, `receipt-*` and `refund-*` support screenshots establish the merchant and lifecycle surfaces, but precede the final assistant order, state-aware guidance and responsive fixes; they are not current-copy evidence. No approved image comp was supplied.

PRODUCT.md, DESIGN.md and README.md now describe the persistent flow. Historical verification entries remain intact. The incumbent DESIGN.md has no machine-readable token frontmatter or `.impeccable/design.json` sidecar; this prose merge preserves existing CSS tokens rather than inventing a token catalog or sidecar. The final local/private-preview rebuild following these documentation edits is not included in the results above.

Final serving check: rebuilt the API and worker with the reviewed frontend at localhost port 8000 and the existing private Tailscale port 8443, preserving the database. Browser checks on localhost, Tailscale desktop (1280×720), and Tailscale mobile (390×664) reached the persistent checkout, retained the same buyer and commitment after refresh, showed all five positions, and reported no JavaScript errors or horizontal overflow. The existing offer was OPEN with zero confirmed buyers in explicit fixture mode; no payment was initiated. Final deployed captures are `.impeccable/review/deployed-localhost.png`, `deployed-tailscale-desktop.png`, and `deployed-tailscale-mobile.png`.
