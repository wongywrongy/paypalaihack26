# Rally API

The v2 target endpoint contract and order state model are in [PLAN.md](../PLAN.md#architecture-and-repo-changes). The old Coalition and group-order APIs are retired; do not use their shopper request, negotiation, operator-preparation or commitment endpoints for the v2 app.

The current foundation supplies the Rally schema, guarded payment ledger, webhook receipt/verification, worker and real-sandbox CLI. V2 catalog/bag/order/SSE routes remain M2/M3 work after G1. The frontend's `/api/shops/dalbit/workspace` adapter is currently a CI contract, not an implemented authenticated server endpoint. Ordinary shop views remain locked. The application's generated `/openapi.json` is authoritative for implemented routes; [ARCHITECTURE.md](ARCHITECTURE.md) records the current boundaries.

Money uses integer minor units with explicit USD/CAD/GBP/EUR/AUD currency. Existing holds default to USD; later capture/refund requests inherit the original currency. Shop payouts stay USD. A hold is not a charge. Every mutation goes through the durable ledger; human approval and provider evidence are required. Ownership, approved maxima and capture/refund ceilings are checked in application code, never delegated to the model or browser.

See [EVIDENCE.md](../EVIDENCE.md) for actual test and provider results, and `scripts/paypal_sandbox.py --help` for the current explicit sandbox approval checkpoints.
