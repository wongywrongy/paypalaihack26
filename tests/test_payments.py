"""Provider contracts and money guards. Mocks are never sandbox gate evidence."""

import copy
import importlib.util
import json
import random
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import httpx
from rally.payments import ledger, paypal, webhooks

FIXTURES = json.loads(
    (Path(__file__).parent / "fixtures/paypal_official.json").read_text()
)["examples"]


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows


class MemoryLedger:
    """Small repository double; PostgreSQL syntax/constraints have separate integration tests."""

    def __init__(self):
        self.member = {"id": uuid4(), "pool_id": uuid4(), "max_cents": 10000}
        self.pool = {"id": self.member["pool_id"], "state": "OPEN", "shop_id": "shop"}
        self.hold = {
            "authorization_id": "AUTH-1",
            "order_id": "ORDER-1",
            "amount_cents": 10000,
            "status": "AUTHORIZED",
            "honor_until": datetime.now(timezone.utc) + timedelta(days=2),
        }
        self.ops = {}
        self.tracking = True
        self.commits = 0
        self.locked = False

    def execute(self, query, args=()):
        if query.startswith("SELECT pg_"):
            self.locked = True
            return Rows([{"held": True}])
        if query.startswith("SELECT * FROM payment_ops WHERE request_id"):
            return Rows([self.ops[args[0]]]) if args[0] in self.ops else Rows([])
        if query.startswith("SELECT * FROM pools"):
            return Rows([self.pool])
        if query.startswith("SELECT * FROM members"):
            return (
                Rows([self.member])
                if args[0] == self.member["id"] and args[1] == self.pool["id"]
                else Rows([])
            )
        if query.startswith("SELECT * FROM holds"):
            return (
                Rows([self.hold])
                if args[1] in (self.hold["authorization_id"], self.hold["order_id"])
                else Rows([])
            )
        if query.startswith("SELECT 1 FROM holds"):
            return Rows([])
        if query.startswith("SELECT * FROM payment_ops WHERE member_id"):
            return Rows(
                [
                    op
                    for op in self.ops.values()
                    if op["kind"] == "capture"
                    and op["provider_ref"] == args[1]
                    and op["status"] == "completed"
                ]
            )
        if query.startswith("SELECT COALESCE(sum"):
            return Rows(
                [
                    {
                        "total": sum(
                            op["request"]["amount_cents"]
                            for op in self.ops.values()
                            if op["kind"] == "refund"
                            and op["request"]["resource_id"] == args[0]
                            and op["status"] != "failed"
                        )
                    }
                ]
            )
        if query.startswith("SELECT 1 FROM shipments"):
            return Rows([{"exists": 1}] if self.tracking else [])
        if query.startswith("SELECT 1 FROM payment_ops"):
            if "status IN ('inflight','unknown','pending')" in query:
                return Rows(
                    [
                        op
                        for op in self.ops.values()
                        if op["status"] in ("inflight", "unknown", "pending")
                    ]
                )
            return Rows([op for op in self.ops.values() if op["kind"] == "payout"])
        if query.startswith("SELECT * FROM shops"):
            return Rows([{"payout_email": "shop@example.test"}])
        if query.startswith("INSERT INTO payment_ops"):
            op = dict(
                zip(
                    ("id", "kind", "member_id", "pool_id", "request_id", "request"),
                    args,
                )
            )
            op.update(
                status="inflight",
                provider_ref=None,
                response=None,
                request=op["request"].obj,
            )
            self.ops[op["request_id"]] = op
            return Rows([op])
        if query.startswith("UPDATE payment_ops SET"):
            op = next(op for op in self.ops.values() if op["id"] == args[-1])
            if "AND status='inflight'" in query and op["status"] != "inflight":
                return Rows([])
            if "status=%s,provider_ref=%s,response=%s" in query:
                op.update(status=args[0], provider_ref=args[1], response=args[2].obj)
            elif "status='completed'" in query:
                op.update(
                    status="completed", provider_ref=args[0], response=args[1].obj
                )
            elif "provider_ref=%s,response=%s" in query:
                op.update(provider_ref=args[0], response=args[1].obj)
            else:
                op["status"] = args[0]
            return Rows([])
        if query.startswith("UPDATE holds SET status"):
            self.hold["status"] = args[0]
            return Rows([])
        if query.startswith(("INSERT INTO holds", "INSERT INTO payouts")):
            return Rows([])
        raise AssertionError("Unexpected repository query: " + query)

    def commit(self):
        self.commits += 1
        self.locked = False

    def rollback(self):
        self.locked = False


