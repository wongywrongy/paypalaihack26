"""Official PayPal examples adapted for sandbox contracts; no real transactions."""

import copy
import io
import json
import os
import runpy
import unittest
from contextlib import redirect_stdout
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import test_coalition as baseline
import test_negotiated as negotiated
from coalition import payments
from coalition.config import settings
from coalition.db import connect
from coalition.groups import join, members
from coalition.main import app
from coalition.payments import RecoveryRequired, observe, perform, verify_webhook
from fastapi.testclient import TestClient

EXAMPLES = json.loads(
    (Path(__file__).parent / "fixtures/paypal_official.json").read_text()
)["examples"]


def example(name, c, amount):
    data = copy.deepcopy(EXAMPLES[name])
    data["amount"] = {"currency_code": "USD", "value": amount}
    for link in data.get("links", []):
        link["href"] = link["href"].replace(
            "api-m.paypal.com", "api-m.sandbox.paypal.com"
        )
        if link["rel"] == "up":
            parent = "captures" if name == "refund" else "authorizations"
            rid = c["capture_id"] if name == "refund" else c["authorization_id"]
            link["href"] = (
                f"https://api-m.sandbox.paypal.com/v2/payments/{parent}/{rid}"
            )
    data["supplementary_data"] = {"related_ids": {"order_id": c["order_id"]}}
    if name == "authorization":
        data["id"] = c["authorization_id"]
        data["payee"]["merchant_id"] = "contract-merchant"
        now = datetime.now(timezone.utc)
        data["create_time"] = now.isoformat()
        data["expiration_time"] = (now + timedelta(days=29)).isoformat()
    return data


class TransportContracts(unittest.TestCase):
    def test_connected_gate_rejects_captures_without_confirmed_group_success(self):
        gid = uuid4()
        rows = [
            dict(
                id=uuid4(),
                group_id=gid,
                mode="connected",
                locked=True,
                provider_payer_id=f"payer-{i}",
                amount_minor=8900,
                settlement_minor=8500,
                currency="USD",
                group_status="SUCCEEDED",
                fulfillment_released=True,
                order_id=f"order-{i}",
                authorization_id=f"authorization-{i}",
                capture_id=f"capture-{i}",
                refund_id=f"refund-{i}",
                accepted_terms={"payee_id": "contract-merchant"},
            )
            for i in range(5)
        ]
        voided = {
            **rows[0],
            "id": uuid4(),
            "group_id": uuid4(),
            "authorization_id": "separate-void",
            "locked": False,
            "group_status": "FAILED",
            "settlement_minor": None,
        }
        resources, ops = {}, []
        for c in rows + [voided]:
            kinds = (
                ["void"] if c is voided else ["order", "authorize", "capture", "refund"]
            )
            for kind in kinds:
                rid = (
                    c["authorization_id"]
                    if kind == "void"
                    else c[
                        {
                            "order": "order_id",
                            "authorize": "authorization_id",
                            "capture": "capture_id",
                            "refund": "refund_id",
                        }[kind]
                    ]
                )
                if kind == "order":
                    data = {
                        "id": rid,
                        "intent": "AUTHORIZE",
                        "purchase_units": [
                            {
                                "custom_id": str(c["id"]),
                                "amount": {"currency_code": "USD", "value": "89.00"},
                                "payee": {"merchant_id": "contract-merchant"},
                            }
                        ],
                    }
                else:
                    data = example(
                        "authorization" if kind in ("authorize", "void") else kind,
                        c,
                        "89.00" if kind in ("authorize", "void") else "85.00",
                    )
                    data["id"] = rid
                    if kind == "void":
                        data["status"] = "VOIDED"
                resources[rid] = data
                ops.append(
                    {
                        "commitment_id": c["id"],
                        "kind": kind,
                        "status": "completed",
                        "response": {"id": rid},
                    }
                )
        connected = replace(
            settings, mode="connected", paypal_merchant_id="changed-merchant"
        )
        for status, released in [
            ("SUCCEEDED", True),
            ("SETTLING", False),
            ("UNWINDING", False),
            ("FAILED", False),
            ("SUCCEEDED", False),
        ]:
            with self.subTest(status=status, released=released):
                for c in rows:
                    c.update(group_status=status, fulfillment_released=released)
                db = MagicMock()
                db.__enter__.return_value = db
                db.execute.return_value.fetchall.side_effect = [
                    rows + [voided],
                    ops,
                    [{"payload": {"event_type": "PAYMENT.CAPTURE.COMPLETED"}}],
                    [],
                    [{"eligible": True}, {"eligible": False}],
                ]
                with (
                    patch("coalition.config.settings", connected),
                    patch("coalition.payments.settings", connected),
                    patch("coalition.db.connect", return_value=db),
                    patch(
                        "coalition.payments.paypal",
                        side_effect=lambda method, path: resources[
                            path.rsplit("/", 1)[-1]
                        ],
                    ),
                    patch(
                        "sys.argv", ["check_connected.py", str(uuid4()), str(uuid4())]
                    ),
                    redirect_stdout(io.StringIO()),
                ):
                    if status == "SUCCEEDED" and released:
                        runpy.run_path("scripts/check_connected.py")
                    else:
                        with self.assertRaisesRegex(
                            AssertionError, "No frozen five-payer"
                        ):
                            runpy.run_path("scripts/check_connected.py")

    def test_oauth_cache_and_empty_void_response_preserve_observed_http_status(self):
        requests = []

        def remote(request):
            requests.append(request)
            if request.url.path == "/v1/oauth2/token":
                return httpx.Response(
                    200, json={"access_token": "test-only", "expires_in": 3600}
                )
            return httpx.Response(204)

        with (
            httpx.Client(transport=httpx.MockTransport(remote)) as client,
            patch("coalition.payments.provider_client", return_value=client),
            patch(
                "coalition.payments.settings",
                replace(settings, paypal_client_id="test", paypal_client_secret="test"),
            ),
            patch("coalition.payments._oauth_expires", 0),
        ):
            for _ in range(2):
                result = payments.paypal(
                    "POST",
                    "/v2/payments/authorizations/test/void",
                    key="stable-test-id",
                )
                self.assertEqual(result, {"http_status": 204})
            self.assertEqual(sum(r.url.path == "/v1/oauth2/token" for r in requests), 1)
            self.assertTrue(
                all(
                    r.headers["PayPal-Request-Id"] == "stable-test-id"
                    for r in requests[1:]
                )
            )

    def test_signature_postback_preserves_original_event_bytes(self):
        raw = b'{ "id" : "WH-test", "resource" : {"amount":{"value":"85.00"}} }'
        headers = {
            "paypal-" + name: "test"
            for name in (
                "auth-algo",
                "cert-url",
                "transmission-id",
                "transmission-sig",
                "transmission-time",
            )
        }
        with (
            patch(
                "coalition.payments.settings",
                replace(
                    settings, mode="connected", paypal_webhook_id="registered-test"
                ),
            ),
            patch(
                "coalition.payments.paypal",
                return_value={"verification_status": "SUCCESS"},
            ) as remote,
        ):
            self.assertTrue(verify_webhook(headers, json.loads(raw), raw))
            posted = remote.call_args.kwargs["raw_json"]
            self.assertIn(raw, posted)
            self.assertEqual(json.loads(posted)["webhook_id"], "registered-test")


