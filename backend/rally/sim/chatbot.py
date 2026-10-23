"""Offline baseline only: model decisions here have no payment capability."""

from pydantic import BaseModel, ConfigDict, Field

from .. import llm
from ..catalog import Line
from ..landed import calculate
from ..negotiation.shop_agent import utility


class Prices(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    prices: dict[str, int]
    note: str = Field(max_length=240)


class Reply(Prices):
    accepted: bool


def run(start, destination, catalog):
    public = [{"offer_id": line.offer_id, "price_usd_cents": line.unit_usd_cents} for line in start["lines"]]
    bid, _ = llm.complete(Prices, "Offline benchmark buyer. Propose one positive integer USD-minor-unit price per supplied offer_id. No swaps or extras.", {"items": public}, timeout=8, max_tokens=500, remaining_tokens=20000)
    if set(bid.prices) != {line.offer_id for line in start["lines"]} or any(type(v) is not int or v <= 0 for v in bid.prices.values()):
        raise ValueError("Baseline returned unsupported terms.")
    scores = {}
    for shop in {catalog.offers[line.offer_id]["shop_id"] for line in start["lines"]}:
        lines = tuple(Line(line.offer_id, 1, bid.prices[line.offer_id]) for line in start["lines"] if catalog.offers[line.offer_id]["shop_id"] == shop)
        scores[shop] = utility(lines, (), catalog)
    reply, _ = llm.complete(Reply, "Offline benchmark merchant. Choose whether to accept and return one USD-minor-unit price per supplied offer_id. Prefer stronger supplied aggregate scores. This result is measured, never executed as a payment.", {"listed": public, "proposed": bid.model_dump(), "aggregate_scores": scores}, timeout=8, max_tokens=500, remaining_tokens=20000)
    if set(reply.prices) != set(bid.prices) or any(type(v) is not int or v <= 0 for v in reply.prices.values()):
        raise ValueError("Baseline returned unsupported terms.")
    lines = tuple(Line(line.offer_id, 1, reply.prices[line.offer_id]) for line in start["lines"]) if reply.accepted else start["lines"]
    return calculate(lines, destination, catalog)
