"""PLAN strategies A-D. Fixture output is not the hosted-model benchmark gate."""

from time import monotonic

from ..negotiation.engine import negotiate
from ..negotiation.shop_agent import utility
from ..sourcing import source
from . import chatbot
from .generator import cases


def run(seed=20261023, count=500, *, connected=False):
    if type(count) is not int or not 1 <= count <= 500:
        raise ValueError("Choose one to five hundred benchmark cases.")
    started = monotonic()
    report = {"seed": seed, "requested_cases": count, "completed_cases": 0, "unsupported_cases": 0, "model_mode": "hosted B/D requested" if connected else "explicit deterministic fixture; no provider calls; B not executed", "strategies": {"A": "exact sourcing at listed prices", "B": "two model price-only baseline (no money)", "C": "code acceptance without shopper rules", "D": "full permitted term trading"}, "currency_totals": {}, "charge_above_hold": 0, "shop_below_authority": 0, "term_trading_beats_checkout": 0, "baseline_b_failed": 0, "d_model_choices": 0, "mean_savings_basis_points": 0}
    savings = 0
    def choose(role, payload):
        return {"index": 0, "note": "Public catalog terms for this offline comparison."}
    for _, catalog, destination, items in cases(seed, count):
        try:
            exact = source(items, destination, catalog)
            a = exact["breakdown"]
        except ValueError:
            report["unsupported_cases"] += 1
            continue
        c = negotiate(exact, destination, catalog, {"old_packaging_ok": False, "add_small_extras_if_cheaper": False}, choose=choose)
        d = negotiate(exact, destination, catalog, {"old_packaging_ok": True, "add_small_extras_if_cheaper": True}, choose=None if connected else choose)
        b = None
        if connected:
            try:
                b = chatbot.run(exact, destination, catalog)["total"]
            except Exception:
                report["baseline_b_failed"] += 1
        totals = (a["total"], b, c["breakdown"]["total"], d["breakdown"]["total"])
        by_currency = report["currency_totals"].setdefault(a["currency"], {"A": 0, "B": None, "C": 0, "D": 0, "cases": 0})
        by_currency["cases"] += 1
        for key, amount in zip(("A", "B", "C", "D"), totals, strict=True):
            if amount is not None:
                by_currency[key] = (by_currency[key] or 0) + amount
        report["completed_cases"] += 1
        savings += (totals[0] - totals[3]) * 10000 // totals[0]
        report["term_trading_beats_checkout"] += totals[3] < totals[0]
        report["d_model_choices"] += sum(e["chosen_by"] == "LLM" for e in d["events"])
        for outcome in (c, d):
            report["charge_above_hold"] += outcome["breakdown"]["total"] > exact["breakdown"]["total"]
            for shop in {catalog.offers[line.offer_id]["shop_id"] for line in outcome["lines"]}:
                lines = tuple(line for line in outcome["lines"] if catalog.offers[line.offer_id]["shop_id"] == shop)
                extras = tuple(extra for extra in outcome["extras"] if extra.startswith(shop))
                score = utility(lines, extras, catalog)
                report["shop_below_authority"] += score is None or score < 0
    if report["completed_cases"]:
        report["mean_savings_basis_points"] = savings // report["completed_cases"]
    report["execution_seconds"] = round(monotonic() - started, 3)
    return report
