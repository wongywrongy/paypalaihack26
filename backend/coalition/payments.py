"""Sandbox only. Every mutation has one durable logical operation and stable request ID."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4

import httpx
from psycopg.types.json import Jsonb

from .config import settings

BASE = "https://api-m.sandbox.paypal.com"


class ProviderError(RuntimeError):
    def __init__(self, message, definitive=False):
        super().__init__(message)
        self.definitive = definitive


class RecoveryRequired(RuntimeError):
    pass


def amount_matches(data, minor=6500):
    try:
        return (
            data["currency_code"] == "USD"
            and Decimal(data["value"]) == Decimal(minor) / 100
        )
    except (KeyError, InvalidOperation, TypeError):
        return False


def paypal(method, path, body=None, key=None):
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RecoveryRequired(
            "PayPal sandbox credentials missing; no fixture fallback."
        )
    with httpx.Client(timeout=25) as client:
        token = client.post(
            BASE + "/v1/oauth2/token",
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            data={"grant_type": "client_credentials"},
        )
        if token.status_code != 200:
            raise RecoveryRequired("PayPal OAuth failed; check sandbox credentials.")
        headers = {
            "Authorization": "Bearer " + token.json()["access_token"],
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        if key:
            headers["PayPal-Request-Id"] = str(key)
        response = client.request(method, BASE + path, headers=headers, json=body)
        if response.status_code >= 400:
            # Timeouts/conflicts/5xx remain ambiguous and must be reconciled.
            definitive = response.status_code in (400, 403, 404, 422)
            data = response.json() if response.content else {}
            codes = ",".join(x.get("issue", "") for x in data.get("details", []))
            if codes in (
                "PREVIOUS_REQUEST_IN_PROGRESS",
                "ORDER_ALREADY_AUTHORIZED",
                "AUTHORIZATION_ALREADY_CAPTURED",
                "AUTHORIZATION_ALREADY_VOIDED",
            ):
                definitive = False
            raise ProviderError(
                f"PayPal HTTP {response.status_code}: {codes or data.get('name', 'request failed')}",
                definitive,
            )
        return response.json() if response.content else {"status": "VOIDED"}


def validate_order(data, c):
    units = data.get("purchase_units", [])
    if (
        data.get("id") != c["order_id"]
        or data.get("intent") != "AUTHORIZE"
        or len(units) != 1
        or units[0].get("custom_id") != str(c["id"])
        or not amount_matches(units[0].get("amount", {}))
    ):
        raise RecoveryRequired(
            "Provider order identity or amount mismatch; manual review required."
        )
    if (
        settings.mode == "connected"
        and units[0].get("payee", {}).get("merchant_id") != settings.paypal_merchant_id
    ):
        raise RecoveryRequired("Provider merchant identity mismatch.")
    return units[0]


def merge_status(old, new, kind):
    """Provider observations cannot regress a terminal state on delayed events."""
    terminals = {
        "authorization": {"VOIDED", "CAPTURED", "DENIED", "EXPIRED"},
        "capture": {
            "COMPLETED",
            "REFUNDED",
            "REVERSED",
            "DENIED",
            "DECLINED",
            "FAILED",
        },
        "refund": {"COMPLETED", "FAILED", "CANCELLED"},
    }
    if old in terminals[kind]:
        if kind == "capture" and old == "COMPLETED" and new in ("REFUNDED", "REVERSED"):
            return new
        return old
    return new or old


def observe(db, c, kind, data, source=None, event_id=None):
    source = source or ("fixture" if settings.mode == "fixture" else "api")
    from .groups import lock_group

    if c.get("group_id"):
        lock_group(db, c["group_id"])
    current = db.execute("SELECT * FROM commitments WHERE id=%s", (c["id"],)).fetchone()
    if current:
        c = {**c, **current}
    if kind in ("authorize", "capture", "refund"):
        if not amount_matches(data.get("amount", {})):
            raise RecoveryRequired("Provider payment amount mismatch.")
        if settings.mode == "connected":
            related = data.get("supplementary_data", {}).get("related_ids", {})
            if related.get("order_id") and related["order_id"] != c["order_id"]:
                raise RecoveryRequired("Provider payment belongs to a different order.")
            if (
                kind == "capture"
                and related.get("authorization_id")
                and related["authorization_id"] != c["authorization_id"]
            ):
                raise RecoveryRequired(
                    "Provider capture belongs to a different authorization."
                )
            if kind == "refund":
                from urllib.parse import urlparse

                parents = [
                    urlparse(link.get("href", ""))
                    for link in data.get("links", [])
                    if link.get("rel") == "up"
                ]
                if not any(
                    url.scheme == "https"
                    and url.hostname
                    in ("api-m.sandbox.paypal.com", "api.sandbox.paypal.com")
                    and url.path == f"/v2/payments/captures/{c['capture_id']}"
                    for url in parents
                ):
                    raise RecoveryRequired(
                        "Provider refund does not belong to this capture."
                    )
        column = {
            "authorize": "authorization",
            "capture": "capture",
            "refund": "refund",
        }[kind]
        previous = c.get(column + "_id")
        if previous and previous != data["id"]:
            raise RecoveryRequired(
                "Multiple provider IDs for one logical payment operation."
            )
        status = merge_status(c.get(column + "_status"), data.get("status"), column)
        if (
            settings.mode == "connected"
            and kind in ("authorize", "capture")
            and data.get("payee", {}).get("merchant_id")
            not in (None, settings.paypal_merchant_id)
        ):
            raise RecoveryRequired("Payment merchant mismatch.")
        if kind == "authorize":
            db.execute(
                "UPDATE commitments SET authorization_expires_at=COALESCE(%s,authorization_expires_at),authorization_created_at=COALESCE(%s,authorization_created_at) WHERE id=%s",
                (data.get("expiration_time"), data.get("create_time"), c["id"]),
            )
        db.execute(
            f"UPDATE commitments SET {column}_id=%s,{column}_status=%s,error=NULL WHERE id=%s",
            (data["id"], status, c["id"]),
        )
    elif kind == "void":
        db.execute(
            "UPDATE commitments SET void_status='VOIDED',authorization_status=CASE WHEN authorization_status='CAPTURED' THEN authorization_status ELSE 'VOIDED' END,error=NULL WHERE id=%s",
            (c["id"],),
        )
    if kind == "void" or kind == "authorize" and status in ("VOIDED", "EXPIRED"):
        db.execute(
            "UPDATE commitments c SET active=false,admitted=false FROM groups g WHERE c.id=%s AND g.id=c.group_id AND g.status='OPEN'",
            (c["id"],),
        )
    old_status = c.get(
        {
            "authorize": "authorization_status",
            "capture": "capture_status",
            "refund": "refund_status",
            "void": "void_status",
        }.get(kind, "order_id")
    )
    new_status = (
        status
        if kind in ("authorize", "capture", "refund")
        else data.get("status")
        if kind != "order"
        else data.get("id")
    )
    if kind == "void":
        new_status = "VOIDED"
    if old_status != new_status:
        db.execute(
            "INSERT INTO payment_observations(commitment_id,kind,provider_status,source,event_id,resource_id) VALUES(%s,%s,%s,%s,%s,%s)",
            (c["id"], kind, new_status, source, event_id, data.get("id")),
        )
        db.execute(
            "UPDATE commitments SET evidence_source=%s,observed_at=clock_timestamp(),evidence_event_id=%s WHERE id=%s",
            (source, event_id, c["id"]),
        )
    if kind != "order":
        db.execute(
            "UPDATE payment_operations SET status='completed',response=%s,error=NULL,updated_at=now() WHERE commitment_id=%s AND kind=%s AND status IN ('inflight','unknown')",
            (Jsonb(data), c["id"], kind),
        )
    if kind == "order":
        url = next(
            (
                x["href"]
                for x in data.get("links", [])
                if x["rel"] in ("approve", "payer-action")
            ),
            None,
        )
        if not url:
            raise RecoveryRequired("PayPal did not supply buyer approval URL.")
        db.execute(
            "UPDATE commitments SET order_id=%s,approval_url=%s,error=NULL WHERE id=%s",
            (data["id"], url, c["id"]),
        )

    if kind == "authorize":
        from .groups import admit

        admit(db, c["id"])


def fixture_result(c, kind, op, scenario):
    provider_id = "FIXTURE-" + str(op["id"])
    if kind == "order":
        return {
            "id": provider_id,
            "links": [{"rel": "approve", "href": "#fixture-approval"}],
        }
    if kind == "capture" and scenario in ("partial", "refund_pending"):
        # Deterministic fault injection is confined to explicitly labeled fixture runs.
        if c.get("fault_member"):
            raise ProviderError("Fixture: fifth capture declined", True)
    return {
        "id": provider_id,
        "amount": {"currency_code": "USD", "value": "65.00"},
        "create_time": datetime.now(timezone.utc).isoformat(),
        "expiration_time": (
            datetime.now(timezone.utc) + timedelta(days=29)
        ).isoformat(),
        "status": ("PENDING" if scenario == "refund_pending" else "COMPLETED")
        if kind == "refund"
        else {"authorize": "CREATED", "capture": "COMPLETED", "void": "VOIDED"}[kind],
    }


def perform(db, c, kind, scenario=None):
    from .groups import expired, lock_group

    current = db.execute(
        "SELECT c.*,g.run_id,r.scenario FROM commitments c JOIN groups g ON g.id=c.group_id JOIN runs r ON r.id=g.run_id WHERE c.id=%s",
        (c["id"],),
    ).fetchone()
    c = {**c, **current}
    scenario = scenario or c["scenario"]
    group = lock_group(db, c["group_id"])
    if kind == "capture" and group["status"] != "SETTLING":
        raise RecoveryRequired("Captures are forbidden once unwinding begins.")
    if kind in ("order", "authorize") and (
        group["status"] != "OPEN"
        or not c["active"]
        or c["withdrawn"]
        or expired(db, c["reservation_expires_at"])
        or expired(db, group["deadline"])
    ):
        db.commit()
        reconcile(db, c)
        return

    run = db.execute(
        "SELECT r.mode FROM runs r JOIN groups g ON g.run_id=r.id JOIN commitments c ON c.group_id=g.id WHERE c.id=%s",
        (c["id"],),
    ).fetchone()
    if not run or run["mode"] != settings.mode:
        raise RecoveryRequired("Payment mode does not match its isolated demo run.")
    db.execute(
        "INSERT INTO payment_operations(id,commitment_id,kind) VALUES(%s,%s,%s) ON CONFLICT DO NOTHING",
        (uuid4(), c["id"], kind),
    )
    db.commit()
    op = db.execute(
        "SELECT * FROM payment_operations WHERE commitment_id=%s AND kind=%s",
        (c["id"], kind),
    ).fetchone()
    if op["status"] == "completed":
        observe(db, c, kind, op["response"])
        db.commit()
        return
    if op["status"] == "declined":
        if kind == "capture":
            return
        raise RecoveryRequired(
            op["error"]
            or "Provider declined this operation; operator review is required."
        )
    retry_hours = 5 if kind in ("order", "authorize") else settings.payments_retry_hours
    if (
        op["first_attempt_at"]
        and settings.mode == "connected"
        and (datetime.now(timezone.utc) - op["first_attempt_at"]).total_seconds()
        > retry_hours * 3600
        and kind != "void"
    ):
        raise RecoveryRequired(
            "Idempotency retry window exceeded. Reconcile provider records; do not retry a financial POST blindly."
        )
    claimed = db.execute(
        "UPDATE payment_operations SET status='inflight',first_attempt_at=COALESCE(first_attempt_at,now()),updated_at=now(),lease_until=now()+interval '2 minutes',lease_token=%s WHERE id=%s AND (status!='inflight' OR lease_until IS NULL OR lease_until<now()) RETURNING id",
        (uuid4(), op["id"]),
    ).fetchone()
    if not claimed:
        db.commit()
        raise ProviderError("Operation is already in progress; reconcile its result.")
    db.commit()
    try:
        if settings.mode == "fixture":
            result = fixture_result(c, kind, op, scenario)
        elif kind == "order":
            result = paypal(
                "POST",
                "/v2/checkout/orders",
                {
                    "intent": "AUTHORIZE",
                    "purchase_units": [
                        {
                            "reference_id": str(c["id"]),
                            "custom_id": str(c["id"]),
                            "description": "Commonplace Supply demo: one Arc 991 in Graphite",
                            **(
                                {"payee": {"merchant_id": settings.paypal_merchant_id}}
                                if settings.paypal_merchant_id
                                else {}
                            ),
                            "amount": {"currency_code": "USD", "value": "65.00"},
                        }
                    ],
                    "payment_source": {
                        "paypal": {
                            "experience_context": {
                                "brand_name": "Coalition · Demo storefront",
                                "shipping_preference": "NO_SHIPPING",
                                "user_action": "CONTINUE",
                                "return_url": settings.public_url
                                + "/?run="
                                + str(c["run_id"])
                                + "&paypal_return=1",
                                "cancel_url": settings.public_url
                                + "/?run="
                                + str(c["run_id"])
                                + "&paypal_cancel=1",
                            }
                        }
                    },
                },
                op["id"],
            )
        elif kind == "authorize":
            data = paypal("GET", "/v2/checkout/orders/" + c["order_id"])
            unit = validate_order(data, c)
            payer_id = data.get("payer", {}).get("payer_id") or data.get(
                "payment_source", {}
            ).get("paypal", {}).get("account_id")
            if not payer_id:
                raise RecoveryRequired(
                    "Approved order has no identifiable sandbox buyer."
                )
            if c.get("provider_payer_id") and c["provider_payer_id"] != payer_id:
                raise RecoveryRequired("Sandbox buyer identity changed.")
            db.execute(
                "UPDATE commitments SET provider_payer_id=%s WHERE id=%s",
                (payer_id, c["id"]),
            )
            db.commit()
            authorizations = unit.get("payments", {}).get("authorizations", [])
            if len(authorizations) > 1:
                raise RecoveryRequired(
                    "More than one authorization returned for a commitment."
                )
            if authorizations:
                result = authorizations[0]
            else:
                if data.get("status") != "APPROVED":
                    raise ProviderError(
                        "Buyer approval is required before authorization.", True
                    )
                group = lock_group(db, c["group_id"])
                current = db.execute(
                    "SELECT * FROM commitments WHERE id=%s", (c["id"],)
                ).fetchone()
                allowed = (
                    group["status"] == "OPEN"
                    and current["active"]
                    and not expired(db, current["reservation_expires_at"])
                    and not expired(db, group["deadline"])
                )
                db.commit()
                if not allowed:
                    db.execute(
                        "UPDATE payment_operations SET status='declined',error='Authorization eligibility ended before POST' WHERE id=%s",
                        (op["id"],),
                    )
                    db.commit()
                    return
                data = paypal(
                    "POST",
                    "/v2/checkout/orders/" + c["order_id"] + "/authorize",
                    {},
                    op["id"],
                )
                unit = validate_order(data, c)
                result = unit["payments"]["authorizations"][0]
        elif kind == "capture":
            if not c["locked"] or c["authorization_status"] != "CREATED":
                raise RecoveryRequired(
                    "Capture requires locked, confirmed authorization."
                )
            validate_capture(c)
            result = paypal(
                "POST",
                f"/v2/payments/authorizations/{c['authorization_id']}/capture",
                {
                    "amount": {"currency_code": "USD", "value": "65.00"},
                    "final_capture": True,
                },
                op["id"],
            )
        elif kind == "void":
            data = paypal("GET", f"/v2/payments/authorizations/{c['authorization_id']}")
            if data["status"] == "VOIDED":
                result = data
            elif data["status"] == "CAPTURED":
                raise RecoveryRequired(
                    "Authorization already captured. Reconcile before compensation."
                )
            else:
                result = paypal(
                    "POST",
                    f"/v2/payments/authorizations/{c['authorization_id']}/void",
                    None,
                    op["id"],
                )
        else:
            result = paypal(
                "POST",
                f"/v2/payments/captures/{c['capture_id']}/refund",
                {"amount": {"currency_code": "USD", "value": "65.00"}},
                op["id"],
            )
        observe(db, c, kind, result)
        db.execute(
            "UPDATE payment_operations SET status='completed',response=%s,error=NULL,updated_at=now() WHERE id=%s",
            (Jsonb(result), op["id"]),
        )
        db.commit()
    except ProviderError as exc:
        db.rollback()
        db.execute(
            "UPDATE payment_operations SET status=%s,error=%s,updated_at=now() WHERE id=%s",
            ("declined" if exc.definitive else "unknown", str(exc), op["id"]),
        )
        if exc.definitive and kind == "capture":
            db.execute(
                "UPDATE commitments SET capture_status='DECLINED',error=%s WHERE id=%s",
                (str(exc), c["id"]),
            )
        else:
            db.execute(
                "UPDATE commitments SET error=%s WHERE id=%s", (str(exc), c["id"])
            )
        db.commit()
        if not exc.definitive:
            raise
        if kind != "capture":
            raise RecoveryRequired(str(exc))
    except Exception as exc:
        db.rollback()
        db.execute(
            "UPDATE payment_operations SET status='unknown',error=%s,updated_at=now() WHERE id=%s",
            (str(exc)[:400], op["id"]),
        )
        db.commit()
        raise


def reconcile(db, c, source="reconciliation", event_id=None):
    if settings.mode == "fixture" or not c["order_id"]:
        return
    db.commit()
    data = paypal("GET", "/v2/checkout/orders/" + c["order_id"])
    unit = validate_order(data, c)
    for field, kind in [("authorizations", "authorize"), ("captures", "capture")]:
        entries = unit.get("payments", {}).get(field, [])
        if len(entries) > 1:
            raise RecoveryRequired("Unexpected multiple payments for one commitment.")
        if entries:
            observe(db, c, kind, entries[0], source, event_id)
    db.commit()
    c = db.execute("SELECT * FROM commitments WHERE id=%s", (c["id"],)).fetchone()
    for kind in ("authorization", "capture", "refund"):
        if not c.get(kind + "_id"):
            continue
        resource = {
            "authorization": "authorizations",
            "capture": "captures",
            "refund": "refunds",
        }[kind]
        db.commit()
        result = paypal("GET", f"/v2/payments/{resource}/{c[kind + '_id']}")
        if result.get("id") != c[kind + "_id"]:
            raise RecoveryRequired("Provider resource identity mismatch.")
        observe(
            db,
            c,
            "authorize" if kind == "authorization" else kind,
            result,
            source,
            event_id,
        )
        if kind == "authorization" and result["status"] == "VOIDED":
            observe(db, c, "void", result, source, event_id)
    db.commit()


def verify_webhook(headers, event):
    if settings.mode != "connected":
        raise RecoveryRequired("Real webhook processing is disabled in fixture mode.")
    if not settings.paypal_webhook_id:
        raise RecoveryRequired("PAYPAL_WEBHOOK_ID missing.")
    names = {
        "auth_algo": "paypal-auth-algo",
        "cert_url": "paypal-cert-url",
        "transmission_id": "paypal-transmission-id",
        "transmission_sig": "paypal-transmission-sig",
        "transmission_time": "paypal-transmission-time",
    }
    body = {key: headers.get(value) for key, value in names.items()}
    if not all(body.values()):
        return False
    body.update(webhook_id=settings.paypal_webhook_id, webhook_event=event)
    return (
        paypal("POST", "/v1/notifications/verify-webhook-signature", body).get(
            "verification_status"
        )
        == "SUCCESS"
    )


def confirm_recovered_refund(db, c, refund_id):
    """Read-only provider proof for an operator-completed recovery, preserving the failed operation."""
    if settings.mode != "connected":
        raise RecoveryRequired("Provider recovery proof requires connected mode.")
    result = paypal("GET", f"/v2/payments/refunds/{refund_id}")
    if (
        result.get("id") != refund_id
        or result.get("status") != "COMPLETED"
        or not amount_matches(result.get("amount", {}))
    ):
        raise RecoveryRequired(
            "Recovery refund is not a provider-confirmed completed $65 USD refund."
        )
    from urllib.parse import urlparse

    parents = [
        urlparse(link.get("href", ""))
        for link in result.get("links", [])
        if link.get("rel") == "up"
    ]
    if not any(
        url.scheme == "https"
        and url.hostname in ("api-m.sandbox.paypal.com", "api.sandbox.paypal.com")
        and url.path == f"/v2/payments/captures/{c['capture_id']}"
        for url in parents
    ):
        raise RecoveryRequired("Recovery refund does not belong to this buyer capture.")
    if (
        c["refund_id"]
        and c["refund_id"] != refund_id
        and c["refund_status"] not in ("FAILED", "CANCELLED")
    ):
        raise RecoveryRequired(
            "The original refund is unresolved; reconcile it before attaching another ID."
        )
    existing = db.execute(
        "SELECT response FROM payment_operations WHERE commitment_id=%s AND kind='refund_recovery'",
        (c["id"],),
    ).fetchone()
    if existing and existing["response"]["id"] != refund_id:
        raise RecoveryRequired("A different recovery refund is already recorded.")
    db.execute(
        "INSERT INTO payment_operations(id,commitment_id,kind,status,response) VALUES(%s,%s,'refund_recovery','completed',%s) ON CONFLICT DO NOTHING",
        (uuid4(), c["id"], Jsonb(result)),
    )
    db.execute(
        "UPDATE commitments SET refund_id=%s,refund_status='COMPLETED',error=NULL WHERE id=%s",
        (refund_id, c["id"]),
    )
    db.commit()


def validate_capture(c):
    if (
        not c["locked"]
        or not c.get("admitted")
        or c["authorization_status"] != "CREATED"
        or c["amount_minor"] != 6500
        or c["currency"] != "USD"
    ):
        raise RecoveryRequired(
            "Capture requires an admitted, frozen $65 USD authorization."
        )
    if settings.mode == "fixture":
        return
    data = paypal("GET", f"/v2/payments/authorizations/{c['authorization_id']}")
    if (
        data.get("id") != c["authorization_id"]
        or data.get("status") != "CREATED"
        or not amount_matches(data.get("amount", {}))
        or data.get("payee", {}).get("merchant_id") != settings.paypal_merchant_id
    ):
        raise RecoveryRequired("Authorization state, merchant or amount mismatch.")
    try:
        expiry = datetime.fromisoformat(data["expiration_time"].replace("Z", "+00:00"))
        created = datetime.fromisoformat(data["create_time"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if (
            expiry.tzinfo is None
            or created.tzinfo is None
            or created > now
            or min(expiry, created + timedelta(days=3)) <= now + timedelta(minutes=5)
        ):
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        raise RecoveryRequired(
            "Real authorization timestamps do not leave a five-minute settlement margin inside the honor/expiry window."
        )
