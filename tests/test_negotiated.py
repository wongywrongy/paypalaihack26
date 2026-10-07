"""Variable-price agreements use the existing payment recovery foundation."""

import os
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from itertools import permutations
from unittest.mock import patch
from uuid import uuid4

import test_coalition as legacy_tests
from coalition.catalog import PRODUCTS, ProductContext
from coalition.config import settings
from coalition.db import connect
from coalition.demo import create_run
from coalition.groups import freeze, join, members, snapshot, tick
from coalition.matching import (
    Assessment,
    Assessments,
    Constraints,
    RequestInput,
    Requirement,
    check_assessment,
    fixture_assessment,
    requirements_for,
    run_match,
    submit_request,
)
from coalition.negotiation import run_negotiation, start
from coalition.offers import terms_for
from coalition.payments import amount_matches, operation_amount, perform
from fastapi import HTTPException
from psycopg.errors import UniqueViolation


class VariableAmountChecks(unittest.TestCase):
    def test_assessment_order_is_harmless_but_coverage_must_be_exact(self):
        c = Constraints(
            max_total_minor=10000,
            latest_arrival=datetime.now(timezone.utc).date(),
            required_features=["Active noise cancellation", "Flight effectiveness"],
            device="iPhone 12",
        )
        product = next(p for p in PRODUCTS if p["id"] == "cabin-one")
        original = fixture_assessment(c, product)
        for order in permutations(original.requirements):
            a = original.model_copy(deep=True)
            a.requirements = [r.model_copy(deep=True) for r in order]
            checked = check_assessment(c, product, a)
            self.assertEqual(
                [r.requirement for r in checked.requirements], requirements_for(c)
            )
            self.assertEqual(checked.requirements[1].verdict, "unknown")
        for names in (
            requirements_for(c)[:-1],
            [requirements_for(c)[0]] * 3,
            requirements_for(c) + ["Unrequested feature"],
            ["Noise canceling", *requirements_for(c)[1:]],
        ):
            with (
                self.subTest(names=names),
                self.assertRaisesRegex(ValueError, "exactly once"),
            ):
                a = original.model_copy(deep=True)
                a.requirements = [
                    original.requirements[0].model_copy(update={"requirement": name})
                    for name in names
                ]
                check_assessment(c, product, a)

    def test_generic_source_cannot_override_explicit_catalog_unknown(self):
        c = Constraints(
            max_total_minor=10000,
            latest_arrival=datetime.now(timezone.utc).date(),
            required_features=["Flight effectiveness"],
        )
        a = Assessment(
            product_id="cabin-one",
            requirements=[
                Requirement(
                    requirement="Flight effectiveness",
                    verdict="yes",
                    rationale="Model claim",
                    source="description",
                )
            ],
        )
        product = next(p for p in PRODUCTS if p["id"] == a.product_id)
        self.assertEqual(
            check_assessment(c, product, a).requirements[0].verdict, "unknown"
        )

    def test_model_budget_reserves_input_and_output_before_network_call(self):
        from coalition.model import complete

        with (
            patch(
                "coalition.model.settings",
                replace(
                    settings,
                    llm_api_key="test",
                    llm_base_url="http://127.0.0.1:8000/api/model",
                ),
            ),
            patch("coalition.model.httpx.Client") as client,
        ):
            with self.assertRaisesRegex(RuntimeError, "token budget"):
                complete(
                    Constraints, "Extract", {"request": "Synthetic"}, remaining_tokens=1
                )
            client.assert_not_called()

    def test_explicit_request_edit_accepts_json_date_without_coercing_money(self):
        edited = {
            "raw_text": "Explicit edit",
            "edits": {"max_total_minor": 8600, "latest_arrival": "2026-10-14"},
        }
        self.assertEqual(
            RequestInput.model_validate(edited).edits.max_total_minor, 8600
        )
        edited["edits"]["max_total_minor"] = "8600"
        with self.assertRaises(ValueError):
            RequestInput.model_validate(edited)

    def test_maximum_capture_and_refund_are_distinct(self):
        c = {"amount_minor": 8900, "settlement_minor": 8500, "captured_minor": 8500}
        self.assertEqual(operation_amount(c, "authorize"), 8900)
        self.assertEqual(operation_amount(c, "capture"), 8500)
        self.assertEqual(operation_amount(c, "refund"), 8500)
        self.assertFalse(
            amount_matches({"currency_code": "USD", "value": "89.00"}, 8500)
        )


