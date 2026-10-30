> Historical GD2 record (October 22, 2026). Gate statuses and capabilities below describe that checkpoint; current [EVIDENCE.md](../../EVIDENCE.md) supersedes them.

# Rally v2 design verification

This record concerns the October 22 revised plan: one shopper, three fictional Korean shops and one box from Seoul. Earlier design reports in this directory concern the retired group-order product.

## What changed

Shop, Ship to, Ask, Bag, Deal, Paid, Track and the three shop views use the new public scenario adapter. The catalog contains 30 products, photographed with fictional packaging; one additional photo represents the older essence packaging. [Image prompts, hashes and provenance](catalog-images-v2.json) retain all 31 originals.

The bag persists destination, unique items and permissions. Adding a routine preserves existing selections; an eight-item limit blocks additions with an explanation rather than discarding choices. Country restrictions prevent unsupported items. All five saved currency schedules reconcile component sums in integer minor units.

Deal playback consumes stable events rather than deriving offers from animation. The two shops have distinct outcomes: Bada holds its prices while an allowed $2 mask unlocks free domestic shipping; Dalbit changes packaging and price and includes a kit. The total follows $118.82 → $117.75 → $106.79. Buyer tracks show savings; the private merchant tracks show earnings above the shop's minimum. Pause/resume is beside the clock, and completion immediately displays the exact final amount.

## Independent critique

