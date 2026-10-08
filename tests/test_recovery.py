"""Deterministic provider doubles. These tests never connect to PayPal or prove sandbox approval."""

import copy
import os
import unittest
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier, Event
from unittest.mock import patch
from uuid import uuid4

import httpx
import test_coalition as baseline
from coalition.config import settings
from coalition.db import connect, enqueue
from coalition.groups import (
    admit,
    freeze,
    join,
    lock_group,
    members,
    safe_terminal,
    snapshot,
    unwind,
    withdraw,
)
from coalition.groups import (
    tick as scheduled_tick,
)
from coalition.offers import terms_for
from coalition.payments import ProviderError, RecoveryRequired, perform
from fastapi import HTTPException
from legacy_fixtures import create_run


def tick(db, gid):
    # Advance the reconciliation due time; these tests change provider state
    # immediately rather than waiting through the application's backoff.
    db.execute("UPDATE commitments SET reconcile_after=NULL WHERE group_id=%s", (gid,))
    db.commit()
    return scheduled_tick(db, gid)


class Remote:
    def __init__(self):
        self.resources = {}
        self.orders = {}
        self.keys = {}
        self.posts = Counter()
        self.lost_capture = False
        self.pending_capture = False
        self.decline_fifth = False
        self.failed_refund = False
        self.hide_captures = False
        self.block_capture = None
        self.payer_override = None

    def __call__(self, method, path, body=None, key=None):
        if method == "GET":
            data = copy.deepcopy(self.resources[path])
            if self.hide_captures and "/checkout/orders/" in path:
                data["purchase_units"][0].get("payments", {}).pop("captures", None)
            return data
        self.posts[path] += 1
        if str(key) in self.keys:
            return copy.deepcopy(self.keys[str(key)])
        amount = {"currency_code": "USD", "value": "65.00"}
        if path == "/v2/checkout/orders":
            context = body["payment_source"]["paypal"]["experience_context"]
            assert "/checkout?run=" in context["return_url"]
            assert "/checkout?run=" in context["cancel_url"]
            oid = "order-" + uuid4().hex
            unit = {
                **body["purchase_units"][0],
                "payee": {"merchant_id": "merchant-test"},
            }
            result = {
                "id": oid,
                "intent": "AUTHORIZE",
                "status": "APPROVED",
                "payer": {"payer_id": self.payer_override or "payer-" + oid},
                "purchase_units": [unit],
                "links": [
                    {
                        "rel": "approve",
                        "href": "https://www.sandbox.paypal.com/checkoutnow?token="
                        + oid,
                    }
                ],
            }
            self.resources[path + "/" + oid] = result
            self.orders[oid] = result
        elif path.endswith("/authorize"):
            oid = path.split("/")[-2]
            aid = "auth-" + uuid4().hex
            auth = {
                "id": aid,
                "status": "CREATED",
                "amount": amount,
                "payee": {"merchant_id": "merchant-test"},
                "create_time": datetime.now(timezone.utc).isoformat(),
                "expiration_time": (
                    datetime.now(timezone.utc) + timedelta(days=29)
                ).isoformat(),
                "supplementary_data": {"related_ids": {"order_id": oid}},
            }
            self.resources["/v2/payments/authorizations/" + aid] = auth
            self.orders[oid]["purchase_units"][0]["payments"] = {
                "authorizations": [auth]
            }
            result = self.orders[oid]
        elif path.endswith("/capture"):
            if self.block_capture:
                entered, release = self.block_capture
                entered.set()
                assert release.wait(5)
            if (
                self.decline_fifth
                and sum(v for k, v in self.posts.items() if k.endswith("/capture")) == 5
            ):
                raise ProviderError("Injected test decline of fifth capture", True)
            aid = path.split("/")[-2]
            auth = self.resources["/v2/payments/authorizations/" + aid]
            oid = auth["supplementary_data"]["related_ids"]["order_id"]
            cid = "capture-" + uuid4().hex
            result = {
                "id": cid,
                "status": "PENDING" if self.pending_capture else "COMPLETED",
                "amount": amount,
                "payee": {"merchant_id": "merchant-test"},
                "supplementary_data": {
                    "related_ids": {"order_id": oid, "authorization_id": aid}
                },
            }
            self.resources["/v2/payments/captures/" + cid] = result
            self.orders[oid]["purchase_units"][0]["payments"]["captures"] = [result]
            auth["status"] = "CAPTURED"
            self.keys[str(key)] = copy.deepcopy(result)
            if self.lost_capture:
                self.lost_capture = False
                raise httpx.ReadTimeout("Injected response loss after remote success")
        elif path.endswith("/void"):
            aid = path.split("/")[-2]
            result = self.resources["/v2/payments/authorizations/" + aid]
            result["status"] = "VOIDED"
        elif path.endswith("/refund"):
            cid = path.split("/")[-2]
            rid = "refund-" + uuid4().hex
            result = {
                "id": rid,
                "status": "FAILED" if self.failed_refund else "COMPLETED",
                "amount": amount,
                "links": [
                    {
                        "rel": "up",
                        "href": "https://api-m.sandbox.paypal.com/v2/payments/captures/"
                        + cid,
                    }
                ],
            }
            self.resources["/v2/payments/refunds/" + rid] = result
        else:
            raise AssertionError(path)
        self.keys[str(key)] = copy.deepcopy(result)
        return copy.deepcopy(result)


