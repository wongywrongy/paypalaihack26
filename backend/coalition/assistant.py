import re
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from .config import settings
from .model import complete


class Constraints(BaseModel):
    model_config = ConfigDict(extra="forbid")
    budget_minor: int | None = Field(default=None, ge=0)
    delivery_deadline: date | None = None
    product_id: str | None = None
    variant: str | None = None
    required_features: list[str] = Field(default_factory=list, max_length=8)
    course: str | None = None
    requires_exam_approval: bool = False


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["accept", "reject", "needs_approval"]
    offer_id: str
    extracted_constraints: Constraints = Field(default_factory=Constraints)
    evidence: list[str] = Field(default_factory=list, max_length=8)
    question: str | None = None
    matched_constraints: list[str] = Field(max_length=8)
    unresolved_concerns: list[str] = Field(max_length=8)
    explanation: str = Field(min_length=1, max_length=400)


def concerns(persona, terms):
    result = []
    if persona["budget_minor"] < terms["total_minor"]:
        result.append("Delivered total exceeds the buyer budget.")
    if persona["delivery_days"] < terms["delivery_days"]:
        result.append("Seven-day delivery cannot meet the required date.")
    if (persona["product_id"], persona["variant"]) != (
        terms["product_id"],
        terms["variant"],
    ):
        result.append("Exact model and variant do not match.")
    return result


