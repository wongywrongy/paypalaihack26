"""Dated illustrative FX snapshots; all arithmetic rounds half up in minor units."""

RATES = {"USD": 100, "CAD": 138, "GBP": 75, "EUR": 86, "AUD": 152}
AS_OF = "2026-10-22"


def minor(value):
    from decimal import Decimal

    amount = Decimal(str(value)) * 100
    if not amount.is_finite() or amount != amount.to_integral_value() or amount < 0:
        raise ValueError("Money requires non-negative whole minor units.")
    return int(amount)


def convert(cents, currency, rate=None):
    if type(cents) is not int or not 0 <= cents <= 100_000_000:
        raise ValueError("Invalid money amount.")
    if currency not in RATES:
        raise ValueError("Unsupported currency.")
    rate = RATES[currency] if rate is None else rate
    if type(rate) is not int or rate <= 0:
        raise ValueError("Invalid locked rate.")
    return (cents * rate + 50) // 100


def basis(cents, points):
    return (cents * points + 5000) // 10000
