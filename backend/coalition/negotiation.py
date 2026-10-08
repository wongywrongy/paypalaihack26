"""Two bounded roles; only server-validated merchant quotes become executable."""

import json
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from .catalog import PRODUCTS, SHOP_PRODUCTS
from .config import settings
from .db import enqueue
from .matching import eligible_for_quote, latest_request
from .model import complete
from .shopping import buyer_for_run, draft, lock_owner


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


def compatible_demand(db, product, run_id=None, quote=None):
    """Distinct owners with current, supported requirements; never funding."""
    delivery = (
        quote["delivery_by"][:10]
        if quote
        else (datetime.now(timezone.utc) + timedelta(days=product["delivery_days"])).date().isoformat()
    )
    maximum = quote["total_minor"] if quote else product["public_policy"]["ranges"][0][0]
    rows = db.execute(
        "SELECT DISTINCT ON(b.owner_id) q.constraints FROM buyers b JOIN runs r ON r.id=b.run_id JOIN LATERAL (SELECT * FROM buyer_requests WHERE owner_id=b.owner_id ORDER BY created_at DESC,version DESC LIMIT 1) q ON true JOIN compatibility_assessments a ON a.request_id=q.id WHERE r.mode=%s AND (%s::uuid IS NULL OR b.run_id=%s) AND q.status='completed' AND a.product_id=%s AND a.source_version=%s AND a.eligible ORDER BY b.owner_id",
        (settings.mode, run_id, run_id, product["id"], product["source_version"]),
    ).fetchall()
    return [
        r["constraints"] for r in rows
        if r["constraints"]["max_total_minor"] >= maximum
        and r["constraints"]["latest_arrival"] >= delivery
        and r["constraints"]["quantity"] == 1
    ]


def public_round(reply, role, prior, valid=True):
    """Server-written explanations; model explanations and private policy never leave here."""
    previous = next((e for e in reversed(prior) if e["speaker"] != role and e["valid"] and e["tiers"]), None)
    own = reply.proposal.model_dump(mode="json") if reply and reply.proposal and valid else None
    tiers = own["tier_schedule"] if own else previous["tiers"] if valid and reply.action == "accept" and previous else []
    changes = []
    if tiers and previous:
        old = {t["minimum_buyers"]: t["total_each_cents"] for t in previous["tiers"]}
        changes = [
            {"field": "tier_price", "minimum_buyers": t["minimum_buyers"], "from_minor": old.get(t["minimum_buyers"]), "to_minor": t["total_each_cents"]}
            for t in tiers if old.get(t["minimum_buyers"]) != t["total_each_cents"]
        ]
    action = "invalid"
    explanation = "Response could not be validated. No terms changed."
    if valid:
        if reply.action == "decline":
            action, explanation = "declined", "No offer within the buyer's requirements and the merchant's permitted terms was accepted."
        elif reply.action == "accept":
            action, explanation = "accepted", "Within your maximum and delivery requirement. Human payment approval is still needed."
        elif role == "merchant" and previous and not changes:
            action, explanation = "accepted", "Matches your agent's offer within the merchant's published quantity-price ranges."
        elif previous and changes:
            action, explanation = "countered", "Tier prices changed; product, delivery and currency stay fixed."
            if role == "merchant":
                explanation += " Within the merchant's published quantity-price ranges."
        else:
            action, explanation = "offered", "Quantity prices proposed within your maximum; authorizations are still required." if role == "buyer" else "Quantity prices offered within the merchant's published ranges."
    return {
        "speaker": role, "action": action, "valid": valid,
        "currency": "USD", "tiers": tiers, "changes": changes,
        "explanation": explanation,
        "proposal_reference": {"id": own["proposal_id"], "version": own["version"]} if own else previous.get("proposal_reference") if previous and reply and reply.action == "accept" else None,
        "accepted_quote_reference": None,
    }


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
        p.currency != policy["currency"]
        or not policy["delivery_days"][0]
        <= context["public_product"]["delivery_days"]
        <= policy["delivery_days"][1]
    ):
        raise ValueError("Quote currency or delivery is outside merchant authority.")
    if p.requested_units > context.get("inventory_available", p.requested_units):
        raise ValueError("Quote exceeds currently available inventory.")
    if (
        p.close_at <= datetime.now(timezone.utc)
        or p.reservation_expiry <= p.close_at
        or p.delivery_by < p.close_at
    ):
        raise ValueError("Quote has expired or impossible dates.")
    return p


