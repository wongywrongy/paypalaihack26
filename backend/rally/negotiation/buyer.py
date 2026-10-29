"""Buyer (Rally) side of v3 bidding: code builds candidate asks; the model picks
up to three and writes the round note. Asks are public text plus item ids only."""


def candidate_asks(round_no, leaders, bids, eligible_offers, rules, market=None):
    """Ask candidates for this round (rally.negotiation.schema.Ask):
    - round 1: one "bid" ask per shop for the items it can sell;
    - later: "beat" asks to the runner-up shop per item, with the gap to the leader;
    - "bundle" asks to shops with two or more eligible items, only if rules["bundles_ok"];
    - include the market reference (rally.market.reference) in the payload when present.
    """
    raise NotImplementedError("v3 buyer")


def round_note(round_no, total_minor, currency):
    """Code fallback note when the buyer model is unavailable, e.g.
    "Round 1 best: $110.29 all in. Anyone lower?"."""
    raise NotImplementedError("v3 buyer")
