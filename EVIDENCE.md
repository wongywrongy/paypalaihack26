# Rally evidence

## October 22, 2026 — version 2 and CAD foundation

Imported the two signed branch revisions through `fb2772c9` (solo international shopping), preserving local purchases, payment operations and the approved running preview. Shell Git DNS is unavailable. GitHub connector import verified both signed commit identities and both trees. One oversized reference image, `design/mockup/flow.png`, could not be downloaded through the contents API and is omitted locally via the index; all application source, scenario data and individual reference screens are present.

[Backend run 39871010940](https://github.com/wongywrongy/paypalaihack26/actions/runs/39871010940), source `46041581`, passed **37 backend tests against PostgreSQL 16 with no skips**, including additive hold-currency migration and USD/CAD lifecycle contracts. Ruff, the parent frontend build/render checks, 48 parent-version Playwright cases and eight Taste checks passed; CLI console had zero errors/warnings. Those frontend counts concern the retired interface, not GD2. Provider responses were doubles; this is not G1 evidence.

Read-only preflight at 23:02 UTC: PayPal identifiers/credentials and DATABASE_URL are configured privately; local TCP bind was denied, PostgreSQL returned OperationalError, and sandbox OAuth returned ConnectError. No credential value was printed or copied. Rootlane can observe the existing frontend but cannot execute G1 remotely. No provider mutation, account preference, webhook destination, Render configuration or external route changed. **G1 remains open**, now requiring completed CAD evidence as well as the USD lifecycle, payout and genuine reconciled webhook. [Exact three-approval procedure](docs/DEMO.md#g1-three-human-paypal-approvals).

GD2 work replaces the group-order UI; its actual rendered checks and critique will be recorded separately. Earlier sections below are preserved historical evidence for the retired group-order implementation, not proof of v2 agents, payments or fulfillment.

## October 22, 2026 — visible bargaining example

[Run 39860472878](https://github.com/wongywrongy/paypalaihack26/actions/runs/39860472878), source `a4533264`, passed 31 backend tests with PostgreSQL available, Ruff/build/render/preview-host checks, **48 Playwright cases** and eight Taste inspections with zero FAIL. Initial/final CLI console: zero errors/warnings. Four Playwright cases are fixture-only; provider calls use doubles. Twelve changed-screen JPEGs were hash-verified and visually reviewed. [Demo, screenshots and limits](frontend/design/bartering.md).

The verified build was atomically published to the existing Rootlane preview at 21:57 UTC; readiness and HTTPS were verified. This exposes reconstructed example buyer/shop proposals and their changes. It does not run live agents, a solver or payment mutations, and does not pass G1/G2/G3. No stored purchases or payment records were changed.

## October 22, 2026 — interface refinement

[Run 39854036017](https://github.com/wongywrongy/paypalaihack26/actions/runs/39854036017), source `f9fc421`, passed 31 PostgreSQL-backed backend tests, Ruff/build/render/preview-host checks and **42 Playwright tests**. Eight pinned Taste inspections at 1440/768/390 px returned zero FAIL; all 24 viewport contexts reported zero console errors. Two reviewers inspected all 48 hash-verified JPEGs. [Review, changes, screenshots and limits](frontend/design/polish-review.md). Provider operations remain test doubles; this is not G1 evidence.

The verified fixture build replaced the static files in the already-approved Rootlane environment at 21:09 UTC; Rootlane reported ready with HTTPS verified. Previous index and hashed assets were retained. No recipe, public route, PayPal setting or stored purchase was changed. Native zoom, screen-reader speech and physical touch remain unexecuted; bounded financial type does not double fully with the ordinary-text enlargement test.

[Instrumented cleanup run 39855743652](https://github.com/wongywrongy/paypalaihack26/actions/runs/39855743652), source `1a589066`, passed the same 31 backend/42 browser tests and eight Taste checks with temporary image transport removed. Its initial-console query identified a 404 for `/favicon.ico`; an explicit Rally SVG favicon and resource/MIME regression case were added afterward. The suite now discovers 44 browser cases. Main-page screenshots remain valid; this last change affects the browser icon only.

## October 22, 2026 — verified source

PLAN.md on `rally` (October 22) is authoritative. The original workspace and database contents were preserved; implementation is in the isolated `.worktrees/rally` checkout. No Render deployment, PayPal configuration, public route or Rootlane environment was changed.

- **Green CI:** [run 39843746928](https://github.com/wongywrongy/paypalaihack26/actions/runs/39843746928), application commit `9016d26c`: **31/31 backend tests passed against PostgreSQL 16**, Ruff, clean npm install, frontend build and nine server-render checks passed. PayPal uses test doubles here.
- **Playwright CLI actually executed:** pinned 0.1.22 with runner Chrome; eight routes at 390×844 with reduced motion, plus desktop deal room at 1440×900. Font readiness and page-overflow checks passed; final console reported zero errors/warnings.
- **Browser suite:** **28/28 passed**, including desktop/mobile journeys, the direct receipt route, safe question default/revision, viewport bounds, Tab/Enter navigation and focused ArrowRight table scrolling. Mobile row labels stay visible at both scroll extremes. [Artifact: 26 screenshots and CLI logs](https://github.com/wongywrongy/paypalaihack26/actions/runs/39843746928/artifacts/12454052411) contains nine CLI captures and seventeen test captures.
- **Local checks:** 26 backend passes, five PostgreSQL skips; Ruff, build, server-render checks and two fixture-only Playwright tests passed. A filtered Playwright invocation initially tried its configured web server and failed to start; supplying `RALLY_E2E_URL` skipped that server for the two browser-independent fixture cases. Local sockets/browser execution are blocked; attempted sandbox escalation was rejected because it is disabled. CI supplies the actual database/browser evidence.
- **Fixture arithmetic:** shares reconcile to $513.52; reference member $66.66, max $75, illustrative solo baseline $121.58. This validates the committed fixture, not an implemented M2 allocator or live negotiation.

## Failures found and corrected

- [Initial PostgreSQL CI](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837098056): 29 passes, one order-completion error. Fixed top-level order identity; added a realistic regression that failed before the fix.
- [Initial browser CI](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837501453): 22 passes, two stale question-copy assertions. Updated the preview disclosure check and revision coverage. [Following run](https://github.com/wongywrongy/paypalaihack26/actions/runs/39838057050) timed out in apt before browsers ran; installation is now bounded and avoids that apt update.
- [First CLI run](https://github.com/wongywrongy/paypalaihack26/actions/runs/39839797807): seven member captures succeeded, mobile deal room overflowed. Fixed the grid minimum and strengthened viewport assertions. The green run above confirms the correction.
- [Image-review run](https://github.com/wongywrongy/paypalaihack26/actions/runs/39841614040): 23/24 browser checks passed; Done's image assertion raced decoding. Replaced the instant check with a bounded readiness assertion. Following runs passed; no arbitrary sleep or test retry was added.

## Remaining gates

- **G1 not passed:** no genuine order, authorization, capture, void, refund, payout or verified webhook was executed; no provider IDs exist for this run. After the owner's update, `PAYPAL_MERCHANT_ID` and `PAYPAL_SHOP_EMAIL` both load privately from the existing `.env`. Read-only PostgreSQL preflight still returned `OperationalError`; PayPal sandbox OAuth returned `ConnectError`. No credential values were printed or copied. Reachable runtime access remains necessary.
- **Retired GD passed:** ten group-order captures were recovered and hash-verified; two independent Impeccable assessments inspected them. That 34/40 assessment applies only to the retired interface. [Historical screenshots and limits](frontend/design/GD.md). V2 GD2 requires its own rendered verification and critique. Screen-reader, native zoom and physical-device checks remain unexecuted.
- **M2–M5 not started:** current PLAN.md requires G1 before the main engine work. V2 design uses an explicit recorded-event test harness; it does not establish connected payment success. [Current G1 procedure](docs/DEMO.md#g1-three-human-paypal-approvals) specifies the three human approvals and reconciliation steps.
- The new migration targets only `rally`; existing public tables and Compose volume names are preserved. No database or volume deletion was performed.
