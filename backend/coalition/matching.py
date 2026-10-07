import json
import logging
import re
from datetime import date, timedelta, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from .catalog import PRODUCTS
from .config import settings
from .db import enqueue
from .model import complete

CATALOG_REQUIREMENTS = {
    "Active noise cancellation": "anc",
    "Flight effectiveness": "flight_effectiveness",
    "Device: iPhone 12": "iphone_12",
}


class Constraints(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    max_total_minor: int = Field(gt=0, le=1000000)
    quantity: int = Field(default=1, ge=1, le=100)
    latest_arrival: date = Field(strict=False)
    required_features: list[str] = Field(default_factory=list, max_length=12)
    device: str | None = Field(default=None, max_length=80)
    flexibility: list[str] = Field(default_factory=list, max_length=8)


class RequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    raw_text: str = Field(min_length=3, max_length=1200)
    edits: Constraints | None = None


class Requirement(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requirement: str = Field(min_length=1, max_length=150)
    verdict: Literal["yes", "no", "unknown"]
    rationale: str = Field(min_length=1, max_length=240)
    source: str = Field(max_length=100)


class Assessment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: str
    requirements: list[Requirement] = Field(max_length=16)


class Assessments(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assessments: list[Assessment] = Field(max_length=6)


def submit_request(db, buyer, body):
    db.execute("SELECT id FROM buyers WHERE id=%s FOR UPDATE", (buyer["id"],))
    if db.execute(
        "SELECT 1 FROM commitments WHERE buyer_id=%s AND (active OR (authorization_id IS NOT NULL AND NOT (COALESCE(void_status='VOIDED',false) OR COALESCE(refund_status='COMPLETED',false) OR COALESCE(authorization_status='EXPIRED',false))))",
        (buyer["id"],),
    ).fetchone():
        raise HTTPException(
            409,
            "Your approved agreement is fixed. Resolve this commitment before changing your request.",
        )
    version = db.execute(
        "SELECT COALESCE(max(version),0)+1 AS n FROM buyer_requests WHERE buyer_id=%s",
        (buyer["id"],),
    ).fetchone()["n"]
    rid = uuid4()
    db.execute(
        "INSERT INTO buyer_requests(id,buyer_id,version,raw_text,edits) VALUES(%s,%s,%s,%s,%s)",
        (
            rid,
            buyer["id"],
            version,
            body.raw_text,
            Jsonb(body.edits.model_dump(mode="json") if body.edits else {}),
        ),
    )
    enqueue(db, "match", {"request_id": str(rid)}, f"match:{rid}")
    return {"id": str(rid), "status": "queued", "version": version}


def requirements_for(c):
    return c.required_features + (["Device: " + c.device] if c.device else [])


def numeric_guards(raw, c, today):
    amount = re.search(
        r"(under|below|budget(?: of)?|up to|max(?:imum)?)\s*\$\s*(\d+(?:\.\d{1,2})?)",
        raw,
        re.I,
    )
    if amount:
        maximum = int(Decimal(amount[2]) * 100) - (
            1 if amount[1].lower() in ("under", "below") else 0
        )
        c.max_total_minor = min(c.max_total_minor, maximum)
    days = re.search(r"(?:within|in|wait)\s+(\d+)\s+days?", raw, re.I)
    if days:
        c.latest_arrival = min(c.latest_arrival, today + timedelta(days=int(days[1])))
    elif re.search(r"wait (?:a|one) week", raw, re.I):
        c.latest_arrival = min(c.latest_arrival, today + timedelta(days=7))
    return c


def fixture_constraints(raw, today):
    # ponytail: narrow disclosed fixture parser; live mode uses the configured model.
    features = []
    if re.search(r"noise.cancel|\banc\b", raw, re.I):
        features.append("Active noise cancellation")
    if "proven" in raw.lower() or "effective" in raw.lower():
        features.append("Flight effectiveness")
    return numeric_guards(
        raw,
        Constraints(
            max_total_minor=10000,
            quantity=2
            if re.search(
                r"\b(?:two|three|[2-9]\d*)\s+(?:pairs?|units?|headphones?)\b", raw, re.I
            )
            else 1,
            latest_arrival=today + timedelta(days=7),
            required_features=features,
            device="iPhone 12" if "iphone 12" in raw.lower() else None,
        ),
        today,
    )


def check_assessment(c, product, assessment):
    expected = requirements_for(c)
    by_requirement = {r.requirement: r for r in assessment.requirements}
    if (
        len(by_requirement) != len(assessment.requirements)
        or len(assessment.requirements) != len(expected)
        or set(by_requirement) != set(expected)
    ):
        raise ValueError("Assessment must cover each requirement exactly once.")
    assessment.requirements = [by_requirement[name] for name in expected]
    for r in assessment.requirements:
        evidence = product.get("evidence", {})
        canonical = CATALOG_REQUIREMENTS.get(r.requirement)
        if canonical in evidence and evidence[canonical] in (None, False):
            r.verdict = "unknown" if evidence[canonical] is None else "no"
            r.source = "evidence." + canonical
            r.rationale = "The supplied catalog does not establish this requirement."
        field = r.source.removeprefix("evidence.")
        if r.source.startswith("evidence.") and field in evidence:
            if evidence[field] is None:
                r.verdict = "unknown"
                r.rationale = (
                    "The supplied catalog does not establish this requirement."
                )
            elif evidence[field] is False and r.verdict == "yes":
                r.verdict = "no"
        else:
            value = product
            for key in r.source.split("."):
                value = value.get(key) if isinstance(value, dict) else None
            if value is None or r.source.split(".")[0] not in (
                "description",
                "features",
                "specs",
                "evidence",
            ):
                r.verdict = "unknown"
                r.rationale = "No supporting catalog field was supplied."
    return assessment


def fixture_assessment(c, p):
    rs = []
    for text in requirements_for(c):
        key = CATALOG_REQUIREMENTS.get(text, "unknown")
        value = p["evidence"].get(key)
        rs.append(
            Requirement(
                requirement=text,
                verdict="unknown" if value is None else "yes" if value else "no",
                rationale="Disclosed fixture assessment of supplied catalog evidence.",
                source="evidence." + key,
            )
        )
    return Assessment(product_id=p["id"], requirements=rs)


def run_match(db, rid):
    row = db.execute("SELECT * FROM buyer_requests WHERE id=%s", (rid,)).fetchone()
    if row["status"] in ("completed", "failed"):
        return
    today = row["created_at"].astimezone(timezone.utc).date()
    products = [p for p in PRODUCTS if p["category"] == "Headphones"]
    db.commit()
    try:
        if row["edits"]:
            c = Constraints.model_validate_json(json.dumps(row["edits"]))
        elif settings.mode == "fixture":
            c = fixture_constraints(row["raw_text"], today)
        else:
            c, _ = complete(
                Constraints,
                "Extract explicit shopper constraints into all fields. Budget goes ONLY in max_total_minor, date ONLY in latest_arrival, device ONLY in device. quantity is the requested unit count, default 1. required_features contains each functional requirement ONCE, never budget, date, quantity or device. Normalize noise cancellation to 'Active noise cancellation' and suitability for flights to 'Flight effectiveness'. Include flexibility as [] unless the shopper explicitly permits a compromise. Dates resolve in UTC. Do not infer additional features. For ambiguous budget or arrival, return invalid output rather than guessing.",
                {"request": row["raw_text"], "today_utc": today.isoformat()},
            )
            c = numeric_guards(row["raw_text"], c, today)
        if c.quantity != 1:
            db.execute(
                "UPDATE buyer_requests SET constraints=%s,status='failed',error='This demo supports one unit per buyer. Edit the request to revise the quantity.' WHERE id=%s",
                (Jsonb(c.model_dump(mode="json")), rid),
            )
            return
        payload = {"requirements": requirements_for(c), "products": products}
        for attempt in range(2):
            try:
                if settings.mode == "fixture":
                    results = [fixture_assessment(c, p) for p in products]
                else:
                    result, _ = complete(
                        Assessments,
                        "Assess every supplied product against every requirement exactly once. Keep each rationale under 18 words. Copy requirement names exactly, including the Device: prefix. Never merge similar requirements. ANC alone does not prove flight effectiveness. Lightning is compatible with iPhone 12 when documented. Cite only provided field paths. Unknown mandatory requirements block eligibility.",
                        payload,
                        max_tokens=4000,
                    )
                    results = result.assessments
                if {a.product_id for a in results} != {
                    p["id"] for p in products
                } or len(results) != len(products):
                    raise ValueError(
                        "Model did not assess every catalog candidate exactly once."
                    )
                for a in results:
                    p = next(p for p in products if p["id"] == a.product_id)
                    check_assessment(c, p, a)
                break
            except ValueError as exc:
                if attempt or settings.mode == "fixture":
                    raise
                payload["validation_error"] = str(exc)[:400]
        for a in results:
            p = next(p for p in products if p["id"] == a.product_id)
            eligible = (
                all(r.verdict == "yes" for r in a.requirements)
                and c.max_total_minor >= 8900
                and p["price_minor"] >= 8900
                and today + timedelta(days=p["delivery_days"]) <= c.latest_arrival
            )
            numeric = [
                Requirement(
                    requirement="Merchant pricing authority",
                    verdict="yes" if p["price_minor"] >= 8900 else "no",
                    rationale="The permitted group-price envelope must fit this product's listed price.",
                    source="price_minor",
                ),
                Requirement(
                    requirement="Maximum total",
                    verdict="yes" if c.max_total_minor >= 8900 else "no",
                    rationale="Merchant quotes require at least $89 maximum approval.",
                    source="merchant public pricing",
                ),
                Requirement(
                    requirement="Latest arrival",
                    verdict="yes"
                    if today + timedelta(days=p["delivery_days"]) <= c.latest_arrival
                    else "no",
                    rationale="Catalog simulated delivery compared with your concrete deadline.",
                    source="delivery_days",
                ),
            ]
            db.execute(
                "INSERT INTO compatibility_assessments VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (
                    rid,
                    a.product_id,
                    p["source_version"],
                    Jsonb([r.model_dump() for r in a.requirements + numeric]),
                    eligible,
                ),
            )
        db.execute(
            "UPDATE buyer_requests SET constraints=%s,status='completed',error=NULL WHERE id=%s",
            (Jsonb(c.model_dump(mode="json")), rid),
        )
    except Exception:
        db.rollback()
        logging.getLogger(__name__).exception("Request evaluation failed: %s", rid)
        db.execute(
            "UPDATE buyer_requests SET status='failed',error='Evaluation unavailable or invalid. Review your requirements and retry.' WHERE id=%s",
            (rid,),
        )


def latest_request(db, bid):
    return db.execute(
        "SELECT * FROM buyer_requests WHERE buyer_id=%s ORDER BY version DESC LIMIT 1",
        (bid,),
    ).fetchone()


def eligible_for_quote(db, bid, terms):
    row = latest_request(db, bid)
    if not row or row["status"] != "completed":
        return False
    c = row["constraints"]
    a = db.execute(
        "SELECT * FROM compatibility_assessments WHERE request_id=%s AND product_id=%s",
        (row["id"], terms["product_id"]),
    ).fetchone()
    return bool(
        a
        and a["eligible"]
        and c["max_total_minor"] >= terms["total_minor"]
        and c["latest_arrival"] >= terms["delivery_by"][:10]
    )
