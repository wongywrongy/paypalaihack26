"""Private authority builds bids; models see public terms and ordinal ranks only."""

from itertools import combinations

from ..catalog import Line
from ..fx import basis
from .rally_agent import shipping
from .schema import Bid, BidItem, Bundle
from .shop_agent import target


def eligible(product_ids, destination, catalog, rules):
    return {pid: catalog.choices(pid, destination, older=rules["old_packaging_ok"]) for pid in product_ids}


def merge(previous, bid):
    """Unchanged prices remain standing, including prices on a passed item."""
    if previous is None:
        return bid
    items = {item.offer_id: item for item in previous.items}
    items.update({item.offer_id: item for item in bid.items})
    bundle = bid.bundle or previous.bundle
    if bundle:
        bundle = Bundle(offer_ids=bundle.offer_ids, price_usd_cents=sum(items[o].unit_usd_cents for o in bundle.offer_ids))
    return bid.model_copy(update={"items": list(items.values()), "bundle": bundle,
                                  "free_domestic": previous.free_domestic or bid.free_domestic,
                                  "extras": bid.extras or previous.extras})


def assessment(bid, previous, current, start, destination, catalog, rules):
    from .award import best_allocation

    standing = merge(previous, bid)
    result = best_allocation({**current, bid.shop_id: standing}, start, destination, catalog, rules)
    won = {line.offer_id for line in result["lines"] if catalog.offers[line.offer_id]["shop_id"] == bid.shop_id}
    # Checkout fallback lines can win alongside a bid; score the actual paid units.
    actual = standing.model_copy(update={"items": [BidItem(offer_id=line.offer_id, unit_usd_cents=line.unit_usd_cents) for line in result["lines"] if line.offer_id in won], "bundle": None, "extras": [e for e in result["extras"] if e.startswith(bid.shop_id)], "free_domestic": result["domestic_usd"].get(bid.shop_id) == 0})
    score = utility(actual, catalog, won_offer_ids=won)
    wins = [catalog.offers[o]["product_id"] for o in sorted(won)]
    return result, wins, score


