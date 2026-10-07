"""Run one persistent worker. PostgreSQL leases survive restarts; no network call holds a group lock."""

import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from psycopg.types.json import Jsonb

from .assistant import run_decision
from .catalog import PRODUCTS
from .config import settings
from .db import connect
from .groups import tick
from .payments import (
    RecoveryRequired,
    confirm_recovered_refund,
    observe,
    paypal,
    perform,
    reconcile,
    verify_webhook,
)

log = logging.getLogger("coalition.worker")


def claim(db):
    job = db.execute(
        """UPDATE jobs SET status='running',lease_until=now()+interval '10 minutes',lease_token=%s,attempts=attempts+1
      WHERE id=(SELECT id FROM jobs WHERE mode=%s AND ((status='ready' AND available_at<=now()) OR (status='running' AND lease_until<now()))
      ORDER BY CASE WHEN kind IN ('order','authorize','capture','void','refund','event') THEN 0 ELSE 1 END,available_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *""",
        (uuid4(), settings.mode),
    ).fetchone()
    db.commit()
    return job


def handle_event(db, event_id):
    event = db.execute(
        "SELECT * FROM webhook_events WHERE id=%s", (event_id,)
    ).fetchone()
    db.commit()
    if event["processed_at"]:
        return
    if not event["verified"]:
        verified = verify_webhook(event["headers"], event["payload"])
        saved = db.execute(
            "UPDATE webhook_events SET verified=%s,processed_at=CASE WHEN %s THEN NULL ELSE now() END WHERE id=%s AND payload=%s AND headers=%s RETURNING id",
            (
                verified,
                verified,
                event_id,
                Jsonb(event["payload"]),
                Jsonb(event["headers"]),
            ),
        ).fetchone()
        if not saved:
            db.rollback()
            raise RuntimeError(
                "Webhook changed during verification; verify current receipt before processing."
            )
        db.commit()
        if not verified:
            return
    payload = event["payload"]
    resource = payload.get("resource", {})
    related = resource.get("supplementary_data", {}).get("related_ids", {})
    import re
    from urllib.parse import urlparse

    paths = []
    for link in resource.get("links", []):
        url = urlparse(link.get("href", ""))
        if (
            url.scheme == "https"
            and url.hostname in ("api-m.sandbox.paypal.com", "api.sandbox.paypal.com")
            and re.fullmatch(
                r"/v2/payments/(authorizations|captures|refunds)/[A-Za-z0-9-]+",
                url.path,
            )
        ):
            paths.append((link.get("rel"), url.path))
    ids = [
        resource.get("id"),
        related.get("order_id"),
        related.get("authorization_id"),
        related.get("capture_id"),
    ] + [p.rsplit("/", 1)[-1] for rel, p in paths if rel == "up"]
    candidates = db.execute(
        "SELECT c.* FROM commitments c JOIN groups g ON g.id=c.group_id JOIN runs r ON r.id=g.run_id WHERE r.mode=%s AND (order_id=ANY(%s) OR authorization_id=ANY(%s) OR capture_id=ANY(%s) OR refund_id=ANY(%s))",
        (settings.mode, ids, ids, ids, ids),
    ).fetchall()
    db.commit()
    group_id = None
    if len(candidates) > 1:
        raise RecoveryRequired(
            "Webhook references more than one payment; review correlation."
        )
    if len(candidates) == 1 and payload.get("event_type", "").startswith(
        ("PAYMENT.AUTHORIZATION.", "PAYMENT.CAPTURE.")
    ):
        c = candidates[0]
        group_id = c["group_id"]
        # Authenticated event provides provenance; GET establishes current payment truth.
        for rel, path in paths:
            if rel != "self":
                continue
            kind = (
                "refund"
                if "/refunds/" in path
                else "capture"
                if "/captures/" in path
                else "authorize"
            )
            observed = paypal("GET", path)
            if observed.get("id") != path.rsplit("/", 1)[-1]:
                raise RecoveryRequired("Webhook GET resource identity mismatch.")
            observe(db, c, kind, observed, "webhook", event_id)
            db.commit()
        reconcile(db, c, "webhook", event_id)
        from .groups import wake

        wake(db, group_id)
    db.execute(
        "UPDATE webhook_events SET processed_at=now(),group_id=%s WHERE id=%s",
        (group_id, event_id),
    )
    db.commit()


