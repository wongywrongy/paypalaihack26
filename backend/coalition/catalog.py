import json
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

PRODUCTS = json.loads(
    (Path(__file__).resolve().parents[2] / "catalog.json").read_text()
)
TERMS = {
    "offer_id": "campus-calculator-v1",
    "product_id": "arc-991",
    "title": "Arc 991 Scientific Calculator",
    "variant": "Graphite",
    "quantity": 1,
    "merchant": "Commonplace Supply",
    "merchant_disclosure": "Fictional demo merchant",
    "total_minor": 6500,
    "currency": "USD",
    "shipping_minor": 0,
    "tax_minor": 0,
    "tax_disclosure": "$0 tax for this simulation",
    "minimum": 5,
    "capacity": 5,
    "reserved_inventory": 5,
    "delivery_days": 7,
    "payment_terms": "Authorize $65. Charged only if five buyers join and settlement succeeds. A settlement failure can cause a charge followed by a refund.",
    "version": 1,
    "merchant_id": "commonplace",
    "offer_window_hours": 24,
    "authoritative_features": ["scientific", "fractions", "statistics", "solar power"],
    "course_compatibility": {},
    "exam_approval": "Unknown; consult the authoritative course or exam policy.",
}


class ProductContext(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    product_id: str
    title: str
    selected_variant: str
    displayed_price_minor: int = Field(gt=0)
    currency: str
    quantity: int = Field(ge=1, le=10)


def validate_context(context: ProductContext, offer=False):
    product = next((p for p in PRODUCTS if p["id"] == context.product_id), None)
    if (
        not product
        or (context.title, context.displayed_price_minor, context.currency)
        != (product["title"], product["price_minor"], product["currency"])
        or context.selected_variant not in product["variants"]
    ):
        raise HTTPException(
            422,
            "The product context does not match the catalog. Refresh the product page.",
        )
    if offer and product["category"] == "Headphones" and context.quantity != 1:
        raise HTTPException(422, "This offer is for one headphone unit per buyer.")
    if (
        offer
        and product["category"] != "Headphones"
        and (context.product_id, context.selected_variant, context.quantity)
        != (
            "arc-991",
            "Graphite",
            1,
        )
    ):
        raise HTTPException(422, "This offer is for one Arc 991 in Graphite only.")
    return product