@unittest.skipUnless(
    os.getenv("COALITION_TEST_DATABASE_URL"),
    "Requires disposable PostgreSQL test schema",
)
class RecoveryChecks(unittest.TestCase):
    setUpClass = classmethod(baseline.PostgreSQLChecks.setUpClass.__func__)
    tearDownClass = classmethod(baseline.PostgreSQLChecks.tearDownClass.__func__)
    prepare = baseline.PostgreSQLChecks.prepare

    def setUp(self):
        self.remote = Remote()
        self.mode = settings.mode
        self.merchant = settings.paypal_merchant_id
        object.__setattr__(settings, "mode", "connected")
        object.__setattr__(settings, "paypal_merchant_id", "merchant-test")
        self.provider = patch("coalition.payments.paypal", self.remote)
        self.provider.start()

    def tearDown(self):
        self.provider.stop()
        object.__setattr__(settings, "mode", self.mode)
        object.__setattr__(settings, "paypal_merchant_id", self.merchant)

    def group(self, count=5):

        with connect() as db:
            run = create_run(db, "success")
            gid = run["group_id"]
            buyers = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s ORDER BY name LIMIT %s",
                (run["run_id"], count),
            ).fetchall()
            terms = terms_for(db, gid)
            for b in buyers:
                c = join(db, b, gid, baseline.CONTEXT, terms)
                db.commit()
                perform(db, c, "order")
                perform(db, c, "authorize")
            db.execute(
                "UPDATE groups SET activated=true,deadline=now()+interval '90 seconds' WHERE id=%s",
                (gid,),
            )
            freeze(db, gid)
            return gid, buyers

    def state(self, gid):
        with connect() as db:
            return db.execute("SELECT * FROM groups WHERE id=%s", (gid,)).fetchone()

    def test_restart_after_remote_capture_success_never_duplicates_capture(self):
        gid, _ = self.group()
        self.remote.lost_capture = True
        with connect() as db:
            with self.assertRaises(httpx.ReadTimeout):
                tick(db, gid)
        with connect() as db:  # A new connection models a restarted worker.
            tick(db, gid)
            self.assertEqual(
                len(
                    [c for c in members(db, gid) if c["capture_status"] == "COMPLETED"]
                ),
                5,
            )
        self.assertEqual(self.state(gid)["status"], "SUCCEEDED")
        self.assertEqual(
            sum(v for k, v in self.remote.posts.items() if k.endswith("/capture")), 5
        )

    def test_queued_authorization_restores_without_confirming_a_buyer(self):
        gid, _ = self.group(count=0)
        with connect() as db:
            b = db.execute(
                "SELECT b.* FROM buyers b JOIN groups g ON g.run_id=b.run_id WHERE g.id=%s LIMIT 1",
                (gid,),
            ).fetchone()
            c = join(db, b, gid, baseline.CONTEXT, terms_for(db, gid))
            db.commit()
            perform(db, c, "order")
            enqueue(
                db,
                "authorize",
                {"commitment_id": str(c["id"]), "group_id": str(gid)},
                f"authorize:{c['id']}",
            )
        with connect() as db:
            restored = snapshot(db, b)
            self.assertTrue(restored["authorization_pending"])
            self.assertEqual(restored["confirmed_count"], 0)
            self.assertEqual(restored["members"], [])
            self.assertEqual(restored["commitment"]["id"], c["id"])

    def test_pending_capture_reconciles_before_any_new_action(self):
        gid, _ = self.group()
        self.remote.pending_capture = True
        with connect() as db:
            tick(db, gid)
            tick(db, gid)
        self.assertEqual(self.state(gid)["status"], "SETTLING")
        self.assertEqual(
            sum(v for k, v in self.remote.posts.items() if k.endswith("/capture")), 5
        )
        for path, data in self.remote.resources.items():
            if "/captures/" in path:
                data["status"] = "COMPLETED"
        with connect() as db:
            tick(db, gid)
        self.assertEqual(self.state(gid)["status"], "SUCCEEDED")

    def test_partial_capture_refunds_all_completed_and_voids_remaining(self):
        gid, _ = self.group()
        self.remote.decline_fifth = True
        with connect() as db:
            tick(db, gid)
            rows = members(db, gid)
            self.assertEqual(sum(c["refund_status"] == "COMPLETED" for c in rows), 4)
            self.assertEqual(sum(c["void_status"] == "VOIDED" for c in rows), 1)
        self.assertEqual(self.state(gid)["status"], "FAILED")
        self.assertEqual(self.state(gid)["inventory_reserved"], 0)

    def test_late_capture_during_unwind_is_refunded_never_new_captured(self):
        gid, _ = self.group()
        self.remote.lost_capture = True
        with connect() as db:
            with self.assertRaises(httpx.ReadTimeout):
                tick(db, gid)
            unwind(db, gid, "Injected failure of group settlement")
            db.commit()
        with connect() as db:
            tick(db, gid)
        self.assertEqual(self.state(gid)["status"], "FAILED")
        self.assertEqual(
            sum(v for k, v in self.remote.posts.items() if k.endswith("/capture")), 1
        )
        self.assertEqual(
            sum(v for k, v in self.remote.posts.items() if k.endswith("/refund")), 1
        )

    def test_refund_failure_escalates_without_declaring_cleanup_complete(self):
        gid, _ = self.group()
        self.remote.decline_fifth = True
        self.remote.failed_refund = True
        with connect() as db:
            tick(db, gid)
            with self.assertRaises(RecoveryRequired):
                tick(db, gid)
            self.assertFalse(all(safe_terminal(db, c) for c in members(db, gid)))
        self.assertEqual(self.state(gid)["status"], "UNWINDING")
        self.assertEqual(self.state(gid)["inventory_reserved"], 5)
        from coalition.worker import run_once

        with connect() as db:
            db.execute("UPDATE jobs SET status='done' WHERE mode='connected'")
            enqueue(db, "tick", {"group_id": gid}, "test-refund:" + gid)
        run_once()
        self.assertTrue(self.state(gid)["needs_attention"])
        self.assertEqual(self.state(gid)["status"], "UNWINDING")

    def test_expired_slot_late_authorization_is_tracked_and_voided(self):
        gid, buyers = self.group(count=1)
        with connect() as db:
            c = members(db, gid)[0]
            db.execute(
                "UPDATE commitments SET admitted=false,reservation_expires_at=now()-interval '1 second' WHERE id=%s",
                (c["id"],),
            )
            db.commit()
            admit(db, c["id"])
            db.commit()
            from coalition.worker import handle

            handle(
                db,
                {
                    "kind": "void",
                    "payload": {"commitment_id": str(c["id"]), "group_id": gid},
                },
            )
            c = members(db, gid)[0]
            self.assertFalse(c["admitted"])
            self.assertFalse(c["active"])
            self.assertEqual(c["void_status"], "VOIDED")

    def test_duplicate_payer_cannot_be_admitted_twice(self):
        self.remote.payer_override = "same-payer"
        gid, _ = self.group(count=2)
        with connect() as db:
            rows = members(db, gid)
            self.assertEqual(sum(c["admitted"] for c in rows), 1)
            self.assertEqual(sum(c["active"] for c in rows), 1)
            self.assertEqual(sum(bool(c["authorization_id"]) for c in rows), 2)

    def test_webhook_verification_provenance_and_duplicate_delivery(self):
        from coalition.payments import observe
        from coalition.worker import handle_event
        from psycopg.types.json import Jsonb

        gid, _ = self.group(count=1)
        with connect() as db:
            c = members(db, gid)[0]
        auth = self.remote.resources[
            "/v2/payments/authorizations/" + c["authorization_id"]
        ]
        auth["status"] = "VOIDED"
        auth["links"] = [
            {
                "rel": "self",
                "href": "https://api-m.sandbox.paypal.com/v2/payments/authorizations/"
                + c["authorization_id"],
            }
        ]
        with connect() as db:
            for verified in (False, True):
                event_id = "TEST-EVENT-" + uuid4().hex
                payload = {
                    "id": event_id,
                    "event_type": "PAYMENT.AUTHORIZATION.VOIDED",
                    "resource": auth,
                }
                db.execute(
                    "INSERT INTO webhook_events(id,payload,verified) VALUES(%s,%s,false)",
                    (event_id, Jsonb(payload)),
                )
                db.commit()
                with (
                    patch("coalition.worker.verify_webhook", return_value=verified),
                    patch("coalition.worker.paypal", self.remote),
                ):
                    handle_event(db, event_id)
                    handle_event(db, event_id)
                current = members(db, gid)[0]
                self.assertEqual(
                    current["authorization_status"], "VOIDED" if verified else "CREATED"
                )
                self.assertEqual(current["active"], not verified)
                self.assertEqual(current["admitted"], not verified)
            receipts = db.execute(
                "SELECT * FROM payment_observations WHERE commitment_id=%s AND source='webhook'",
                (c["id"],),
            ).fetchall()
            self.assertEqual(len(receipts), 2)
            self.assertEqual({r["kind"] for r in receipts}, {"authorize", "void"})
            self.assertTrue(all(r["event_id"] == event_id for r in receipts))
            # An authenticated but stale authorization observation cannot reopen a void.
            observe(db, current, "authorize", {**auth, "status": "CREATED"}, "api")
            self.assertEqual(members(db, gid)[0]["authorization_status"], "VOIDED")

    def test_retired_assistant_cannot_create_work_and_legacy_checkout_still_recovers(
        self,
    ):
        from dataclasses import replace

        from coalition.demo import digest
        from coalition.main import app
        from fastapi.testclient import TestClient

        gid, _ = self.group(count=0)
        with connect() as db:
            b = db.execute(
                "SELECT b.* FROM buyers b JOIN groups g ON g.run_id=b.run_id WHERE g.id=%s LIMIT 1",
                (gid,),
            ).fetchone()
            db.execute(
                "INSERT INTO sessions(token_hash,buyer_id) VALUES(%s,%s)",
                (digest("ordinary"), b["id"]),
            )
            terms = terms_for(db, gid)
        with (
            patch("coalition.main.settings", replace(settings, llm_api_key="")),
            TestClient(app) as client,
        ):
            client.cookies.set("coalition_session", "ordinary")
            headers = {"X-Coalition-Request": "1", "Origin": settings.public_url}
            self.assertIn(
                client.post(
                    "/api/assistant",
                    json={"request_text": "Under $70"},
                    headers=headers,
                ).status_code,
                (404, 405),
            )
            result = client.post(
                "/api/commitments",
                json={
                    "group_id": gid,
                    "accepted_terms": terms,
                    "context": baseline.CONTEXT.model_dump(),
                },
                headers=headers,
            )
            self.assertEqual(result.status_code, 200)
            self.assertEqual(set(result.json()), {"id", "amount_minor", "currency"})
            with connect() as db:
                self.assertIsNone(
                    db.execute(
                        "SELECT authorization_id FROM commitments WHERE id=%s",
                        (result.json()["id"],),
                    ).fetchone()["authorization_id"]
                )

    def test_missing_model_key_finishes_ai_jobs_without_blocking_payment_jobs(self):
        from dataclasses import replace

        from coalition.worker import run_once

        with connect() as db:
            db.execute("UPDATE jobs SET status='done' WHERE mode='connected'")
        # Model jobs created before disabling AI remain tracked and finish safely.
        with patch(
            "legacy_fixtures.settings", replace(settings, llm_api_key="configured")
        ):
            gid, _ = self.group(count=0)
        with (
            patch("coalition.assistant.settings", replace(settings, llm_api_key="")),
            patch("coalition.assistant.decide") as model,
            patch("coalition.worker.log.error") as errors,
        ):
            for _ in range(5):
                self.assertTrue(run_once())
            model.assert_not_called()
            errors.assert_not_called()
        with connect() as db:
            decisions = db.execute(
                "SELECT status,result,error FROM ai_decisions WHERE group_id=%s", (gid,)
            ).fetchall()
            self.assertEqual(len(decisions), 5)
            for decision in decisions:
                self.assertEqual(decision["status"], "failed")
                self.assertIsNone(decision["result"])
                self.assertIn("LLM_API_KEY is missing", decision["error"])
            jobs = db.execute(
                "SELECT status,error FROM jobs WHERE payload->>'decision_id' IN (SELECT id::text FROM ai_decisions WHERE group_id=%s)",
                (gid,),
            ).fetchall()
            self.assertTrue(
                all(j["status"] == "done" and j["error"] is None for j in jobs)
            )
        self.assertTrue(run_once())  # The following group deadline job still runs.
        self.assertFalse(self.state(gid)["needs_attention"])

    def test_blank_model_key_publishes_payment_demo_without_ai_jobs(self):
        from dataclasses import replace

        with patch("legacy_fixtures.settings", replace(settings, llm_api_key="")):
            gid, _ = self.group(count=0)
        with connect() as db:
            buyers = db.execute(
                "SELECT b.id FROM buyers b JOIN groups g ON g.run_id=b.run_id WHERE g.id=%s",
                (gid,),
            ).fetchall()
            self.assertEqual(len(buyers), 5)
            decisions = db.execute(
                "SELECT id FROM ai_decisions WHERE group_id=%s", (gid,)
            ).fetchall()
            self.assertEqual(decisions, [])
            jobs = db.execute(
                "SELECT kind FROM jobs WHERE payload->>'group_id'=%s OR payload->>'decision_id' IN (SELECT id::text FROM ai_decisions WHERE group_id=%s)",
                (gid, gid),
            ).fetchall()
            self.assertEqual([j["kind"] for j in jobs], ["tick"])
            self.assertEqual(self.state(gid)["inventory_reserved"], 5)

    def test_provider_timing_amount_and_merchant_checked_before_capture(self):
        for field, value in [
            (
                "expiration_time",
                (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat(),
            ),
            ("amount", {"currency_code": "EUR", "value": "65.00"}),
            ("payee", {"merchant_id": "wrong-merchant"}),
        ]:
            gid, _ = self.group()
            with connect() as db:
                auth_id = members(db, gid)[0]["authorization_id"]
            data = self.remote.resources["/v2/payments/authorizations/" + auth_id]
            data[field] = value
            before = sum(
                v for k, v in self.remote.posts.items() if k.endswith("/capture")
            )
            with connect() as db:
                try:
                    tick(db, gid)
                except RecoveryRequired:
                    pass
            self.assertEqual(
                before,
                sum(v for k, v in self.remote.posts.items() if k.endswith("/capture")),
            )

    def test_no_group_row_lock_is_held_during_capture(self):
        gid, buyers = self.group()
        entered, release = Event(), Event()
        self.remote.block_capture = (entered, release)

        def capturing():
            with connect() as db:
                tick(db, gid)

        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(capturing)
            self.assertTrue(entered.wait(5))
            try:
                with connect() as db:
                    db.execute("SET LOCAL lock_timeout='300ms'")
                    lock_group(db, gid)
                    with self.assertRaises(HTTPException) as rejection:
                        withdraw(db, buyers[0]["id"], members(db, gid)[0]["id"])
                    self.assertEqual(rejection.exception.status_code, 409)
                from coalition.main import cleanup

                with self.assertRaises(HTTPException) as cleanup_rejected:
                    cleanup(buyers[0]["run_id"])
                self.assertEqual(cleanup_rejected.exception.status_code, 409)
            finally:
                release.set()
            future.result(timeout=10)

    def test_immutable_offer_commitment_inventory_and_one_active_group(self):
        import psycopg

        gid, _ = self.group(count=1)
        with connect() as db:
            c = members(db, gid)[0]
            offer = terms_for(db, gid)
            for sql, args in [
                (
                    "UPDATE offers SET price_minor=6600 WHERE id=%s",
                    (offer["offer_id"],),
                ),
                ("UPDATE commitments SET accepted_terms='{}' WHERE id=%s", (c["id"],)),
                ("UPDATE groups SET inventory_reserved=0 WHERE id=%s", (gid,)),
            ]:
                with self.assertRaises(psycopg.Error):
                    with db.transaction():
                        db.execute(sql, args)
            run_id = uuid4()
            db.execute(
                "INSERT INTO runs(id,mode,scenario) VALUES(%s,'connected','success')",
                (run_id,),
            )
            with self.assertRaises(psycopg.errors.UniqueViolation):
                with db.transaction():
                    db.execute(
                        "INSERT INTO groups(id,run_id,offer_id) VALUES(%s,%s,%s)",
                        (uuid4(), run_id, offer["offer_id"]),
                    )

    def test_duplicate_commands_owner_csrf_and_wrong_order(self):
        from coalition.demo import digest
        from coalition.main import app
        from fastapi.testclient import TestClient

        gid, buyers = self.group(count=1)
        with connect() as db:
            c = members(db, gid)[0]
            db.execute(
                "INSERT INTO sessions(token_hash,buyer_id) VALUES(%s,%s)",
                (digest("owner"), buyers[0]["id"]),
            )
            stranger = db.execute(
                "SELECT id FROM buyers WHERE run_id=%s AND id!=%s LIMIT 1",
                (buyers[0]["run_id"], buyers[0]["id"]),
            ).fetchone()
            db.execute(
                "INSERT INTO sessions(token_hash,buyer_id) VALUES(%s,%s)",
                (digest("stranger"), stranger["id"]),
            )
        headers = {"X-Coalition-Request": "1", "Origin": settings.public_url}
        with TestClient(app) as client:
            client.cookies.set("coalition_session", "stranger")
            stranger_state = client.get(
                f"/api/status?run={buyers[0]['run_id']}&commitment={c['id']}"
            ).json()
            self.assertIsNone(stranger_state["commitment"])
            self.assertFalse(any(m["is_you"] for m in stranger_state["members"]))
            self.assertEqual(
                client.post(
                    f"/api/commitments/{c['id']}/authorize",
                    json={"order_id": c["order_id"]},
                    headers=headers,
                ).status_code,
                404,
            )
            self.assertEqual(
                client.post(
                    f"/api/commitments/{c['id']}/leave", json={}, headers=headers
                ).status_code,
                404,
            )
            client.cookies.set("coalition_session", "owner")
            self.assertEqual(
                client.post(f"/api/commitments/{c['id']}/leave", json={}).status_code,
                403,
            )
            self.assertEqual(
                client.post(
                    f"/api/commitments/{c['id']}/authorize",
                    json={"order_id": "someone-elses-order"},
                    headers=headers,
                ).status_code,
                409,
            )
            for _ in range(2):
                result = client.post(
                    "/api/commitments",
                    json={
                        "group_id": gid,
                        "accepted_terms": c["accepted_terms"],
                        "context": baseline.CONTEXT.model_dump(),
                    },
                    headers=headers,
                )
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json()["id"], str(c["id"]))

    def test_withdrawal_racing_fifth_authorization_has_one_result(self):
        gid, buyers = self.group(count=4)
        with connect() as db:
            fifth = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s AND id NOT IN (SELECT buyer_id FROM commitments WHERE group_id=%s)",
                (buyers[0]["run_id"], gid),
            ).fetchone()
            c = join(db, fifth, gid, baseline.CONTEXT, terms_for(db, gid))
            db.commit()
            perform(db, c, "order")
            first = members(db, gid)[0]
        start = Barrier(2, timeout=5)

        def approving():
            start.wait()
            with connect() as db:
                perform(db, c, "authorize")

        def leaving():
            start.wait()
            try:
                with connect() as db:
                    withdraw(db, first["buyer_id"], first["id"])
                return True
            except HTTPException as exc:
                self.assertEqual(exc.status_code, 409)
                return False

        with ThreadPoolExecutor(max_workers=2) as pool:
            a, b = pool.submit(approving), pool.submit(leaving)
            a.result(timeout=10)
            left = b.result(timeout=10)
        self.assertEqual(self.state(gid)["status"], "OPEN" if left else "SETTLING")
        with connect() as db:
            self.assertEqual(
                sum(c["locked"] for c in members(db, gid)), 0 if left else 5
            )
