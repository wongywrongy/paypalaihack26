"""Small invariant checks + opt-in real PostgreSQL integration checks.
Run: PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests -v
PostgreSQL: set COALITION_TEST_DATABASE_URL to a disposable database first.
"""

import os
from dataclasses import replace

os.environ["COALITION_MODE"] = "fixture"
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

from coalition.assistant import Decision, concerns, decide
from coalition.catalog import TERMS, ProductContext, validate_context
from coalition.config import settings
from coalition.db import connect, init_db, seed
from coalition.groups import (
    group_plan,
    join,
    lock_group,
    members,
    safe_terminal,
    snapshot,
    tick,
)
from coalition.offers import terms_for
from coalition.payments import (
    RecoveryRequired,
    amount_matches,
    merge_status,
    observe,
    perform,
    validate_order,
)
from fastapi import HTTPException
from legacy_fixtures import create_run

CONTEXT = ProductContext(
    product_id="arc-991",
    title=TERMS["title"],
    selected_variant="Graphite",
    displayed_price_minor=8000,
    currency="USD",
    quantity=1,
)


def row(**changes):
    return dict(
        id=uuid4(),
        authorization_id="auth",
        authorization_status="CREATED",
        capture_id=None,
        capture_status=None,
        refund_id=None,
        refund_status=None,
        void_status=None,
        locked=False,
        admitted=True,
        active=True,
        withdrawn=False,
        **changes,
    )


