# GD evidence — 2026-10-22

**GD passed for the fixture preview.** [CI run 39843746928](https://github.com/wongywrongy/paypalaihack26/actions/runs/39843746928), source commit `9016d26c`, passed **31/31 backend tests against PostgreSQL 16**, Ruff, clean npm install, production build, nine SSR checks and **28/28 Playwright tests**. Backend provider calls use doubles; this is not G1 evidence.

## Actual rendered review

Two isolated Impeccable assessments inspected the actual captures and source. Final score **34/40**, no unresolved P0–P2 findings within GD scope. [Combined critique](critique.md); [final detector output](detector.json): zero findings. The sole rendered finding was the mobile offer table losing product context. A compact sticky row-header column now keeps product identity beside both first-offer and agreed amounts, without changing desktop layout. Both reviewers inspected the corrected left and right scroll extremes.

The seven member routes and `/deal` use one typed model in `src/fixture.ts`, sourced from `design/scenario/scenario.json`. Request, max and rules deliberately show the canonical example. No money moves.

## Screenshots and provenance

The committed PNGs below are exact captures from the green run, not mockups or reconstructed images. [Manifest](screenshots/manifest.json) records the source commit, run/job and SHA-256 of each image. The nine CLI captures use Playwright CLI 0.1.22 and runner Chrome; mobile viewport **390 × 844**, reduced motion, desktop deal **1440 × 900**. Heights are full-page heights. The tenth capture comes from the focused-table Playwright test.

| Surface | Capture |
|---|---|
| Invite | [390 px](screenshots/invite-cli-mobile.png) |
| Tell | [390 px](screenshots/tell-cli-mobile.png) |
| Review | [390 px](screenshots/review-cli-mobile.png) |
| Live | [390 px](screenshots/live-cli-mobile.png) |
| Ask | [390 px](screenshots/ask-cli-mobile.png) |
| Done | [390 px](screenshots/done-cli-mobile.png) |
| Receipt | [390 px](screenshots/receipt-cli-mobile.png) |
| Deal room | [390 px](screenshots/deal-cli-mobile.png), [1440 px](screenshots/deal-cli-desktop.png) |
| Deal room, agreed column and keyboard focus | [390 px](screenshots/deal-scrolled-mobile.png) |

The [full artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39843746928/artifacts/12454052411) has 26 screenshots plus CLI logs. Temporary transport exported only public fixture PNGs and hashes through job logs so this restricted host could inspect them; those export steps were removed afterward. Normal CLI capture and artifact upload remain.

## Executed behavior and limits

The 28 cases cover all eight routes on desktop/mobile, fixture arithmetic, fonts/images, viewport bounds, preview journey, question default/revision, recovery, primary Tab/Enter navigation and table focus/ArrowRight scrolling. The table's far-right extreme is then set programmatically to verify pinned labels and complete agreed amounts. The final CLI console query returned 0 errors/warnings; the initial browser-open snapshot separately reported one error count, whose content was not inspected. Do not treat the final query as a zero-error audit of every navigation.

Static token contrast from the CSS: muted/ground **6.21:1**, white/berry **6.31:1**, ink/butter **14.98:1**, saving/mint **7.13:1**. These are not an exhaustive computed browser contrast audit.

Screen-reader announcements, 200% zoom, physical devices, every secondary keyboard action, slow network and connected model/payment/persistence remain unexecuted. No local detector overlay or human-visible tab was available; source detection and actual CI captures were the fallback. Local sockets/browser execution remains denied; a prior escalation was rejected by disabled `sandbox_approval`. CI closed its browser and Vite processes.

## Reproduce

```bash
npm run build --prefix frontend
npm run test:render --prefix frontend
cd frontend
npx playwright install chromium
npm run test:browser
```

The [workflow](../../.github/workflows/verify.yml) contains the exact successful CLI commands. Browser installation must match the package lock. SSR output alone does not establish GD.

Earlier source/mockup critique findings (preview-choice honesty, maximum labeling and illustrative receipt timeline), mobile grid overflow and an image-readiness race were corrected before the current green run. The generated fictional Dalbit product sheet was inspected; fonts and licenses are bundled. `PayPalApproval.tsx` and Magic UI remain preserved for later wiring.
