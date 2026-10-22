# Rally

**One group order. Everyone stays under their max.** Friends describe their skincare basket and budget, approve their own PayPal sandbox hold, and let the group bargain with a fictional Korean shop. Code enforces every limit; each person pays their agreed share, and the shop is paid after tracking is recorded.

[PLAN.md](PLAN.md) is the source of truth, dated October 22, 2026. It replaces the retired Coalition product. [AGENTS.md](AGENTS.md) defines track ownership and payment boundaries. [Design references](design/mockup/README.md) and the [scenario](design/scenario/scenario.json) describe one fictional shop, Haneul Beauty, and Dalbit skincare.

## Current gates

The **Design track** builds Invite, Tell, Review, Live, Ask, Done and Receipt, then the deal room, from one typed scenario fixture. **M0 + M1** rebuilds the backend and proves authorize, lower final capture, void, refund, payout and verified webhook in the real sandbox. Neither fixture screenshots nor contract doubles satisfy the real-payment gate. Milestones M2–M5 remain gated by PLAN.md; do not treat a prepared adapter as a completed lifecycle.

**GD passed:** all fixture screens render, actual screenshots were reviewed, and the Impeccable findings were fixed. [Original screenshots and review](frontend/design/GD.md); [Taste, Impeccable and Emil refinement record](frontend/design/polish-review.md). The owner-reviewed Rootlane preview serves this clearly labeled example; no money moves. **G1 remains open:** both merchant identifiers are configured privately, but the current execution host cannot reach PostgreSQL or PayPal. The connected payment demo is not ready until its gates pass. [EVIDENCE.md](EVIDENCE.md) records executed checks and blockers; fixture browser tests do not establish genuine PayPal execution.

**See the bargaining:** the progress screen's main action opens the group offer, shop counter, revised group offer and final shop counter, with price changes, shared shipping and sample terms. These are illustrative proposals reconstructed from the seeded term columns. The current preview does **not** call buyer or merchant models; live negotiation and API wiring remain M2/M3. Final totals are checked from the saved scenario, with no invented intermediate all-in quotes or payment approval.

## Real and simulated

- **Real when verified in connected mode:** buyer-approved PayPal sandbox orders, holds, captures, voids, refunds and payouts; signed webhooks and durable reconciliation. Sandbox uses test money. Actual hosted model decisions are identified separately from test fixtures.
- **Simulated:** Haneul Beauty, Dalbit products, shop stock and commercial terms, seeded community members, shipping/customs assumptions and fulfillment. Estimates are labeled; the buyer's max remains a hard ceiling.
- **Test-only fixtures:** the frontend scenario prototype and provider/model doubles. They do not move money and never establish payment success.

Rally is the sandbox merchant of record under this plan. Money movement belongs to deterministic code and the payment ledger. The LLM never accepts a deal, sees private lowest prices, or approves a payment. No guaranteed savings or measured social impact is claimed. The reference scenario includes a listed-price order that fails after members drop out.

## Development

Use the existing React/TypeScript, FastAPI, worker and PostgreSQL stack. Copy `.env.example` into a private local `.env` and fill server-side credentials without committing them. Configure a hosted model for deployment. Payouts require a separate shop sandbox account and enabled app capability.

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci --prefix frontend
npm run dev --prefix frontend
```

The frontend design track is explicitly a scenario preview until M3 wires the real API. For the backend, use the new modules:

```bash
PYTHONPATH=backend .venv/bin/python -m rally.db
PYTHONPATH=backend .venv/bin/uvicorn rally.api:app --host 127.0.0.1 --port 8000
PYTHONPATH=backend .venv/bin/python -m rally.worker
```

Run processes in separate terminals after loading the private environment. PostgreSQL uses the dedicated `rally` schema. Existing public tables are preserved; no historical purchase data is migrated or deleted automatically. Do not remove existing volumes. Database initialization and test schemas must use the intended database; tests require an explicitly disposable test target.

Docker and Render configurations are being adapted for the same application and worker. Existing Render resource IDs and the Compose project/volume names are retained to avoid creating replacement infrastructure. Applying deployment or PayPal configuration changes requires owner approval; editing these files does not deploy them.

## Verification

```bash
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
.venv/bin/ruff check --isolated --select E4,E7,E9,F,I --ignore E402 backend tests scripts
npm run build --prefix frontend
npm run test:render --prefix frontend
npm run test:browser --prefix frontend
```

Unit/contract tests inject provider doubles; they need no payment credentials. PostgreSQL integration requires `RALLY_TEST_DATABASE_URL` pointing to an explicitly disposable database.

See the real-sandbox script in `scripts/` for its explicit human approval checkpoints. Never claim G1 until provider-confirmed IDs and a verified webhook are recorded. The final Devpost submission, judge flow and benchmark are later milestones, not present capabilities.

MIT licensed; [third-party notices](THIRD_PARTY_NOTICES.md) retain dependency attribution.
