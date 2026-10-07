from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from .catalog import PRODUCTS, validate_context
from .config import settings
from .db import enqueue
from .offers import terms_for
from .payments import RecoveryRequired, fresh_authorization, perform, reconcile

FAILURES = {"DECLINED", "DENIED", "FAILED", "REVERSED", "REFUNDED"}


def lock_group(db, group_id):
    return db.execute(
        "SELECT * FROM groups WHERE id=%s FOR UPDATE", (group_id,)
    ).fetchone()


def members(db, group_id):
    return db.execute(
        "SELECT c.*,g.run_id FROM commitments c JOIN groups g ON g.id=c.group_id WHERE group_id=%s ORDER BY c.created_at,c.id",
        (group_id,),
    ).fetchall()


def funded(c):
    return (
        c.get("admitted", False)
        and not c.get("withdrawn", False)
        and c["authorization_status"] == "CREATED"
        and c["void_status"] != "VOIDED"
        and c["capture_status"] not in FAILURES
        and c["refund_status"] != "COMPLETED"
    )


def expired(db, at):
    return bool(
        at
        and db.execute("SELECT clock_timestamp()>=%s AS expired", (at,)).fetchone()[
            "expired"
        ]
    )


def wake(db, group_id):
    enqueue(db, "tick", {"group_id": str(group_id)}, f"tick:{group_id}")
    db.execute(
        "UPDATE jobs SET status='ready',available_at=now(),attempts=0,unresolved_since=NULL WHERE dedupe_key=%s AND status!='running'",
        (f"tick:{group_id}",),
    )


def unwind(db, group_id, reason):
    group = lock_group(db, group_id)
    if group["status"] == "DRAFT":
        db.execute(
            "UPDATE groups SET status='FAILED',failure_reason=%s WHERE id=%s",
            (reason, group_id),
        )
    if group["status"] in ("OPEN", "SETTLING"):
        db.execute(
            "UPDATE groups SET status='UNWINDING',failure_reason=%s WHERE id=%s",
            (reason, group_id),
        )
        db.execute("UPDATE commitments SET active=false WHERE group_id=%s", (group_id,))
        wake(db, group_id)


def expire_reservations(db, group_id):
    db.execute(
        "UPDATE commitments SET active=false,error='Checkout reservation expired; any authorization will be canceled.' WHERE group_id=%s AND active AND NOT admitted AND reservation_expires_at<=clock_timestamp()",
        (group_id,),
    )


def join(db, buyer, group_id, context, accepted_terms):
    validate_context(context, offer=True)
    group = lock_group(db, group_id)
    terms = terms_for(db, group_id)
    if not group or str(group["run_id"]) != str(buyer["run_id"]):
        raise HTTPException(404, "Group not found.")
    if accepted_terms != terms:
        raise HTTPException(409, "Offer terms changed. Review the exact offer again.")
    if (context.product_id, context.selected_variant, context.quantity) != (
        terms["product_id"],
        terms["variant"],
        1,
    ):
        raise HTTPException(422, "Selection does not match the exact quote.")
    if terms.get("pricing_model") == "tiers":
        from .matching import eligible_for_quote

        db.execute("SELECT id FROM buyers WHERE id=%s FOR UPDATE", (buyer["id"],))
        if not eligible_for_quote(db, buyer["id"], terms):
            raise HTTPException(
                409, "This quote does not satisfy your current evaluated requirements."
            )
    expire_reservations(db, group_id)
    existing = db.execute(
        "SELECT * FROM commitments WHERE buyer_id=%s AND group_id=%s AND active",
        (buyer["id"], group_id),
    ).fetchone()
    if existing:
        return existing
    if (
        group["status"] != "OPEN"
        or group["closing"]
        or expired(db, group["deadline"])
        or (not group["activated"] and expired(db, group["preparation_expires_at"]))
    ):
        raise HTTPException(409, "This group is closed or its preparation has expired.")
    used = db.execute(
        "SELECT count(*) AS n FROM commitments WHERE group_id=%s AND active",
        (group_id,),
    ).fetchone()["n"]
    if used >= terms["capacity"]:
        raise HTTPException(
            409,
            "All five places are committed or temporarily reserved. Try again after a reservation expires.",
        )
    cid = uuid4()
    db.execute(
        "INSERT INTO commitments(id,buyer_id,group_id,accepted_terms,amount_minor,currency) VALUES(%s,%s,%s,%s,%s,'USD')",
        (cid, buyer["id"], group_id, Jsonb(terms), terms["total_minor"]),
    )
    enqueue(
        db,
        "order",
        {"commitment_id": str(cid), "group_id": str(group_id)},
        f"order:{cid}",
    )
    return db.execute("SELECT * FROM commitments WHERE id=%s", (cid,)).fetchone()


