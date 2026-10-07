"""Isolated GPU model check: live eligibility and negotiation, no payment operations.
COALITION_TEST_DATABASE_URL=... PYTHONPATH=backend python scripts/check_live_model.py
Requires Ollama, plus PostgreSQL permission to create/drop a disposable schema.
"""

import json
import os
import secrets
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit
from uuid import uuid4

import httpx
import psycopg

base = os.environ.get(
    "COALITION_TEST_DATABASE_URL",
    "postgresql://coalition:coalition@localhost:5432/coalition",
)
upstream = os.environ.get("OLLAMA_UPSTREAM", os.environ.get("OLLAMA_HOST", ""))
if not upstream:
    raise SystemExit("Set OLLAMA_UPSTREAM to this server's Ollama origin.")
if not upstream.startswith("http"):
    upstream = "http://" + upstream
schema = "coalition_model_" + uuid4().hex
parts = urlsplit(base)
os.environ.update(
    DATABASE_URL=urlunsplit(
        (*parts[:3], urlencode({"options": "-csearch_path=" + schema}), parts.fragment)
    ),
    COALITION_MODE="connected",
    PUBLIC_URL="http://127.0.0.1:8015",
    LLM_BASE_URL="http://127.0.0.1:8015/api/model",
    LLM_API_KEY=secrets.token_urlsafe(32),
    LLM_MODEL="qwen3:30b-a3b-instruct-2507-q4_K_M",
    LLM_PROTOCOL="ollama",
    OLLAMA_UPSTREAM=upstream,
    PAYPAL_CLIENT_ID="",
    PAYPAL_CLIENT_SECRET="",
    PAYPAL_MERCHANT_ID="MODEL-CHECK-NO-PAYMENTS",
    PAYPAL_WEBHOOK_ID="",
)
from coalition.db import connect, init_db, seed
from coalition.demo import create_run
from coalition.matching import Constraints, RequestInput, run_match, submit_request
from coalition.negotiation import run_negotiation, start

with psycopg.connect(base, autocommit=True) as db:
    db.execute("CREATE SCHEMA " + schema)
server = None
try:
    init_db()
    seed()
    with tempfile.TemporaryFile() as log:
        server = subprocess.Popen(
            [
                ".venv/bin/python",
                "-m",
                "uvicorn",
                "coalition.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8015",
            ],
            stdout=log,
            stderr=log,
            cwd=Path(__file__).resolve().parents[1],
        )
        for _ in range(100):
            try:
                if httpx.get("http://127.0.0.1:8015/api/health", timeout=1).is_success:
                    break
            except httpx.HTTPError:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError("Model gateway did not start.")
        assert (
            httpx.post(
                "http://127.0.0.1:8015/api/model/v1/chat/completions", json={}
            ).status_code
            == 401
        )
        with connect() as db:
            run = create_run(db, "success", profile="small")
            bid = uuid4()
            db.execute(
                "INSERT INTO buyers(id,run_id,name,persona) VALUES(%s,%s,'Model check','{}')",
                (bid, run["run_id"]),
            )
            buyer = db.execute("SELECT * FROM buyers WHERE id=%s", (bid,)).fetchone()
            submit_request(
                db,
                buyer,
                RequestInput(
                    raw_text="Noise-canceling headphones for flights, under $100, works with my iPhone 12. I can wait a week."
                ),
            )
            requests = db.execute(
                "SELECT q.id FROM buyer_requests q JOIN buyers b ON b.id=q.buyer_id WHERE b.run_id=%s ORDER BY (q.buyer_id=%s) DESC",
                (run["run_id"], bid),
            ).fetchall()
            db.commit()
            for r in requests:
                begun = time.monotonic()
                run_match(db, r["id"])
                db.commit()
                status = db.execute(
                    "SELECT status,error FROM buyer_requests WHERE id=%s", (r["id"],)
                ).fetchone()
                print(
                    {
                        "live_matching": status["status"],
                        "seconds": round(time.monotonic() - begun, 2),
                    },
                    flush=True,
                )
                assert status["status"] == "completed", status["error"]
                print(
                    db.execute(
                        "SELECT constraints FROM buyer_requests WHERE id=%s", (r["id"],)
                    ).fetchone(),
                    flush=True,
                )
                checks = db.execute(
                    "SELECT product_id,eligible,requirements FROM compatibility_assessments WHERE request_id=%s",
                    (r["id"],),
                ).fetchall()
                if not any(a["eligible"] for a in checks):
                    print(checks, flush=True)
                    raise AssertionError("No eligible offer for the canonical request")
            req = db.execute(
                "SELECT id FROM buyer_requests WHERE buyer_id=%s", (bid,)
            ).fetchone()["id"]
            results = db.execute(
                "SELECT product_id,eligible FROM compatibility_assessments WHERE request_id=%s ORDER BY product_id",
                (req,),
            ).fetchall()
            print({"live_eligibility": results}, flush=True)
            assert not next(r for r in results if r["product_id"] == "mystery-sound")[
                "eligible"
            ]
            original = db.execute(
                "SELECT raw_text,constraints FROM buyer_requests WHERE id=%s", (req,)
            ).fetchone()
            constraints = Constraints.model_validate_json(
                json.dumps(original["constraints"])
            )
            for maximum in (8600, constraints.max_total_minor):
                edited = constraints.model_copy(update={"max_total_minor": maximum})
                change = submit_request(
                    db, buyer, RequestInput(raw_text=original["raw_text"], edits=edited)
                )
                db.commit()
                run_match(db, change["id"])
                db.commit()
                evaluated = db.execute(
                    "SELECT status FROM buyer_requests WHERE id=%s", (change["id"],)
                ).fetchone()
                eligible = db.execute(
                    "SELECT count(*) AS n FROM compatibility_assessments WHERE request_id=%s AND eligible",
                    (change["id"],),
                ).fetchone()["n"]
                assert evaluated["status"] == "completed"
                assert (eligible == 0) == (maximum == 8600)
                print(
                    {"live_edited_maximum": maximum, "eligible_offers": eligible},
                    flush=True,
                )
            selected = next(r["product_id"] for r in results if r["eligible"])
            n = start(db, buyer, selected)
            db.commit()
            begun = time.monotonic()
            run_negotiation(db, n["id"])
            db.commit()
            result = db.execute(
                "SELECT status,error,token_count FROM negotiations WHERE id=%s",
                (n["id"],),
            ).fetchone()
            print(
                {
                    "live_negotiation": result,
                    "seconds": round(time.monotonic() - begun, 2),
                },
                flush=True,
            )
            rounds = db.execute(
                "SELECT ordinal,role,valid,public_summary,private_error FROM negotiation_rounds WHERE negotiation_id=%s ORDER BY ordinal",
                (n["id"],),
            ).fetchall()
            print({"rounds": rounds}, flush=True)
            assert result["status"] == "accepted", result["error"]
            assert (
                db.execute("SELECT count(*) AS n FROM payment_operations").fetchone()[
                    "n"
                ]
                == 0
            )
            print(
                "Live structured matching and merchant-authorized agreement passed; no payment operations.",
                flush=True,
            )
finally:
    if server:
        server.terminate()
        server.wait(timeout=10)
    with psycopg.connect(base, autocommit=True) as db:
        db.execute("DROP SCHEMA " + schema + " CASCADE")
