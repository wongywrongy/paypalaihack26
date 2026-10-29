"""Exact award search over current bids. Used for round leaders and the final award.

Objective, in order (docs/plan/BIDDING.md, "Award search"):
1. lowest complete total from landed.calculate(lines, destination, catalog,
   extras=..., shipping={shop: domestic_usd_cents}) for the winning shops,
2. fewer shops, 3. perks (a sample kit wins a price tie), 4. the earlier bid.

Bundles are indivisible joint options. `free_domestic` sets that shop's domestic to 0
only when it wins at least one item; otherwise use the normal threshold value.
The listed checkout line for each item is always a valid fallback option.
"""


def best_allocation(bids, start, destination, catalog, rules):
    """Return {"lines", "extras", "domestic_usd", "breakdown", "leaders": {product_id: shop_id}}.

    bids: latest valid bid per shop (rally.negotiation.schema.Bid), already validated.
    start: the checkout dict ({"lines", "breakdown", "rate"}).
    """
    raise NotImplementedError("v3 award search")


def domestic_for(shop_id, lines, catalog, *, free):
    """Per-shop domestic shipping in USD cents: 0 if `free`, else the threshold rule
    used by rally_agent.shipping for that shop's winning lines."""
    raise NotImplementedError("v3 award search")