def admit(db, cid):
    c = db.execute("SELECT * FROM commitments WHERE id=%s", (cid,)).fetchone()
    group = lock_group(db, c["group_id"])
    if (
        c["admitted"]
        or not c["authorization_id"]
        or c["authorization_status"] != "CREATED"
    ):
        return
    expire_reservations(db, group["id"])
    c = db.execute("SELECT * FROM commitments WHERE id=%s", (cid,)).fetchone()
    duplicate = (
        c["provider_payer_id"]
        and db.execute(
            "SELECT 1 FROM commitments WHERE group_id=%s AND provider_payer_id=%s AND admitted AND id!=%s",
            (group["id"], c["provider_payer_id"], cid),
        ).fetchone()
    )
    terms = terms_for(db, group["id"])
    eligible = True
    if terms.get("pricing_model") == "tiers":
        from .matching import eligible_for_quote
        from .payments import fresh_authorization

        eligible = eligible_for_quote(db, c["buyer_id"], terms) and fresh_authorization(
            c, group["deadline"]
        )
    if (
        group["status"] != "OPEN"
        or group["closing"]
        or not eligible
        or expired(db, group["deadline"])
        or expired(db, group["preparation_expires_at"])
        and not group["activated"]
        or not c["active"]
        or c["withdrawn"]
        or duplicate
    ):
        db.execute(
            "UPDATE commitments SET active=false,error='Authorization confirmed after eligibility ended; cancellation is in progress.' WHERE id=%s",
            (cid,),
        )
        enqueue(
            db,
            "void",
            {"commitment_id": str(cid), "group_id": str(group["id"])},
            f"void:{cid}",
        )
        wake(db, group["id"])
        return
    count = db.execute(
        "SELECT count(*) AS n FROM commitments WHERE group_id=%s AND admitted AND active",
        (group["id"],),
    ).fetchone()["n"]
    if count >= terms["capacity"]:
        db.execute(
            "UPDATE commitments SET active=false,error='Group capacity reached; cancellation is in progress.' WHERE id=%s",
            (cid,),
        )
        enqueue(
            db,
            "void",
            {"commitment_id": str(cid), "group_id": str(group["id"])},
            f"void:{cid}",
        )
        return
    db.execute("UPDATE commitments SET admitted=true WHERE id=%s", (cid,))
    freeze(db, group["id"])