class Invariants(unittest.TestCase):
    def test_minor_units_and_untrusted_context(self):
        self.assertTrue(amount_matches({"currency_code": "USD", "value": "65.00"}))
        for value in ("80.00", "65.001", "NaN", "invalid", 65.0):
            self.assertFalse(amount_matches({"currency_code": "USD", "value": value}))
        self.assertFalse(amount_matches({"currency_code": "EUR", "value": "65.00"}))
        for field, value in [
            ("title", "Different model"),
            ("quantity", 2),
            ("selected_variant", "Cloud"),
            ("displayed_price_minor", 6500),
        ]:
            with self.assertRaises(HTTPException):
                validate_context(CONTEXT.model_copy(update={field: value}), offer=True)

    def test_agent_is_conservative(self):
        persona = {
            "budget_minor": 7000,
            "delivery_days": 2,
            "product_id": "arc-991",
            "variant": "Graphite",
        }
        result = Decision.model_validate(decide(persona, TERMS))
        self.assertEqual(result.decision, "reject")
        for field, value in [
            ("budget_minor", 6499),
            ("variant", "Cloud"),
            ("product_id", "another-991"),
        ]:
            self.assertTrue(
                concerns({**persona, "delivery_days": 10, field: value}, TERMS)
            )

    def test_only_confirmed_authorizations_close_group(self):
        rows = [row() for _ in range(4)]
        rows.append({**row(), "authorization_id": None, "authorization_status": None})
        self.assertEqual(group_plan({"status": "OPEN"}, rows, False), "OPEN")
        rows[4]["authorization_status"] = "PENDING"
        rows[4]["authorization_id"] = "pending"
        self.assertEqual(group_plan({"status": "OPEN"}, rows, False), "OPEN")
        rows[4]["authorization_status"] = "CREATED"
        self.assertEqual(group_plan({"status": "OPEN"}, rows, False), "SETTLING")

    def test_deadline_and_partial_settlement(self):
        rows = [row() for _ in range(4)]
        self.assertEqual(group_plan({"status": "OPEN"}, rows, True), "UNWINDING")
        rows = [
            {**row(), "locked": True, "capture_status": "COMPLETED"} for _ in range(5)
        ]
        self.assertEqual(group_plan({"status": "SETTLING"}, rows, False), "SUCCEEDED")
        rows[4]["capture_status"] = "PENDING"
        self.assertEqual(group_plan({"status": "SETTLING"}, rows, False), "SETTLING")
        rows[4]["capture_status"] = "DECLINED"
        self.assertEqual(group_plan({"status": "SETTLING"}, rows, False), "UNWINDING")

    def test_late_capture_requires_refund(self):
        self.assertEqual(
            group_plan(
                {"status": "FAILED"}, [{**row(), "capture_status": "COMPLETED"}], False
            ),
            "UNWINDING",
        )

    def test_authorizations_observed_after_deadline_cannot_start_settlement(self):
        rows = [row() for _ in range(5)]
        self.assertEqual(group_plan({"status": "OPEN"}, rows, True), "UNWINDING")

    def test_out_of_order_events_do_not_regress(self):
        for kind, old, new in [
            ("capture", "COMPLETED", "PENDING"),
            ("refund", "COMPLETED", "PENDING"),
            ("authorization", "VOIDED", "CREATED"),
        ]:
            self.assertEqual(merge_status(old, new, kind), old)
        self.assertEqual(merge_status("COMPLETED", "REFUNDED", "capture"), "REFUNDED")

    def test_order_is_bound_to_commitment(self):
        c = {"id": uuid4(), "order_id": "order"}
        data = {
            "id": "order",
            "intent": "AUTHORIZE",
            "purchase_units": [
                {
                    "custom_id": str(c["id"]),
                    "amount": {"currency_code": "USD", "value": "65.00"},
                }
            ],
        }
        validate_order(data, c)
        data["purchase_units"][0]["custom_id"] = str(uuid4())
        with self.assertRaises(RecoveryRequired):
            validate_order(data, c)

    def test_live_model_acceptance_cannot_override_hard_constraints(self):
        persona = {
            "budget_minor": 7000,
            "delivery_days": 2,
            "product_id": "arc-991",
            "variant": "Graphite",
        }
        result = {
            "decision": "accept",
            "offer_id": TERMS["offer_id"],
            "matched_constraints": [],
            "unresolved_concerns": [],
            "explanation": "Accept despite the delivery limit.",
        }

        class Response:
            def raise_for_status(self):
                pass

            def json(self):
                return {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": json.dumps(result)}],
                }

        class Client:
            def __init__(self, *a, **kw):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def post(self, *a, **kw):
                return Response()

        with (
            patch(
                "coalition.assistant.settings",
                replace(settings, mode="connected", llm_api_key="test"),
            ),
            patch("coalition.model.httpx.Client", Client),
            patch(
                "coalition.model.settings",
                replace(
                    settings,
                    mode="connected",
                    llm_api_key="test",
                    llm_protocol="anthropic",
                    llm_base_url="https://example.invalid",
                ),
            ),
        ):
            self.assertEqual(decide(persona, TERMS)["decision"], "reject")
            for request_text in ("Below $65", "Under $70, delivery within 2 days"):
                decision = decide(persona, TERMS, request_text)
                self.assertEqual(decision["decision"], "reject")
                self.assertTrue(decision["guardrail_override"])
            result["extracted_constraints"] = {"course": "MATH 101"}
            self.assertEqual(
                decide(persona, TERMS, "I need this for MATH 101")["decision"],
                "reject",
            )
            result["offer_id"] = "unlisted-offer"
            with self.assertRaisesRegex(RuntimeError, "unknown offer"):
                decide(persona, TERMS, "Under $70")

    def test_connected_proof_refuses_fixture_evidence(self):
        import runpy
        from pathlib import Path

        script = Path(__file__).resolve().parents[1] / "scripts" / "check_connected.py"
        with self.assertRaisesRegex(SystemExit, "Connected mode required"):
            runpy.run_path(str(script), run_name="__main__")

    def test_webhook_verification_requires_provider_success(self):
        from coalition.payments import verify_webhook

        headers = {
            k: "test"
            for k in (
                "paypal-auth-algo",
                "paypal-cert-url",
                "paypal-transmission-id",
                "paypal-transmission-sig",
                "paypal-transmission-time",
            )
        }
        with (
            patch(
                "coalition.payments.settings",
                replace(
                    settings,
                    mode="connected",
                    paypal_webhook_id="registered-app-webhook",
                ),
            ),
            patch("coalition.payments.paypal") as provider,
        ):
            provider.return_value = {"verification_status": "FAILURE"}
            self.assertFalse(verify_webhook(headers, {"id": "event"}))
            provider.return_value = {"verification_status": "SUCCESS"}
            self.assertTrue(verify_webhook(headers, {"id": "event"}))
            sent = provider.call_args.args[2]
            self.assertEqual(sent["webhook_id"], "registered-app-webhook")
            self.assertEqual(sent["webhook_event"], {"id": "event"})
            self.assertFalse(verify_webhook({}, {"id": "event"}))

    def test_operator_cannot_attach_pending_or_unrelated_refund(self):
        from coalition.payments import confirm_recovered_refund

        c = {
            "id": uuid4(),
            "capture_id": "our-capture",
            "refund_id": "failed-refund",
            "refund_status": "FAILED",
        }
        with (
            patch("coalition.payments.settings", replace(settings, mode="connected")),
            patch("coalition.payments.paypal") as provider,
        ):
            provider.return_value = {
                "id": "refund",
                "status": "PENDING",
                "amount": {"currency_code": "USD", "value": "65.00"},
            }
            with self.assertRaises(RecoveryRequired):
                confirm_recovered_refund(None, c, "refund")
            provider.return_value = {
                "id": "refund",
                "status": "COMPLETED",
                "amount": {"currency_code": "USD", "value": "65.00"},
                "links": [
                    {
                        "rel": "up",
                        "href": "https://api-m.sandbox.paypal.com/v2/payments/captures/somebody-else",
                    }
                ],
            }
            with self.assertRaises(RecoveryRequired):
                confirm_recovered_refund(None, c, "refund")


