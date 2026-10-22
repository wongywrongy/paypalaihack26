# Rally evidence

## October 22, 2026 — interface refinement

[Run 39854036017](https://github.com/wongywrongy/paypalaihack26/actions/runs/39854036017), source `f9fc421`, passed 31 PostgreSQL-backed backend tests, Ruff/build/render/preview-host checks and **42 Playwright tests**. Eight pinned Taste inspections at 1440/768/390 px returned zero FAIL; all 24 viewport contexts reported zero console errors. Two reviewers inspected all 48 hash-verified JPEGs. [Review, changes, screenshots and limits](frontend/design/polish-review.md). Provider operations remain test doubles; this is not G1 evidence.

The verified fixture build replaced the static files in the already-approved Rootlane environment at 21:09 UTC; Rootlane reported ready with HTTPS verified. Previous index and hashed assets were retained. No recipe, public route, PayPal setting or stored purchase was changed. The initial CLI-open error count remains a diagnostic to inspect; the final query and Taste contexts were clean. Native zoom, screen-reader speech and physical touch remain unexecuted; bounded financial type does not double fully with the ordinary-text enlargement test.

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
- **GD passed:** ten exact captures were recovered and hash-verified; two independent Impeccable assessments inspected them. The mobile table finding is fixed; final score 34/40, zero source-detector findings, no unresolved P0–P2 findings within fixture scope. [Screenshots, critique and limits](frontend/design/GD.md). Screen-reader, zoom and physical-device checks remain unexecuted.
- **M2–M5 not started:** PLAN.md requires G1 before the main engine work. Member screens remain labeled fixture previews. [G1 procedure](docs/DEMO.md#g1-the-two-human-approvals) specifies the two human approvals and reconciliation steps.
- The new migration targets only `rally`; existing public tables and Compose volume names are preserved. No database or volume deletion was performed.
