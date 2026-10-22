# Rally evidence

## October 22, 2026 — verified source

PLAN.md on `rally` (October 22) is authoritative. The original workspace and database contents were preserved; implementation is in the isolated `.worktrees/rally` checkout. No Render deployment, PayPal configuration, public route or Rootlane environment was changed.

- **Green CI:** [run 39840487958](https://github.com/wongywrongy/paypalaihack26/actions/runs/39840487958), application commit `f5f4d0a`: **31/31 backend tests passed against PostgreSQL 16**, Ruff, clean npm install, frontend build and nine server-render checks passed. PayPal uses test doubles here.
- **Playwright CLI actually executed:** pinned 0.1.22 with runner Chrome; eight routes at 390×844 with reduced motion, plus desktop deal room at 1440×900. Font readiness and page-overflow checks passed; final console reported zero errors/warnings.
- **Browser suite:** **24/24 passed**, including desktop/mobile journeys, the direct receipt route, safe question default/revision and viewport bounds. [Artifact: 25 screenshots and CLI logs](https://github.com/wongywrongy/paypalaihack26/actions/runs/39840487958/artifacts/12451474681) contains nine CLI captures and sixteen test captures.
- **Local checks:** 26 backend passes, five PostgreSQL skips; Ruff, build, server-render checks and two fixture-only Playwright tests passed. Local sockets/browser execution are blocked; attempted sandbox escalation was rejected because it is disabled. CI supplies the actual database/browser evidence.
- **Fixture arithmetic:** shares reconcile to $513.52; reference member $66.66, max $75, illustrative solo baseline $121.58. This validates the committed fixture, not an implemented M2 allocator or live negotiation.

## Failures found and corrected

- [Initial PostgreSQL CI](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837098056): 29 passes, one order-completion error. Fixed top-level order identity; added a realistic regression that failed before the fix.
- [Initial browser CI](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837501453): 22 passes, two stale question-copy assertions. Updated the preview disclosure check and revision coverage. [Following run](https://github.com/wongywrongy/paypalaihack26/actions/runs/39838057050) timed out in apt before browsers ran; installation is now bounded and avoids that apt update.
- [First CLI run](https://github.com/wongywrongy/paypalaihack26/actions/runs/39839797807): seven member captures succeeded, mobile deal room overflowed. Fixed the grid minimum and strengthened viewport assertions. The green run above confirms the correction.

## Remaining gates

- **G1 not passed:** no genuine order, authorization, capture, void, refund, payout or verified webhook was executed; no provider IDs exist for this run. Read-only PayPal preflight returned `httpx.ConnectError`. Merchant ID and separate shop payout email remain missing; owner is preparing private configuration and reachable runtime access.
- **GD awaits image inspection:** actual captures exist, but downloading them to this host is blocked. Automated rendering passed; an image critique has not been claimed. See [GD.md](frontend/design/GD.md).
- **M2–M5 not started:** PLAN.md requires G1 before the main engine work. Member screens remain labeled fixture previews. [G1 procedure](docs/DEMO.md#g1-the-two-human-approvals) specifies the two human approvals and reconciliation steps.
- The new migration targets only `rally`; existing public tables and Compose volume names are preserved. No database or volume deletion was performed.
