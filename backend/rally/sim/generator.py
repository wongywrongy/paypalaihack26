import random

from ..catalog import Catalog
from ..countries import COUNTRIES


def cases(seed, count):
    rng = random.Random(seed)
    for number in range(count):
        catalog = Catalog()
        destination = rng.choice(tuple(COUNTRIES))
        available = [pid for pid in catalog.products if catalog.allowed(pid, destination)]
        items = rng.sample(available, rng.randint(3, 8))
        for policy in catalog.policies.values():
            policy["discount_bp"] = rng.choice((0, 500, 1000, 1500))
        for offer in catalog.offers.values():
            offer["days_on_shelf"] = rng.randint(0, 180)
            offer["floor_usd"] = rng.randint(offer["cost_usd"], max(offer["cost_usd"], offer["list_usd"] - 200))
            if offer["variant"] == "older":
                offer["stock"] = rng.choice((0, 20, 40))
        for shop in catalog.shops.values():
            shop["free_over"] = str(rng.choice((25, 33, 40, 50)))
        for policy in catalog.policies.values():
            policy["sample_cost"] = rng.choice((100, 150, 250))
        yield number, catalog, destination, items
