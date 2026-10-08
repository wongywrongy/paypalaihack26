"""PostgreSQL application checks. Model/payment doubles are never sandbox evidence."""

import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from threading import Barrier, Event
from unittest.mock import patch

import test_coalition as baseline
from coalition.catalog import PRODUCTS, SHOP_PRODUCTS, ProductContext
from coalition.config import settings
from coalition.db import connect, enqueue
from coalition.groups import join, members, tick, unwind
from coalition.main import app
from coalition.matching import (
    Assessment,
    Constraints,
    ExtractedConstraints,
    PartialConstraints,
    RequestInput,
    Requirement,
    check_assessment,
    extracted_constraints,
    latest_request,
    run_match,
    submit_request,
)
from coalition.negotiation import Reply, run_negotiation, start
from coalition.offers import terms_for
from coalition.payments import perform, provider_amount
from coalition.shopping import buyer_for_run, draft
from coalition.worker import run_once
from fastapi import HTTPException
from fastapi.testclient import TestClient


class GroundedExtractionChecks(unittest.TestCase):
    def test_real_catalog_has_new_identities_and_specific_brand_evidence(self):
        self.assertEqual({p["brand"] for p in SHOP_PRODUCTS}, {"Apple", "Sony", "Bose"})
        historical = next(p for p in PRODUCTS if p["id"] == "cabin-one")
        self.assertEqual(
            (historical["title"], historical["source_version"]), ("Cabin One", 2)
        )
        self.assertNotIn(historical, SHOP_PRODUCTS)
        with self.assertRaises(HTTPException) as rejected:
            start(None, {}, historical["id"])
        self.assertEqual(rejected.exception.status_code, 409)
        c = Constraints(
            max_total_minor=60000,
            latest_arrival=datetime.now(timezone.utc).date(),
            required_features=["Sony"],
        )
        sony = next(p for p in SHOP_PRODUCTS if p["id"] == "sony-wh-ch720n")
        assessment = Assessment(
            product_id=sony["id"],
            requirements=[
                Requirement(
                    requirement="Sony",
                    verdict="yes",
                    rationale="Matching manufacturer",
                    source="brand",
                )
            ],
        )
        self.assertEqual(
            check_assessment(c, sony, assessment).requirements[0].verdict, "yes"
        )
        apple = next(p for p in SHOP_PRODUCTS if p["brand"] == "Apple")
        assessment = assessment.model_copy(
            deep=True, update={"product_id": apple["id"]}
        )
        self.assertEqual(
            check_assessment(c, apple, assessment).requirements[0].verdict, "unknown"
        )

    def test_money_source_and_unrequested_features(self):
        raw = "Headphones under $100"
        result = ExtractedConstraints.model_validate(
            {
                "max_total_minor": 100,
                "latest_arrival": None,
                "quantity": 1,
                "device": None,
                "flexibility": [],
                "product_category": "Headphones",
                "required_features": [],
                "budget_source": "under $100",
                "arrival_source": None,
            }
        )
        c = extracted_constraints(result, raw, datetime.now(timezone.utc).date())
        self.assertEqual(c.max_total_minor, 9999)
        self.assertIsNone(c.latest_arrival)
        result = ExtractedConstraints.model_validate(
            result.model_dump()
            | {
                "required_features": [
                    {"name": "Bluetooth audio", "source": "Headphones"}
                ]
            }
        )
        with self.assertRaisesRegex(ValueError, "Remove feature"):
            extracted_constraints(result, raw, datetime.now(timezone.utc).date())


