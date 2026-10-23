# Making the bargaining visible

The progress screen previously sent the main journey directly to the final price. The deal room showed a term matrix and a retrospective log, so the exchange between the two sides was hard to follow.

The progress screen now opens **See the example bargaining**. The separate deal room leads with four chronological proposals: the group opens, the shop counters, the group trades delivery speed for shared freight and sample kits, then the shop makes its final counter. Desktop pairs adjacent proposals; mobile follows the same order down the page. The direct final-price link remains available on the progress screen.

Each proposal names its side, shows exact product variants and unit prices, and computes signed changes from the previous proposal. Shipping is labeled as a whole-group charge; sample-kit counts stay explicit. Aisha's choice appears with the relevant bottle counteroffer, including the conservative no-answer default. All proposals remain visible after refresh and with either motion preference. The final saved-allocation checks and complete individual share follow the exchange; the full comparison matrix and keyboard scroll controls remain below.

## What this demonstrates

The example trades more than a lower item price. Shared freight changes from **$105 to $25 for the group**, departing Nov 14 for pickup around Nov 21, within the seeded Nov 28 limit. The shop's final unit prices are higher than the group's revised bid. The final example nevertheless fits every saved member maximum, including the reference buyer's **$66.66** share under **$75.00**.

The four public events have stable IDs and sequence numbers in `fixture.ts`. They reconstruct the existing public term columns. Their words are illustrative, not captured language-model output. No complete intermediate allocation is invented; proposed unit prices are explicitly before shipping, duty, fees and tax. The final total remains the canonical saved allocation.

**This is not live agentic negotiation.** No buyer or merchant model, solver, payment approval or provider mutation runs in this preview. G1 and the subsequent M2/M3 engine/API work remain open under PLAN.md. No payment, purchase or fulfillment records were changed. No decorative typing, timed reveals, fake model activity or financial animation was added.

## Try it

1. Open `/live` and choose **See the example bargaining**.
2. Follow the opening proposal and shop counter, including the old/new bottle price gap.
3. Read the group's revised shipping/sample proposal, then the shop's final counter. Compare the per-unit changes with the separately labeled group freight.
4. Review the saved-allocation code checks, then open **See your example price** and the receipt.
5. Refresh `/deal`: all four proposals remain. The optional bottle question and the full comparison matrix retain their keyboard paths.

The preceding [refinement captures](polish-screenshots/manifest.json), source `f9fc421`, are valid before-images: the Live/Deal app source and product assets were unchanged through the favicon-only `db139db` baseline.

## Executed verification and limits

[CI run 39860472878](https://github.com/wongywrongy/paypalaihack26/actions/runs/39860472878), source `a4533264fc4f45ba633f76a47b8970328c24d04d`, passed **31 backend tests with PostgreSQL available**, Ruff, production build, render/preview-host checks and **48 Playwright tests**. Four Playwright cases are browser-independent fixture checks; the remainder exercise browser behavior. Provider calls use doubles. No case failed or skipped in this run; no genuine model or PayPal lifecycle was executed.

The browser checks include the journey through bargaining to price and receipt without API/payment requests, exact proposal order and signed cents, unit versus whole-group cost labels, Aisha's default, all four offers after refresh with both motion preferences, keyboard navigation and preserved table jumps, all routes at 320/768 px, and ordinary text enlarged to 200% with local grid-clipping checks. Local alternate build/render checks and four fixture cases also passed. Local browser sockets remain blocked, so actual rendered execution ran in CI.

Playwright CLI captured the routes; its initial and final console queries both returned **zero errors and warnings**. All eight pinned Taste app inspections passed with **zero FAIL**, at 1440/768/390 px. All 12 Live/Deal JPEGs were recovered, SHA-256 verified and visually inspected. Source detection returned `[]`; Taste source lint returned zero FAIL and three intentional money-face warnings. Runtime warnings remain visible: the locked warm palette/type hierarchy and centered member column, product images classified as icon chips, below-fold secondary content, and whitespace beside unequal-length paired offers. No allow-list suppression was added.

The verified build replaced static files in the existing Rootlane preview at **21:57 UTC**. Assets were copied before atomically replacing the index; previous index/hashed assets were retained. Rootlane reported application ready, matching route, upstream ready and HTTPS verified. No environment recipe, external route, secret or payment configuration changed. This is readiness plus CI rendered evidence, not a fresh browser run against the private preview URL.

Native browser zoom, physical touch and screen-reader speech remain unexecuted. The ordinary-text check does not establish complete 200% scaling of the viewport-bounded financial figures or certify accessibility. Model decisions, provider approval, capture/refund recovery and live negotiation persistence remain outside this fixture verification.

## Actual after-captures

[Manifest](bartering-screenshots/manifest.json) records source/run/job, sizes and exact hashes. Fold images show the initial viewport; page strips show successive screenfuls. [Full CI artifact](https://github.com/wongywrongy/paypalaihack26/actions/runs/39860472878/artifacts/12461771140) includes normal CLI captures, tests and all eight inspector reports. The temporary encoded-image transport was removed after visual review; ordinary captures and artifacts remain.

| Surface | Phone 390 px | Tablet 768 px | Desktop 1440 px |
|---|---|---|---|
| Bargaining entry point | [Fold](bartering-screenshots/live/mobile-fold.jpg) · [Page](bartering-screenshots/live/mobile-page-01.jpg) | [Fold](bartering-screenshots/live/tablet-fold.jpg) · [Page](bartering-screenshots/live/tablet-page-01.jpg) | [Fold](bartering-screenshots/live/desktop-fold.jpg) · [Page](bartering-screenshots/live/desktop-page-01.jpg) |
| Buyer/shop exchange | [Fold](bartering-screenshots/deal/mobile-fold.jpg) · [Full sequence](bartering-screenshots/deal/mobile-page-01.jpg) | [Fold](bartering-screenshots/deal/tablet-fold.jpg) · [Full sequence](bartering-screenshots/deal/tablet-page-01.jpg) | [Fold](bartering-screenshots/deal/desktop-fold.jpg) · [Full sequence](bartering-screenshots/deal/desktop-page-01.jpg) |