def decide(persona, terms, request_text=None):
    if settings.mode == "fixture" and request_text:
        simulated = {**persona}
        amount = re.search(
            r"(below|under|budget(?: of)?|up to|max(?:imum)?)\s*\$\s*(\d+(?:\.\d{1,2})?)",
            request_text,
            re.I,
        )
        days = re.search(r"(?:in|within)\s+(\d+)\s+days?", request_text, re.I)
        if amount:
            from decimal import Decimal

            simulated["budget_minor"] = int(Decimal(amount[2]) * 100) - (
                1 if amount[1].lower() in ("below", "under") else 0
            )
        if days:
            simulated["delivery_days"] = int(days[1])
        persona = simulated
    blocked = (
        concerns(persona, terms)
        if not request_text or settings.mode == "fixture"
        else []
    )
    if settings.mode == "fixture":
        return Decision(
            decision="reject" if blocked else "accept",
            offer_id=terms["offer_id"],
            matched_constraints=[
                "Exact calculator and Graphite variant",
                "Delivered price within budget",
            ]
            if not blocked
            else [],
            unresolved_concerns=blocked,
            explanation=blocked[0]
            if blocked
            else "Exact model, budget and simulated delivery fit. Course and exam approval are unknown.",
            extracted_constraints=Constraints(
                budget_minor=persona.get("budget_minor"),
                product_id=persona.get("product_id"),
                variant=persona.get("variant"),
            ),
            evidence=[
                "Fixture evaluation; no model call.",
                "Course and exam approval: unknown.",
            ],
        ).model_dump()
    if not settings.llm_api_key:
        raise RuntimeError(
            "LLM_API_KEY is missing. Connected decisions are unavailable; no fixture fallback."
        )
    result, _ = complete(
        Decision,
        "Evaluate only the supplied eligible merchant offer. Extract buyer constraints with integer cents and ISO dates. Current UTC date is "
        + datetime.now(timezone.utc).date().isoformat()
        + ". Unknown mandatory course or product compatibility means needs_approval or reject. Reject budget/delivery mismatch. Cite supplied attributes; never approve payments.",
        {
            "buyer": persona if not request_text else {"request": request_text},
            "eligible_offers": [terms],
        },
        max_tokens=700,
    )
    if result.offer_id != terms["offer_id"]:
        raise RuntimeError("Model returned an unknown offer identifier.")
    model_result = result.model_dump(mode="json")
    if request_text:
        extracted = result.extracted_constraints
        # Independently enforce explicit numeric budgets and day counts in the buyer text.
        amount = re.search(
            r"(below|under|budget(?: of)?|up to|max(?:imum)?)\s*\$\s*(\d+(?:\.\d{1,2})?)",
            request_text,
            re.I,
        )
        if amount:
            from decimal import Decimal

            limit = int(Decimal(amount[2]) * 100)
            if amount[1].lower() in ("below", "under"):
                limit -= 1
            extracted.budget_minor = (
                min(limit, extracted.budget_minor)
                if extracted.budget_minor is not None
                else limit
            )
        days = re.search(r"(?:in|within)\s+(\d+)\s+days?", request_text, re.I)
        if days:
            declared = datetime.now(timezone.utc).date() + timedelta(days=int(days[1]))
            extracted.delivery_deadline = (
                min(declared, extracted.delivery_deadline)
                if extracted.delivery_deadline
                else declared
            )
        if (
            extracted.budget_minor is not None
            and terms["total_minor"] > extracted.budget_minor
        ):
            blocked.append("The $65 delivered total exceeds your budget.")
        arrival = datetime.now(timezone.utc).date() + timedelta(
            days=terms["delivery_days"]
        )
        if extracted.delivery_deadline and arrival > extracted.delivery_deadline:
            blocked.append(
                "Simulated seven-day delivery cannot meet your required date."
            )
        if extracted.product_id not in (
            None,
            terms["product_id"],
        ) or extracted.variant not in (None, terms["variant"]):
            blocked.append("This offer does not match your exact product or variant.")
        supplied_features = terms.get("authoritative_features", [])
        if any(
            feature not in supplied_features for feature in extracted.required_features
        ):
            blocked.append(
                "Required product capabilities are not confirmed by supplied attributes."
            )
        if (
            extracted.course
            and terms.get("course_compatibility", {}).get(extracted.course) is not True
            or extracted.requires_exam_approval
        ):
            blocked.append(
                "Required course or exam compatibility is unknown. Consult the authoritative course policy."
            )
        if "next week" in request_text.lower() and not extracted.delivery_deadline:
            result.decision = "needs_approval"
            result.question = "What exact date do you need delivery?"
            result.explanation = "Please supply your required delivery date."
        result.evidence = [
            f"Offer {terms['offer_id']}: one {terms['title']} in {terms['variant']}",
            "Fixed total: $65 USD, shipping included, simulated tax $0",
            f"Simulated delivery: {terms['delivery_days']} days",
            "Course and exam approval: unknown",
        ]

    if blocked:
        result.decision = "reject"
        result.unresolved_concerns = blocked
        result.explanation = blocked[0]
    return {
        **result.model_dump(mode="json"),
        "model_result": model_result,
        "guardrail_override": bool(blocked and model_result["decision"] != "reject"),
    }


def run_decision(db, decision_id):
    row = db.execute(
        "SELECT d.*,b.persona,o.terms,g.status AS group_status,g.inventory_reserved FROM ai_decisions d JOIN buyers b ON b.id=d.buyer_id JOIN groups g ON g.id=d.group_id JOIN offers o ON o.id=g.offer_id WHERE d.id=%s",
        (decision_id,),
    ).fetchone()
    if row["status"] == "completed":
        return
    if settings.mode == "connected" and not settings.llm_api_key:
        db.execute(
            "UPDATE ai_decisions SET status='failed',result=NULL,error=%s WHERE id=%s",
            (
                "Assistant unavailable: LLM_API_KEY is missing. Checkout remains available.",
                decision_id,
            ),
        )
        return
    db.commit()  # No transaction is held across the model call.
    result = decide(row["persona"], row["terms"], row["request_text"])
    current = db.execute(
        "SELECT status,inventory_reserved FROM groups WHERE id=%s", (row["group_id"],)
    ).fetchone()
    if current["status"] != "OPEN" or current["inventory_reserved"] != 5:
        result.update(
            decision="reject", explanation="The offer is no longer available to join."
        )
    db.execute(
        "UPDATE ai_decisions SET status='completed',result=%s,error=NULL WHERE id=%s",
        (Jsonb(result), decision_id),
    )
