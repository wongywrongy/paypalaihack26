# Rally evidence

## October 22, 2026 — source and track setup

- Source: `rally` at `b3b27b6ee2fff29bb55a6206696680d8b67f51eb`; 154 files and the Git tree were checked against GitHub. Restored a clean shallow checkout through the GitHub connector because shell DNS is blocked and the original workspace has no writable Git metadata.
- Working checkout: `/home/kyle/code/paypalaihack26/.worktrees/rally`. Original local Coalition work and all database contents remain untouched.
- Exact Design track and M0 + M1 prompts were extracted from PLAN.md. Separate fresh agent contexts completed their source changes; standalone Codex CLI sessions cannot initialize their read-only app-server storage.
- GD and G1 are **not passed**. No live provider outcome, screenshot or new deployment is claimed by this setup entry.
- Actual credential inventory only: sandbox client/secret/webhook configured in the original private environment; merchant ID and shop payout email missing. No values copied or printed. No disposable test database configured.

## October 22, 2026 — M0/M1 and design source verification

- Retired Coalition runtime, old catalog assets, migrations and obsolete tests/reports removed from this branch. New payment ledger, signature-verification worker, isolated `rally` schema and resumable sandbox script implemented. Existing database tables and volumes were not changed.
- Backend: **25 passed, 5 PostgreSQL tests skipped** because no disposable database is accessible. Ruff and Python compilation passed. These are unit/contract doubles, not provider evidence.
- Frontend: production build passed; reusable server-render checks passed for eight routes plus recovery. Playwright discovered 24 tests; the two fixture-only cases passed. The 22 browser cases remain unexecuted. Scenario arithmetic reconciles to $513.52; this is fixture validation, not a working M2 engine.
- Playwright CLI was used as requested. Its default cache is read-only; a writable task-local cache still produced daemon exit 1 without a usable error. Vite cannot bind a port in this sandbox and cached Chromium also reports `Operation not permitted`. No current screenshots exist. Outside-sandbox browser execution was rejected because sandbox escalation is disabled.
- Read-only PayPal connectivity preflight returned `httpx.ConnectError`. No order, authorization, capture, void, refund or payout was created; no provider IDs exist for this run. G1 is **not passed**.
- Compose configuration validates with the retained `paypalaihack26_coalition_data` volume and three existing service types. No container, Rootlane environment, deployment, PayPal app or public route was changed.
- GD remains **pending actual browser renders and interaction review**. Exact Playwright CLI capture commands and critique status: [frontend/design/GD.md](frontend/design/GD.md). G1 human approval procedure: [docs/DEMO.md](docs/DEMO.md) and `scripts/paypal_sandbox.py --help`. M2–M5 have not started; PLAN.md requires G1 first.

## October 22, 2026 — first PostgreSQL CI run

- Published the source to `rally` (`8a26f55`); no deployment configuration was applied externally.
- [Actions run 39837098056](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837098056) executed all 30 backend tests with PostgreSQL 16: **29 passed, 1 error**. Order completion incorrectly read an ID from the purchase unit. Corrected it to use the validated top-level order, with a realistic local regression that failed before the fix.
- Local correction checks: **26 passed, 5 PostgreSQL skips**, Ruff and diff checks passed. CI rerun is required. Initial CI stopped before frontend/browser steps, so no screenshots or browser pass are claimed.

## October 22, 2026 — rendered CI verification

- [Actions run 39837501453](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837501453), commit `3794a77`: **31/31 backend tests passed with PostgreSQL 16**, Ruff, clean dependency install, frontend build and server-render checks passed. PayPal remained mocked in these tests.
- Actual Chromium: **22/24 passed**, including every route capture and the member journey on desktop and mobile. Both failures were the same stale question-copy assertion after the honesty correction. Updated that assertion to require the preview disclosure and also test revising the choice; rerun pending.
- [16 screenshots and failure traces](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837501453/artifacts/12450874005) were produced. Artifact retrieval to this host is blocked, so actual image critique remains pending; GD is not signed off. Local Playwright CLI and a narrower loopback-only bind remain blocked. No outside-sandbox execution occurred.
- [Run 39838057050](https://github.com/wongywrongy/paypalaihack26/actions/runs/39838057050), `9adf772`: backend 31/31, Ruff, build and server-render checks passed; the job timed out during the browser install's apt mirror update before any browser tests ran. Added pinned Playwright CLI captures using runner Chrome, bounded install steps, and removed the stalled apt update from browser installation. This new workflow still requires an actual run.
- [Run 39839797807](https://github.com/wongywrongy/paypalaihack26/actions/runs/39839797807), `701f735`: Playwright CLI genuinely captured all seven member routes at 390 px with reduced motion ([artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39839797807/artifacts/12451613734)), then detected horizontal overflow in the mobile deal room. Changed the mobile grid track to `minmax(0,1fr)` and strengthened the existing browser test against the configured viewport. Next CI must confirm this fix; screenshots now precede assertions so failures retain evidence.
