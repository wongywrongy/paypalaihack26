"""Dev-only comparable US prices. Raw Channel3 listings never leave memory.

API contract checked at https://channel3.ai/docs/openapi/openapi.json on 2026-10-29.
Usage: PYTHONPATH=backend python scripts/market_snapshot.py --env-file /private/rally.env
"""

import argparse
import json
import re
import shlex
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from statistics import median

import httpx
from rally.catalog import Catalog

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = "https://api.trychannel3.com/v1/search"
CATEGORIES = {
    "Cleanser": ("cleanser", "face wash", "facial wash"),
    "Toner": ("toner",), "Essence": ("essence",), "Serum": ("serum", "ampoule"),
    "Moisturizer": ("moisturizer", "face cream", "facial cream"),
    "Sunscreen": ("sunscreen", "sun protection"), "Mask": ("face mask", "facial mask", "sheet mask"),
    "Eye": ("eye cream", "eye care"), "Lip": ("lip balm", "lip care"), "Care": ("skin care",),
}


def private_key(path):
    """Only the explicitly supplied private file may supply Channel3 credentials."""
    for line in path.read_text().splitlines():
        key, sep, value = line.strip().removeprefix("export ").partition("=")
        if sep and key.strip() == "CHANNEL3_API_KEY":
            tokens = shlex.split(value, comments=True)
            if len(tokens) == 1 and tokens[0].strip():
                return tokens[0]
    raise ValueError("Fill CHANNEL3_API_KEY in the private env file before running.")


def sizes(text):
    return [(Decimal(amount), unit.lower()) for amount, unit in re.findall(r"(\d+(?:\.\d+)?)\s*(ml|g)\b", text, re.I)]


def query_for(product):
    ingredients = [word for word in ("rice", "snail", "cica", "ceramide", "niacinamide", "hyaluronic", "mugwort", "panthenol", "peptide") if word in product["name"].lower()]
    return " ".join(["skincare", product["category"].lower(), product["size"], *ingredients])


def aggregate(product, rows, *, as_of=None):
    target = sizes(product["size"])
    if not target:
        return None
    amount, unit = target[0]
    prices, seen = [], set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or row["id"] in seen:
            continue
        seen.add(row["id"])
        category = row.get("category") or {}
        if not isinstance(category, dict):
            continue
        category_path = category.get("path") or []
        if not isinstance(category_path, list):
            category_path = []
        category_text = " ".join([str(category.get("title", "")), str(category.get("slug", "")), *[str(c.get("title", "")) for c in category_path if isinstance(c, dict)]]).lower().replace("-", " ")
        if not any(word in category_text for word in CATEGORIES.get(product["category"], (product["category"].lower(),))):
            continue
        text = " ".join([str(row.get("title", "")), str(row.get("description") or ""), json.dumps(row.get("structured_attributes") or {})])
        if re.search(r"\b(?:pack of|set of|bundle|kit|\d+\s*[- ]?pack)\b", text, re.I):
            continue
        if not any(u == unit and amount * Decimal("0.8") <= size <= amount * Decimal("1.2") for size, u in sizes(text)):
            continue
        available = []
        offers = row.get("offers") or []
        if not isinstance(offers, list):
            continue
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            price = offer.get("price", {})
            if not isinstance(price, dict):
                continue
            if price.get("currency") != "USD" or offer.get("availability") != "InStock" or offer.get("condition") not in (None, "new"):
                continue
            try:
                value = Decimal(str(price["price"])) * 100
                if value.is_finite() and 0 < value <= 100_000_000:
                    cents = int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))
                    if cents > 0:
                        available.append(cents)
            except (KeyError, InvalidOperation, ValueError):
                continue
        if available:
            prices.append(min(available))
    if len(prices) < 3:
        return None
    return {"low_usd_cents": min(prices), "median_usd_cents": int(Decimal(str(median(prices))).quantize(Decimal(1), rounding=ROUND_HALF_UP)), "high_usd_cents": max(prices), "n": len(prices), "as_of": as_of or date.today().isoformat(), "query": query_for(product)}


def snapshot(catalog, client):
    result = {}
    for product in catalog.products.values():
        response = client.post(ENDPOINT, json={"query": query_for(product), "limit": 30, "config": {"country": "US", "currency": "USD", "language": "en"}, "filters": {"availability": ["InStock"], "conditions": ["new"]}})
        response.raise_for_status()
        data = response.json()
        rows = data.get("products") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            raise ValueError("Channel3 returned an unsupported search response.")
        row = aggregate(product, rows)
        if row:
            result[product["id"]] = row
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        key = private_key(args.env_file)
        with httpx.Client(headers={"x-api-key": key}, timeout=15, follow_redirects=False) as client:
            data = snapshot(Catalog(), client)
    except (httpx.HTTPError, ValueError, OSError):
        raise SystemExit("Market snapshot not written. Check the private Channel3 key, connectivity and API response.") from None
    text = json.dumps(data, indent=2) + "\n"
    if args.dry_run:
        print(text, end="")
    else:
        target = ROOT / "design/scenario/market.json"
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(text)
        temporary.replace(target)
        print(f"Saved aggregate ranges for {len(data)} products.")


if __name__ == "__main__":
    main()
