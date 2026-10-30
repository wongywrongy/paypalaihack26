import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import Mock, patch

from rally.assistant import suggest
from rally.catalog import Catalog
from rally.negotiation.schema import Choice
from rally.sim.benchmark import run
from rally.sim.cache import ModelCache


class SimulationContracts(unittest.TestCase):
    def test_fixture_benchmark_has_no_model_or_payment_calls_and_is_repeatable(self):
        with patch("rally.llm.complete", side_effect=AssertionError("Unexpected model request")):
            first = run(20261023, 35)
            second = run(20261023, 35)
        first.pop("execution_seconds")
        second.pop("execution_seconds")
        self.assertEqual(first, second)
        self.assertEqual(first["requested_cases"], first["completed_cases"] + first["unsupported_cases"])
        self.assertEqual(first["charge_above_hold"], 0)
        self.assertEqual(first["shop_below_authority"], 0)
        self.assertEqual(first["d_model_choices"], 0)
        self.assertEqual(first["e_model_choices"], 0)
        self.assertEqual(first["bundle_split_violations"], 0)
        self.assertTrue(all(totals["E"] <= totals["A"] for totals in first["currency_totals"].values()))
        self.assertTrue(all(totals["B"] is None for totals in first["currency_totals"].values()))

    def test_benchmark_cache_reuses_only_validated_matching_prompts(self):
        provider = Mock(return_value=(Choice(index=0, note="Public terms."), 15))
        with tempfile.TemporaryDirectory() as directory:
            cache = ModelCache(provider, directory)
            first = cache(Choice, "buyer", {"offers": [10]})
            again = ModelCache(provider, directory)(Choice, "buyer", {"offers": [10]})
            self.assertEqual(first, again)
            self.assertEqual(provider.call_count, 1)
            cache(Choice, "shop", {"offers": [10]})
            self.assertEqual(provider.call_count, 2)
            for path in Path(directory).glob("*.json"):
                self.assertEqual(set(json.loads(path.read_text())), {"result", "tokens"})

    def test_cache_distinguishes_role_models_and_response_formats(self):
        from rally.sim import cache as model_cache

        provider = Mock(return_value=(Choice(index=0, note="Public terms."), 15))
        with tempfile.TemporaryDirectory() as directory:
            cache = ModelCache(provider, directory)
            config = replace(model_cache.settings, llm_model_shop="shop-a", llm_response_format="json_object")
            with patch.object(model_cache, "settings", config):
                cache(Choice, "shop", {}, model_role="shop")
                cache(Choice, "shop", {}, model_role="shop")
            self.assertEqual(provider.call_count, 1)
            with patch.object(model_cache, "settings", replace(config, llm_model_shop="shop-b")):
                cache(Choice, "shop", {}, model_role="shop")
            with patch.object(model_cache, "settings", replace(config, llm_response_format="json_schema")):
                cache(Choice, "shop", {}, model_role="shop")
            self.assertEqual(provider.call_count, 3)

    def test_routine_fallback_preserves_explicit_budget_and_stock_constraints(self):
        catalog = Catalog()
        for offer in catalog.offers.values():
            if offer["product_id"] == "hay-foam":
                offer["stock"] = 0
        with patch("rally.llm.complete", side_effect=RuntimeError("offline")):
            value = suggest("A simple routine under $120", "US", catalog)
            self.assertNotIn("hay-foam", value["items"])
            self.assertLessEqual(value["quote"]["breakdown"]["total"], 12000)
            with self.assertRaisesRegex(ValueError, "budget"):
                suggest("A routine under $10", "US", catalog)
            with self.assertRaisesRegex(ValueError, "currency"):
                suggest("A routine under EUR 100", "US", catalog)

    def test_connected_auction_only_never_calls_price_baseline_or_exchange_models(self):
        from rally.negotiation.schema import AskChoice

        def complete(schema, role, payload, **kwargs):
            self.assertIn(schema, (Choice, AskChoice))
            public = json.dumps(payload)
            self.assertNotIn("floor", public)
            self.assertNotIn("cost", public)
            if schema is AskChoice:
                return AskChoice(indexes=[0], note="Please bid."), 20
            return Choice(index=0, note="Our public terms."), 20
        with patch("rally.llm.complete", side_effect=complete) as provider, patch("rally.sim.chatbot.run", side_effect=AssertionError("Unrequested price baseline")):
            report = run(20261023, 3, connected=True, auction_only=True)
        self.assertEqual(report["connected_strategies"], ["E"])
        self.assertEqual(report["d_model_choices"], 0)
        self.assertEqual(report["e_model_failures"], 0)
        self.assertGreater(report["e_model_choices"], 0)
        self.assertEqual(report["e_model_calls"], provider.call_count)
        self.assertTrue(all(totals["B"] is None for totals in report["currency_totals"].values()))
        self.assertEqual((report["charge_above_hold"], report["shop_below_authority"], report["bundle_split_violations"]), (0, 0, 0))
