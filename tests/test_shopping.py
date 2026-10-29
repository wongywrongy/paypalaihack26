"""PostgreSQL + real ASGI routes with a provider double; never sandbox evidence."""

import copy
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import test_database as database_tests
from fastapi import Request
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb
from rally import api, orders, sessions, shopping, store, worker
from rally import db as database
from rally.negotiation.engine import negotiate
from rally.payments import ledger
from rally.payments.paypal import ProviderError, RecoveryRequired


class Provider:
    def __init__(self):
        self.orders, self.auths, self.captures, self.calls = {}, {}, {}, []
        self.payouts, self.refunds = {}, {}

    def __call__(self, method, path, body=None, **kwargs):
        self.calls.append((method, path))
        if path == "/v2/checkout/orders" and method == "POST":
            oid = "ORDER-" + uuid4().hex
            unit = copy.deepcopy(body["purchase_units"][0])
            unit["payee"] = {"merchant_id": "MERCHANT-TEST"}
            self.orders[oid] = {"id": oid, "intent": "AUTHORIZE", "status": "CREATED", "purchase_units": [unit], "links": [{"rel": "approve", "href": "https://www.sandbox.paypal.com/checkoutnow?token=" + oid}]}
            return copy.deepcopy(self.orders[oid])
        if path.endswith("/authorize"):
            oid = path.split("/")[-2]
            aid = "AUTH-" + uuid4().hex
            now = datetime.now(timezone.utc)
            auth = {"id": aid, "status": "CREATED", "amount": self.orders[oid]["purchase_units"][0]["amount"], "create_time": now.isoformat(), "expiration_time": (now + timedelta(days=29)).isoformat()}
            self.auths[aid] = auth
            self.orders[oid]["purchase_units"][0]["payments"] = {"authorizations": [auth]}
            return copy.deepcopy(self.orders[oid])
        if path.endswith("/capture"):
            aid = path.split("/")[-2]
            capture = {"id": uuid4().hex[:17].upper(), "status": "COMPLETED", "amount": body["amount"], "final_capture": True}
            self.captures[capture["id"]] = capture
            self.auths[aid]["status"] = "CAPTURED"
            for order in self.orders.values():
                if any(a["id"] == aid for a in order["purchase_units"][0].get("payments", {}).get("authorizations", [])):
                    order["purchase_units"][0]["payments"]["captures"] = [capture]
            return copy.deepcopy(capture)
        if path == "/v1/payments/payouts" and method == "POST":
            bid = "BATCH-" + uuid4().hex
            value = {"batch_header": {"payout_batch_id": bid, "batch_status": "SUCCESS", "sender_batch_header": body["sender_batch_header"]}, "items": [{"payout_item_id": "ITEM-" + uuid4().hex, "transaction_status": "SUCCESS", "payout_item": body["items"][0]}]}
            self.payouts[bid] = value
            return copy.deepcopy(value)
        if path.endswith("/refund"):
            value = {"id": "REFUND-" + uuid4().hex, "status": "COMPLETED", "amount": body["amount"]}
            self.refunds[value["id"]] = value
            return copy.deepcopy(value)
        if path.endswith("/track"):
            oid = path.split("/")[-2]
            self.orders[oid]["purchase_units"][0]["shipping"] = {"trackers": [{"id": body["capture_id"] + "-" + body["tracking_number"]}]}
            return copy.deepcopy(self.orders[oid])
        if path.endswith("/void"):
            aid = path.split("/")[-2]
            self.auths[aid]["status"] = "VOIDED"
            return {"http_status": 204}
        ref = path.rsplit("/", 1)[-1]
        if method == "GET":
            return copy.deepcopy((self.orders | self.auths | self.captures | self.payouts | self.refunds)[ref])
        raise AssertionError("Unexpected provider call")


