# Rally — rules for coding agents

- Read PLAN.md first. Its "Decisions locked" table is settled; ask before changing any of it.
- Design reference: design/mockup/ (screens/*.png, html/*.html). Numbers: design/scenario/scenario.json.
- README.md describes current Rally capabilities; EVIDENCE.md records executed checks and pending gates.
- Two tracks may run at once. The design track owns frontend/; the backend track owns backend/,
  tests/ and scripts/. Don't edit the other track's folders without asking.
- Money is integer cents. Never charge above a member's max: assert it before every capture and refund.
- The LLM never accepts a deal, never sees shop lowest prices or costs, and never moves money.
- Every PayPal mutation goes through payments/ledger.py with an idempotency key.
- No new services, frameworks or dependencies beyond PLAN.md without asking.
- UI work uses the impeccable and taste skills and follows PRODUCT.md and DESIGN.md. Member screens stay
  simple: one primary action, one big number, details one tap away.
- Fictional brands only (Haneul Beauty, Dalbit). No real brand names or logos in code, images or copy.
- Small commits; run the test suite before each commit.
- After a real sandbox run, append a short entry to EVIDENCE.md: what ran, when, ids, result. No long reports.
- Ask before deleting data or changing external configuration (PayPal app, Render, DNS).
