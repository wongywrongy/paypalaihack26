"""Configured-provider evidence in a disposable schema; no payment credentials or mutations.
Load backend environment, set COALITION_TEST_DATABASE_URL, then run this script.
"""

import json
import os
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import psycopg

base = os.environ["COALITION_TEST_DATABASE_URL"]
schema = "coalition_model_" + uuid4().hex
parts = urlsplit(base)
query = dict(parse_qsl(parts.query)) | {"options": "-csearch_path=" + schema}
os.environ.update(
    DATABASE_URL=urlunsplit((*parts[:3], urlencode(query), parts.fragment)),
    COALITION_MODE="connected",
    PAYPAL_CLIENT_ID="",
    PAYPAL_CLIENT_SECRET="",
    # Explicit marker for model-only offers, never an actual sandbox merchant.
    PAYPAL_MERCHANT_ID="MODEL-CHECK-NO-PAYMENTS",
    PAYPAL_WEBHOOK_ID="",
)
from coalition.config import settings
from coalition.db import connect, engine, init_db, seed
from coalition.demo import create_run
from coalition.matching import RequestInput, latest_request, run_match, submit_request
from coalition.negotiation import run_negotiation, start
from coalition.offers import terms_for
from coalition.shopping import draft

if (
    settings.database_url != os.environ["DATABASE_URL"]
    or settings.mode != "connected"
    or settings.paypal_client_id
    or settings.paypal_client_secret
):
    raise RuntimeError(
        "Model check must load its disposable, payment-disabled environment before coalition imports."
    )

cases = [
    (
        "Noise-canceling headphones under $100 for my iPhone 12. I can wait a week.",
        "sony-wh-ch720n",
    ),
    (
        "Bluetooth headphones under $80 for my iPhone 12. I can wait 5 days.",
        "sony-wh-ch520",
    ),
    (
        "Noise-canceling headphones under $350. I can wait 14 days.",
        "sony-wh-1000xm5",
    ),
    ("Headphones maximum $66. I can wait 5 days.", "sony-wh-ch520"),
    ("Headphones under $100", None),
    ("Headphones under $90 for my iPhone 12. I can wait 10 days.", "sony-wh-ch720n"),
]
record = {
    "model": settings.llm_model,
    "protocol": settings.llm_protocol,
    "payment_operations": 0,
    "cases": [],
}
with psycopg.connect(base, autocommit=True) as db:
    db.execute("CREATE SCHEMA " + schema)
try:
    init_db()
    seed()
    for index, (raw, product) in enumerate(cases):
        begun = time.monotonic()
        with connect() as db:
            if index == 5:
                run = create_run(db, "success", profile="small")
                db.commit()
                for request in db.execute(
                    "SELECT q.id FROM buyer_requests q JOIN buyers b ON b.id=q.buyer_id WHERE b.run_id=%s",
                    (run["run_id"],),
                ).fetchall():
                    run_match(db, request["id"])
                    db.commit()
                buyer = db.execute(
                    "SELECT * FROM buyers WHERE run_id=%s AND name='Sam'",
                    (run["run_id"],),
                ).fetchone()
            else:
                buyer = draft(db)
                request = submit_request(db, buyer, RequestInput(raw_text=raw))
                db.commit()
                run_match(db, request["id"])
            db.commit()
            result = latest_request(db, buyer["id"])
            case = {
                "request": raw,
                "status": result["status"],
                "constraints": result["constraints"],
                "error_kind": result["error_kind"],
            }
            case["assessments"] = db.execute(
                "SELECT product_id,eligible,requirements FROM compatibility_assessments WHERE request_id=%s ORDER BY product_id",
                (result["id"],),
            ).fetchall()
            if index == 5:
                case["simulated_personas"] = db.execute(
                    "SELECT b.name,q.status,q.constraints FROM buyers b JOIN buyer_requests q ON q.buyer_id=b.id WHERE b.run_id=%s ORDER BY b.name",
                    (buyer["run_id"],),
                ).fetchall()
                case["confirmed_authorizations"] = 0
            if product and result["status"] == "completed":
                try:
                    n = start(db, buyer, product)
                    db.commit()
                    if n["id"]:
                        run_negotiation(db, n["id"])
                        db.commit()
                        case["negotiation"] = db.execute(
                            "SELECT status,error,token_count FROM negotiations WHERE id=%s",
                            (n["id"],),
                        ).fetchone()
                        case["rounds"] = db.execute(
                            "SELECT ordinal,role,valid,public_summary FROM negotiation_rounds WHERE negotiation_id=%s ORDER BY ordinal",
                            (n["id"],),
                        ).fetchall()
                    group = db.execute(
                        "SELECT id,offer_id FROM groups WHERE run_id=%s", (n["run_id"],)
                    ).fetchone()
                    if group["offer_id"]:
                        terms = terms_for(db, group["id"])
                        case["agreement"] = {
                            k: terms[k]
                            for k in (
                                "product_id",
                                "total_minor",
                                "tier_schedule",
                                "delivery_by",
                                "close_at",
                                "policy_id",
                            )
                        }
                except Exception as exc:
                    db.rollback()
                    case["negotiation_error_type"] = type(exc).__name__
            case["seconds"] = round(time.monotonic() - begun, 2)
            assert (
                db.execute("SELECT count(*) AS n FROM payment_operations").fetchone()[
                    "n"
                ]
                == 0
            )
            record["cases"].append(case)
            print(json.dumps(case), flush=True)
    if output := os.environ.get("COALITION_MODEL_RECORD"):
        Path(output).write_text(json.dumps(record, indent=2) + "\n")
    assert record["cases"][4]["status"] == "clarification", (
        "Incomplete request must clarify"
    )
    assert all(
        c["status"] == "completed" for i, c in enumerate(record["cases"]) if i != 4
    ), "Configured-provider evaluation failed"
    assert all(c.get("agreement") for c in record["cases"][:3]), (
        "Feasible negotiation did not agree; inspect record"
    )
    assert not record["cases"][3].get("agreement"), (
        "Merchant floor must prevent this agreement"
    )
    assert record["cases"][5].get("agreement") and all(
        p["status"] == "completed" for p in record["cases"][5]["simulated_personas"]
    ), "Five simulated live-evaluated requests did not produce a valid agreement"
    print(
        "Configured-provider variation and no-agreement checks passed; no PayPal operations."
    )
finally:
    engine().dispose()
    with psycopg.connect(base, autocommit=True) as db:
        db.execute("DROP SCHEMA " + schema + " CASCADE")
