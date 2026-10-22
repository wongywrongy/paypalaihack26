# Rally

**Korean skincare from Korean shops, shipped to you as one box.** Rally lets shoppers outside Korea buy from several Korean shops, including shops that only ship inside Korea, with one all-in price in their own currency, duty and tax prepaid, paid with PayPal. An agent builds the routine, picks the cheapest shop for each item and bargains with each shop's agent after checkout. PayPal holds the checkout price; the shopper is charged that or less.

[PLAN.md](PLAN.md) is the source of truth (version 2, October 22, 2026). It replaces the group-order version, which replaced Coalition. [AGENTS.md](AGENTS.md) defines track ownership and payment boundaries. [Design references](design/mockup/README.md) and the [scenario](design/scenario/seoul.py) describe three fictional shops (Haneul Beauty, Bada Market, Dalbit Official), about 30 products and five destinations.

## Current state

The frontend in `frontend/src/` and the notes in `frontend/design/` and `docs/DEMO.md` still show the retired group-order version. Its scenario lives in `design/scenario/retired-group-order/` so the build stays green until the design track replaces the routes (gate GD2). **G1 remains open:** the payments code exists, but no real sandbox authorize, capture, void, refund, payout or verified webhook has run yet, because the previous build host could not reach PostgreSQL or PayPal. [EVIDENCE.md](EVIDENCE.md) records executed checks and blockers.

## Real and simulated

- **Real when verified:** buyer-approved PayPal sandbox orders, holds, lower final captures, voids, refunds and payouts to shop sandbox accounts; signed webhooks and reconciliation; hosted model calls during each deal. Sandbox uses test money.
- **Simulated:** the three shops, six brands and their products, stock, prices and lowest prices; the Seoul hub, parcels and delivery; FX rates and shipping rate cards. Duty and import tax come from a dated rate table with sources; rows not yet verified are labeled estimates.
- **Test-only:** fixture data and provider doubles in tests and CI. They never establish payment success.

Rally is the sandbox merchant of record. Money movement belongs to deterministic code and the payment ledger. The LLM never accepts a deal, never sees a shop's lowest prices or costs, and never moves money. The product UI reads as a real shop; the only sandbox marker is a "Test mode" pill, and this section is where simulation is disclosed.

## Development

Use the existing React/TypeScript, FastAPI, worker and PostgreSQL stack. Copy `.env.example` into a private local `.env` and fill server-side credentials without committing them. Configure a hosted model for deployment. Payouts require a separate shop sandbox account and enabled app capability.

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci --prefix frontend
npm run dev --prefix frontend
```

The frontend reads the scenario through one typed module until M3 wires the real API. Backend modules:

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
