"""Deadline and reconciliation work stays independent of slow model calls."""

import logging

from . import orders
from .db import connect, enqueue
from .payments.ledger import operation, perform, reconcile

log = logging.getLogger("rally.maintenance")


def refund(db, order_id):
    orders.lock(db, order_id)
    row = orders.owned(db, order_id)
    if row["fulfillment_state"] in ("SHIPPED", "DELIVERED"):
        return
    capture = operation(db, f"order:{order_id}:capture")
    if not capture or capture["status"] != "completed":
        return
    reserved = db.execute("SELECT COALESCE(sum((request->>'amount_cents')::integer),0) AS n FROM payment_ops WHERE member_id=%s AND kind='refund' AND status!='failed'", (row["member_id"],)).fetchone()["n"]
    existing = operation(db, f"order:{order_id}:refund")
    amount = existing["request"]["amount_cents"] if existing else capture["request"]["amount_cents"] - reserved
    if amount <= 0:
        return
    db.execute("UPDATE orders SET payment_state='REFUND_PENDING',updated_at=now() WHERE id=%s", (order_id,))
    db.commit()
    if existing and existing["status"] in ("unknown", "inflight", "pending"):
        reconcile(db, existing["request_id"])
    perform(db, "refund", f"order:{order_id}:refund", pool_id=row["pool_id"], member_id=row["member_id"], resource_id=capture["provider_ref"], amount_cents=amount, currency=row["checkout_terms"]["currency"])
    orders.refresh(db, order_id)


def run_once():
    with connect() as db:
        expired = db.execute("SELECT o.id FROM orders o JOIN quotes q ON q.id=o.quote_id WHERE (o.payment_state='AWAITING_APPROVAL' OR (o.payment_state='APPROVING' AND o.updated_at<now()-interval '5 minutes')) AND q.expires_at<now() AND NOT EXISTS (SELECT 1 FROM payment_ops p WHERE p.member_id=o.member_id AND p.kind='authorize' AND p.status!='ready') ORDER BY o.created_at LIMIT 20").fetchall()
        for row in expired:
            orders.cancel(db, row["id"])
        authorized = db.execute("SELECT o.id FROM orders o JOIN payment_ops p ON p.member_id=o.member_id WHERE o.payment_state IN ('AWAITING_APPROVAL','APPROVING') AND p.kind='authorize' AND p.status='completed' LIMIT 20").fetchall()
        for row in authorized:
            db.execute("UPDATE orders SET state='HELD',payment_state='AUTHORIZED' WHERE id=%s AND payment_state IN ('AWAITING_APPROVAL','APPROVING')", (row["id"],))
            enqueue(db, "negotiate", {"order_id": str(row["id"])}, f"negotiate:{row['id']}")
        late = db.execute("SELECT id,member_id FROM orders WHERE payment_state IN ('CHARGED','REFUND_PENDING') AND fulfillment_state NOT IN ('SHIPPED','DELIVERED') AND ship_by<now() ORDER BY ship_by LIMIT 20").fetchall()
        for row in late:
            enqueue(db, "refund", {"order_id": str(row["id"])}, f"deadline-refund:{row['id']}")
            db.execute("UPDATE jobs SET status='ready',run_at=now() WHERE dedupe_key=%s AND status='recovery' AND NOT EXISTS(SELECT 1 FROM payment_ops WHERE member_id=%s AND status IN ('inflight','unknown','pending')) AND NOT EXISTS(SELECT 1 FROM payment_ops WHERE request_id=%s AND status='failed')", (f"deadline-refund:{row['id']}", row["member_id"], f"order:{row['id']}:refund"))
        pending = db.execute("SELECT request_id FROM payment_ops WHERE status IN ('pending','unknown') AND (provider_ref IS NOT NULL OR kind IN ('authorize','void')) ORDER BY created_at LIMIT 2").fetchall()
    for row in pending:
        try:
            with connect() as db:
                reconcile(db, row["request_id"])
        except Exception as exc:
            log.warning("Reconciliation remains unresolved: %s", type(exc).__name__)
    with connect() as db:
        rows = db.execute("SELECT id FROM orders WHERE payment_state IN ('COMPLETING_PAYMENT','REFUND_PENDING','NEEDS_REVIEW','CANCELLING') ORDER BY updated_at LIMIT 20").fetchall()
        for row in rows:
            orders.refresh(db, row["id"])
    from .fulfillment import scheduled_steps

    scheduled_steps()
