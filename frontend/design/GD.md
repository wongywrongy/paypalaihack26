# GD evidence — 2026-10-22

GD is **pending inspection of actual CI screenshots**. The seven member routes and `/deal` are implemented from `src/fixture.ts`, which imports `design/scenario/scenario.json`. Preview money and rules are deliberately fixed to the canonical scenario. No API, LLM or PayPal behavior is claimed.

CI on `3794a77` generated all **16 route screenshots** (eight routes at mobile/desktop widths): [browser screenshot artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837501453/artifacts/12450874005). The Playwright suite passed **22/24** tests; both failures were the same outdated old-bottle confirmation assertion on desktop/mobile. The UI correctly explains the temporary preview and canonical answer. The assertion now checks that full boundary and revises the answer back to new. This correction awaits a CI rerun. Artifact generation and layout assertions are real browser evidence; visual signoff still requires opening the images and a fresh finish review.

Passed:

- `npm run build --prefix frontend`: TypeScript and Vite production bundle.
- `RALLY_E2E_URL=http://127.0.0.1:5173 npm run test:browser -- --grep 'fixture money'` from `frontend/`: **2 passed**. This skips the server and uses no page/browser fixture. Full suite discovery: **24 tests**; 22 use a real browser and are tracked separately by the CI result above.
- `npm run test:render --prefix frontend`: server rendering for all eight routes plus missing-route recovery checks the expected title, exactly one h1, an example label and one primary action per member page. This reusable script also checks fixture money and static contrast directly from the CSS tokens; no `/tmp` files are needed.
- Integer-cents parser rejects malformed inputs; displayed costs sum to $66.66, $8.34 remains below max, savings are $54.92; fixture group shares reconcile to $513.52.
- Source color calculations: muted/ground 6.21:1; white/berry 6.31:1; ink/butter 14.98:1; saving/mint 7.13:1. These do not substitute for computed browser contrast.
- Independent Impeccable detector: exit 0, no findings (`detector.json`).
- Independent source/mockup critique: initial provisional score 28/40. Three findings resolved in source: temporary answer honesty and correction, ceiling labeling, illustrative payment timeline. Its `recapture` finish disposition predates the CI screenshots; a fresh review of those images remains required.
- Generated Dalbit sheet inspected: four intended fictional products, only Dalbit labels, no stray real logos. Exact generation prompt embedded in PNG; `embed-prompt --scan` reports 1 raster, 0 missing.
- `PayPalApproval.tsx` and all Magic UI files preserved unchanged. Retired storefront code, catalog images and browser suites removed.

Remaining verification and local constraints:

- `npm run test:browser --prefix frontend` cannot start Vite: `listen EPERM: operation not permitted 0.0.0.0:5173`.
- Direct cached Chromium launch fails with `sandbox_host_linux.cc` shutdown `Operation not permitted`. No browser security setting was changed to evade this restriction.
- The parent attempted Playwright CLI as requested. Default cache was read-only; a task-local XDG cache allowed writes, but the daemon still exited code 1 with no usable error message or session.
- An outside-sandbox local test request was rejected because the configured granular policy disables `sandbox_approval`. No outside-sandbox command ran.
- Actual CI screenshots exist in the artifact linked above but have not yet been inspected for visual quality. The updated question assertions still require a CI rerun. Keyboard behavior and any interaction states outside the automated suite remain unverified. Source rendering is not a visual pass.

## Playwright CLI visual review, when local browsers are permitted

Start the dev server from `frontend/` with `npm run dev -- --port 5173`. In another terminal, also in `frontend/`:

```bash
mkdir -p design/screenshots
playwright-cli -s=rally-gd open http://127.0.0.1:5173/invite --browser chrome
playwright-cli -s=rally-gd resize 390 844
playwright-cli -s=rally-gd set-reduced-motion reduce
for route in invite tell review live ask done receipt deal; do
  playwright-cli -s=rally-gd goto "http://127.0.0.1:5173/$route"
  playwright-cli -s=rally-gd run-code 'async page => { await page.evaluate(() => document.fonts.ready); }'
  playwright-cli -s=rally-gd screenshot --filename "design/screenshots/$route-mobile.png" --full-page
done
playwright-cli -s=rally-gd resize 1440 900
playwright-cli -s=rally-gd goto http://127.0.0.1:5173/deal
playwright-cli -s=rally-gd screenshot --filename design/screenshots/deal-desktop.png --full-page
playwright-cli -s=rally-gd close
```

Open every captured file and confirm its route, full content, product crops, fonts and no horizontal page overflow. Click the entire member path, open/close breakdowns, change both question choices and revise a confirmation, tab through controls, and inspect the deal table's own horizontal scroll at 390 px. Capture the resulting states. Run a fresh finish review against these actual images before marking GD passed. Stop the dev server with Ctrl-C.

For the automated specs, install the browser matching the package lock in a permitted environment with `cd frontend && npx playwright install chromium`, then `npm run test:browser`. The mobile captures explicitly use CSS pixels, producing 390 px images. CI should use its exact dependency lock and its matching browser, not this machine's unrelated cached browser executable.
