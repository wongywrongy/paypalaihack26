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


class ProofDatabase:
    def commit(self):
        pass

    def execute(self, query, args):
        assert query.startswith("SELECT event_id FROM webhook_events WHERE verified")
        return SimpleNamespace(fetchall=lambda: [{"event_id": "WH-PROOF"}])


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
