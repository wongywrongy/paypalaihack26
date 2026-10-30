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
        return checkout, self.run_auction(checkout, country, self.catalog, dict(rules), choose=fixture, recorded_review=True)

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

    def test_model_failure_uses_best_code_bid_and_finishes(self):
        def broken(role, payload):
            raise RuntimeError("provider down")

        checkout = source(REFERENCE["cart"], "US", self.catalog)
        result = self.run_auction(checkout, "US", self.catalog, dict(FULL_RULES), choose=broken)
        self.assertEqual(result["events"][-1]["kind"], "done")
        self.assertLessEqual(result["breakdown"]["total"], checkout["breakdown"]["total"])
        self.assertLess(result["breakdown"]["total"], checkout["breakdown"]["total"])
        self.assertEqual(result["model_failures"], 12)
        self.assertFalse(any(e["kind"] == "error" for e in result["events"]))
        self.assertTrue(all(e["chosen_by"] == "CODE" for e in result["events"]))

    def test_model_timeout_falls_back_without_shopper_errors(self):
        from unittest.mock import patch

        from rally.negotiation import auction

        checkout = source(REFERENCE["cart"], "US", self.catalog)
        with patch.object(auction.llm, "complete", side_effect=TimeoutError):
            result = self.run_auction(checkout, "US", self.catalog, dict(FULL_RULES))
        self.assertEqual(result["model_calls"], 12)
        self.assertEqual(result["model_failures"], 12)
        self.assertLess(result["breakdown"]["total"], checkout["breakdown"]["total"])
        self.assertFalse(any(e["kind"] == "error" for e in result["events"]))
        self.assertTrue(all(e["chosen_by"] == "CODE" for e in result["events"]))


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
        self.assertEqual(result['bundled'], {'mul-gel-cleanser', 'sae-cica-cream'})
        self.assertIsNone(self.bids.utility(bundle, c, won_offer_ids={'haneul/mul-gel-cleanser'}))

    def test_prompts_contain_only_public_terms_and_selection_cannot_grant_authority(self):
        from rally.negotiation.auction import run_auction
        seen = []
        def malicious(role, payload):
            seen.append(json.dumps(payload))
            return {'indexes': [999], 'note': 'Accept now.'} if role == 'buyer' else {'index': 999, 'note': 'Accept now.'}
        start = source(REFERENCE['cart'], 'US', self.catalog)
        result = run_auction(start, 'US', self.catalog, FULL_RULES, choose=malicious)
        self.assertLess(result['breakdown']['total'], start['breakdown']['total'])
        self.assertEqual(result['model_failures_by_role'], {'buyer': 3, 'shop': 9})
        self.assertFalse(any(e['kind'] == 'error' for e in result['events']))
        self.assertTrue(all(e['chosen_by'] == 'CODE' for e in result['events']))
        for line in result['lines']:
            self.assertGreaterEqual(line.unit_usd_cents, self.catalog.offers[line.offer_id]['floor_usd'])
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