def freeze(db, group_id):
    group = lock_group(db, group_id)
    if group["status"] != "OPEN":
        return
    terms = terms_for(db, group_id)
    if terms.get("pricing_model") == "tiers":
        if not expired(db, group["deadline"]):
            return
        from .matching import eligible_for_quote
        from .payments import fresh_authorization

        rows = members(db, group_id)
        selected = [
            c
            for c in rows
            if funded(c)
            and c["active"]
            and c["authorized_minor"] == terms["total_minor"]
            and fresh_authorization(c)
            and eligible_for_quote(db, c["buyer_id"], terms)
        ]
        if len(selected) < terms["minimum"]:
            unwind(
                db, group_id, "Deadline passed below the required valid authorizations."
            )
            return
        if len(selected) > terms["capacity"] or group["inventory_reserved"] < len(
            selected
        ):
            unwind(db, group_id, "Reserved inventory does not cover selected buyers.")
            return
        price = next(
            t["total_each_cents"]
            for t in reversed(terms["tier_schedule"])
            if len(selected) >= t["minimum_buyers"]
        )
        ids = [c["id"] for c in selected]
        snapshot = {
            "member_ids": [str(cid) for cid in ids],
            "quote_id": terms["offer_id"],
            "quote_version": terms["version"],
            "total_each_cents": price,
            "currency": "USD",
        }
        db.execute(
            "UPDATE commitments SET locked=true,settlement_minor=%s WHERE id=ANY(%s)",
            (price, ids),
        )
        db.execute(
            "UPDATE groups SET status='SETTLING',closing=true,locked_at=clock_timestamp(),settlement_snapshot=%s WHERE id=%s",
            (Jsonb(snapshot), group_id),
        )
        for c in rows:
            if (
                c["id"] not in ids
                and c["authorization_id"]
                and c["void_status"] != "VOIDED"
            ):
                db.execute(
                    "UPDATE commitments SET active=false,admitted=false WHERE id=%s",
                    (c["id"],),
                )
                enqueue(
                    db,
                    "void",
                    {"commitment_id": str(c["id"]), "group_id": str(group_id)},
                    f"void:{c['id']}",
                )
        wake(db, group_id)
        return
    if (
        expired(db, group["deadline"])
        or not group["activated"]
        and expired(db, group["preparation_expires_at"])
    ):
        unwind(
            db,
            group_id,
            "Deadline passed with fewer than five admitted authorizations.",
        )
        return
    rows = members(db, group_id)
    if group["activated"] and sum(funded(c) for c in rows) == 5:
        db.execute(
            "UPDATE commitments SET locked=true WHERE group_id=%s AND admitted AND active",
            (group_id,),
        )
        db.execute(
            "UPDATE groups SET status='SETTLING',locked_at=clock_timestamp() WHERE id=%s",
            (group_id,),
        )
        wake(db, group_id)


def withdraw(db, buyer_id, cid):
    c = db.execute(
        "SELECT * FROM commitments WHERE id=%s AND buyer_id=%s", (cid, buyer_id)
    ).fetchone()
    if not c:
        raise HTTPException(404, "Commitment not found.")
    group = lock_group(db, c["group_id"])
    if group["status"] != "OPEN" or expired(db, group["deadline"]):
        raise HTTPException(
            409, f"Participation is locked. Current group state: {group['status']}."
        )
    if c["withdrawn"]:
        return
    db.execute(
        "UPDATE commitments SET withdrawn=true,active=false,admitted=false WHERE id=%s",
        (cid,),
    )
    if c["authorization_id"]:
        enqueue(
            db,
            "void",
            {"commitment_id": str(cid), "group_id": str(group["id"])},
            f"void:{cid}",
        )
    wake(db, group["id"])


def group_plan(group, rows, deadline_expired):
    state = group["status"]
    snapshot = group.get("settlement_snapshot")
    if snapshot:
        locked = [c for c in rows if c["locked"]]
        if state == "SETTLING":
            if any(
                c["capture_status"] in FAILURES
                or c["refund_id"]
                or c["authorization_status"] in ("VOIDED", "DENIED", "EXPIRED")
                for c in locked
            ):
                return "UNWINDING"
            if len(locked) == len(snapshot["member_ids"]) and all(
                c["capture_status"] == "COMPLETED" for c in locked
            ):
                return "SUCCEEDED"
        if state == "FAILED" and any(
            c["capture_status"] == "COMPLETED" and c["refund_status"] != "COMPLETED"
            for c in rows
        ):
            return "UNWINDING"
        return state
    if state == "OPEN" and deadline_expired:
        return "UNWINDING"
    if (
        state == "OPEN"
        and group.get("activated", True)
        and sum(funded(c) for c in rows) == 5
    ):
        return "SETTLING"
    if state == "SETTLING":
        locked = [c for c in rows if c["locked"]]
        if any(
            c["capture_status"] in FAILURES
            or c["refund_id"]
            or c["authorization_status"] in ("VOIDED", "DENIED", "EXPIRED")
            for c in locked
        ):
            return "UNWINDING"
        if len(locked) == 5 and all(c["capture_status"] == "COMPLETED" for c in locked):
            return "SUCCEEDED"
    if state == "FAILED" and any(
        c["capture_status"] == "COMPLETED" and c["refund_status"] != "COMPLETED"
        for c in rows
    ):
        return "UNWINDING"
    return state