def available_capacity(policy, profile):
    if profile != "small":
        raise ValueError(
            "These merchant policies permit five-buyer groups; use a small run."
        )
    return policy["capacity"]


def matching_group(db, buyer, current_group, product_id, lock=False):
    """Read-only availability and locked selection share the same eligibility rules."""
    from .groups import lock_group

    for candidate in db.execute(
        "SELECT g.*,o.terms FROM groups g JOIN runs r ON r.id=g.run_id JOIN offers o ON o.id=g.offer_id WHERE r.mode=%s AND (r.id=%s OR (r.shopping AND %s)) AND NOT r.archived AND g.status='OPEN' AND NOT g.closing AND g.deadline>clock_timestamp() AND o.product_id=%s ORDER BY g.deadline",
        (settings.mode, buyer["run_id"], not current_group["demo"], product_id),
    ).fetchall():
        g = lock_group(db, candidate["id"]) if lock else candidate
        used = db.execute(
            "SELECT count(*) AS n FROM commitments WHERE group_id=%s AND active",
            (g["id"],),
        ).fetchone()["n"]
        own = db.execute(
            "SELECT 1 FROM commitments c JOIN buyers b ON b.id=c.buyer_id WHERE c.group_id=%s AND c.active AND b.owner_id=%s",
            (g["id"], buyer["owner_id"]),
        ).fetchone()
        if (
            g["status"] == "OPEN"
            and not g["closing"]
            and g["deadline"] > datetime.now(timezone.utc)
            and (used < candidate["terms"]["capacity"] or own)
            and eligible_for_quote(db, buyer["id"], candidate["terms"])
        ):
            return {
                **g,
                "available_slots": max(
                    1 if own else 0, candidate["terms"]["capacity"] - used
                ),
            }
    return None


def start(db, buyer, product_id):
    from .groups import lock_group

    if product_id not in {p["id"] for p in SHOP_PRODUCTS}:
        raise HTTPException(
            409, "This product is no longer offered. Find another deal."
        )
    lock_owner(db, buyer["owner_id"])
    req = latest_request(db, buyer["id"])
    if (
        not req
        or req["status"] != "completed"
        or not db.execute(
            "SELECT 1 FROM compatibility_assessments WHERE request_id=%s AND product_id=%s AND eligible",
            (req["id"] if req else None, product_id),
        ).fetchone()
    ):
        raise HTTPException(
            409, "Resolve all mandatory requirements before negotiation."
        )
    # Serialize admission/matching for this product, then reserve stock at acceptance.
    db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,1))", (product_id,))
    current_group = db.execute(
        "SELECT g.*,r.profile FROM groups g JOIN runs r ON r.id=g.run_id WHERE g.run_id=%s",
        (buyer["run_id"],),
    ).fetchone()
    if current_group["profile"] != "small":
        raise HTTPException(
            409, "These merchant policies permit five-buyer groups; use a small run."
        )
    matched = matching_group(db, buyer, current_group, product_id, lock=True)
    if matched:
        buyer_for_run(db, buyer, matched["run_id"])
        return {"id": None, "status": "accepted", "run_id": matched["run_id"]}
    existing = db.execute(
        "SELECT n.*,g.run_id FROM negotiations n JOIN groups g ON g.id=n.group_id JOIN runs r ON r.id=g.run_id WHERE n.request_id=%s AND n.product_id=%s AND n.status IN ('queued','running') AND r.mode=%s LIMIT 1",
        (req["id"], product_id, settings.mode),
    ).fetchone()
    if existing:
        buyer_for_run(db, buyer, existing["run_id"])
        return {
            "id": existing["id"],
            "status": existing["status"],
            "run_id": existing["run_id"],
        }
    g = db.execute(
        "SELECT * FROM groups WHERE run_id=%s", (buyer["run_id"],)
    ).fetchone()
    occupied = db.execute(
        "SELECT group_id FROM negotiations WHERE group_id=%s AND status IN ('queued','running')",
        (g["id"],),
    ).fetchone()
    if g["status"] != "DRAFT" or occupied:
        buyer = draft(db, buyer)
        g = db.execute(
            "SELECT * FROM groups WHERE run_id=%s", (buyer["run_id"],)
        ).fetchone()
        if occupied and g["id"] == occupied.get("group_id"):
            raise HTTPException(409, "This draft is negotiating. Wait for its result.")
    g = lock_group(db, g["id"])
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
    return {"id": nid, "status": "queued", "run_id": g["run_id"]}


