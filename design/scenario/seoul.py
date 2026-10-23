"""Rally reference scenario: one shopper, three Korean shops, five destination countries.

Source of every number in design/mockup and PLAN.md. Run: python3 design/scenario/seoul.py
Writes design/scenario/scenario.json next to this file.

All shops, brands and products are fictional. FX rates, shipping rate cards, the carrier fee and the
US sales tax rate are illustrative. Duty and import-tax rules per country are estimates that the app
must verify against official sources (see PLAN.md, "Costs and countries").
Money uses Decimal here; the app uses integer minor units.
"""
from decimal import Decimal as D, ROUND_HALF_UP
import json
import os

q = lambda x: D(x).quantize(D("0.01"), ROUND_HALF_UP)

# ---------------------------------------------------------------- shops
SHOPS = {
    "haneul": dict(name="Haneul Beauty", city="Seoul", kind="Multi-brand shop", ships_abroad=True,
                   abroad_flat=D(18), domestic=D("3.00"), free_over=D(40)),
    "bada": dict(name="Bada Market", city="Busan", kind="Drugstore", ships_abroad=False,
                 abroad_flat=None, domestic=D("3.50"), free_over=D(33)),
    "dalbit": dict(name="Dalbit Official", city="Seoul", kind="Brand store", ships_abroad=True,
                   abroad_flat=D(16), domestic=D("2.50"), free_over=D(30)),
}