def unknown_operation(db, cid, kind):
    return bool(
        db.execute(
            "SELECT 1 FROM payment_operations WHERE commitment_id=%s AND kind=%s AND status IN ('inflight','unknown')",
            (cid, kind),
        ).fetchone()
    )


def safe_terminal(db, c):
    if any(
        unknown_operation(db, c["id"], kind)
        for kind in ("order", "authorize", "capture", "refund", "void")
    ):
        return False
    if c["capture_status"] in ("COMPLETED", "REFUNDED"):
        return c["refund_status"] == "COMPLETED"
    if c["capture_status"] == "REVERSED":
        return True
    if c["capture_status"] == "PENDING":
        return False
    return (
        not c["authorization_id"]
        or c["void_status"] == "VOIDED"
        or c["authorization_status"] == "EXPIRED"
    )


def refresh_transition(db, group_id):
    group = lock_group(db, group_id)
    freeze(db, group_id)
    group = lock_group(db, group_id)
    rows = members(db, group_id)
    terms = terms_for(db, group_id) if group["offer_id"] else None
    if terms and terms.get("pricing_model") == "tiers" and group["status"] == "OPEN":
        freeze(db, group_id)
        group = lock_group(db, group_id)
        state = group["status"]
    else:
        state = group_plan(
            group,
            rows,
            expired(db, group["deadline"])
            or not group["activated"]
            and expired(db, group["preparation_expires_at"]),
        )
    if state == "UNWINDING":
        if group["status"] == "FAILED":
            db.execute(
                "UPDATE groups SET status='UNWINDING',inventory_reserved=%s WHERE id=%s",
                (terms["capacity"], group_id),
            )
        else:
            unwind(db, group_id, "Not all selected payments can complete.")
    if state == "SUCCEEDED" and group["status"] == "SETTLING":
        db.execute(
            "UPDATE groups SET status='SUCCEEDED',fulfillment_released=true,inventory_reserved=CASE WHEN %s THEN inventory_reserved ELSE 0 END WHERE id=%s",
            (bool(terms.get("pricing_model") == "tiers"), group_id),
        )
    if group["status"] == "SUCCEEDED" and any(
        c["capture_status"] in FAILURES or c["refund_id"] for c in rows if c["locked"]
    ):
        db.execute(
            "UPDATE groups SET needs_attention=true,failure_reason='Provider payment exception after purchase; merchant review required.' WHERE id=%s",
            (group_id,),
        )
    db.commit()
    return db.execute("SELECT * FROM groups WHERE id=%s", (group_id,)).fetchone()


