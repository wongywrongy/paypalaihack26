"""Catalog-only routine suggestions, validated before becoming a bag."""

from pydantic import BaseModel, ConfigDict, Field

from . import llm
from .sourcing import source


class Suggestion(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    items: list[str] = Field(min_length=1, max_length=8)
    reasons: list[str] = Field(min_length=1, max_length=8)


def suggest(text, destination, catalog):
    if not isinstance(text, str) or not 3 <= len(text.strip()) <= 1000:
        raise ValueError("Describe the routine you want in a short sentence.")
    public = [{k: p[k] for k in ("id", "brand", "name", "category")} for p in catalog.products.values() if catalog.allowed(p["id"], destination)]
    chosen_by = "LLM"
    try:
        selected, _ = llm.complete(Suggestion, "Suggest a cosmetic routine from this catalog. Do not diagnose or promise medical effects. Return one public reason per item. Respect the shopper's request.", {"request": text, "products": public}, timeout=8, max_tokens=400, remaining_tokens=16000)
        if len(selected.items) != len(selected.reasons) or any(len(r) > 200 for r in selected.reasons):
            raise ValueError("Invalid routine.")
        source(selected.items, destination, catalog)
    except Exception:
        chosen_by = "CODE"
        items = []
        for category in ("Cleanser", "Toner", "Essence", "Moisturizer"):
            matches = [p["id"] for p in public if p["category"] == category]
            if matches:
                items.append(min(matches, key=lambda pid: min(o["list_usd"] for o in catalog.choices(pid, destination))))
        selected = Suggestion(items=items, reasons=["A catalog option for this routine step."] * len(items))
    return {"items": selected.items, "reasons": selected.reasons, "chosen_by": chosen_by, "quote": source(selected.items, destination, catalog)}