def candidates(shop_id, round_no, eligible_offers, previous, leaders, asks, catalog, rules, *, current, start, destination):
    options = []
    policy = catalog.policies[shop_id]
    strategy = policy.get("strategy") if policy.get("applied_at") else None
    runner_up = set()
    for pid, offers in eligible_offers.items():
        own = [o for o in offers if o["shop_id"] == shop_id]
        if not own or len({o["shop_id"] for o in offers}) == 1:
            continue
        public = {}
        for offer in offers:
            standing = current.get(offer["shop_id"])
            price = next((i.unit_usd_cents for i in standing.items if i.offer_id == offer["id"]), offer["list_usd"]) if standing else offer["list_usd"]
            public[offer["shop_id"]] = min(public.get(offer["shop_id"], price), price)
        if sorted(public, key=lambda s: (public[s], s))[1] == shop_id:
            runner_up.add(pid)
        offer = min(own, key=lambda o: ((o["variant"] != "older" if not strategy or strategy["prefer_older"] else o["variant"] != "current"), o["list_usd"], o["id"]))
        unit = max(offer["floor_usd"], target(Line(offer["id"], 1, offer["list_usd"]), catalog) - (round_no - 1) * 100)
        if strategy:
            minimum = offer["floor_usd"] + strategy["min_margin_over_floor_cents"]
            if minimum > offer["list_usd"]:
                continue
            unit = max(minimum, basis(offer["list_usd"], 10000 - strategy["max_round_discount_bp"] * round_no // 3))
        old = next((i.unit_usd_cents for i in previous.items if i.offer_id == offer["id"]), offer["list_usd"]) if previous else offer["list_usd"]
        options.append(BidItem(offer_id=offer["id"], unit_usd_cents=min(unit, old)))
    if not options:
        return []
    policy = catalog.policies[shop_id]
    variants = []
    for concession in (0, 100):
        items = []
        for item in options:
            offer = catalog.offers[item.offer_id]
            ceiling = next((i.unit_usd_cents for i in previous.items if i.offer_id == item.offer_id), offer["list_usd"]) if previous else offer["list_usd"]
            items.append(BidItem(offer_id=item.offer_id, unit_usd_cents=min(ceiling, item.unit_usd_cents + concession)))
        base = Bid(shop_id=shop_id, round=round_no, items=items, note="Our available item prices.")
        variants.append(base)
        pairs = [pair for pair in combinations(items, 2) if any(catalog.offers[i.offer_id]["product_id"] in runner_up for i in pair)]
        if rules["bundles_ok"] and pairs and (not strategy or strategy["bundles"] != "off"):
            pair = min(pairs, key=lambda pair: (sum(i.unit_usd_cents for i in pair), tuple(i.offer_id for i in pair)))
            ids = {i.offer_id for i in pair}
            discounted = [BidItem(offer_id=i.offer_id, unit_usd_cents=max(catalog.offers[i.offer_id]["floor_usd"] + (strategy["min_margin_over_floor_cents"] if strategy else 0), basis(i.unit_usd_cents, 10000 - policy["bundle_discount_bp"]))) if i.offer_id in ids else i for i in items]
            bundle = Bundle(offer_ids=[i.offer_id for i in pair], price_usd_cents=sum(i.unit_usd_cents for i in discounted if i.offer_id in ids))
            variants.append(base.model_copy(update={"items": discounted, "bundle": bundle, "note": "Our two-item bundle price."}))
    scored, seen = [], set()
    for base in variants:
        free_options = (True,) if strategy and strategy["free_domestic"] == "always" else (False, True) if policy["free_domestic"] and (not strategy or strategy["free_domestic"] != "never") else (False,)
        for free in free_options:
            for kit in ((False, True) if (strategy["kit"] if strategy else policy["sample_kit"]) and shop_id == "dalbit" else (False,)):
                bid = base.model_copy(update={"free_domestic": free, "extras": ["dalbit-sample-kit"] if kit else []})
                key = bid.model_dump_json(by_alias=True)
                if key in seen:
                    continue
                seen.add(key)
                try:
                    validate(bid, previous, eligible_offers, catalog, rules)
                    allocation, wins, score = assessment(bid, previous, current, start, destination, catalog, rules)
                    if score is None or score < policy["utility_threshold"]:
                        continue
                    rank = (-len(wins), allocation["breakdown"]["total"], len(set(allocation["leaders"].values())), -len(allocation["extras"]), -(bool(bid.bundle) if strategy and strategy["bundles"] == "prefer" else 0), -score)
                    scored.append((rank, bid))
                except ValueError:
                    continue
    return [bid for _, bid in sorted(scored, key=lambda row: row[0])[:3]]


def validate(bid, previous, eligible_offers, catalog, rules):
    bid = Bid.model_validate(bid.model_dump(by_alias=True) if isinstance(bid, Bid) else bid)
    if bid.shop_id not in catalog.shops:
        raise ValueError("Unknown shop.")
    allowed = {o["id"] for offers in eligible_offers.values() for o in offers}
    old = {i.offer_id: i.unit_usd_cents for i in previous.items} if previous else {}
    seen, ids = set(), set()
    for item in bid.items:
        o = catalog.offers.get(item.offer_id)
        if not o or item.offer_id not in allowed or o["shop_id"] != bid.shop_id or o["stock"] < 1:
            raise ValueError("Offer exceeds stock or shop authority.")
        pid = o["product_id"]
        if pid in seen or o["variant"] == "older" and not rules["old_packaging_ok"]:
            raise ValueError("Duplicate item or unpermitted packaging.")
        if not o["floor_usd"] <= item.unit_usd_cents <= min(o["list_usd"], old.get(item.offer_id, o["list_usd"])):
            raise ValueError("Price exceeds shop authority or previous bid.")
        if len({offer["shop_id"] for offer in eligible_offers[pid]}) == 1 and item.unit_usd_cents != o["list_usd"]:
            raise ValueError("Single-shop items keep listed prices.")
        seen.add(pid)
        ids.add(item.offer_id)
    if bid.bundle:
        bundle_ids = bid.bundle.offer_ids
        prices = {i.offer_id: i.unit_usd_cents for i in bid.items}
        if not rules["bundles_ok"] or len(set(bundle_ids)) != 2 or not set(bundle_ids) <= ids or sum(prices[o] for o in bundle_ids) != bid.bundle.price_usd_cents:
            raise ValueError("Invalid indivisible bundle.")
    if len(set(bid.pass_offers)) != len(bid.pass_offers) or any(o not in allowed or catalog.offers[o]["shop_id"] != bid.shop_id or o in ids for o in bid.pass_offers):
        raise ValueError("Invalid pass.")
    if bid.extras and (bid.extras != ["dalbit-sample-kit"] or bid.shop_id != "dalbit" or not catalog.policies[bid.shop_id]["sample_kit"]):
        raise ValueError("Unknown shop gift.")
    if bid.free_domestic and (not bid.items or not catalog.policies[bid.shop_id]["free_domestic"]):
        raise ValueError("Shipping requires a bid from this shop.")
    return bid


def utility(bid, catalog, *, won_offer_ids):
    if not won_offer_ids:
        return 0
    items = {i.offer_id: i for i in bid.items}
    if not won_offer_ids <= items.keys():
        return None
    if bid.bundle and set(bid.bundle.offer_ids) & won_offer_ids and not set(bid.bundle.offer_ids) <= won_offer_ids:
        return None
    lines = tuple(Line(o, 1, items[o].unit_usd_cents) for o in won_offer_ids)
    if any(line.unit_usd_cents < catalog.offers[line.offer_id]["floor_usd"] for line in lines):
        return None
    policy = catalog.policies[bid.shop_id]
    aged = sum(min(300, catalog.offers[o]["days_on_shelf"]) for o in won_offer_ids if catalog.offers[o]["variant"] == "older")
    return sum(line.unit_usd_cents - catalog.offers[line.offer_id]["floor_usd"] for line in lines) + (0 if bid.free_domestic else shipping(lines, catalog)) - policy["pickup_cost"] - len(bid.extras) * policy["sample_cost"] + aged
