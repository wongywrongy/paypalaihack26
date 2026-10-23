"""M1 surface: health, durable PayPal receipts, and the built frontend."""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse

from .config import settings
from .db import connect
from .legacy import router as legacy_router
from .payments.paypal import ProviderError, RecoveryRequired
from .payments.webhooks import receive
from .shopping import router
from .workspaces import router as workspace_router

app = FastAPI(title="Rally")
logging.getLogger("uvicorn.access").disabled = True
FRONTEND_ROOT = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@app.exception_handler(RequestValidationError)
async def invalid_input(request, exc):
    return JSONResponse(status_code=400, content={"detail": "Check the requested items and fields before trying again."})


@app.exception_handler(ValueError)
async def invalid_terms(request, exc):
    return JSONResponse(status_code=400, content={"detail": "The requested terms are not available. Review your bag and try again."})


@app.exception_handler(RecoveryRequired)
async def recovery_required(request, exc):
    return JSONResponse(status_code=409, content={"detail": "This payment needs review. Its saved operation will be reconciled before another attempt."})


@app.exception_handler(ProviderError)
async def provider_unavailable(request, exc):
    return JSONResponse(status_code=503, content={"detail": "PayPal could not confirm this step. Keep your saved order for recovery."})


@app.middleware("http")
async def private_cache(request, call_next):
    response = await call_next(request)
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(router)
app.include_router(workspace_router)
app.include_router(legacy_router)


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
