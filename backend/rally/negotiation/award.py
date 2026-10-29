"""Exact complete-cost search; bundles are atomic options and checkout stays available."""

from ..catalog import Line
from ..fx import convert
from ..landed import calculate
from .rally_agent import shipping


def domestic_for(shop_id, lines, catalog, *, free):
    own = tuple(line for line in lines if catalog.offers[line.offer_id]["shop_id"] == shop_id)
    return 0 if free or not own else shipping(own, catalog)


def best_allocation(bids, start, destination, catalog, rules):
    from .bids import utility
    from .schema import BidItem

    bids = list(bids.values()) if isinstance(bids, dict) else list(bids)
    arrival = {id(bid): index for index, bid in enumerate(bids)}
    pids = [catalog.offers[line.offer_id]["product_id"] for line in start["lines"]]
    options = {pid: [] for pid in pids}
    for line in start["lines"]:
        options[catalog.offers[line.offer_id]["product_id"]].append(((line,), None))
    for bid in bids:
        bundled = set(bid.bundle.offer_ids) if bid.bundle else set()
        if bundled:
            lines = tuple(Line(i.offer_id, 1, i.unit_usd_cents) for i in bid.items if i.offer_id in bundled)
            for line in lines:
                options[catalog.offers[line.offer_id]["product_id"]].append((lines, bid))
        for item in bid.items:
            if item.offer_id not in bundled:
                options[catalog.offers[item.offer_id]["product_id"]].append(((Line(item.offer_id, 1, item.unit_usd_cents),), bid))
    cheapest = {pid: min((line for lines, _ in choices for line in lines if catalog.offers[line.offer_id]["product_id"] == pid), key=lambda line: line.unit_usd_cents) for pid, choices in options.items()}
    lower_bounds = {}
    currency, rate = start["breakdown"]["currency"], start.get("rate")
    best, best_key = None, None

    def search(chosen, used, origins):
        nonlocal best, best_key
        if best_key is not None:
            optimistic = chosen + tuple(cheapest[pid] for pid in pids if pid not in used)
            amounts = (sum(line.unit_usd_cents for line in optimistic), sum(convert(line.unit_usd_cents, currency, rate) for line in optimistic))
            if amounts not in lower_bounds:
                # Splitting bundles, omitting gifts and zero shipping can only lower cost.
                shops = {catalog.offers[line.offer_id]["shop_id"] for line in optimistic}
                try:
                    lower_bounds[amounts] = calculate(optimistic, destination, catalog, shipping={shop: 0 for shop in shops}, rate=rate)["total"]
                except ValueError:
                    lower_bounds[amounts] = start["breakdown"]["total"] + 1
            if lower_bounds[amounts] > best_key[0]:
                return
        if len(used) != len(pids):
            pid = next(pid for pid in pids if pid not in used)
            for lines, bid in options[pid]:
                covered = {catalog.offers[line.offer_id]["product_id"] for line in lines}
                if not covered & used and covered <= options.keys():
                    search(chosen + lines, used | covered, origins + ((bid,) * len(lines)))
            return
        shops = {catalog.offers[line.offer_id]["shop_id"] for line in chosen}
        # Perks belong to the standing bid of the winning shop, including its unchanged items.
        winning = {bid.shop_id: bid for bid in origins if bid is not None}
        extras = tuple(sorted({e for bid in winning.values() for e in bid.extras}))
        for shop, bid in winning.items():
            if bid.free_domestic:
                actual = bid.model_copy(update={"items": [BidItem(offer_id=line.offer_id, unit_usd_cents=line.unit_usd_cents) for line in chosen if catalog.offers[line.offer_id]["shop_id"] == shop], "bundle": None})
                score = utility(actual, catalog, won_offer_ids={item.offer_id for item in actual.items})
                if score is None or score < catalog.policies[shop]["utility_threshold"]:
                    return
        domestic = {s: domestic_for(s, chosen, catalog, free=s in winning and winning[s].free_domestic) for s in shops}
        try:
            breakdown = calculate(chosen, destination, catalog, extras=extras, shipping=domestic, rate=start.get("rate"))
        except ValueError:
            return
        key = (breakdown["total"], len(shops), -len(extras), tuple(sorted((bid.round, arrival[id(bid)]) if bid else (0, -1) for bid in origins)), tuple(line.offer_id for line in chosen))
        if best_key is None or key < best_key:
            best_key = key
            best = {"bundled": {catalog.offers[line.offer_id]["product_id"] for line, bid in zip(chosen, origins, strict=True) if bid and bid.bundle and line.offer_id in bid.bundle.offer_ids}, "lines": chosen, "extras": extras, "domestic_usd": domestic, "breakdown": breakdown,
                    "leaders": {catalog.offers[line.offer_id]["product_id"]: catalog.offers[line.offer_id]["shop_id"] for line in chosen}}
    search((), set(), ())
    if best is None:
        raise ValueError("No complete allocation remains available.")
    assert best["breakdown"]["total"] <= start["breakdown"]["total"]
    return best
