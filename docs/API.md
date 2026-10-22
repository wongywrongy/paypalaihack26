# Rally API

The target endpoint contract and state model are in [PLAN.md](../PLAN.md#architecture-and-repo-changes). The old Coalition API is retired; do not use its request, negotiation, operator-preparation or commitment endpoints.

M0/M1 introduces the Rally schema, guarded payment ledger, webhook receipt/verification, worker and real-sandbox CLI. Pool/member application endpoints are wired in M3; this file does not claim that the entire target API is executable already. The application's generated `/openapi.json` is authoritative for implemented routes.

All money uses integer USD cents. A hold is not a charge. Every mutation goes through the durable ledger; human approval and provider evidence are required. Exact member ownership, max and authorization ceilings are checked in application code, never delegated to the model or browser.

See [EVIDENCE.md](../EVIDENCE.md) for actual test and provider results, and `scripts/paypal_sandbox.py --help` for the current explicit sandbox approval checkpoints.
