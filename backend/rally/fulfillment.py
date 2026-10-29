"""Operator-authored fulfillment is separate from confirmed PayPal money."""

import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from . import orders, store
from .catalog import Line
from .db import enqueue
from .fx import convert
from .negotiation.rally_agent import shipping
from .payments.ledger import operation, perform, reconcile, record_tracking
from .payments.paypal import RecoveryRequired


def shop_lines(row, shop_id, catalog, *, checkout=False):
    terms = row["checkout_terms"] if checkout else row["final_terms"] or row["checkout_terms"]
    return [line for line in terms["lines"] if catalog.offers[line["offer_id"]]["shop_id"] == shop_id]


def shipment_checked(carrier, tracking):
    if not isinstance(carrier, str) or not isinstance(tracking, str) or not 1 <= len(carrier.strip()) <= 64 or not 1 <= len(tracking.strip()) <= 64 or any(ord(c) < 32 for c in carrier + tracking):
        raise ValueError("Enter a carrier and tracking number.")
    return carrier.strip(), tracking.strip()


def handoff(db, order_id, shop_id, carrier, tracking):
    orders.lock(db, order_id)
    row = orders.owned(db, order_id)
    orders.refresh(db, order_id)
    row = orders.owned(db, order_id)
    catalog = store.catalog(db)
    lines = shop_lines(row, shop_id, catalog)
    if not lines:
        raise HTTPException(404, "This order has no items from your shop.")
    if row["payment_state"] != "CHARGED":
        raise HTTPException(409, "Confirm the shopper payment before recording a parcel.")
    carrier, tracking = shipment_checked(carrier, tracking)
    previous = db.execute("SELECT * FROM order_shipments WHERE order_id=%s AND shop_id=%s AND leg='shop_to_hub'", (order_id, shop_id)).fetchone()
    if previous:
        if (previous["carrier"], previous["tracking"]) != (carrier, tracking):
            raise HTTPException(409, "This handoff already has saved tracking.")
        return {"queued": True}
    db.execute("INSERT INTO order_shipments(id,order_id,shop_id,leg,carrier,tracking) VALUES(%s,%s,%s,'shop_to_hub',%s,%s)", (uuid4(), order_id, shop_id, carrier, tracking))
    pool = uuid4()
    domestic = row["final_terms"].get("domestic_usd", {}).get(shop_id, shipping(tuple(Line(**line) for line in lines), catalog))
    total = sum(line["unit_usd_cents"] for line in lines) + domestic
    db.execute("INSERT INTO pools(id,shop_id,organizer_id,lock_at,ship_by,deliver_to) VALUES(%s,%s,'v2-shop-payment',now(),now()+interval '10 days',%s)", (pool, shop_id, Jsonb({"hub": "Seoul"})))
    db.execute("INSERT INTO shipments(id,pool_id,carrier,tracking_number) VALUES(%s,%s,%s,%s)", (uuid4(), pool, carrier, tracking))
    db.execute("INSERT INTO order_shop_payments(order_id,shop_id,pool_id,amount_usd) VALUES(%s,%s,%s,%s)", (order_id, shop_id, pool, total))
    required = {catalog.offers[line["offer_id"]]["shop_id"] for line in row["final_terms"]["lines"]}
    arrived = {r["shop_id"] for r in db.execute("SELECT shop_id FROM order_shipments WHERE order_id=%s AND leg='shop_to_hub'", (order_id,)).fetchall()}
    if required <= arrived:
        db.execute("UPDATE orders SET fulfillment_state='AT_HUB',state='AT_HUB' WHERE id=%s", (order_id,))
    enqueue(db, "payout", {"order_id": str(order_id), "shop_id": shop_id}, f"shop-payout:{order_id}:{shop_id}")
    return {"queued": True}


def pay_shop(db, order_id, shop_id):
    row = orders.owned(db, order_id)
    if row["payment_state"] != "CHARGED":
        raise RecoveryRequired("Shopper funding is not confirmed.")
    payment = db.execute("SELECT * FROM order_shop_payments WHERE order_id=%s AND shop_id=%s", (order_id, shop_id)).fetchone()
    if not payment:
        raise ValueError("No confirmed handoff for this shop.")
    receiver = os.getenv("PAYPAL_SHOP_EMAIL_" + shop_id.upper(), "").strip()
    if "@" not in receiver:
        raise RecoveryRequired("Configure this shop's private sandbox recipient.")
    request_id = f"order:{order_id}:shop:{shop_id}:payout"
    existing = operation(db, request_id)
    if existing and existing["request"]["body"]["items"][0]["receiver"] != receiver:
        raise RecoveryRequired("Existing payout recipient is immutable; review recovery.")
    db.execute("UPDATE shops SET payout_email=%s WHERE id=%s", (receiver, shop_id))
    db.commit()
    if existing and existing["status"] in ("unknown", "inflight", "pending"):
        reconcile(db, request_id)
    perform(db, "payout", request_id, pool_id=payment["pool_id"], amount_cents=payment["amount_usd"], expected_receiver=receiver)


