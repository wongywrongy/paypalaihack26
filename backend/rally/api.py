"""M1 surface: health, durable PayPal receipts, and the built frontend."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse

from .config import settings
from .db import connect
from .payments.webhooks import receive

app = FastAPI(title="Rally")
FRONTEND_ROOT = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": settings.mode, "app": "rally"}


@app.post("/api/paypal/webhook")
async def webhook(request: Request):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 1024 * 1024:
            raise HTTPException(413, "Webhook exceeds 1 MiB.")
    try:
        with connect() as db:
            receive(db, dict(request.headers), bytes(raw))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid webhook JSON.") from None
    return {"received": True}


@app.get("/{path:path}")
def frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(404)
    root = FRONTEND_ROOT
    candidate = (root / path).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise HTTPException(404)
    target = candidate if candidate.is_file() else root / "index.html"
    if not target.is_file():
        raise HTTPException(404, "Build the frontend first.")
    return FileResponse(target)
