# Rally mockup

Reference screens for the design track, exported from the mockup canvas. They show the intended flow, copy, hierarchy and numbers; the build should look better than this, not identical.

![Member flow: invite, tell us, review, negotiating, deal reached, receipt](flow.png)

- `screens/*.png` — renders at 2x (member screens 390 px wide, pages 1280 px wide).
- `html/*.html` — static HTML for each screen; open `html/index.html`. Fonts load from Google Fonts.
- `html/img/*.svg` — placeholder product illustrations. Replace them with better product imagery (see PLAN.md "Design direction"); keep them only as a fallback.
- Every number comes from `design/scenario/kbeauty.py` (output: `design/scenario/scenario.json`).

| Screen | File | Who sees it |
| --- | --- | --- |
| 1 · Invite | `1-invite` | Member |
| 2 · Tell us what you want | `2-tell-us` | Member |
| 3 · Review and approve the hold | `3-review` | Member |
| 4 · Negotiating | `4-negotiating` | Member |
| 4b · Quick question | `4b-quick-question` | Member (Aisha's case) |
| 5 · Deal reached | `5-deal-reached` | Member |
| 6 · Receipt | `6-receipt` | Member |
| How the deal was made | `deal-room` | Member (one tap away), judges |
| Organizer order sheet | `organizer-sheet` | Organizer |
| Shop agent console | `shop-console` | Shop (private) |
| Deal scorecard | `scorecard` | Judges |
| Benchmark | `benchmark` | Judges (empty until the benchmark runs) |
| Who decides what | `who-decides` | Judges |

All brands, products and people are fictional.