def tick(db, group_id):
    # Every lock is transaction-scoped and released before a provider request.
    group = lock_group(db, group_id)
    if group["status"] == "DRAFT":
        return None
    if group["status"] == "OPEN" and expired(db, group["deadline"]):
        db.execute("UPDATE groups SET closing=true WHERE id=%s", (group_id,))
    expire_reservations(db, group_id)
    db.commit()
    for c in members(db, group_id):
        db.commit()
        reconcile(db, c)
    group = refresh_transition(db, group_id)
    rows = members(db, group_id)
    db.commit()
    if group["status"] == "SETTLING":
        from .payments import validate_capture

        terms = terms_for(db, group_id)
        selected = [c for c in rows if c["locked"]]
        if (
            len(selected)
            != len(
                (group.get("settlement_snapshot") or {"member_ids": list(range(5))})[
                    "member_ids"
                ]
            )
            or group["inventory_reserved"] < len(selected)
            or any(c["accepted_terms"] != terms for c in selected)
            or (
                group.get("settlement_snapshot")
                and {str(c["id"]) for c in selected}
                != set(group["settlement_snapshot"]["member_ids"])
            )
            or (
                terms.get("pricing_model") == "tiers"
                and terms["payee_id"] != settings.paypal_merchant_id
            )
        ):
            raise RecoveryRequired(
                "Frozen offer, membership or reserved inventory mismatch."
            )
        db.commit()
        # Preflight every authorization before the first capture; capture also refetches its authorization.
        try:
            for c in selected:
                if not c["capture_id"] and not unknown_operation(
                    db, c["id"], "capture"
                ):
                    validate_capture(c)
        except RecoveryRequired:
            unwind(
                db,
                group_id,
                "Authorization timing or provider state cannot support settlement.",
            )
            db.commit()
            group = refresh_transition(db, group_id)
        if group["status"] == "SETTLING":
            scenario = db.execute(
                "SELECT scenario FROM runs WHERE id=%s", (group["run_id"],)
            ).fetchone()["scenario"]
            db.commit()
            for index, c in enumerate(selected):
                group = refresh_transition(db, group_id)
                if group["status"] != "SETTLING":
                    break
                if c["capture_status"] == "PENDING" or unknown_operation(
                    db, c["id"], "capture"
                ):
                    continue
                if not c["capture_id"]:
                    c["fault_member"] = index == len(selected) - 1
                    perform(db, c, "capture", scenario)
            group = refresh_transition(db, group_id)
    if group["status"] == "UNWINDING":
        attention = []
        for c in members(db, group_id):
            db.commit()
            try:
                if c["refund_status"] in ("FAILED", "CANCELLED"):
                    raise RecoveryRequired(
                        "Refund failed. Merchant recovery is required; cleanup remains unresolved."
                    )
                if c["capture_status"] == "REFUNDED" and not c["refund_id"]:
                    raise RecoveryRequired(
                        "Refund resource ID is unresolved; reconcile provider records."
                    )
                if (
                    c["capture_status"] == "COMPLETED"
                    and c["refund_status"] != "COMPLETED"
                ):
                    if not c["refund_id"]:
                        perform(db, c, "refund")
                elif c["capture_status"] == "PENDING" or unknown_operation(
                    db, c["id"], "capture"
                ):
                    continue
                elif (
                    c["authorization_id"]
                    and c["void_status"] != "VOIDED"
                    and c["authorization_status"] != "EXPIRED"
                    and (
                        not c["capture_id"]
                        or c["capture_status"] in ("DECLINED", "DENIED", "FAILED")
                    )
                ):
                    perform(db, c, "void")
            except RecoveryRequired as exc:
                db.rollback()
                attention.append(str(exc))
        if attention:
            raise RecoveryRequired(attention[0])
        lock_group(db, group_id)
        if all(safe_terminal(db, c) for c in members(db, group_id)):
            db.execute(
                "UPDATE groups SET status='FAILED',inventory_reserved=0,needs_attention=false WHERE id=%s AND status='UNWINDING'",
                (group_id,),
            )
        db.commit()
    group = db.execute("SELECT * FROM groups WHERE id=%s", (group_id,)).fetchone()
    if group["status"] in ("SUCCEEDED", "FAILED"):
        release_inventory(db, group)
    if group["status"] == "FAILED":
        return None
    return 30 if group["status"] == "SUCCEEDED" else 2


def release_inventory(db, group):
    if group["status"] == "SUCCEEDED" and any(
        not safe_terminal(db, c) for c in members(db, group["id"]) if not c["locked"]
    ):
        return
    reservation = db.execute(
        "UPDATE inventory_reservations SET status=%s WHERE quote_id=%s AND status='reserved' RETURNING *",
        (
            "consumed" if group["status"] == "SUCCEEDED" else "released",
            group["offer_id"],
        ),
    ).fetchone()
    if reservation:
        used = (
            len((group.get("settlement_snapshot") or {"member_ids": []})["member_ids"])
            if group["status"] == "SUCCEEDED"
            else 0
        )
        db.execute(
            "UPDATE catalog_stock SET available=available+%s WHERE product_id=%s",
            (reservation["units"] - used, reservation["product_id"]),
        )
        db.execute("UPDATE groups SET inventory_reserved=0 WHERE id=%s", (group["id"],))