def accept(db, n, product, proposal, policy):
    from .groups import lock_group, wake

    if settings.mode == "connected" and not settings.paypal_merchant_id:
        raise ValueError("Configure the sandbox merchant before accepting a quote.")
    owner = db.execute(
        "SELECT owner_id FROM buyers WHERE id=%s", (n["buyer_id"],)
    ).fetchone()["owner_id"]
    lock_owner(db, owner)
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
    # Agent dates are validated first. Only this server-owned funding timestamp
    # moves, before publication/consent; delivery remains exactly as negotiated.
    close_at = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(
        seconds=n["close_seconds"]
    )
    proposal = proposal.model_copy(
        update={
            "close_at": close_at,
            "reservation_expiry": close_at + timedelta(minutes=30),
        }
    )
    if proposal.delivery_by < close_at or proposal.requested_units > available_capacity(
        policy, n["profile"]
    ):
        raise ValueError("Accepted funding window or capacity is invalid.")
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
        "merchant": policy["merchant"] + " (fictional)",
        "merchant_id": policy["merchant_id"],
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
        "UPDATE negotiations SET status='accepted',error=NULL,error_kind=NULL WHERE id=%s", (n["id"],)
    )
    db.execute(
        "UPDATE negotiation_rounds SET public_event=COALESCE(public_event,'{}'::jsonb)||%s WHERE negotiation_id=%s AND ordinal=(SELECT max(ordinal) FROM negotiation_rounds WHERE negotiation_id=%s)",
        (Jsonb({"accepted_quote_reference": {"id": quote_id, "version": version}}), n["id"], n["id"]),
    )
    wake(db, g["id"])


