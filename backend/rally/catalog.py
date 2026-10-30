"""Server-owned fictional catalog and private commercial authority."""

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from .fx import minor

SCENARIO = Path(__file__).resolve().parents[2] / "design/scenario/scenario.json"


@dataclass(frozen=True)
class Line:
    offer_id: str
    qty: int
    unit_usd_cents: int


class Catalog:
    def __init__(self, data=None):
        self.data = data if data is not None else json.loads(SCENARIO.read_text())
        self.products = {p["id"]: p for p in self.data["catalog"]}
        self.shops = self.data["shops"]
        self.offers = {}
        private = self.data["hero"]["private"]
        for product in self.products.values():
            for shop, price in product["prices"].items():
                identifier = shop + "/" + product["id"]
                listed = minor(price)
                authority = private.get(identifier, {})
                self.offers[identifier] = {"id": identifier, "product_id": product["id"], "shop_id": shop, "variant": "current", "list_usd": listed, "stock": 100, "days_on_shelf": 10, "floor_usd": minor(authority["floor"]) if authority else listed * 75 // 100, "cost_usd": minor(authority["cost"]) if authority else listed * 45 // 100}
                if product.get("old_packaging") == shop:
                    authority = private[identifier + ":old"]
                    self.offers[identifier + ":older"] = {**self.offers[identifier], "id": identifier + ":older", "variant": "older", "list_usd": ((listed * 80 // 100 + 50) // 100) * 100, "stock": int(authority["stock"]), "days_on_shelf": int(authority["days_on_shelf"]), "floor_usd": minor(authority["floor"]), "cost_usd": minor(authority["cost"])}
        # Fictional shop policies are configured authority, never model knowledge.
        self.policies = {shop: {"discount_bp": 0 if shop == "bada" else 1000, "bundle_discount_bp": {"haneul": 500, "bada": 0, "dalbit": 300}[shop], "free_domestic": True, "utility_threshold": 0, "sample_kit": shop == "dalbit", "sample_cost": 150, "pickup_cost": 150 if shop == "bada" else 0} for shop in self.shops}

        from .goals import launch
        for shop, policy in self.policies.items():
            policy.update(launch(shop, policy))

    def allowed(self, product_id, destination):
        from .countries import country

        country(destination)
        p = self.products[product_id]
        return not p.get("aerosol") and destination not in p.get("not_to", [])

    def choices(self, product_id, destination, *, older=False):
        if product_id not in self.products or not self.allowed(product_id, destination):
            raise ValueError("An item cannot ship to this destination.")
        return [o for o in self.offers.values() if o["product_id"] == product_id and o["stock"] > 0 and (older or o["variant"] == "current")]

    def grams(self, product_id):
        return int(Decimal(self.products[product_id]["weight_kg"]) * 1000)

    def public(self, destination):
        from . import market
        from .countries import country
        from .fx import convert

        currency = country(destination)["currency"]
        products = []
        for p in self.products.values():
            offers = [o for o in self.offers.values() if o["product_id"] == p["id"] and o["variant"] == "current"]
            available = [o for o in offers if o["stock"] > 0]
            prices = {o["shop_id"]: f"{o['list_usd'] // 100}.{o['list_usd'] % 100:02d}" for o in available or offers}
            products.append({**p, "market": market.reference(p["id"]), "prices": prices, "price": convert(min(o["list_usd"] for o in available or offers), currency), "currency": currency, "available": self.allowed(p["id"], destination) and bool(available)})
        return {"products": products, "shops": self.shops, "prices_currency": "USD"}
