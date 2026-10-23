"""Only code-owned payment mutations; durable intent precedes every network call."""

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from uuid import NAMESPACE_URL, uuid4, uuid5

from psycopg.types.json import Jsonb

from ..config import settings
from .paypal import (
    ProviderError,
    RecoveryRequired,
    amount_matches,
    money,
    paypal,
    resource_path,
)


@contextmanager
def payment_lock(db, scope):
    key = "rally-payment:" + str(scope)
    db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,1))", (key,))
    try:
        yield
        db.commit()
    except BaseException:
        db.rollback()
        raise


def operation(db, request_id):
    return db.execute(
        "SELECT * FROM payment_ops WHERE request_id=%s", (request_id,)
    ).fetchone()


def checked_result(op, data):
    """A successful HTTP response alone is never proof of a correct payment."""
    kind, request = op["kind"], op["request"]
    if kind == "void":
        if data.get("id") != request["resource_id"] or data.get("status") != "VOIDED":
            raise RecoveryRequired("Void not confirmed by provider GET.")
        return data
    if kind == "payout":
        header = data.get("batch_header", {})
        if (
            not header.get("payout_batch_id")
            or header.get("sender_batch_header", {}).get("sender_batch_id")
            != request["body"]["sender_batch_header"]["sender_batch_id"]
        ):
            raise RecoveryRequired("Payout batch identity mismatch.")
        if op.get("provider_ref") and header["payout_batch_id"] != op["provider_ref"]:
            raise RecoveryRequired("Provider GET resource identity changed.")
        if data.get("items"):
            if len(data["items"]) != 1:
                raise RecoveryRequired("Expected exactly one shop payout item.")
            item = data["items"][0].get("payout_item", {})
            expected = request["body"]["items"][0]
            amount = item.get("amount", {})
            if (
                item.get("receiver") != expected["receiver"]
                or item.get("sender_item_id") != expected["sender_item_id"]
                or not amount_matches(
                    {
                        "currency_code": amount.get("currency"),
                        "value": amount.get("value"),
                    },
                    request["amount_cents"],
                )
            ):
                raise RecoveryRequired(
                    "Payout recipient, item identity, or amount mismatch."
                )
        return data
    if not data.get("id"):
        raise RecoveryRequired("Missing provider resource identity.")
    if kind == "order":
        units = data.get("purchase_units", [])
        if (
            data.get("intent") != "AUTHORIZE"
            or len(units) != 1
            or units[0].get("custom_id") != str(op["member_id"])
        ):
            raise RecoveryRequired("Provider order identity mismatch.")
        resource = units[0]
        if (
            settings.paypal_merchant_id
            and resource.get("payee", {}).get("merchant_id")
            != settings.paypal_merchant_id
        ):
            raise RecoveryRequired("Provider merchant mismatch.")
    elif kind == "authorize":
        if data["id"] != request["resource_id"]:
            raise RecoveryRequired("Authorized order identity mismatch.")
        units = data.get("purchase_units", [])
        if len(units) != 1:
            raise RecoveryRequired("Expected one authorized purchase unit.")
        authorizations = units[0].get("payments", {}).get("authorizations", [])
        if len(authorizations) != 1:
            raise RecoveryRequired("Expected one authorization.")
        resource = authorizations[0]
        related = resource.get("supplementary_data", {}).get("related_ids", {})
        if related.get("order_id") not in (None, request["resource_id"]):
            raise RecoveryRequired("Authorization order mismatch.")
        if resource.get("status") not in ("CREATED", "PENDING"):
            raise RecoveryRequired("Authorization is not CREATED or PENDING.")
    else:
        resource = data
        if resource.get("status") not in (
            "COMPLETED",
            "PENDING",
            "REFUNDED",
            "PARTIALLY_REFUNDED",
            "DECLINED",
            "DENIED",
            "FAILED",
            "CANCELLED",
        ):
            raise RecoveryRequired("Payment did not complete or remain pending.")
        related = resource.get("supplementary_data", {}).get("related_ids", {})
        parent = "authorization_id" if kind == "capture" else "capture_id"
        if related.get(parent) not in (None, request["resource_id"]):
            raise RecoveryRequired("Provider payment parent mismatch.")
        parents = [
            urlsplit(link.get("href", ""))
            for link in resource.get("links", [])
            if link.get("rel") == "up"
        ]
        expected = resource_path(
            "authorize" if kind == "capture" else "capture", request["resource_id"]
        )
        if parents and not any(
            p.scheme == "https"
            and p.hostname in ("api-m.sandbox.paypal.com", "api.sandbox.paypal.com")
            and p.path == expected
            for p in parents
        ):
            raise RecoveryRequired("Provider payment parent link mismatch.")
        if kind == "capture" and resource.get("final_capture") is not True:
            raise RecoveryRequired("Provider capture was not final.")
    if not amount_matches(
        resource.get("amount", {}),
        request["amount_cents"],
        request.get("currency", "USD"),
    ):
        raise RecoveryRequired("Provider amount or currency mismatch.")
    ref = resource["id"] if kind == "authorize" else data["id"]
    if op.get("provider_ref") and ref != op["provider_ref"]:
        raise RecoveryRequired("Provider GET resource identity changed.")
    return data if kind == "order" else resource


