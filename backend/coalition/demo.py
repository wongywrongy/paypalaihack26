import hashlib
import secrets
from uuid import uuid4

from psycopg.types.json import Jsonb

from .config import settings
from .db import enqueue

PERSONAS = [
    ("Maya", 7000, 10),
    ("Leo", 6800, 8),
    ("Aisha", 7500, 9),
    ("Noah", 6500, 7),
    ("Sam", 7000, 2),
]


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_run(db, scenario, demo=True):
    from .offers import publish

    terms = publish(db)
    run_id, group_id = uuid4(), uuid4()
    db.execute(
        "INSERT INTO runs(id,mode,scenario) VALUES(%s,%s,%s)",
        (run_id, settings.mode, scenario),
    )
    db.execute(
        "INSERT INTO groups(id,run_id,offer_id,demo,activated,deadline) VALUES(%s,%s,%s,%s,%s,CASE WHEN %s THEN NULL ELSE now()+interval '24 hours' END)",
        (group_id, run_id, terms["offer_id"], demo, not demo, demo),
    )
    invites = []
    for name, budget, days in PERSONAS:
        buyer_id, token = uuid4(), secrets.token_urlsafe(32)
        persona = {
            "budget_minor": budget,
            "delivery_days": days,
            "product_id": "arc-991",
            "variant": "Graphite",
            "needs": "Required exact calculator for introductory engineering; no substitutions.",
        }
        db.execute(
            "INSERT INTO buyers(id,run_id,name,persona,invite_hash,prepared) VALUES(%s,%s,%s,%s,%s,true)",
            (buyer_id, run_id, name, Jsonb(persona), digest(token)),
        )
        if settings.mode == "fixture" or settings.llm_api_key:
            decision_id = uuid4()
            db.execute(
                "INSERT INTO ai_decisions(id,buyer_id,group_id,mode) VALUES(%s,%s,%s,%s)",
                (decision_id, buyer_id, group_id, settings.mode),
            )
            enqueue(db, "ai", {"decision_id": str(decision_id)}, f"ai:{decision_id}")
        invites.append(
            {
                "name": name,
                "buyer_id": str(buyer_id),
                "url": f"{settings.public_url}/?run={run_id}&invite={token}",
            }
        )
    enqueue(db, "tick", {"group_id": str(group_id)}, f"tick:{group_id}")
    return {
        "run_id": str(run_id),
        "group_id": str(group_id),
        "judge_url": f"{settings.public_url}/?run={run_id}",
        "preparation_links": invites,
    }
