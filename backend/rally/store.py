"""Additive catalog persistence; existing payment rows are never reseeded."""

import os

from psycopg.types.json import Jsonb

from .catalog import Catalog


def seed(db):
    catalog = Catalog()
    db.execute("SELECT pg_advisory_xact_lock(hashtextextended('rally-v2-catalog',0))")
    for sid, shop in catalog.shops.items():
        receiver = os.getenv("PAYPAL_SHOP_EMAIL_" + sid.upper(), "")
        db.execute("INSERT INTO shops(id,name,country,payout_email) VALUES(%s,%s,'KR',%s) ON CONFLICT(id) DO NOTHING", (sid, shop["name"], receiver))
        db.execute("INSERT INTO shop_policies(shop_id,policy) VALUES(%s,%s) ON CONFLICT DO NOTHING", (sid, Jsonb(catalog.policies[sid])))
    for pid, product in catalog.products.items():
        db.execute("INSERT INTO catalog_products(id,public) VALUES(%s,%s) ON CONFLICT DO NOTHING", (pid, Jsonb(product)))
    for offer in catalog.offers.values():
        columns = tuple(offer[k] for k in ("id", "product_id", "shop_id", "variant", "list_usd", "floor_usd", "cost_usd", "stock", "days_on_shelf"))
        db.execute("INSERT INTO catalog_offers(id,product_id,shop_id,variant,list_usd,floor_usd,cost_usd,stock,days_on_shelf) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", columns)
    db.commit()


def catalog(db, order_id=None):
    if not db.execute("SELECT 1 FROM catalog_offers LIMIT 1").fetchone():
        seed(db)
    result = Catalog()
    result.products = {row["id"]: row["public"] for row in db.execute("SELECT * FROM catalog_products").fetchall()}
    result.offers = {row["id"]: dict(row) for row in db.execute("SELECT * FROM catalog_offers").fetchall()}
    result.policies = {row["shop_id"]: {**result.policies[row["shop_id"]], **row["policy"]} for row in db.execute("SELECT * FROM shop_policies").fetchall()}
    if order_id:
        for row in db.execute("SELECT offer_id,qty FROM order_reservations WHERE order_id=%s AND state='reserved'", (order_id,)).fetchall():
            result.offers[row["offer_id"]]["stock"] += row["qty"]
    return result
