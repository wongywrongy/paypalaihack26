from itertools import product

from ..catalog import Line
from ..fx import minor


def candidates(start, catalog, rules, reply, destination, *, firm=False):
    """Public catalog prices only: this module never reads merchant authority."""
    choices = []
    ratio = 100 if firm else (80, 85, 100)[reply - 1]
    for line in start:
        original = catalog.offers[line.offer_id]
        options = [original]
        older = catalog.offers.get(line.offer_id + ":older")
        if rules["old_packaging_ok"] and older and older["stock"]:
            options.append(older)
        choices.append([Line(o["id"], 1, max(100, ((o["list_usd"] * ratio // 100 + 50) // 100) * 100)) for o in options])
    result = [(tuple(lines), ()) for lines in product(*choices)]
    shop = catalog.offers[start[0].offer_id]["shop_id"]
    if shop == "dalbit":
        result += [(lines, ("dalbit-sample-kit",)) for lines, _ in list(result)]
    if rules["add_small_extras_if_cheaper"]:
        existing = {catalog.offers[line.offer_id]["product_id"] for line in start}
        extras = [o for o in catalog.offers.values() if o["shop_id"] == shop and o["product_id"] not in existing and o["variant"] == "current" and o["stock"] and o["list_usd"] <= 500 and catalog.allowed(o["product_id"], destination)]
        for o in sorted(extras, key=lambda o: (o["list_usd"], o["id"]))[:1]:
            result += [(lines + (Line(o["id"], 1, o["list_usd"]),), kits) for lines, kits in list(result)]
    return result


def shipping(lines, catalog):
    shop = catalog.offers[lines[0].offer_id]["shop_id"]
    row = catalog.shops[shop]
    return 0 if sum(line.unit_usd_cents * line.qty for line in lines) >= minor(row["free_over"]) else minor(row["domestic"])
