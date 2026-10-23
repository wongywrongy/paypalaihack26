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