@unittest.skipUnless(
    os.getenv("COALITION_TEST_DATABASE_URL"), "Requires disposable PostgreSQL"
)
class ShoppingChecks(unittest.TestCase):
    # A fresh schema per test prevents one open deal changing another test's demand.
    def setUp(self):
        baseline.PostgreSQLChecks.setUpClass.__func__(type(self))

    def tearDown(self):
        baseline.PostgreSQLChecks.tearDownClass.__func__(type(self))

    def shopper(self, text="Headphones under $100. I can wait 7 days."):
        with connect() as db:
            b = draft(db)
            request = submit_request(db, b, RequestInput(raw_text=text))
            db.commit()
            run_match(db, request["id"])
        return b

    def negotiate(self, b, product="sony-wh-ch720n"):
        with connect() as db:
            n = start(db, b, product)
            db.commit()
            if n["id"]:
                run_negotiation(db, n["id"])
            g = db.execute(
                "SELECT * FROM groups WHERE run_id=%s", (n["run_id"],)
            ).fetchone()
            return buyer_for_run(db, b, g["run_id"]), g, terms_for(db, g["id"])

    def test_preparation_accepts_only_current_scope_and_seed_keeps_private_policy_server_side(
        self,
    ):
        with (
            patch(
                "coalition.main.settings",
                replace(settings, operator_token="review-test"),
            ),
            TestClient(app) as client,
        ):
            headers = {
                "X-Operator-Token": "review-test",
                "X-Coalition-Request": "1",
                "Origin": settings.public_url,
            }
            for profile in ("legacy", "large", "unknown"):
                self.assertEqual(
                    client.post(
                        "/api/operator/runs", json={"profile": profile}, headers=headers
                    ).status_code,
                    422,
                )
            self.assertIn(
                client.post("/api/opportunity", json={}, headers=headers).status_code,
                (404, 405),
            )
            self.assertNotIn("default_run_id", client.get("/api/config").json())
            public = client.get("/api/catalog").json()
            self.assertEqual(len(public), 6)
            self.assertEqual({p["category"] for p in public}, {"Headphones"})
            self.assertNotIn("floors", json.dumps(public))
        with connect() as db:
            self.assertEqual(
                db.execute("SELECT count(*) AS n FROM runs").fetchone()["n"], 0
            )
            for product in public:
                policy = db.execute(
                    "SELECT private_terms FROM merchant_policies WHERE id=%s",
                    (product["policy_id"],),
                ).fetchone()["private_terms"]
                self.assertTrue(
                    all(policy[k] == v for k, v in product["public_policy"].items())
                )
                self.assertTrue(
                    all(
                        floor >= bounds[0]
                        for floor, bounds in zip(policy["floors"], policy["ranges"])
                    )
                )

    def test_sessions_need_no_operator_and_keep_history_in_owned_tabs(self):
        headers = {"X-Coalition-Request": "1"}
        with TestClient(app) as first, TestClient(app) as other:
            s = first.post(
                "/api/session", json={"shopping": True}, headers=headers
            ).json()
            self.assertEqual(
                first.post(
                    "/api/session", json={"shopping": True}, headers=headers
                ).json(),
                s,
            )
            response = first.post(
                "/api/requests?run=" + s["run_id"],
                json={"raw_text": "Headphones under $100. I can wait 7 days."},
                headers=headers,
            )
            with connect() as db:
                run_match(db, response.json()["id"])
                b = db.execute(
                    "SELECT * FROM buyers WHERE id=%s", (s["buyer_id"],)
                ).fetchone()
            b, g, terms = self.negotiate(b)
            product = next(p for p in PRODUCTS if p["id"] == terms["product_id"])
            body = {
                "group_id": str(g["id"]),
                "accepted_terms": terms,
                "context": dict(
                    product_id=product["id"],
                    title=product["title"],
                    displayed_price_minor=product["price_minor"],
                    currency="USD",
                    selected_variant=product["variants"][0],
                    quantity=1,
                ),
            }
            own = first.post(
                "/api/commitments?run=" + str(g["run_id"]), json=body, headers=headers
            )
            self.assertEqual(own.status_code, 200)
            new = first.post(
                "/api/session",
                json={"new_deal": True, "shopping": True},
                headers=headers,
            ).json()
            self.assertNotEqual(new["run_id"], s["run_id"])
            self.assertEqual(
                first.get("/api/status?run=" + s["run_id"]).json()["commitment"]["id"],
                own.json()["id"],
            )
            self.assertEqual(
                len(first.get("/api/purchases?run=" + new["run_id"]).json()), 1
            )
            other.post("/api/session", json={"shopping": True}, headers=headers)
            self.assertEqual(
                other.get("/api/status?run=" + s["run_id"]).status_code, 401
            )
            self.assertEqual(
                other.post(
                    "/api/commitments/" + own.json()["id"] + "/leave",
                    json={},
                    headers=headers,
                ).status_code,
                404,
            )

    def test_open_group_matching_and_different_products(self):
        a, b = self.shopper(), self.shopper()
        a, first, _ = self.negotiate(a)
        with (
            patch(
                "coalition.main.settings",
                replace(settings, operator_token="review-test"),
            ),
            TestClient(app) as client,
        ):
            evidence = client.get(
                "/api/operator/runs/" + str(first["run_id"]),
                headers={
                    "X-Operator-Token": "review-test",
                    "X-Coalition-Request": "1",
                    "Origin": settings.public_url,
                },
            )
            self.assertEqual(evidence.status_code, 200)
            self.assertTrue(
                {"match", "negotiate"} <= {j["kind"] for j in evidence.json()["jobs"]}
            )
        with connect() as db:
            db.execute(
                "UPDATE catalog_stock SET available=0 WHERE product_id='sony-wh-ch720n'"
            )
        from coalition.main import buyer

        app.dependency_overrides[buyer] = lambda: b
        try:
            with TestClient(app) as client:
                available = client.get("/api/journey").json()["assessments"]
                self.assertEqual(
                    next(
                        a["available"]
                        for a in available
                        if a["product_id"] == "sony-wh-ch720n"
                    ),
                    5,
                )
        finally:
            app.dependency_overrides.clear()
        b, matched, _ = self.negotiate(b)
        self.assertEqual(first["id"], matched["id"])
        b, second, terms = self.negotiate(b, "sony-wh-ch520")
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(terms["product_id"], "sony-wh-ch520")
        with connect() as db:
            self.assertEqual(terms_for(db, first["id"])["product_id"], "sony-wh-ch720n")
            self.assertEqual(
                latest_request(db, a["id"])["raw_text"],
                latest_request(db, b["id"])["raw_text"],
            )

    def test_expired_groups_do_not_trap_repeat_shopping(self):
        b, old, _ = self.negotiate(self.shopper())
        with connect() as db:
            db.execute(
                "UPDATE groups SET deadline=now()-interval '1 second' WHERE id=%s",
                (old["id"],),
            )
            db.commit()
            tick(db, old["id"])
            self.assertEqual(
                db.execute(
                    "SELECT status FROM groups WHERE id=%s", (old["id"],)
                ).fetchone()["status"],
                "FAILED",
            )
        _, new, _ = self.negotiate(b)
        self.assertNotEqual(old["id"], new["id"])

    def test_missing_information_is_preserved_and_duplicate_work_is_bounded(self):
        b = self.shopper("Headphones under $100")
        with connect() as db:
            request = latest_request(db, b["id"])
            self.assertEqual(request["status"], "clarification")
            self.assertEqual(request["constraints"]["max_total_minor"], 9999)
            self.assertIsNone(request["constraints"]["latest_arrival"])
            self.assertEqual(request["clarification"]["fields"], ["latest_arrival"])
            again = submit_request(db, b, RequestInput(raw_text=request["raw_text"]))
            self.assertEqual(str(request["id"]), again["id"])
            answered = PartialConstraints.model_validate_json(
                json.dumps(request["constraints"])
            )
            answered.latest_arrival = datetime.now(timezone.utc).date() + timedelta(
                days=7
            )
            completed = submit_request(
                db, b, RequestInput(raw_text=request["raw_text"], edits=answered)
            )
            db.commit()
            run_match(db, completed["id"])
            self.assertEqual(latest_request(db, b["id"])["status"], "completed")
            self.assertEqual(
                latest_request(db, b["id"])["raw_text"], request["raw_text"]
            )
        barrier = Barrier(2)

        def submit():
            barrier.wait()
            with connect() as db:
                return start(db, b, "sony-wh-ch720n")

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: submit(), range(2)))
        self.assertEqual(results[0]["id"], results[1]["id"])

    def test_connected_missing_delivery_clarifies_after_one_model_call(self):
        with connect() as db:
            b = draft(db)
            request = submit_request(
                db, b, RequestInput(raw_text="Headphones under $100")
            )
            db.commit()
            result = ExtractedConstraints.model_validate(
                {
                    "max_total_minor": 10000,
                    "latest_arrival": None,
                    "quantity": 1,
                    "device": None,
                    "flexibility": [],
                    "product_category": "Headphones",
                    "required_features": [],
                    "budget_source": "under $100",
                    "arrival_source": None,
                }
            )
            with (
                patch(
                    "coalition.matching.settings", replace(settings, mode="connected")
                ),
                patch(
                    "coalition.matching.complete", return_value=(result, 100)
                ) as model,
            ):
                run_match(db, request["id"])
            self.assertEqual(model.call_count, 1)
            self.assertEqual(latest_request(db, b["id"])["status"], "clarification")

    def test_concurrent_inventory_reservations_do_not_oversell(self):
        buyers = [self.shopper(), self.shopper()]
        with connect() as db:
            db.execute(
                "UPDATE catalog_stock SET available=5 WHERE product_id='sony-wh-ch720n'"
            )
            negotiations = [start(db, b, "sony-wh-ch720n") for b in buyers]

        def negotiate(n):
            with connect() as db:
                run_negotiation(db, n["id"])

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(negotiate, negotiations))
        with connect() as db:
            statuses = db.execute("SELECT status FROM negotiations").fetchall()
            self.assertEqual(
                sorted(s["status"] for s in statuses), ["accepted", "failed"]
            )
            self.assertEqual(
                db.execute(
                    "SELECT available FROM catalog_stock WHERE product_id='sony-wh-ch720n'"
                ).fetchone()["available"],
                0,
            )
            self.assertEqual(
                db.execute(
                    "SELECT sum(units) AS n FROM inventory_reservations WHERE status='reserved'"
                ).fetchone()["n"],
                5,
            )

    def test_unresolved_expired_checkout_does_not_create_another_payment_attempt(self):
        b, g, terms = self.negotiate(self.shopper())
        p = next(p for p in PRODUCTS if p["id"] == terms["product_id"])
        context = ProductContext(
            product_id=p["id"],
            title=p["title"],
            displayed_price_minor=p["price_minor"],
            selected_variant=p["variants"][0],
            currency="USD",
            quantity=1,
        )
        with connect() as db:
            c = join(db, b, g["id"], context, terms)
            db.execute("UPDATE commitments SET active=false WHERE id=%s", (c["id"],))
            db.execute(
                "INSERT INTO payment_operations(id,commitment_id,kind,status) VALUES(gen_random_uuid(),%s,'order','unknown')",
                (c["id"],),
            )
            with self.assertRaisesRegex(HTTPException, "409"):
                join(db, b, g["id"], context, terms)
            self.assertEqual(
                db.execute(
                    "SELECT count(*) AS n FROM commitments WHERE buyer_id=%s",
                    (b["id"],),
                ).fetchone()["n"],
                1,
            )

    def test_policy_prices_evidence_decline_and_invalid_merchant_proposal(self):
        b = self.shopper("Headphones under $80. I can wait 7 days.")
        b, g, terms = self.negotiate(b, "sony-wh-ch520")
        self.assertLess(terms["total_minor"], 8900)
        constraints = Constraints(
            max_total_minor=10000,
            latest_arrival=datetime.now(timezone.utc).date(),
            required_features=["Flight effectiveness"],
        )
        assessment = Assessment(
            product_id="bose-quietcomfort",
            requirements=[
                Requirement(
                    requirement="Flight effectiveness",
                    verdict="yes",
                    rationale="Unrelated source",
                    source="evidence.iphone_12",
                )
            ],
        )
        self.assertEqual(
            check_assessment(
                constraints,
                next(p for p in PRODUCTS if p["id"] == "bose-quietcomfort"),
                assessment,
            )
            .requirements[0]
            .verdict,
            "unknown",
        )
        b = self.shopper()
        with connect() as db:
            db.execute("UPDATE runs SET profile='large' WHERE id=%s", (b["run_id"],))
            with self.assertRaises(HTTPException):
                start(db, b, "sony-wh-ch720n")
            db.execute("UPDATE runs SET profile='small' WHERE id=%s", (b["run_id"],))
            n = start(db, b, "sony-wh-ch720n")
            db.commit()
            with (
                patch(
                    "coalition.negotiation.settings",
                    replace(settings, mode="connected"),
                ),
                patch(
                    "coalition.negotiation.complete",
                    return_value=(Reply(action="decline"), 10),
                ),
            ):
                run_negotiation(db, n["id"])
            self.assertEqual(
                db.execute(
                    "SELECT status FROM negotiations WHERE id=%s", (n["id"],)
                ).fetchone()["status"],
                "failed",
            )
            n = start(db, b, "sony-wh-ch720n")
            db.commit()

            def invalid(schema, role, payload, **kwargs):
                p = {**payload["template"], "currency": "EUR"}
                return schema.model_validate({"action": "propose", "proposal": p}), 10

            with (
                patch(
                    "coalition.negotiation.settings",
                    replace(settings, mode="connected"),
                ),
                patch("coalition.negotiation.complete", side_effect=invalid) as model,
            ):
                run_negotiation(db, n["id"])
            self.assertEqual(model.call_count, 6)
            self.assertEqual(
                db.execute(
                    "SELECT status FROM negotiations WHERE id=%s", (n["id"],)
                ).fetchone()["status"],
                "failed",
            )
            self.assertEqual(
                db.execute(
                    "SELECT count(*) AS n FROM offers WHERE product_id='sony-wh-ch720n'"
                ).fetchone()["n"],
                0,
            )

    def test_real_airpods_quote_and_consent_preserve_its_exact_variant(self):
        b = self.shopper("Headphones maximum $600. I can wait 14 days.")
        b, group, terms = self.negotiate(b, "apple-airpods-max-usbc")
        product = next(p for p in SHOP_PRODUCTS if p["id"] == terms["product_id"])
        self.assertEqual(
            (terms["title"], terms["variant"]),
            ("Apple AirPods Max (USB-C)", "Starlight"),
        )
        self.assertEqual(terms["tier_schedule"][0]["total_each_cents"], 29900)
        self.assertNotIn("floors", terms)
        context = ProductContext(
            product_id=product["id"],
            title=product["title"],
            selected_variant="Starlight",
            displayed_price_minor=product["price_minor"],
            currency="USD",
            quantity=1,
        )
        with connect() as db:
            commitment = join(db, b, group["id"], context, terms)
            self.assertEqual(commitment["accepted_terms"]["variant"], "Starlight")
            self.assertEqual(commitment["amount_minor"], 29900)

    def test_buyer_budget_validation_feedback_preserves_private_merchant_context(self):
        b = self.shopper("Headphones under $90. I can wait 7 days.")
        with connect() as db:
            n = start(db, b, "sony-wh-ch720n")
            db.commit()
            calls = []

            def respond(schema, role, payload, **kwargs):
                calls.append(payload)
                if "constraints" in payload:
                    self.assertNotIn("floors", json.dumps(payload))
                    if len(calls) == 3:
                        self.assertIn(
                            "invalid response", payload["validation_feedback"]
                        )
                        return Reply(action="accept"), 10
                else:
                    self.assertIn("floors", payload["merchant_policy"])
                proposal = dict(payload["template"])
                if len(calls) == 2:
                    proposal["tier_schedule"] = [
                        {"minimum_buyers": 3, "total_each_cents": 8900},
                        {"minimum_buyers": 5, "total_each_cents": 8500},
                    ]
                return schema.model_validate_json(
                    json.dumps({"action": "propose", "proposal": proposal})
                ), 10

            with (
                patch(
                    "coalition.negotiation.settings",
                    replace(
                        settings, mode="connected", paypal_merchant_id="test-merchant"
                    ),
                ),
                patch("coalition.negotiation.complete", side_effect=respond),
            ):
                run_negotiation(db, n["id"])
            self.assertEqual(len(calls), 3)
            rounds = db.execute(
                "SELECT valid FROM negotiation_rounds WHERE negotiation_id=%s ORDER BY ordinal",
                (n["id"],),
            ).fetchall()
            self.assertEqual([r["valid"] for r in rounds], [False, True, True])
            self.assertEqual(
                db.execute(
                    "SELECT status FROM negotiations WHERE id=%s", (n["id"],)
                ).fetchone()["status"],
                "accepted",
            )

    def test_prepared_demo_negotiation_uses_its_five_requests_not_other_shoppers(self):
        from coalition.demo import create_run

        self.shopper()
        with connect() as db:
            run = create_run(db, "success")
            db.commit()
            for request in db.execute(
                "SELECT q.id FROM buyer_requests q JOIN buyers b ON b.id=q.buyer_id WHERE b.run_id=%s",
                (run["run_id"],),
            ).fetchall():
                run_match(db, request["id"])
            b = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s AND name='Sam'", (run["run_id"],)
            ).fetchone()
            n = start(db, b, "sony-wh-ch720n")
            db.execute("UPDATE runs SET mode='connected'")
            db.commit()
            with (
                patch(
                    "coalition.negotiation.settings",
                    replace(settings, mode="connected"),
                ),
                patch(
                    "coalition.negotiation.complete",
                    return_value=(Reply(action="decline"), 10),
                ) as model,
            ):
                run_negotiation(db, n["id"])
            self.assertEqual(model.call_count, 1)
            payload = model.call_args.args[2]
            self.assertEqual(payload["compatible_demand"]["count"], 5)
            self.assertEqual(payload["compatible_request_count"], 5)

    def test_slow_ai_does_not_block_deadlines_or_duplicate_after_lease_expiry(self):
        b, g, terms = self.negotiate(self.shopper())
        entered, release = Event(), Event()
        with connect() as db:
            db.execute("UPDATE jobs SET status='done'")
            db.execute(
                "UPDATE groups SET deadline=now()-interval '1 second' WHERE id=%s",
                (g["id"],),
            )
            enqueue(db, "match", {"request_id": "slow-test"}, "slow-test")
            enqueue(db, "tick", {"group_id": str(g["id"])}, "deadline-test")

        def slow(db, rid):
            entered.set()
            self.assertTrue(release.wait(5))

        with (
            patch("coalition.matching.run_match", side_effect=slow) as model,
            ThreadPoolExecutor(max_workers=1) as pool,
        ):
            future = pool.submit(run_once, "ai")
            self.assertTrue(entered.wait(3))
            with connect() as db:
                db.execute(
                    "UPDATE jobs SET lease_until=now()-interval '1 second' WHERE dedupe_key='slow-test'"
                )
            self.assertFalse(run_once("ai"))
            self.assertTrue(run_once("payment"))
            with connect() as db:
                self.assertEqual(
                    db.execute(
                        "SELECT status FROM groups WHERE id=%s", (g["id"],)
                    ).fetchone()["status"],
                    "FAILED",
                )
            release.set()
            future.result()
            self.assertEqual(model.call_count, 1)

    def test_consent_is_preserved_when_shopping_again(self):
        b, g, terms = self.negotiate(self.shopper())
        p = next(p for p in PRODUCTS if p["id"] == terms["product_id"])
        context = ProductContext(
            product_id=p["id"],
            title=p["title"],
            selected_variant=p["variants"][0],
            displayed_price_minor=p["price_minor"],
            currency="USD",
            quantity=1,
        )
        with connect() as db:
            c = join(db, b, g["id"], context, terms)
            db.commit()
            perform(db, c, "order")
            perform(db, c, "authorize")
            saved = members(db, g["id"])[0]
            req = submit_request(
                db, b, RequestInput(raw_text="Headphones under $70. I can wait 4 days.")
            )
            db.commit()
            run_match(db, req["id"])
            self.assertEqual(join(db, b, g["id"], context, terms)["id"], c["id"])
            self.assertEqual(members(db, g["id"])[0]["request_id"], saved["request_id"])
            self.assertEqual(members(db, g["id"])[0]["accepted_terms"], terms)
            self.assertEqual(
                provider_amount(saved, "authorize")["value"],
                f"{terms['total_minor'] // 100}.{terms['total_minor'] % 100:02}",
            )
            unwind(db, g["id"], "Test cancellation")
            db.commit()
            tick(db, g["id"])
            self.assertEqual(members(db, g["id"])[0]["void_status"], "VOIDED")
