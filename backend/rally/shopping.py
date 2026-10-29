"""Same-origin shopper APIs. Every quote and payment is owned on the server."""

import asyncio
import json
from time import monotonic

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from . import assistant, orders, sessions, store
from .config import settings
from .countries import public_countries
from .db import connect

router = APIRouter(prefix="/api")


class BagInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    country: str = Field(pattern="^(US|CA|GB|DE|AU)$")
    items: list[str] = Field(min_length=1, max_length=8)
    rules: dict[str, StrictBool]


class AssistInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=3, max_length=1000)
    country: str = Field(pattern="^(US|CA|GB|DE|AU)$")
    rules: dict[str, StrictBool] | None = None


class CheckoutInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    quote_id: str


class ApprovalInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    order_id: str = Field(min_length=1, max_length=100)


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    role: str
    shop_id: str | None = None
    password: str = Field(min_length=1, max_length=256)


def owner(db, request, *, write=False):
    session, raw = sessions.current(db, request)
    if write:
        sessions.check_write(request, raw)
    return session


@router.get("/session")
def session(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    with connect() as db:
        row, raw = sessions.current(db, request, response)
        return {"csrf_token": sessions.csrf(raw), "paypal_client_id": settings.paypal_client_id, "role": row["role"], "shop_id": row["shop_id"], "read_only": row["read_only"]}


@router.post("/login")
def login(body: LoginInput, request: Request, response: Response):
    with connect() as db:
        row = owner(db, request, write=True)
        return sessions.login(db, row, request, response, body.role, body.shop_id, body.password)


@router.post("/logout")
def logout(request: Request, response: Response):
    with connect() as db:
        row = owner(db, request, write=True)
        import secrets

        raw = secrets.token_urlsafe(32)
        db.execute("UPDATE shopper_sessions SET token_hash=%s,role=NULL,shop_id=NULL,read_only=false WHERE id=%s", (sessions.digest(raw), row["id"]))
        sessions.set_cookie(response, raw)
        return {"csrf_token": sessions.csrf(raw), "paypal_client_id": settings.paypal_client_id}


@router.get("/countries")
def countries():
    return {"countries": public_countries()}


@router.get("/catalog")
def catalog(country: str = "US"):
    with connect() as db:
        return store.catalog(db).public(country)


@router.post("/quotes")
def quote(body: BagInput, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        return orders.estimate(db, session["id"], body.model_dump())


@router.post("/assist")
def assist(body: AssistInput, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        catalog = store.catalog(db)
    result = assistant.suggest(body.text, body.country, catalog)
    rows = [{"id": pid, "reason": reason, "step": catalog.products[pid]["category"], "shop": catalog.offers[next(line.offer_id for line in result["quote"]["lines"] if catalog.offers[line.offer_id]["product_id"] == pid)]["shop_id"]} for pid, reason in zip(result["items"], result["reasons"], strict=True)]
    with connect() as db:
        value = orders.estimate(db, session["id"], {"items": result["items"], "country": body.country, "rules": body.rules or {"old_packaging_ok": False, "bundles_ok": False}})
    return {"request": body.text, "items": rows, "quote": value, "chosen_by": result["chosen_by"]}


@router.post("/bags")
def create_bag(body: BagInput, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        return orders.save_bag(db, session["id"], body.model_dump())


@router.patch("/bags/{bag_id}")
def update_bag(bag_id: str, body: BagInput, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        return orders.save_bag(db, session["id"], body.model_dump(), bag_id)


@router.get("/bags/{bag_id}/quote")
def bag_quote(bag_id: str, request: Request):
    with connect() as db:
        session = owner(db, request)
        return orders.quote_public(orders.latest_quote(db, bag_id, session["id"]), store.catalog(db))


@router.post("/bags/{bag_id}/checkout")
def checkout(bag_id: str, body: CheckoutInput, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        return orders.checkout(db, session["id"], bag_id, body.quote_id)


@router.post("/bags/{bag_id}/checkout/approve")
def approve(bag_id: str, body: ApprovalInput, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        return orders.approve(db, session["id"], bag_id, body.order_id)


@router.get("/orders")
def history(request: Request):
    with connect() as db:
        session = owner(db, request)
        ids = db.execute("SELECT id FROM orders WHERE session_id=%s ORDER BY created_at DESC LIMIT 100", (session["id"],)).fetchall()
        return {"orders": [orders.public_order(db, row["id"], session["id"]) for row in ids]}


@router.get("/orders/{order_id}")
def order(order_id: str, request: Request):
    with connect() as db:
        session = owner(db, request)
        return orders.public_order(db, orders.identifier(order_id), session["id"])


@router.post("/orders/{order_id}/cancel")
def cancel(order_id: str, request: Request):
    with connect() as db:
        session = owner(db, request, write=True)
        return orders.cancel(db, orders.identifier(order_id), session["id"])


@router.get("/orders/{order_id}/deal")
def deal(order_id: str, request: Request):
    return order(order_id, request)


@router.get("/orders/{order_id}/deal/stream")
def stream(order_id: str, request: Request, after: int = 0):
    oid = orders.identifier(order_id)
    with connect() as db:
        session = owner(db, request)
        orders.owned(db, oid, session["id"])
    try:
        cursor = max(0, after, int(request.headers.get("last-event-id", "0")))
    except ValueError:
        cursor = max(0, after)
    async def events():
        nonlocal cursor
        until = monotonic() + 110
        while monotonic() < until:
            if await request.is_disconnected():
                return
            with connect() as db:
                row = orders.owned(db, oid, session["id"])
                batch = db.execute("SELECT seq,data FROM deal_events WHERE order_id=%s AND seq>%s ORDER BY seq LIMIT 100", (oid, cursor)).fetchall()
            for event in batch:
                cursor = event["seq"]
                yield f"id: {cursor}\nevent: deal\ndata: {json.dumps(event['data'])}\n\n"
            if row["payment_state"] in ("CHARGED", "VOIDED", "REFUNDED", "NEEDS_REVIEW"):
                yield f"event: status\ndata: {json.dumps({'payment_state': row['payment_state']})}\n\n"
                return
            yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@router.post("/reset")
def reset(request: Request):
    with connect() as db:
        owner(db, request, write=True)
    # Old quotes/orders are retained; the client clears its current editable bag.
    return {"reset": True}
