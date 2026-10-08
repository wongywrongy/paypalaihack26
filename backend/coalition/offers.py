"""Read immutable offers, including historical purchases, without creating legacy runs."""


def terms_for(db, group_id):
    row = db.execute(
        "SELECT o.* FROM offers o JOIN groups g ON g.offer_id=o.id WHERE g.id=%s",
        (group_id,),
    ).fetchone()
    if (
        not row
        or row["inventory"] < row["capacity"]
        or row["price_minor"] != row["terms"]["total_minor"]
        or row["currency"] != "USD"
    ):
        raise RuntimeError("Published offer or reserved inventory invariant failed.")
    return row["terms"]
