"""US market range for comparable products, from a committed Channel3 snapshot.

The deal path never calls Channel3. scripts/market_snapshot.py writes the snapshot;
it stores only aggregate prices (no retailer names, titles, images or URLs).
"""

import json
from functools import lru_cache
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[2] / "design/scenario/market.json"
FIELDS = ("low_usd_cents", "median_usd_cents", "high_usd_cents", "n", "as_of")


@lru_cache(maxsize=1)
def _load():
    if not SNAPSHOT.is_file():
        return {}
    data = json.loads(SNAPSHOT.read_text())
    return data if isinstance(data, dict) else {}


def reference(product_id):
    """{"low_usd_cents", "median_usd_cents", "high_usd_cents", "n", "as_of"} or None."""
    row = _load().get(product_id)
    if not isinstance(row, dict) or any(key not in row for key in FIELDS):
        return None
    if not all(type(row[key]) is int and row[key] > 0 for key in FIELDS[:4]):
        return None
    if not row["low_usd_cents"] <= row["median_usd_cents"] <= row["high_usd_cents"]:
        return None
    return {key: row[key] for key in FIELDS}
