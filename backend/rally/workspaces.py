"""Shop-scoped economics and hub-only fulfillment controls."""

from fastapi import APIRouter, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from . import fulfillment, orders, sessions, store
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
    return row


@router.get("/shops/{shop_id}/products")
def products(shop_id: str, request: Request):
    with connect() as db:
        shop_owner(db, request, shop_id)
        catalog = store.catalog(db)
        return {"currency": "USD", "products": [{"id": o["product_id"], "offer_id": o["id"], "variant": o["variant"], "listed": o["list_usd"], "lowest": o["floor_usd"], "cost": o["cost_usd"], "stock": o["stock"], "days": o["days_on_shelf"], "goal": "Clear older stock" if o["days_on_shelf"] >= 90 else "Sell within permitted prices"} for o in catalog.offers.values() if o["shop_id"] == shop_id]}


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
