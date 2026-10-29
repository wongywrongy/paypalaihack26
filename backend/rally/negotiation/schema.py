from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt


class Line(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    offer_id: str
    qty: StrictInt = Field(ge=1, le=1)
    unit_usd_cents: StrictInt = Field(gt=0, le=100_000_000)


class Extra(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    extra_id: str
    qty: StrictInt = Field(ge=1, le=1)
    unit_usd_cents: StrictInt = Field(ge=0, le=0)


class Offer(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    shop_id: str
    reply: StrictInt = Field(ge=1, le=3)
    actor: str = Field(pattern="^(rally|shop)$")
    lines: list[Line] = Field(min_length=1, max_length=9)
    extras: list[Extra] = Field(max_length=1)
    domestic_shipping_usd_cents: StrictInt = Field(ge=0, le=10000)
    expires_at: datetime
    note: str = Field(max_length=240)


class Choice(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    index: StrictInt = Field(ge=0, le=2)
    note: str = Field(min_length=1, max_length=240)


# --- v3 shop bidding (docs/plan/BIDDING.md). Code builds and validates these;
# models only choose a candidate index and write the note.


class BidItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    offer_id: str
    unit_usd_cents: StrictInt = Field(gt=0, le=100_000_000)


class Bundle(BaseModel):
    """One indivisible option: valid only if the shop wins every listed offer."""

    model_config = ConfigDict(extra="forbid", strict=True)
    offer_ids: list[str] = Field(min_length=2, max_length=2)
    price_usd_cents: StrictInt = Field(gt=0, le=100_000_000)


class Bid(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    shop_id: str
    round: StrictInt = Field(ge=1, le=3)
    items: list[BidItem] = Field(max_length=9)
    bundle: Bundle | None = None
    free_domestic: bool = False
    extras: list[str] = Field(default_factory=list, max_length=1)
    pass_offers: list[str] = Field(default_factory=list, max_length=9, alias="pass")
    note: str = Field(min_length=1, max_length=240)


class Ask(BaseModel):
    """A public buyer request; carries no money authority."""

    model_config = ConfigDict(extra="forbid", strict=True)
    round: StrictInt = Field(ge=1, le=3)
    shop_id: str | None = None
    product_ids: list[str] = Field(min_length=1, max_length=9)
    kind: str = Field(pattern="^(bid|beat|bundle)$")
    note: str = Field(min_length=1, max_length=240)


class AskChoice(BaseModel):
    """Buyer model output: up to three candidate ask indexes plus the round note."""

    model_config = ConfigDict(extra="forbid", strict=True)
    indexes: list[StrictInt] = Field(max_length=3)
    note: str = Field(min_length=1, max_length=240)