def ship(db, order_id, carrier, tracking):
    orders.lock(db, order_id)
    row = orders.owned(db, order_id)
    if row["payment_state"] != "CHARGED" or row["fulfillment_state"] not in ("AT_HUB", "SHIPPED"):
        raise HTTPException(409, "Confirm funding and all shop arrivals before export.")
    if row["fulfillment_state"] != "SHIPPED" and row["ship_by"] <= datetime.now(timezone.utc):
        raise HTTPException(409, "The ship-by deadline passed. This order is due a refund.")
    catalog = store.catalog(db)
    required = {catalog.offers[line["offer_id"]]["shop_id"] for line in row["final_terms"]["lines"]}
    for shop in required:
        payout = operation(db, f"order:{order_id}:shop:{shop}:payout")
        if not payout or payout["status"] != "completed":
            raise HTTPException(409, "Confirm every shop payout before export.")
    carrier, tracking = shipment_checked(carrier, tracking)
    prior = db.execute("SELECT * FROM order_shipments WHERE order_id=%s AND leg='hub_to_shopper'", (order_id,)).fetchone()
    if prior and (prior["carrier"], prior["tracking"]) != (carrier, tracking):
        raise HTTPException(409, "Export tracking is already saved.")
    if not prior:
        db.execute("INSERT INTO order_shipments(id,order_id,leg,carrier,tracking) VALUES(%s,%s,'hub_to_shopper',%s,%s)", (uuid4(), order_id, carrier, tracking))
    db.execute("UPDATE orders SET state='SHIPPED',fulfillment_state='SHIPPED' WHERE id=%s", (order_id,))
    enqueue(db, "tracking", {"order_id": str(order_id)}, f"tracking:{order_id}")
    return {"queued": True}


def true_up(db, order_id, actual_minor):
    orders.lock(db, order_id)
    row = orders.owned(db, order_id)
    if row["payment_state"] != "CHARGED" or type(actual_minor) is not int or not 0 <= actual_minor <= 100_000_000:
        raise HTTPException(409, "A confirmed payment and valid import total are required.")
    old = db.execute("SELECT * FROM true_ups WHERE order_id=%s", (order_id,)).fetchone()
    if old:
        if old["actual_minor"] != actual_minor:
            raise HTTPException(409, "This import adjustment is already recorded.")
        return {"refund_minor": old["refund_minor"], "queued": old["refund_minor"] > 0}
    priced = row["final_terms"]["breakdown"]
    refund = max(0, priced["duty"] + priced["tax"] - actual_minor)
    db.execute("INSERT INTO true_ups(order_id,actual_minor,refund_minor) VALUES(%s,%s,%s)", (order_id, actual_minor, refund))
    if refund:
        enqueue(db, "true_up", {"order_id": str(order_id)}, f"true-up:{order_id}")
    return {"refund_minor": refund, "queued": refund > 0}


def delivered(db, order_id):
    orders.lock(db, order_id)
    row = orders.owned(db, order_id)
    if row["fulfillment_state"] not in ("SHIPPED", "DELIVERED"):
        raise HTTPException(409, "Record export before delivery.")
    db.execute("UPDATE orders SET state='DELIVERED',fulfillment_state='DELIVERED' WHERE id=%s", (order_id,))
    return {"saved": True}


def scheduled_steps():
    """Opt-in simulated logistics; payouts/tracking still use real sandbox jobs."""
    if os.getenv("RALLY_AUTO_FULFILLMENT") != "1":
        return
    from .db import connect

    with connect() as db:
        rows = db.execute("SELECT o.id,extract(epoch FROM now()-p.created_at) AS age FROM orders o JOIN payment_ops p ON p.member_id=o.member_id AND p.kind='capture' AND p.status='completed' WHERE o.payment_state='CHARGED' AND o.fulfillment_state IN ('MERCHANT_CONFIRMED','AT_HUB','SHIPPED') AND p.created_at<now()-interval '1 minute' ORDER BY o.created_at LIMIT 20").fetchall()
    for item in rows:
        with connect() as db:
            row = orders.owned(db, item["id"])
            if row["ship_by"] <= datetime.now(timezone.utc) and row["fulfillment_state"] != "SHIPPED":
                continue
            if row["fulfillment_state"] == "MERCHANT_CONFIRMED":
                catalog = store.catalog(db)
                for shop in sorted({catalog.offers[line["offer_id"]]["shop_id"] for line in row["final_terms"]["lines"]}):
                    handoff(db, row["id"], shop, "Rally test logistics", f"RALLY-{row['id']}-{shop}")
            elif row["fulfillment_state"] == "AT_HUB" and item["age"] >= 120:
                payments = db.execute("SELECT shop_id FROM order_shop_payments WHERE order_id=%s", (row["id"],)).fetchall()
                if payments and all((operation(db, f"order:{row['id']}:shop:{p['shop_id']}:payout") or {}).get("status") == "completed" for p in payments):
                    ship(db, row["id"], "Rally test logistics", f"RALLY-{row['id']}")
            elif row["fulfillment_state"] == "SHIPPED" and item["age"] >= 240:
                if db.execute("SELECT 1 FROM tracking_operations WHERE order_id=%s AND status='completed'", (row["id"],)).fetchone():
                    delivered(db, row["id"])


