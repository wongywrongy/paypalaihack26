"""Connected sandbox by default; fixtures are explicit and test-only."""

import os
from dataclasses import dataclass, field


def env(name, default=""):
    return field(default_factory=lambda: os.getenv(name, default))


@dataclass(frozen=True)
class Settings:
    mode: str = env("RALLY_MODE", "connected")
    database_url: str = env(
        "DATABASE_URL", "postgresql://rally:rally@localhost:5432/rally"
    )
    database_schema: str = env("RALLY_DATABASE_SCHEMA", "rally")
    public_url: str = env("PUBLIC_URL", "http://localhost:5173")
    paypal_client_id: str = env("PAYPAL_CLIENT_ID")
    paypal_client_secret: str = env("PAYPAL_CLIENT_SECRET")
    paypal_merchant_id: str = env("PAYPAL_MERCHANT_ID")
    paypal_webhook_id: str = env("PAYPAL_WEBHOOK_ID")
    llm_api_key: str = env("LLM_API_KEY")
    llm_model: str = env("LLM_MODEL")
    llm_protocol: str = env("LLM_PROTOCOL", "openai")
    llm_base_url: str = env("LLM_BASE_URL")
    ollama_upstream: str = env("OLLAMA_UPSTREAM")
    # v3 bidding (docs/plan/BIDDING.md). Role models fall back to LLM_MODEL.
    llm_model_shop: str = env("LLM_MODEL_SHOP")
    llm_model_buyer: str = env("LLM_MODEL_BUYER")
    # json_object: schema goes in the system prompt only (providers without json_schema).
    llm_response_format: str = env("LLM_RESPONSE_FORMAT", "json_schema")
    # auction (v3, default for new orders once implemented) or exchange (v2 engine).
    deal_mode: str = env("RALLY_DEAL_MODE", "exchange")

    def model_for(self, role=None):
        if role == "shop" and self.llm_model_shop:
            return self.llm_model_shop
        if role in ("buyer", "rally") and self.llm_model_buyer:
            return self.llm_model_buyer
        return self.llm_model

    def __post_init__(self):
        if self.mode not in ("fixture", "connected"):
            raise ValueError("RALLY_MODE must be fixture or connected.")
        if self.llm_response_format not in ("json_schema", "json_object"):
            raise ValueError("LLM_RESPONSE_FORMAT must be json_schema or json_object.")
        if self.deal_mode not in ("auction", "exchange"):
            raise ValueError("RALLY_DEAL_MODE must be auction or exchange.")
        if self.mode == "fixture" and not os.getenv("RALLY_TESTING"):
            raise ValueError(
                "Fixture mode requires RALLY_TESTING; hosted demos use sandbox."
            )
        if not self.database_schema.isidentifier() or self.database_schema == "public":
            raise ValueError("Use a dedicated Rally database schema, never public.")


settings = Settings()