@unittest.skipUnless(
    os.environ.get("COALITION_TEST_DATABASE_URL"),
    "Requires disposable PostgreSQL schema",
)
class NegotiatedChecks(unittest.TestCase):
    setUpClass = classmethod(legacy_tests.PostgreSQLChecks.setUpClass.__func__)
    tearDownClass = classmethod(legacy_tests.PostgreSQLChecks.tearDownClass.__func__)

    def test_live_assessment_retry_is_bounded_and_does_not_store_invalid_coverage(self):
        c = Constraints(
            max_total_minor=10000,
            latest_arrival=(datetime.now(timezone.utc) + timedelta(days=7)).date(),
            required_features=["Active noise cancellation", "Flight effectiveness"],
            device="iPhone 12",
        )
        valid = Assessments(
            assessments=[
                fixture_assessment(c, p)
                for p in PRODUCTS
                if p["category"] == "Headphones"
            ]
        )
        invalid = valid.model_copy(deep=True)
        invalid.assessments[0].requirements.pop()
        with connect() as db:
            run = create_run(db, "success", profile="small")
            buyer = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s LIMIT 1", (run["run_id"],)
            ).fetchone()
            for corrected in (True, False):
                request = submit_request(
                    db, buyer, RequestInput(raw_text="Explicit requirements", edits=c)
                )
                db.commit()
                with (
                    patch(
                        "coalition.matching.settings",
                        replace(settings, mode="connected"),
                    ),
                    patch(
                        "coalition.matching.complete",
                        side_effect=[
                            (invalid.model_copy(deep=True), 100),
                            (
                                (valid if corrected else invalid).model_copy(deep=True),
                                100,
                            ),
                        ],
                    ) as model,
                    patch("coalition.matching.logging.getLogger"),
                ):
                    run_match(db, request["id"])
                db.commit()
                self.assertEqual(model.call_count, 2)
                self.assertIn("validation_error", model.call_args.args[2])
                self.assertEqual(
                    db.execute(
                        "SELECT status FROM buyer_requests WHERE id=%s",
                        (request["id"],),
                    ).fetchone()["status"],
                    "completed" if corrected else "failed",
                )
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) AS n FROM compatibility_assessments WHERE request_id=%s",
                        (request["id"],),
                    ).fetchone()["n"],
                    6 if corrected else 0,
                )

    def test_one_owned_buyer_per_run(self):
        run, hero, _, _ = self.prepare(0)
        with self.assertRaises(UniqueViolation), connect() as db:
            db.execute(
                "INSERT INTO buyers(id,run_id,name,persona,owner_id) VALUES(%s,%s,'Duplicate tab','{}',%s)",
                (uuid4(), run["run_id"], hero["owner_id"]),
            )

    def prepare(self, count=5, scenario="success"):
        with connect() as db:
            run = create_run(db, scenario, profile="small")
            bid = uuid4()
            db.execute(
                "INSERT INTO buyers(id,run_id,name,persona) VALUES(%s,%s,'Hero','{}')",
                (bid, run["run_id"]),
            )
            hero = db.execute("SELECT * FROM buyers WHERE id=%s", (bid,)).fetchone()
            submit_request(
                db,
                hero,
                RequestInput(
                    raw_text="Noise-canceling headphones for flights, under $100, works with my iPhone 12. I can wait a week."
                ),
            )
            for r in db.execute(
                "SELECT q.id FROM buyer_requests q JOIN buyers b ON b.id=q.buyer_id WHERE b.run_id=%s",
                (run["run_id"],),
            ).fetchall():
                run_match(db, r["id"])
            n = start(db, hero, "cabin-one")
            db.commit()
            run_negotiation(db, n["id"])
            db.commit()
            terms = terms_for(db, run["group_id"])
            p = next(p for p in PRODUCTS if p["id"] == terms["product_id"])
            context = ProductContext(
                product_id=p["id"],
                title=p["title"],
                selected_variant="Graphite",
                displayed_price_minor=p["price_minor"],
                currency="USD",
                quantity=1,
            )
            buyers = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s ORDER BY name", (run["run_id"],)
            ).fetchall()
            for b in buyers[:count]:
                c = join(db, b, run["group_id"], context, terms)
                db.commit()
                perform(db, c, "order")
                perform(db, c, "authorize")
            return run, hero, terms, context

    def close(self, run):
        with connect() as db:
            deadline = db.execute(
                "SELECT deadline FROM groups WHERE id=%s", (run["group_id"],)
            ).fetchone()["deadline"]
            from coalition.groups import expired

            with patch(
                "coalition.groups.expired",
                side_effect=lambda db, at: bool(at == deadline or expired(db, at)),
            ):
                tick(db, run["group_id"])

    def test_three_and_five_tiers_wait_for_close(self):
        for count, amount in ((3, 8900), (5, 8500)):
            run, hero, terms, _ = self.prepare(count)
            with connect() as db:
                self.assertEqual(snapshot(db, hero)["group"]["status"], "OPEN")
                self.assertTrue(
                    all(
                        c["captured_minor"] is None
                        for c in members(db, run["group_id"])
                    )
                )
            self.close(run)
            with connect() as db:
                s = snapshot(db, hero)
                self.assertEqual(s["group"]["status"], "SUCCEEDED")
                self.assertEqual(s["selected_count"], count)
                self.assertEqual(
                    s["group"]["settlement_snapshot"]["total_each_cents"], amount
                )
                self.assertTrue(
                    all(
                        c["authorized_minor"] == 8900 and c["captured_minor"] == amount
                        for c in members(db, run["group_id"])
                    )
                )
                self.assertEqual(s["totals"]["captured_minor"], count * amount)

    def test_below_minimum_voids_and_partial_failure_refunds_lower_capture(self):
        for count, scenario in ((2, "success"), (5, "partial")):
            run, _, _, _ = self.prepare(count, scenario)
            self.close(run)
            with connect() as db:
                g = db.execute(
                    "SELECT * FROM groups WHERE id=%s", (run["group_id"],)
                ).fetchone()
                self.assertEqual(g["status"], "FAILED")
                rows = members(db, g["id"])
                if scenario == "partial":
                    self.assertEqual(
                        sum(c["refunded_minor"] or 0 for c in rows), 4 * 8500
                    )
                self.assertTrue(
                    all(
                        c["refund_status"] == "COMPLETED"
                        or c["void_status"] == "VOIDED"
                        for c in rows
                    )
                )

    def test_unknown_requirement_and_budget_block_checkout(self):
        run, hero, terms, context = self.prepare(0)
        for constraints in (
            Constraints(
                max_total_minor=8600,
                latest_arrival=datetime.now(timezone.utc).date() + timedelta(days=7),
            ),
            Constraints(
                max_total_minor=10000,
                latest_arrival=datetime.now(timezone.utc).date() + timedelta(days=7),
                required_features=["Flight effectiveness"],
            ),
            Constraints(
                max_total_minor=10000,
                latest_arrival=datetime.now(timezone.utc).date() + timedelta(days=7),
                quantity=2,
            ),
        ):
            with connect() as db:
                r = submit_request(
                    db, hero, RequestInput(raw_text="Explicit edit", edits=constraints)
                )
                run_match(db, r["id"])
                with self.assertRaises(HTTPException):
                    join(db, hero, run["group_id"], context, terms)

    def test_stock_conflict_and_immutable_snapshot(self):
        run, hero, terms, _ = self.prepare(5)
        with connect() as db:
            db.execute(
                "UPDATE catalog_stock SET available=0 WHERE product_id='cabin-one'"
            )
            second = create_run(db, "success", profile="small")
            b = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s LIMIT 1", (second["run_id"],)
            ).fetchone()
            for r in db.execute(
                "SELECT q.id FROM buyer_requests q JOIN buyers b ON b.id=q.buyer_id WHERE b.run_id=%s",
                (second["run_id"],),
            ).fetchall():
                run_match(db, r["id"])
            n = start(db, b, "cabin-one")
            db.commit()
            run_negotiation(db, n["id"])
            self.assertEqual(
                db.execute(
                    "SELECT status FROM negotiations WHERE id=%s", (n["id"],)
                ).fetchone()["status"],
                "failed",
            )
        with connect() as db:
            db.execute(
                "UPDATE catalog_stock SET available=55 WHERE product_id='cabin-one'"
            )
        self.close(run)
        with self.assertRaises(Exception), connect() as db:
            db.execute(
                "UPDATE groups SET settlement_snapshot='{}' WHERE id=%s",
                (run["group_id"],),
            )

    def test_canonical_connected_payload_uses_lower_final_capture(self):
        run, _, _, _ = self.prepare(5)
        with connect() as db:
            deadline = db.execute(
                "SELECT deadline FROM groups WHERE id=%s", (run["group_id"],)
            ).fetchone()["deadline"]
            from coalition.groups import expired

            with patch(
                "coalition.groups.expired",
                side_effect=lambda db, at: at == deadline or expired(db, at),
            ):
                freeze(db, run["group_id"])
            db.execute("UPDATE runs SET mode='connected' WHERE id=%s", (run["run_id"],))
            db.commit()
            c = members(db, run["group_id"])[0]
            from dataclasses import replace

            from coalition.config import settings

            with (
                patch(
                    "coalition.payments.settings", replace(settings, mode="connected")
                ),
                patch("coalition.payments.validate_capture"),
                patch("coalition.payments.paypal") as provider,
            ):
                provider.return_value = {
                    "id": "CAPTURE-LOWER",
                    "status": "COMPLETED",
                    "amount": {"currency_code": "USD", "value": "85.00"},
                }
                perform(db, c, "capture")
                args = provider.call_args.args
                self.assertEqual(
                    args[2],
                    {
                        "amount": {"currency_code": "USD", "value": "85.00"},
                        "final_capture": True,
                    },
                )

    def test_shopping_session_hides_legacy_quote_and_preserves_owned_purchases(self):
        from coalition.main import app, buyer
        from fastapi.testclient import TestClient

        with connect() as db:
            legacy = create_run(db, 'success')
            row = db.execute('SELECT * FROM buyers WHERE run_id=%s LIMIT 1', (legacy['run_id'],)).fetchone()
            small = create_run(db, 'success', profile='small')
        app.dependency_overrides[buyer] = lambda: row
        try:
            with TestClient(app) as client:
                data = client.get('/api/journey').json()
                self.assertIsNone(data['status'])
                self.assertFalse(data['eligible'])
                result = client.post('/api/session',json={'run_id':str(legacy['run_id']),'shopping':True},headers={'X-Coalition-Request':'1'})
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json()['run_id'],str(small['run_id']))
                self.assertEqual(client.get('/api/purchases').json(), [])
                from urllib.parse import parse_qs, urlsplit

                invite = parse_qs(urlsplit(legacy['preparation_links'][0]['url']).query)['invite'][0]
                invited = client.post('/api/session',json={'run_id':str(legacy['run_id']),'invite':invite,'shopping':True},headers={'X-Coalition-Request':'1'})
                self.assertEqual(invited.status_code,200)
                self.assertEqual(invited.json()['run_id'],str(legacy['run_id']))
        finally:
            app.dependency_overrides.clear()
        run, hero, _, _ = self.prepare(5)
        app.dependency_overrides[buyer] = lambda: hero
        try:
            with TestClient(app) as client:
                items = client.get('/api/purchases').json()
                self.assertEqual(len(items),1)
                self.assertEqual(items[0]['run_id'],str(run['run_id']))
        finally:
            app.dependency_overrides.clear()
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/purchases').status_code,401)
