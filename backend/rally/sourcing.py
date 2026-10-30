"""Exact all-in search: at most three shops for each of eight products."""

from itertools import product

from .catalog import Line
from .landed import calculate


def source(items, destination, catalog):
    if not isinstance(items, (list, tuple)) or not 1 <= len(items) <= 8 or any(not isinstance(x, str) for x in items) or len(set(items)) != len(items):
        raise ValueError("Choose one to eight different products.")
    choices = [catalog.choices(pid, destination) for pid in items]
    if any(not options for options in choices):
        raise ValueError("An item is out of stock.")
    best = None
    for offers in product(*choices):
        lines = tuple(Line(o["id"], 1, o["list_usd"]) for o in offers)
        try:
            breakdown = calculate(lines, destination, catalog)
        except ValueError:
            continue
        key = (breakdown["total"], sum(line.unit_usd_cents for line in lines), tuple(line.offer_id for line in lines))
        if best is None or key < best[0]:
            best = (key, {"lines": lines, "breakdown": breakdown})
    if best is None:
        raise ValueError("No complete shipment fits this destination.")
    return best[1]