# ---------------------------------------------------------------- catalog
# id, brand, name, size, category, weight_kg, {shop: list price USD}, flags
CATALOG = [
    ("mul-gel-cleanser", "Mulgyeol", "Low-pH Gel Cleanser", "150 ml", "Cleanser", "0.20", {"haneul": 14, "bada": 12}, {}),
    ("mul-oil-cleanser", "Mulgyeol", "Green Tea Cleansing Oil", "200 ml", "Cleanser", "0.26", {"haneul": 19, "bada": 17}, {}),
    ("hay-foam", "Hayan", "Rice Foam Cleanser", "120 ml", "Cleanser", "0.16", {"haneul": 11, "bada": 10}, {}),
    ("dal-rice-toner", "Dalbit", "Rice Toner", "150 ml", "Toner", "0.25", {"haneul": 24, "bada": 22, "dalbit": 21}, {}),
    ("mul-hydro-toner", "Mulgyeol", "Hyaluronic Water Toner", "200 ml", "Toner", "0.28", {"haneul": 18, "bada": 16}, {}),
    ("byeol-pad", "Byeolbit", "Exfoliating Toner Pads", "70 pads", "Toner", "0.22", {"haneul": 21, "bada": 19}, {}),
    ("dal-snail-essence", "Dalbit", "Snail Essence", "100 ml", "Essence", "0.20", {"haneul": 25, "dalbit": 23}, {"old_packaging": "dalbit"}),
    ("gur-ferment-essence", "Gureum", "Ferment Essence", "150 ml", "Essence", "0.27", {"haneul": 32, "bada": 29}, {}),
    ("byeol-vitc", "Byeolbit", "Vitamin C Serum", "30 ml", "Serum", "0.10", {"haneul": 26, "bada": 24}, {}),
    ("byeol-niacin", "Byeolbit", "Niacinamide Serum", "30 ml", "Serum", "0.10", {"haneul": 22}, {}),
    ("sae-propolis", "Saebom", "Propolis Ampoule", "30 ml", "Serum", "0.11", {"haneul": 27, "bada": 25}, {}),
    ("dal-ginseng", "Dalbit", "Ginseng Serum", "50 ml", "Serum", "0.15", {"dalbit": 34, "haneul": 37}, {}),
    ("sae-cica-cream", "Saebom", "Cica Barrier Cream", "50 ml", "Moisturizer", "0.12", {"haneul": 22, "bada": 19}, {}),
    ("gur-water-gel", "Gureum", "Water Gel Cream", "75 ml", "Moisturizer", "0.14", {"haneul": 20, "bada": 18}, {}),
    ("hay-rice-cream", "Hayan", "Rice Ceramide Cream", "60 ml", "Moisturizer", "0.13", {"haneul": 24}, {}),
    ("dal-snail-cream", "Dalbit", "Snail Repair Cream", "50 ml", "Moisturizer", "0.12", {"dalbit": 26, "haneul": 28}, {}),
    ("hay-eye", "Hayan", "Retinal Eye Cream", "20 ml", "Eye", "0.06", {"haneul": 23, "bada": 21}, {}),
    ("dal-cica-mask", "Dalbit", "Cica Sheet Mask", "1 sheet", "Mask", "0.03", {"haneul": "2.50", "bada": 2, "dalbit": 2}, {}),
    ("dal-mask-box", "Dalbit", "Cica Sheet Masks", "Box of 10", "Mask", "0.30", {"haneul": 18, "bada": 16, "dalbit": 16}, {}),
    ("gur-sleep", "Gureum", "Overnight Sleeping Mask", "80 ml", "Mask", "0.15", {"haneul": 21, "bada": 19}, {}),
    ("byeol-clay", "Byeolbit", "Volcanic Clay Mask", "100 ml", "Mask", "0.18", {"bada": 15}, {}),
    ("sae-lip", "Saebom", "Honey Lip Sleeping Mask", "20 g", "Lip", "0.04", {"haneul": 15, "bada": 13}, {}),
    ("hay-tint", "Hayan", "Water Lip Tint", "4 g", "Lip", "0.03", {"haneul": 12, "bada": 11}, {}),
    ("mul-sun-essence", "Mulgyeol", "Watery Sun Essence SPF 50+", "50 ml", "Sun", "0.09", {"haneul": 19, "bada": 17}, {"not_to": ["US"]}),
    ("gur-sun-stick", "Gureum", "Sun Stick SPF 50+", "19 g", "Sun", "0.05", {"haneul": 18}, {"not_to": ["US"]}),
    ("sae-mist-spray", "Saebom", "Toner Mist, aerosol", "120 ml", "Mist", "0.18", {"bada": 14}, {"aerosol": True}),
    ("sae-mist-pump", "Saebom", "Toner Mist, pump", "120 ml", "Mist", "0.17", {"haneul": 16, "bada": 15}, {}),
    ("dal-travel-kit", "Dalbit", "Snail Travel Kit", "4 minis", "Set", "0.20", {"dalbit": 19, "haneul": 22}, {}),
    ("mul-starter", "Mulgyeol", "Hydration Starter Set", "3 items", "Set", "0.40", {"haneul": 39, "bada": 36}, {}),
    ("byeol-spot", "Byeolbit", "Spot Patches", "36 patches", "Care", "0.02", {"haneul": 7, "bada": 6}, {}),
]
BRANDS = sorted({row[1] for row in CATALOG})

# private shop data for the hero cart only (floor = lowest acceptable price, cost = unit cost)
PRIVATE = {
    ("dalbit", "dal-rice-toner"): dict(floor=D(16), cost=D(7)),
    ("dalbit", "dal-snail-essence"): dict(floor=D(18), cost=D(8)),
    ("dalbit", "dal-snail-essence:old"): dict(floor=D(12), cost=D(8), stock=40, days_on_shelf=150),
    ("bada", "mul-gel-cleanser"): dict(floor=D(10), cost=D(6)),
    ("bada", "sae-cica-cream"): dict(floor=D(16), cost=D(9)),
    ("bada", "dal-cica-mask"): dict(floor=D("1.20"), cost=D("0.60")),
}
SAMPLE_KIT_COST = D("1.50")
BADA_PICKUP_COST = D("1.50")  # bulk pickup rate for orders going to the Rally hub

