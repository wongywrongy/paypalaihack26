import hmac
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from .catalog import PRODUCTS, ProductContext, validate_context
from .config import settings
from .db import connect, enqueue
from .demo import create_run, digest
from .groups import (
    expired,
    freeze,
    join,
    lock_group,
    members,
    redact,
    safe_terminal,
    snapshot,
    unwind,
    wake,
    withdraw,
)
from .matching import RequestInput, eligible_for_quote, latest_request, submit_request
from .negotiation import start as start_negotiation
from .offers import terms_for


@asynccontextmanager
async def lifespan(app):
    yield


app = FastAPI(title="Coalition", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_url],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Operator-Token", "X-Coalition-Request"],
)


class ModelMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = Field(pattern="^(system|user)$")
    content: str = Field(max_length=64000)


class ModelCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model: str
    messages: list[ModelMessage] = Field(min_length=1, max_length=2)
    response_format: dict
    max_tokens: int = Field(ge=1, le=4000)
    temperature: float = Field(ge=0, le=1)
    reasoning_effort: str = Field(pattern="^none$")


@app.post("/api/model/v1/chat/completions", include_in_schema=False)
async def local_model(request: Request):
    # Native Ollama does not authenticate bearer keys. Keep this gateway in the
    # existing API; configure the fixed upstream to the server's local Ollama.
    if not settings.ollama_upstream or not settings.llm_api_key:
        raise HTTPException(503, "Local model gateway is unavailable.")
    if not hmac.compare_digest(
        request.headers.get("authorization", ""), "Bearer " + settings.llm_api_key
    ):
        raise HTTPException(401, "Model authentication required.")
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > 256000:
            raise HTTPException(413, "Model request is too large.")
    try:
        command = ModelCommand.model_validate_json(body)
    except ValueError:
        raise HTTPException(422, "Invalid structured model request.") from None
    if command.model != settings.llm_model:
        raise HTTPException(422, "This model is not configured.")
    try:
        async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
            result = await client.post(
                settings.ollama_upstream + "/v1/chat/completions",
                json=command.model_dump(),
            )
            result.raise_for_status()
            return JSONResponse(result.json())
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Local model unavailable. Retry later.") from None


def rate_limit(request: Request):
    identity = request.client.host if request.client else "unknown"
    token = request.cookies.get("coalition_session")
    if token and request.url.path not in ("/api/session", "/api/paypal/webhook"):
        with connect() as db:
            owned = db.execute(
                "SELECT buyer_id FROM sessions WHERE token_hash=%s AND expires_at>now()",
                (digest(token),),
            ).fetchone()
        if owned:
            identity = str(owned["buyer_id"])
    key = (
        digest(identity)
        + ":"
        + ("admin" if "/operator/" in request.url.path else "buyer")
    )
    with connect() as db:
        row = db.execute(
            "INSERT INTO rate_limits(key) VALUES(%s) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.window_start<now()-interval '1 minute' THEN 1 ELSE rate_limits.hits+1 END,window_start=CASE WHEN rate_limits.window_start<now()-interval '1 minute' THEN now() ELSE rate_limits.window_start END RETURNING hits",
            (key,),
        ).fetchone()
    if row["hits"] > 60:
        raise HTTPException(429, "Too many commands. Retry in one minute.")


def same_origin(request: Request):
    if request.method != "GET":
        if request.headers.get("x-coalition-request") != "1":
            raise HTTPException(403, "Missing request protection header.")
        rate_limit(request)
    origin = request.headers.get("origin")
    if (
        origin
        and origin != settings.public_url
        and origin != str(request.base_url).rstrip("/")
    ):
        raise HTTPException(403, "Request origin is not allowed.")
    if (
        request.headers.get("sec-fetch-site") == "cross-site"
        and origin != settings.public_url
    ):
        raise HTTPException(403, "Cross-site requests are not allowed.")