def payment(kind, cents=10000):
    data = copy.deepcopy(FIXTURES[kind])
    data["amount"] = paypal.money(cents)
    if kind == "authorization":
        data["id"] = "AUTH-1"
    elif kind == "capture":
        data["id"] = "CAPTURE-1"
        data["links"] = [
            {"rel": "up", "href": paypal.BASE + "/v2/payments/authorizations/AUTH-1"}
        ]
    elif kind == "refund":
        data["id"] = "REFUND-1"
        data["links"] = [
            {"rel": "up", "href": paypal.BASE + "/v2/payments/captures/CAPTURE-1"}
        ]
    return data


class PaymentContracts(unittest.TestCase):
    def setUp(self):
        self.db = MemoryLedger()
        self.settings = patch.object(
            ledger,
            "settings",
            SimpleNamespace(mode="connected", paypal_merchant_id="MERCHANT-TEST"),
        )
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def perform(self, kind, request_id, **kwargs):
        return ledger.perform(
            self.db,
            kind,
            request_id,
            pool_id=self.db.pool["id"],
            member_id=self.db.member["id"],
            **kwargs,
        )

    def test_order_uses_top_level_id_when_purchase_unit_has_no_id(self):
        order = {
            "id": "ORDER-NEW",
            "intent": "AUTHORIZE",
            "status": "CREATED",
            "purchase_units": [
                {
                    "custom_id": str(self.db.member["id"]),
                    "amount": paypal.money(self.db.member["max_cents"]),
                    "payee": {"merchant_id": "MERCHANT-TEST"},
                }
            ],
        }
        with (
            patch.object(ledger, "paypal", return_value=order),
            patch.object(self.db, "execute", wraps=self.db.execute) as execute,
        ):
            self.assertEqual(self.perform("order", "hold:member:1"), order)
        op = self.db.ops["hold:member:1"]
        self.assertEqual(op["provider_ref"], "ORDER-NEW")
        self.assertEqual(op["status"], "completed")
        hold_insert = next(
            call
            for call in execute.call_args_list
            if call.args[0].startswith("INSERT INTO holds")
        )
        self.assertEqual(hold_insert.args[1][2], "ORDER-NEW")

    def transport(self, method, path, body=None, **kwargs):
        self.assertFalse(self.db.locked, "No DB lock may span a provider call")
        if method == "GET":
            return payment("authorization")
        self.assertGreaterEqual(
            self.db.commits, 2, "Intent must be durable before mutation"
        )
        dollars, cents = body["amount"]["value"].split(".")
        return payment(
            "refund" if path.endswith("refund") else "capture",
            int(dollars) * 100 + int(cents),
        )

    def test_lower_capture_is_final_and_retry_does_not_repeat(self):
        with patch.object(ledger, "paypal", side_effect=self.transport) as provider:
            first = self.perform(
                "capture",
                "capture:allocation-1",
                resource_id="AUTH-1",
                amount_cents=9000,
            )
            self.assertEqual(
                first,
                self.perform(
                    "capture",
                    "capture:allocation-1",
                    resource_id="AUTH-1",
                    amount_cents=9000,
                ),
            )
            mutations = [
                call for call in provider.call_args_list if call.args[0] == "POST"
            ]
            self.assertEqual(len(mutations), 1)
            self.assertEqual(
                mutations[0].args[2],
                {"amount": paypal.money(9000), "final_capture": True},
            )
            self.assertEqual(len(mutations[0].kwargs["key"]), 36)

    def test_reused_key_cannot_change_terms(self):
        with patch.object(ledger, "paypal", side_effect=self.transport):
            self.perform(
                "capture",
                "capture:allocation-1",
                resource_id="AUTH-1",
                amount_cents=9000,
            )
            with self.assertRaisesRegex(ValueError, "different payment terms"):
                self.perform(
                    "capture",
                    "capture:allocation-1",
                    resource_id="AUTH-1",
                    amount_cents=8000,
                )

    def test_inflight_claim_blocks_a_second_command_before_provider_returns(self):
        def provider(method, path, body=None, **kwargs):
            self.assertFalse(self.db.locked)
            if method == "GET":
                with self.assertRaisesRegex(paypal.RecoveryRequired, "Unresolved"):
                    self.perform(
                        "capture",
                        "competing-key",
                        resource_id="AUTH-1",
                        amount_cents=100,
                    )
                return payment("authorization")
            return payment("capture", 100)

        with patch.object(ledger, "paypal", side_effect=provider) as network:
            self.perform("capture", "first-key", resource_id="AUTH-1", amount_cents=100)
        self.assertEqual(
            sum(call.args[0] == "POST" for call in network.call_args_list), 1
        )

    def test_pending_capture_blocks_money_until_get_confirms_completion(self):
        def pending(method, path, body=None, **kwargs):
            self.assertFalse(self.db.locked)
            return (
                payment("authorization")
                if method == "GET"
                else {**payment("capture", 100), "status": "PENDING"}
            )

        with patch.object(ledger, "paypal", side_effect=pending):
            self.perform(
                "capture", "pending-capture", resource_id="AUTH-1", amount_cents=100
            )
        self.assertEqual(self.db.ops["pending-capture"]["status"], "pending")
        self.assertEqual(self.db.hold["status"], "AUTHORIZED")
        with patch.object(
            ledger, "paypal", return_value=payment("capture", 100)
        ) as provider:
            with self.assertRaisesRegex(paypal.RecoveryRequired, "Unresolved"):
                self.perform(
                    "refund", "early-refund", resource_id="CAPTURE-1", amount_cents=100
                )
            provider.assert_not_called()
            ledger.reconcile(self.db, "pending-capture")
            self.assertEqual(provider.call_args.args[0], "GET")
        self.assertEqual(self.db.ops["pending-capture"]["status"], "completed")
        self.assertEqual(self.db.hold["status"], "CAPTURED")

    def test_reconciliation_cannot_replace_the_provider_resource_id(self):
        with patch.object(
            ledger,
            "paypal",
            side_effect=lambda method, *a, **kw: (
                payment("authorization")
                if method == "GET"
                else {**payment("capture", 100), "status": "PENDING"}
            ),
        ):
            self.perform("capture", "pending", resource_id="AUTH-1", amount_cents=100)
        with patch.object(
            ledger, "paypal", return_value={**payment("capture", 100), "id": "OTHER"}
        ):
            with self.assertRaisesRegex(paypal.RecoveryRequired, "identity changed"):
                ledger.reconcile(self.db, "pending")
        self.assertEqual(self.db.ops["pending"]["provider_ref"], "CAPTURE-1")
        self.assertEqual(self.db.ops["pending"]["status"], "pending")

    def test_webhook_completion_wins_over_a_late_pending_http_response(self):
        def provider(method, path, body=None, **kwargs):
            if method == "GET":
                return payment("authorization")
            ledger.finish(
                self.db, self.db.ops["raced-capture"], payment("capture", 100)
            )
            return {**payment("capture", 100), "status": "PENDING"}

        with patch.object(ledger, "paypal", side_effect=provider):
            data = self.perform(
                "capture", "raced-capture", resource_id="AUTH-1", amount_cents=100
            )
        self.assertEqual(data["status"], "COMPLETED")
        self.assertEqual(self.db.ops["raced-capture"]["status"], "completed")

    def test_webhook_completion_survives_a_late_http_timeout(self):
        def provider(method, path, body=None, **kwargs):
            if method == "GET":
                return payment("authorization")
            ledger.finish(
                self.db, self.db.ops["raced-timeout"], payment("capture", 100)
            )
            raise httpx.ReadTimeout("test timeout after webhook")

        with patch.object(ledger, "paypal", side_effect=provider):
            with self.assertRaises(httpx.ReadTimeout):
                self.perform(
                    "capture", "raced-timeout", resource_id="AUTH-1", amount_cents=100
                )
        self.assertEqual(self.db.ops["raced-timeout"]["status"], "completed")

    def test_shared_ledger_requires_merchant_identity(self):
        with (
            patch.object(
                ledger,
                "settings",
                SimpleNamespace(mode="connected", paypal_merchant_id=""),
            ),
            patch.object(ledger, "paypal") as provider,
        ):
            with self.assertRaisesRegex(paypal.RecoveryRequired, "MERCHANT_ID"):
                self.perform("order", "missing-merchant")
            provider.assert_not_called()

    def test_no_over_max_or_over_hold_even_if_paypal_permits_it(self):
        for maximum, authorized, charged in (
            (10000, 10000, 10001),
            (10000, 9000, 9500),
        ):
            self.db.member["max_cents"] = maximum
            self.db.hold["amount_cents"] = authorized
            with patch.object(
                ledger, "paypal", return_value=payment("authorization", authorized)
            ) as provider:
                with self.assertRaisesRegex(ValueError, "exceeds"):
                    self.perform(
                        "capture",
                        "over-max",
                        resource_id="AUTH-1",
                        amount_cents=charged,
                    )
                self.assertTrue(
                    all(call.args[0] == "GET" for call in provider.call_args_list)
                )
                self.assertFalse(self.db.ops)

    def test_expired_honor_period_cannot_capture(self):
        self.db.hold["honor_until"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        with patch.object(ledger, "paypal", return_value=payment("authorization")):
            with self.assertRaisesRegex(paypal.RecoveryRequired, "honor period"):
                self.perform(
                    "capture", "expired", resource_id="AUTH-1", amount_cents=100
                )

    def test_random_over_max_values_never_reach_a_mutation(self):
        rng = random.Random(20261022)
        for i in range(100):
            maximum = rng.randrange(1, 100000)
            self.db.member["max_cents"] = maximum
            self.db.hold["amount_cents"] = maximum
            with patch.object(
                ledger, "paypal", return_value=payment("authorization", maximum)
            ) as provider:
                with self.assertRaises(ValueError):
                    self.perform(
                        "capture",
                        f"over-{i}",
                        resource_id="AUTH-1",
                        amount_cents=maximum + rng.randrange(1, 10000),
                    )
                self.assertTrue(
                    all(call.args[0] == "GET" for call in provider.call_args_list)
                )

    def test_ambiguous_capture_never_replays_automatically(self):
        def interrupted(method, *args, **kwargs):
            if method == "GET":
                return payment("authorization")
            raise httpx.ReadTimeout("test timeout")

        with patch.object(ledger, "paypal", side_effect=interrupted) as provider:
            with self.assertRaises(httpx.ReadTimeout):
                self.perform(
                    "capture", "ambiguous", resource_id="AUTH-1", amount_cents=100
                )
            self.assertEqual(self.db.ops["ambiguous"]["status"], "unknown")
            with self.assertRaisesRegex(paypal.RecoveryRequired, "reconciliation"):
                self.perform(
                    "capture", "ambiguous", resource_id="AUTH-1", amount_cents=100
                )
            with self.assertRaisesRegex(paypal.RecoveryRequired, "Unresolved"):
                self.perform(
                    "capture", "another-key", resource_id="AUTH-1", amount_cents=100
                )
            self.assertEqual(
                sum(call.args[0] == "POST" for call in provider.call_args_list), 1
            )

    def test_partial_refunds_cannot_exceed_capture(self):
        with patch.object(ledger, "paypal", side_effect=self.transport):
            self.perform("capture", "captured", resource_id="AUTH-1", amount_cents=9000)
            self.perform(
                "refund", "refund-1", resource_id="CAPTURE-1", amount_cents=6000
            )
            with self.assertRaisesRegex(ValueError, "unrefunded"):
                self.perform(
                    "refund", "refund-2", resource_id="CAPTURE-1", amount_cents=3001
                )

    def test_payout_requires_tracking_and_v1_amount_schema(self):
        self.db.tracking = False
        with patch.object(ledger, "paypal") as provider:
            with self.assertRaisesRegex(ValueError, "tracking"):
                ledger.perform(
                    self.db,
                    "payout",
                    "payout-1",
                    pool_id=self.db.pool["id"],
                    amount_cents=50,
                )
            provider.assert_not_called()
        self.db.tracking = True

        def payout(method, path, body=None, **kwargs):
            self.assertEqual(
                body["items"][0]["amount"], {"currency": "USD", "value": "0.50"}
            )
            self.assertEqual(
                body["sender_batch_header"]["sender_batch_id"], kwargs["key"]
            )
            return {
                "batch_header": {
                    "payout_batch_id": "BATCH-1",
                    "batch_status": "PENDING",
                    "sender_batch_header": body["sender_batch_header"],
                }
            }

        with patch.object(ledger, "paypal", side_effect=payout):
            ledger.perform(
                self.db,
                "payout",
                "payout-1",
                pool_id=self.db.pool["id"],
                amount_cents=50,
            )

    def test_provider_wrong_currency_parent_or_nonfinal_capture_fails(self):
        op = {
            "kind": "capture",
            "request": {"amount_cents": 10000, "resource_id": "AUTH-1"},
        }
        for change in (
            {"amount": {"currency_code": "EUR", "value": "100.00"}},
            {"final_capture": False},
            {
                "links": [
                    {
                        "rel": "up",
                        "href": paypal.BASE + "/v2/payments/authorizations/OTHER",
                    }
                ]
            },
        ):
            with self.assertRaises(paypal.RecoveryRequired):
                ledger.checked_result(op, {**payment("capture"), **change})

    def test_successful_payout_batch_with_failed_item_is_not_shop_payment(self):
        def payout(method, path, body=None, **kwargs):
            return {
                "batch_header": {
                    "payout_batch_id": "BATCH-1",
                    "batch_status": "SUCCESS",
                    "sender_batch_header": body["sender_batch_header"],
                },
                "items": [
                    {"transaction_status": "FAILED", "payout_item": body["items"][0]}
                ],
            }

        with patch.object(ledger, "paypal", side_effect=payout):
            ledger.perform(
                self.db,
                "payout",
                "failed-item",
                pool_id=self.db.pool["id"],
                amount_cents=50,
            )
        self.assertEqual(self.db.ops["failed-item"]["status"], "failed")

    def test_money_accepts_only_positive_integer_cents(self):
        self.assertEqual(paypal.money(1)["value"], "0.01")
        for invalid in (0, -1, True, 1.5, "100"):
            with self.assertRaises(ValueError):
                paypal.money(invalid)
        for value in ("NaN", "Infinity", None, {}, "100.001"):
            self.assertFalse(
                paypal.amount_matches({"currency_code": "USD", "value": value}, 10000)
            )


class TransportContracts(unittest.TestCase):
    def test_oauth_cache_and_stable_request_header(self):
        calls = []

        def request(req):
            calls.append(req)
            if req.url.path == "/v1/oauth2/token":
                return httpx.Response(
                    200, json={"access_token": "test-token", "expires_in": 3600}
                )
            return httpx.Response(201, json={"id": "ORDER-1"})

        config = SimpleNamespace(
            paypal_client_id="test-id", paypal_client_secret="test-secret"
        )
        with (
            httpx.Client(transport=httpx.MockTransport(request)) as client,
            patch.object(paypal, "settings", config),
            patch.object(paypal, "provider_client", return_value=client),
            patch.object(paypal, "_oauth_credentials", None),
        ):
            paypal.paypal(
                "POST", "/v2/checkout/orders", {"intent": "AUTHORIZE"}, key="stable-key"
            )
            paypal.paypal("GET", "/v2/checkout/orders/ORDER-1")
        self.assertEqual(len([r for r in calls if r.url.path == "/v1/oauth2/token"]), 1)
        self.assertEqual(calls[1].headers["paypal-request-id"], "stable-key")
        self.assertTrue(all(r.url.host == "api-m.sandbox.paypal.com" for r in calls))

    def test_real_webhook_verification_preserves_raw_json(self):
        raw = b'{"id":"WH-1", "amount":1.00,"text":"\\u00e9"}'
        headers = {name: "test-header" for name in webhooks.SIGNATURE_HEADERS.values()}
        with (
            patch.object(
                webhooks,
                "settings",
                SimpleNamespace(mode="connected", paypal_webhook_id="WH-APP"),
            ),
            patch.object(
                webhooks, "paypal", return_value={"verification_status": "SUCCESS"}
            ) as provider,
        ):
            self.assertTrue(webhooks.verify(headers, raw))
            sent = provider.call_args.kwargs["raw_json"]
            self.assertIn(b'"webhook_event":' + raw, sent)
            self.assertEqual(json.loads(sent)["webhook_id"], "WH-APP")
            self.assertFalse(webhooks.verify({}, raw))
            self.assertEqual(provider.call_count, 1)

    def test_webhook_never_fetches_untrusted_host(self):
        event = {
            "event_type": "PAYMENT.CAPTURE.COMPLETED",
            "resource": {
                "id": "CAPTURE-1",
                "links": [
                    {
                        "rel": "self",
                        "href": "https://attacker.invalid/v2/payments/captures/CAPTURE-1",
                    }
                ],
            },
        }
        with self.assertRaises(paypal.RecoveryRequired):
            webhooks.event_resource(event)
        event["resource"]["links"][0]["href"] = (
            paypal.BASE + "/v2/payments/captures/CAPTURE-1"
        )
        self.assertEqual(webhooks.event_resource(event)[0], "capture")

    def test_payout_webhooks_distinguish_nested_batch_and_item_resources(self):
        batch = {
            "event_type": "PAYMENT.PAYOUTSBATCH.SUCCESS",
            "resource": {
                "batch_header": {
                    "payout_batch_id": "BATCH-1",
                    "batch_status": "SUCCESS",
                }
            },
        }
        item = {
            "event_type": "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
            "resource": {"payout_batch_id": "BATCH-1", "payout_item_id": "ITEM-1"},
        }
        self.assertEqual(
            webhooks.event_resource(batch),
            ("payout", "BATCH-1", "/v1/payments/payouts/BATCH-1"),
        )
        self.assertEqual(
            webhooks.event_resource(item),
            ("payout_item", "ITEM-1", "/v1/payments/payouts-item/ITEM-1"),
        )

    def test_sandbox_script_only_accepts_real_sandbox_approval_urls(self):
        spec = importlib.util.spec_from_file_location(
            "paypal_sandbox", Path(__file__).parents[1] / "scripts/paypal_sandbox.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with self.assertRaises(RuntimeError):
            module.approval(
                {"links": [{"rel": "approve", "href": "https://attacker.invalid"}]}
            )
        self.assertEqual(
            module.approval(
                {
                    "links": [
                        {
                            "rel": "payer-action",
                            "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1",
                        }
                    ]
                }
            ),
            "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1",
        )