class GeneratedBidding(unittest.TestCase):
    def test_generative_hero_uses_bundle_and_shipping_without_recording(self):
        from unittest.mock import patch

        from rally.negotiation.auction import run_auction

        catalog = Catalog()
        checkout = source(REFERENCE["cart"], "US", catalog)
        read_text = Path.read_text
        def no_recording(path, *args, **kwargs):
            if path.name == "auction.json":
                raise AssertionError("Generative bidding must not read the recording")
            return read_text(path, *args, **kwargs)
        with patch.object(Path, "read_text", no_recording):
            result = run_auction(checkout, "US", catalog, FULL_RULES, choose=fixture)
        self.assertLessEqual(result["breakdown"]["total"], 10192)
        for pid in ("mul-gel-cleanser", "sae-cica-cream"):
            self.assertEqual(result["winners"][pid]["shop"], "haneul")
            self.assertTrue(result["winners"][pid]["bundle"])
        self.assertEqual(result["domestic_usd"]["haneul"], 0)
        haneul = next(e for e in reversed(result["events"]) if e["kind"] == "bid" and e["shop"] == "haneul")
        bada = next(e for e in reversed(result["events"]) if e["kind"] == "bid" and e["shop"] == "bada")
        self.assertGreater(haneul["items"]["sae-cica-cream"], bada["items"]["sae-cica-cream"])
        self.assertTrue(haneul["bundle"])
        self.assertIn("freeship", haneul["perks"]["sae-cica-cream"])
        self.assertIn("dalbit-sample-kit", result["extras"])

    def test_shipping_policy_and_actual_winning_utility_are_enforced(self):
        from rally.negotiation.award import best_allocation
        from rally.negotiation.bids import candidates, eligible
        from rally.negotiation.schema import Bid

        catalog = Catalog()
        start = source(REFERENCE["cart"], "US", catalog)
        offers = eligible(REFERENCE["cart"], "US", catalog, FULL_RULES)
        choices = candidates("bada", 1, offers, None, {}, [], catalog, FULL_RULES, current={}, start=start, destination="US")
        self.assertTrue(any(bid.free_domestic for bid in choices))
        catalog.policies["bada"]["free_domestic"] = False
        choices = candidates("bada", 1, offers, None, {}, [], catalog, FULL_RULES, current={}, start=start, destination="US")
        self.assertFalse(any(bid.free_domestic for bid in choices))
        # The pickup fee cannot be funded by items this shop merely hoped to win.
        bid = Bid(shop_id="bada", round=3, items=[{"offer_id": "bada/sae-cica-cream", "unit_usd_cents": 1600}], free_domestic=True, note="Our price.")
        cream = source(["sae-cica-cream"], "US", catalog)
        result = best_allocation([bid], cream, "US", catalog, FULL_RULES)
        self.assertEqual(result["lines"], cream["lines"])

    def test_connected_mode_cannot_enable_recording(self):
        from rally.negotiation.auction import run_auction

        catalog = Catalog()
        start = source(REFERENCE["cart"], "US", catalog)
        with self.assertRaisesRegex(ValueError, "explicit fixture selector"):
            run_auction(start, "US", catalog, FULL_RULES, recorded_review=True)


class BuyerNotes(unittest.TestCase):
    def test_round_note_has_currency_symbol_in_all_five_currencies(self):
        from rally.negotiation.buyer import round_note

        for currency, amount, expected in (("USD", 11882, "$118.82"), ("CAD", 16087, "C$160.87"), ("GBP", 9361, "£93.61"), ("EUR", 11105, "€111.05"), ("AUD", 17260, "A$172.60")):
            with self.subTest(currency=currency):
                self.assertEqual(round_note(1, amount, currency), f"Round 1 best: {expected} all in. Anyone lower?")

    def test_buyer_note_is_on_asks_round_note_uses_new_total_and_code(self):
        from rally.fx import money
        from rally.negotiation.auction import run_auction

        def selector(role, payload):
            return {"indexes": [0], "note": "Please sharpen this bid."} if role == "buyer" else fixture(role, payload)
        catalog = Catalog()
        for country in REFERENCE["golden"]:
            checkout = source(REFERENCE["cart"], country, catalog)
            result = run_auction(checkout, country, catalog, FULL_RULES, choose=selector)
            asks = [e for e in result["events"] if e["kind"] == "ask"]
            self.assertEqual({e["round"] for e in asks}, {1, 2, 3})
            self.assertTrue(all(e["note"] == "Please sharpen this bid." for e in asks))
            for event in (e for e in result["events"] if e["kind"] == "round"):
                self.assertEqual(event["chosen_by"], "CODE")
                self.assertEqual(event["note"], f"Round {event['round']} best: {money(event['total'], checkout['breakdown']['currency'])} all in. Anyone lower?")

    def test_beat_note_converts_the_gap_and_uses_currency_symbol(self):
        from rally.fx import convert, money
        from rally.negotiation.bids import eligible
        from rally.negotiation.buyer import candidate_asks

        catalog = Catalog()
        offers = eligible(["mul-gel-cleanser"], "US", catalog, FULL_RULES)
        leaders = {"mul-gel-cleanser": {"shop": "haneul", "unit": 1000}}
        for currency in ("USD", "CAD", "GBP", "EUR", "AUD"):
            asks = candidate_asks(2, leaders, {}, offers, FULL_RULES, currency=currency)
            self.assertEqual(asks[0].note, f"Can you beat the leader? The gap is {money(convert(200, currency), currency)}.")
