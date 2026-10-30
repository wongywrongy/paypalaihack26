"""Opaque server-side ownership, same-origin CSRF and scoped operator sessions."""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import HTTPException

from .config import settings

COOKIE = "rally_session"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def csrf(raw):
    return hmac.new(raw.encode(), b"rally-csrf-v2", hashlib.sha256).hexdigest()


def current(db, request, response=None):
    raw = request.cookies.get(COOKIE, "")
    row = None
    if 32 <= len(raw) <= 100:
        row = db.execute("SELECT * FROM shopper_sessions WHERE token_hash=%s AND expires_at>now()", (digest(raw),)).fetchone()
    if row:
        return row, raw
    if response is None:
        raise HTTPException(401, "Open the shop again to restore your session.")
    raw = secrets.token_urlsafe(32)
    sid = uuid4()
    db.execute("INSERT INTO shopper_sessions(id,token_hash,expires_at) VALUES(%s,%s,%s)", (sid, digest(raw), datetime.now(timezone.utc) + timedelta(days=14)))
    set_cookie(response, raw)
    return db.execute("SELECT * FROM shopper_sessions WHERE id=%s", (sid,)).fetchone(), raw


def set_cookie(response, raw):
    response.set_cookie(COOKIE, raw, httponly=True, secure=urlsplit(settings.public_url).scheme == "https", samesite="lax", max_age=14 * 86400, path="/")


def check_write(request, raw):
    supplied = request.headers.get("x-csrf-token", "")
    if not hmac.compare_digest(supplied.encode(), csrf(raw).encode()):
        raise HTTPException(403, "Refresh this page before saving your change.")
    origin = request.headers.get("origin")
    expected = urlsplit(settings.public_url)
    if origin and origin != f"{expected.scheme}://{expected.netloc}":
        raise HTTPException(403, "Open Rally on its configured address.")


def scoped(row, role, shop_id=None, *, write=False):
    if row["role"] != role or (shop_id and row["shop_id"] != shop_id) or (write and row["read_only"]):
        raise HTTPException(403, "This workspace is not available to your account.")


def login(db, row, request, response, role, shop_id, password):
    if role not in ("shop", "hub") or (role == "shop" and shop_id not in ("dalbit", "bada", "haneul")):
        raise HTTPException(400, "Choose a valid workspace.")
    address = request.client.host if request.client else "unknown"
    rate_key = digest(address)
    attempt = db.execute("INSERT INTO login_attempts(ip_hash,attempts) VALUES(%s,1) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN login_attempts.window_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_at=CASE WHEN login_attempts.window_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_at END RETURNING attempts", (rate_key,)).fetchone()
    db.commit()
    if attempt["attempts"] > 10:
        raise HTTPException(429, "Please wait before trying to sign in again.")
    expected = os.getenv("RALLY_HUB_PASSWORD" if role == "hub" else "RALLY_SHOP_PASSWORD_" + shop_id.upper(), "")
    judge = os.getenv("RALLY_JUDGE_PASSWORD", "") if role == "shop" else ""
    writer = os.getenv("RALLY_JUDGE_WRITER_PASSWORD", "") if role == "shop" and shop_id == "haneul" else ""
    judge_writer = bool(writer and hmac.compare_digest(password.encode(), writer.encode()))
    read_only = not judge_writer and bool(judge and hmac.compare_digest(password.encode(), judge.encode()))
    if not judge_writer and not read_only and not (expected and hmac.compare_digest(password.encode(), expected.encode())):
        raise HTTPException(401, "Workspace sign-in did not match.")
    raw = secrets.token_urlsafe(32)
    db.execute("UPDATE shopper_sessions SET token_hash=%s,role=%s,shop_id=%s,read_only=%s,judge_writer=%s WHERE id=%s", (digest(raw), role, shop_id if role == "shop" else None, read_only, judge_writer, row["id"]))
    set_cookie(response, raw)
    return {"csrf_token": csrf(raw), "paypal_client_id": settings.paypal_client_id, "role": role, "shop_id": shop_id if role == "shop" else None, "read_only": read_only}