Two isolated reviewers each inspected 48 actual Chromium JPEGs from source `450d7489`, [run 39876802114](https://github.com/wongywrongy/paypalaihack26/actions/runs/39876802114). The design reviewer also opened all nine reference PNGs before receiving detector findings. Its baseline Operate score was **27/40**, all ten Nielsen heuristics applicable. This is a presentation assessment, not a functional or financial certification.

| Heuristic | Baseline / 4 |
| --- | --- |
| System status | 3 |
| Real-world language | 4 |
| User control | 2 |
| Consistency | 3 |
| Error prevention | 2 |
| Recognition | 3 |
| Efficiency | 2 |
| Minimalist design | 3 |
| Error recovery | 3 |
| Help | 2 |

The independent detector ran once and returned one warning: the shipment timeline's left border. Human inspection classified it as the functional milestone connector, not a decorative card accent. No suppression or cosmetic workaround was added.

The fixes address the review's concrete findings: routine replacement, offscreen playback controls, inverted merchant rail semantics, excessive mobile category wrapping and a completed hero total still interpolating toward the exact amount. Smaller fixes add a mobile private-table scrolling cue and put the read-only explanation before settings. Existing photography, purposeful color semantics, permission explanations and distinct savings comparisons were retained.

Cognitive load was moderate in the baseline: too many equally weighted categories and two long simultaneous negotiations competed for attention. A horizontal category rail and top playback control reduce this pressure; both shop details remain available. First-time shoppers need an unchanged bag and an unambiguous payable total; phone shoppers need earlier products and accessible controls; shop operators need earnings graphics consistent with their private limits. Long bag reviews and contextual support remain possible refinements, without adding explainer screens.

## After the fixes

The design reviewer independently opened all 48 replacement JPEGs from source `c35f9be3`, run `39878422696`. The revised score is **30/40**: user control, error prevention and efficiency each improved by one point; other scores remain unchanged. No P0/P1 design issue remained within GD2. All four completed-deal captures now show $106.79, the merchant rail runs from minimum to agreed, and playback control is visible beside the clock. Routine preservation is verified by source plus the browser regression.

Remaining P2 refinements are mobile density: long live cards still put the second shop and completed next action below the fold, and the shorter category rail reveals product imagery earlier but no complete actionable product in a 390 × 664 first fold. These are recorded limitations, not a claim of perfect mobile usability. The score is not reused from the retired product.

## Screenshots

These are exact CI captures, not mockups. [Source, checksums and run provenance](v2-screenshots/manifest.json) covers 28 selected images from the 48 inspected captures. The recorded shop workspace uses a CI-scoped response; it is locked on the public static preview.

| State | Desktop | Phone |
| --- | --- | --- |
| Shop | [View](v2-screenshots/shop-desktop-fold.jpg) | [View](v2-screenshots/shop-mobile-fold.jpg) |
| Ship to | [View](v2-screenshots/ship-to-desktop-fold.jpg) | [View](v2-screenshots/ship-to-mobile-fold.jpg) |
| Ask | [View](v2-screenshots/ask-desktop-fold.jpg) | [View](v2-screenshots/ask-mobile-fold.jpg) |
| Bag / checkout boundary | [View](v2-screenshots/bag-desktop-fold.jpg) | [Full review](v2-screenshots/bag-mobile-page.jpg) |
| Active deal, paused at seven seconds | [View](v2-screenshots/deal-live-desktop-fold.jpg) | [Full deal](v2-screenshots/deal-live-mobile-page.jpg) |
| Agreed deal | [View](v2-screenshots/deal-done-desktop-fold.jpg) | [Full deal](v2-screenshots/deal-done-mobile-page.jpg) |
| Paid contract | [View](v2-screenshots/paid-desktop-fold.jpg) | [View](v2-screenshots/paid-mobile-fold.jpg) |
| Tracking contract | [View](v2-screenshots/track-desktop-fold.jpg) | [Full tracking](v2-screenshots/track-mobile-page.jpg) |
| Shop orders | [View](v2-screenshots/shops-orders-desktop-fold.jpg) | [View](v2-screenshots/shops-orders-mobile-fold.jpg) |
| Shop products | [View](v2-screenshots/shops-products-desktop-fold.jpg) | [View](v2-screenshots/shops-products-mobile-fold.jpg) |
| Shop settings | [View](v2-screenshots/shops-settings-desktop-fold.jpg) | [View](v2-screenshots/shops-settings-mobile-fold.jpg) |

## Verification and boundaries

The first new-interface run, [39875383401](https://github.com/wongywrongy/paypalaihack26/actions/runs/39875383401), passed backend/build checks but the inspector treated intentional native-dialog background coverage as a defect. A narrowly scoped runtime adaptation now excludes background candidates while a modal is active. Its real-Chrome regression still detects obscured content inside the dialog and on ordinary pages. The pinned Taste revision is `6010f91a9935f1c167dfc500fb1a475681892e6b`; the adaptation is explicit, not an unmodified inspector claim.

The next run, [39876802114](https://github.com/wongywrongy/paypalaihack26/actions/runs/39876802114), passed all 37 PostgreSQL-backed backend tests, build/render/privacy checks, the modal regression and ten Taste inspections. Playwright passed 52/54 cases; two assertions matched two legitimate CAD product prices. The assertion is now scoped to Rice Toner. Review of that run's screenshots also exposed the genuine final-total and layout issues above. Taste JSON output was initially removed by Playwright's test-directory cleanup; reports now live outside that directory.

Ordinary builds cannot turn a query parameter into a paid order. The recorded journey requires both the explicit compile-time harness and `?test=recorded`. The Rootlane design-review build deliberately enables it; checkout remains unavailable, and private shop views remain locked without a scoped API response. CI injects that private contract only for browser tests. [Manual procedure and remaining genuine PayPal approvals](../../docs/DEMO.md).

No GD2 screenshot, provider double, animation or static preview establishes a real hold, capture, refund, payout, hosted model negotiation or shipment. G1 remains open. M2 and M3 are gated later work; the complete plan is not declared finished. Physical-device touch, screen-reader speech, native browser zoom and throttled-network performance have not been executed.

The baseline critique snapshot was written successfully to the local Impeccable archive, temporary body removed, and trend read successfully (one v2 entry, no comparable v2 trend yet). Local browser sockets were denied, so the reviewers used hash-verified CI screenshots; no local overlay, server cleanup or screen-reader claim is made. Questions were not repeated because the revised plan already authorizes fixing these concrete issues.

Run `39878422696` passed **37 PostgreSQL-backed backend tests** and **60 Playwright cases** (including four browser-independent quote/reducer cases), plus build/render/privacy checks. Playwright CLI console reported zero errors/warnings. Eight Taste routes passed; Shop and Ship to reported `edge-text` at 768 px for “Mask”. The report also records content margins of 134/142 px: the text's raw rectangle lay entirely outside its horizontally clipped category rail. A subsequent inspection-only patch intersects edge candidates with ancestor horizontal clipping; its Chrome regression first reproduces the original false positive, then preserves detection of visible edge text inside a scroller and on an ordinary page. No CSS spacing or allow-list was changed to hide that finding. A real-DOM 768 px keyboard regression checks that the clipped category becomes visible through native focus.

At **00:37:59 UTC, October 23**, the exact `c35f9be3` review artifact replaced the existing Rootlane static files atomically. Rootlane observed application/upstream ready, route matching and HTTPS verified. Index SHA-256: `cf2c1718e94d72c48d5e6be9193f7f8198136a6c95ec359c1027124d8c85fa36`. Previous index and hashed assets were retained. No service recipe, route, payment configuration or stored purchase changed. This readiness check is not an external browser journey; the browser evidence above comes from CI.

## Final verification

[Final application verification, run 39879386126](https://github.com/wongywrongy/paypalaihack26/actions/runs/39879386126), inspection/test source `0c86a26d`, **passed**: all37 backend tests against PostgreSQL, all60 Playwright cases (four fixture-only), Ruff/build/render/privacy checks, ten Taste inspections with zero FAIL, both native-modal and scroll-clipping Chrome regressions, and initial/final CLI console zero errors/warnings. Application source/assets are byte-identical to the published `c35f9be3` build. The 768 px actual-DOM test confirms clipped Mask becomes safely visible through native keyboard focus. Provider calls remain doubles. Temporary encoded screenshot/report transport was removed after recovery; normal artifact upload is retained.

