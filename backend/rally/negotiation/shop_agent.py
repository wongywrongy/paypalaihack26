"""Private policy scoring stays in code; only aggregate scores reach the model."""

from dataclasses import replace

from ..fx import basis
from .rally_agent import shipping


def target(line, catalog):
    offer = catalog.offers[line.offer_id]
    policy = catalog.policies[offer["shop_id"]]
    price = ((basis(offer["list_usd"], 10000 - policy["discount_bp"]) + 50) // 100) * 100
    return max(offer["floor_usd"], min(offer["list_usd"], price))


def utility(lines, extras, catalog):
    shop = catalog.offers[lines[0].offer_id]["shop_id"]
    policy = catalog.policies[shop]
    if any(line.unit_usd_cents < catalog.offers[line.offer_id]["floor_usd"] for line in lines):
        return None
    return sum((line.unit_usd_cents - catalog.offers[line.offer_id]["floor_usd"]) * line.qty for line in lines) + shipping(lines, catalog) - policy["pickup_cost"] - len(extras) * policy["sample_cost"]


def permitted(lines, extras, catalog):
    shop = catalog.offers[lines[0].offer_id]["shop_id"]
    if extras and not catalog.policies[shop]["sample_kit"]:
        return False
    baseline = tuple(replace(line, unit_usd_cents=target(line, catalog)) for line in lines)
    score = utility(lines, extras, catalog)
    threshold = utility(baseline, extras, catalog)
    return score is not None and threshold is not None and score >= threshold


def counters(lines, extras, catalog, reply):
    result = []
    for concession in ((100, 0) if reply == 1 else (0,)):
        candidate = tuple(replace(line, unit_usd_cents=min(catalog.offers[line.offer_id]["list_usd"], target(line, catalog) + (concession if catalog.offers[line.offer_id]["variant"] == "current" and catalog.policies[catalog.offers[line.offer_id]["shop_id"]]["discount_bp"] else 0))) for line in lines)
        if permitted(candidate, extras, catalog) and (candidate, extras) not in result:
            result.append((candidate, extras))
    return result
