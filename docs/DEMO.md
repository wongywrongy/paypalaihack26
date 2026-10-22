# Rally demo gates

Use [PLAN.md](../PLAN.md#codex-prompts) for the current prompts and scope. The retired Coalition demo is not a Rally payment demonstration.

1. **Design / GD:** run the frontend scenario preview. Inspect Invite, Tell, Review, Live, Ask, Done, Receipt and the deal room at 390 px. It uses the committed scenario; it does not authorize a payment. Capture actual Playwright screenshots and fix the Impeccable critique before claiming GD.
2. **Payments / G1:** configure the sandbox merchant ID, separate shop payout email, app credentials and webhook. Run `scripts/paypal_sandbox.py --help` and its explicit lifecycle commands. The human approves each designated order in PayPal; server code confirms the hold, lower final capture, separate void, refund, payout and signature-verified webhook. Record actual IDs and results in EVIDENCE.md. A pending or ambiguous outcome remains unresolved.
3. **Engine / G2:** begins after G1. Implement the CP-SAT/cost engine and pass the golden test and seeded ten-member CLI; the scenario JSON alone does not prove this engine exists.
4. **Wiring / G3:** connect member screens to the API and complete the hosted flow with a real sandbox hold. Later gates add tracking/payout protections, benchmark, judge flow and submission artifacts.

Never delete existing database volumes to prepare a demo. The new application uses its own `rally` schema. Deployment, PayPal configuration or route changes require owner review and approval. Do not replay real mutations to manufacture a success; reconcile unknown outcomes first.
