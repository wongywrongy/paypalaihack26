import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from rally import market
from rally.catalog import Catalog
from rally.negotiation.auction import run_auction
from rally.sourcing import source

SPEC = importlib.util.spec_from_file_location("market_snapshot", Path(__file__).resolve().parents[1] / "scripts/market_snapshot.py")
snapshot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(snapshot)


def listing(pid, price=18, *, currency="USD", size="150 ml", category="Skin Toner"):
    return {"id": pid, "title": f"PRIVATE_TITLE {size}", "description": "PRIVATE_RETAILER", "category": {"title": category}, "offers": [{"url": "https://private.invalid", "price": {"price": price, "currency": currency}, "availability": "InStock", "condition": "new"}]}


class MarketContracts(unittest.TestCase):
    def test_comparables_filter_category_size_currency_and_store_aggregates_only(self):
        product = Catalog().products["dal-rice-toner"]
        rows = [listing("a", 18), listing("b", 22), listing("c", 26), listing("too-large", size="500 ml"), listing("wrong-category", category="Foot Cream"), listing("foreign", currency="CAD"), listing("a", 99)]
        result = snapshot.aggregate(product, rows, as_of="2026-10-29")
        self.assertEqual(result, {"low_usd_cents": 1800, "median_usd_cents": 2200, "high_usd_cents": 2600, "n": 3, "as_of": "2026-10-29", "query": "skincare toner 150 ml rice"})
        for forbidden in ("PRIVATE", "http", "title", "retailer", "image"):
            self.assertNotIn(forbidden, json.dumps(result))
        self.assertIsNone(snapshot.aggregate(product, rows[:2]))
        self.assertIsNone(snapshot.aggregate(product, [listing("x", size="150 ml 3-pack")] * 3))

    def test_current_api_request_and_private_file_key(self):
        catalog = Catalog()
        catalog.products = {"dal-rice-toner": catalog.products["dal-rice-toner"]}
        def respond(request):
            self.assertEqual(str(request.url), "https://api.trychannel3.com/v1/search")
            self.assertEqual(request.headers["x-api-key"], "private-test-key")
            self.assertEqual(json.loads(request.content)["config"], {"country": "US", "currency": "USD", "language": "en"})
            return httpx.Response(200, json={"products": [listing("a", 18), listing("b", 22), listing("c", 26)]})
        with httpx.Client(transport=httpx.MockTransport(respond), headers={"x-api-key": "private-test-key"}) as client:
            self.assertEqual(snapshot.snapshot(catalog, client)["dal-rice-toner"]["n"], 3)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "private.env"
            path.write_text('CHANNEL3_API_KEY="private-test-key"\n')
            self.assertEqual(snapshot.private_key(path), "private-test-key")
            path.write_text('CHANNEL3_API_KEY=\n')
            with self.assertRaises(ValueError):
                snapshot.private_key(path)

    def test_runtime_snapshot_rejects_invalid_json_rows_and_strips_metadata(self):
        valid = {"low_usd_cents": 1800, "median_usd_cents": 2200, "high_usd_cents": 2600, "n": 3, "as_of": "2026-10-29", "query": "public query", "title": "must never escape"}
        for row in ({**valid, "n": True}, {**valid, "as_of": "bad"}, {**valid, "low_usd_cents": 9999}):
            with patch.object(market, "_load", return_value={"p": row}):
                self.assertIsNone(market.reference("p"))
        with patch.object(market, "_load", return_value={"p": valid}):
            self.assertEqual(set(market.reference("p")), set(market.FIELDS))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "market.json"
            path.write_text('{broken')
            market._load.cache_clear()
            with patch.object(market, "SNAPSHOT", path):
                self.assertIsNone(market.reference("p"))
            market._load.cache_clear()

    def test_both_model_roles_receive_only_sanitized_market_ranges(self):
        catalog = Catalog()
        row = {"low_usd_cents": 1800, "median_usd_cents": 2200, "high_usd_cents": 2600, "n": 3, "as_of": "2026-10-29"}
        seen = []
        def choose(role, payload):
            seen.append((role, payload.get("market")))
            return {"indexes": [0], "note": "Please bid."} if role == "buyer" else {"index": 0, "note": "Our bid."}
        with patch.object(market, "reference", return_value=row):
            run_auction(source(catalog.data["hero"]["cart"], "US", catalog), "US", catalog, {"old_packaging_ok": True, "bundles_ok": True}, choose=choose)
        self.assertEqual({role for role, _ in seen}, {"buyer", "shop"})
        self.assertTrue(all(ranges and all(value == row for value in ranges.values()) for _, ranges in seen))
