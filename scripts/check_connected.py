"""Read-only acceptance gate. Run after genuine buyer approvals, captures, voids and refund cleanup.
Load server .env; PYTHONPATH=backend python scripts/check_connected.py RUN_ID [RUN_ID ...]
No buyer approval, payment mutation, or automatic spending happens here.
"""

import json
import sys

from coalition.config import settings
from coalition.db import connect
from coalition.payments import amount_matches, paypal

if settings.mode != "connected":
    raise SystemExit("Connected mode required; test doubles are not external proof.")
if not sys.argv[1:]:
    raise SystemExit(
        "Supply current connected run IDs for the success/refund and deadline/void scenarios."
    )
confirmed = set()
captured = set()
refunded = set()
with connect() as db:
    rows = db.execute(
        "SELECT c.*,r.mode,g.locked_at FROM commitments c JOIN groups g ON g.id=c.group_id JOIN runs r ON r.id=g.run_id WHERE g.run_id=ANY(%s::uuid[])",
        (sys.argv[1:],),
    ).fetchall()
    ops = db.execute(
        "SELECT p.* FROM payment_operations p JOIN commitments c ON c.id=p.commitment_id JOIN groups g ON g.id=c.group_id WHERE g.run_id=ANY(%s::uuid[])",
        (sys.argv[1:],),
    ).fetchall()
    events = db.execute(
        "SELECT e.* FROM webhook_events e JOIN groups g ON g.id=e.group_id WHERE g.run_id=ANY(%s::uuid[]) AND e.verified AND e.processed_at IS NOT NULL",
        (sys.argv[1:],),
    ).fetchall()
    decisions = db.execute(
        "SELECT result FROM ai_decisions d JOIN groups g ON g.id=d.group_id WHERE g.run_id=ANY(%s::uuid[]) AND d.mode='connected' AND d.status='completed'",
        (sys.argv[1:],),
    ).fetchall()
for c in rows:
    assert c["mode"] == "connected", "Fixture history cannot be used as proof"
for op in ops:
    if op["status"] != "completed":
        continue
    c = next(c for c in rows if c["id"] == op["commitment_id"])
    kind = op["kind"]
    pid = c["authorization_id"] if kind == "void" else (op["response"] or {}).get("id")
    if not pid:
        continue
    assert not pid.startswith("FIXTURE-"), "Fixture resource cannot be proof"
    resource = {
        "order": "/v2/checkout/orders/",
        "authorize": "/v2/payments/authorizations/",
        "void": "/v2/payments/authorizations/",
        "capture": "/v2/payments/captures/",
        "refund": "/v2/payments/refunds/",
        "refund_recovery": "/v2/payments/refunds/",
    }[kind]
    data = paypal("GET", resource + pid)
    assert data.get("id") == pid, "Wrong provider identity"
    if kind == "order":
        unit = data["purchase_units"][0]
        assert (
            data["intent"] == "AUTHORIZE"
            and unit["custom_id"] == str(c["id"])
            and amount_matches(unit["amount"])
        )
        assert unit["payee"]["merchant_id"] == settings.paypal_merchant_id
        confirmed.add("order")
    else:
        assert amount_matches(data["amount"]), "Amount/currency mismatch"
        if kind == "authorize" and data["status"] in ("CREATED", "CAPTURED", "VOIDED"):
            confirmed.add("authorize")
        if kind == "void" and data["status"] == "VOIDED":
            confirmed.add("void")
        if kind == "capture" and data["status"] in ("COMPLETED", "REFUNDED"):
            confirmed.add("capture")
            captured.add(c["id"])
        if kind in ("refund", "refund_recovery") and data["status"] == "COMPLETED":
            confirmed.add("refund")
            refunded.add(c["id"])
assert confirmed == {"order", "authorize", "capture", "void", "refund"}, (
    f"Missing lifecycle proof: {set(['order', 'authorize', 'capture', 'void', 'refund']) - confirmed}"
)
assert any(
    len(selected := [c for c in rows if str(c["group_id"]) == str(gid) and c["locked"]])
    == 5
    and len({c["provider_payer_id"] for c in selected}) == 5
    and all(c["id"] in captured and c["id"] in refunded for c in selected)
    for gid in {c["group_id"] for c in rows}
), "No frozen five-payer group with captures and cleanup refunds"
assert any(
    e["payload"]
    .get("event_type", "")
    .startswith(("PAYMENT.AUTHORIZATION.", "PAYMENT.CAPTURE."))
    for e in events
), "No processed genuine app webhook receipt for these groups"
assert {"accept", "reject"} <= {
    d["result"].get("model_result", {}).get("decision") for d in decisions
}, "Live model acceptance and rejection are both required"
print(
    json.dumps(
        {
            "provider_confirmed": sorted(confirmed),
            "five_distinct_approved_payers": True,
            "genuine_webhook_receipt": True,
            "live_model_acceptance_and_rejection": True,
        },
        indent=2,
    )
)
