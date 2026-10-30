"""Shop-scoped economics and hub-only fulfillment controls."""

from fastapi import APIRouter, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from . import fulfillment, goals, orders, sessions, store
from .catalog import Catalog
from .db import connect
from .shopping import owner

router = APIRouter(prefix="/api")


class Shipment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    carrier: str = Field(min_length=1, max_length=64)
    tracking: str = Field(min_length=1, max_length=64)


class ActualCosts(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    actual_minor: StrictInt = Field(ge=0, le=100_000_000)


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    discount_bp: StrictInt = Field(ge=0, le=3000)
    sample_kit: StrictBool


def shop_owner(db, request, shop_id, *, write=False):
    row = owner(db, request, write=write)
    sessions.scoped(row, "shop", shop_id, write=write)
    if write:
        limit = db.execute("INSERT INTO shop_write_limits(session_id,attempts) VALUES(%s,1) ON CONFLICT(session_id) DO UPDATE SET attempts=CASE WHEN shop_write_limits.window_at<now()-interval '10 minutes' THEN 1 ELSE shop_write_limits.attempts+1 END,window_at=CASE WHEN shop_write_limits.window_at<now()-interval '10 minutes' THEN now() ELSE shop_write_limits.window_at END RETURNING attempts", (row["id"],)).fetchone()
        db.commit()
        if limit["attempts"] > 30:
            raise HTTPException(429, "You have saved 30 changes. Please wait ten minutes before saving again.")
    return row


@router.get("/shops/{shop_id}/products")
def products(shop_id: str, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id)
        catalog = store.catalog(db)
        return {"currency": "USD", "products": [{"id": o["product_id"], "offer_id": o["id"], "variant": o["variant"], "listed": o["list_usd"], "lowest": o["floor_usd"], "cost": o["cost_usd"], "stock": o["stock"], "version": o["version"], "days": o["days_on_shelf"], "goal": "Clear older stock" if o["days_on_shelf"] >= 90 else "Sell within permitted prices"} for o in sorted(catalog.offers.values(), key=lambda o: o["id"]) if o["shop_id"] == shop_id], "changes": recent_changes(db, shop_id)}


@router.get("/shops/{shop_id}/orders")
def shop_orders(shop_id: str, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id)
        return fulfillment.merchant_orders(db, shop_id)


@router.get("/shops/{shop_id}/settings")
def settings(shop_id: str, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id)
        policy = store.catalog(db).policies[shop_id]
        return {key: policy[key] for key in ("discount_bp", "sample_kit")}


@router.patch("/shops/{shop_id}/settings")
def save_settings(shop_id: str, body: Policy, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id, write=True)
        policy = store.catalog(db).policies[shop_id]
        db.execute("UPDATE shop_policies SET policy=%s WHERE shop_id=%s", (Jsonb({**policy, **body.model_dump()}), shop_id))
    return body.model_dump()


@router.post("/shops/{shop_id}/orders/{order_id}/handoff")
def handoff(shop_id: str, order_id: str, body: Shipment, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id, write=True)
        return fulfillment.handoff(db, orders.identifier(order_id), shop_id, body.carrier, body.tracking)


@router.get("/hub/orders")
def hub_orders(request: Request):
    with connect() as db:
        row = owner(db, request)
        sessions.scoped(row, "hub")
        rows = db.execute("SELECT id FROM orders ORDER BY created_at DESC LIMIT 100").fetchall()
        return {"orders": [orders.public_order(db, row["id"]) for row in rows]}


@router.post("/hub/orders/{order_id}/ship")
def ship(order_id: str, body: Shipment, request: Request):
    with connect() as db:
        row = owner(db, request, write=True)
        sessions.scoped(row, "hub", write=True)
        return fulfillment.ship(db, orders.identifier(order_id), body.carrier, body.tracking)


@router.post("/hub/orders/{order_id}/true-up")
def true_up(order_id: str, body: ActualCosts, request: Request):
    with connect() as db:
        row = owner(db, request, write=True)
        sessions.scoped(row, "hub", write=True)
        return fulfillment.true_up(db, orders.identifier(order_id), body.actual_minor)


@router.post("/hub/orders/{order_id}/delivered")
def delivered(order_id: str, request: Request):
    with connect() as db:
        row = owner(db, request, write=True)
        sessions.scoped(row, "hub", write=True)
        return fulfillment.delivered(db, orders.identifier(order_id))


@router.get("/hub/recovery")
def recovery(request: Request):
    with connect() as db:
        row = owner(db, request)
        sessions.scoped(row, "hub")
        rows = db.execute("SELECT p.id,p.kind,p.status,p.provider_ref,p.request_id,o.id AS order_id FROM payment_ops p LEFT JOIN orders o ON o.member_id=p.member_id WHERE p.status IN ('inflight','unknown','pending','failed') ORDER BY p.created_at DESC LIMIT 100").fetchall()
        jobs = db.execute("SELECT id,kind,status,error FROM jobs WHERE status='recovery' ORDER BY run_at LIMIT 100").fetchall()
        tracking = db.execute("SELECT order_id,status,request_id FROM tracking_operations WHERE status!='completed' ORDER BY updated_at LIMIT 100").fetchall()
        return {"operations": rows, "jobs": jobs, "tracking": tracking, "actions": "Reconcile a saved operation before retrying. Missing provider references require provider activity review."}


@router.post("/hub/recovery/{request_id:path}/reconcile")
def reconcile_operation(request_id: str, request: Request):
    from .payments.ledger import reconcile

    with connect() as db:
        row = owner(db, request, write=True)
        sessions.scoped(row, "hub", write=True)
        db.commit()
        reconcile(db, request_id)
    return {"reconciled": True}


@router.post("/hub/jobs/{job_id}/resume")
def resume_job(job_id: int, request: Request):
    with connect() as db:
        row = owner(db, request, write=True)
        sessions.scoped(row, "hub", write=True)
        changed = db.execute("UPDATE jobs SET status='ready',run_at=now(),attempts=0,error=NULL WHERE id=%s AND status='recovery' RETURNING id", (job_id,)).fetchone()
        if not changed:
            raise HTTPException(409, "This job is not awaiting recovery.")
    return {"queued": True}


class ListingEdit(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    list_usd: StrictInt = Field(gt=0)
    floor_usd: StrictInt = Field(ge=0)
    stock: StrictInt = Field(ge=0, le=500)
    version: StrictInt = Field(ge=1)


def recent_changes(db, shop_id):
    return db.execute("SELECT id,offer_id,action,before,after,created_at FROM listing_changes WHERE shop_id=%s ORDER BY id DESC LIMIT 20", (shop_id,)).fetchall()


def audit(db, session, shop, offer, action, before, after):
    db.execute("INSERT INTO listing_changes(shop_id,offer_id,session_id,action,before,after) VALUES(%s,%s,%s,%s,%s,%s)", (shop, offer, session["id"], action, Jsonb(before), Jsonb(after)))


@router.patch("/shops/{shop_id}/products/{offer_id:path}")
def edit_product(shop_id: str, offer_id: str, body: ListingEdit, request: Request):
    with connect() as db:
        session = shop_owner(db, request, shop_id, write=True)
        store.catalog(db)
        row = db.execute("SELECT * FROM catalog_offers WHERE id=%s AND shop_id=%s FOR UPDATE", (offer_id, shop_id)).fetchone()
        if not row:
            raise HTTPException(404, "Product is not in your shop.")
        if row["version"] != body.version:
            raise HTTPException(409, "This listing changed. Reload products before editing again.")
        seeded = Catalog().offers[offer_id]["list_usd"]
        if not seeded * 50 <= body.list_usd * 100 <= seeded * 150:
            raise HTTPException(422, "Listed price must stay within 50–150% of its launch price.")
        if not row["cost_usd"] <= body.floor_usd <= body.list_usd:
            raise HTTPException(422, "Lowest price must be at least your cost and no higher than listed price.")
        before = {k: row[k] for k in ("list_usd", "floor_usd", "stock", "version")}
        after = {**body.model_dump(), "version": body.version + 1}
        db.execute("UPDATE catalog_offers SET list_usd=%s,floor_usd=%s,stock=%s,version=version+1 WHERE id=%s", (body.list_usd, body.floor_usd, body.stock, offer_id))
        audit(db, session, shop_id, offer_id, "listing", before, after)
        return after


@router.post("/shops/{shop_id}/reset")
def reset_shop(shop_id: str, request: Request):
    with connect() as db:
        session = shop_owner(db, request, shop_id, write=True)
        launch = Catalog()
        store.catalog(db)
        for row in db.execute("SELECT * FROM catalog_offers WHERE shop_id=%s ORDER BY id FOR UPDATE", (shop_id,)).fetchall():
            value = launch.offers[row["id"]]
            reserved = db.execute("SELECT count(*) AS n FROM order_reservations WHERE offer_id=%s AND state='reserved'", (row["id"],)).fetchone()["n"]
            after = {k: value[k] for k in ("list_usd", "floor_usd", "stock")}
            after["stock"] = max(0, after["stock"] - reserved)
            db.execute("UPDATE catalog_offers SET list_usd=%s,floor_usd=%s,stock=%s,version=version+1 WHERE id=%s", (*after.values(), row["id"]))
            audit(db, session, shop_id, row["id"], "reset", {k: row[k] for k in after}, after)
        before = store.catalog(db).policies[shop_id]
        db.execute("UPDATE shop_policies SET policy=%s,goal_draft=NULL WHERE shop_id=%s", (Jsonb(launch.policies[shop_id]), shop_id))
        audit(db, session, shop_id, None, "reset goals", before, launch.policies[shop_id])
        return {"reset": True}


class GoalText(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=3, max_length=1000)


class ApplyGoal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    draft_id: str = Field(min_length=1, max_length=64)


@router.get("/shops/{shop_id}/goals")
def shop_goals(shop_id: str, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id)
        policy = store.catalog(db).policies[shop_id]
        draft = db.execute("SELECT goal_draft FROM shop_policies WHERE shop_id=%s", (shop_id,)).fetchone()["goal_draft"]
        return {**{k: policy[k] for k in ("goal_text", "strategy", "summary", "applied_at")}, "draft": draft}


@router.post("/shops/{shop_id}/goals/compile")
def compile_goals(shop_id: str, body: GoalText, request: Request):
    from uuid import uuid4
    with connect() as db:
        shop_owner(db, request, shop_id, write=True)
        store.catalog(db)
    try:
        draft = {**goals.compile_goal(body.text), "draft_id": str(uuid4())}
    except Exception:
        raise HTTPException(503, "Your goal could not be compiled. Your applied rules have not changed. Try again.") from None
    with connect() as db:
        row = owner(db, request, write=True)
        sessions.scoped(row, "shop", shop_id, write=True)
        db.execute("UPDATE shop_policies SET goal_draft=%s WHERE shop_id=%s", (Jsonb(draft), shop_id))
    return draft


@router.post("/shops/{shop_id}/goals/apply")
def apply_goals(shop_id: str, body: ApplyGoal, request: Request):
    from datetime import datetime, timezone
    with connect() as db:
        session = shop_owner(db, request, shop_id, write=True)
        row = db.execute("SELECT policy,goal_draft FROM shop_policies WHERE shop_id=%s FOR UPDATE", (shop_id,)).fetchone()
        if not row or not row["goal_draft"] or row["goal_draft"]["draft_id"] != body.draft_id:
            raise HTTPException(409, "This goal changed. Compile and review it again before applying.")
        draft = row["goal_draft"]
        strategy = goals.ShopStrategy.model_validate(draft["strategy"]).model_dump()
        policy = {**row["policy"], "goal_text": draft["goal_text"], "strategy": strategy, "summary": goals.summary(strategy), "applied_at": datetime.now(timezone.utc).isoformat(), "applied_by": str(session["id"])}
        db.execute("UPDATE shop_policies SET policy=%s,goal_draft=NULL WHERE shop_id=%s", (Jsonb(policy), shop_id))
        audit(db, session, shop_id, None, "apply goals", row["policy"], policy)
        return {k: policy[k] for k in ("goal_text", "strategy", "summary", "applied_at")}
