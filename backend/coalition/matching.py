import json
import logging
import re
from datetime import date, timedelta, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, create_model

from .catalog import SHOP_PRODUCTS
from .config import settings
from .db import enqueue
from .model import complete
from .shopping import lock_owner

CATALOG_REQUIREMENTS = {
    "Active noise cancellation": "anc",
    "Flight effectiveness": "flight_effectiveness",
    "Device: iPhone 12": "iphone_12",
    "Bluetooth audio": "bluetooth_audio",
}


class Constraints(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    max_total_minor: int = Field(gt=0, le=1000000)
    quantity: int = Field(default=1, ge=1, le=100)
    latest_arrival: date = Field(strict=False)
    required_features: list[str] = Field(default_factory=list, max_length=12)
    device: str | None = Field(default=None, max_length=80)
    flexibility: list[str] = Field(default_factory=list, max_length=8)
    product_category: Literal["Headphones", "unsupported"] = "Headphones"


class PartialConstraints(Constraints):
    max_total_minor: int | None = Field(default=None, gt=0, le=1000000)
    latest_arrival: date | None = Field(default=None, strict=False)


class ExtractedFeature(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=150)
    source: str = Field(min_length=1, max_length=160)


class ExtractedConstraints(PartialConstraints):
    # All provider fields are required, including explicit nulls. Optional schema
    # fields let the configured provider omit evidence and infer capabilities.
    max_total_minor: int | None = Field(..., gt=0, le=1000000)
    latest_arrival: date | None = Field(..., strict=False)
    quantity: int = Field(..., ge=1, le=100)
    device: str | None = Field(..., max_length=80)
    flexibility: list[str] = Field(..., max_length=8)
    product_category: Literal["Headphones", "unsupported"]
    required_features: list[ExtractedFeature] = Field(..., max_length=12)
    budget_source: str | None = Field(..., max_length=160)
    arrival_source: str | None = Field(..., max_length=160)


def extracted_constraints(extracted, raw, today):
    patterns = {
        "Active noise cancellation": r"noise.cancel|\banc\b|noise reduction",
        "Flight effectiveness": r"\bflight|aircraft|cabin",
        "Bluetooth audio": r"bluetooth|wireless",
    }
    for feature in extracted.required_features:
        if feature.source.lower() not in raw.lower() or not re.search(
            patterns.get(feature.name, re.escape(feature.name)), feature.source, re.I
        ):
            raise ValueError(
                f"Remove feature {feature.name!r}: source {feature.source!r} does not explicitly request it. Budget, delivery and device are separate fields."
            )
    for field, source in (
        ("max_total_minor", extracted.budget_source),
        ("latest_arrival", extracted.arrival_source),
    ):
        if getattr(extracted, field) is not None and (
            not source or source.lower() not in raw.lower()
        ):
            raise ValueError(
                f"{field} needs an exact request substring in its source field; unstated values and sources must be null."
            )
    amount = re.search(
        r"\$\s*(\d+(?:\.\d{1,2})?)|(?:\b(\d+(?:\.\d{1,2})?)\s*(?:USD|dollars))",
        extracted.budget_source or "",
        re.I,
    )
    if extracted.max_total_minor is not None and not amount:
        raise ValueError(
            "Budget source must contain the stated numerical USD amount; otherwise budget is null."
        )
    if extracted.latest_arrival is not None and not re.search(
        r"\b(?:today|tomorrow|days?|weeks?|months?|January|February|March|April|May|June|July|August|September|October|November|December)\b|\d{4}-\d{2}-\d{2}",
        extracted.arrival_source or "",
        re.I,
    ):
        raise ValueError(
            "Arrival source must state delivery timing; otherwise arrival is null."
        )
    if extracted.device and extracted.device.lower() not in raw.lower():
        raise ValueError("Device must be explicitly named in the request.")
    data = extracted.model_dump(
        exclude={"budget_source", "arrival_source", "required_features"}
    )
    data["required_features"] = [f.name for f in extracted.required_features]
    if amount:
        data["max_total_minor"] = int(Decimal(amount[1] or amount[2]) * 100)
    return numeric_guards(
        raw,
        PartialConstraints.model_validate_json(json.dumps(data, default=str)),
        today,
    )


class RequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    raw_text: str = Field(min_length=3, max_length=1200)
    edits: Constraints | PartialConstraints | None = None


class RequirementEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    verdict: Literal["yes", "no", "unknown"]
    rationale: str = Field(min_length=1, max_length=240)
    source: str = Field(max_length=100)


class Requirement(RequirementEvidence):
    requirement: str = Field(min_length=1, max_length=150)


class Assessment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: str
    requirements: list[Requirement] = Field(max_length=16)


def submit_request(db, buyer, body):
    owner = db.execute(
        "SELECT owner_id FROM buyers WHERE id=%s", (buyer["id"],)
    ).fetchone()["owner_id"]
    lock_owner(db, owner)
    edits = body.edits.model_dump(mode="json") if body.edits else {}
    previous = latest_request(db, buyer["id"])
    if (
        previous
        and previous["raw_text"] == body.raw_text
        and previous["edits"] == edits
        and previous["status"] not in ("failed", "superseded")
    ):
        return {
            "id": str(previous["id"]),
            "status": previous["status"],
            "version": previous["version"],
        }
    db.execute(
        "UPDATE buyer_requests SET status='superseded' WHERE owner_id=%s AND status IN ('queued','running','clarification')",
        (owner,),
    )
    version = db.execute(
        "SELECT COALESCE(max(version),0)+1 AS n FROM buyer_requests WHERE owner_id=%s",
        (owner,),
    ).fetchone()["n"]
    rid = uuid4()
    db.execute(
        "INSERT INTO buyer_requests(id,buyer_id,owner_id,version,raw_text,edits) VALUES(%s,%s,%s,%s,%s,%s)",
        (
            rid,
            buyer["id"],
            owner,
            version,
            body.raw_text,
            Jsonb(edits),
        ),
    )
    enqueue(db, "match", {"request_id": str(rid)}, f"match:{rid}")
    return {"id": str(rid), "status": "queued", "version": version}


def requirements_for(c):
    return list(
        dict.fromkeys(
            c.required_features + (["Device: " + c.device] if c.device else [])
        )
    )


def assessment_schema(c, products):
    paths = {"title", "brand", "description", "features", "evidence.unknown"}
    for product in products:
        paths.update("evidence." + key for key in product.get("evidence", {}))
        paths.update("specs." + key for key in product.get("specs", {}))
    evidence = create_model(
        "CatalogEvidence",
        __base__=RequirementEvidence,
        source=(
            Literal[tuple(sorted(paths))],
            Field(
                description="Catalog field path; never a URL. Manufacturer URLs are provenance, not capability fields."
            ),
        ),
    )
    findings = create_model(
        "RequirementFindings",
        __config__=ConfigDict(extra="forbid"),
        **{f"r{i}": (evidence, ...) for i, _ in enumerate(requirements_for(c))},
    )
    return create_model(
        "CatalogFindings",
        __config__=ConfigDict(extra="forbid"),
        **{p["id"]: (findings, ...) for p in products},
    )


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
        c.max_total_minor = maximum
    days = re.search(r"(?:within|in|wait)\s+(\d+)\s+days?", raw, re.I)
    if days:
        arrival = today + timedelta(days=int(days[1]))
        c.latest_arrival = arrival
    elif re.search(r"wait (?:a|one) week", raw, re.I):
        arrival = today + timedelta(days=7)
        c.latest_arrival = arrival
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
        PartialConstraints(
            quantity=2
            if re.search(
                r"\b(?:two|three|[2-9]\d*)\s+(?:pairs?|units?|headphones?)\b", raw, re.I
            )
            else 1,
            required_features=features,
            product_category="unsupported"
            if re.search(
                r"\b(laptops?|bottles?|lamps?|calculators?|speakers?)\b", raw, re.I
            )
            else "Headphones",
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

    def normalize(text):
        return " ".join(re.findall(r"[a-z0-9]+", str(text).lower()))

    for r in assessment.requirements:
        value = product
        for key in r.source.split("."):
            value = value.get(key) if isinstance(value, dict) else None
        textual_support = r.source.split(".")[0] in (
            "title",
            "brand",
            "description",
            "features",
            "specs",
        ) and normalize(r.requirement) in normalize(value)
        if r.requirement == "Active noise cancellation" and r.source == "specs.ANC":
            textual_support = value is True or str(value).lower() == "yes"
        evidence = product.get("evidence", {})
        canonical = CATALOG_REQUIREMENTS.get(r.requirement)
        if canonical:
            value = evidence.get(canonical)
            if value is not True:
                r.verdict = "no" if value is False else "unknown"
                r.source = "evidence." + canonical
                r.rationale = (
                    "The supplied catalog does not establish this requirement."
                )
            elif r.source != "evidence." + canonical and not textual_support:
                r.verdict = "unknown"
                r.rationale = (
                    "The cited field does not support this specific requirement."
                )
            continue
        # ponytail: exact textual support for unfamiliar requirements; add curated
        # evidence mappings when the catalog supports more compatibility claims.
        if not textual_support:
            r.verdict = "unknown"
            r.rationale = "The cited catalog field does not support this requirement."
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
    if row["status"] in ("completed", "failed", "clarification", "superseded"):
        return
    if row["status"] == "running":
        db.execute(
            "UPDATE buyer_requests SET status='failed',error_kind='provider_failure',error='Evaluation interrupted. Your request is saved; retry to start a new bounded attempt.' WHERE id=%s",
            (rid,),
        )
        return
    db.execute("UPDATE buyer_requests SET status='running' WHERE id=%s", (rid,))
    today = row["created_at"].astimezone(timezone.utc).date()
    products = SHOP_PRODUCTS
    db.commit()
    try:
        if row["edits"]:
            c = PartialConstraints.model_validate_json(json.dumps(row["edits"]))
        elif settings.mode == "fixture":
            c = fixture_constraints(row["raw_text"], today)
        else:
            payload = {"request": row["raw_text"], "today_utc": today.isoformat()}
            for attempt in range(2):
                try:
                    extracted, _ = complete(
                        ExtractedConstraints,
                        "Extract the user request into this schema. Feature sources, budget_source, arrival_source must be exact substrings of request, never from these instructions. Only product capabilities belong in required_features; budget, delivery, and device have separate fields. Unstated values are null. Do not assume any capability. Use these names when requested: Active noise cancellation, Flight effectiveness, Bluetooth audio. Dollars to integer cents. For example Headphones under $100 produces max_total_minor=10000, budget_source=under $100, latest_arrival=null, arrival_source=null, required_features=[], device=null. Noise-canceling maps to Active noise cancellation only. An iPhone does not imply Bluetooth. If a source cannot be found in the request, omit that feature. Default quantity is one and product_category is Headphones unless another category is requested.",
                        payload,
                        provider_schema=True,
                    )
                    c = extracted_constraints(extracted, row["raw_text"], today)
                    break
                except ValueError as exc:
                    if attempt:
                        raise
                    payload["validation_error"] = str(exc)
        if latest_request(db, row["buyer_id"])["id"] != row["id"]:
            db.rollback()
            return
        if c.product_category == "unsupported":
            db.execute(
                "UPDATE buyer_requests SET constraints=%s,status='failed',error_kind='unsupported_requirements',error='This storefront currently offers headphones. Describe a headphone need to continue.' WHERE id=%s AND status!='superseded'",
                (Jsonb(c.model_dump(mode="json")), rid),
            )
            return
        missing = [
            field
            for field in ("max_total_minor", "latest_arrival")
            if getattr(c, field) is None
        ]
        if missing:
            question = (
                "What is your maximum delivered total in USD?"
                if "max_total_minor" in missing
                else "When do you need delivery? Choose a latest arrival date."
            )
            db.execute(
                "UPDATE buyer_requests SET constraints=%s,status='clarification',clarification=%s,error_kind='missing_information' WHERE id=%s AND status!='superseded'",
                (
                    Jsonb(c.model_dump(mode="json")),
                    Jsonb({"fields": missing, "question": question}),
                    rid,
                ),
            )
            return
        c = Constraints.model_validate_json(c.model_dump_json())
        if c.quantity != 1:
            db.execute(
                "UPDATE buyer_requests SET constraints=%s,status='failed',error_kind='unsupported_requirements',error='This demo supports one unit per buyer. Edit the request to revise the quantity.' WHERE id=%s",
                (Jsonb(c.model_dump(mode="json")), rid),
            )
            return
        requirement_ids = {f"r{i}": name for i, name in enumerate(requirements_for(c))}
        payload = {
            "requirements": requirement_ids,
            "products": products,
            "requirement_evidence_fields": CATALOG_REQUIREMENTS,
        }
        schema = assessment_schema(c, products)
        db.commit()
        for attempt in range(2):
            try:
                if settings.mode == "fixture":
                    results = [fixture_assessment(c, p) for p in products]
                else:
                    result, _ = complete(
                        schema,
                        "Assess every supplied product for every indexed requirement. Return the product IDs and requirement IDs required by the schema, with a verdict, rationale and source for each. Keep rationales under 12 words. Never merge similar requirements. ANC alone does not prove flight effectiveness. Lightning is compatible with iPhone 12 when documented. For known requirements cite the specific evidence field in requirement_evidence_fields. For a requested brand or model cite the matching brand or title field; a different brand or model does not meet it. Cite only supplied catalog field paths; absent evidence means unknown. Unknown mandatory requirements block eligibility.",
                        payload,
                        max_tokens=4000,
                        provider_schema=True,
                    )
                    findings = result.model_dump()
                    results = [
                        Assessment(
                            product_id=p["id"],
                            requirements=[
                                Requirement(requirement=name, **findings[p["id"]][key])
                                for key, name in requirement_ids.items()
                            ],
                        )
                        for p in products
                    ]
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
        if latest_request(db, row["buyer_id"])["id"] != row["id"]:
            db.rollback()
            return
        for a in results:
            p = next(p for p in products if p["id"] == a.product_id)
            minimum = p["public_policy"]["ranges"][0][0]
            eligible = (
                all(r.verdict == "yes" for r in a.requirements)
                and c.max_total_minor >= minimum
                and p["price_minor"] >= minimum
                and today + timedelta(days=p["delivery_days"]) <= c.latest_arrival
            )
            numeric = [
                Requirement(
                    requirement="Merchant pricing authority",
                    verdict="yes" if p["price_minor"] >= minimum else "no",
                    rationale="The permitted group-price envelope must fit this product's listed price.",
                    source="price_minor",
                ),
                Requirement(
                    requirement="Maximum total",
                    verdict="yes" if c.max_total_minor >= minimum else "no",
                    rationale="Your budget must cover this product's public first-tier price range.",
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
            "UPDATE buyer_requests SET constraints=%s,status='completed',error=NULL,error_kind=CASE WHEN EXISTS(SELECT 1 FROM compatibility_assessments WHERE request_id=%s AND eligible) THEN NULL ELSE 'no_matching_products' END WHERE id=%s AND status!='superseded'",
            (Jsonb(c.model_dump(mode="json")), rid, rid),
        )
    except Exception as exc:
        db.rollback()
        logging.getLogger(__name__).warning(
            "Request %s evaluation failed: %s", rid, type(exc).__name__
        )
        db.execute(
            "UPDATE buyer_requests SET status='failed',error_kind=%s,error=%s WHERE id=%s AND status!='superseded'",
            (
                "invalid_model_output"
                if isinstance(exc, ValueError)
                else "provider_failure",
                "The model returned an invalid assessment. Try again."
                if isinstance(exc, ValueError)
                else "Evaluation service is unavailable. Your request is saved; try again.",
                rid,
            ),
        )


def latest_request(db, bid):
    return db.execute(
        "SELECT * FROM buyer_requests WHERE owner_id=(SELECT owner_id FROM buyers WHERE id=%s) ORDER BY created_at DESC,version DESC LIMIT 1",
        (bid,),
    ).fetchone()


def eligible_for_quote(db, bid, terms, request_id=None):
    row = (
        db.execute("SELECT * FROM buyer_requests WHERE id=%s", (request_id,)).fetchone()
        if request_id
        else latest_request(db, bid)
    )
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
        and a["source_version"] == terms["source_version"]
        and c["max_total_minor"] >= terms["total_minor"]
        and c["latest_arrival"] >= terms["delivery_by"][:10]
    )