@unittest.skipUnless(
    os.getenv("COALITION_TEST_DATABASE_URL"), "Requires disposable PostgreSQL"
)
class ProviderDatabaseContracts(unittest.TestCase):
    setUpClass = classmethod(baseline.PostgreSQLChecks.setUpClass.__func__)
    tearDownClass = classmethod(baseline.PostgreSQLChecks.tearDownClass.__func__)
    prepare = negotiated.NegotiatedChecks.prepare

    def commitment(self):
        run, hero, terms, context = self.prepare(0)
        with connect() as db:
            c = join(db, hero, run["group_id"], context, terms)
            db.commit()
            perform(db, c, "order")
            perform(db, c, "authorize")
            return members(db, run["group_id"])[0]

    def test_official_authorization_lower_capture_pending_refund_and_finality(self):
        c = self.commitment()
        connected = replace(
            settings, mode="connected", paypal_merchant_id="contract-merchant"
        )
        with connect() as db, patch("coalition.payments.settings", connected):
            observe(db, c, "authorize", example("authorization", c, "89.00"))
            db.execute(
                "UPDATE commitments SET settlement_minor=8500 WHERE id=%s", (c["id"],)
            )
            c = db.execute(
                "SELECT * FROM commitments WHERE id=%s", (c["id"],)
            ).fetchone()
            capture = example("capture", c, "85.00")
            mismatched = copy.deepcopy(capture)
            next(link for link in mismatched["links"] if link["rel"] == "up")[
                "href"
            ] = "https://api-m.sandbox.paypal.com/v2/payments/authorizations/OTHER"
            with self.assertRaises(RecoveryRequired):
                observe(db, c, "capture", mismatched)
            observe(db, c, "capture", capture)
            c = db.execute(
                "SELECT * FROM commitments WHERE id=%s", (c["id"],)
            ).fetchone()
            self.assertEqual(
                (c["authorized_minor"], c["captured_minor"], c["void_status"]),
                (8900, 8500, None),
            )
            refund = example("refund", c, "85.00")
            observe(db, c, "refund", {**refund, "status": "PENDING"})
            c = db.execute(
                "SELECT * FROM commitments WHERE id=%s", (c["id"],)
            ).fetchone()
            self.assertIsNone(c["refunded_minor"])
            observe(db, c, "refund", refund)
            observe(
                db,
                c,
                "refund",
                {**refund, "status": "PENDING"},
                "webhook",
                "WH-delayed",
            )
            c = db.execute(
                "SELECT * FROM commitments WHERE id=%s", (c["id"],)
            ).fetchone()
            self.assertEqual(
                (c["refund_status"], c["refunded_minor"]), ("COMPLETED", 8500)
            )

    def test_void_requires_matching_confirmed_provider_resource(self):
        c = self.commitment()
        with (
            connect() as db,
            patch(
                "coalition.payments.settings",
                replace(
                    settings, mode="connected", paypal_merchant_id="contract-merchant"
                ),
            ),
        ):
            data = example("authorization", c, "89.00")
            for invalid in (
                data,
                {**data, "id": "other", "status": "VOIDED"},
                {
                    **data,
                    "status": "VOIDED",
                    "amount": {"currency_code": "USD", "value": "85.00"},
                },
            ):
                with self.assertRaises(RecoveryRequired):
                    observe(db, c, "void", invalid)
            observe(db, c, "void", {**data, "status": "VOIDED"})
            self.assertEqual(members(db, c["group_id"])[0]["void_status"], "VOIDED")

    def test_changed_merchant_blocks_new_payment_but_keeps_original_void_observable(
        self,
    ):
        with patch(
            "coalition.negotiation.settings",
            replace(settings, paypal_merchant_id="contract-merchant"),
        ):
            c = self.commitment()
        connected = replace(
            settings, mode="connected", paypal_merchant_id="new-merchant"
        )
        with (
            connect() as db,
            patch("coalition.payments.settings", connected),
            patch("coalition.payments.paypal") as provider,
        ):
            db.execute("UPDATE runs SET mode='connected' WHERE id=%s", (c["run_id"],))
            for kind in ("order", "authorize"):
                with self.assertRaisesRegex(RecoveryRequired, "merchant changed"):
                    perform(db, c, kind)
            provider.assert_not_called()
            data = example("authorization", c, "89.00")
            data["payee"]["merchant_id"] = c["accepted_terms"]["payee_id"]
            observe(db, c, "void", {**data, "status": "VOIDED"})
            self.assertEqual(members(db, c["group_id"])[0]["void_status"], "VOIDED")

    def test_verified_raw_event_is_durable_and_duplicate_id_is_not_replaced(self):
        eid = "WH-contract-" + uuid4().hex
        raw = json.dumps(
            {
                "id": eid,
                "event_type": "PAYMENT.AUTHORIZATION.CREATED",
                "resource": EXAMPLES["authorization"],
            },
            indent=2,
        ).encode()
        headers = {
            "paypal-" + name: "test"
            for name in (
                "auth-algo",
                "cert-url",
                "transmission-id",
                "transmission-sig",
                "transmission-time",
            )
        }
        connected = replace(settings, mode="connected")
        with (
            TestClient(app) as client,
            patch("coalition.main.settings", connected),
            patch("coalition.db.settings", connected),
            patch("coalition.main.verify_webhook", return_value=True),
        ):
            for _ in range(2):
                self.assertEqual(
                    client.post(
                        "/api/paypal/webhook", content=raw, headers=headers
                    ).status_code,
                    200,
                )
            altered = json.loads(raw) | {"event_type": "PAYMENT.AUTHORIZATION.VOIDED"}
            self.assertEqual(
                client.post(
                    "/api/paypal/webhook", json=altered, headers=headers
                ).status_code,
                409,
            )
        with connect() as db:
            event = db.execute(
                "SELECT * FROM webhook_events WHERE id=%s", (eid,)
            ).fetchone()
            self.assertTrue(event["verified"])
            self.assertEqual(bytes(event["raw_body"]), raw)
            self.assertEqual(
                event["payload"]["event_type"], "PAYMENT.AUTHORIZATION.CREATED"
            )
            self.assertEqual(
                db.execute(
                    "SELECT count(*) AS n FROM jobs WHERE dedupe_key=%s",
                    ("event:" + eid,),
                ).fetchone()["n"],
                1,
            )
