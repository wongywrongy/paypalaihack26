"""v3 shop bidding: shops bid for every item in three open rounds; code awards.

Contract (docs/plan/BIDDING.md):
- Models pick a candidate index and write a note. Code builds every bid, validates it
  against private authority, and decides leaders and the award.
- The checkout total (the PayPal hold) is a hard ceiling: assert final total <= hold.
- A failed or slow model call keeps that shop's previous bid (or its listed price).
- Events are v3 (`start`, `ask`, `bid`, `pass`, `round`, `award`, `error`, `done`).
"""

ROUNDS = 3
MAX_SECONDS = 30
CALL_TIMEOUT_SECONDS = 4
# Viewing pace for the live stream; the frontend also holds each event >= 600 ms.
ROUND_SECONDS = 3.5
RULE_KEYS = frozenset({"old_packaging_ok", "bundles_ok"})


def rules_checked(rules):
    """Exactly the v3 keys, booleans only. Raise ValueError otherwise."""
    if not isinstance(rules, dict) or set(rules) != RULE_KEYS or any(type(v) is not bool for v in rules.values()):
        raise ValueError("Choose both shopping permissions explicitly.")
    return rules


def run_auction(start, destination, catalog, rules, *, choose=None, emit=None, max_seconds=MAX_SECONDS, pace=False):
    """Run the auction and return the final allocation.

    start: {"lines": tuple[catalog.Line], "breakdown": {...}, "rate": int} — the immutable checkout.
    choose: test selector `choose(role, payload) -> Choice | AskChoice` ("shop" or "buyer");
            None uses the configured models (llm.complete with LLM_MODEL_SHOP / LLM_MODEL_BUYER).
    emit:   callback for each persisted v3 event dict.
    pace:   when True (worker path), space rounds by ROUND_SECONDS for live viewing; tests use False.

    Returns {"lines", "extras", "domestic_usd", "breakdown", "events", "winners",
             "model_calls", "elapsed_seconds"} with breakdown["total"] <= start["breakdown"]["total"].
    """
    rules_checked(rules)
    raise NotImplementedError("v3 auction: implement per docs/plan/BIDDING.md")