def process_job(db, job):
    oid = job["payload"]["order_id"]
    if job["kind"] == "payout":
        return pay_shop(db, oid, job["payload"]["shop_id"])
    row = orders.owned(db, oid)
    capture = operation(db, f"order:{oid}:capture")
    if not capture or capture["status"] != "completed":
        raise RecoveryRequired("Confirmed capture is required.")
    if job["kind"] == "tracking":
        shipment = db.execute("SELECT * FROM order_shipments WHERE order_id=%s AND leg='hub_to_shopper'", (oid,)).fetchone()
        if not shipment:
            raise ValueError("Record export tracking first.")
        db.commit()
        return record_tracking(db, orders.identifier(oid), paypal_order_id=row["paypal_order_id"], capture_id=capture["provider_ref"], carrier=shipment["carrier"], tracking=shipment["tracking"])
    adjustment = db.execute("SELECT * FROM true_ups WHERE order_id=%s", (oid,)).fetchone()
    if not adjustment or not adjustment["refund_minor"]:
        return
    request_id = f"order:{oid}:true-up"
    existing = operation(db, request_id)
    db.commit()
    if existing and existing["status"] in ("pending", "unknown", "inflight"):
        reconcile(db, request_id)
    perform(db, "refund", request_id, pool_id=row["pool_id"], member_id=row["member_id"], resource_id=capture["provider_ref"], amount_cents=adjustment["refund_minor"], currency=row["checkout_terms"]["currency"])


def merchant_orders(db, shop_id):
    catalog = store.catalog(db)
    rows = db.execute("SELECT id FROM orders ORDER BY created_at DESC LIMIT 100").fetchall()
    result = []
    for item in rows:
        row = orders.owned(db, item["id"])
        lines = shop_lines(row, shop_id, catalog)
        auction_events = [e["data"] for e in db.execute("SELECT data FROM deal_events WHERE order_id=%s ORDER BY seq", (row["id"],)).fetchall()]
        auction = bool(auction_events and auction_events[0].get("v") == 3)
        if not lines and not (auction and shop_id in {s for shops in auction_events[0]["shops"].values() for s in shops}):
            continue
        t = row["checkout_terms"]
        payment = operation(db, f"order:{row['id']}:shop:{shop_id}:payout")
        extras = tuple(e for e in (row["final_terms"] or {}).get("extras", []) if e.startswith(shop_id))
        from .negotiation.shop_agent import utility

        gain = utility(tuple(Line(**line) for line in lines), extras, catalog) if lines else 0
        if lines and "domestic_usd" in (row["final_terms"] or {}):
            gain -= shipping(tuple(Line(**line) for line in lines), catalog) - row["final_terms"]["domestic_usd"][shop_id]
        result.append({"id": str(row["id"]), "country": t["country"], "currency": t["currency"], "payment_state": row["payment_state"], "fulfillment_state": row["fulfillment_state"], "lines": orders.public_lines(lines, t["currency"], catalog, t["rate"]), "checkout_lines": orders.public_lines(shop_lines(row, shop_id, catalog, checkout=True), t["currency"], catalog, t["rate"]), "lowest": {o["product_id"] + (":older" if o["variant"] == "older" else ""): convert(o["floor_usd"], t["currency"], t["rate"]) for o in catalog.offers.values() if o["shop_id"] == shop_id}, "gain_minor": convert(max(0, gain or 0), t["currency"], t["rate"]), "gain_currency": t["currency"], "maximum_minor": t["breakdown"]["total"], "events": auction_events if auction else [e for e in auction_events if e.get("shop") == shop_id], "ship_by": row["ship_by"].isoformat(), "payout": {"status": payment["status"] if payment else "awaiting_handoff" if lines else "outbid", "amount_minor": payment["request"]["amount_cents"] if payment else 0, "currency": "USD"}})
    return {"orders": result}
