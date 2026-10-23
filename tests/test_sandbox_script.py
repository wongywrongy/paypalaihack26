"""G1 verifier contracts with provider doubles, never real sandbox evidence."""

import copy
import importlib.util
import io
import os
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from rally.payments import ledger, paypal

spec = importlib.util.spec_from_file_location(
    "paypal_sandbox", Path(__file__).parents[1] / "scripts/paypal_sandbox.py"
)
script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(script)


class SandboxPreflightContracts(unittest.TestCase):
    def test_cli_preflight_is_read_only_and_never_claims_g1(self):
        secret = "PRIVATE-DO-NOT-PRINT"
        config = SimpleNamespace(mode="connected", database_url=secret)
        database, output = MagicMock(), io.StringIO()
        database.return_value.__enter__.return_value.execute.return_value.fetchone.return_value = (
            1,
        )
        with (
            patch.dict(
                os.environ,
                {name: secret for name in ("DATABASE_URL", *script.PAYPAL_ENV)},
                clear=True,
            ),
            patch("rally.config.settings", config),
            patch("psycopg.connect", database),
            patch("httpx.Client"),
            patch.object(paypal, "access_token", return_value=secret),
            patch.object(ledger, "perform") as mutate,
            patch("rally.db.init_db") as migrate,
            redirect_stdout(output),
        ):
            self.assertEqual(script.main(["preflight"]), 0)
        database.assert_called_once_with(
            secret, connect_timeout=5, options="-c default_transaction_read_only=on"
        )
        database.return_value.__enter__.return_value.execute.assert_called_once_with(
            "SELECT 1"
        )
        mutate.assert_not_called()
        migrate.assert_not_called()
        self.assertNotIn(secret, output.getvalue())
        self.assertIn("G1 is not proved by preflight", output.getvalue())

    def test_failures_are_redacted_and_database_failure_does_not_skip_oauth(self):
        output = io.StringIO()
        secret = "PRIVATE-ERROR-CONTENT"
        with (
            patch.dict(
                os.environ,
                {name: secret for name in ("DATABASE_URL", *script.PAYPAL_ENV)},
                clear=True,
            ),
            patch(
                "rally.config.settings",
                SimpleNamespace(mode="connected", database_url=secret),
            ),
            patch("psycopg.connect", side_effect=OSError(secret)),
            patch("httpx.Client"),
            patch.object(
                paypal, "access_token", side_effect=RuntimeError(secret)
            ) as oauth,
            redirect_stdout(output),
        ):
            self.assertEqual(script.preflight(), 1)
        oauth.assert_called_once()
        self.assertIn('"postgresql": "OSError"', output.getvalue())
        self.assertIn('"paypal_oauth": "RuntimeError"', output.getvalue())
        self.assertNotIn(secret, output.getvalue())

    def test_missing_configuration_or_fixture_mode_makes_no_connections(self):
        for mode, values in [
            ("connected", {}),
            ("fixture", {name: "set" for name in ("DATABASE_URL", *script.PAYPAL_ENV)}),
        ]:
            with (
                self.subTest(mode=mode),
                patch.dict(os.environ, values, clear=True),
                patch("rally.config.settings", SimpleNamespace(mode=mode)),
                patch("psycopg.connect") as database,
                patch("httpx.Client") as client,
                redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(script.preflight(), 1)
            database.assert_not_called()
            client.assert_not_called()


class SandboxStartContracts(unittest.TestCase):
    def test_cad_approval_can_proceed_after_refund_while_payout_is_blocked(self):
        run_id, cad_member = uuid4(), uuid4()
        connection = MagicMock()
        db = connection.__enter__.return_value
        with (
            patch.dict(os.environ, {name: "set" for name in script.PAYPAL_ENV}),
            patch("rally.config.settings", SimpleNamespace(mode="connected")),
            patch("rally.db.connect", return_value=connection),
            patch.object(script, "members", return_value=(uuid4(), uuid4())),
            patch.object(script, "result") as result,
            patch.object(script, "cad_member", return_value=cad_member),
            patch.object(
                ledger,
                "perform",
                return_value={
                    "links": [
                        {
                            "rel": "approve",
                            "href": "https://www.sandbox.paypal.com/checkoutnow?token=CAD-TEST",
                        }
                    ]
                },
            ) as perform,
            redirect_stdout(io.StringIO()),
        ):
            script.main(
                [
                    "--run",
                    str(run_id),
                    "cad-start",
                    "--return-url",
                    "https://shop.test/shop",
                    "--cancel-url",
                    "https://shop.test/bag",
                ]
            )
        result.assert_called_once_with(db, run_id, "refund")
        self.assertEqual(perform.call_args.kwargs["currency"], "CAD")
        self.assertEqual(perform.call_args.kwargs["member_id"], cad_member)

    def test_start_migrates_before_database_queries_and_keeps_the_run_key(self):
        run_id, member, other = uuid4(), uuid4(), uuid4()
        sequence, output = [], io.StringIO()
        connection = MagicMock()
        connection.__enter__.return_value.execute.return_value.fetchone.return_value = (
            None
        )

        def connect():
            sequence.append("connect")
            return connection

        with (
            patch.dict(os.environ, {name: "set" for name in script.PAYPAL_ENV}),
            patch("rally.config.settings", SimpleNamespace(mode="connected")),
            patch("rally.db.init_db", side_effect=lambda: sequence.append("migrate")),
            patch("rally.db.connect", side_effect=connect),
            patch.object(script, "setup", return_value=(member, other)),
            patch.object(
                ledger,
                "perform",
                return_value={
                    "links": [
                        {
                            "rel": "approve",
                            "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-TEST",
                        }
                    ]
                },
            ) as perform,
            redirect_stdout(output),
        ):
            script.main(
                [
                    "--run",
                    str(run_id),
                    "start",
                    "--return-url",
                    "https://shop.test/shop",
                    "--cancel-url",
                    "https://shop.test/bag",
                ]
            )
        self.assertEqual(sequence, ["migrate", "connect"])
        self.assertEqual(
            perform.call_args.args[1:], ("order", script.key(run_id, "order"))
        )
        self.assertEqual(perform.call_args.kwargs["pool_id"], run_id)

    def test_failed_migration_never_reaches_the_payment_ledger(self):
        with (
            patch.dict(os.environ, {name: "set" for name in script.PAYPAL_ENV}),
            patch("rally.config.settings", SimpleNamespace(mode="connected")),
            patch("rally.db.init_db", side_effect=RuntimeError("Migration failed")),
            patch("rally.db.connect") as connect,
            patch.object(ledger, "perform") as perform,
            redirect_stdout(io.StringIO()),
        ):
            with self.assertRaisesRegex(RuntimeError, "Migration failed"):
                script.main(
                    [
                        "start",
                        "--return-url",
                        "https://shop.test/shop",
                        "--cancel-url",
                        "https://shop.test/bag",
                    ]
                )
        connect.assert_not_called()
        perform.assert_not_called()


class ProofDatabase:
    def commit(self):
        pass

    def execute(self, query, args):
        assert query.startswith("SELECT event_id FROM webhook_events WHERE verified")
        return SimpleNamespace(fetchall=lambda: [{"event_id": "WH-PROOF"}])


class PayoutCorrectionGuards(unittest.TestCase):
    def test_unresolved_or_successful_original_cannot_be_retried(self):
        for status in ("ready", "inflight", "unknown", "pending", "completed"):
            with (
                self.subTest(status=status),
                patch.object(script, "result"),
                patch.object(
                    ledger,
                    "operation",
                    return_value={
                        "kind": "payout",
                        "status": status,
                        "provider_ref": "BATCH-1",
                    },
                ),
                patch.object(ledger, "perform") as perform,
                patch.object(ledger, "reconcile") as reconcile,
            ):
                with self.assertRaisesRegex(RuntimeError, "confirmed failed"):
                    script.retry_payout(MagicMock(), uuid4())
                perform.assert_not_called()
                reconcile.assert_not_called()


class SandboxProofContracts(unittest.TestCase):
    def setUp(self):
        self.run_id, self.member = uuid4(), uuid4()
        self.ops, self.resources = {}, {}
        steps = {
            "order": "order",
            "authorize": "authorize",
            "capture": "capture",
            "void-order": "order",
            "void-authorize": "authorize",
            "void": "void",
            "refund": "refund",
            "payout": "payout",
            "cad-order": "order",
            "cad-authorize": "authorize",
            "cad-capture": "capture",
        }
        for step, kind in steps.items():
            currency = "CAD" if step.startswith("cad-") else "USD"
            cents = (
                50
                if kind == "payout"
                else 100
                if kind in ("capture", "refund")
                else 200
            )
            ref = step.upper()
            request = {"amount_cents": cents, "resource_id": ref}
            if currency == "CAD":
                request["currency"] = currency
            data = {
                "id": ref,
                "amount": paypal.money(cents, currency),
                "status": "COMPLETED",
            }
            if kind == "order":
                data.update(
                    intent="AUTHORIZE",
                    purchase_units=[
                        {
                            "custom_id": str(self.member),
                            "amount": paypal.money(cents, currency),
                            "payee": {"merchant_id": "MERCHANT-TEST"},
                        }
                    ],
                )
            elif kind == "authorize":
                data["status"] = "CAPTURED"
            elif kind == "capture":
                data["final_capture"] = True
            elif kind == "void":
                data["status"] = "VOIDED"
            elif kind == "payout":
                item = {
                    "receiver": "shop@example.test",
                    "sender_item_id": "ITEM-PROOF",
                    "amount": {"currency": "USD", "value": "0.50"},
                }
                request["body"] = {
                    "sender_batch_header": {"sender_batch_id": "BATCH-PROOF"},
                    "items": [item],
                }
                data = {
                    "batch_header": {
                        "payout_batch_id": ref,
                        "batch_status": "SUCCESS",
                        "sender_batch_header": request["body"]["sender_batch_header"],
                    },
                    "items": [
                        {
                            "transaction_status": "SUCCESS",
                            "payout_item_id": "ITEM-PROOF",
                            "payout_item": item,
                        }
                    ],
                }
            self.ops[script.key(self.run_id, step)] = {
                "request_id": script.key(self.run_id, step),
                "kind": kind,
                "member_id": self.member,
                "request": request,
                "provider_ref": ref,
                "status": "completed",
            }
            self.resources[paypal.resource_path(kind, ref)] = data
        self.database = ProofDatabase()
        self.settings = patch.object(
            ledger, "settings", SimpleNamespace(paypal_merchant_id="MERCHANT-TEST")
        )
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def verify(self, **kwargs):
        with (
            patch.object(
                ledger, "operation", side_effect=lambda db, key: self.ops.get(key)
            ),
            patch.object(
                paypal,
                "paypal",
                side_effect=lambda method, path: copy.deepcopy(self.resources[path]),
            ),
        ):
            return script.verify_run(self.database, self.run_id, **kwargs)

    def test_default_g1_requires_cad_even_when_usd_proof_is_complete(self):
        del self.ops[script.key(self.run_id, "cad-order")]
        with self.assertRaisesRegex(RuntimeError, "Complete cad-order first"):
            self.verify()
        legacy = self.verify(require_cad=False)
        self.assertNotIn("cad-capture", legacy)
        self.assertEqual(legacy["webhooks"], ["WH-PROOF"])

    def test_cad_must_be_received_in_cad_not_merely_http_success(self):
        self.assertEqual(self.verify()["cad-capture"], "CAD-CAPTURE")
        capture = self.resources[paypal.resource_path("capture", "CAD-CAPTURE")]
        capture["status"] = "PENDING"
        with self.assertRaisesRegex(
            RuntimeError, "Lower final capture has not completed"
        ):
            self.verify()
        capture["status"] = "COMPLETED"
        capture["amount"] = paypal.money(100)
        with self.assertRaisesRegex(paypal.RecoveryRequired, "currency mismatch"):
            self.verify()

    def test_completed_cad_cannot_hide_a_failed_payout(self):
        self.ops[script.key(self.run_id, "payout")]["status"] = "failed"
        with self.assertRaisesRegex(RuntimeError, "Complete payout first"):
            self.verify()

    def test_verifier_follows_explicit_correction_without_rewriting_denial(self):
        failed = self.ops[script.key(self.run_id, "payout")]
        corrected = copy.deepcopy(failed)
        corrected["request_id"] = script.key(self.run_id, "payout-correction")
        corrected["provider_ref"] = "CORRECTED-BATCH"
        self.ops[corrected["request_id"]] = corrected
        resource = copy.deepcopy(
            self.resources[paypal.resource_path("payout", failed["provider_ref"])]
        )
        resource["batch_header"]["payout_batch_id"] = corrected["provider_ref"]
        self.resources[paypal.resource_path("payout", corrected["provider_ref"])] = (
            resource
        )
        failed["status"] = "failed"
        corrected["status"] = "pending"
        with patch.object(
            ledger,
            "reconcile",
            side_effect=lambda db, request_id: self.ops[request_id].update(
                status="completed"
            ),
        ):
            self.assertEqual(self.verify()["payout"], "CORRECTED-BATCH")
        self.assertEqual(failed["status"], "failed")
