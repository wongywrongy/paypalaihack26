# GD evidence — 2026-10-22

Latest automated evidence: **CI is green on `f5f4d0aa`** ([run 39840487958](https://github.com/wongywrongy/paypalaihack26/actions/runs/39840487958)). GD still awaits visual critique of the actual images.

- **24/24 Playwright tests passed:** 22 browser cases plus two fixture-money checks. Coverage includes eight routes, the full member preview, both question choices and revision, recovery, fonts, images and page width against the configured viewport. Mobile width is explicitly 390 px.
- **Playwright CLI completed nine captures:** all eight routes at **390 × 844 with reduced motion**, plus the desktop deal room at 1440 px. Final CLI console: **0 errors, 0 warnings**.
- **25 screenshots produced:** nine CLI captures and 16 test captures, with CLI logs in the [current artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39840487958/artifacts/12451474681).
- Production build, reusable SSR/static checks, Ruff and all 31 backend PostgreSQL/unit tests passed in the same run. These backend tests do not establish real PayPal or LLM behavior.

The seven member routes and `/deal` read one typed model in `src/fixture.ts`, sourced from `design/scenario/scenario.json`. Request, max and rules deliberately show the canonical example. No money moves.

## Review still required

The artifact exists, but its hosted images remain inaccessible from this agent environment. **No image critique or final visual shipping verdict is claimed.** Open all current captures, check product crops, typography, hierarchy, complete content and responsive composition, then run a fresh Impeccable finish review. Inspect keyboard focus and interaction states beyond the automated coverage before GD signoff.

The independent source/mockup critique scored 28/40 provisionally; its three findings were fixed and verified in source: temporary-choice honesty and correction, clear max labeling, and an illustrative payment timeline. Its earlier `recapture` verdict predates the current captures; actual-image review must replace it. The independent source detector returned `[]` ([raw result](detector.json)); this does not establish visual quality.

## Reproducible checks

From the repository root:

```bash
npm run build --prefix frontend
npm run test:render --prefix frontend
npm run test:browser --prefix frontend
```

`test:render` checks the expected titles, single headings, example labels and primary actions across nine paths, malformed money inputs and fixture reconciliation. It reads the actual CSS tokens for static contrast: muted/ground **6.21:1**, white/berry **6.31:1**, ink/butter **14.98:1**, saving/mint **7.13:1**. These checks do not substitute for browser screenshots or computed contrast.

Use the [CI workflow](../../.github/workflows/verify.yml) for the exact successful Playwright CLI capture commands. Browser installation must match the package lock; in a permitted environment run `cd frontend && npx playwright install chromium` before the suite. Captures use CSS pixels. Local server/browser execution remains denied by this workspace; a sandbox escalation request was rejected by the disabled `sandbox_approval` policy. No restriction was bypassed.

## Resolved history and assets

Earlier CI exposed a stale confirmation assertion ([initial artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39837501453/artifacts/12450874005)) and a mobile deal-grid minimum-width bug ([CLI diagnostic artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39839797807/artifacts/12451613734)). The assertion now tests the honest preview boundary and revision; the mobile grid uses `minmax(0,1fr)` so its 720 px table scrolls inside its frame. Both corrections pass the current run, including the stricter viewport check.

The generated Dalbit sheet was inspected: four fictional products, only Dalbit labels, no stray real logos. Its exact prompt is embedded in the PNG; provenance scan reported one raster, none missing. Fonts and licenses are bundled. `PayPalApproval.tsx` and Magic UI files remain preserved; the retired storefront and its browser suites were replaced.
