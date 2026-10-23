"""Real PostgreSQL, mocked PayPal: CI contracts, never G1 evidence.

Requires RALLY_TEST_DATABASE_URL. Uses and removes only its own random test schema.
"""

import copy
import importlib.util
import io
import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stdout
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event
from unittest.mock import patch
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
from rally import db as database
from rally import worker
from rally.payments import ledger, paypal, webhooks


@unittest.skipUnless(
    os.getenv("RALLY_TEST_DATABASE_URL"),
    "Requires explicitly disposable PostgreSQL URL",
)
class DatabaseContracts(unittest.TestCase):
    def setUp(self):
        self.schema = "rally_test_" + uuid4().hex
        self.url = os.environ["RALLY_TEST_DATABASE_URL"]
        self.config = replace(
            database.settings,
            database_url=self.url,
            database_schema=self.schema,
            paypal_merchant_id="MERCHANT-TEST",
        )
        self.settings_patch = patch.object(database, "settings", self.config)
        self.settings_patch.start()
        self.ledger_patch = patch.object(ledger, "settings", self.config)
        self.ledger_patch.start()
        try:
            database.init_db()
            self.seed_run()
        except Exception:
            self.settings_patch.stop()
            self.ledger_patch.stop()
            raise

    def tearDown(self):
        try:
            assert self.schema.startswith("rally_test_") and len(self.schema) == 43
            with psycopg.connect(self.url) as connection:
                connection.execute(
                    sql.SQL("DROP SCHEMA {} CASCADE").format(
                        sql.Identifier(self.schema)
                    )
                )
        finally:
            self.settings_patch.stop()
            self.ledger_patch.stop()

    def seed_run(self):
        self.pool, self.member = uuid4(), uuid4()
        with database.connect() as db:
            self.seed(db, self.pool, self.member)

    def seed(self, db, pool, member):
        shop = "shop-" + str(pool)
        db.execute(
            "INSERT INTO shops VALUES(%s,'Haneul Beauty','KR','shop@example.test')",
            (shop,),
        )
        db.execute(
            "INSERT INTO pools(id,shop_id,organizer_id,lock_at,ship_by,deliver_to) VALUES(%s,%s,'test',now()+interval '1 hour',now()+interval '7 days',%s)",
            (pool, shop, Jsonb({})),
        )
        db.execute(
            "INSERT INTO members(id,pool_id,display_name,raw_text,max_cents) VALUES(%s,%s,'Capture check','test',200)",
            (member, pool),
        )

    def test_migration_repeat_is_safe_and_constraints_enforce_money(self):
        database.init_db()
        with database.connect() as db:
            self.assertEqual(
                db.execute("SELECT count(*) AS n FROM schema_migrations").fetchone()[
                    "n"
                ],
                2,
            )
            with self.assertRaises(psycopg.errors.CheckViolation):
                db.execute(
                    "UPDATE members SET max_cents=-1 WHERE id=%s", (self.member,)
                )
            db.rollback()
            self.assertEqual(
                db.execute(
                    "SELECT max_cents FROM members WHERE id=%s", (self.member,)
                ).fetchone()["max_cents"],
                200,
            )
            hold = uuid4()
            self.assertEqual(
                db.execute(
                    "INSERT INTO holds(id,member_id,order_id,amount_cents,status) VALUES(%s,%s,'ORDER-MIGRATION',200,'CREATED') RETURNING currency",
                    (hold, self.member),
                ).fetchone()["currency"],
                "USD",
            )
            db.execute("UPDATE holds SET currency='CAD' WHERE id=%s", (hold,))
            db.commit()
            with self.assertRaises(psycopg.errors.CheckViolation):
                db.execute("UPDATE holds SET currency='JPY' WHERE id=%s", (hold,))
            db.rollback()
            self.assertEqual(
                db.execute(
                    "SELECT currency FROM holds WHERE id=%s", (hold,)
                ).fetchone()["currency"],
                "CAD",
            )

    def test_job_claim_has_one_lane_and_excludes_active_lease(self):
        unique = uuid4().hex
        with database.connect() as db:
            database.enqueue(db, "test", {"x": unique}, unique)
            database.enqueue(db, "test", {"x": unique}, unique)
            db.commit()
            claimed = worker.claim(db)
            self.assertEqual(claimed["payload"]["x"], unique)
            self.assertEqual(claimed["attempts"], 1)
            self.assertIsNone(worker.claim(db))

    def test_sandbox_start_bootstraps_missing_tables_and_preserves_retry_identity(self):
        assert self.schema.startswith("rally_test_") and len(self.schema) == 43
        with psycopg.connect(self.url) as connection:
            connection.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema))
            )
            connection.execute(
                sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema))
            )
        spec = importlib.util.spec_from_file_location(
            "sandbox_bootstrap", Path(__file__).parents[1] / "scripts/paypal_sandbox.py"
        )
        script = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(script)
        run_id = uuid4()
        args = [
            "--run",
            str(run_id),
            "start",
            "--return-url",
            "https://shop.test/shop",
            "--cancel-url",
            "https://shop.test/bag",
        ]

        def provider(method, path, body=None, **kwargs):
            self.assertEqual((method, path), ("POST", "/v2/checkout/orders"))
            return {
                "id": "ORDER-BOOTSTRAP",
                "status": "CREATED",
                "intent": "AUTHORIZE",
                "purchase_units": [
                    {
                        **body["purchase_units"][0],
                        "payee": {"merchant_id": "MERCHANT-TEST"},
                    }
                ],
                "links": [
                    {
                        "rel": "approve",
                        "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-BOOTSTRAP",
                    }
                ],
            }

        with (
            patch.dict(
                os.environ,
                {
                    **{name: "set" for name in script.PAYPAL_ENV},
                    "PAYPAL_SHOP_EMAIL": "shop@example.test",
                },
            ),
            patch("rally.config.settings", self.config),
            patch.object(ledger, "paypal", side_effect=provider) as transport,
            redirect_stdout(io.StringIO()),
        ):
            script.main(args)
            script.main(args)
            self.assertEqual(transport.call_count, 1)
            with database.connect() as db:
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) AS n FROM schema_migrations"
                    ).fetchone()["n"],
                    2,
                )
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) AS n FROM members WHERE pool_id=%s", (run_id,)
                    ).fetchone()["n"],
                    2,
                )
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) AS n FROM payment_ops WHERE pool_id=%s",
                        (run_id,),
                    ).fetchone()["n"],
                    1,
                )
                db.execute(
                    "UPDATE payment_ops SET status='unknown' WHERE request_id=%s",
                    (script.key(run_id, "order"),),
                )
            with self.assertRaisesRegex(
                paypal.RecoveryRequired, "needs reconciliation"
            ):
                script.main(args)
            self.assertEqual(transport.call_count, 1)

    def test_concurrent_capture_claims_leave_no_database_lock_during_network(self):
        entered, release = Event(), Event()
        with database.connect() as db:
            db.execute(
                "INSERT INTO holds(id,member_id,order_id,authorization_id,amount_cents,status,honor_until,expires_at) VALUES(%s,%s,'ORDER-C','AUTH-C',200,'AUTHORIZED',now()+interval '2 days',now()+interval '29 days')",
                (uuid4(), self.member),
            )
        pid = []
        mutations = []

        def provider(method, path, body=None, **kwargs):
            if method == "GET":
                entered.set()
                if not release.wait(3):
                    raise AssertionError("Concurrent capture test timed out")
                return {
                    "id": "AUTH-C",
                    "status": "CREATED",
                    "amount": paypal.money(200),
                }
            mutations.append(path)
            return {
                "id": "CAPTURE-C",
                "status": "COMPLETED",
                "amount": paypal.money(100),
                "final_capture": True,
            }

        def capture():
            with database.connect() as db:
                pid.append(
                    db.execute("SELECT pg_backend_pid() AS pid").fetchone()["pid"]
                )
                return ledger.perform(
                    db,
                    "capture",
                    "concurrent-1",
                    pool_id=self.pool,
                    member_id=self.member,
                    resource_id="AUTH-C",
                    amount_cents=100,
                )

        with (
            patch.object(ledger, "paypal", side_effect=provider),
            ThreadPoolExecutor(max_workers=1) as pool,
        ):
            future = pool.submit(capture)
            try:
                self.assertTrue(entered.wait(3))
                with database.connect() as db:
                    self.assertEqual(
                        db.execute(
                            "SELECT count(*) AS n FROM pg_locks WHERE pid=%s AND locktype='advisory'",
                            (pid[0],),
                        ).fetchone()["n"],
                        0,
                    )
                    with self.assertRaisesRegex(paypal.RecoveryRequired, "Unresolved"):
                        ledger.perform(
                            db,
                            "capture",
                            "concurrent-2",
                            pool_id=self.pool,
                            member_id=self.member,
                            resource_id="AUTH-C",
                            amount_cents=100,
                        )
            finally:
                release.set()
            future.result(timeout=3)
        self.assertEqual(len(mutations), 1)

    def test_full_payment_lifecycle_and_webhook_deduplication(self):
        fixture = json.loads(
            (Path(__file__).parent / "fixtures/paypal_official.json").read_text()
        )["examples"]
        resources = {}
        mutations = []

        def provider(method, path, body=None, key=None, raw_json=None):
            if "verify-webhook-signature" in path:
                return {"verification_status": "SUCCESS"}
            if method == "GET":
                return copy.deepcopy(resources[path])
            mutations.append((path, key))
            if path == "/v2/checkout/orders":
                ref = "ORDER-" + str(len(mutations))
                data = {
                    "id": ref,
                    "intent": "AUTHORIZE",
                    "status": "APPROVED",
                    "purchase_units": copy.deepcopy(body["purchase_units"]),
                }
                data["purchase_units"][0]["payee"] = {"merchant_id": "MERCHANT-TEST"}
                resources[paypal.resource_path("order", ref)] = data
            elif path.endswith("/authorize"):
                order = resources[path.removesuffix("/authorize")]
                ref = "AUTH-" + order["id"]
                auth = copy.deepcopy(fixture["authorization"])
                auth.update(
                    id=ref,
                    amount=order["purchase_units"][0]["amount"],
                    create_time=datetime.now(timezone.utc).isoformat(),
                    expiration_time=(
                        datetime.now(timezone.utc) + timedelta(days=29)
                    ).isoformat(),
                    supplementary_data={"related_ids": {"order_id": order["id"]}},
                )
                resources[paypal.resource_path("authorize", ref)] = auth
                order["purchase_units"][0]["payments"] = {"authorizations": [auth]}
                data = order
            elif path.endswith("/capture"):
                auth = resources[path.removesuffix("/capture")]
                auth["status"] = "CAPTURED"
                data = copy.deepcopy(fixture["capture"])
                data.update(
                    id="CAPTURE-CAD"
                    if body["amount"]["currency_code"] == "CAD"
                    else "CAPTURE-TEST",
                    amount=body["amount"],
                    links=[
                        {
                            "rel": "up",
                            "href": paypal.BASE + path.removesuffix("/capture"),
                        }
                    ],
                )
                resources[paypal.resource_path("capture", data["id"])] = data
            elif path.endswith("/void"):
                resources[path.removesuffix("/void")]["status"] = "VOIDED"
                data = {"http_status": 204}
            elif path.endswith("/refund"):
                data = copy.deepcopy(fixture["refund"])
                data.update(
                    id="REFUND-TEST",
                    amount=body["amount"],
                    links=[
                        {
                            "rel": "up",
                            "href": paypal.BASE + path.removesuffix("/refund"),
                        }
                    ],
                )
                resources[path.removesuffix("/refund")]["status"] = "REFUNDED"
                resources[paypal.resource_path("refund", data["id"])] = data
            elif path == "/v1/payments/payouts":
                data = {
                    "batch_header": {
                        "payout_batch_id": "BATCH-TEST",
                        "batch_status": "SUCCESS",
                        "sender_batch_header": body["sender_batch_header"],
                    },
                    "items": [
                        {
                            "payout_item_id": "ITEM-TEST",
                            "transaction_status": "SUCCESS",
                            "payout_item": body["items"][0],
                        }
                    ],
                }
                resources[paypal.resource_path("payout", "BATCH-TEST")] = data
            else:
                raise AssertionError(path)
            return copy.deepcopy(data)

        second = uuid4()
        with database.connect() as db:
            db.execute(
                "INSERT INTO members(id,pool_id,display_name,raw_text,max_cents) VALUES(%s,%s,'Void check','test',200)",
                (second, self.pool),
            )
            db.commit()

            def perform(kind, step, member=self.member, **kwargs):
                return ledger.perform(
                    db,
                    kind,
                    f"g1:{self.pool}:{step}",
                    pool_id=self.pool,
                    member_id=member,
                    **kwargs,
                )

            with (
                patch.object(ledger, "paypal", side_effect=provider),
                patch.object(webhooks, "paypal", side_effect=provider),
                patch.object(
                    webhooks,
                    "settings",
                    replace(self.config, paypal_webhook_id="TEST-WEBHOOK"),
                ),
            ):
                order = perform("order", "order")
                auth = perform("authorize", "authorize", resource_id=order["id"])[
                    "purchase_units"
                ][0]["payments"]["authorizations"][0]["id"]
                perform("capture", "capture", resource_id=auth, amount_cents=100)
                perform("capture", "capture", resource_id=auth, amount_cents=100)
                other = perform("order", "void-order", second)
                void_auth = perform(
                    "authorize", "void-authorize", second, resource_id=other["id"]
                )["purchase_units"][0]["payments"]["authorizations"][0]["id"]
                perform("void", "void", second, resource_id=void_auth)
                perform(
                    "refund", "refund", resource_id="CAPTURE-TEST", amount_cents=100
                )
                db.execute(
                    "INSERT INTO shipments VALUES(%s,%s,'sandbox','tracking',now())",
                    (uuid4(), self.pool),
                )
                db.commit()
                perform("payout", "payout", None, amount_cents=50)
                event = {
                    "id": "WH-TEST",
                    "event_type": "PAYMENT.CAPTURE.COMPLETED",
                    "resource": {
                        "id": "CAPTURE-TEST",
                        "links": [
                            {
                                "rel": "self",
                                "href": paypal.BASE
                                + "/v2/payments/captures/CAPTURE-TEST",
                            }
                        ],
                    },
                }
                db.execute(
                    "UPDATE payment_ops SET provider_ref=NULL,status='unknown' WHERE pool_id=%s AND kind='capture'",
                    (self.pool,),
                )
                db.commit()
                headers = {name: "test" for name in webhooks.SIGNATURE_HEADERS.values()}
                webhooks.receive(db, headers, json.dumps(event).encode())
                row = db.execute(
                    "SELECT * FROM webhook_events WHERE event_id='WH-TEST'"
                ).fetchone()
                webhooks.process(db, row["id"])
                webhooks.receive(db, headers, json.dumps(event).encode())
                row = db.execute(
                    "SELECT * FROM webhook_events WHERE event_id='WH-TEST'"
                ).fetchone()
                self.assertTrue(row["verified"])
                self.assertIsNotNone(row["processed_at"])
                self.assertEqual(row["provider_ref"], "CAPTURE-TEST")
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) AS n FROM webhook_events WHERE event_id='WH-TEST'"
                    ).fetchone()["n"],
                    1,
                )
                self.assertEqual(
                    db.execute(
                        "SELECT count(*) AS n FROM jobs WHERE kind='webhook'"
                    ).fetchone()["n"],
                    1,
                )
                self.assertEqual(
                    sum(path.endswith("/capture") for path, _ in mutations), 1
                )
                self.assertEqual(len(mutations), len({key for _, key in mutations}))
                spec = importlib.util.spec_from_file_location(
                    "paypal_sandbox",
                    Path(__file__).parents[1] / "scripts/paypal_sandbox.py",
                )
                script = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(script)
                with patch("rally.payments.paypal.paypal", side_effect=provider):
                    evidence = script.verify_run(db, self.pool, require_cad=False)
                    with self.assertRaisesRegex(
                        RuntimeError, "Complete cad-order first"
                    ):
                        script.verify_run(db, self.pool)
                    cad_member = script.cad_member(db, self.pool)
                    self.assertEqual(script.cad_member(db, self.pool), cad_member)
                    script.members(db, self.pool)
                    cad_order = perform(
                        "order", "cad-order", cad_member, currency="CAD"
                    )
                    cad_auth = perform(
                        "authorize",
                        "cad-authorize",
                        cad_member,
                        resource_id=cad_order["id"],
                    )["purchase_units"][0]["payments"]["authorizations"][0]["id"]
                    perform(
                        "capture",
                        "cad-capture",
                        cad_member,
                        resource_id=cad_auth,
                        amount_cents=100,
                    )
                    evidence = script.verify_run(db, self.pool)
                    self.assertEqual(evidence["cad-capture"], "CAPTURE-CAD")
                    self.assertEqual(
                        db.execute(
                            "SELECT currency FROM holds WHERE member_id=%s",
                            (cad_member,),
                        ).fetchone()["currency"],
                        "CAD",
                    )
                self.assertEqual(evidence["webhooks"], ["WH-TEST"])

    def test_cad_authorization_webhook_uses_original_currency(self):
        with database.connect() as db:
            db.execute(
                "INSERT INTO payment_ops(id,kind,member_id,pool_id,request_id,status,provider_ref,request) VALUES(%s,'authorize',%s,%s,'cad-auth-test','completed','AUTH-CAD',%s)",
                (
                    uuid4(),
                    self.member,
                    self.pool,
                    Jsonb({"currency": "CAD", "amount_cents": 200}),
                ),
            )
        for currency in ("CAD", "USD"):
            event_id = "WH-CAD-" + currency
            event = {
                "id": event_id,
                "event_type": "PAYMENT.AUTHORIZATION.CREATED",
                "resource": {
                    "id": "AUTH-CAD",
                    "links": [
                        {
                            "rel": "self",
                            "href": paypal.BASE
                            + "/v2/payments/authorizations/AUTH-CAD",
                        }
                    ],
                },
            }
            with (
                database.connect() as db,
                patch.object(webhooks, "verify", return_value=True),
                patch.object(
                    webhooks,
                    "paypal",
                    return_value={
                        "id": "AUTH-CAD",
                        "status": "CREATED",
                        "amount": paypal.money(200, currency),
                    },
                ) as provider,
            ):
                webhooks.receive(db, {}, json.dumps(event).encode())
                row = db.execute(
                    "SELECT id FROM webhook_events WHERE event_id=%s", (event_id,)
                ).fetchone()
                if currency == "CAD":
                    webhooks.process(db, row["id"])
                else:
                    with self.assertRaisesRegex(
                        paypal.RecoveryRequired, "amount mismatch"
                    ):
                        webhooks.process(db, row["id"])
                observed = db.execute(
                    "SELECT processed_at,provider_ref FROM webhook_events WHERE id=%s",
                    (row["id"],),
                ).fetchone()
                self.assertEqual(
                    observed["processed_at"] is not None, currency == "CAD"
                )
                if currency == "CAD":
                    self.assertEqual(observed["provider_ref"], "AUTH-CAD")
                provider.assert_called_once_with(
                    "GET", "/v2/payments/authorizations/AUTH-CAD"
                )

    def test_corrected_payout_preserves_denial_and_ignores_late_old_batch(self):
        spec = importlib.util.spec_from_file_location(
            "sandbox_correction",
            Path(__file__).parents[1] / "scripts/paypal_sandbox.py",
        )
        script = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(script)
        run_id = uuid4()
        resources, mutations = {}, []

        def provider(method, path, body=None, **kwargs):
            if method == "GET":
                return copy.deepcopy(resources[path])
            self.assertEqual((method, path), ("POST", "/v1/payments/payouts"))
            mutations.append((kwargs["key"], copy.deepcopy(body)))
            number = len(mutations)
            data = {
                "batch_header": {
                    "payout_batch_id": "BATCH-" + str(number),
                    "batch_status": "DENIED" if number == 1 else "PENDING",
                    "sender_batch_header": body["sender_batch_header"],
                },
                "items": [
                    {
                        "transaction_status": "FAILED" if number == 1 else "PENDING",
                        "payout_item": body["items"][0],
                    }
                ],
            }
            resources["/v1/payments/payouts/BATCH-" + str(number)] = data
            return copy.deepcopy(data)

        with (
            database.connect() as db,
            patch.dict(os.environ, {"PAYPAL_SHOP_EMAIL": "sender@example.test"}),
            patch.object(ledger, "paypal", side_effect=provider),
        ):
            capture_member, _ = script.setup(db, run_id)
            db.execute(
                "INSERT INTO payment_ops(id,kind,member_id,pool_id,request_id,status,provider_ref,request) VALUES(%s,'refund',%s,%s,%s,'completed','REFUND-TEST',%s)",
                (
                    uuid4(),
                    capture_member,
                    run_id,
                    script.key(run_id, "refund"),
                    Jsonb({"amount_cents": 100}),
                ),
            )
            db.execute(
                "INSERT INTO shipments VALUES(%s,%s,'SANDBOX','TEST',now())",
                (uuid4(), run_id),
            )
            db.commit()
            ledger.perform(
                db,
                "payout",
                script.key(run_id, "payout"),
                pool_id=run_id,
                amount_cents=50,
            )
            original = ledger.operation(db, script.key(run_id, "payout"))
            with self.assertRaisesRegex(ValueError, "different sandbox business"):
                script.retry_payout(db, run_id)
            os.environ["PAYPAL_SHOP_EMAIL"] = "different-shop@example.test"
            script.retry_payout(db, run_id)
            correction_key = script.key(run_id, "payout-correction")
            correction = ledger.operation(db, correction_key)
            self.assertEqual(correction["status"], "pending")
            with self.assertRaisesRegex(
                paypal.RecoveryRequired, "needs reconciliation"
            ):
                script.retry_payout(db, run_id)
            resources["/v1/payments/payouts/BATCH-2"]["batch_header"][
                "batch_status"
            ] = "SUCCESS"
            resources["/v1/payments/payouts/BATCH-2"]["items"][0][
                "transaction_status"
            ] = "SUCCESS"
            ledger.reconcile(db, correction_key)
            script.retry_payout(db, run_id)
            ledger.finish(db, original, resources["/v1/payments/payouts/BATCH-1"])
            self.assertEqual(len(mutations), 2)
            self.assertNotEqual(mutations[0][0], mutations[1][0])
            self.assertEqual(
                ledger.operation(db, original["request_id"])["status"], "failed"
            )
            self.assertEqual(
                ledger.operation(db, original["request_id"])["request"],
                original["request"],
            )
            selected = script.result(db, run_id, "payout")
            self.assertEqual(
                (selected["request_id"], selected["provider_ref"]),
                (correction_key, "BATCH-2"),
            )
            projected = db.execute(
                "SELECT batch_id,status,amount_cents FROM payouts WHERE pool_id=%s",
                (run_id,),
            ).fetchone()
            self.assertEqual(
                projected,
                {"batch_id": "BATCH-2", "status": "SUCCESS", "amount_cents": 50},
            )
            os.environ["PAYPAL_SHOP_EMAIL"] = "third-shop@example.test"
            with self.assertRaisesRegex(ValueError, "immutable"):
                script.retry_payout(db, run_id)
            self.assertEqual(len(mutations), 2)

    def test_bad_signature_is_persisted_without_fetching_or_processing_money(self):
        event_id = "WH-" + uuid4().hex
        raw = json.dumps(
            {
                "id": event_id,
                "event_type": "PAYMENT.CAPTURE.COMPLETED",
                "resource": {"id": "CAPTURE-X"},
            }
        ).encode()
        headers = {name: "bad" for name in webhooks.SIGNATURE_HEADERS.values()}
        with (
            database.connect() as db,
            patch.object(
                webhooks, "settings", replace(self.config, paypal_webhook_id="TEST")
            ),
            patch.object(
                webhooks, "paypal", return_value={"verification_status": "FAILURE"}
            ) as provider,
        ):
            webhooks.receive(db, headers, raw)
            row = db.execute(
                "SELECT * FROM webhook_events WHERE event_id=%s", (event_id,)
            ).fetchone()
            webhooks.process(db, row["id"])
            row = db.execute(
                "SELECT * FROM webhook_events WHERE event_id=%s", (event_id,)
            ).fetchone()
            self.assertFalse(row["verified"])
            self.assertIsNotNone(row["processed_at"])
            self.assertEqual(provider.call_count, 1)