def finish(db, op, data):
    with payment_lock(db, op["member_id"] or op["pool_id"]):
        return _finish(db, operation(db, op["request_id"]), data)


def _finish(db, op, data):
    result = checked_result(op, data)
    kind, request = op["kind"], op["request"]
    ref = (
        result["batch_header"]["payout_batch_id"] if kind == "payout" else result["id"]
    )
    pending = (
        kind in ("authorize", "capture", "refund") and result.get("status") == "PENDING"
    ) or (
        kind == "payout"
        and result["batch_header"]["batch_status"] in ("PENDING", "PROCESSING")
    )
    failed = result.get("status") in ("DECLINED", "DENIED", "FAILED", "CANCELLED") or (
        kind == "payout"
        and result["batch_header"]["batch_status"] in ("DENIED", "CANCELED")
    )
    if kind == "payout" and result["batch_header"]["batch_status"] == "SUCCESS":
        item_status = (result.get("items") or [{}])[0].get("transaction_status")
        failed = item_status in (
            "FAILED",
            "BLOCKED",
            "RETURNED",
            "REFUNDED",
            "CANCELED",
        )
        pending = not failed and item_status != "SUCCESS"
    if op.get("provider_ref") and op["provider_ref"] != ref:
        raise RecoveryRequired("Provider GET resource identity changed.")
    if op["status"] == "completed" and pending:
        return op["response"]
    if (
        kind == "capture"
        and op["status"] == "completed"
        and (op.get("response") or {}).get("status")
        in ("REFUNDED", "PARTIALLY_REFUNDED")
        and result.get("status") == "COMPLETED"
    ):
        return op["response"]
    if kind == "order":
        db.execute(
            "INSERT INTO holds(id,member_id,order_id,amount_cents,status,currency) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(order_id) DO NOTHING",
            (
                uuid4(),
                op["member_id"],
                ref,
                request["amount_cents"],
                "CREATED",
                request.get("currency", "USD"),
            ),
        )
    elif kind == "authorize" and not pending:
        created = datetime.fromisoformat(result["create_time"].replace("Z", "+00:00"))
        expires = datetime.fromisoformat(
            result["expiration_time"].replace("Z", "+00:00")
        )
        if (
            not created.tzinfo
            or not expires.tzinfo
            or expires <= datetime.now(timezone.utc)
        ):
            raise RecoveryRequired("Authorization dates are invalid or expired.")
        db.execute(
            "UPDATE holds SET authorization_id=%s,status='AUTHORIZED',honor_until=%s,expires_at=%s WHERE order_id=%s AND member_id=%s AND status IN ('CREATED','APPROVED','AUTHORIZED','PENDING')",
            (
                ref,
                min(expires, created + timedelta(days=3)),
                expires,
                request["resource_id"],
                op["member_id"],
            ),
        )
    elif kind in ("capture", "void") and not pending and not failed:
        db.execute(
            "UPDATE holds SET status=%s WHERE authorization_id=%s",
            ("CAPTURED" if kind == "capture" else "VOIDED", request["resource_id"]),
        )
    elif kind == "payout":
        latest = db.execute(
            "SELECT id FROM payment_ops WHERE pool_id=%s AND kind='payout' ORDER BY created_at DESC,id DESC LIMIT 1",
            (op["pool_id"],),
        ).fetchone()
        if latest and latest["id"] == op["id"]:
            db.execute(
                "INSERT INTO payouts(id,pool_id,batch_id,amount_cents,status) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(pool_id) DO UPDATE SET batch_id=EXCLUDED.batch_id,amount_cents=EXCLUDED.amount_cents,status=EXCLUDED.status",
                (
                    uuid4(),
                    op["pool_id"],
                    ref,
                    request["amount_cents"],
                    (
                        (result.get("items") or [{}])[0].get("transaction_status")
                        or "PROCESSING"
                    )
                    if result["batch_header"]["batch_status"] == "SUCCESS"
                    else result["batch_header"]["batch_status"],
                ),
            )
    db.execute(
        "UPDATE payment_ops SET status=%s,provider_ref=%s,response=%s WHERE id=%s",
        (
            "pending" if pending else "failed" if failed else "completed",
            ref,
            Jsonb(data),
            op["id"],
        ),
    )
    return data


