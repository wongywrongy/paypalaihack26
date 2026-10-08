# Coalition — verification record

## First-class agent negotiation — October 8, 2026

Inspected the current implementation and repository instructions before editing. The writable checkout matched remote `main` at **ffbd2650cc023a69eab7b90d53651eb15ddcd7b2**. The previous real-product catalog and returning-shopper fixes are preserved. No accessible `AGENTS.md` was found. Changes keep React, FastAPI, one worker, PostgreSQL, Render and the configured model, with no new dependency, service or payment endpoint.

### Implemented behavior

- The product's purchase panel now leads with compact editable requirements, actual compatible interest, confirmed authorizations and **Negotiate for me**. Simulated list price, indicative public range and accepted quote are separate. Product photography remains beside it on desktop and compact above it on mobile.
- Persisted rounds identify both agents, their validated tier prices, actions and numeric changes. Merchant terms identical to the buyer's bid are **accepted**, while retaining the executable merchant proposal. Safe explanations use validated differences and public policy facts, never model reasoning, private floors or invented economics.
- Migration **006** adds `public_event` to existing rounds and `error_kind` to existing attempts. Each round commits before another model call. Journey returns stable IDs/sequences, explicit currency, timestamps, ordered changes, real processing phase and exact accepted quote reference. Older unstructured rounds are labeled unavailable rather than parsed from strings.
- Negotiation remains prominent while running and does not collapse on completion. The agreement presents maximum, conditional lower tier, buyer thresholds, shipping/delivery/closing, actual counts and **Review agreement & authorize**. A compact summary remains visible; full history is available through **View negotiation**. Agent acceptance explicitly does not mean human approval or settlement.
- Existing polling remains. All unseen valid offers queue once in sequence, including batches; refresh restores without replay. AnimatedBeam and AnimatedList reuse existing components. Exact prices use restrained opacity, and reduced motion/keyboard/status announcements remain understandable without animation. No animation changes terms, creates authorization or delays checkout.
- No-agreement and interrupted states provide explicit adjustment/selection/retry. Provider failures stop the attempt instead of silently repeating it; existing schema-repair/time/token/round budgets remain. Evaluated edits are not trapped by an older failed attempt. Out-of-order refresh responses cannot overwrite a newer response.
- Payment architecture, immutable consent, server validation, inventory reservation, ownership, idempotent operations, verified webhooks and reconciliation are retained. No connected fallback was added. Negotiation itself creates no payment.

### Executed checks — deterministic fixtures and application behavior

| Check | Actual result |
|---|---|
| PostgreSQL backend suite | **81 passed, zero failures/skips**, disposable PostgreSQL 16 schemas, final run **48.778 seconds**; `/tmp/coalition-negotiation-backend-final.log`. New checks cover truthful first-offer acceptance/diffs/private-output exclusion, an offer visible while the merchant call is blocked, accepted quote restored unchanged, and provider failure with no automatic retry. Existing deadlines during slow AI, ownership, inventory, leases, payment/webhook/recovery tests also pass. |
| Desktop/mobile browser regression gate | **28 passed, zero skips**, **44.0 seconds**; `/tmp/coalition-negotiation-browser-final.log`. Eight negotiation cases cover first acceptance, counter/accept, decline, connection failure and explicit retry, edited-request recovery, batched round animation order, duplicates, refresh during/after negotiation, exact-term checkout, keyboard and reduced motion. Other storefront/checkout regressions remain included. The final shared-agreement provenance change passed all **eight negotiation checks again**, 22.7 seconds; `/tmp/coalition-negotiation-browser-confirm.log`. |
| Built frontend with actual isolated API/worker/database | **Two desktop/mobile journeys passed**; `/tmp/coalition-negotiation-stack.log` and `.json`. Both restored identical round IDs and quote/version after refresh, reached exact-term checkout and preserved empty purchase history with **one negotiation submission and zero payment-creation calls** per journey. They used fixture AI and fixture provider configuration. The second shopper joined the same compatible open quote. Shared agreements identify the existing group buying agent rather than claiming the new shopper originated that exchange. Interest counts were **11/12**, confirmed authorizations **0**; no personas were treated as funding. |
| Build/lint/gate | TypeScript/Vite and focused Ruff passed; `/tmp/coalition-negotiation-build-final.log`, `/tmp/coalition-negotiation-lint-final.log`. The existing GitHub gate now includes `negotiation-ui.spec.ts`. No dependency or infrastructure added. |
| Rendered screens | Batched desktop/mobile active negotiation and agreement inspected, then confirmed after the bounded recovery correction. Screenshots: `.impeccable/review/negotiation-active-{desktop,mobile}.png`, `negotiation-agreed-{desktop,mobile}.png`. These use explicit public API fixtures and are **not genuine provider screenshots**. The design detector reported no deterministic findings. |

