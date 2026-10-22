"""One durable job lane; bounded provider reads fit inside a ten-minute lease."""

import logging
from threading import Event
from uuid import uuid4

from .db import connect
from .payments.paypal import RecoveryRequired
from .payments.webhooks import process

log = logging.getLogger("rally.worker")


def claim(db):
    job = db.execute(
        "UPDATE jobs SET status='running',lease_until=now()+interval '10 minutes',lease_token=%s,attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE (status='ready' AND run_at<=now()) OR (status='running' AND lease_until<now()) ORDER BY run_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
        (uuid4(),),
    ).fetchone()
    db.commit()
    return job


def run_once():
    with connect() as db:
        job = claim(db)
        if not job:
            return False
        try:
            if job["kind"] != "webhook":
                raise RecoveryRequired("Unknown job kind.")
            process(db, job["payload"]["event_id"])
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
    try:
        while not stop.is_set():
            if not run_once():
                stop.wait(0.5)
    except KeyboardInterrupt:
        stop.set()