def perform(
    db,
    kind,
    request_id,
    *,
    pool_id,
    member_id=None,
    amount_cents=None,
    resource_id=None,
    return_url=None,
    cancel_url=None,
    currency=None,
    expected_receiver=None,
):
    if not settings.paypal_merchant_id:
        raise RecoveryRequired(
            "PAYPAL_MERCHANT_ID is required before any money mutation."
        )
    if settings.mode != "connected":
        raise RecoveryRequired(
            "No fixture money movement; inject a transport only in tests."
        )
    if not isinstance(request_id, str) or not request_id or len(request_id) > 200:
        raise ValueError("A stable, bounded idempotency key is required.")
    if kind == "payout" and member_id is not None:
        raise ValueError("A payout belongs to a pool, never a member.")
    if currency is not None:
        money(1, currency)
    if kind == "payout" and currency not in (None, "USD"):
        raise ValueError("Shop payouts must be USD.")
    if expected_receiver is not None and (
        kind != "payout"
        or not isinstance(expected_receiver, str)
        or "@" not in expected_receiver
    ):
        raise ValueError("An expected receiver is only valid for a shop payout.")
    with payment_lock(db, member_id or pool_id):
        db.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,3))", (request_id,)
        )
        previous = operation(db, request_id)
        identity = {
            "amount_cents": amount_cents,
            "resource_id": resource_id,
            "return_url": return_url,
            "cancel_url": cancel_url,
        }
        # Omitted currency preserves the identity of pre-v2 USD operations.
        if currency is not None:
            identity["currency"] = currency
        if expected_receiver is not None:
            identity["expected_receiver"] = expected_receiver
        if previous:
            if (
                previous["kind"] != kind
                or str(previous["member_id"]) != str(member_id)
                or str(previous["pool_id"]) != str(pool_id)
                or previous["request"]["input"] != identity
            ):
                raise ValueError("Idempotency key reused for different payment terms.")
            if previous["status"] == "completed":
                return previous["response"]
            if previous["status"] != "ready":
                raise RecoveryRequired(
                    "Existing operation needs reconciliation; never retry with a new key."
                )
        if db.execute(
            "SELECT 1 FROM payment_ops WHERE (member_id=%s OR (%s::uuid IS NULL AND pool_id=%s)) AND status IN ('inflight','unknown','pending')",
            (member_id, member_id, pool_id),
        ).fetchone():
            raise RecoveryRequired(
                "Unresolved payment in this scope; reconcile it before any new mutation."
            )
        pool = db.execute("SELECT * FROM pools WHERE id=%s", (pool_id,)).fetchone()
        if not pool:
            raise ValueError("Unknown pool.")
        member = None
        if kind != "payout":
            member = db.execute(
                "SELECT * FROM members WHERE id=%s AND pool_id=%s", (member_id, pool_id)
            ).fetchone()
            if not member:
                raise ValueError("Unknown pool member.")
        wire_key = str(uuid5(NAMESPACE_URL, "rally:" + request_id))
        body = {}
        payment_currency = currency or "USD"
        if kind == "order":
            amount_cents = member["max_cents"]
            if pool["state"] != "OPEN":
                raise ValueError("Holds require an open pool.")
            if db.execute(
                "SELECT 1 FROM holds WHERE member_id=%s AND status IN ('CREATED','APPROVED','AUTHORIZED','PENDING')",
                (member_id,),
            ).fetchone():
                raise ValueError("Member already has an active hold.")
            body = {
                "intent": "AUTHORIZE",
                "purchase_units": [
                    {
                        "custom_id": str(member_id),
                        "amount": money(amount_cents, payment_currency),
                    }
                ],
            }
            if return_url or cancel_url:
                for url in (return_url, cancel_url):
                    parsed = urlsplit(url or "")
                    if parsed.scheme != "https" and not (
                        parsed.scheme == "http"
                        and parsed.hostname in ("localhost", "127.0.0.1")
                    ):
                        raise ValueError(
                            "Approval return URLs require HTTPS or localhost."
                        )
                body["payment_source"] = {
                    "paypal": {
                        "experience_context": {
                            "return_url": return_url,
                            "cancel_url": cancel_url,
                            "shipping_preference": "NO_SHIPPING",
                            "user_action": "PAY_NOW",
                        }
                    }
                }
            path = "/v2/checkout/orders"
        elif kind == "authorize":
            hold = db.execute(
                "SELECT * FROM holds WHERE member_id=%s AND order_id=%s AND status IN ('CREATED','APPROVED')",
                (member_id, resource_id),
            ).fetchone()
            if not hold or hold["amount_cents"] != member["max_cents"]:
                raise ValueError("Hold does not match member max.")
            payment_currency = hold["currency"]
            amount_cents = hold["amount_cents"]
            path = resource_path("order", resource_id) + "/authorize"
        elif kind in ("capture", "void"):
            hold = db.execute(
                "SELECT * FROM holds WHERE member_id=%s AND authorization_id=%s",
                (member_id, resource_id),
            ).fetchone()
            if not hold or hold["status"] != "AUTHORIZED":
                raise ValueError("Member has no active authorization.")
            payment_currency = hold["currency"]
            path = resource_path("authorize", resource_id) + "/" + kind
            if kind == "capture":
                money(amount_cents)
                if (
                    amount_cents > member["max_cents"]
                    or amount_cents > hold["amount_cents"]
                ):
                    raise ValueError("Capture exceeds member max or authorized amount.")
                if not hold["honor_until"] or hold["honor_until"] <= datetime.now(
                    timezone.utc
                ):
                    raise RecoveryRequired(
                        "Authorization honor period expired; reapprove a new hold."
                    )
                body = {
                    "amount": money(amount_cents, payment_currency),
                    "final_capture": True,
                }
        elif kind == "refund":
            money(amount_cents)
            capture = db.execute(
                "SELECT * FROM payment_ops WHERE member_id=%s AND kind='capture' AND provider_ref=%s AND status='completed'",
                (member_id, resource_id),
            ).fetchone()
            if not capture:
                raise ValueError("Unknown member capture.")
            payment_currency = capture["request"].get("currency", "USD")
            reserved = db.execute(
                "SELECT COALESCE(sum((request->>'amount_cents')::integer),0) AS total FROM payment_ops WHERE kind='refund' AND request->>'resource_id'=%s AND status!='failed'",
                (resource_id,),
            ).fetchone()["total"]
            if (
                amount_cents > member["max_cents"]
                or amount_cents + reserved > capture["request"]["amount_cents"]
            ):
                raise ValueError("Refund exceeds member max or unrefunded capture.")
            body = {"amount": money(amount_cents, payment_currency)}
            path = resource_path("capture", resource_id) + "/refund"
        elif kind == "payout":
            money(amount_cents)
            if not db.execute(
                "SELECT 1 FROM shipments WHERE pool_id=%s", (pool_id,)
            ).fetchone():
                raise ValueError("Shop payout requires shipment tracking.")
            if db.execute(
                "SELECT 1 FROM payment_ops WHERE pool_id=%s AND kind='payout' AND status!='failed'",
                (pool_id,),
            ).fetchone():
                raise ValueError("Pool already has a payout operation.")
            shop = db.execute(
                "SELECT * FROM shops WHERE id=%s", (pool["shop_id"],)
            ).fetchone()
            receiver = shop["payout_email"]
            if expected_receiver is not None and receiver != expected_receiver:
                raise ValueError("Payout receiver changed before submission.")
            if not receiver or "@" not in receiver:
                raise ValueError("Shop sandbox payout email is required.")
            body = {
                "sender_batch_header": {
                    "sender_batch_id": wire_key,
                    "email_subject": "Rally shop payment",
                },
                "items": [
                    {
                        "recipient_type": "EMAIL",
                        "receiver": receiver,
                        "amount": {
                            "currency": "USD",
                            "value": money(amount_cents)["value"],
                        },
                        "sender_item_id": wire_key,
                    }
                ],
            }
            path = "/v1/payments/payouts"
        else:
            raise ValueError("Unknown payment operation.")
        if currency is not None and currency != payment_currency:
            raise ValueError("Currency must match the original payment.")
        request = {
            "input": identity,
            "path": path,
            "body": body,
            "resource_id": resource_id,
            "amount_cents": amount_cents,
            "wire_key": wire_key,
        }
        if payment_currency != "USD":
            request["currency"] = payment_currency
        if previous and previous["request"] != request:
            raise ValueError(
                "Payment terms changed; create a new versioned operation key."
            )
        op = db.execute(
            "INSERT INTO payment_ops(id,kind,member_id,pool_id,request_id,status,request) VALUES(%s,%s,%s,%s,%s,'inflight',%s) ON CONFLICT(request_id) DO UPDATE SET status='inflight' WHERE payment_ops.status='ready' RETURNING *",
            (uuid4(), kind, member_id, pool_id, request_id, Jsonb(request)),
        ).fetchone()
        if not op:
            raise RecoveryRequired(
                "Operation was already claimed; reconcile before retrying."
            )
        db.commit()
    mutation_started = False
    try:
        if kind == "authorize":
            order = paypal("GET", resource_path("order", resource_id))
            if order.get("status") != "APPROVED":
                raise RecoveryRequired("Buyer must approve this order in the browser.")
            checked_result(
                {
                    "kind": "order",
                    "member_id": member_id,
                    "request": {
                        "amount_cents": amount_cents,
                        "currency": payment_currency,
                    },
                },
                order,
            )
            if order.get("id") != resource_id:
                raise RecoveryRequired("Order GET identity mismatch.")
        elif kind in ("capture", "void"):
            auth = paypal("GET", resource_path("authorize", resource_id))
            if (
                auth.get("id") != resource_id
                or auth.get("status") != "CREATED"
                or not amount_matches(
                    auth.get("amount", {}), hold["amount_cents"], payment_currency
                )
            ):
                raise RecoveryRequired(
                    "Authorization no longer available or amount mismatch."
                )
        mutation_started = True
        data = paypal("POST", path, body, key=wire_key)
        ref = (
            data.get("batch_header", {}).get("payout_batch_id")
            if kind == "payout"
            else data.get("id")
        )
        if kind == "authorize":
            ref = None
        db.execute(
            "UPDATE payment_ops SET provider_ref=%s,response=%s WHERE id=%s AND status='inflight'",
            (ref, Jsonb(data), op["id"]),
        )
        db.commit()
        if kind == "void":
            data = paypal("GET", resource_path("authorize", resource_id))
        return finish(db, op, data)
    except Exception as exc:
        db.rollback()
        failed = isinstance(exc, ProviderError) and exc.definitive
        db.execute(
            "UPDATE payment_ops SET status=%s WHERE id=%s AND status='inflight'",
            (
                "ready" if not mutation_started else "failed" if failed else "unknown",
                op["id"],
            ),
        )
        db.commit()
        raise


def reconcile(db, request_id):
    op = operation(db, request_id)
    db.commit()
    if not op:
        raise ValueError("Unknown operation.")
    if op["status"] == "completed":
        return op["response"]
    if op["kind"] in ("authorize", "void"):
        data = paypal(
            "GET",
            resource_path(
                "order" if op["kind"] == "authorize" else "authorize",
                op["request"]["resource_id"],
            ),
        )
    elif op["provider_ref"]:
        data = paypal("GET", resource_path(op["kind"], op["provider_ref"]))
    else:
        raise RecoveryRequired(
            "Ambiguous payment lacks a provider ID; inspect sandbox activity before recording recovery. Do not issue another mutation."
        )
    return finish(db, op, data)
