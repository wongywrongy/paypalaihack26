"""Buyer requests are public language; they carry no money authority."""

from ..fx import convert, money
from .schema import Ask


def candidate_asks(round_no, leaders, bids, eligible_offers, rules, market=None, *, currency="USD", rate=None):
    shops = {}
    for pid, offers in eligible_offers.items():
        if len({o["shop_id"] for o in offers}) < 2:
            continue
        for offer in offers:
            shops.setdefault(offer["shop_id"], set()).add(pid)
    if round_no == 1:
        return [Ask(round=round_no, shop_id=s, product_ids=sorted(pids), kind="bid", note="Bid on these items.") for s, pids in sorted(shops.items())]
    result = []
    rows = list(bids.values()) if isinstance(bids, dict) else bids
    for pid, offers in eligible_offers.items():
        if pid not in leaders or len({o["shop_id"] for o in offers}) < 2:
            continue
        prices = {}
        for offer in offers:
            unit = min((i.unit_usd_cents for bid in rows for i in bid.items if i.offer_id == offer["id"]), default=offer["list_usd"])
            shop = offer["shop_id"]
            prices[shop] = min(prices.get(shop, unit), unit)
        leader = leaders[pid]
        other = sorted((price, s) for s, price in prices.items() if s != leader["shop"])
        if other:
            price, shop = other[0]
            gap = max(0, price - leader["unit"])
            reference = market(pid) if market else None
            note = f"Can you beat the leader? The gap is {money(convert(gap, currency, rate), currency)}."
            if reference:
                note += f" US market ${reference['low_usd_cents'] / 100:g}–{reference['high_usd_cents'] / 100:g}."
            result.append(Ask(round=round_no, shop_id=shop, product_ids=[pid], kind="beat", note=note))
    if rules["bundles_ok"]:
        result += [Ask(round=round_no, shop_id=s, product_ids=sorted(pids), kind="bundle", note="Can a two-item bundle lower the delivered total?") for s, pids in sorted(shops.items()) if len(pids) >= 2]
    return result


def round_note(round_no, total_minor, currency):
    return f"Round {round_no} best: {money(total_minor, currency)} all in. Anyone lower?"
