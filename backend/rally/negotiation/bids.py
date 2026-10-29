"""Private authority builds bids; models see public terms and ordinal ranks only."""

from itertools import combinations

from ..catalog import Line
from .rally_agent import shipping
from .schema import Bid, BidItem, Bundle
from .shop_agent import target

PUBLIC_GOALS = {
    "haneul": "Win two-item orders; bundles and free shipping in Korea are fine.",
    "bada": "Keep prices simple and firm; compete on the lowest unit price.",
    "dalbit": "Move older packaging and add a sample kit before cutting new stock.",
}


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


def candidates(shop_id, round_no, eligible_offers, previous, leaders, asks, catalog, rules):
    options = []
    for offers in eligible_offers.values():
        own = [o for o in offers if o["shop_id"] == shop_id]
        if not own or len({o["shop_id"] for o in offers}) == 1:
            continue
        offer = min(own, key=lambda o: (o["variant"] != "older", o["list_usd"], o["id"]))
        unit = max(offer["floor_usd"], target(Line(offer["id"], 1, offer["list_usd"]), catalog) - (round_no - 1) * 100)
        old = next((i.unit_usd_cents for i in previous.items if i.offer_id == offer["id"]), offer["list_usd"]) if previous else offer["list_usd"]
        options.append(BidItem(offer_id=offer["id"], unit_usd_cents=min(unit, old)))
    if not options:
        return []
    extras = ["dalbit-sample-kit"] if catalog.policies[shop_id]["sample_kit"] and round_no > 1 else []
    base = Bid(shop_id=shop_id, round=round_no, items=options, extras=extras, note="Our available item prices.")
    result = [base]
    if rules["bundles_ok"] and len(options) >= 2:
        # At most one two-item bundle per candidate; no exponential subset search.
        pair = min(combinations(options, 2), key=lambda pair: sum(i.unit_usd_cents for i in pair))
        bundle = Bundle(offer_ids=[i.offer_id for i in pair], price_usd_cents=sum(i.unit_usd_cents for i in pair))
        result.append(base.model_copy(update={"bundle": bundle, "free_domestic": round_no == 3 and shop_id == "haneul"}))
    result.append(base.model_copy(update={"items": [BidItem(offer_id=i.offer_id, unit_usd_cents=min(catalog.offers[i.offer_id]["list_usd"], i.unit_usd_cents + 100)) for i in options]}))
    valid = []
    for bid in result:
        try:
            validate(bid, previous, eligible_offers, catalog, rules)
            valid.append(bid)
        except ValueError:
            continue
    # Prefer commercial utility among candidates that actually compete publicly.
    def rank(bid):
        wins = sum(i.unit_usd_cents <= leaders.get(catalog.offers[i.offer_id]["product_id"], {}).get("unit", catalog.offers[i.offer_id]["list_usd"]) for i in bid.items)
        return (-wins, -(utility(bid, catalog, won_offer_ids={i.offer_id for i in bid.items}) or 0))
    return sorted(valid, key=rank)[:3]


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
    if bid.free_domestic and not bid.items:
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