# ---------------------------------------------------------------- countries
FX = {"USD": D(1), "CAD": D("1.38"), "GBP": D("0.75"), "EUR": D("0.86"), "AUD": D("1.52")}  # illustrative
COUNTRIES = {
    "US": dict(name="United States", region="California", currency="USD", duty_rate=D("0.125"), duty_flat_eur=None,
               tax_rate=D("0.0925"), tax_on_shipping=False, tax_name="Sales tax (est.)",
               duty_note="12.5% on Korean cosmetics (Section 301, since Jul 24, 2026); no low-value exemption",
               rate_card=[(D("0.5"), 14), (D(1), 17), (D("1.5"), 21), (D(2), 25)]),
    "CA": dict(name="Canada", region="Ontario", currency="CAD", duty_rate=D(0), duty_flat_eur=None,
               tax_rate=D("0.13"), tax_on_shipping=True, tax_name="HST",
               duty_note="No duty under the Korea-Canada FTA (verify)",
               rate_card=[(D("0.5"), 15), (D(1), 18), (D("1.5"), 22), (D(2), 26)]),
    "GB": dict(name="United Kingdom", region=None, currency="GBP", duty_rate=D(0), duty_flat_eur=None,
               tax_rate=D("0.20"), tax_on_shipping=True, tax_name="VAT",
               duty_note="No duty under the UK-Korea FTA; VAT collected at checkout up to GBP 135 (verify)",
               rate_card=[(D("0.5"), 15), (D(1), 18), (D("1.5"), 23), (D(2), 27)]),
    "DE": dict(name="Germany", region=None, currency="EUR", duty_rate=D(0), duty_flat_eur=D(3),
               tax_rate=D("0.19"), tax_on_shipping=True, tax_name="VAT",
               duty_note="EUR 3 per customs line on parcels up to EUR 150 since Jul 1, 2026; VAT via IOSS (verify)",
               rate_card=[(D("0.5"), 16), (D(1), 19), (D("1.5"), 24), (D(2), 28)]),
    "AU": dict(name="Australia", region=None, currency="AUD", duty_rate=D(0), duty_flat_eur=None,
               tax_rate=D("0.10"), tax_on_shipping=True, tax_name="GST",
               duty_note="No duty under the Korea-Australia FTA; GST collected at checkout up to AUD 1,000 (verify)",
               rate_card=[(D("0.5"), 14), (D(1), 17), (D("1.5"), 22), (D(2), 26)]),
}
RALLY_FEE_USD = D(3)
PACKAGING_KG = D("0.30")
SAMPLE_KIT_KG = D("0.05")
CARRIER_FEE_DIRECT = D(10)  # illustrative per-parcel clearance fee when buying direct (US)


def ship_usd(country, kg):
    for limit, price in COUNTRIES[country]["rate_card"]:
        if kg <= limit:
            return D(price)
    return D(30)


def price(pid, shop):
    for row in CATALOG:
        if row[0] == pid:
            return D(str(row[6][shop]))
    raise KeyError(pid)


def weight(pid):
    return D(next(row[5] for row in CATALOG if row[0] == pid))


def landed(lines, country, domestic_usd, extra_kg=D(0)):
    """All-in total for one consolidated box. lines: [(pid, shop, unit_usd)]. Returns USD breakdown."""
    c = COUNTRIES[country]
    goods = sum(u for _, _, u in lines)
    kg = sum(weight(p) for p, _, _ in lines) + PACKAGING_KG + extra_kg
    ship = ship_usd(country, kg)
    duty = q(goods * c["duty_rate"])
    if c["duty_flat_eur"] is not None:
        duty += q(c["duty_flat_eur"] / FX["EUR"])  # one customs line: every item is HS 3304
    tax_base = goods + domestic_usd + ship + duty if c["tax_on_shipping"] else goods
    tax = q(tax_base * c["tax_rate"])
    total = goods + domestic_usd + ship + duty + tax + RALLY_FEE_USD
    return dict(goods=goods, domestic=domestic_usd, shipping=ship, duty=duty, tax=tax, fee=RALLY_FEE_USD,
                total=q(total), kg=kg)


