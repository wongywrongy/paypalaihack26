# Rally — rules for coding agents

- Oct 29, 2026 (later): v4 live marketplace, docs/plan/LIVE.md, builds on v3 and wins where they disagree.
- Oct 29, 2026: v3 shop bidding is the current plan: read docs/plan/BIDDING.md before PLAN.md; it overrides
  PLAN.md where they disagree (deal, shopper rules, terms traded, model).
- Read PLAN.md first. Its "Decisions locked" table is settled; ask before changing any of it.
- Oct 22, 2026: the product changed to version 2, solo international shopping across 3 Korean shops.
  Group orders (pools, members, organizer) are retired. README.md, docs/DEMO.md and frontend/design/*.md
  still describe the retired version until each track rewrites them.
- Design reference: design/mockup/ (screens/*.png, html/*.html). Numbers: design/scenario/scenario.json,
  from design/scenario/seoul.py. The retired scenario is in design/scenario/retired-group-order/ only so the
  current frontend keeps building; delete it when the new routes land.
- README.md describes current Rally capabilities; EVIDENCE.md records executed checks and pending gates.
- Two tracks may run at once. The design track owns frontend/; the backend track owns backend/,
  tests/ and scripts/. Don't edit the other track's folders without asking.
- Money is integer minor units with a currency on every amount. Never charge above the PayPal hold:
  assert it before every capture and refund.
- The LLM never accepts a deal, never sees shop floors or costs, and never moves money.
- Every PayPal mutation goes through payments/ledger.py with an idempotency key.
- No new services, frameworks or dependencies beyond PLAN.md without asking.
- UI work uses the impeccable and taste skills and follows PRODUCT.md and DESIGN.md. Shopper screens stay
  simple: one primary action, one big number, details one tap away.
- It is a real product, not a prototype. No "Example", "preview", "fixture", "simulated" or "demo" in any
  UI copy; the only sandbox marker is a small "Test mode" pill. What is simulated goes in README and Devpost.
- No explainer pages in the product (no deal room, scorecard, decision-rights or benchmark pages). The deal is
  shown live on the Deal screen and in Rally for shops; how it works goes in README, Devpost and the video.
- Fictional shops and brands only (Haneul Beauty, Bada Market, Dalbit Official; Dalbit, Mulgyeol, Saebom,
  Byeolbit, Gureum, Hayan). No real brand names or logos in code, images or copy.
- Small commits; run the test suite before each commit.
- After a real sandbox run, append a short entry to EVIDENCE.md: what ran, when, ids, result. No long reports.
- Ask before deleting data or changing external configuration (PayPal app, Render, DNS).
