"""Executable complete cost schedules, with explicit simulation boundaries."""

from .countries import country
from .fx import RATES, basis, convert, minor

PARTS = ("goods", "domestic", "shipping", "duty", "tax", "fee")


def calculate(lines, destination, catalog, *, extras=(), shipping=None, rate=None):
    c = country(destination)
    if not lines:
        raise ValueError("Add at least one item.")
    subtotals, grams = {}, 300
    products = set()
    for line in lines:
        o = catalog.offers.get(line.offer_id)
        if not o or type(line.qty) is not int or line.qty != 1 or type(line.unit_usd_cents) is not int or not 0 < line.unit_usd_cents <= 100_000_000:
            raise ValueError("Invalid quoted item or price.")
        pid = o["product_id"]
        if pid in products or not catalog.allowed(pid, destination) or o["stock"] < line.qty:
            raise ValueError("Item is unavailable or duplicated.")
        products.add(pid)
        subtotals[o["shop_id"]] = subtotals.get(o["shop_id"], 0) + line.unit_usd_cents * line.qty
        grams += catalog.grams(pid) * line.qty
    if len(products) > 9:
        raise ValueError("Bag size exceeded.")
    if any(extra != "dalbit-sample-kit" for extra in extras) or len(extras) != len(set(extras)):
        raise ValueError("Unknown or duplicate extra.")
    grams += 50 * len(extras)
    if grams > 2000:
        raise ValueError("This bag exceeds the supported two-kilogram shipment.")
    goods = sum(subtotals.values())
    domestic = sum(minor(catalog.shops[s]["domestic"]) if amount < minor(catalog.shops[s]["free_over"]) else 0 for s, amount in subtotals.items())
    if shipping is not None:
        if set(shipping) != set(subtotals) or any(type(x) is not int or x < 0 or x > minor(catalog.shops[s]["domestic"]) for s, x in shipping.items()):
            raise ValueError("Invalid merchant-backed shipping terms.")
        domestic = sum(shipping.values())
    international = c["shipping"][next(i for i, limit in enumerate((500, 1000, 1500, 2000)) if grams <= limit)]
    duty = basis(goods, c["duty_bp"]) + ((30000 + RATES["EUR"] // 2) // RATES["EUR"] if destination == "DE" else 0)
    tax = basis(goods + (domestic + international + duty if c["tax_shipping"] else 0), c["tax_bp"])
    usd = dict(goods=goods, domestic=domestic, shipping=international, duty=duty, tax=tax, fee=300)
    currency = c["currency"]
    rate = RATES[currency] if rate is None else rate
    converted = {k: convert(v, currency, rate) for k, v in usd.items()}
    # Per-item conversion is authoritative; the goods receipt must sum exactly.
    converted["goods"] = sum(convert(line.unit_usd_cents, currency, rate) * line.qty for line in lines)
    result = {"currency": currency, **converted, "total": sum(converted.values())}
    ceilings = {"GB": 13500, "DE": 15000, "AU": 100000}
    if destination in ceilings and result["goods"] > ceilings[destination]:
        raise ValueError("This bag exceeds the supported import schedule.")
    return result
