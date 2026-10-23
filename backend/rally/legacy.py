"""Read-only historical receipts and recovery metadata; no retired checkout."""

from fastapi import APIRouter, HTTPException, Request

from . import sessions
from .db import connect
from .shopping import owner

router = APIRouter(prefix="/api")


def available(db):
    return bool(db.execute("SELECT to_regclass('public.commitments') IS NOT NULL AND to_regclass('public.sessions') IS NOT NULL AS present").fetchone()["present"])


def purchases(db, request):
    if not available(db):
        return []
    token = request.cookies.get("coalition_session", "")
    if not token or len(token) > 200:
        return []
    buyer = db.execute("SELECT b.owner_id FROM public.sessions s JOIN public.buyers b ON b.id=s.buyer_id JOIN public.runs r ON r.id=b.run_id WHERE s.token_hash=%s AND s.expires_at>now() AND r.mode='connected'", (sessions.digest(token),)).fetchone()
    if not buyer:
        return []
    rows = db.execute("SELECT DISTINCT ON(c.group_id) c.id,c.group_id,g.run_id,g.status AS group_status,c.accepted_terms AS terms,c.amount_minor,c.currency,c.authorization_status,c.capture_status,c.refund_status,c.void_status,c.active,c.captured_minor,c.created_at FROM public.commitments c JOIN public.buyers b ON b.id=c.buyer_id JOIN public.groups g ON g.id=c.group_id JOIN public.runs r ON r.id=g.run_id WHERE b.owner_id=%s AND r.mode='connected' ORDER BY c.group_id,c.created_at DESC", (buyer["owner_id"],)).fetchall()
    return rows


@router.get("/purchases")
def old_purchases(request: Request):
    with connect() as db:
        return purchases(db, request)


@router.get("/legacy/purchases")
def history(request: Request):
    return {"purchases": old_purchases(request)}


@router.get("/hub/legacy/recovery")
def recovery(request: Request):
    with connect() as db:
        row = owner(db, request)
        sessions.scoped(row, "hub")
        if not available(db):
            return {"operations": []}
        rows = db.execute("SELECT p.id,p.kind,p.status,p.amount_minor,c.currency,p.first_attempt_at,p.updated_at FROM public.payment_operations p JOIN public.commitments c ON c.id=p.commitment_id WHERE p.status IN ('unknown','inflight','pending','failed','ready') ORDER BY p.updated_at DESC LIMIT 100").fetchall()
        return {"operations": rows, "actions": "Inspect the original PayPal activity before resolving an operation without a provider reference. Retired operations are never resubmitted by Rally."}


@router.post("/commitments")
@router.post("/commitments/{commitment_id}/authorize")
def retired_checkout():
    raise HTTPException(410, "This checkout belongs to the earlier app. Its saved purchases remain available in history; do not repeat an unresolved payment.")
