"""Complete bounded scenario schedules, not live customs or foreign exchange."""

from .fx import AS_OF

COUNTRIES = {
    "US": {"name": "United States", "region": "California", "currency": "USD", "duty_bp": 1250, "tax_bp": 925, "tax_shipping": False, "shipping": [1400, 1700, 2100, 2500], "summary": "12.5% duty · sales tax (est.)", "source": "https://hts.usitc.gov/"},
    "CA": {"name": "Canada", "region": "Ontario", "currency": "CAD", "duty_bp": 0, "tax_bp": 1300, "tax_shipping": True, "shipping": [1500, 1800, 2200, 2600], "summary": "No duty · 13% HST (est.)", "source": "https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/menu-eng.html"},
    "GB": {"name": "United Kingdom", "region": None, "currency": "GBP", "duty_bp": 0, "tax_bp": 2000, "tax_shipping": True, "shipping": [1500, 1800, 2300, 2700], "summary": "No duty · 20% VAT (est.)", "source": "https://www.gov.uk/goods-sent-from-abroad/tax-and-duty"},
    "DE": {"name": "Germany", "region": None, "currency": "EUR", "duty_bp": 0, "tax_bp": 1900, "tax_shipping": True, "shipping": [1600, 1900, 2400, 2800], "summary": "€3 import duty · 19% VAT (est.)", "source": "https://taxation-customs.ec.europa.eu/customs_en"},
    "AU": {"name": "Australia", "region": None, "currency": "AUD", "duty_bp": 0, "tax_bp": 1000, "tax_shipping": True, "shipping": [1400, 1700, 2200, 2600], "summary": "No duty · 10% GST (est.)", "source": "https://www.ato.gov.au/businesses-and-organisations/international-tax-for-business/gst-on-low-value-imported-goods"},
}


def country(code):
    if code not in COUNTRIES:
        raise ValueError("Choose a supported destination.")
    return COUNTRIES[code]


def public_countries():
    return [{"code": code, **{k: row[k] for k in ("name", "region", "currency", "summary")}, "as_of": AS_OF, "cost_certainty": "complete simulated schedule; Rally absorbs overruns", "source_url": row["source"], "rates_verified": False} for code, row in COUNTRIES.items()]
