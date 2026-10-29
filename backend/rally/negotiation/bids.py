"""Shop side of v3 bidding: candidates from private authority, validation, utility.

Models never see floors or costs. They see candidate bids with a utility rank, whether
each would lead at the current public prices, the shop's public goals and the buyer's asks.
"""


def eligible(product_ids, destination, catalog, rules):
    """{product_id: [offer dict]} for every shop that stocks the item and may ship it,
    including the older variant only when rules["old_packaging_ok"]."""
    raise NotImplementedError("v3 bids")


def candidates(shop_id, round_no, eligible_offers, previous, leaders, asks, catalog, rules):
    """Up to three executable rally.negotiation.schema.Bid candidates for one shop,
    best utility first, each tagged with `wins` (would lead at current public leaders).

    Sources: discount_bp target prices, floors, aged older stock, the sample kit (Dalbit),
    free domestic shipping, and one two-item bundle when rules["bundles_ok"].
    A pass is allowed per item. Never above the shop's previous bid for the same offer.
    """
    raise NotImplementedError("v3 bids")


def validate(bid, previous, eligible_offers, catalog, rules):
    """Raise ValueError unless: offers exist, belong to the shop and are in stock;
    floor <= unit <= list; unit <= the shop's previous bid for that offer; older variant
    only if permitted; bundle only if rules["bundles_ok"], two offers from this shop whose
    units sum exactly to the bundle price; extras only the shop's own sample kit."""
    raise NotImplementedError("v3 bids")


def utility(bid, catalog, *, won_offer_ids):
    """Existing shop_agent.utility extended for bundles and free domestic shipping,
    over the offers this shop actually wins. None if any won unit is below floor."""
    raise NotImplementedError("v3 bids")


PUBLIC_GOALS = {
    # Public, model-visible shop goals. Private numbers stay in catalog authority.
    "haneul": "Win two-item orders; bundles and free shipping in Korea are fine.",
    "bada": "Keep prices simple and firm; compete on the lowest unit price.",
    "dalbit": "Move older packaging and add a sample kit before cutting new stock.",
}
