"""Immutable checkout consent and solo orders over the existing durable ledger."""

from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from . import store
from .catalog import Line
from .config import settings
from .db import connect, enqueue
from .fx import AS_OF, RATES, convert
from .negotiation.auction import run_auction
from .negotiation.engine import negotiate
from .payments.ledger import operation, payment_lock, perform, reconcile
from .payments.paypal import RecoveryRequired
from .sourcing import source


def identifier(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(404, "Order or bag not found.") from None


def lock(db, order_id):
    db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,5))", (str(order_id),))


def rules_checked(rules):
    if not isinstance(rules, dict) or set(rules) != {"old_packaging_ok", "bundles_ok"} or any(type(v) is not bool for v in rules.values()):
        raise ValueError("Choose both shopping permissions explicitly.")
    return rules


def terms(items, country, rules, catalog):
    result = source(items, country, catalog)
    currency = result["breakdown"]["currency"]
    return {"country": country, "currency": currency, "items": items, "rules": rules_checked(rules), "lines": [asdict(line) for line in result["lines"]], "breakdown": result["breakdown"], "rate": RATES[currency], "fx_as_of": AS_OF, "merchant": "Rally sandbox business", "merchant_id": settings.paypal_merchant_id, "route": "Korean shops → Seoul hub → shopper", "cost_certainty": "complete simulated schedule; Rally absorbs any overrun", "quote_version": 3, "deal_mode": settings.deal_mode, "inventory_reservation": None}


def quote_public(row, catalog):
    t = row["terms"]
    return {"id": str(row["id"]), "country": t["country"], "currency": t["currency"], "lines": public_lines(t["lines"], t["currency"], catalog, t["rate"]), "breakdown": t["breakdown"], "expires_at": row["expires_at"].isoformat(), "fx_as_of": t["fx_as_of"], "cost_certainty": t["cost_certainty"]}


def public_lines(lines, currency, catalog, rate=None):
    result = []
    for line in lines:
        offer = catalog.offers[line["offer_id"]]
        result.append({"id": offer["product_id"], "shop": offer["shop_id"], "unit": convert(line["unit_usd_cents"], currency, rate), "unit_usd": line["unit_usd_cents"], "variant": "older" if offer["variant"] == "older" else None, "qty": line["qty"], "offer_id": offer["id"]})
    return result


