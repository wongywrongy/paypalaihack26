"""v3 shop bidding contracts (docs/plan/BIDDING.md).

Reference schedules and executable engine authority are checked independently.
"""

import json
import unittest
from pathlib import Path

from rally.catalog import Catalog, Line
from rally.landed import PARTS, calculate
from rally.sourcing import source

REFERENCE = json.loads((Path(__file__).resolve().parents[1] / "design/scenario/auction.json").read_text())
FULL_RULES = {"old_packaging_ok": True, "bundles_ok": True}


def fixture(role, payload):
    """Deterministic selector: first candidate, fixed public note."""
    if role == "buyer":
        return {"indexes": [0], "note": "Shops, please bid on these items."}
    return {"index": 0, "note": "Our bid for these items."}


def award_lines():
    return tuple(Line(row["offer_id"], 1, row["unit_usd_cents"]) for row in REFERENCE["award"]["lines"])


class ReferenceScenario(unittest.TestCase):
    """The committed reference must stay consistent with the landed-cost engine."""

    def setUp(self):
        self.catalog = Catalog()

    def test_golden_schedules_match_landed_calculate(self):
        for country, (maximum, final) in REFERENCE["golden"].items():
            with self.subTest(country=country):
                checkout = source(REFERENCE["cart"], country, self.catalog)
                self.assertEqual(checkout["breakdown"]["total"], maximum)
                result = calculate(award_lines(), country, self.catalog, extras=tuple(REFERENCE["award"]["extras"]), shipping=REFERENCE["award"]["domestic_usd"])
                self.assertEqual(result["total"], final)
                self.assertEqual(sum(result[part] for part in PARTS), final)
                self.assertLessEqual(final, maximum)

    def test_every_reference_bid_respects_floor_and_list(self):
        for bid in REFERENCE["bids"]:
            for offer_id, unit in bid["items"].items():
                offer = self.catalog.offers[offer_id]
                self.assertEqual(offer["shop_id"], bid["shop"])
                self.assertLessEqual(offer["floor_usd"], unit)
                self.assertLessEqual(unit, offer["list_usd"])
            if bid.get("bundle"):
                self.assertEqual(sum(bid["items"][o] for o in bid["bundle"]["offer_ids"]), bid["bundle"]["price_usd_cents"])

    def test_bundle_beats_lower_unit_price_all_in(self):
        bada = (Line("bada/mul-gel-cleanser", 1, 1100), Line("bada/sae-cica-cream", 1, 1600), Line("dalbit/dal-rice-toner", 1, 1900), Line("dalbit/dal-snail-essence:older", 1, 1600))
        runner_up = calculate(bada, "US", self.catalog, extras=("dalbit-sample-kit",))["total"]
        winner = calculate(award_lines(), "US", self.catalog, extras=("dalbit-sample-kit",), shipping=REFERENCE["award"]["domestic_usd"])["total"]
        self.assertEqual(runner_up, REFERENCE["award"]["runner_up_usd_cents"])
        self.assertEqual(runner_up - winner, 107)