@unittest.skipUnless(os.getenv("RALLY_TEST_DATABASE_URL"), "Requires disposable PostgreSQL")
class ShoppingContracts(unittest.TestCase):
    seed = database_tests.DatabaseContracts.seed
    seed_run = database_tests.DatabaseContracts.seed_run

    def setUp(self):
        database_tests.DatabaseContracts.setUp(self)
        self.config = replace(self.config, public_url="http://localhost:8000", paypal_client_id="CLIENT-TEST", deal_mode="exchange")
        self.patches = [patch.object(module, "settings", self.config) for module in (orders, sessions, shopping, api)]
        for p in self.patches:
            p.start()
        self.provider = Provider()
        self.transport = patch.object(ledger, "paypal", side_effect=self.provider)
        self.transport.start()
        self.client = TestClient(api.app)
        self.csrf = self.client.get("/api/session").json()["csrf_token"]
        self.payload = {"country": "US", "items": ["mul-gel-cleanser", "dal-rice-toner", "dal-snail-essence", "sae-cica-cream"], "rules": {"old_packaging_ok": True, "bundles_ok": True}}

    def tearDown(self):
        self.client.close()
        self.transport.stop()
        for p in self.patches:
            p.stop()
        database_tests.DatabaseContracts.tearDown(self)

    def post(self, path, body, **kwargs):
        return self.client.post("/api" + path, json=body, headers={"X-CSRF-Token": self.csrf}, **kwargs)

    def checkout(self):
        bag = self.post("/bags", self.payload)
        self.assertEqual(bag.status_code, 200, bag.text)
        bag = bag.json()
        paid = self.post(f"/bags/{bag['id']}/checkout", {"quote_id": bag["quote"]["id"]})
        self.assertEqual(paid.status_code, 200, paid.text)
        return bag, paid.json()

    def test_real_routes_approve_deal_capture_refresh_and_persistent_history(self):
        bag, checkout = self.checkout()
        oid = checkout["order_id"]
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        approved = self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(approved.json()["payment_state"], "AUTHORIZED")
        self.assertIsNone(approved.json()["charged_minor"])
        def fixture(start, destination, catalog, rules, **kwargs):
            return negotiate(start, destination, catalog, rules, choose=lambda role, payload: {"index": 0, "note": "Public terms."}, **kwargs)
        with patch.object(orders, "negotiate", side_effect=fixture):
            self.assertTrue(worker.run_once("ai"))
        waiting = self.client.get("/api/orders/" + oid).json()
        self.assertEqual(waiting["events"][-1]["kind"], "done")
        self.assertIsNone(waiting["charged_minor"])
        self.assertEqual(waiting["payment_state"], "COMPLETING_PAYMENT")
        self.assertTrue(worker.run_once("payments"))
        receipt = self.client.get("/api/orders/" + oid)
        self.assertEqual(receipt.status_code, 200, receipt.text)
        value = receipt.json()
        self.assertEqual(value["charged_minor"], 10786)
        self.assertEqual(value["payment_state"], "CHARGED")
        self.assertEqual(value["uncaptured_minor"], 1096)
        self.assertEqual(value["fulfillment_state"], "MERCHANT_CONFIRMED")
        self.assertFalse(any(line["added"] for line in value["lines"]))
        self.post("/reset", {})
        self.post("/bags", {**self.payload, "items": ["hay-foam"]})
        self.assertEqual(self.client.get("/api/orders").json()["orders"][0]["charged_minor"], 10786)
        before = list(self.provider.calls)
        self.assertTrue(self.client.get("/api/orders/" + oid).json()["events"])
        self.assertEqual(self.provider.calls, before)

    def test_csrf_scope_private_catalog_and_changed_quote_boundaries(self):
        missing = self.client.post("/api/bags", json=self.payload)
        self.assertEqual(missing.status_code, 403)
        foreign = self.client.post("/api/bags", json=self.payload, headers={"X-CSRF-Token": self.csrf, "Origin": "https://unrelated.test"})
        self.assertEqual(foreign.status_code, 403)
        public = self.client.get("/api/catalog").text
        self.assertNotIn("floor_usd", public)
        self.assertNotIn("cost_usd", public)
        bag, checkout = self.checkout()
        other = TestClient(api.app)
        other.get("/api/session")
        self.assertEqual(other.get("/api/orders/" + checkout["order_id"]).status_code, 404)
        other.close()
        changed = self.client.patch("/api/bags/" + bag["id"], json={**self.payload, "items": ["hay-foam"]}, headers={"X-CSRF-Token": self.csrf})
        self.assertEqual(changed.status_code, 200, changed.text)
        old = self.post(f"/bags/{bag['id']}/checkout", {"quote_id": bag["quote"]["id"]})
        self.assertEqual(old.status_code, 409)
        self.assertEqual(len([x for x in self.provider.calls if x == ("POST", "/v2/checkout/orders")]), 1)
        snapshot = self.client.get("/api/orders/" + checkout["order_id"]).json()
        self.assertEqual(snapshot["maximum_minor"], 11882)

    def test_duplicate_checkout_and_expiry_never_duplicate_provider_creation(self):
        bag, first = self.checkout()
        again = self.post(f"/bags/{bag['id']}/checkout", {"quote_id": bag["quote"]["id"]})
        self.assertEqual(first, again.json())
        with database.connect() as db:
            db.execute("UPDATE quotes SET expires_at=now()-interval '1 minute' WHERE id=%s", (bag["quote"]["id"],))
        expired = self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": first["paypal_order_id"]})
        self.assertEqual(expired.status_code, 409)
        self.assertFalse(any(path.endswith("/authorize") for _, path in self.provider.calls))

    def test_authorization_rejection_is_needs_review_not_a_spinning_approval(self):
        bag, checkout = self.checkout()
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        def rejected(method, path, *args, **kwargs):
            if method == "POST" and path.endswith("/authorize"):
                raise ProviderError("Provider rejected authorization", definitive=True)
            return self.provider(method, path, *args, **kwargs)
        with patch.object(ledger, "paypal", side_effect=rejected):
            response = self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        self.assertEqual(response.status_code, 503)
        row = self.client.get("/api/orders/" + checkout["order_id"]).json()
        self.assertEqual(row["payment_state"], "NEEDS_REVIEW")
        self.assertIsNone(row["charged_minor"])
        self.assertEqual(row["fulfillment_state"], "AWAITING_FUNDING")

    def test_interrupted_worker_preserves_partial_events_and_uses_checkout(self):
        bag, checkout = self.checkout()
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        oid = checkout["order_id"]
        orders.persist_event(oid, {"id": str(uuid4()), "kind": "offer", "t": 0, "total": 11882})
        with patch.object(orders, "negotiate") as model:
            worker.run_once("ai")
            model.assert_not_called()
        worker.run_once("payments")
        row = self.client.get("/api/orders/" + oid).json()
        self.assertEqual(row["charged_minor"], 11882)
        self.assertTrue(any(e["kind"] == "error" for e in row["events"]))

    def test_cancel_before_approval_rejects_delayed_callback_and_checkout_reuse(self):
        bag, checkout = self.checkout()
        oid = checkout["order_id"]
        self.assertEqual(self.post(f"/orders/{oid}/cancel", {}).status_code, 200)
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        late = self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        self.assertEqual(late.status_code, 409)
        reused = self.post(f"/bags/{bag['id']}/checkout", {"quote_id": bag["quote"]["id"]})
        self.assertEqual(reused.status_code, 409)
        self.assertFalse(any(path.endswith("/authorize") for _, path in self.provider.calls))

    def test_pre_authorization_failure_can_expire_and_cannot_be_reclaimed(self):
        from rally import maintenance

        bag, checkout = self.checkout()
        early = self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        self.assertEqual(early.status_code, 409)
        oid = checkout["order_id"]
        with database.connect() as db:
            row = orders.owned(db, oid)
            self.assertEqual(row["payment_state"], "AWAITING_APPROVAL")
            self.assertEqual(ledger.operation(db, f"order:{oid}:authorize")["status"], "ready")
            db.execute("UPDATE quotes SET expires_at=now()-interval '1 minute' WHERE id=%s", (row["quote_id"],))
        maintenance.run_once()
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        with database.connect() as db:
            self.assertEqual(orders.owned(db, oid)["payment_state"], "VOIDED")
            with self.assertRaises(RecoveryRequired):
                ledger.perform(db, "authorize", f"order:{oid}:authorize", pool_id=row["pool_id"], member_id=row["member_id"], resource_id=checkout["paypal_order_id"], currency="USD")
        self.assertFalse(any(path.endswith("/authorize") for _, path in self.provider.calls))

    def test_definitive_capture_failure_voids_hold_but_unknown_never_retries(self):
        for definitive in (True, False):
            bag, checkout = self.checkout()
            oid = checkout["order_id"]
            self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
            self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
            orders.persist_event(oid, {"id": str(uuid4()), "kind": "offer", "t": 0, "total": 11882})
            worker.run_once("ai")
            def response(method, path, *args, **kwargs):
                if method == "POST" and path.endswith("/capture"):
                    if not definitive:
                        self.provider(method, path, *args, **kwargs)
                    raise ProviderError("Provider outcome", definitive=definitive)
                return self.provider(method, path, *args, **kwargs)
            with patch.object(ledger, "paypal", side_effect=response):
                worker.run_once("payments")
                if not definitive:
                    before = list(self.provider.calls)
                    with database.connect() as db:
                        db.execute("UPDATE jobs SET run_at=now() WHERE dedupe_key=%s", (f"capture:{oid}",))
                    worker.run_once("payments")
                    self.assertEqual(self.provider.calls, before)
            saved = self.client.get("/api/orders/" + oid).json()
            self.assertEqual(saved["payment_state"], "VOIDED" if definitive else "NEEDS_REVIEW")
            self.assertIsNone(saved["charged_minor"])
            self.assertEqual(saved["fulfillment_state"], "AWAITING_FUNDING")

    def test_quote_fx_stays_locked_during_negotiation_and_receipt_serialization(self):
        from rally.fx import RATES

        self.payload["country"] = "CA"
        bag, checkout = self.checkout()
        oid = checkout["order_id"]
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        def fixture(*args, **kwargs):
            return negotiate(*args, **kwargs, choose=lambda role, payload: {"index": 0, "note": "Public terms."})
        with patch.dict(RATES, {"CAD": 999}):
            with patch.object(orders, "negotiate", side_effect=fixture):
                worker.run_once("ai")
            worker.run_once("payments")
            row = self.client.get("/api/orders/" + oid).json()
        self.assertEqual(row["maximum_minor"], 16087)
        self.assertEqual(row["charged_minor"], 14683)
        self.assertEqual(sum(line["unit"] for line in row["lines"]), row["breakdown"]["goods"])

    def test_scheduled_logistics_is_opt_in_and_waits_for_confirmed_payouts(self):
        from rally import fulfillment

        oid = self.charged_order()
        with database.connect() as db:
            db.execute("UPDATE payment_ops SET created_at=now()-interval '5 minutes' WHERE request_id=%s", (f"order:{oid}:capture",))
        with patch.dict(os.environ, {"RALLY_AUTO_FULFILLMENT": "0"}):
            fulfillment.scheduled_steps()
        self.assertEqual(self.client.get("/api/orders/" + oid).json()["fulfillment_state"], "MERCHANT_CONFIRMED")
        with patch.dict(os.environ, {"RALLY_AUTO_FULFILLMENT": "1", "PAYPAL_SHOP_EMAIL_DALBIT": "dalbit@example.test", "PAYPAL_SHOP_EMAIL_BADA": "bada@example.test"}):
            fulfillment.scheduled_steps()
            fulfillment.scheduled_steps()
            self.assertEqual(self.client.get("/api/orders/" + oid).json()["fulfillment_state"], "AT_HUB")
            worker.run_once("payments")
            worker.run_once("payments")
            fulfillment.scheduled_steps()
            worker.run_once("payments")
            fulfillment.scheduled_steps()
        self.assertEqual(self.client.get("/api/orders/" + oid).json()["fulfillment_state"], "DELIVERED")
        with database.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) AS n FROM payment_ops WHERE kind='payout'").fetchone()["n"], 2)

    def charged_order(self):
        bag, checkout = self.checkout()
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        approved = self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        self.assertEqual(approved.status_code, 200, approved.text)
        def fixture(start, destination, catalog, rules, **kwargs):
            return negotiate(start, destination, catalog, rules, choose=lambda role, payload: {"index": 0, "note": "Public terms."}, **kwargs)
        with patch.object(orders, "negotiate", side_effect=fixture):
            worker.run_once("ai")
        worker.run_once("payments")
        return checkout["order_id"]

    def test_auction_moves_reservations_and_free_shipping_is_not_paid_to_shop(self):
        from rally import fulfillment
        from rally.negotiation.auction import run_auction

        config = replace(self.config, deal_mode="auction")
        def fixture(start, destination, catalog, rules, **kwargs):
            kwargs["pace"] = False
            return run_auction(start, destination, catalog, rules, choose=lambda role, payload: {"indexes": [0], "note": "Please bid."} if role == "buyer" else {"index": 0, "note": "Our bid."}, **kwargs)
        with patch.object(orders, "settings", config), patch.object(orders, "run_auction", side_effect=fixture):
            bag, checkout = self.checkout()
            oid = checkout["order_id"]
            self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
            self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
            self.assertTrue(worker.run_once("ai"))
        with database.connect() as db:
            row = orders.owned(db, oid)
            self.assertEqual(row["final_terms"]["auction"]["rounds"], 3)
            self.assertEqual(row["final_terms"]["domestic_usd"], {"haneul": 0, "dalbit": 0})
            reservations = {r["offer_id"]: r["state"] for r in db.execute("SELECT * FROM order_reservations WHERE order_id=%s", (oid,)).fetchall()}
            self.assertEqual(reservations["bada/mul-gel-cleanser"], "released")
            self.assertEqual(reservations["haneul/mul-gel-cleanser"], "reserved")
            self.assertEqual(db.execute("SELECT stock FROM catalog_offers WHERE id='bada/mul-gel-cleanser'").fetchone()["stock"], 100)
            self.assertEqual(db.execute("SELECT stock FROM catalog_offers WHERE id='haneul/mul-gel-cleanser'").fetchone()["stock"], 99)
        self.assertTrue(worker.run_once("payments"))
        receipt = self.client.get("/api/orders/" + oid).json()
        self.assertEqual(receipt["charged_minor"], 10192)
        self.assertEqual(receipt["events"][0]["v"], 3)
        self.assertEqual(receipt["auction"]["winners"]["mul-gel-cleanser"]["shop"], "haneul")
        with database.connect() as db:
            fulfillment.handoff(db, orders.identifier(oid), "haneul", "Rally", "LOCAL-HANEUL")
            payment = db.execute("SELECT * FROM order_shop_payments WHERE order_id=%s AND shop_id='haneul'", (oid,)).fetchone()
            self.assertEqual(payment["amount_usd"], 2900)
            outbid = fulfillment.merchant_orders(db, "bada")["orders"][0]
            self.assertEqual(outbid["payout"]["status"], "outbid")
            self.assertEqual(outbid["events"][0]["v"], 3)
            self.assertEqual({pid: outbid["lowest"][pid] for pid in ("mul-gel-cleanser", "dal-rice-toner", "sae-cica-cream")}, {"mul-gel-cleanser": 1000, "dal-rice-toner": 1650, "sae-cica-cream": 1600})

    def test_interrupted_auction_emits_the_retained_checkout_award(self):
        from rally.catalog import Catalog
        from rally.negotiation.auction import run_auction
        from rally.sourcing import source

        catalog = Catalog()
        recording = run_auction(source(self.payload["items"], "US", catalog), "US", catalog, self.payload["rules"], choose=lambda role, payload: {"indexes": [0], "note": "Ask."} if role == "buyer" else {"index": 0, "note": "Bid."})
        with patch.object(orders, "settings", replace(self.config, deal_mode="auction")):
            bag, checkout = self.checkout()
        oid = checkout["order_id"]
        self.provider.orders[checkout["paypal_order_id"]]["status"] = "APPROVED"
        self.post(f"/bags/{bag['id']}/checkout/approve", {"order_id": checkout["paypal_order_id"]})
        orders.persist_event(oid, recording["events"][0])
        with patch.object(orders, "run_auction") as model:
            self.assertTrue(worker.run_once("ai"))
            model.assert_not_called()
        self.assertTrue(worker.run_once("payments"))
        row = self.client.get("/api/orders/" + oid).json()
        self.assertEqual(row["charged_minor"], 11882)
        self.assertEqual(row["events"][-2]["kind"], "award")
        self.assertEqual(row["events"][-2]["winners"]["mul-gel-cleanser"]["shop"], "bada")
        self.assertEqual(row["auction"]["winners"], row["events"][-2]["winners"])

    def login(self, role, password, shop_id=None):
        response = self.post("/login", {"role": role, "password": password, "shop_id": shop_id})
        self.assertEqual(response.status_code, 200, response.text)
        self.csrf = response.json()["csrf_token"]

    def test_shop_scope_read_only_access_payouts_tracking_and_true_up(self):
        env = {"RALLY_SHOP_PASSWORD_DALBIT": "dalbit-test", "RALLY_SHOP_PASSWORD_BADA": "bada-test", "RALLY_HUB_PASSWORD": "hub-test", "RALLY_JUDGE_PASSWORD": "judge-test", "PAYPAL_SHOP_EMAIL_DALBIT": "dalbit@example.test", "PAYPAL_SHOP_EMAIL_BADA": "bada@example.test"}
        with patch.dict(os.environ, env):
            oid = self.charged_order()
            self.assertEqual(self.client.get("/api/shops/dalbit/products").status_code, 403)
            self.login("shop", "judge-test", "dalbit")
            readonly = self.client.patch("/api/shops/dalbit/settings", json={"discount_bp": 1000, "sample_kit": True}, headers={"X-CSRF-Token": self.csrf})
            self.assertEqual(readonly.status_code, 403)
            self.assertEqual(self.client.get("/api/shops/bada/products").status_code, 403)
            for shop in ("dalbit", "bada"):
                self.login("shop", shop + "-test", shop)
                products = self.client.get(f"/api/shops/{shop}/products").json()["products"]
                self.assertTrue(all(p["offer_id"].startswith(shop + "/") for p in products))
                handoff = self.post(f"/shops/{shop}/orders/{oid}/handoff", {"carrier": "Rally sandbox", "tracking": "HUB-" + shop})
                self.assertEqual(handoff.status_code, 200, handoff.text)
                worker.run_once("payments")
            self.login("hub", "hub-test")
            shipped = self.post(f"/hub/orders/{oid}/ship", {"carrier": "Rally sandbox", "tracking": "BOX-ONE"})
            self.assertEqual(shipped.status_code, 200, shipped.text)
            worker.run_once("payments")
            with database.connect() as db:
                tracking = db.execute("SELECT status FROM tracking_operations WHERE order_id=%s", (oid,)).fetchone()
                self.assertEqual(tracking["status"], "completed")
            refund = self.post(f"/hub/orders/{oid}/true-up", {"actual_minor": 1000})
            self.assertEqual(refund.json()["refund_minor"], 436)
            worker.run_once("payments")
            receipt = self.client.get("/api/orders/" + oid).json()
            self.assertEqual(receipt["payment_state"], "CHARGED")
            self.assertEqual(receipt["refunded_minor"], 436)
            self.assertEqual(receipt["fulfillment_state"], "SHIPPED")
            before = len(self.provider.calls)
            self.post(f"/hub/orders/{oid}/true-up", {"actual_minor": 1000})
            self.assertEqual(len(self.provider.calls), before)
            with database.connect() as db:
                self.assertEqual(db.execute("SELECT count(*) AS n FROM payment_ops WHERE kind='payout'").fetchone()["n"], 2)

    def test_deadline_refund_releases_only_its_own_stock_once(self):
        from rally import maintenance

        oid = self.charged_order()
        with database.connect() as db:
            db.execute("UPDATE orders SET ship_by=now()-interval '1 minute' WHERE id=%s", (oid,))
        maintenance.run_once()
        worker.run_once("payments")
        row = self.client.get("/api/orders/" + oid).json()
        self.assertEqual(row["payment_state"], "REFUNDED")
        self.assertEqual(row["refunded_minor"], row["charged_minor"])
        with database.connect() as db:
            stocks = {r["id"]: r["stock"] for r in db.execute("SELECT id,stock FROM catalog_offers").fetchall()}
        self.client.get("/api/orders/" + oid)
        with database.connect() as db:
            self.assertEqual(stocks, {r["id"]: r["stock"] for r in db.execute("SELECT id,stock FROM catalog_offers").fetchall()})

    def test_concurrent_last_unit_reservations_and_separate_job_lanes(self):
        with database.connect() as db:
            store.seed(db)
            db.execute("UPDATE catalog_offers SET stock=CASE WHEN id='bada/hay-foam' THEN 1 ELSE 0 END WHERE product_id='hay-foam'")
        payload = {**self.payload, "items": ["hay-foam"]}
        bag1 = self.post("/bags", payload).json()
        bag2 = self.post("/bags", payload).json()
        def attempt(bag):
            return self.post(f"/bags/{bag['id']}/checkout", {"quote_id": bag["quote"]["id"]}).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = sorted(executor.map(attempt, [bag1, bag2]))
        self.assertEqual(statuses, [200, 400])
        with database.connect() as db:
            self.assertEqual(db.execute("SELECT stock FROM catalog_offers WHERE id='bada/hay-foam'").fetchone()["stock"], 0)
            database.enqueue(db, "negotiate", {"order_id": str(uuid4())}, "separate-ai")
            database.enqueue(db, "webhook", {"event_id": str(uuid4())}, "separate-payment")
            db.commit()
            self.assertEqual(worker.claim(db, "payments")["kind"], "webhook")
            self.assertEqual(worker.claim(db, "ai")["kind"], "negotiate")

    def test_legacy_receipts_keep_original_cookie_scope_and_recovery_is_read_only(self):
        from rally import legacy

        with patch.dict(os.environ, {"RALLY_HUB_PASSWORD": "hub-test"}):
            self.login("hub", "hub-test")
        token, owner_id, other = "a" * 32, uuid4(), uuid4()
        run_id, buyer_id, group_id, commitment_id = [uuid4() for _ in range(4)]
        cookie = f"coalition_session={token}; rally_session={self.client.cookies.get('rally_session')}"
        request = Request({"type": "http", "headers": [(b"cookie", cookie.encode())]})
        consent = {"title": "Historical headphones", "variant": "Black", "maximum": 6500}
        with database.connect() as db:
            self.assertFalse(legacy.available(db), "Use an isolated database with no historical public tables.")
            with db.transaction(force_rollback=True):
                db.execute("""
                    CREATE TABLE public.runs(id uuid PRIMARY KEY,mode text);
                    CREATE TABLE public.buyers(id uuid PRIMARY KEY,run_id uuid,owner_id uuid);
                    CREATE TABLE public.sessions(token_hash text,buyer_id uuid,expires_at timestamptz);
                    CREATE TABLE public.groups(id uuid PRIMARY KEY,run_id uuid,status text);
                    CREATE TABLE public.commitments(id uuid,group_id uuid,buyer_id uuid,accepted_terms jsonb,amount_minor integer,currency text,authorization_status text,capture_status text,refund_status text,void_status text,active boolean,captured_minor integer,created_at timestamptz);
                    CREATE TABLE public.payment_operations(id uuid,commitment_id uuid,kind text,status text,amount_minor integer,first_attempt_at timestamptz,updated_at timestamptz);
                """)
                db.execute("INSERT INTO public.runs VALUES(%s,'connected')", (run_id,))
                db.execute("INSERT INTO public.buyers VALUES(%s,%s,%s)", (buyer_id, run_id, owner_id))
                db.execute("INSERT INTO public.sessions VALUES(%s,%s,now()+interval '1 day')", (sessions.digest(token), buyer_id))
                db.execute("INSERT INTO public.groups VALUES(%s,%s,'SUCCEEDED')", (group_id, run_id))
                db.execute("INSERT INTO public.commitments VALUES(%s,%s,%s,%s,6500,'USD','AUTHORIZED','COMPLETED',NULL,NULL,true,6400,now())", (commitment_id, group_id, buyer_id, Jsonb(consent)))
                other_buyer = uuid4()
                db.execute("INSERT INTO public.buyers VALUES(%s,%s,%s)", (other_buyer, run_id, other))
                db.execute("INSERT INTO public.sessions VALUES(%s,%s,now()+interval '1 day')", (sessions.digest("b" * 32), other_buyer))
                db.execute("INSERT INTO public.commitments VALUES(%s,%s,%s,%s,6500,'USD',NULL,NULL,NULL,NULL,true,NULL,now())", (uuid4(), group_id, other_buyer, Jsonb({"title": "Other buyer's receipt"})))
                db.execute("INSERT INTO public.payment_operations VALUES(%s,%s,'order','unknown',6500,now(),now())", (uuid4(), commitment_id))
                rows = legacy.purchases(db, request)
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["terms"], consent)
                self.assertEqual(rows[0]["captured_minor"], 6400)
                with patch.object(legacy, "connect", return_value=nullcontext(db)):
                    recovery = legacy.recovery(request)
                self.assertEqual(recovery["operations"][0]["status"], "unknown")
                self.assertNotIn("response", recovery["operations"][0])
                other_request = Request({"type": "http", "headers": [(b"cookie", ("coalition_session=" + "b" * 32).encode())]})
                self.assertEqual([r["terms"] for r in legacy.purchases(db, other_request)], [{"title": "Other buyer's receipt"}])
                self.assertEqual(legacy.purchases(db, Request({"type": "http", "headers": [(b"cookie", b"coalition_session=unowned")]})), [])
                db.execute("UPDATE public.sessions SET expires_at=now()-interval '1 minute'")
                self.assertEqual(legacy.purchases(db, request), [])
            self.assertFalse(legacy.available(db))
