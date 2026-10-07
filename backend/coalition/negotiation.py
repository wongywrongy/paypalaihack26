"""Two bounded roles; only server-validated merchant quotes become executable."""

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from .catalog import PRODUCTS
from .config import settings
from .db import enqueue
from .matching import eligible_for_quote, latest_request
from .model import complete


class Tier(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    minimum_buyers: int = Field(gt=0)
    total_each_cents: int = Field(gt=0)


class Proposal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    proposal_id: str
    version: int = Field(gt=0)
    product_id: str
    variant_id: str
    currency: Literal["USD"]
    tier_schedule: list[Tier] = Field(min_length=2, max_length=2)
    minimum_commitments: int = Field(gt=0)
    requested_units: int = Field(gt=0)
    reservation_expiry: datetime
    close_at: datetime
    delivery_by: datetime
    explanation: str = Field(min_length=1, max_length=240)


class Reply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["propose", "accept", "decline"]
    proposal: Proposal | None = None


def validate_proposal(p, context, policy):
    expected = context["template"]
    if p.proposal_id != expected["proposal_id"] or p.version != expected["version"]:
        raise ValueError("Proposal version does not match this exchange.")
    for field in (
        "product_id",
        "variant_id",
        "currency",
        "minimum_commitments",
        "requested_units",
    ):
        if getattr(p, field) != expected[field]:
            raise ValueError("Proposal changes an unauthorized term.")
    for field in ("reservation_expiry", "close_at", "delivery_by"):
        if getattr(p, field) != datetime.fromisoformat(expected[field]):
            raise ValueError("Proposal changes an unauthorized date.")
    thresholds = context["thresholds"]
    prices = []
    for i, t in enumerate(p.tier_schedule):
        low, high = policy["ranges"][i]
        if (
            t.minimum_buyers != thresholds[i]
            or not max(low, policy["floors"][i]) <= t.total_each_cents <= high
        ):
            raise ValueError("Quote is outside merchant permissions.")
        prices.append(t.total_each_cents)
    if prices[1] > prices[0] or p.variant_id not in policy["variants"]:
        raise ValueError("Quote tiers or variant are invalid.")
    if any(price > context["public_product"]["price_minor"] for price in prices):
        raise ValueError("Quote exceeds the merchant's listed price.")
    if (
        p.close_at <= datetime.now(timezone.utc)
        or p.reservation_expiry <= p.close_at
        or p.delivery_by < p.close_at
    ):
        raise ValueError("Quote has expired or impossible dates.")
    return p


def start(db, buyer, product_id):
    from .groups import lock_group

    g = db.execute(
        "SELECT * FROM groups WHERE run_id=%s", (buyer["run_id"],)
    ).fetchone()
    g = lock_group(db, g["id"])
    if g["status"] != "DRAFT":
        raise HTTPException(
            409,
            "This run already has fixed terms. Prepare a new run for another agreement.",
        )
    req = latest_request(db, buyer["id"])
    if (
        not req
        or req["status"] != "completed"
        or not db.execute(
            "SELECT 1 FROM compatibility_assessments WHERE request_id=%s AND product_id=%s AND eligible",
            (req["id"], product_id),
        ).fetchone()
    ):
        raise HTTPException(
            409, "Resolve all mandatory requirements before negotiation."
        )
    existing = db.execute(
        "SELECT id FROM negotiations WHERE group_id=%s AND status IN ('queued','running')",
        (g["id"],),
    ).fetchone()
    if existing:
        return {"id": existing["id"], "status": "queued"}
    nid = uuid4()
    db.execute(
        "INSERT INTO negotiations(id,group_id,request_id,product_id,model) VALUES(%s,%s,%s,%s,%s)",
        (
            nid,
            g["id"],
            req["id"],
            product_id,
            settings.llm_model if settings.mode == "connected" else "fixture",
        ),
    )
    enqueue(
        db,
        "negotiate",
        {"negotiation_id": str(nid), "group_id": str(g["id"])},
        f"negotiate:{nid}",
    )
    return {"id": nid, "status": "queued"}


def accept(db, n, product, proposal):
    from .groups import lock_group, wake

    if settings.mode == "connected" and not settings.paypal_merchant_id:
        raise ValueError("Configure the sandbox merchant before accepting a quote.")
    g = lock_group(db, n["group_id"])
    if g["status"] != "DRAFT" or datetime.now(timezone.utc) >= proposal.close_at:
        raise ValueError("Offer state or quote expiry changed during negotiation.")
    current = latest_request(db, n["buyer_id"])
    if not current or current["id"] != n["request_id"]:
        raise ValueError("Buyer requirements changed; evaluate and negotiate again.")
    stock = db.execute(
        "SELECT * FROM catalog_stock WHERE product_id=%s FOR UPDATE", (product["id"],)
    ).fetchone()
    if not stock or stock["available"] < proposal.requested_units:
        raise ValueError("Insufficient inventory for this quote.")
    quote_id = "quote-" + str(uuid4())
    version = 1
    terms = {
        "offer_id": quote_id,
        "version": version,
        "proposal_id": proposal.proposal_id,
        "proposal_version": proposal.version,
        "product_id": product["id"],
        "title": product["title"],
        "variant": proposal.variant_id,
        "quantity": 1,
        "merchant": "Commonplace Audio (fictional)",
        "merchant_id": "commonplace",
        "payee_id": settings.paypal_merchant_id,
        "currency": "USD",
        "total_minor": proposal.tier_schedule[0].total_each_cents,
        "minimum": proposal.minimum_commitments,
        "capacity": proposal.requested_units,
        "tier_schedule": [t.model_dump() for t in proposal.tier_schedule],
        "delivery_days": product["delivery_days"],
        "delivery_by": proposal.delivery_by.isoformat(),
        "close_at": proposal.close_at.isoformat(),
        "reservation_expiry": proposal.reservation_expiry.isoformat(),
        "shipping_minor": 0,
        "tax_minor": 0,
        "source_version": product["source_version"],
        "policy_id": product["policy_id"],
        "pricing_model": "tiers",
        "payment_terms": "Approve the maximum. At the fixed deadline, settle the reached tier or unwind all payments. Holds and refunds follow provider and bank timing.",
    }
    if not eligible_for_quote(db, n["buyer_id"], terms):
        raise ValueError("Final quote exceeds the buyer's requirements.")
    db.execute(
        "INSERT INTO offers(id,product_id,terms,price_minor,currency,minimum,capacity,inventory,version,pricing_model) VALUES(%s,%s,%s,%s,'USD',%s,%s,%s,%s,'tiers')",
        (
            quote_id,
            product["id"],
            Jsonb(terms),
            terms["total_minor"],
            terms["minimum"],
            terms["capacity"],
            terms["capacity"],
            version,
        ),
    )
    db.execute(
        "UPDATE catalog_stock SET available=available-%s WHERE product_id=%s",
        (terms["capacity"], product["id"]),
    )
    db.execute(
        "INSERT INTO inventory_reservations(quote_id,product_id,units,expires_at) VALUES(%s,%s,%s,%s)",
        (quote_id, product["id"], terms["capacity"], proposal.reservation_expiry),
    )
    db.execute(
        "UPDATE groups SET status='OPEN',offer_id=%s,inventory_reserved=%s,deadline=%s,preparation_expires_at=%s WHERE id=%s",
        (quote_id, terms["capacity"], proposal.close_at, proposal.close_at, g["id"]),
    )
    db.execute(
        "UPDATE negotiations SET status='accepted',error=NULL WHERE id=%s", (n["id"],)
    )
    wake(db, g["id"])


def run_negotiation(db, nid):
    n = db.execute(
        "SELECT n.*,r.profile,r.close_seconds,b.id AS buyer_id,q.constraints FROM negotiations n JOIN groups g ON g.id=n.group_id JOIN runs r ON r.id=g.run_id JOIN buyer_requests q ON q.id=n.request_id JOIN buyers b ON b.id=q.buyer_id WHERE n.id=%s",
        (nid,),
    ).fetchone()
    if n["status"] in ("accepted", "failed"):
        return
    if n["status"] == "running":
        # A crash consumes this bounded attempt, never silently launches new live exchanges.
        db.execute(
            "UPDATE negotiations SET status='failed',error='Negotiation interrupted. Retry with a new bounded attempt.' WHERE id=%s",
            (nid,),
        )
        return
    now = datetime.now(timezone.utc).replace(microsecond=0)
    db.execute(
        "UPDATE negotiations SET status='running',started_at=%s,expires_at=%s WHERE id=%s",
        (now, now + timedelta(seconds=120), nid),
    )
    product = next(p for p in PRODUCTS if p["id"] == n["product_id"])
    policy = db.execute(
        "SELECT private_terms FROM merchant_policies WHERE id=%s",
        (product["policy_id"],),
    ).fetchone()["private_terms"]
    available = db.execute(
        "SELECT available FROM catalog_stock WHERE product_id=%s", (product["id"],)
    ).fetchone()["available"]
    thresholds, capacity = ([3, 5], 5) if n["profile"] == "small" else ([25, 50], 60)
    close_at = now + timedelta(seconds=n["close_seconds"])
    delivery = (now + timedelta(days=product["delivery_days"])).replace(
        hour=23, minute=59, second=59, microsecond=0
    )
    template = {
        "proposal_id": str(nid),
        "version": 1,
        "product_id": product["id"],
        "variant_id": "Graphite",
        "currency": "USD",
        "minimum_commitments": thresholds[0],
        "requested_units": capacity,
        "reservation_expiry": (close_at + timedelta(minutes=30)).isoformat(),
        "close_at": close_at.isoformat(),
        "delivery_by": delivery.isoformat(),
        "tier_schedule": [
            {"minimum_buyers": thresholds[i], "total_each_cents": policy["base"][i]}
            for i in range(2)
        ],
        "explanation": "Quantity-based merchant discount.",
    }
    demand = []
    for b in db.execute(
        "SELECT id FROM buyers WHERE run_id=(SELECT run_id FROM groups WHERE id=%s)",
        (n["group_id"],),
    ).fetchall():
        r = latest_request(db, b["id"])
        if r and r["status"] == "completed":
            assessment = db.execute(
                "SELECT eligible FROM compatibility_assessments WHERE request_id=%s AND product_id=%s",
                (r["id"], product["id"]),
            ).fetchone()
            if assessment and assessment["eligible"]:
                demand.append(r["constraints"])
    db.commit()
    clock = time.monotonic()
    merchant_quote = None
    last_bid = None
    tokens = 0
    try:
        for i in range(6):
            remaining = 120 - (time.monotonic() - clock)
            if remaining <= 0 or tokens >= 24000:
                raise ValueError("Negotiation budget exhausted.")
            role = "buyer" if i % 2 == 0 else "merchant"
            template["version"] = i + 1
            context = {
                "template": template,
                "thresholds": thresholds,
                "public_product": product,
                "compatible_request_count": len(demand),
                "last_merchant_quote": merchant_quote.model_dump(mode="json")
                if merchant_quote
                else None,
            }
            payload = {
                **context,
                **(
                    {"constraints": n["constraints"], "candidate_constraints": demand}
                    if role == "buyer"
                    else {
                        "merchant_policy": policy,
                        "inventory_capacity": capacity,
                        "inventory_available": available,
                        "last_buyer_bid": last_bid if i else None,
                    }
                ),
            }
            private_error = None
            reply = None
            try:
                if settings.mode == "fixture":
                    p = {
                        **template,
                        "tier_schedule": [
                            {
                                "minimum_buyers": thresholds[j],
                                "total_each_cents": [8900, 8500][j],
                            }
                            for j in range(2)
                        ],
                    }
                    reply = Reply(
                        action="accept" if i == 2 else "propose",
                        proposal=None
                        if i == 2
                        else Proposal.model_validate_json(json.dumps(p)),
                    )
                    used = 0
                else:
                    reply, used = complete(
                        Reply,
                        "You are the "
                        + role
                        + " agent. Seek 8900/8500 cents quantity tiers when feasible. Buyer may accept the last merchant quote, propose a bid, or decline. For buyer acceptance return action accept and proposal null. Merchant must counter an unacceptable bid rather than copy it: tier i must be within merchant_policy.ranges[i], inclusive, and at or above floors[i]. Prefer the requested target if allowed. Every NEW proposal must copy proposal_id, version and dates exactly from CURRENT template, even when responding to a previous bid. Only merchant quotes can be executed.",
                        payload,
                        timeout=min(40, remaining),
                        max_tokens=1000,
                        provider_schema=True,
                        remaining_tokens=24000 - tokens,
                    )
                tokens += used
                if role == "merchant" and reply.action != "decline":
                    if reply.action != "propose" or not reply.proposal:
                        raise ValueError("Merchant must issue a structured quote.")
                    validate_proposal(reply.proposal, context, policy)
                elif reply.action == "propose" and not reply.proposal:
                    raise ValueError("Bid is missing.")
                elif (
                    role == "buyer"
                    and reply.action == "accept"
                    and merchant_quote is None
                ):
                    raise ValueError("There is no validated merchant quote to accept.")
            except Exception as exc:
                tokens += 1000
                private_error = str(exc)[:400]
            summary = (
                ("Buyer agent" if role == "buyer" else "Merchant agent")
                + ": "
                + (
                    "Invalid output; no executable quote."
                    if private_error
                    else "No agreement proposed."
                    if reply.action == "decline"
                    else "Accepted the validated merchant quote."
                    if reply.action == "accept"
                    else "Proposed "
                    + " / ".join(
                        f"${t.total_each_cents / 100:.2f} at {t.minimum_buyers} buyers"
                        for t in reply.proposal.tier_schedule
                    )
                    + "."
                )
            )
            db.execute(
                "INSERT INTO negotiation_rounds(negotiation_id,ordinal,role,proposal,valid,private_error,public_summary) VALUES(%s,%s,%s,%s,%s,%s,%s)",
                (
                    nid,
                    i + 1,
                    role,
                    Jsonb(reply.model_dump(mode="json")) if reply else None,
                    not bool(private_error),
                    private_error,
                    summary,
                ),
            )
            db.execute(
                "UPDATE negotiations SET token_count=%s WHERE id=%s", (tokens, nid)
            )
            db.commit()
            if private_error:
                continue
            if reply.action == "decline":
                raise ValueError("Agent declined the proposed agreement.")
            if role == "buyer" and reply.action == "accept":
                if not merchant_quote:
                    raise ValueError("No validated merchant quote exists to accept.")
                if time.monotonic() - clock >= 120 or tokens > 24000:
                    raise ValueError("Negotiation budget exhausted.")
                accept(db, n, product, merchant_quote)
                return
            if role == "merchant":
                merchant_quote = reply.proposal
            else:
                last_bid = reply.proposal.model_dump(mode="json")
        raise ValueError("No agreement reached within three exchanges.")
    except Exception as exc:
        db.rollback()
        # Public reasons are server-owned; never expose merchant floors or raw model errors.
        reason = (
            str(exc)
            if isinstance(exc, ValueError)
            else "Negotiation unavailable. Retry when the model is available."
        )
        db.execute(
            "UPDATE negotiations SET status='failed',error=%s WHERE id=%s",
            (reason[:240], nid),
        )