def handle(db, job):
    p, kind = job["payload"], job["kind"]
    if kind == "match":
        from .matching import run_match

        run_match(db, p["request_id"])
        return
    if kind == "negotiate":
        from .negotiation import run_negotiation

        run_negotiation(db, p["negotiation_id"])
        return
    if kind == "ai":
        run_decision(db, p["decision_id"])
        db.commit()
        return
    if kind == "tick":
        return tick(db, p["group_id"])
    if kind == "event":
        handle_event(db, p["event_id"])
        return
    if kind == "fixture_prepare":
        if settings.mode != "fixture":
            raise RecoveryRequired("Fixture approvals cannot run in connected mode.")
        from .catalog import ProductContext
        from .groups import join
        from .offers import terms_for

        group = db.execute(
            "SELECT * FROM groups WHERE id=%s", (p["group_id"],)
        ).fetchone()
        if group["status"] != "OPEN" or group["activated"]:
            return
        terms = terms_for(db, group["id"])
        context = ProductContext(
            product_id=terms["product_id"],
            title=terms["title"],
            selected_variant=terms["variant"],
            displayed_price_minor=next(
                p["price_minor"] for p in PRODUCTS if p["id"] == terms["product_id"]
            ),
            currency="USD",
            quantity=1,
        )
        buyers = db.execute(
            "SELECT * FROM buyers WHERE run_id=%s AND prepared AND name!='Sam' ORDER BY name",
            (group["run_id"],),
        ).fetchall()
        for buyer in buyers:
            c = join(db, buyer, group["id"], context, terms)
            db.commit()
            perform(db, c, "order")
            perform(db, c, "authorize")
        return
    c = db.execute(
        "SELECT * FROM commitments WHERE id=%s", (p["commitment_id"],)
    ).fetchone()
    db.commit()
    if kind == "refund_recovery":
        confirm_recovered_refund(db, c, p["refund_id"])
        return tick(db, p["group_id"])
    perform(db, c, kind)
    if kind == "authorize":
        tick(db, p["group_id"])
    return None


def run_once():
    with connect() as db:
        job = claim(db)
        if not job:
            return False
        gid = job["payload"].get("group_id")
        try:
            delay = handle(db, job)
            if delay is not None and gid:
                pending = db.execute(
                    "SELECT 1 FROM commitments WHERE group_id=%s AND (capture_status='PENDING' OR refund_status='PENDING') UNION ALL SELECT 1 FROM payment_operations p JOIN commitments c ON c.id=p.commitment_id WHERE c.group_id=%s AND p.status IN ('inflight','unknown')",
                    (gid, gid),
                ).fetchone()
                since = job["unresolved_since"] or datetime.now(timezone.utc)
                if (
                    pending
                    and (datetime.now(timezone.utc) - since).total_seconds() > 900
                ):
                    raise RecoveryRequired(
                        "Payment remains pending or unknown after 15 minutes of reconciliation. Merchant review required."
                    )
                db.execute(
                    "UPDATE jobs SET unresolved_since=%s WHERE id=%s AND lease_token=%s",
                    (since if pending else None, job["id"], job["lease_token"]),
                )
            db.execute(
                "UPDATE jobs SET status=%s,attempts=0,available_at=now()+(%s * interval '1 second'),lease_until=NULL,error=NULL WHERE id=%s AND lease_token=%s",
                (
                    "ready" if delay is not None else "done",
                    delay or 0,
                    job["id"],
                    job["lease_token"],
                ),
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            # Persist a short safe error, never provider payloads, secrets or model reasoning.
            log.error("Job %s: %s", job["id"], type(exc).__name__)
            exhausted = isinstance(exc, RecoveryRequired) or job["attempts"] >= 6
            db.execute(
                "UPDATE jobs SET status=%s,available_at=now()+(%s * interval '1 second'),lease_until=NULL,error=%s WHERE id=%s AND lease_token=%s",
                (
                    "recovery" if exhausted else "ready",
                    min(2 ** job["attempts"], 60),
                    str(exc)[:400],
                    job["id"],
                    job["lease_token"],
                ),
            )
            if job["kind"] == "ai":
                db.execute(
                    "UPDATE ai_decisions SET status=%s,error=%s WHERE id=%s",
                    (
                        "failed" if exhausted else "queued",
                        str(exc)[:400],
                        job["payload"]["decision_id"],
                    ),
                )
            elif exhausted and gid:
                db.execute(
                    "UPDATE groups SET needs_attention=true,failure_reason=%s WHERE id=%s",
                    (str(exc)[:400], gid),
                )
            db.commit()
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    while True:
        if not run_once():
            time.sleep(0.5)