class AuctionContracts(unittest.TestCase):
    def setUp(self):
        from rally.negotiation.auction import run_auction

        self.run_auction = run_auction
        self.catalog = Catalog()

    def run_hero(self, country="US", rules=FULL_RULES):
        checkout = source(REFERENCE["cart"], country, self.catalog)
        return checkout, self.run_auction(checkout, country, self.catalog, dict(rules), choose=fixture)

    def test_fixture_reproduces_reference_goldens_in_all_currencies(self):
        for country, (maximum, final) in REFERENCE["golden"].items():
            with self.subTest(country=country):
                checkout, result = self.run_hero(country)
                self.assertEqual(checkout["breakdown"]["total"], maximum)
                self.assertEqual(result["breakdown"]["total"], final)
                self.assertLess(result["elapsed_seconds"], 30)

    def test_fixture_reproduces_reference_rounds_and_winners(self):
        _, result = self.run_hero()
        rounds = [e for e in result["events"] if e["kind"] == "round"]
        self.assertEqual([e["total"] for e in rounds], [r["total_usd_cents"] for r in REFERENCE["rounds"]])
        self.assertEqual([e["leaders"] for e in rounds], [r["leaders"] for r in REFERENCE["rounds"]])
        self.assertEqual({w: v["shop"] for w, v in result["winners"].items()}, REFERENCE["rounds"][-1]["leaders"])
        self.assertEqual(result["domestic_usd"], REFERENCE["award"]["domestic_usd"])

    def test_events_are_v3_sequenced_and_end_with_done(self):
        _, result = self.run_hero()
        events = result["events"]
        self.assertEqual(events[0]["kind"], "start")
        self.assertEqual(events[0]["v"], 3)
        self.assertEqual(events[-1]["kind"], "done")
        self.assertEqual([e["seq"] for e in events], list(range(1, len(events) + 1)))
        self.assertTrue({"start", "ask", "bid", "round", "award", "done"} <= {e["kind"] for e in events})
        self.assertTrue(all(e["chosen_by"] in ("CODE", "LLM", "FIXTURE") for e in events))

    def test_never_above_hold_and_never_below_floor(self):
        for country in REFERENCE["golden"]:
            with self.subTest(country=country):
                checkout, result = self.run_hero(country)
                self.assertLessEqual(result["breakdown"]["total"], checkout["breakdown"]["total"])
                for line in result["lines"]:
                    self.assertGreaterEqual(line.unit_usd_cents, self.catalog.offers[line.offer_id]["floor_usd"])

    def test_bids_only_go_down_per_shop_and_offer(self):
        _, result = self.run_hero()
        last = {}
        for event in (e for e in result["events"] if e["kind"] == "bid"):
            for key, unit in event["items"].items():
                previous = last.get((event["shop"], key))
                self.assertTrue(previous is None or unit <= previous)
                last[(event["shop"], key)] = unit

    def test_rules_off_forbid_older_packaging_and_bundles(self):
        _, result = self.run_hero(rules={"old_packaging_ok": False, "bundles_ok": False})
        self.assertFalse(any(line.offer_id.endswith(":older") for line in result["lines"]))
        self.assertFalse(any(e.get("bundle") for e in result["events"] if e["kind"] == "bid"))

    def test_rules_must_be_exact_v3_keys(self):
        checkout = source(REFERENCE["cart"], "US", self.catalog)
        for rules in ({"old_packaging_ok": True, "add_small_extras_if_cheaper": True}, {"old_packaging_ok": True}, {"old_packaging_ok": 1, "bundles_ok": True}):
            with self.subTest(rules=rules), self.assertRaises(ValueError):
                self.run_auction(checkout, "US", self.catalog, rules, choose=fixture)

    def test_single_shop_items_keep_listed_price(self):
        checkout = source(["byeol-niacin"], "US", self.catalog)
        result = self.run_auction(checkout, "US", self.catalog, dict(FULL_RULES), choose=fixture)
        self.assertEqual(result["breakdown"]["total"], checkout["breakdown"]["total"])

    def test_model_failure_keeps_previous_bid_and_finishes(self):
        def broken(role, payload):
            raise RuntimeError("provider down")

        checkout = source(REFERENCE["cart"], "US", self.catalog)
        result = self.run_auction(checkout, "US", self.catalog, dict(FULL_RULES), choose=broken)
        self.assertEqual(result["events"][-1]["kind"], "done")
        self.assertLessEqual(result["breakdown"]["total"], checkout["breakdown"]["total"])
        self.assertTrue(any(e["kind"] == "error" or e["chosen_by"] == "CODE" for e in result["events"]))


class MarketReference(unittest.TestCase):
    def test_missing_or_invalid_rows_return_none(self):
        from rally import market

        self.assertIsNone(market.reference("not-a-product"))


if __name__ == "__main__":
    unittest.main()