def buyer(request: Request):
    token = request.cookies.get("coalition_session", "")
    with connect() as db:
        row = db.execute(
            "SELECT b.* FROM sessions s JOIN buyers b ON b.id=s.buyer_id JOIN runs r ON r.id=b.run_id WHERE token_hash=%s AND expires_at>now() AND r.mode=%s",
            (digest(token), settings.mode),
        ).fetchone()
    if not row:
        raise HTTPException(
            401, "Your demo session expired. Reload to start a new buyer session."
        )
    return row


def operator(request: Request):
    same_origin(request)
    if not settings.operator_token or not hmac.compare_digest(
        request.headers.get("x-operator-token", ""), settings.operator_token
    ):
        raise HTTPException(403, "A valid operator token is required.")


class SessionBody(BaseModel):
    run_id: UUID | None = None
    invite: str | None = Field(default=None, max_length=150)
    shopping: bool = False


@app.get("/api/config")
def config():
    with connect() as db:
        latest = db.execute(
            "SELECT id FROM runs WHERE mode=%s AND NOT archived ORDER BY created_at DESC LIMIT 1",
            (settings.mode,),
        ).fetchone()
    return {
        "mode": settings.mode,
        "default_run_id": latest["id"] if latest else None,
        "paypal_client_id": settings.paypal_client_id
        if settings.mode == "connected"
        else None,
        "paypal_configured": bool(
            settings.paypal_client_id
            and settings.paypal_client_secret
            and settings.paypal_webhook_id
            and settings.paypal_merchant_id
        ),
        "llm_configured": bool(settings.llm_api_key),
        "simulation": "Merchant, buyers, prices, inventory, tax, and fulfillment are simulated. Group deadlines use real UTC; PayPal timestamps are never simulated in connected mode.",
    }