def in_currency(breakdown, country):
    fx = FX[COUNTRIES[country]["currency"]]
    out = {k: q(v * fx) for k, v in breakdown.items() if k != "kg"}
    parts = [k for k in out if k != "total"]
    out["total"] = sum(out[k] for k in parts)  # sum of rounded parts so the receipt adds up
    return out


def domestic_for(lines):
    by_shop = {}
    for _, shop, unit in lines:
        by_shop[shop] = by_shop.get(shop, D(0)) + unit
    fee = D(0)
    for shop, subtotal in by_shop.items():
        if subtotal < SHOPS[shop]["free_over"]:
            fee += SHOPS[shop]["domestic"]
    return fee, by_shop


# ---------------------------------------------------------------- hero scenario (US)
REQUEST = "Dry, sensitive skin. A simple routine: cleanser, toner, essence and a cream. Under $120 all in."
CART = ["mul-gel-cleanser", "dal-rice-toner", "dal-snail-essence", "sae-cica-cream"]

# best listed shop per item (what the solver picks before bargaining)
listed_lines = []
for pid in CART:
    row = next(r for r in CATALOG if r[0] == pid)
    shop = min(row[6], key=lambda s: (D(str(row[6][s])), s))
    listed_lines.append((pid, shop, D(str(row[6][shop]))))
listed_domestic, listed_by_shop = domestic_for(listed_lines)
listed = landed(listed_lines, "US", listed_domestic)

# negotiated: Dalbit Official gives old packaging + toner bundle price + sample kit;
# Bada Market holds prices but waives domestic shipping when one $2 mask lifts the order to $33.
deal_lines = [
    ("mul-gel-cleanser", "bada", D(12)),
    ("dal-rice-toner", "dalbit", D(19)),
    ("dal-snail-essence", "dalbit", D(16)),  # old packaging, same formula
    ("sae-cica-cream", "bada", D(19)),
    ("dal-cica-mask", "bada", D(2)),  # added: lowers the total by waiving shipping
]
deal_domestic, deal_by_shop = domestic_for(deal_lines)
deal = landed(deal_lines, "US", deal_domestic, extra_kg=SAMPLE_KIT_KG)

# the mask move, checked on its own: same deal without the mask
no_mask = [l for l in deal_lines if l[0] != "dal-cica-mask"]
nm_dom, _ = domestic_for(no_mask)
without_mask = landed(no_mask, "US", nm_dom, extra_kg=SAMPLE_KIT_KG)
mask_saves = without_mask["total"] - deal["total"]

# buying direct: Bada Market does not ship abroad, so cleanser and cream come from Haneul Beauty
direct_parcels = {
    "haneul": [("mul-gel-cleanser", price("mul-gel-cleanser", "haneul")), ("sae-cica-cream", price("sae-cica-cream", "haneul"))],
    "dalbit": [("dal-rice-toner", price("dal-rice-toner", "dalbit")), ("dal-snail-essence", price("dal-snail-essence", "dalbit"))],
}
direct = dict(goods=D(0), shipping=D(0), duty=D(0), tax=D(0), carrier_fees=D(0))
for shop, items in direct_parcels.items():
    g = sum(u for _, u in items)
    direct["goods"] += g
    direct["shipping"] += SHOPS[shop]["abroad_flat"]
    direct["duty"] += q(g * COUNTRIES["US"]["duty_rate"])
    direct["tax"] += q(g * COUNTRIES["US"]["tax_rate"])
    direct["carrier_fees"] += CARRIER_FEE_DIRECT
direct["total"] = sum(direct.values())
direct["due_at_door"] = direct["duty"] + direct["tax"] + direct["carrier_fees"]
direct["parcels"] = len(direct_parcels)