Intermediate failures were not provider outcomes: the first TypeScript build caught a removed count reference and was corrected. An initial browser run reused another app on shared port 5173 and failed all 28 checks; isolated port 5186 passed all 28 twice, including the final recovery correction. A backend rerun without local-network sandbox permission failed to connect to the disposable database; the permitted final run passed all 81. Earlier intermediate backend and browser successful runs are retained in `/tmp/coalition-negotiation-backend-2.log` and `/tmp/coalition-negotiation-browser-2.log`. Full fixture payment/deadline browser scenarios and worker-restart receipt checks were **not rerun for this UI change**; their prior evidence below remains historical. Chromium desktop/mobile emulation was used, not physical phones or every browser.

### Genuine configured-model evidence — separate from fixtures

`docs/model-verification-negotiation-ui.json` records six actual authenticated cases through the configured Ollama adapter to **qwen3:30b-a3b-instruct-2507-q4_K_M**, against disposable schemas with payment creation disabled. **Zero payment operations; zero confirmed authorizations.**

| Actual request / product | Observed outcome, 3/5-buyer tiers |
|---|---|
| ANC, iPhone 12, under $100, seven days / Sony WH-CH720N | **$90/$87**; buyer offered, merchant accepted those prices, buyer accepted the executable merchant quote |
| Bluetooth, iPhone 12, under $80, five days / Sony WH-CH520 | **$75/$69**, first offer accepted |
| ANC, under $350, fourteen days / Sony WH-1000XM5 | **$299/$279**, first offer accepted |
| Maximum $66, five days | **No agreement** within three exchanges; invalid over-budget buyer responses did not become executable offers |
| “Headphones under $100” | **Delivery clarification**, no negotiation |
| Five distinct simulated requirements, Sam under $90 / Sony WH-CH720N | **$89/$88**, first offer accepted; five requests were interest only |

No actual merchant counter occurred in this model execution; counter/accept and numeric changes are proven by the deterministic PostgreSQL and browser tests. Genuine prices were not forced. The preserved model record's legacy text summary was captured before the final display-only summary wording change; structured actions and accepted references are the authority.

### Limits and deployment

