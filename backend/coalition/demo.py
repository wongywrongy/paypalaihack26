import hashlib
import secrets
from uuid import uuid4

from psycopg.types.json import Jsonb

from .config import settings


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_run(db, scenario, demo=True, profile="small"):
    if profile != "small":
        raise ValueError("Only five-person headphone runs can be prepared.")
    run_id, group_id = uuid4(), uuid4()
    db.execute(
        "INSERT INTO runs(id,mode,scenario,profile) VALUES(%s,%s,%s,%s)",
        (run_id, settings.mode, scenario, profile),
    )
    db.execute(
        "INSERT INTO groups(id,run_id,status,inventory_reserved,demo,activated) VALUES(%s,%s,'DRAFT',0,%s,false)",
        (group_id, run_id, demo),
    )
    invites = []
    from .matching import RequestInput, submit_request

    for i in range(5):
        bid, token = uuid4(), secrets.token_urlsafe(32)
        name = ["Maya", "Leo", "Aisha", "Noah", "Sam"][i]
        db.execute(
            "INSERT INTO buyers(id,run_id,name,persona,invite_hash,prepared) VALUES(%s,%s,%s,%s,%s,true)",
            (bid, run_id, name, Jsonb({}), digest(token)),
        )
        b = {"id": bid, "run_id": run_id}
        requests = [
            "Noise-canceling headphones under $100 for my iPhone 12. I can wait a week.",
            "Noise-canceling headphones, maximum $92. I can wait 8 days.",
            "Bluetooth headphones under $95 for my iPhone 12. I can wait 9 days.",
            "Noise-canceling headphones under $120. I can wait 7 days.",
            "Headphones under $90 for my iPhone 12. I can wait 10 days.",
        ]
        submit_request(
            db,
            b,
            RequestInput(raw_text=requests[i]),
        )
        invites.append(
            {
                "name": name,
                "buyer_id": str(bid),
                "url": f"{settings.public_url}/?run={run_id}#invite={token}",
            }
        )
    return {
        "run_id": str(run_id),
        "group_id": str(group_id),
        "judge_url": f"{settings.public_url}/?run={run_id}",
        "preparation_links": invites,
    }