# shop gains over their own floors (private)
def gain(shop, lines, extras_cost=D(0), shipping_charged=D(0), shipping_cost=D(0)):
    g = D(0)
    for pid, s, unit in lines:
        if s != shop:
            continue
        key = (shop, pid + (":old" if (shop == "dalbit" and pid == "dal-snail-essence" and unit < 18) else ""))
        g += unit - PRIVATE[key]["floor"]
    return g - extras_cost + shipping_charged - shipping_cost

shop_gain = {
    "dalbit": dict(listed=gain("dalbit", listed_lines), deal=gain("dalbit", deal_lines, extras_cost=SAMPLE_KIT_COST)),
    "bada": dict(listed=gain("bada", listed_lines, shipping_charged=SHOPS["bada"]["domestic"], shipping_cost=BADA_PICKUP_COST),
                 deal=gain("bada", deal_lines, shipping_cost=BADA_PICKUP_COST)),
}

# the live deal: every event the shopper's Deal screen and the shop's order view show, in order.
# t = seconds after PayPal approves the hold. Both shops negotiate in parallel.
mid_lines = [  # Bada Market has accepted the mask; Dalbit Official is still at listed prices
    ("mul-gel-cleanser", "bada", D(12)),
    ("dal-rice-toner", "dalbit", D(21)),
    ("dal-snail-essence", "dalbit", D(23)),
    ("sae-cica-cream", "bada", D(19)),
    ("dal-cica-mask", "bada", D(2)),
]
mid_domestic, _ = domestic_for(mid_lines)
mid = landed(mid_lines, "US", mid_domestic)

EVENTS = [
    dict(t=1, shop="dalbit", actor="rally", kind="offer",
         lines={"dal-rice-toner": "17", "dal-snail-essence:older": "14"}, extras=["dalbit-sample-kit"],
         note="Older packaging works for this shopper. $17 and $14, with a sample kit?"),
    dict(t=2, shop="bada", actor="rally", kind="offer",
         lines={"mul-gel-cleanser": "11", "sae-cica-cream": "17"},
         note="$11 for the cleanser and $17 for the cream?"),
    dict(t=4, shop="bada", actor="shop", kind="counter",
         lines={"mul-gel-cleanser": "12", "sae-cica-cream": "19"},
         note="Our prices are firm. Shipping is free over $33."),
    dict(t=5, shop="dalbit", actor="shop", kind="counter",
         lines={"dal-rice-toner": "20", "dal-snail-essence:older": "16"}, extras=["dalbit-sample-kit"],
         note="Toner $20, older packaging $16. Sample kit with both."),
    dict(t=6, shop="bada", actor="rally", kind="offer",
         lines={"mul-gel-cleanser": "12", "sae-cica-cream": "19", "dal-cica-mask": "2"}, domestic="0",
         note="Add one $2 sheet mask so it ships free?"),
    dict(t=7, shop="bada", actor="shop", kind="accept", total=str(mid["total"]),
         note="Done. It ships free."),
    dict(t=9, shop="dalbit", actor="rally", kind="offer",
         lines={"dal-rice-toner": "18", "dal-snail-essence:older": "15"}, extras=["dalbit-sample-kit"],
         note="$18 and $15, and we have a deal."),
    dict(t=12, shop="dalbit", actor="shop", kind="counter", final=True,
         lines={"dal-rice-toner": "19", "dal-snail-essence:older": "16"}, extras=["dalbit-sample-kit"],
         note="$19 and $16 with the sample kit. Final offer."),
    dict(t=13, shop="dalbit", actor="rally", kind="accept", total=str(deal["total"]),
         note="Accepted."),
    dict(t=14, kind="done", total=str(deal["total"])),
]
assert mid["total"] == D("117.75"), mid["total"]