Feature commit **d818e5c7d638fbcf6c3cbae438b583b3a42f3f69** was normally pushed under the existing push/redeploy instruction. [GitHub verification run 37727398808](https://github.com/wongywrongy/paypalaihack26/actions/runs/37727398808) completed **successfully**, including all 81 PostgreSQL tests and all 28 desktop/mobile browser checks. Its log is retained at `/tmp/coalition-negotiation-ci.log`. Render subsequently served the exact new `index-D6HQoGSU.js` / `index-B3zl8cv0.css` assets.

A fresh browser used the actual connected **Render API and worker**, without mocked routes, at **04:29:03 UTC**. `docs/model-verification-render-negotiation.json` records a Sony request under $100 with ANC, iPhone and seven-day delivery: buyer offered **$92/$88**, merchant accepted those unchanged prices, buyer accepted the executable quote. Three persisted structured rounds had IDs **16/17/18** and sequences **1/2/3**, with the exact version-one accepted quote reference. The live count was **three compatible requests, zero authorizations**, and no commitment existed. Refresh restored identical rounds and immutable quote. Dedicated checkout displayed the same **$92 maximum**. The browser submitted **one negotiation and zero payment-creation calls**, and stopped before consent/PayPal approval. This verifies the deployed worker writes the new structured events and the additive migration is applied; a matching frontend build alone would not establish that.

No genuine PayPal payment operation, approval or external configuration change was initiated to demonstrate this feature. Existing genuine payment lifecycle gates remain unresolved and are not claimed completed. The deployed public flags report connected mode and configured LLM/PayPal; those flags and this no-payment negotiation do not prove authorization, capture, webhook delivery, void, refund or five-payer settlement. The isolated fixture services and PostgreSQL review container were stopped after verification, retaining database/history and leaving original services running.

---

## Returning-shopper navigation fix — October 8, 2026

A fresh browser on the deployed Render home showed all six current models, and the public catalog matched. The reported Cabin One behavior had an independent session/navigation cause: shopping without an explicit run restored the session cookie's original purchase; checkout's “Return to storefront” also carried that run and product back into shopping. Journey responses exposed retired products and their old matching assessments alongside the current catalog. This could pull a returning shopper back into the historical deal and disable new shopping.

Home shopping now opens/reuses a bounded draft under the same owner. Explicit retired-product storefront links also select a draft; explicit current-group links and protected preparation invitations retain their existing behavior. Checkout returns to `/`. Journey products/assessments are restricted to the active catalog and current source version. A saved request without current assessments remains editable and does not display an old quote as a new search result. Historical checkout, consent, payment operations and purchase history are unchanged.

Executed:

- **78 backend tests passed, zero failures/skips**, disposable PostgreSQL 16, 24.394 seconds; `/tmp/coalition-navigation-backend.log`. The new regression creates a historical Cabin One fixture commitment, opens/reuses home and an old storefront link, preserves the request/owner, excludes retired assessments, and verifies the original checkout/consent/history remain intact.
- TypeScript/Vite build and focused Ruff lint passed; `/tmp/coalition-navigation-build.log`, `/tmp/coalition-navigation-lint.log`.
- **20 desktop/mobile browser checks passed**, 43.8 seconds; `/tmp/coalition-navigation-browser-final.log`. Includes historical checkout → home → refresh → Apple selection → purchase history → original checkout. The first run passed 18 and failed two copies of the existing assertion that the return link should carry the old run; that obsolete expectation was updated to `/` before the complete successful rerun.
- Two manual desktop/mobile journeys used the actual isolated fixture API/worker/database and the previously retained **Cabin One, Paid $85.00 USD** receipt. Both reached a usable six-product home, retained the same draft after refresh, selected AirPods Max, then reopened the unchanged receipt through history. Screenshots: `/tmp/coalition-navigation-debug/recovered-home-{desktop,mobile}.png` and `preserved-receipt-{desktop,mobile}.png`.
- The design detector reported no deterministic findings. The existing layout was preserved.

No connected PayPal operation or model call was initiated. No external configuration was changed. The fix is prepared for the already-authorized normal push/redeploy; the pre-fix live home check does not establish deployment of this fix. Genuine payment acceptance blockers below remain unresolved.

---

## Real-product catalog update — October 8, 2026

The storefront now offers six real models: Sony WH-CH720N, WH-CH520 and WH-1000XM5; Apple AirPods Max (2024 USB-C, Starlight); Bose QuietComfort and QuietComfort Ultra (2nd Gen). Locally served product photographs and manufacturer specification links are recorded in `docs/photography.json`. Two Sony photographs are retailer-sourced; the other four are manufacturer-sourced. The Apple photograph shows the official color range with Starlight foremost. Merchants, USD list/group prices, inventory and delivery remain simulated, with buyer-facing disclosure. This is not brand affiliation or current retail pricing.

New model identities and separate merchant policy IDs preserve the retired fictional products, source versions, policies, inventory and immutable purchases. New matching/negotiation uses only the active catalog; owned historical checkouts retain their original product. Negotiation and consent now use the catalog variant instead of a universal Graphite default. The premium merchant has a materially different $285–$310 / $265–$290 public envelope. Public policy fields agree for products sharing a policy. Private floors remain server-side.

Adding manufacturer provenance exposed a connected-model evidence issue: responses cited URLs rather than capability fields. The existing dynamic assessment schema now restricts citations to catalog field paths; deterministic evidence validation still checks the particular requirement. Brand/model requirements can cite brand/title. Unsupported flight effectiveness remains unknown; Bluetooth/iPhone evidence is limited to basic audio. Buyer bids are instructed to honor the selected merchant's public ranges, without a fixed price target.

### Executed local checks — fixtures and application behavior

- **77 backend tests passed, zero failures or skips**, 24.342 seconds, disposable PostgreSQL 16 schemas; `/tmp/coalition-real-products-backend-final-3.log`. Includes real-model identity/brand evidence, rejecting URL citations, retired-product exclusion and exact AirPods Starlight quote/consent. Existing money, concurrency, ownership and recovery regressions remain covered.
- TypeScript/Vite build and focused Ruff lint passed after the final changes; `/tmp/coalition-real-products-build-final-2.log`, `/tmp/coalition-real-products-lint-final-2.log`.
- **18 desktop/mobile browser regressions passed** in the first run. The expanded run passed 16 and failed two copies of a new ambiguous-heading assertion; a scoped selector fixed the test. The four storefront checks then passed twice, including the final image framing; `/tmp/coalition-real-products-browser-1.log`, `...-browser-final.log`, `...-storefront-final.log`, `...-storefront-confirm.log`. All six photographs loaded; Apple selection shows Starlight and the manufacturer link. Desktop/mobile screenshots are in `.impeccable/review/storefront-{desktop,mobile}.png`.
- **Four real-stack desktop/mobile cases passed**, 4.1 minutes; `/tmp/coalition-real-products-stack.log`. Isolated fixture API, worker and PostgreSQL exercised Sony quote/consent, five fixture authorizations, deadline-driven $85 captures, refresh, cancellation, repeat shopping with another Sony model and history. These provider outcomes are fixtures.
- An owned historical mobile receipt still displayed **Cabin One** and **Paid $85.00 USD** after the catalog switch. The first manual assertion incorrectly expected “Cabin One Headphones”; reading the saved heading and correcting the assertion passed. No historical obligation was renamed or recreated. No API/worker restart proof was rerun this turn; the earlier restart evidence below remains historical.

The first backend run failed 3 tests with 17 errors because the real variants and shared policy identities exposed the old Graphite default and inconsistent public merchant names. Both root causes were fixed; subsequent database runs passed, and two relevant regression tests were added. No failing run has been relabeled as success.

### Genuine configured-model evidence — no payments

`docs/model-verification-real-products.json` records six actual authenticated configured-provider cases, with no model fixtures and **zero PayPal operations**:

| Actual input/selected product | Observed result, three/five buyers |
|---|---|
| ANC, iPhone 12, under $100, a week / Sony WH-CH720N | Accepted **$92 / $88** |
| Bluetooth, iPhone 12, under $80, five days / Sony WH-CH520 | Accepted **$75 / $69** |
| ANC, under $350, fourteen days / Sony WH-1000XM5 | Accepted **$299 / $279** |
| Maximum $66, five days | **No agreement** within three exchanges |
| “Headphones under $100” | **Delivery clarification** |
| Five distinct simulated requirements, Sam under $90 / Sony WH-CH720N | Accepted **$89 / $88**, **zero confirmed authorizations** |

Two earlier executions are retained honestly. `docs/model-verification-real-products-initial-failure.json` recorded URL citations becoming unresolved and failed the positive matching gate. After the field-path schema fix, `docs/model-verification-real-products-second-check.json` accepted the three policy-specific quotes, clarified and declined as expected, but its five-person negotiation exhausted the bound: buyer bids did not respect the public five-person range. The final prompt clarification produced the observed valid agreement above. This is not a guarantee of a future quote or evidence of the specifically requested genuine $89/$85 payment lifecycle.

README, demo instructions, API description, design text and photography provenance were updated. No dependency, service, payment flow, deployment or external configuration was added or changed. Temporary fixture services are stopped after verification; their retained review database/history is not deleted. The original genuine PayPal acceptance blockers below remain unresolved. The earlier Ponytail audit remains applicable; the catalog update reuses the existing schemas, policy seeds, native disclosure and CSS.

---

## Final acceptance audit — October 7, 2026, 20:55 UTC

The preceding turn made concrete progress through implementation cleanup, real-model checks, application tests and restarted receipts. This continuation checked the current worktree, verifier, configuration and live read-only access again. The original implementation review, cleanup review and this acceptance review all encountered the same genuine-payment blocker. No live verification process or pending human-approved provider operation is running for this review.

The read-only connected verifier now requires the frozen five-payer group to be **SUCCEEDED with fulfillment released**, in addition to five confirmed lower captures and completed cleanup refunds. Previously the resource checks alone could pass for an application group that had not confirmed success. Provider orders reuse the existing immutable-order validator, including the original approved merchant after a configuration change. A contract regression rejects SETTLING, UNWINDING, FAILED and unreleased groups despite confirmed fixture resources, and accepts the genuinely structured successful fixture case with its pinned merchant. These fixtures validate the verifier; they are not connected evidence.

Executed after this change: **75 backend tests passed, zero failures/skips**, 26.414 seconds, disposable PostgreSQL 16; `/tmp/coalition-acceptance-gate-backend.log`. Focused lint passed, `/tmp/coalition-acceptance-gate-lint.log`. Frontend and runtime payment logic were unchanged, so the preceding browser/build/restart evidence remains applicable and was not rerun without cause.

| Original acceptance scope | Authoritative evidence and conclusion |
|---|---|
| Stack, one category, five buyers, AI/payment boundaries | Current `render.yaml`, config, six-product public catalog, supported five-person preparation, immutable commitment guards and passing database tests. Five real payer approvals remain missing. |
| 1. PayPal lifecycle | `payments.py`, durable operations, official contracts, recovery/webhook tests and updated read-only verifier establish local behavior. Fresh `paypal-connection-verification.json` at 20:55:17 UTC: OAuth 200, registration 200, connected deployed config 200, operator read 403, local merchant absent. Genuine authorization/capture/webhook/void/refund/five-payer/restart evidence is **not achieved**. |
| 2. Independent repeat shopping and inventory | `shopping.py`, `negotiation.py`, ownership/expiration/different-product/concurrent-reservation/duplicate-submission tests; four desktop/mobile application cases. Local behavior verified; fixture payments disclosed. |
| 3. Input-responsive negotiation and private policy | Current catalog/policy seeds, separate role contexts, deterministic proposal/budget checks and bounded attempts; six genuine configured-model cases in `model-verification-current.json`, earlier result and failures retained. Variation/no agreement proved; zero manufactured authorizations. |
| 4. Clarification and compatibility | Grounded extraction, saved nullable constraints, evidence validation, editable exact-cent chips; clarification, unknown-evidence, policy-eligibility tests and real-model incomplete-request result. Local/model behavior verified. |
| 5. Responsive single worker | Current one-model/two-payment-lane worker, independent connections, durable leases/advisory locks; slow-model deadline/lease-expiry tests, acceptance-time deadlines, token-cache contract and reconciliation backoff. Local behavior verified. |
| 6. Fintech safeguards | Immutable server-calculated consent/amounts, explicit state transitions, stable operations, original-merchant validation, raw verified event persistence/deduplication, owner/operator/CSRF checks, secure cookies/CORS, append-only observations and additive migrations; PostgreSQL/contract tests verify applicable paths. No production-readiness or regulatory claim. Genuine provider outcomes remain unknown until actual lifecycle execution. |
| 7. Storefront preservation | Existing photographs, checkout/history/Magic UI, event-driven progression/reduced motion and terminal actions; 18 desktop/mobile regressions, current application screenshots and saved receipts. Buyer-facing diagnostics remain concise; technical recovery stays operator-only. |
| 8. Meaningful verification and gate | 75 PostgreSQL tests, 18 browser regressions, four desktop/mobile shopping cases, four desktop recovery cases, actual isolated restart receipts, build/lint and CI definition. Failures/skips/fixture limits are recorded below. Genuine acceptance is explicitly not inferred from these checks. |
| Delivery, cleanup and Ponytail audit | Current README/API/OpenAPI/Postman, `docs/DEMO.md`, this evidence record, 968 runtime/style lines removed, retired plans and creation paths removed, call-site/dependency audit performed. Historical recovery retained. Git metadata is unavailable, so branch comparison and reviewable Git commits remain unavailable. |

**Completion is unproven and the goal is blocked on external access/human approval.** No further independent implementation action can create the missing genuine evidence. Privately configure the sandbox merchant ID and valid deployed operator token, authorize running the reviewed revision on the existing Render services while preserving obligations, and complete the five human approvals and separate void/refund sequence in `docs/DEMO.md`. Re-run the read-only verifier against those connected run IDs. Do not substitute the latest $89/$88 model quote for the specifically requested $89/$85 evidence, or rewrite immutable terms to manufacture that price.

---

## Latest implementation cleanup and audit — October 7, 2026

**The local implementation and cleanup checks pass. The full requested genuine PayPal lifecycle remains incomplete.** No deployment, payment mutation, external configuration change or manufactured payment evidence was performed. The original local services were not restarted. This is a sandbox application, with no compliance or production-readiness claim.

### Changes and removed plans

- Removed the retired multi-category storefront, demo bag, overlay, checkout assistant creation endpoint, opportunity endpoint, unused icons, config lookup and their unused CSS. `/` and `/shop` now use the existing headphone storefront; owned checkout, history, photographs and Magic UI remain. Corrected the selected merchant label and constrained editable budgets to exact cents.
- New operator preparation accepts only the supported five-person headphone scope and known scenarios. Preparation after activation is rejected. Removed runtime creation and seeds for old calculator/large demos, moving their regression construction into `tests/legacy_fixtures.py`. Historical terms, migrations, receipts and recovery jobs remain; no obligations or payment history were deleted.
- Reused each catalog policy's public fields when seeding backend-private policy. Removed superseded `.impeccable` direction/quality-bar plans and obsolete overlay audit exemptions/cache; retained current design tokens and review evidence. Updated API/OpenAPI/Postman documentation for the remaining endpoints.
- Fresh real-model checks exposed over-budget buyer bids, comparisons of transient proposal versions instead of tier prices, and prepared-demo demand including unrelated shoppers. Deterministic bid validation, safe role-specific feedback, price comparison/final-turn instructions, and run-scoped prepared demand fix those causes within the existing six-call budget. Ordinary shopping still matches compatible demand across ordinary runs. No target price was forced.

Compared with `/tmp/coalition-cleanup-before`, runtime backend code decreased by **207 lines** and frontend code/styles by **761 lines**: **968 net lines removed**, no dependency added. Built CSS fell from 56.25 kB to 42.36 kB. The snapshot and `/tmp/coalition-before` preserve review provenance; the workspace's inaccessible Git metadata still prevents branch/commit comparison or creation of focused Git commits.

### Checks actually executed

| Check | Result and evidence |
|---|---|
| Disposable PostgreSQL backend suite | **74 passed, zero failures or skips**, 23.660 seconds; `/tmp/coalition-cleanup-backend-final.log`. Includes three new checks for supported preparation/private policy seeds, buyer-budget/private-context feedback, and five-person demand isolation. Existing ownership, stock concurrency, leases, deadlines, consent, webhook ordering and payment recovery checks remain. |
| Desktop/mobile API/provider browser fixtures | **18 passed**, 41.0 seconds; `/tmp/coalition-cleanup-browser-2.log`. Current storefront, exact-cent edits, checkout, SDK retry, approval return/cancel, keyboard order and narrow layouts. |
| Desktop/mobile application stack | **4 passed**, 4.1 minutes; `/tmp/coalition-cleanup-stack-shopping.log`. Real isolated API/worker/PostgreSQL; fixture AI/payment resources. Five $89 approvals/$85 captures, deadline, refresh, clarification, repeat shopping, preserved history and cancellation. |
| Desktop application settlement/recovery | All **four scenarios passed** across the final recovery run and success retry: success, below-minimum deadline/void, partial capture compensation, and pending refunds with guarded archive. `/tmp/coalition-cleanup-stack-recovery-2.log` contains three passes and a success-case UI assertion failure; `/tmp/coalition-cleanup-stack-success-3.log` contains the corrected success pass. These are four distinct fixture cases, not genuine PayPal evidence. Mobile versions of these four fault scenarios were not rerun. |
| Actual API/worker restart | Both saved desktop/mobile owned receipts retained confirmed $85 fixture capture after service restart and another refresh. `/tmp/coalition-cleanup-receipt-restart.log`. The current code was loaded on both review services. |
| Build and focused lint | TypeScript/Vite build and Ruff passed; `/tmp/coalition-cleanup-build-final.log`, `/tmp/coalition-cleanup-lint-final.log`. OpenAPI regenerated. No remote CI run claimed; the existing PostgreSQL/build/browser gate remains. |
| Visual inspection | Current mobile receipt inspected; photos, price hierarchy, closed state, tier progress and confirmed fixture receipt remain readable. `.impeccable/review/negotiated-*` and `repeat-shopping-*`. |

Intermediate failures are retained: cleanup briefly removed the active status handler, old test setup still patched the runtime rather than test fixture settings, and retired endpoint assertions assumed 404 where the static mount can return 405. The corrected database suite passes. The first stack run activated before fixture preparation finished; the test now awaits confirmed membership. The success refund assertion initially allowed five seconds while terminal receipt polling takes ten; its fifteen-second assertion passes. No timer was used to fabricate funding or settlement. Fresh model failure records remain at `docs/model-verification-cleanup-failure.json` and `docs/model-verification-cleanup-second-failure.json`; deterministic validation refused those invalid/unaccepted offers. Earlier failures and the local-isolation diagnostic are described in the prior record below.

After the restart checks, the isolated review API/worker and PostgreSQL container were stopped. Their database, owned receipt snapshots and verification logs were retained. No original service was stopped or restarted.

### Genuine provider evidence, separate from fixtures

The latest authenticated configured-model execution passed all six cases in `docs/model-verification-current.json`: Cabin One **$92/$88**, Air Light **$75/$69**, Travel Studio **$120/$110**, no agreement at a **$66 maximum**, delivery clarification for **“Headphones under $100”**, and the five distinct prepared requirements accepting **$89/$88**. All five request evaluations completed. **Zero payment operations and zero confirmed authorizations**. The earlier successful five-person $89/$85 observation is preserved in `docs/model-verification-prior-success.json`. Variation is real; the future quote is not guaranteed.

Fresh read-only PayPal evidence at **20:27:51 UTC** in `docs/paypal-connection-verification.json`: sandbox OAuth **200**, existing wildcard webhook registration **200**, connected deployed config **200**, deployed operator read **403**. The local merchant ID remains absent. Registration is not verified delivery. **No genuine $89 authorization, $85 capture, processed signature-verified webhook, void, refund, five-payer settlement or restart receipt was established.** Official PayPal lifecycle conclusions and contracts remain documented below.

### Remaining gates and exact human steps

An authorized operator must provide the existing sandbox merchant ID privately, use the valid deployed operator token, and run this same revision on the existing API/worker and preserved database. This review did not deploy or change external configuration. The current Render operator endpoint rejects the available token, so a connected prepared checkout cannot be claimed ready.

Follow [`docs/DEMO.md`](docs/DEMO.md): prepare a five-person run with 1,800 seconds; open five protected browser profiles; wait for genuine evaluations; negotiate and review the actual immutable quote. For the requested $89/$85 proof, proceed only if those are the observed terms. Four distinct sandbox humans approve $89 on PayPal; the judge approves the fifth. Verify all five $85 captures plus a processed signature-verified app webhook, refresh after worker restart, then separately prove cancellation/confirmed void and completed capture refunds. Run `scripts/check_connected.py SUCCESS_RUN_ID VOID_RUN_ID` against that connected database and save its real redacted output. Interest and fixture preparation cannot substitute for these approvals. Pending and unknown results stay unresolved.

### Ponytail audit after cleanup

Whole-tree runtime/dependency review, with call sites checked in backend, frontend, scripts, tests and migrations. The earlier private-policy duplication and dead CSS findings were applied as part of the explicitly requested cleanup. No further safe complexity cuts were found: single-reference FastAPI handlers are registered callbacks, Magic UI is required, and the historical decision handler is still referenced by the worker for durable jobs. Payment operations, consent records, additive migrations and historical catalog metadata are necessary recovery code.

Complexity audit result: **Lean already. Ship.** This describes complexity only; the genuine payment acceptance gates above remain unsatisfied. **net: 968 lines removed, 0 dependencies removed; no further deletion recommended.**

---

## Earlier implementation review — October 7, 2026

**Local implementation and verification are complete; genuine connected payment acceptance is still blocked.** No deployment, PayPal payment mutation or external configuration change was performed in this review. App OAuth and webhook-registration reads are genuine; every authorization/capture/void/refund result below is explicitly a fixture. The configured model was called genuinely. This sandbox project makes no regulatory-compliance or production-readiness claim.

The supplied workspace has empty, read-only `.git` and `.agents` directories and no accessible `AGENTS.md`. A branch/head comparison with commit `31cf9f0`, reviewable Git commits and a push were therefore unavailable. Changes were checked against the actual supplied code and useful existing payment/checkout safeguards retained; a before-copy is at `/tmp/coalition-before`. Historical entries below are prior observations, not new deployment or payment proof. In particular, their global $86 exclusion examples are superseded by product-specific pricing policies.

### What changed

- Shopper identity and purchase history now survive selection of another group. Ordinary shopping needs no prepared run. Compatible open groups reuse their reserved capacity, even when free catalog stock is zero; different products get independent drafts. Owner-scoped duplicate work, expired/terminal deals and unresolved previous attempts are handled explicitly.
- Three merchant policies, distinct five-person requirements and private/public role contexts replace the universal $89/$85 instruction. Every executable quote is checked against merchant quantity/price/inventory/delivery authority and lead-buyer eligibility. Interest is not authorization. Atomic reservations prevent two accepted negotiations consuming the same stock. Existing calculator and large-run obligations remain recoverable; new large negotiations are outside the new policies and fail explicitly.
- Missing budget/delivery information becomes a saved clarification. Grounded request spans and exact Decimal budget conversion prevent invented constraints. Required yes/no/unknown evidence must substantiate the particular requirement; unknowns block eligibility. Provider failure, invalid output, unsupported requirements and no matches have separate states. Repairs and negotiation calls/tokens/time are bounded.
- One worker process has one model lane and two payment/deadline lanes, independent connections, durable leases and session job locks. A slow call cannot occupy all payment capacity, and lease expiry cannot cause another worker to execute the same still-running job. Funding time starts on acceptance. Superseded results are ignored; a crashed model attempt is not silently given another budget.
- Durable payment operations and stable identifiers remain. Exact provider amounts, immutable consent/request snapshots, explicit status transitions, final lower capture, confirmed resource-based voids, pending refunds and unknown-outcome reconciliation are retained/strengthened. The approved merchant is pinned across configuration changes; fresh charges to another merchant are blocked while original obligations can still be observed for recovery.
- Verified raw webhooks persist before acknowledgement; altered duplicates cannot replace an event. Resource parent/merchant checks and separately labeled historical webhook/current reconciliation observations protect against delayed events. OAuth/HTTP connections are reused; unresolved-resource polling backs off and settled purchases stop periodic fetching.
- Existing photographs, storefront, checkout, history and Magic UI remain. Clarification, editable chips, factual negotiations, available tiers, terminal actions and “Find another deal” have desktop/mobile coverage. Buyer diagnostics are concise; model/payment jobs and recovery details are operator-only. Preparation fragments, disabled access logging, suppressed referrers, exact-origin CSRF checks and secure HTTPS cookies protect session/approval data. No new runtime dependency or service was added.

### Checks actually executed

| Check | Latest executed result and limits |
|---|---|
| Backend unittest suite | **71 passed, 0 failures, 0 skips**, 22.790 seconds. Actual disposable PostgreSQL 16 schemas on review port 55446; no database test skipped. `/tmp/coalition-backend-final-9.log`. Payment/model doubles remain fixtures. |
| Covered database/payment risks | Repeat/expired shopping, separate products/owned tabs, simultaneous stock reservation, duplicate requests/checkouts, saved clarification, policy-specific prices, unsupported/unknown evidence, decline/invalid proposals, slow AI versus deadlines, lease expiry, duplicate/out-of-order verified events, ambiguous remote success, restart recovery, lower capture, partial group failure, pending/failed refunds, immutable consent/merchant and unauthorized receipt access. |
| Browser API/provider fixtures | **18 passed**, desktop/mobile, 42.7 seconds. Keyboard order, PayPal SDK failure/retry, return/cancel validation, persistent checkout and narrow layouts. `/tmp/coalition-browser-final-mocks-3.log`. |
| Browser application stack | **4 passed**, desktop/mobile, 4.1 minutes. Actual isolated API, worker and PostgreSQL; fixture AI/payments. Five approvals, actual 90-second application closing, $89 maximum/$85 capture, refreshed receipt; incomplete request clarification, another product, retained history and confirmed fixture cancellation. `/tmp/coalition-browser-final-stack-2.log`. |
| Actual process restart | Two saved owned receipts, desktop/mobile, retained $85 fixture captures after terminating and restarting the review API/worker, then refreshing again. `/tmp/coalition-receipt-restart.log`. Separate timeout-after-remote-success database test confirms no duplicate capture. |
| TypeScript/Vite build | Passed; `/tmp/coalition-build-final.log`. |
| Focused Ruff checks | Passed for backend, tests and scripts; `/tmp/coalition-lint-final.log`. |
| Visual checks | Existing Impeccable review returned no detector findings. Desktop negotiation and mobile receipt inspected; mobile tier labels received explicit spacing. Latest screenshots `.impeccable/review/negotiated-*` and `repeat-shopping-*`; reduced motion retained. |
| Automated gate | Added `.github/workflows/verify.yml`: real PostgreSQL suite, focused lint, build and 18 desktop/mobile fixture regressions. Equivalent local commands executed; no remote CI run claimed. |

Earlier checks failed and were corrected rather than hidden: live extraction hallucinated features/mis-scaled money, role ambiguity produced merchant acceptance without a quote, and valid `specs.ANC: Yes` evidence was rejected. Grounded required schemas, specific evidence support and explicit role proposal contracts corrected these; final live cases passed. The initial live failure record is `docs/model-verification-initial-failure.json`. Two ordinary-shopping browser assertions initially raced asynchronous URL updates; awaiting navigation fixed them. Two keyboard regressions needed the newly visible “Find another deal” link in their expected order. An intermediate 71-test run failed because its merchant-change setup used an unpinned fixture merchant and an older test expected fields removed from the safe commitment response; corrected checks assert a genuinely pinned merchant, minimal response and database authorization state. The latest run passes. A diagnostic shell also used unavailable `python`; rerun with `.venv/bin/python` succeeded. Repeated runs are not counted as additional distinct checks.

An early model-only diagnostic imported cached `.env` settings before selecting its disposable schema, so it touched the existing **local fixture** database: additive migration/seeds and one simulated shopper request/quote. It stopped on the zero-operation-history assertion; no provider payment was initiated and no payment history was removed. A fail-early settings/isolation guard now prevents that invocation. All reported final model and database checks used disposable schemas. Existing obligations were preserved.

The temporary review API/worker and dedicated review PostgreSQL container were stopped after verification; their data and logs were retained. The original local services were not restarted.

### Genuine configured-model evidence

[`docs/model-verification-prior-success.json`](docs/model-verification-prior-success.json) records the earlier real calls to the configured authenticated Qwen/Ollama gateway with payment credentials disabled in a disposable schema. Observed accepted tiers were:

| Requirements | Observed 3 / 5 buyer totals |
|---|---|
| Noise cancellation/iPhone, under $100, seven days; Cabin One | $92 / $88 |
| Bluetooth/iPhone, under $80, five days; Air Light | $75 / $69 |
| Proven flight noise reduction, under $140, fourteen days; Travel Studio | $115 / $108 |
| Maximum $66, five days; Air Light | No agreement; executable merchant-floor and buyer-budget checks prevented acceptance. |
| “Headphones under $100” | Clarification about delivery timing; no invented deadline. |
| Five distinct Maya/Leo/Aisha/Noah/Sam requirements; Cabin One | $89 / $85; all five request evaluations completed. |

These buyers are simulated interests. **Zero payment operations and zero confirmed authorizations** were created by the model check. Compatible interest changes the negotiated context without becoming funding. The observed output is evidence of this run, not a guarantee of identical future model output.

### Genuine PayPal evidence and documentation checks

[`docs/paypal-connection-verification.json`](docs/paypal-connection-verification.json) records sandbox OAuth HTTP 200, registered webhook retrieval HTTP 200, its existing listener `https://paypalaihack26.onrender.com/api/paypal/webhook` and wildcard events. Deployed `/api/config` returned connected/configured. That is app/registration evidence only: **no genuine authorization, capture, void, refund or received/processed webhook was established**. The local merchant ID is absent; the available local operator token received HTTP 403 on Render. Secrets were not printed or added to evidence.

Verified against official PayPal documentation:

- Authorizations have a 29-day validity period and three-day honor period. This app conservatively requires timestamps plus a five-minute margin within both windows; expiry alone does not justify capture. [Authorize and capture](https://developer.paypal.com/v5/checkout/auth-capture/).
- Final partial capture sends `final_capture=true`, preventing additional captures on that authorization. The application does not invent a separate void event or immediate bank-hold release. Void HTTP 204 is followed by retrieval of the actual authorization, whose identity, original amount and `VOIDED` state must match. [Capture](https://developer.paypal.com/api/payments/v2/authorizations-capture), [void](https://developer.paypal.com/api/payments/v2/authorizations-void).
- Orders create/authorize document six-hour request-ID storage; the application uses a conservative five-hour automatic retry boundary. Payments endpoint documentation does not establish one universal retention duration, so unknown capture/refund outcomes default to reconciliation/manual recovery instead of a fresh mutation. [Create order](https://developer.paypal.com/sdk/orders/v2/orders-create/), [authorize order](https://developer.paypal.com/sdk/orders/v2/orders-authorize/).
- Pending/declined/reversed/refunded capture and pending/failed/canceled/completed refund states remain explicit. Current provider resource observations cannot be overwritten by a delayed historical notification. [Refund capture](https://developer.paypal.com/api/payments/v2/captures-refund), [webhook event relationships](https://developer.paypal.com/api/rest/webhooks/event-names/).
- Verification uses the configured app/webhook registration and preserves original bytes. Verified events are durable before success acknowledgement, deduplicated and relationship-checked before processing. Registration or simulated postbacks are not delivery proof. [REST webhooks](https://developer.paypal.com/api/rest/webhooks/rest/).

Contract fixtures in `tests/fixtures/paypal_official.json` cite the official PayPal OpenAPI specifications and preserve realistic resource shapes, including empty void responses, related resources and refund links. Passing those contracts does not establish sandbox account behavior.

### Remaining gates and exact human actions

The full requested genuine payment completion standard has **not** been met. An authorized operator must supply the missing private merchant ID, make this same revision run on both existing Render services without replacing the database, and use the actual deployed operator token. No such deployment/configuration action was taken here.

Follow [`docs/DEMO.md`](docs/DEMO.md): prepare small/1,800 seconds, open the five protected profiles, wait for five real evaluations, negotiate actual $89/$85 terms, obtain four distinct human sandbox approvals, and leave Sam's fifth PayPal approval to the judge. Wait for five confirmed $85 captures and a processed signature-verified webhook. Refresh the receipt after a worker restart. Separately cancel an authorized below-minimum run before capture and confirm its provider void, then explicitly refund the completed captures and await confirmation. Run `scripts/check_connected.py SUCCESS_RUN_ID VOID_RUN_ID` against that same connected database and retain its genuine output. Unknown outcomes remain unresolved. No human approvals or payment evidence may be substituted by interest, fixture preparation or a replay.


---

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