def estimate(db, session_id, payload):
    catalog = store.catalog(db)
    value = terms(payload["items"], payload["country"], payload["rules"], catalog)
    row = {"id": uuid4(), "terms": value, "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)}
    return quote_public(row, catalog)


def save_bag(db, session_id, payload, bag_id=None):
    catalog = store.catalog(db)
    value = terms(payload["items"], payload["country"], payload["rules"], catalog)
    if bag_id:
        existing = db.execute("SELECT id FROM bags WHERE id=%s AND session_id=%s FOR UPDATE", (identifier(bag_id), session_id)).fetchone()
        if not existing:
            raise HTTPException(404, "Bag not found.")
        db.execute("UPDATE bags SET country=%s,items=%s,rules=%s WHERE id=%s", (payload["country"], Jsonb(payload["items"]), Jsonb(payload["rules"]), bag_id))
    else:
        bag_id = uuid4()
        db.execute("INSERT INTO bags(id,session_id,country,items,rules) VALUES(%s,%s,%s,%s,%s)", (bag_id, session_id, payload["country"], Jsonb(payload["items"]), Jsonb(payload["rules"])))
    row = {"id": uuid4(), "terms": value, "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)}
    db.execute("INSERT INTO quotes(id,bag_id,session_id,terms,expires_at) VALUES(%s,%s,%s,%s,%s)", (row["id"], bag_id, session_id, Jsonb(value), row["expires_at"]))
    return {"id": str(bag_id), "quote": quote_public(row, catalog)}


def latest_quote(db, bag_id, session_id):
    row = db.execute("SELECT * FROM quotes WHERE bag_id=%s AND session_id=%s ORDER BY created_at DESC,id DESC LIMIT 1", (identifier(bag_id), session_id)).fetchone()
    if not row:
        raise HTTPException(404, "Bag not found.")
    return row


def _reserve(db, order_id, wanted):
    desired = {line["offer_id"]: line["qty"] for line in wanted}
    current = {r["offer_id"]: r["qty"] for r in db.execute("SELECT * FROM order_reservations WHERE order_id=%s AND state='reserved'", (order_id,)).fetchall()}
    for offer_id in sorted(set(desired) | set(current)):
        difference = desired.get(offer_id, 0) - current.get(offer_id, 0)
        if difference > 0 and not db.execute("UPDATE catalog_offers SET stock=stock-%s WHERE id=%s AND stock>=%s RETURNING id", (difference, offer_id, difference)).fetchone():
            raise ValueError("An item sold out. Refresh the bag before checkout.")
        if difference < 0:
            db.execute("UPDATE catalog_offers SET stock=stock-%s WHERE id=%s", (difference, offer_id))
        if offer_id in desired:
            db.execute("INSERT INTO order_reservations(order_id,offer_id,qty) VALUES(%s,%s,%s) ON CONFLICT(order_id,offer_id) DO UPDATE SET qty=EXCLUDED.qty,state='reserved'", (order_id, offer_id, desired[offer_id]))
        else:
            db.execute("UPDATE order_reservations SET state='released' WHERE order_id=%s AND offer_id=%s", (order_id, offer_id))


def release(db, order_id, *, funded=False):
    states = ["reserved", "consumed"] if funded else ["reserved"]
    for row in db.execute("UPDATE order_reservations SET state='released' WHERE order_id=%s AND state=ANY(%s) RETURNING offer_id,qty", (order_id, states)).fetchall():
        db.execute("UPDATE catalog_offers SET stock=stock+%s WHERE id=%s", (row["qty"], row["offer_id"]))


def checkout(db, session_id, bag_id, quote_id):
    lock(db, bag_id)
    quote = latest_quote(db, bag_id, session_id)
    if str(quote["id"]) != str(quote_id):
        raise HTTPException(409, "The bag changed. Review its latest total before checkout.")
    existing = db.execute("SELECT * FROM orders WHERE quote_id=%s", (quote["id"],)).fetchone()
    if existing and existing["payment_state"] not in ("AWAITING_APPROVAL", "APPROVING"):
        raise HTTPException(409, "This checkout already has an order. Open your order history or refresh the bag for a new purchase.")
    if not existing:
        if quote["expires_at"] <= datetime.now(timezone.utc):
            raise HTTPException(409, "This price expired. Refresh the bag and review the new total.")
        t, oid, pool, member = quote["terms"], uuid4(), uuid4(), uuid4()
        if t["merchant_id"] != settings.paypal_merchant_id or not settings.paypal_merchant_id:
            raise HTTPException(409, "Checkout configuration changed. Refresh your bag.")
        db.execute("INSERT INTO shops(id,name,country,payout_email) VALUES('rally-merchant','Rally','US','') ON CONFLICT DO NOTHING")
        db.execute("INSERT INTO pools(id,shop_id,organizer_id,lock_at,ship_by,deliver_to) VALUES(%s,'rally-merchant','v2',now(),now()+interval '10 days',%s)", (pool, Jsonb({"country": t["country"]})))
        db.execute("INSERT INTO members(id,pool_id,display_name,raw_text,max_cents) VALUES(%s,%s,'Shopper','Immutable solo checkout',%s)", (member, pool, t["breakdown"]["total"]))
        db.execute("INSERT INTO orders(id,quote_id,session_id,pool_id,member_id,ship_by) VALUES(%s,%s,%s,%s,%s,now()+interval '10 days')", (oid, quote["id"], session_id, pool, member))
        _reserve(db, oid, t["lines"])
        existing = db.execute("SELECT * FROM orders WHERE id=%s", (oid,)).fetchone()
    db.commit()
    oid = existing["id"]
    op = operation(db, f"order:{oid}:create")
    db.commit()
    if op and op["status"] in ("unknown", "inflight", "pending"):
        reconcile(db, op["request_id"])
    result = perform(db, "order", f"order:{oid}:create", pool_id=existing["pool_id"], member_id=existing["member_id"], currency=quote["terms"]["currency"], return_url=settings.public_url.rstrip("/") + f"/deal?order={oid}", cancel_url=settings.public_url.rstrip("/") + "/bag")
    db.execute("UPDATE orders SET paypal_order_id=%s WHERE id=%s AND (paypal_order_id IS NULL OR paypal_order_id=%s)", (result["id"], oid, result["id"]))
    db.commit()
    approval = next((link["href"] for link in result.get("links", []) if link.get("rel") in ("approve", "payer-action")), "")
    return {"paypal_order_id": result["id"], "approval_url": approval, "client_id": settings.paypal_client_id, "currency": quote["terms"]["currency"], "order_id": str(oid)}


def owned(db, order_id, session_id=None):
    row = db.execute("SELECT o.*,q.terms AS checkout_terms,q.expires_at,q.bag_id FROM orders o JOIN quotes q ON q.id=o.quote_id WHERE o.id=%s", (identifier(order_id),)).fetchone()
    if not row or (session_id is not None and row["session_id"] != session_id):
        raise HTTPException(404, "Order not found.")
    return row


def approve(db, session_id, bag_id, paypal_order_id):
    order = db.execute("SELECT o.id FROM orders o JOIN quotes q ON q.id=o.quote_id WHERE q.bag_id=%s AND o.session_id=%s AND o.paypal_order_id=%s", (identifier(bag_id), session_id, paypal_order_id)).fetchone()
    if not order:
        raise HTTPException(404, "Checkout not found.")
    row = owned(db, order["id"], session_id)
    lock(db, row["id"])
    row = owned(db, row["id"], session_id)
    if row["payment_state"] in ("AUTHORIZED", "NEGOTIATING", "COMPLETING_PAYMENT", "CHARGED"):
        return public_order(db, row["id"], session_id)
    if row["payment_state"] not in ("AWAITING_APPROVAL", "APPROVING"):
        raise HTTPException(409, "This order is no longer awaiting payment approval.")
    if row["payment_state"] == "AWAITING_APPROVAL" and row["expires_at"] <= datetime.now(timezone.utc):
        raise HTTPException(409, "This checkout expired before approval. Refresh your bag.")
    db.execute("UPDATE orders SET payment_state='APPROVING',updated_at=now() WHERE id=%s", (row["id"],))
    db.commit()
    op = operation(db, f"order:{row['id']}:authorize")
    db.commit()
    if op and op["status"] in ("unknown", "inflight", "pending"):
        reconcile(db, op["request_id"])
    try:
        perform(db, "authorize", f"order:{row['id']}:authorize", pool_id=row["pool_id"], member_id=row["member_id"], resource_id=paypal_order_id, currency=row["checkout_terms"]["currency"])
    except Exception:
        db.rollback()
        lock(db, row["id"])
        with payment_lock(db, row["member_id"]):
            current = operation(db, f"order:{row['id']}:authorize")
            if not current or current["status"] == "ready":
                db.execute("UPDATE orders SET payment_state='AWAITING_APPROVAL',updated_at=now() WHERE id=%s AND payment_state='APPROVING'", (row["id"],))
            elif current["status"] == "failed":
                db.execute("UPDATE orders SET payment_state='NEEDS_REVIEW',updated_at=now() WHERE id=%s AND payment_state='APPROVING'", (row["id"],))
        raise
    auth = operation(db, f"order:{row['id']}:authorize")
    if auth["status"] == "completed":
        db.execute("UPDATE orders SET state='HELD',payment_state='AUTHORIZED',updated_at=now() WHERE id=%s AND payment_state='APPROVING'", (row["id"],))
        enqueue(db, "negotiate", {"order_id": str(row["id"])}, f"negotiate:{row['id']}")
    db.commit()
    return public_order(db, row["id"], session_id)


def append_event(db, order_id, event):
    lock(db, order_id)
    seq = db.execute("SELECT COALESCE(max(seq),0)+1 AS n FROM deal_events WHERE order_id=%s", (order_id,)).fetchone()["n"]
    value = {**event, "seq": seq}
    # Diagnostic selection authority stays server-side.
    if value.get("chosen_by") not in ("CODE", "LLM", "FIXTURE"):
        value.pop("chosen_by", None)
    db.execute("INSERT INTO deal_events(id,order_id,seq,data) VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING", (identifier(event["id"]), order_id, seq, Jsonb(value)))


def persist_event(order_id, event):
    with connect() as db:
        append_event(db, order_id, event)


def run_negotiation(order_id):
    with connect() as db:
        lock(db, order_id)
        row = owned(db, order_id)
        if row["payment_state"] not in ("AUTHORIZED", "NEGOTIATING"):
            return
        if row["final_terms"]:
            enqueue(db, "capture", {"order_id": str(order_id)}, f"capture:{order_id}")
            return
        t = row["checkout_terms"]
        catalog = store.catalog(db, order_id)
        interrupted = db.execute("SELECT 1 FROM deal_events WHERE order_id=%s LIMIT 1", (order_id,)).fetchone()
        db.execute("UPDATE orders SET state='NEGOTIATING',payment_state='NEGOTIATING',updated_at=now() WHERE id=%s", (order_id,))
    lines = tuple(Line(**line) for line in t["lines"])
    if interrupted:
        result = {"lines": lines, "extras": (), "breakdown": t["breakdown"]}
        persist_event(order_id, {"id": str(uuid4()), "t": 0, "kind": "error", "note": "The exchange was interrupted. Your checkout terms are retained.", "total": t["breakdown"]["total"]})
        persist_event(order_id, {"id": str(uuid4()), "t": 0, "kind": "done", "note": "Checkout terms retained for payment processing.", "total": t["breakdown"]["total"]})
    else:
        engine = run_auction if t.get("deal_mode", "exchange" if "add_small_extras_if_cheaper" in t["rules"] else settings.deal_mode) == "auction" else negotiate
        result = engine({"lines": lines, "breakdown": t["breakdown"], "rate": t["rate"]}, t["country"], catalog, t["rules"], emit=lambda event: persist_event(order_id, event), **({"pace": True} if engine is run_auction else {}))
    final = {**t, "lines": [asdict(line) for line in result["lines"]], "extras": list(result["extras"]), "breakdown": result["breakdown"]}
    if "winners" in result:
        final.update(domestic_usd=result["domestic_usd"], auction={"rounds": result["rounds"], "winners": result["winners"]})
    with connect() as db:
        lock(db, order_id)
        row = owned(db, order_id)
        if row["payment_state"] != "NEGOTIATING":
            return
        try:
            with db.transaction():
                _reserve(db, identifier(order_id), final["lines"])
        except ValueError:
            final = t
            append_event(db, order_id, {"id": str(uuid4()), "t": 0, "kind": "error", "note": "An offered item became unavailable. Your original checkout items and price are retained.", "total": t["breakdown"]["total"]})
            append_event(db, order_id, {"id": str(uuid4()), "t": 0, "kind": "done", "note": "Checkout terms retained for payment processing.", "total": t["breakdown"]["total"]})
        assert final["breakdown"]["total"] <= t["breakdown"]["total"]
        db.execute("UPDATE orders SET final_terms=%s,payment_state='COMPLETING_PAYMENT',updated_at=now() WHERE id=%s", (Jsonb(final), order_id))
        enqueue(db, "capture", {"order_id": str(order_id)}, f"capture:{order_id}")


def settle(db, order_id):
    row = owned(db, order_id)
    if row["payment_state"] not in ("COMPLETING_PAYMENT", "NEEDS_REVIEW") or not row["final_terms"]:
        return
    auth = operation(db, f"order:{order_id}:authorize")
    if not auth or auth["status"] != "completed":
        raise RecoveryRequired("Confirmed authorization is required.")
    amount = row["final_terms"]["breakdown"]["total"]
    assert 0 < amount <= row["checkout_terms"]["breakdown"]["total"]
    db.commit()
    existing = operation(db, f"order:{order_id}:capture")
    db.commit()
    if existing and existing["status"] in ("unknown", "inflight", "pending"):
        reconcile(db, existing["request_id"])
    perform(db, "capture", f"order:{order_id}:capture", pool_id=row["pool_id"], member_id=row["member_id"], resource_id=auth["provider_ref"], amount_cents=amount, currency=row["checkout_terms"]["currency"])
    refresh(db, order_id)


def refresh(db, order_id):
    row = owned(db, order_id)
    capture = operation(db, f"order:{order_id}:capture")
    if capture and capture["status"] == "completed":
        db.execute("UPDATE orders SET state='CHARGED',payment_state='CHARGED',fulfillment_state=CASE WHEN fulfillment_state='AWAITING_FUNDING' THEN 'MERCHANT_CONFIRMED' ELSE fulfillment_state END,updated_at=now() WHERE id=%s AND payment_state NOT IN ('CHARGED','REFUND_PENDING','REFUNDED')", (order_id,))
        db.execute("UPDATE order_reservations SET state='consumed' WHERE order_id=%s AND state='reserved'", (order_id,))
    refund = operation(db, f"order:{order_id}:refund")
    if refund:
        db.execute("UPDATE orders SET payment_state=%s,state=%s WHERE id=%s", ("REFUNDED" if refund["status"] == "completed" else "REFUND_PENDING", "REFUNDED" if refund["status"] == "completed" else row["state"], order_id))
        if refund["status"] == "completed" and row["fulfillment_state"] not in ("SHIPPED", "DELIVERED"):
            release(db, identifier(order_id), funded=True)
    void = operation(db, f"order:{order_id}:void")
    if void and void["status"] == "completed" and not (capture and capture["status"] == "completed"):
        db.execute("UPDATE orders SET state='VOIDED',payment_state='VOIDED' WHERE id=%s", (order_id,))
        release(db, identifier(order_id))


def public_order(db, order_id, session_id=None):
    row = owned(db, order_id, session_id)
    refresh(db, order_id)
    row = owned(db, order_id, session_id)
    t = row["checkout_terms"]
    final = row["final_terms"] or t
    catalog = store.catalog(db, order_id)
    capture = operation(db, f"order:{order_id}:capture")
    charged = capture["request"]["amount_cents"] if capture and capture["status"] == "completed" else None
    quote_row = {"id": row["quote_id"], "terms": t, "expires_at": row["expires_at"]}
    events = [e["data"] for e in db.execute("SELECT data FROM deal_events WHERE order_id=%s ORDER BY seq", (order_id,)).fetchall()]
    tracking = [{"title": "Payment confirmed" if charged else "Waiting for payment", "note": "Your order and receipt stay saved here.", "complete": charged is not None, "current": charged is None}]
    for shipment in db.execute("SELECT * FROM order_shipments WHERE order_id=%s ORDER BY created_at,id", (order_id,)).fetchall():
        tracking.append({"title": "Arrived at Seoul hub" if shipment["leg"] == "shop_to_hub" else "Shipped from Seoul", "note": "Parcel update", "complete": True, "tracking": shipment["tracking"], "carrier": shipment["carrier"]})
    maximum = t["breakdown"]["total"]
    lines = public_lines(final["lines"], t["currency"], catalog, t["rate"])
    for line in lines:
        line["added"] = line["id"] not in t["items"]
    refunds = db.execute("SELECT status,COALESCE(sum((request->>'amount_cents')::integer),0) AS amount FROM payment_ops WHERE member_id=%s AND kind='refund' GROUP BY status", (row["member_id"],)).fetchall()
    refunded = sum(r["amount"] for r in refunds if r["status"] == "completed")
    pending_refund = sum(r["amount"] for r in refunds if r["status"] in ("pending", "unknown", "inflight"))
    return {"id": str(row["id"]), "bag_id": str(row["bag_id"]), "country": t["country"], "currency": t["currency"], "state": row["state"], "payment_state": row["payment_state"], "fulfillment_state": row["fulfillment_state"], "maximum_minor": maximum, "charged_minor": charged, "refunded_minor": refunded, "refund_pending_minor": pending_refund, "uncaptured_minor": maximum - charged if charged is not None else 0, "checkout": quote_public(quote_row, catalog), "lines": lines, "extras": final.get("extras", []), "auction": final.get("auction"), "domestic_usd": final.get("domestic_usd"), "breakdown": final["breakdown"], "events": events, "tracking": tracking, "ship_by": row["ship_by"].isoformat()}


def cancel(db, order_id, session_id=None, *, compensation=False):
    lock(db, order_id)
    row = owned(db, order_id, session_id)
    if row["payment_state"] == "VOIDED":
        return public_order(db, order_id, session_id)
    allowed = ("AWAITING_APPROVAL", "APPROVING", "AUTHORIZED", "NEGOTIATING", "CANCELLING") + (("COMPLETING_PAYMENT", "NEEDS_REVIEW") if compensation else ())
    if row["payment_state"] not in allowed:
        raise HTTPException(409, "Payment is already completing. Keep this order open for its confirmed status.")
    with payment_lock(db, row["member_id"]):
        auth = operation(db, f"order:{order_id}:authorize")
        if auth and auth["status"] not in ("completed", "ready"):
            raise RecoveryRequired("Authorization outcome requires reconciliation before cancellation.")
        if not auth or auth["status"] == "ready":
            # Serialize against the ledger claim, then close its authorization gate.
            db.execute("UPDATE pools SET state='VOIDED' WHERE id=%s", (row["pool_id"],))
            release(db, identifier(order_id))
            db.execute("UPDATE orders SET state='VOIDED',payment_state='VOIDED' WHERE id=%s", (order_id,))
            return public_order(db, order_id, session_id)
        db.execute("UPDATE orders SET payment_state='CANCELLING' WHERE id=%s", (order_id,))
    perform(db, "void", f"order:{order_id}:void", pool_id=row["pool_id"], member_id=row["member_id"], resource_id=auth["provider_ref"], currency=row["checkout_terms"]["currency"])
    refresh(db, order_id)
    return public_order(db, order_id, session_id)
