"""One participating simulated supplier, fixed terms, distinct inventory batch per version."""

from uuid import uuid4

from psycopg.types.json import Jsonb

from .catalog import TERMS


def publish(db):
    # Serializes version allocation only; no external calls occur in this transaction.
    db.execute("SELECT pg_advisory_xact_lock(712066)")
    version = db.execute(
        "SELECT COALESCE(max(version),0)+1 AS n FROM offers"
    ).fetchone()["n"]
    offer_id = f"commonplace-calculator-v{version}-{uuid4().hex[:8]}"
    terms = {
        **TERMS,
        "offer_id": offer_id,
        "version": version,
        "merchant": "Commonplace Supply",
        "merchant_id": "commonplace",
    }
    db.execute(
        "INSERT INTO offers(id,product_id,terms,price_minor,currency,minimum,capacity,inventory,version) VALUES(%s,%s,%s,6500,'USD',5,5,5,%s)",
        (offer_id, terms["product_id"], Jsonb(terms), version),
    )
    return terms


def terms_for(db, group_id):
    row = db.execute(
        "SELECT o.* FROM offers o JOIN groups g ON g.offer_id=o.id WHERE g.id=%s",
        (group_id,),
    ).fetchone()
    if (
        not row
        or row["inventory"] != 5
        or row["price_minor"] != 6500
        or row["currency"] != "USD"
        or row["capacity"] != row["minimum"]
    ):
        raise RuntimeError("Published offer or reserved inventory invariant failed.")
    return row["terms"]
