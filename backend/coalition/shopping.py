"""Owner identity survives changing deals; each purchase keeps its original buyer row."""

from uuid import uuid4

from psycopg.types.json import Jsonb

from .config import settings


def lock_owner(db, owner_id):
    db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (str(owner_id),))


def buyer_for_run(db, owner, run_id):
    db.execute(
        "INSERT INTO buyers(id,run_id,name,persona,owner_id) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(run_id,owner_id) DO NOTHING",
        (uuid4(), run_id, owner["name"], Jsonb(owner["persona"]), owner["owner_id"]),
    )
    return db.execute(
        "SELECT * FROM buyers WHERE run_id=%s AND owner_id=%s",
        (run_id, owner["owner_id"]),
    ).fetchone()


def draft(db, owner=None):
    if owner:
        lock_owner(db, owner["owner_id"])
        existing = db.execute(
            "SELECT b.* FROM buyers b JOIN runs r ON r.id=b.run_id JOIN groups g ON g.run_id=r.id WHERE b.owner_id=%s AND r.mode=%s AND r.shopping AND NOT r.archived AND g.status='DRAFT' AND NOT EXISTS(SELECT 1 FROM negotiations n WHERE n.group_id=g.id AND n.status IN ('queued','running')) ORDER BY r.created_at DESC LIMIT 1",
            (owner["owner_id"], settings.mode),
        ).fetchone()
        if existing:
            return existing
    run_id, group_id, bid = uuid4(), uuid4(), uuid4()
    db.execute(
        "INSERT INTO runs(id,mode,scenario,profile,shopping) VALUES(%s,%s,'success','small',true)",
        (run_id, settings.mode),
    )
    db.execute(
        "INSERT INTO groups(id,run_id,status,inventory_reserved,demo,activated) VALUES(%s,%s,'DRAFT',0,false,true)",
        (group_id, run_id),
    )
    return buyer_for_run(
        db, owner or {"owner_id": bid, "name": "You", "persona": {}}, run_id
    )