def snapshot(db, buyer):
    group = db.execute(
        "SELECT g.*,r.mode,r.scenario FROM groups g JOIN runs r ON r.id=g.run_id WHERE g.run_id=%s",
        (buyer["run_id"],),
    ).fetchone()
    rows = members(db, group["id"])
    commitment = next((c for c in reversed(rows) if c["buyer_id"] == buyer["id"]), None)
    decision = db.execute(
        "SELECT status,result,error,mode FROM ai_decisions WHERE buyer_id=%s AND group_id=%s ORDER BY created_at DESC LIMIT 1",
        (buyer["id"], group["id"]),
    ).fetchone()
    evidence = db.execute(
        "SELECT p.kind,p.provider_status AS status,p.source AS evidence_source,p.event_id AS evidence_event_id,p.observed_at AS updated_at,p.resource_id FROM payment_observations p JOIN commitments c ON c.id=p.commitment_id WHERE c.group_id=%s ORDER BY p.observed_at DESC LIMIT 15",
        (group["id"],),
    ).fetchall()
    for item in evidence:
        item["resource_id"] = redact(item["resource_id"])
        item["evidence_event_id"] = redact(item["evidence_event_id"])
    events = db.execute(
        "SELECT id,verified,received_at,processed_at,payload->>'event_type' AS event_type FROM webhook_events WHERE group_id=%s ORDER BY received_at DESC LIMIT 10",
        (group["id"],),
    ).fetchall()
    for event in events:
        event["id"] = redact(event["id"])
    offer = terms_for(db, group["id"])
    capture_operations = {
        row["commitment_id"]: row["status"]
        for row in db.execute(
            "SELECT p.commitment_id,p.status FROM payment_operations p JOIN commitments c ON c.id=p.commitment_id WHERE c.group_id=%s AND p.kind='capture'",
            (group["id"],),
        ).fetchall()
    }
    participants = [
        c for c in rows if c["locked"] or (c["admitted"] and not c["withdrawn"])
    ]
    authorization_pending = bool(
        commitment
        and commitment["active"]
        and not commitment["authorization_id"]
        and db.execute(
            "SELECT 1 FROM jobs WHERE dedupe_key=%s AND status IN ('ready','running')",
            (f"authorize:{commitment['id']}",),
        ).fetchone()
    )
    return {
        "group": group,
        "offer": offer,
        "ordinary_price_minor": next(
            p["price_minor"] for p in PRODUCTS if p["id"] == offer["product_id"]
        ),
        "selected_count": len(
            (group.get("settlement_snapshot") or {"member_ids": []})["member_ids"]
        )
        or sum(c["locked"] for c in rows),
        "totals": {
            "authorized_minor": sum(c["authorized_minor"] or 0 for c in rows),
            "captured_minor": sum(c["captured_minor"] or 0 for c in rows),
            "refunded_minor": sum(c["refunded_minor"] or 0 for c in rows),
        },
        "confirmed_count": sum(
            c["admitted"]
            and not c["withdrawn"]
            and (
                c["capture_status"] == "COMPLETED"
                or (
                    c["authorization_status"] in ("CREATED", "CAPTURED")
                    and (
                        offer.get("pricing_model") != "tiers" or fresh_authorization(c)
                    )
                )
            )
            and c["void_status"] != "VOIDED"
            and c["refund_status"] != "COMPLETED"
            for c in rows
        ),
        "completed_captures": sum(
            c["locked"]
            and c["capture_status"] == "COMPLETED"
            and c["refund_status"] != "COMPLETED"
            for c in rows
        ),
        "commitment": commitment,
        "authorization_pending": authorization_pending,
        # Anonymous progress only. Payment commands still require the buyer's session.
        "members": [
            {
                "position": i + 1,
                "is_you": c["buyer_id"] == buyer["id"],
                "authorization_status": c["authorization_status"],
                "capture_status": c["capture_status"],
                "capture_operation_status": capture_operations.get(c["id"]),
                "refund_status": c["refund_status"],
                "void_status": c["void_status"],
                "evidence_source": c["evidence_source"],
                "updated_at": c["observed_at"],
            }
            for i, c in enumerate(participants[: offer["capacity"]])
        ],
        "decision": decision,
        "activity": [],
        "evidence": evidence,
        "webhooks": events,
        "buyer": {
            "id": buyer["id"],
            "name": buyer["name"],
            "prepared": buyer["prepared"],
        },
    }


def redact(value):
    return ("…" + value[-6:]) if value else None