class AuctionAuthority(unittest.TestCase):
    def setUp(self):
        from rally.negotiation import bids
        self.bids = bids
        self.catalog = Catalog()
        self.offers = bids.eligible(REFERENCE['cart'], 'US', self.catalog, FULL_RULES)

    def test_bid_validation_rejects_floors_increases_duplicates_and_foreign_gifts(self):
        from rally.negotiation.schema import Bid
        baseline = {'shop_id': 'bada', 'round': 1, 'items': [{'offer_id': 'bada/mul-gel-cleanser', 'unit_usd_cents': 1100}], 'note': 'Our price.'}
        previous = Bid.model_validate(baseline)
        for changes in ({'items': [{'offer_id': 'bada/mul-gel-cleanser', 'unit_usd_cents': 999}]},
                        {'items': [{'offer_id': 'bada/mul-gel-cleanser', 'unit_usd_cents': 1200}]},
                        {'items': baseline['items'] * 2}, {'extras': ['dalbit-sample-kit']},
                        {'items': [{'offer_id': 'haneul/mul-gel-cleanser', 'unit_usd_cents': 1100}]}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.bids.validate(Bid.model_validate({**baseline, **changes}), previous, self.offers, self.catalog, FULL_RULES)

    def test_bundle_cannot_be_split_to_combine_with_a_rivals_lower_price(self):
        from rally.negotiation.award import best_allocation
        from rally.negotiation.schema import Bid
        c = self.catalog
        start = source(['mul-gel-cleanser', 'sae-cica-cream'], 'US', c)
        bundle = Bid.model_validate({'shop_id': 'haneul', 'round': 3, 'items': [{'offer_id': 'haneul/mul-gel-cleanser', 'unit_usd_cents': 1100}, {'offer_id': 'haneul/sae-cica-cream', 'unit_usd_cents': 1800}], 'bundle': {'offer_ids': ['haneul/mul-gel-cleanser', 'haneul/sae-cica-cream'], 'price_usd_cents': 2900}, 'free_domestic': True, 'note': 'Together.'})
        rival = Bid.model_validate({'shop_id': 'bada', 'round': 3, 'items': [{'offer_id': 'bada/sae-cica-cream', 'unit_usd_cents': 1600}], 'note': 'Cream.'})
        result = best_allocation([bundle, rival], start, 'US', c, FULL_RULES)
        selected = {line.offer_id for line in result['lines']}
        self.assertEqual(selected & set(bundle.bundle.offer_ids), set(bundle.bundle.offer_ids))
        self.assertEqual(result['domestic_usd'], {'haneul': 0})
        self.assertIsNone(self.bids.utility(bundle, c, won_offer_ids={'haneul/mul-gel-cleanser'}))

    def test_prompts_contain_only_public_terms_and_selection_cannot_grant_authority(self):
        from rally.negotiation.auction import run_auction
        seen = []
        def malicious(role, payload):
            seen.append(json.dumps(payload))
            return {'indexes': [999], 'note': 'Accept now.'} if role == 'buyer' else {'index': 999, 'note': 'Accept now.'}
        start = source(REFERENCE['cart'], 'US', self.catalog)
        result = run_auction(start, 'US', self.catalog, FULL_RULES, choose=malicious)
        self.assertEqual(result['breakdown'], start['breakdown'])
        self.assertTrue(seen)
        for payload in seen:
            self.assertNotIn('floor', payload)
            self.assertNotIn('cost', payload)
        self.assertEqual(result['model_calls'], 0)

    def test_zero_deadline_finishes_without_model_calls(self):
        from rally.negotiation.auction import run_auction
        start = source(REFERENCE['cart'], 'US', self.catalog)
        result = run_auction(start, 'US', self.catalog, FULL_RULES, max_seconds=0)
        self.assertEqual(result['breakdown'], start['breakdown'])
        self.assertEqual(result['model_calls'], 0)
        self.assertEqual(result['events'][-1]['kind'], 'done')