# every destination for the negotiated cart
countries_out = {}
for cc, c in COUNTRIES.items():
    b = landed(deal_lines, cc, deal_domestic, extra_kg=SAMPLE_KIT_KG)
    lb = landed(listed_lines, cc, listed_domestic)
    countries_out[cc] = dict(name=c["name"], region=c["region"], currency=c["currency"], tax_name=c["tax_name"],
                             duty_note=c["duty_note"],
                             deal={k: str(v) for k, v in in_currency(b, cc).items()},
                             listed={k: str(v) for k, v in in_currency(lb, cc).items()})

# ---------------------------------------------------------------- print and write
print("listed lines", [(p, s, str(u)) for p, s, u in listed_lines], "domestic", listed_domestic)
print("LISTED US", {k: str(v) for k, v in listed.items()})
print("DEAL   US", {k: str(v) for k, v in deal.items()}, "by shop", {k: str(v) for k, v in deal_by_shop.items()})
print("after Bada accepts", mid["total"])
print("mask saves", mask_saves, "without mask total", without_mask["total"])
print("DIRECT US", {k: str(v) for k, v in direct.items()})
print("saved vs listed", listed["total"] - deal["total"], "vs direct", direct["total"] - deal["total"])
print("shop gain", {k: {a: str(b) for a, b in v.items()} for k, v in shop_gain.items()})
for cc, v in countries_out.items():
    print(cc, v["currency"], "deal", v["deal"]["total"], "listed", v["listed"]["total"], v["deal"])

assert deal["total"] < listed["total"] < direct["total"]
assert mask_saves > 0
assert all(u >= PRIVATE[("dalbit", "dal-rice-toner")]["floor"] for p, s, u in deal_lines if p == "dal-rice-toner")

out = dict(
    note="Illustrative. Fictional shops, brands and products. FX, rate cards, carrier fee and US sales tax are illustrative; country rules must be verified.",
    fx_usd=dict((k, str(v)) for k, v in FX.items()),
    rally_fee_usd=str(RALLY_FEE_USD),
    shops={k: {a: (str(b) if isinstance(b, D) else b) for a, b in v.items()} for k, v in SHOPS.items()},
    brands=BRANDS,
    catalog=[dict(id=r[0], brand=r[1], name=r[2], size=r[3], category=r[4], weight_kg=r[5],
                  prices={s: str(D(str(p))) for s, p in r[6].items()}, **r[7]) for r in CATALOG],
    hero=dict(
        country="US", request=REQUEST, cart=CART,
        rules=dict(old_packaging_ok=True, add_small_extras_if_cheaper=True),
        listed=dict(lines=[dict(id=p, shop=s, unit=str(u)) for p, s, u in listed_lines],
                    breakdown={k: str(v) for k, v in listed.items()}),
        deal=dict(lines=[dict(id=p, shop=s, unit=str(u), **({"variant": "old packaging"} if p == "dal-snail-essence" else {}),
                              **({"added_by_agent": True} if p == "dal-cica-mask" else {})) for p, s, u in deal_lines],
                  extras=[dict(id="dalbit-sample-kit", shop="dalbit", name="Sample kit, 5 minis", unit="0")],
                  breakdown={k: str(v) for k, v in deal.items()}),
        hold=str(listed["total"]), charged=str(deal["total"]), released=str(listed["total"] - deal["total"]),
        mask_saves=str(mask_saves),
        direct={k: (str(v) if isinstance(v, D) else v) for k, v in direct.items()},
        saved_vs_listed=str(listed["total"] - deal["total"]), saved_vs_direct=str(direct["total"] - deal["total"]),
        events=EVENTS,
        shop_gain={k: {a: str(b) for a, b in v.items()} for k, v in shop_gain.items()},
        private={f"{s}/{p}": {a: str(b) for a, b in v.items()} for (s, p), v in PRIVATE.items()},
    ),
    countries=countries_out,
)
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenario.json"), "w"), indent=1)
