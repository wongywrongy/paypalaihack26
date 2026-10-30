"""Filtered comparable US medians, refreshed outside the auction path."""
import json
import logging
import os
from datetime import date
from functools import lru_cache
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[2] / 'design/scenario/market.json'
FIELDS = ('median_usd_cents', 'n', 'as_of')


@lru_cache(maxsize=1)
def _load():
    try:
        data = json.loads(SNAPSHOT.read_text())
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def filtered(row):
    if not isinstance(row, dict):
        return None
    if not all(type(row.get(k)) is int and row[k]>0 for k in ('low_usd_cents','median_usd_cents','high_usd_cents','n')):
        return None
    low, median, high = (row[k] for k in ('low_usd_cents','median_usd_cents','high_usd_cents'))
    if row['n']<5 or not low<=median<=high or 2*high>5*low:
        return None
    try:
        date.fromisoformat(row['as_of'])
    except (KeyError,TypeError,ValueError):
        return None
    return {k:row[k] for k in FIELDS}


def reference(product_id, live=None):
    return filtered((live or {}).get(product_id)) or filtered(_load().get(product_id))


def refresh_one():
    """One product per maintenance tick; one attempt/product/day, including failures."""
    import httpx

    from .catalog import Catalog
    from .db import connect
    key = os.getenv('CHANNEL3_API_KEY','').strip()
    if not key:
        return None
    with connect() as db:
        row = db.execute("SELECT p.id FROM catalog_products p LEFT JOIN market_refresh_attempts a ON a.product_id=p.id WHERE a.attempted_at IS NULL OR a.attempted_at<date_trunc('day',now()) ORDER BY p.id FOR UPDATE OF p SKIP LOCKED LIMIT 1").fetchone()
        if not row:
            return None
        db.execute("INSERT INTO market_refresh_attempts(product_id,attempted_at) VALUES(%s,now()) ON CONFLICT(product_id) DO UPDATE SET attempted_at=now()", (row['id'],))
    catalog = Catalog()
    catalog.products = {row['id']:catalog.products[row['id']]}
    try:
        from scripts.market_snapshot import snapshot
        with httpx.Client(headers={'x-api-key':key}, timeout=10, follow_redirects=False) as client:
            prices = snapshot(catalog, client).get(row['id'])
        with connect() as db:
            if prices:
                db.execute("INSERT INTO market_references(product_id,low_usd_cents,median_usd_cents,high_usd_cents,n,as_of) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(product_id) DO UPDATE SET low_usd_cents=EXCLUDED.low_usd_cents,median_usd_cents=EXCLUDED.median_usd_cents,high_usd_cents=EXCLUDED.high_usd_cents,n=EXCLUDED.n,as_of=EXCLUDED.as_of", (row['id'], *(prices[k] for k in ('low_usd_cents','median_usd_cents','high_usd_cents','n','as_of'))))
        return {'product_id':row['id'], 'saved':bool(prices), 'shown':bool(filtered(prices))}
    except Exception as exc:
        logging.getLogger('rally.market').warning('Market refresh retained prior prices: %s', type(exc).__name__)
        return {'product_id':row['id'], 'saved':False, 'shown':False, 'failed':True}