def run_negotiation(db, nid):
    n = db.execute(
        "SELECT n.*,g.demo,g.run_id,r.profile,r.close_seconds,b.id AS buyer_id,q.constraints,q.raw_text FROM negotiations n JOIN groups g ON g.id=n.group_id JOIN runs r ON r.id=g.run_id JOIN buyer_requests q ON q.id=n.request_id JOIN buyers b ON b.id=q.buyer_id WHERE n.id=%s",
        (nid,),
    ).fetchone()
    if n["status"] in ("accepted", "failed"):
        return
    if n["status"] == "running":
        # A crash consumes this bounded attempt, never silently launches new live exchanges.
        db.execute(
            "UPDATE negotiations SET status='failed',error_kind='interrupted',error='Negotiation interrupted. Retry with a new bounded attempt.' WHERE id=%s",
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
    if n["profile"] != "small":
        db.execute(
            "UPDATE negotiations SET status='failed',error_kind='unsupported_requirements',error='These merchant policies permit five-buyer groups; use a small run.' WHERE id=%s",
            (nid,),
        )
        return
    thresholds = policy["thresholds"]
    capacity = available_capacity(policy, n["profile"])
    close_at = now + timedelta(seconds=120 + n["close_seconds"])
    delivery = (now + timedelta(days=product["delivery_days"])).replace(
        hour=23, minute=59, second=59, microsecond=0
    )
    template = {
        "proposal_id": str(nid),
        "version": 1,
        "product_id": product["id"],
        "variant_id": product["variants"][0],
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
    demand = compatible_demand(db, product, n["run_id"] if n["demo"] else None)
    db.commit()
    clock = time.monotonic()
    merchant_quote = None
    last_bid = None
    feedback = {}
    tokens = 0
    events = []
    failure_kind = "no_agreement"
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
                "inventory_available": available,
                "last_merchant_quote": merchant_quote.model_dump(mode="json")
                if merchant_quote
                else None,
            }
            payload = {
                **context,
                "validation_feedback": feedback.get(role),
                **(
                    {
                        "constraints": n["constraints"],
                        "request": n["raw_text"],
                        "buyer_turn": i // 2 + 1,
                        "remaining_buyer_turns": 2 - i // 2,
                        "last_buyer_bid": last_bid,
                        "compatible_demand": {
                            "count": len(demand),
                            "budgets_minor": [c["max_total_minor"] for c in demand],
                        },
                    }
                    if role == "buyer"
                    else {
                        "merchant_policy": policy,
                        "inventory_capacity": capacity,
                        "inventory_available": available,
                        "aggregate_demand": {
                            "count": len(demand),
                            "budgets_minor": [c["max_total_minor"] for c in demand],
                        },
                        "last_buyer_bid": last_bid if i else None,
                    }
                ),
            }
            private_error = None
            provider_failed = False
            reply = None
            try:
                if settings.mode == "fixture":
                    p = {
                        **template,
                        "tier_schedule": [
                            {
                                "minimum_buyers": thresholds[j],
                                "total_each_cents": max(
                                    policy["ranges"][j][0], policy["floors"][j]
                                )
                                if len(demand) >= thresholds[0]
                                or n["constraints"]["max_total_minor"]
                                < policy["base"][0]
                                else policy["base"][j],
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
                        (
                            "You are the buyer agent. Negotiate using your constraints, public prices and compatible demand. The original request may include price preferences omitted from extraction; consider them within permitted prices. Validated constraints and the current template are authoritative when shopper edits differ from the original request. Template prices are examples, not required bids. Every proposed tier must be <= constraints.max_total_minor and within public_product.public_policy.ranges for that tier. Seek an affordable quantity discount when compatible demand supports it. Accept a suitable last_merchant_quote with action accept and proposal null, or counter/decline. Compare its TIER PRICES with last_buyer_bid: if they match and satisfy your requirements, accept instead of repeating the same prices. Proposal versions differ by round and do NOT prevent agreement. On your last turn, decide whether the existing merchant quote is acceptable or decline; no later buyer turn can accept another counter. Never accept an unaffordable maximum because a later tier is cheaper."
                            if role == "buyer"
                            else "You are the merchant agent. Return action propose with a complete structured quote, or decline with proposal null. Never return action accept: accepting a buyer bid still requires emitting the structured merchant quote. Each tier price must be within your own merchant_policy ranges and at or above its private floor. Counter bids below that authority or decline. Consider aggregated compatible demand when choosing explicitly permitted quantity concessions."
                        )
                        + " No universal target price. Interest is not funding. Do not change product, currency, quantity, variant or delivery. Every NEW proposal must copy proposal_id, version, dates and all other non-price fields exactly from the CURRENT template; only tier prices and concise explanation may change. Only validated merchant quotes can execute.",
                        payload,
                        timeout=min(40, remaining),
                        max_tokens=1000,
                        provider_schema=True,
                        remaining_tokens=24000 - tokens,
                    )
                tokens += used
                if (
                    role == "buyer"
                    and reply.proposal
                    and any(
                        tier.total_each_cents > n["constraints"]["max_total_minor"]
                        for tier in reply.proposal.tier_schedule
                    )
                ):
                    raise ValueError("Buyer bid exceeds the supplied budget.")
                if (
                    role == "buyer"
                    and reply.action == "accept"
                    and merchant_quote
                    and merchant_quote.tier_schedule[0].total_each_cents
                    > n["constraints"]["max_total_minor"]
                ):
                    raise ValueError("Buyer acceptance exceeds the supplied budget.")
                if role == "merchant" and reply.action != "decline":
                    if reply.action != "propose" or not reply.proposal:
                        raise ValueError("Merchant must issue a structured quote.")
                    validate_proposal(reply.proposal, context, policy)
                elif reply.action == "propose":
                    if not reply.proposal:
                        raise ValueError("Bid is missing.")
                    validate_proposal(reply.proposal, context, {**policy, "floors": [0, 0]})
                elif (
                    role == "buyer"
                    and reply.action == "accept"
                    and merchant_quote is None
                ):
                    raise ValueError("There is no validated merchant quote to accept.")
                if reply.action in ("accept", "decline") and reply.proposal is not None:
                    raise ValueError("Acceptance or decline must not introduce another proposal.")
            except Exception as exc:
                provider_failed = not isinstance(exc, ValueError)
                tokens += 1000
                private_error = type(exc).__name__
                feedback[role] = (
                    "Correct the invalid response: match the schema and current template. Buyer bids and acceptance must respect max_total_minor; merchant proposals must respect its policy."
                )
            event = public_round(reply, role, events, valid=not bool(private_error))
            events.append(event)
            summary = (
                ("Buyer agent" if role == "buyer" else "Merchant agent")
                + ": " + event["action"].capitalize() + ". " + event["explanation"]
                + (" " + " / ".join(
                    f"${Decimal(t['total_each_cents']) / 100:.2f} at {t['minimum_buyers']} buyers"
                    for t in event["tiers"]
                ) if event["tiers"] else "")
            )
            db.execute(
                "INSERT INTO negotiation_rounds(negotiation_id,ordinal,role,proposal,valid,private_error,public_summary,public_event) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    nid,
                    i + 1,
                    role,
                    Jsonb(
                        reply.model_dump(mode="json")
                        | {
                            "proposal": reply.proposal.model_dump(mode="json")
                            | {"explanation": "Structured quantity offer."}
                            if reply.proposal
                            else None
                        }
                    )
                    if reply
                    else None,
                    not bool(private_error),
                    private_error,
                    summary,
                    Jsonb(event),
                ),
            )
            db.execute(
                "UPDATE negotiations SET token_count=%s WHERE id=%s", (tokens, nid)
            )
            db.commit()
            if provider_failed:
                failure_kind = "provider_failure"
                raise RuntimeError("Negotiation connection failed.")
            if private_error:
                failure_kind = "invalid_model_output"
                continue
            failure_kind = "no_agreement"
            current = latest_request(db, n["buyer_id"])
            db.commit()
            if not current or current["id"] != n["request_id"]:
                failure_kind = "requirements_changed"
                raise ValueError(
                    "Buyer requirements changed; negotiate the updated request."
                )
            if reply.action == "decline":
                raise ValueError("Agent declined the proposed agreement.")
            if role == "buyer" and reply.action == "accept":
                if not merchant_quote:
                    raise ValueError("No validated merchant quote exists to accept.")
                if time.monotonic() - clock >= 120 or tokens > 24000:
                    raise ValueError("Negotiation budget exhausted.")
                failure_kind = "agreement_unavailable"
                accept(db, n, product, merchant_quote, policy)
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
            "UPDATE negotiations SET status='failed',error=%s,error_kind=%s WHERE id=%s",
            (reason[:240], failure_kind, nid),
        )
