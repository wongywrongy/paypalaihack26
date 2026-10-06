import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mode: str = os.getenv("COALITION_MODE", "fixture")
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql://coalition:coalition@localhost:5432/coalition"
    )
    public_url: str = os.getenv("PUBLIC_URL", "http://localhost:5173").rstrip("/")
    operator_token: str = os.getenv("OPERATOR_TOKEN", "")
    paypal_client_id: str = os.getenv("PAYPAL_CLIENT_ID", "")
    paypal_client_secret: str = os.getenv("PAYPAL_CLIENT_SECRET", "")
    paypal_merchant_id: str = os.getenv("PAYPAL_MERCHANT_ID", "")
    payments_retry_hours: float = float(os.getenv("PAYPAL_PAYMENTS_RETRY_HOURS", "0"))
    paypal_webhook_id: str = os.getenv("PAYPAL_WEBHOOK_ID", "")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model: str = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.anthropic.com").rstrip(
        "/"
    )


settings = Settings()
if settings.mode not in ("fixture", "connected"):
    raise RuntimeError(
        "COALITION_MODE must be fixture or connected; no automatic fallback."
    )