@app.post("/api/session", dependencies=[Depends(same_origin)])
def session(body: SessionBody, request: Request, response: Response):
    with connect() as db:
        owner = db.execute(
            "SELECT b.owner_id FROM sessions s JOIN buyers b ON b.id=s.buyer_id WHERE s.token_hash=%s AND s.expires_at>now()",
            (digest(request.cookies.get("coalition_session", "")),),
        ).fetchone()
        run_id = body.run_id
        if not run_id:
            restored = db.execute(
                "SELECT b.run_id FROM sessions s JOIN buyers b ON b.id=s.buyer_id JOIN runs r ON r.id=b.run_id WHERE s.token_hash=%s AND s.expires_at>now() AND r.mode=%s",
                (digest(request.cookies.get("coalition_session", "")), settings.mode),
            ).fetchone()
            run_id = restored["run_id"] if restored else None
        if not run_id:
            row = db.execute(
                "SELECT id FROM runs WHERE mode=%s AND NOT archived ORDER BY created_at DESC LIMIT 1",
                (settings.mode,),
            ).fetchone()
            run_id = row["id"] if row else None
        run = db.execute(
            "SELECT * FROM runs WHERE id=%s AND mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if body.shopping and not body.invite and run and run["profile"] == "legacy":
            run = db.execute(
                "SELECT * FROM runs WHERE mode=%s AND NOT archived AND profile IN ('small','large') ORDER BY created_at DESC LIMIT 1",
                (settings.mode,),
            ).fetchone()
            run_id = run["id"] if run else None
        if not run:
            raise HTTPException(
                404,
                "No purchase run is available. Prepare a run in operator controls.",
            )
        old = db.execute(
            "SELECT b.* FROM buyers b WHERE b.owner_id=%s AND b.run_id=%s ORDER BY b.prepared DESC LIMIT 1",
            (owner["owner_id"] if owner else None, run_id),
        ).fetchone()
        if body.invite:
            row = db.execute(
                "SELECT * FROM buyers WHERE invite_hash=%s AND run_id=%s",
                (digest(body.invite), run_id),
            ).fetchone()
            if not row:
                raise HTTPException(403, "Preparation invitation is invalid.")
        elif old:
            row = old
        else:
            buyer_id = uuid4()
            persona = {
                "budget_minor": 7000,
                "delivery_days": 10,
                "product_id": "arc-991",
                "variant": "Graphite",
                "needs": "Required scientific calculator for engineering class. Exact model only.",
            }
            db.execute(
                "INSERT INTO buyers(id,run_id,name,persona,owner_id) VALUES(%s,%s,'You',%s,%s) ON CONFLICT(run_id,owner_id) DO NOTHING",
                (
                    buyer_id,
                    run_id,
                    Jsonb(persona),
                    owner["owner_id"] if owner else buyer_id,
                ),
            )
            row = db.execute(
                "SELECT * FROM buyers WHERE run_id=%s AND owner_id=%s",
                (run_id, owner["owner_id"] if owner else buyer_id),
            ).fetchone()
        token = secrets.token_urlsafe(32)
        db.execute(
            "INSERT INTO sessions(token_hash,buyer_id) VALUES(%s,%s)",
            (digest(token), row["id"]),
        )
        response.set_cookie(
            "coalition_session",
            token,
            httponly=True,
            secure=settings.public_url.startswith("https://"),
            samesite="none" if settings.public_url.startswith("https://") else "lax",
            max_age=86400,
        )
        return {"buyer_id": row["id"], "run_id": run_id, "name": row["name"]}


@app.get("/api/catalog")
def catalog():
    return PRODUCTS


@app.post("/api/opportunity", dependencies=[Depends(same_origin)])
def opportunity(context: ProductContext, b=Depends(buyer)):
    validate_context(context)
    with connect() as db:
        g = db.execute(
            "SELECT offer_id FROM groups WHERE run_id=%s", (b["run_id"],)
        ).fetchone()
        if not g or not g["offer_id"]:
            return {
                "available": False,
                "reason": "Enter your requirements and negotiate a quote first.",
            }
        terms = terms_for(
            db,
            db.execute(
                "SELECT id FROM groups WHERE run_id=%s", (b["run_id"],)
            ).fetchone()["id"],
        )
        if terms.get("pricing_model") == "tiers":
            if (context.product_id, context.selected_variant, context.quantity) != (
                terms["product_id"],
                terms["variant"],
                1,
            ):
                return {
                    "available": False,
                    "reason": "No exact accepted quote for this selection.",
                }
            return {"available": True, **snapshot(db, b)}
    if (context.product_id, context.selected_variant, context.quantity) != (
        "arc-991",
        "Graphite",
        1,
    ):
        return {
            "available": False,
            "reason": "No exact group offer for this selection.",
        }
    with connect() as db:
        return {"available": True, **snapshot(db, b)}


@app.get("/api/status")
def status(b=Depends(buyer)):
    with connect() as db:
        g = db.execute(
            "SELECT offer_id FROM groups WHERE run_id=%s", (b["run_id"],)
        ).fetchone()
        if not g or not g["offer_id"]:
            raise HTTPException(
                409, "No accepted quote yet. Return to your request to negotiate."
            )
        return snapshot(db, b)


@app.post("/api/requests", dependencies=[Depends(same_origin)])
def request_entry(body: RequestInput, b=Depends(buyer)):
    with connect() as db:
        return submit_request(db, b, body)


class NegotiationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: str = Field(max_length=100)


@app.post("/api/negotiations", dependencies=[Depends(same_origin)])
def negotiate(body: NegotiationBody, b=Depends(buyer)):
    with connect() as db:
        return start_negotiation(db, b, body.product_id)


@app.get("/api/journey")
def journey(b=Depends(buyer)):
    with connect() as db:
        req = latest_request(db, b["id"])
        g = db.execute(
            "SELECT g.*,r.profile FROM groups g JOIN runs r ON r.id=g.run_id WHERE g.run_id=%s",
            (b["run_id"],),
        ).fetchone()
        assessments = db.execute(
            "SELECT a.*,s.available FROM compatibility_assessments a JOIN catalog_stock s ON s.product_id=a.product_id WHERE request_id=%s",
            (req["id"] if req else None,),
        ).fetchall()
        n = db.execute(
            "SELECT id,status,error,created_at FROM negotiations WHERE group_id=%s ORDER BY created_at DESC LIMIT 1",
            (g["id"],),
        ).fetchone()
        rounds = db.execute(
            "SELECT id,role,valid,public_summary,created_at FROM negotiation_rounds WHERE negotiation_id=%s ORDER BY ordinal",
            (n["id"] if n else None,),
        ).fetchall()
        offer = terms_for(db, g["id"]) if g["offer_id"] else None
        compatible = 0
        if offer:
            compatible = (
                sum(
                    eligible_for_quote(db, row["id"], offer)
                    for row in db.execute(
                        "SELECT id FROM buyers WHERE run_id=%s", (b["run_id"],)
                    ).fetchall()
                )
                if offer.get("pricing_model") == "tiers"
                else 0
            )
        return {
            "request": req,
            "assessments": assessments,
            "negotiation": n,
            "rounds": rounds,
            "group": {
                "id": g["id"],
                "run_id": g["run_id"],
                "status": g["status"],
                "profile": g["profile"],
            },
            "status": snapshot(db, b)
            if offer and offer.get("pricing_model") == "tiers"
            else None,
            "compatible_count": compatible,
            "eligible": eligible_for_quote(db, b["id"], offer)
            if offer and offer.get("pricing_model") == "tiers"
            else False,
            "products": [p for p in PRODUCTS if p["category"] == "Headphones"],
        }


@app.get("/api/purchases")
def purchases(b=Depends(buyer)):
    with connect() as db:
        return db.execute(
            "SELECT DISTINCT ON (c.group_id) g.run_id,g.status AS group_status,o.terms,c.capture_status,c.refund_status,c.void_status,c.authorization_status,c.active,c.captured_minor,c.created_at FROM commitments c JOIN buyers b ON b.id=c.buyer_id JOIN groups g ON g.id=c.group_id JOIN runs r ON r.id=g.run_id JOIN offers o ON o.id=g.offer_id WHERE b.owner_id=%s AND r.mode=%s ORDER BY c.group_id,c.created_at DESC",
            (b["owner_id"], settings.mode),
        ).fetchall()


class JoinBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    group_id: UUID
    context: ProductContext
    accepted_terms: dict


@app.post("/api/commitments", dependencies=[Depends(same_origin)])
def commitment(body: JoinBody, b=Depends(buyer)):
    with connect() as db:
        return join(db, b, body.group_id, body.context, body.accepted_terms)


class ApprovalBody(BaseModel):
    order_id: str = Field(max_length=100)


@app.post(
    "/api/commitments/{commitment_id}/authorize", dependencies=[Depends(same_origin)]
)
def authorize(commitment_id: UUID, body: ApprovalBody, b=Depends(buyer)):
    with connect() as db:
        c = db.execute(
            "SELECT * FROM commitments WHERE id=%s AND buyer_id=%s",
            (commitment_id, b["id"]),
        ).fetchone()
        if not c:
            raise HTTPException(404, "Commitment not found.")
        if body.order_id != c["order_id"]:
            raise HTTPException(409, "Order does not belong to this commitment.")
        lock_group(db, c["group_id"])
        if c["authorization_id"]:
            return {"status": "already_authorized"}
        enqueue(
            db,
            "authorize",
            {"commitment_id": str(c["id"]), "group_id": str(c["group_id"])},
            f"authorize:{c['id']}",
        )
        return {"status": "authorization_queued", "mode": settings.mode}


@app.post("/api/paypal/webhook")
def webhook(request: Request, event: dict):
    rate_limit(request)
    if not isinstance(event.get("id"), str) or len(event["id"]) > 150:
        raise HTTPException(422, "Missing or invalid event ID.")
    if len(str(event)) > 100000:
        raise HTTPException(413, "Webhook body too large.")
    names = (
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time",
    )
    headers = {name: request.headers.get(name) for name in names}
    if not all(headers.values()) or settings.mode != "connected":
        raise HTTPException(401, "Signed sandbox webhook required.")
    with connect() as db:
        db.execute(
            "INSERT INTO webhook_events(id,payload,headers,verified) VALUES(%s,%s,%s,false) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,headers=EXCLUDED.headers,processed_at=NULL WHERE NOT webhook_events.verified",
            (event["id"], Jsonb(event), Jsonb(headers)),
        )
        enqueue(db, "event", {"event_id": event["id"]}, "event:" + event["id"])
        db.execute(
            "UPDATE jobs SET status='ready',available_at=now(),attempts=0 WHERE dedupe_key=%s AND status IN ('done','recovery') AND EXISTS(SELECT 1 FROM webhook_events WHERE id=%s AND NOT verified)",
            ("event:" + event["id"], event["id"]),
        )
    return {"received": True, "verification": "queued"}


class RunBody(BaseModel):
    scenario: str = "success"
    demo: bool = True
    profile: str = "small"
    close_seconds: int = Field(default=600, ge=90, le=1800)


@app.post("/api/operator/runs", dependencies=[Depends(operator)])
def new_run(body: RunBody):
    if body.scenario not in ("success", "deadline", "partial", "refund_pending"):
        raise HTTPException(422, "Unknown demo scenario.")
    if settings.mode == "connected" and body.scenario not in ("success", "deadline"):
        raise HTTPException(422, "Fault injection is fixture-only.")
    with connect() as db:
        if body.profile not in ("legacy", "small", "large"):
            raise HTTPException(422, "Unknown run profile.")
        result = create_run(db, body.scenario, body.demo, body.profile)
        db.execute(
            "UPDATE runs SET close_seconds=%s WHERE id=%s",
            (body.close_seconds, result["run_id"]),
        )
        return result


@app.get("/api/operator/runs", dependencies=[Depends(operator)])
def runs():
    with connect() as db:
        return db.execute(
            "SELECT r.*,g.id AS group_id,g.status,g.deadline FROM runs r JOIN groups g ON g.run_id=r.id WHERE r.mode=%s ORDER BY created_at DESC LIMIT 30",
            (settings.mode,),
        ).fetchall()


@app.get("/api/operator/runs/{run_id}", dependencies=[Depends(operator)])
def evidence(run_id: UUID):
    with connect() as db:
        group = db.execute(
            "SELECT g.*,r.mode,r.scenario,r.profile FROM groups g JOIN runs r ON r.id=g.run_id WHERE run_id=%s AND r.mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if not group:
            raise HTTPException(404, "Run not found.")
        rows = db.execute(
            "SELECT b.id,b.name,b.prepared,c.admitted,c.active,c.withdrawn,d.status AS decision_status,d.result,d.error AS decision_error,c.id AS commitment_id,c.order_id,c.authorization_id,c.authorization_status,c.capture_id,c.capture_status,c.refund_id,c.refund_status,c.void_status,c.error FROM buyers b LEFT JOIN LATERAL (SELECT * FROM ai_decisions WHERE buyer_id=b.id ORDER BY created_at DESC LIMIT 1) d ON true LEFT JOIN commitments c ON c.buyer_id=b.id WHERE b.run_id=%s ORDER BY b.name",
            (run_id,),
        ).fetchall()
        jobs = db.execute(
            "SELECT id,kind,status,attempts,error FROM jobs WHERE payload->>'group_id'=%s OR payload->>'decision_id' IN (SELECT id::text FROM ai_decisions WHERE group_id=%s)",
            (str(group["id"]), group["id"]),
        ).fetchall()
        ops = db.execute(
            "SELECT p.* FROM payment_operations p JOIN commitments c ON c.id=p.commitment_id WHERE c.group_id=%s ORDER BY p.updated_at",
            (group["id"],),
        ).fetchall()
        events = db.execute(
            "SELECT id,group_id,verified,received_at,processed_at,payload->>'event_type' AS event_type FROM webhook_events WHERE group_id=%s ORDER BY received_at DESC LIMIT 20",
            (group["id"],),
        ).fetchall()
        for row in rows:
            for field in ("order_id", "authorization_id", "capture_id", "refund_id"):
                row[field] = redact(row[field])
        for op in ops:
            op["response"] = {
                "id": redact((op["response"] or {}).get("id")),
                "status": (op["response"] or {}).get("status"),
            }
        observations = db.execute(
            "SELECT p.kind,p.provider_status,p.source,p.observed_at,p.event_id,p.resource_id FROM payment_observations p JOIN commitments c ON c.id=p.commitment_id WHERE c.group_id=%s ORDER BY observed_at DESC LIMIT 40",
            (group["id"],),
        ).fetchall()
        for observation in observations:
            observation["resource_id"] = redact(observation["resource_id"])
            observation["event_id"] = redact(observation["event_id"])
        requests = db.execute(
            "SELECT q.id,q.buyer_id,q.version,q.status,q.constraints,q.error FROM buyer_requests q JOIN buyers b ON b.id=q.buyer_id WHERE b.run_id=%s ORDER BY q.created_at DESC",
            (run_id,),
        ).fetchall()
        negotiations = db.execute(
            "SELECT * FROM negotiations WHERE group_id=%s ORDER BY created_at DESC",
            (group["id"],),
        ).fetchall()
        rounds = db.execute(
            "SELECT r.* FROM negotiation_rounds r JOIN negotiations n ON n.id=r.negotiation_id WHERE n.group_id=%s ORDER BY r.id",
            (group["id"],),
        ).fetchall()
        return {
            "observations": observations,
            "group": group,
            "buyers": rows,
            "jobs": jobs,
            "operations": ops,
            "events": events,
            "requests": requests,
            "negotiations": negotiations,
            "rounds": rounds,
            "offer": terms_for(db, group["id"]) if group["offer_id"] else None,
        }


@app.post("/api/operator/runs/{run_id}/activate", dependencies=[Depends(operator)])
def activate(run_id: UUID):
    with connect() as db:
        group = db.execute(
            "SELECT g.* FROM groups g JOIN runs r ON r.id=g.run_id WHERE run_id=%s AND r.mode=%s AND NOT r.archived",
            (run_id, settings.mode),
        ).fetchone()
        if not group:
            raise HTTPException(404, "Run not found.")
        group = lock_group(db, group["id"])
        if (
            group["status"] != "OPEN"
            or group["activated"]
            or expired(db, group["preparation_expires_at"])
        ):
            raise HTTPException(409, "Preparation ended or group already activated.")
        terms = terms_for(db, group["id"])
        db.execute(
            "UPDATE groups SET activated=true,deadline=CASE WHEN %s THEN deadline ELSE clock_timestamp()+interval '90 seconds' END WHERE id=%s",
            (terms.get("pricing_model") == "tiers", group["id"]),
        )
        freeze(db, group["id"])
        db.execute(
            "UPDATE jobs SET status='ready',available_at=now(),attempts=0 WHERE dedupe_key=%s AND status!='running'",
            ("tick:" + str(group["id"]),),
        )
        return {
            "status": "activated",
            "deadline": terms.get("close_at"),
            "deadline_seconds": 90 if terms.get("pricing_model") != "tiers" else None,
        }


@app.post("/api/operator/runs/{run_id}/archive", dependencies=[Depends(operator)])
def archive(run_id: UUID):
    with connect() as db:
        group = db.execute(
            "SELECT g.* FROM groups g JOIN runs r ON r.id=g.run_id WHERE run_id=%s AND r.mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if not group:
            raise HTTPException(404, "Run not found.")
        group = lock_group(db, group["id"])
        if group["status"] == "SUCCEEDED":
            raise HTTPException(
                409,
                "Completed captures are retained. This demo cannot be reset until the operator refunds them through the recovery action.",
            )
        if group["status"] != "FAILED" or not all(
            safe_terminal(db, c) for c in members(db, group["id"])
        ):
            raise HTTPException(
                409,
                "Payments remain unresolved. Reconcile and clean up before archiving.",
            )
        db.execute("UPDATE runs SET archived=true WHERE id=%s", (run_id,))
        return {"archived": True, "records_retained": True}


@app.post("/api/operator/runs/{run_id}/cleanup", dependencies=[Depends(operator)])
def cleanup(run_id: UUID):
    with connect() as db:
        group = db.execute(
            "SELECT g.* FROM groups g JOIN runs r ON r.id=g.run_id WHERE run_id=%s AND r.mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if not group:
            raise HTTPException(404, "Run not found.")
        group = lock_group(db, group["id"])
        if group["status"] == "SETTLING":
            raise HTTPException(
                409, "Membership is frozen. Let settlement reconcile before cleanup."
            )
        if group["status"] == "SUCCEEDED":
            raise HTTPException(
                409,
                "Purchased group retained. Use the explicit sandbox refund cleanup endpoint.",
            )
        unwind(db, group["id"], "Merchant canceled the offer or requested cleanup.")
        db.execute(
            "UPDATE jobs SET status='ready',attempts=0,available_at=now() WHERE dedupe_key=%s AND status!='running'",
            ("tick:" + str(group["id"]),),
        )
        return {"status": "cleanup_requested", "refunds": "Not yet completed"}


@app.post("/api/operator/jobs/{job_id}/retry", dependencies=[Depends(operator)])
def retry(job_id: int):
    with connect() as db:
        job = db.execute(
            "UPDATE jobs SET status='ready',attempts=0,available_at=now() WHERE id=%s AND status='recovery' RETURNING id",
            (job_id,),
        ).fetchone()
        if not job:
            raise HTTPException(409, "Only exhausted recovery jobs can be retried.")
    return {"retried": True}


@app.get("/api/health")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok", "mode": settings.mode}


@app.post(
    "/api/operator/runs/{run_id}/preparation-links", dependencies=[Depends(operator)]
)
def preparation_links(run_id: UUID):
    with connect() as db:
        run = db.execute(
            "SELECT * FROM runs WHERE id=%s AND mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if not run:
            raise HTTPException(404, "Run not found.")
        links = []
        for b in db.execute(
            "SELECT id,name FROM buyers WHERE run_id=%s AND prepared ORDER BY name",
            (run_id,),
        ).fetchall():
            token = secrets.token_urlsafe(32)
            db.execute(
                "UPDATE buyers SET invite_hash=%s WHERE id=%s", (digest(token), b["id"])
            )
            links.append(
                {
                    "name": b["name"],
                    "buyer_id": str(b["id"]),
                    "url": f"{settings.public_url}/?run={run_id}&invite={token}",
                }
            )
        return {
            "run_id": str(run_id),
            "judge_url": f"{settings.public_url}/?run={run_id}",
            "preparation_links": links,
        }


@app.post(
    "/api/operator/runs/{run_id}/fixture-prepare", dependencies=[Depends(operator)]
)
def fixture_prepare(run_id: UUID):
    if settings.mode != "fixture":
        raise HTTPException(409, "Simulated approvals are disabled in connected mode.")
    with connect() as db:
        group = db.execute(
            "SELECT id,status FROM groups WHERE run_id=%s", (run_id,)
        ).fetchone()
        if not group or group["status"] != "OPEN":
            raise HTTPException(409, "Prepare an inactive fixture group first.")
        enqueue(
            db,
            "fixture_prepare",
            {"group_id": str(group["id"])},
            "fixture-prepare:" + str(group["id"]),
        )
    return {
        "status": "fixture_preparation_queued",
        "disclosure": "Explicit simulated approvals; no PayPal calls.",
    }


@app.post(
    "/api/operator/runs/{run_id}/fixture-refunds", dependencies=[Depends(operator)]
)
def fixture_refunds(run_id: UUID):
    if settings.mode != "fixture":
        raise HTTPException(
            409, "Simulated refund confirmations are disabled in connected mode."
        )
    with connect() as db:
        group = db.execute(
            "SELECT id FROM groups WHERE run_id=%s", (run_id,)
        ).fetchone()
        if not group:
            raise HTTPException(404, "Run not found.")
        lock_group(db, group["id"])
        db.execute(
            "UPDATE commitments SET refund_status='COMPLETED' WHERE group_id=%s AND refund_status='PENDING'",
            (group["id"],),
        )
        db.execute(
            "UPDATE payment_operations p SET response=jsonb_set(response,'{status}','\"COMPLETED\"') FROM commitments c WHERE c.id=p.commitment_id AND c.group_id=%s AND p.kind='refund' AND c.refund_status='COMPLETED'",
            (group["id"],),
        )
        return {"status": "fixture_refunds_completed", "mode": "fixture"}


class RefundRecoveryBody(BaseModel):
    refund_id: str = Field(pattern=r"^[A-Za-z0-9]{1,100}$")


@app.post(
    "/api/operator/commitments/{commitment_id}/confirm-refund",
    dependencies=[Depends(operator)],
)
def recovered_refund(commitment_id: UUID, body: RefundRecoveryBody):
    if settings.mode != "connected":
        raise HTTPException(409, "Provider-confirmed recovery is connected-only.")
    with connect() as db:
        c = db.execute(
            "SELECT c.* FROM commitments c JOIN groups g ON g.id=c.group_id JOIN runs r ON r.id=g.run_id WHERE c.id=%s AND r.mode=%s",
            (commitment_id, settings.mode),
        ).fetchone()
        if not c or not c["capture_id"]:
            raise HTTPException(404, "Captured payment not found.")
        enqueue(
            db,
            "refund_recovery",
            {
                "commitment_id": str(c["id"]),
                "group_id": str(c["group_id"]),
                "refund_id": body.refund_id,
            },
            f"recovery-refund:{c['id']}:{body.refund_id}",
        )
        return {"status": "proof_check_queued", "refund_completed": False}


class AssistantBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_text: str = Field(min_length=3, max_length=1200)


@app.post("/api/assistant", dependencies=[Depends(same_origin)])
def assistant(body: AssistantBody, b=Depends(buyer)):
    if settings.mode == "connected" and not settings.llm_api_key:
        raise HTTPException(
            503,
            "Assistant unavailable. Ordinary offer browsing and checkout remain usable.",
        )
    with connect() as db:
        group = db.execute(
            "SELECT id FROM groups WHERE run_id=%s", (b["run_id"],)
        ).fetchone()
        did = uuid4()
        db.execute(
            "INSERT INTO ai_decisions(id,buyer_id,group_id,mode,request_text) VALUES(%s,%s,%s,%s,%s)",
            (did, b["id"], group["id"], settings.mode, body.request_text),
        )
        enqueue(db, "ai", {"decision_id": str(did)}, f"ai:{did}")
        return {"id": str(did), "status": "queued"}


@app.post("/api/commitments/{commitment_id}/leave", dependencies=[Depends(same_origin)])
def leave(commitment_id: UUID, b=Depends(buyer)):
    with connect() as db:
        withdraw(db, b["id"], commitment_id)
    return {
        "status": "cancellation_in_progress",
        "hold_release": "Provider and bank timing varies.",
    }


@app.post("/api/operator/runs/{run_id}/cancel", dependencies=[Depends(operator)])
def merchant_cancel(run_id: UUID):
    with connect() as db:
        g = db.execute(
            "SELECT g.* FROM groups g JOIN runs r ON r.id=g.run_id WHERE run_id=%s AND r.mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if not g:
            raise HTTPException(404, "Run not found.")
        g = lock_group(db, g["id"])
        if g["status"] != "OPEN":
            raise HTTPException(
                409, f"Participation is frozen. Current state: {g['status']}."
            )
        unwind(db, g["id"], "Merchant canceled the open offer.")
    return {"status": "UNWINDING"}


@app.post(
    "/api/operator/runs/{run_id}/refund-cleanup", dependencies=[Depends(operator)]
)
def sandbox_refund_cleanup(run_id: UUID):
    with connect() as db:
        g = db.execute(
            "SELECT g.* FROM groups g JOIN runs r ON r.id=g.run_id WHERE run_id=%s AND r.mode=%s",
            (run_id, settings.mode),
        ).fetchone()
        if not g:
            raise HTTPException(404, "Run not found.")
        g = lock_group(db, g["id"])
        if g["status"] != "SUCCEEDED":
            raise HTTPException(
                409, "Only a successfully purchased sandbox run can use refund cleanup."
            )
        db.execute(
            "UPDATE groups SET status='UNWINDING',inventory_reserved=%s,failure_reason='Explicit operator sandbox cleanup after completed demo purchase' WHERE id=%s",
            (terms_for(db, g["id"])["capacity"], g["id"]),
        )
        wake(db, g["id"])
    return {"status": "refund_cleanup_requested", "refunds": "Not yet completed"}


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Endpoint not found.")
        return FileResponse(DIST / "index.html")
