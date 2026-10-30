"""Sandbox only. Every mutation has one durable logical operation and stable request ID."""

from functools import lru_cache
from threading import Lock
from time import monotonic

import httpx

from ..config import settings

BASE = "https://api-m.sandbox.paypal.com"
CURRENCIES = ("USD", "CAD", "GBP", "EUR", "AUD")
_oauth_lock = Lock()
_oauth_token = None
_oauth_expires = 0
_oauth_credentials = None


@lru_cache(maxsize=1)
def provider_client():
    return httpx.Client(timeout=25, follow_redirects=False)


def access_token(client):
    global _oauth_token, _oauth_expires, _oauth_credentials
    credentials = (settings.paypal_client_id, settings.paypal_client_secret)
    with _oauth_lock:
        if _oauth_credentials != credentials or monotonic() >= _oauth_expires:
            token = client.post(
                BASE + "/v1/oauth2/token",
                auth=credentials,
                data={"grant_type": "client_credentials"},
            )
            if token.status_code != 200:
                raise RecoveryRequired(
                    "PayPal OAuth failed; check sandbox credentials."
                )
            data = token.json()
            _oauth_token = data["access_token"]
            _oauth_expires = monotonic() + max(0, int(data["expires_in"]) - 60)
            _oauth_credentials = credentials
        return _oauth_token


class ProviderError(RuntimeError):
    def __init__(self, message, definitive=False):
        super().__init__(message)
        self.definitive = definitive


class RecoveryRequired(RuntimeError):
    pass


def paypal(method, path, body=None, key=None, raw_json=None):
    if (
        method != "GET"
        and path not in ("/v1/notifications/verify-webhook-signature",)
        and not key
    ):
        raise ValueError("PayPal mutations require a durable ledger idempotency key.")
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RecoveryRequired(
            "PayPal sandbox credentials missing; no fixture fallback."
        )
    client = provider_client()
    headers = {
        "Authorization": "Bearer " + access_token(client),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if key:
        headers["PayPal-Request-Id"] = str(key)
    response = client.request(
        method,
        BASE + path,
        headers=headers,
        **({"content": raw_json} if raw_json is not None else {"json": body}),
    )
    if response.status_code >= 400:
        # Timeouts/conflicts/5xx remain ambiguous and must be reconciled.
        definitive = response.status_code in (400, 403, 404, 422)
        try:
            data = response.json() if response.content else {}
        except ValueError:
            data = {}
        codes = ",".join(x.get("issue", "") for x in data.get("details", []))
        if codes in (
            "PREVIOUS_REQUEST_IN_PROGRESS",
            "ORDER_ALREADY_AUTHORIZED",
            "AUTHORIZATION_ALREADY_CAPTURED",
            "AUTHORIZATION_ALREADY_VOIDED",
        ):
            definitive = False
        raise ProviderError(
            f"PayPal HTTP {response.status_code}: {codes or data.get('name', 'request failed')}",
            definitive,
        )
    return (
        response.json() if response.content else {"http_status": response.status_code}
    )


def money(cents, currency="USD"):
    if type(cents) is not int or cents <= 0:
        raise ValueError("Money must be positive integer cents.")
    if currency not in CURRENCIES:
        raise ValueError("Unsupported shopper currency.")
    return {"currency_code": currency, "value": f"{cents // 100}.{cents % 100:02d}"}


def amount_matches(data, cents, currency="USD"):
    from decimal import Decimal, InvalidOperation

    try:
        return (
            currency in CURRENCIES
            and data["currency_code"] == currency
            and isinstance(data["value"], str)
            and Decimal(data["value"]) == Decimal(cents) / 100
        )
    except (KeyError, InvalidOperation, TypeError, ValueError):
        return False


def resource_path(kind, resource_id):
    import re

    if not isinstance(resource_id, str) or not re.fullmatch(
        r"[A-Za-z0-9-]{1,80}", resource_id
    ):
        raise ValueError("Invalid PayPal resource ID.")
    prefix = {
        "order": "/v2/checkout/orders/",
        "authorize": "/v2/payments/authorizations/",
        "void": "/v2/payments/authorizations/",
        "capture": "/v2/payments/captures/",
        "refund": "/v2/payments/refunds/",
        "payout": "/v1/payments/payouts/",
        "payout_item": "/v1/payments/payouts-item/",
    }[kind]
    return prefix + resource_id
