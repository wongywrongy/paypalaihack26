"""One durable job lane; bounded provider reads fit inside a ten-minute lease."""

import logging
import signal
from threading import Event, Thread
from time import monotonic
from uuid import uuid4

from .db import connect
from .payments.paypal import RecoveryRequired
from .payments.webhooks import process

log = logging.getLogger("rally.worker")


def claim(db, lane="payments"):
    job = db.execute(
        "UPDATE jobs SET status='running',lease_until=now()+interval '10 minutes',lease_token=%s,attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE ((status='ready' AND run_at<=now()) OR (status='running' AND lease_until<now())) AND ((%s AND kind='negotiate') OR (NOT %s AND kind!='negotiate')) ORDER BY run_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
        (uuid4(), lane == "ai", lane == "ai"),
    ).fetchone()
    db.commit()
    return job


def run_once(lane="payments"):
    with connect() as db:
        job = claim(db, lane)
        if not job:
            return False
        try:
            if job["kind"] == "webhook":
                process(db, job["payload"]["event_id"])
            elif job["kind"] == "negotiate":
                from .orders import run_negotiation

                run_negotiation(job["payload"]["order_id"])
            elif job["kind"] == "capture":
                from . import orders
                from .payments.ledger import operation

                oid = job["payload"]["order_id"]
                try:
                    orders.settle(db, oid)
                except Exception:
                    db.rollback()
                    failed = operation(db, f"order:{oid}:capture")
                    db.commit()
                    if failed and failed["status"] == "failed":
                        orders.cancel(db, oid, compensation=True)
                    else:
                        db.execute("UPDATE orders SET payment_state='NEEDS_REVIEW' WHERE id=%s", (oid,))
                        db.commit()
                        raise
            elif job["kind"] == "refund":
                from .maintenance import refund

                refund(db, job["payload"]["order_id"])
            elif job["kind"] in ("payout", "tracking", "true_up"):
                from .fulfillment import process_job

                process_job(db, job)
            else:
                raise RecoveryRequired("Unknown job kind.")
            db.execute(
                "UPDATE jobs SET status='done',lease_until=NULL,error=NULL WHERE id=%s AND lease_token=%s",
                (job["id"], job["lease_token"]),
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            log.error("Job %s: %s", job["id"], type(exc).__name__)
            db.execute(
                "UPDATE jobs SET status=%s,run_at=now()+(%s * interval '1 second'),lease_until=NULL,error=%s WHERE id=%s AND lease_token=%s",
                (
                    "recovery"
                    if isinstance(exc, RecoveryRequired) or job["attempts"] >= 6
                    else "ready",
                    min(2 ** job["attempts"], 60),
                    type(exc).__name__,
                    job["id"],
                    job["lease_token"],
                ),
            )
            db.commit()
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    stop = Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    def loop(lane):
        from . import maintenance

        while not stop.is_set():
            try:
                if lane == "maintenance":
                    maintenance.run_once()
                    stop.wait(5)
                elif not run_once(lane):
                    stop.wait(0.5)
            except Exception as exc:
                log.error("Worker lane %s: %s", lane, type(exc).__name__)
                stop.wait(1)
    threads = [Thread(target=loop, args=(lane,), daemon=True) for lane in ("ai", "payments", "maintenance")]
    for thread in threads:
        thread.start()
    while not stop.wait(1):
        pass
    deadline = monotonic() + 25
    for thread in threads:
        thread.join(timeout=max(0, deadline - monotonic()))