@unittest.skipUnless(
    os.getenv("COALITION_TEST_DATABASE_URL"),
    "PostgreSQL integration requires COALITION_TEST_DATABASE_URL",
)
class PostgreSQLChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg

        cls.original_url = settings.database_url
        cls.test_url = os.environ["COALITION_TEST_DATABASE_URL"]
        cls.schema = "coalition_test_" + uuid4().hex
        with psycopg.connect(cls.test_url, autocommit=True) as db:
            db.execute("CREATE SCHEMA " + cls.schema)
        parts = urlsplit(cls.test_url)
        query = dict(parse_qsl(parts.query))
        query["options"] = "-csearch_path=" + cls.schema
        object.__setattr__(
            settings,
            "database_url",
            urlunsplit((*parts[:3], urlencode(query), parts.fragment)),
        )
        init_db()
        seed()

    @classmethod
    def tearDownClass(cls):
        import psycopg
        from coalition.db import engine

        engine().dispose()
        object.__setattr__(settings, "database_url", cls.original_url)
        with psycopg.connect(cls.test_url, autocommit=True) as db:
            db.execute("DROP SCHEMA " + cls.schema + " CASCADE")

    def prepare(self, scenario="success", count=5):
        from coalition.assistant import run_decision
        from psycopg.types.json import Jsonb

        with connect() as db:
            run = create_run(db, scenario)
            group_id = run["group_id"]
            buyers = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s AND name!='Sam' ORDER BY name",
                (run["run_id"],),
            ).fetchall()
            if count == 5:
                fifth = {**buyers[0], "id": uuid4(), "name": "Judge"}
                db.execute(
                    "INSERT INTO buyers(id,run_id,name,persona) VALUES(%s,%s,%s,%s)",
                    (fifth["id"], run["run_id"], "Judge", Jsonb(fifth["persona"])),
                )
                did = uuid4()
                db.execute(
                    "INSERT INTO ai_decisions(id,buyer_id,group_id,mode) VALUES(%s,%s,%s,'fixture')",
                    (did, fifth["id"], group_id),
                )
                buyers.append(fifth)
            ai_decisions = db.execute(
                "SELECT id FROM ai_decisions WHERE group_id=%s", (group_id,)
            ).fetchall()
            for d in ai_decisions:
                run_decision(db, d["id"])
            for b in buyers[:count]:
                join(db, b, group_id, CONTEXT, terms_for(db, group_id))
            db.commit()
            rows = members(db, group_id)
            for c in rows:
                perform(db, c, "order", scenario)
                c = db.execute(
                    "SELECT c.*,g.run_id FROM commitments c JOIN groups g ON g.id=c.group_id WHERE c.id=%s",
                    (c["id"],),
                ).fetchone()
                perform(db, c, "authorize", scenario)
            return group_id, buyers[:count]

    def test_success_replay_and_refresh(self):
        group_id, buyers = self.prepare()
        with connect() as db:
            lock_group(db, group_id)
            db.execute(
                "UPDATE groups SET status='OPEN',activated=true,deadline=now()+interval '90 seconds' WHERE id=%s",
                (group_id,),
            )
            db.commit()
            tick(db, group_id)
            tick(db, group_id)
            self.assertEqual(snapshot(db, buyers[-1])["group"]["status"], "SUCCEEDED")
            self.assertEqual(snapshot(db, buyers[-1])["completed_captures"], 5)
            self.assertEqual(snapshot(db, buyers[-1])["ordinary_price_minor"], 8000)
            progress = snapshot(db, buyers[-1])
            self.assertEqual(
                [m["position"] for m in progress["members"]], [1, 2, 3, 4, 5]
            )
            self.assertEqual(sum(m["is_you"] for m in progress["members"]), 1)
            self.assertTrue(
                all(m["capture_status"] == "COMPLETED" for m in progress["members"])
            )
            self.assertFalse(progress["authorization_pending"])
            for member in progress["members"]:
                self.assertFalse(
                    {"buyer_id", "id", "authorization_id", "capture_id", "order_id"}
                    & member.keys()
                )
            captures = db.execute(
                "SELECT count(*) AS n FROM payment_operations p JOIN commitments c ON c.id=p.commitment_id WHERE c.group_id=%s AND kind='capture'",
                (group_id,),
            ).fetchone()["n"]
            self.assertEqual(captures, 5)

    def test_deadline_voids_holds(self):
        gid, _ = self.prepare(count=4)
        with connect() as db:
            db.execute(
                "UPDATE groups SET status='OPEN',activated=true,deadline=now()-interval '1 second' WHERE id=%s",
                (gid,),
            )
            db.commit()
            tick(db, gid)
            self.assertEqual(
                db.execute("SELECT status FROM groups WHERE id=%s", (gid,)).fetchone()[
                    "status"
                ],
                "FAILED",
            )
            self.assertTrue(
                all(
                    c["void_status"] == "VOIDED" and c["capture_id"] is None
                    for c in members(db, gid)
                )
            )

    def test_partial_capture_compensates_and_pending_refund_is_not_complete(self):
        for scenario in ("partial", "refund_pending"):
            gid, _ = self.prepare(scenario)
            with connect() as db:
                db.execute(
                    "UPDATE groups SET status='OPEN',activated=true,deadline=now()+interval '90 seconds' WHERE id=%s",
                    (gid,),
                )
                db.commit()
                tick(db, gid)
                tick(db, gid)
                rows = members(db, gid)
                self.assertEqual(
                    sum(c["capture_status"] == "COMPLETED" for c in rows), 4
                )
                self.assertEqual(sum(c["void_status"] == "VOIDED" for c in rows), 1)
                self.assertEqual(
                    sum(
                        c["refund_status"]
                        == ("PENDING" if scenario == "refund_pending" else "COMPLETED")
                        for c in rows
                    ),
                    4,
                )
                self.assertEqual(
                    db.execute(
                        "SELECT status FROM groups WHERE id=%s", (gid,)
                    ).fetchone()["status"],
                    "UNWINDING" if scenario == "refund_pending" else "FAILED",
                )

    def test_concurrent_join_and_close_preserve_capacity(self):
        from psycopg.types.json import Jsonb

        gid, buyers = self.prepare(count=4)
        with connect() as db:
            db.execute(
                "UPDATE groups SET status='OPEN',activated=true,deadline=now()+interval '90 seconds' WHERE id=%s",
                (gid,),
            )
            extra = []
            for i in range(4):
                b = {**buyers[0], "id": uuid4()}
                extra.append(b)
                db.execute(
                    "INSERT INTO buyers(id,run_id,name,persona) VALUES(%s,%s,%s,%s)",
                    (b["id"], b["run_id"], f"Judge{i}", Jsonb(b["persona"])),
                )
                db.execute(
                    "INSERT INTO ai_decisions(id,buyer_id,group_id,mode,status,result) VALUES(%s,%s,%s,'fixture','completed',%s)",
                    (uuid4(), b["id"], gid, Jsonb(decide(b["persona"], TERMS))),
                )

        def attempt(b):
            try:
                with connect() as db:
                    join(db, b, gid, CONTEXT, terms_for(db, gid))
                return True
            except HTTPException:
                return False

        with ThreadPoolExecutor(max_workers=4) as pool:
            self.assertEqual(sum(pool.map(attempt, extra)), 1)
        with connect() as db:
            lock_group(db, gid)
            db.execute(
                "UPDATE groups SET deadline=now()-interval '1 second' WHERE id=%s",
                (gid,),
            )
            db.commit()
            tick(db, gid)
            self.assertEqual(len(members(db, gid)), 5)
            self.assertEqual(
                db.execute("SELECT status FROM groups WHERE id=%s", (gid,)).fetchone()[
                    "status"
                ],
                "FAILED",
            )

    def test_long_transaction_cannot_join_after_deadline(self):
        gid, _ = self.prepare(count=3)
        with connect() as db:
            db.execute("SELECT now()")  # Start the buyer transaction before expiry.
            judge = db.execute(
                "SELECT b.* FROM buyers b JOIN groups g ON g.run_id=b.run_id WHERE g.id=%s AND b.name!='Sam' AND NOT EXISTS (SELECT 1 FROM commitments c WHERE c.buyer_id=b.id)",
                (gid,),
            ).fetchone()
            with connect() as operator_db:
                operator_db.execute(
                    "UPDATE groups SET status='OPEN',activated=true,deadline=clock_timestamp() WHERE id=%s",
                    (gid,),
                )
            with self.assertRaises(HTTPException) as rejection:
                join(db, judge, gid, CONTEXT, terms_for(db, gid))
            self.assertEqual(rejection.exception.status_code, 409)
            self.assertEqual(len(members(db, gid)), 3)

    def test_join_racing_deadline_closure_never_captures(self):
        from threading import Barrier

        from psycopg.types.json import Jsonb

        gid, buyers = self.prepare(count=4)
        judge = {**buyers[0], "id": uuid4()}
        with connect() as db:
            db.execute(
                "UPDATE groups SET status='OPEN',activated=true,deadline=now()+interval '90 seconds' WHERE id=%s",
                (gid,),
            )
            db.execute(
                "INSERT INTO buyers(id,run_id,name,persona) VALUES(%s,%s,'Judge',%s)",
                (judge["id"], judge["run_id"], Jsonb(judge["persona"])),
            )
            db.execute(
                "INSERT INTO ai_decisions(id,buyer_id,group_id,mode,status,result) VALUES(%s,%s,%s,'fixture','completed',%s)",
                (uuid4(), judge["id"], gid, Jsonb(decide(judge["persona"], TERMS))),
            )
        start = Barrier(2, timeout=5)

        def joining():
            start.wait()
            try:
                with connect() as db:
                    join(db, judge, gid, CONTEXT, terms_for(db, gid))
                return True
            except HTTPException as exc:
                self.assertEqual(exc.status_code, 409)
                return False

        def closing():
            start.wait()
            with connect() as db:
                lock_group(db, gid)
                db.execute(
                    "UPDATE groups SET deadline=now()-interval '1 second' WHERE id=%s",
                    (gid,),
                )
                db.commit()
                tick(db, gid)

        with ThreadPoolExecutor(max_workers=2) as pool:
            joined, closed = pool.submit(joining), pool.submit(closing)
            admitted = joined.result(timeout=10)
            closed.result(timeout=10)
        with connect() as db:
            rows = members(db, gid)
            self.assertEqual(len(rows), 4 + int(admitted))
            self.assertTrue(all(c["capture_id"] is None for c in rows))
            self.assertEqual(sum(c["void_status"] == "VOIDED" for c in rows), 4)
            self.assertEqual(snapshot(db, buyers[0])["group"]["status"], "FAILED")
            self.assertTrue(all(safe_terminal(db, c) for c in rows))

    def test_unknown_capture_and_late_completion(self):
        gid, _ = self.prepare(count=4)
        with connect() as db:
            c = members(db, gid)[0]
            db.execute("UPDATE groups SET status='UNWINDING' WHERE id=%s", (gid,))
            db.execute(
                "INSERT INTO payment_operations(id,commitment_id,kind,status) VALUES(%s,%s,'capture','unknown')",
                (uuid4(), c["id"]),
            )
            db.commit()
            self.assertFalse(safe_terminal(db, c))
            observe(
                db,
                c,
                "capture",
                {
                    "id": "late-" + str(c["id"]),
                    "status": "COMPLETED",
                    "amount": {"currency_code": "USD", "value": "65.00"},
                },
            )
            db.commit()
            tick(db, gid)
            refreshed = db.execute(
                "SELECT * FROM commitments WHERE id=%s", (c["id"],)
            ).fetchone()
            self.assertEqual(refreshed["refund_status"], "COMPLETED")
            self.assertTrue(safe_terminal(db, refreshed))

    def test_webhook_evidence_isolated_and_unknown_events_retained(self):
        from coalition.main import evidence
        from coalition.worker import handle
        from psycopg.types.json import Jsonb

        gid, _ = self.prepare(count=1)
        other_gid, _ = self.prepare(count=1)
        with connect() as db:
            run_id = db.execute(
                "SELECT run_id FROM groups WHERE id=%s", (gid,)
            ).fetchone()["run_id"]
            other_run_id = db.execute(
                "SELECT run_id FROM groups WHERE id=%s", (other_gid,)
            ).fetchone()["run_id"]
            authorization_id = members(db, gid)[0]["authorization_id"]
            matched, unknown = "matched-" + uuid4().hex, "unknown-" + uuid4().hex
            for event_id, resource_id in (
                (matched, authorization_id),
                (unknown, "unknown-provider-id"),
            ):
                db.execute(
                    "INSERT INTO webhook_events(id,payload,verified) VALUES(%s,%s,true)",
                    (
                        event_id,
                        Jsonb(
                            {
                                "id": event_id,
                                "event_type": "PAYMENT.AUTHORIZATION.CREATED",
                                "resource": {"id": resource_id},
                            }
                        ),
                    ),
                )
                db.commit()
                handle(db, {"kind": "event", "payload": {"event_id": event_id}})
            # A replay retains correlation without creating another receipt.
            handle(db, {"kind": "event", "payload": {"event_id": matched}})
            retained = db.execute(
                "SELECT * FROM webhook_events WHERE id=%s", (unknown,)
            ).fetchone()
            self.assertIsNone(retained["group_id"])
            self.assertIsNotNone(retained["processed_at"])
        receipts = evidence(run_id)["events"]
        self.assertEqual([e["id"] for e in receipts], [matched])
        self.assertEqual(str(receipts[0]["group_id"]), str(gid))
        self.assertIsNotNone(receipts[0]["processed_at"])
        self.assertEqual(evidence(other_run_id)["events"], [])

    def test_worker_lease_reclaim_and_event_dedupe(self):
        from coalition.worker import claim
        from psycopg.types.json import Jsonb

        with connect() as db:
            event = "test-" + uuid4().hex
            for _ in range(2):
                db.execute(
                    "INSERT INTO webhook_events(id,payload,verified) VALUES(%s,%s,true) ON CONFLICT DO NOTHING",
                    (event, Jsonb({"id": event})),
                )
            self.assertEqual(
                db.execute(
                    "SELECT count(*) AS n FROM webhook_events WHERE id=%s", (event,)
                ).fetchone()["n"],
                1,
            )
            db.execute("UPDATE jobs SET status='done'")
            job = db.execute(
                "INSERT INTO jobs(mode,kind,payload,dedupe_key,status,lease_until) VALUES('fixture','ai','{}',%s,'running',now()-interval '1 second') RETURNING id",
                ("lease-" + event,),
            ).fetchone()
            db.commit()
            claimed = claim(db)
            self.assertEqual(claimed["id"], job["id"])
            self.assertIsNotNone(claimed["lease_token"])
