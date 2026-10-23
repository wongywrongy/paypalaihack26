"""Durable receipts, verified signatures, and provider GET reconciliation."""

import hashlib
import json
from urllib.parse import urlsplit
from uuid import uuid4

from psycopg.types.json import Jsonb

from ..config import settings
from ..db import enqueue
from .ledger import finish, reconcile
from .paypal import RecoveryRequired, amount_matches, paypal, resource_path

SIGNATURE_HEADERS = {
    "auth_algo": "paypal-auth-algo",
    "cert_url": "paypal-cert-url",
    "transmission_id": "paypal-transmission-id",
    "transmission_sig": "paypal-transmission-sig",
    "transmission_time": "paypal-transmission-time",
}


def verify(headers, raw_body):
    if settings.mode != "connected" or not settings.paypal_webhook_id:
        raise RecoveryRequired("Connected sandbox webhook ID is required.")
    fields = {key: headers.get(name) for key, name in SIGNATURE_HEADERS.items()}
    if not all(fields.values()):
        return False
    fields["webhook_id"] = settings.paypal_webhook_id
    # Preserve the provider's original JSON, including decimal and Unicode spelling.
    raw = json.dumps(fields).encode()[:-1] + b',"webhook_event":' + raw_body + b"}"
    return (
        paypal("POST", "/v1/notifications/verify-webhook-signature", raw_json=raw).get(
            "verification_status"
        )
        == "SUCCESS"
    )


def receive(db, headers, raw_body):
    if len(raw_body) > 1024 * 1024:
        raise ValueError("Webhook exceeds 1 MiB.")
    event = json.loads(raw_body)
    if (
        not isinstance(event, dict)
        or not isinstance(event.get("id"), str)
        or not event["id"]
        or not isinstance(event.get("event_type"), str)
    ):
        raise ValueError("Webhook requires an event ID and type.")
    headers = {
        name: value
        for name, value in headers.items()
        if name in SIGNATURE_HEADERS.values()
    }
    row = db.execute(
        "INSERT INTO webhook_events(id,event_id,type,raw,raw_body,headers) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(event_id) DO UPDATE SET raw=EXCLUDED.raw,raw_body=EXCLUDED.raw_body,headers=EXCLUDED.headers,type=EXCLUDED.type,processed_at=NULL WHERE NOT webhook_events.verified RETURNING id",
        (
            uuid4(),
            event["id"],
            event["event_type"],
            Jsonb(event),
            raw_body,
            Jsonb(headers),
        ),
    ).fetchone()
    if row:
        receipt_key = hashlib.sha256(
            raw_body + json.dumps(headers, sort_keys=True).encode()
        ).hexdigest()
        enqueue(db, "webhook", {"event_id": str(row["id"])}, "webhook:" + receipt_key)
    db.commit()
    return event["id"]


def event_resource(event):
    resource = event.get("resource", {})
    event_type = event["event_type"]
    kinds = (
        ("authorize",)
        if event_type.startswith("PAYMENT.AUTHORIZATION.")
        else ("capture", "refund")
        if event_type.startswith("PAYMENT.CAPTURE.")
        else ("payout",)
        if event_type.startswith("PAYMENT.PAYOUTSBATCH.")
        else ("payout_item",)
        if event_type.startswith("PAYMENT.PAYOUTS-ITEM.")
        else ()
    )
    for kind in kinds:
        resource_id = (
            resource.get("payout_batch_id")
            or resource.get("batch_header", {}).get("payout_batch_id")
            if kind == "payout"
            else resource.get("payout_item_id")
            if kind == "payout_item"
            else resource.get("id")
        )
        if not resource_id:
            continue
        expected = resource_path(kind, resource_id)
        for link in resource.get("links", []):
            url = urlsplit(link.get("href", ""))
            if (
                link.get("rel") == "self"
                and url.scheme == "https"
                and url.hostname
                in ("api-m.sandbox.paypal.com", "api.sandbox.paypal.com")
                and url.path == expected
                and not url.query
            ):
                return kind, resource_id, expected
        if kind in ("payout", "payout_item"):
            return kind, resource_id, expected
    if kinds:
        raise RecoveryRequired(
            "Webhook payment resource has no valid sandbox identity."
        )
    return None


def process(db, event_id):
    event = db.execute(
        "SELECT * FROM webhook_events WHERE id=%s", (event_id,)
    ).fetchone()
    db.commit()
    if not event or event["processed_at"]:
        return
    verified = event["verified"] or verify(event["headers"], bytes(event["raw_body"]))
    current = db.execute(
        "UPDATE webhook_events SET verified=%s,processed_at=CASE WHEN %s THEN NULL ELSE now() END WHERE id=%s AND raw_body=%s AND headers=%s RETURNING id",
        (verified, verified, event_id, event["raw_body"], Jsonb(event["headers"])),
    ).fetchone()
    db.commit()
    if not current or not verified:
        return
    target = event_resource(event["raw"])
    if target:
        kind, ref, path = target
        data = paypal("GET", path)
        observed_ref = (
            data.get("batch_header", {}).get("payout_batch_id")
            if kind == "payout"
            else data.get("payout_item_id")
            if kind == "payout_item"
            else data.get("id")
        )
        if observed_ref != ref:
            raise RecoveryRequired("Webhook GET identity mismatch.")
        if kind == "payout_item":
            ref = data.get("payout_batch_id")
            kind = "payout"
            data = paypal("GET", resource_path(kind, ref))
            if data.get("batch_header", {}).get("payout_batch_id") != ref:
                raise RecoveryRequired("Webhook payout GET identity mismatch.")
        related = list(
            data.get("supplementary_data", {}).get("related_ids", {}).values()
        )
        for link in data.get("links", []):
            url = urlsplit(link.get("href", ""))
            if (
                link.get("rel") == "up"
                and url.scheme == "https"
                and url.hostname
                in ("api-m.sandbox.paypal.com", "api.sandbox.paypal.com")
            ):
                related.append(url.path.rsplit("/", 1)[-1])
        sender_key = (
            data.get("batch_header", {})
            .get("sender_batch_header", {})
            .get("sender_batch_id")
        )
        ops = db.execute(
            "SELECT * FROM payment_ops WHERE kind=%s AND (provider_ref=%s OR (provider_ref IS NULL AND status IN ('inflight','unknown','pending') AND (request->>'resource_id'=ANY(%s) OR request->>'wire_key'=%s)))",
            (kind, ref, related, sender_key),
        ).fetchall()
        db.commit()
        if len(ops) > 1:
            raise RecoveryRequired(
                "Webhook maps to multiple operations; review correlation."
            )
        for op in ops:
            if kind == "authorize":
                if not amount_matches(
                    data.get("amount", {}),
                    op["request"]["amount_cents"],
                    op["request"].get("currency", "USD"),
                ):
                    raise RecoveryRequired("Webhook authorization amount mismatch.")
                if op["status"] in ("inflight", "unknown", "pending"):
                    reconcile(db, op["request_id"])
            else:
                finish(db, op, data)
        if kind == "authorize" and data.get("status") == "VOIDED":
            db.execute(
                "UPDATE holds SET status='VOIDED' WHERE authorization_id=%s AND status NOT IN ('CAPTURED','VOIDED')",
                (ref,),
            )
        if ops:
            db.execute(
                "UPDATE webhook_events SET provider_ref=%s WHERE id=%s", (ref, event_id)
            )
    db.execute("UPDATE webhook_events SET processed_at=now() WHERE id=%s", (event_id,))
    db.commit()
