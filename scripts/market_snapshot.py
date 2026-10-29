"""Dev-only: build design/scenario/market.json from Channel3 (docs/plan/BIDDING.md, phase 2).

For each catalog product, search comparable US listings (category + size + key ingredient),
filter to the same category and a similar size, and store only aggregate prices:
{product_id: {"low_usd_cents", "median_usd_cents", "high_usd_cents", "n", "as_of", "query"}}.
Never store retailer names, titles, images or URLs. Skip a product when results are poor.

Usage: python scripts/market_snapshot.py --env-file /private/rally.env [--dry-run]
Requires CHANNEL3_API_KEY in the private env file. Check channel3.ai/docs for the current
search endpoint; prefer httpx (already a dependency) over adding an SDK.
"""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true", help="Print the snapshot instead of writing it.")
    parser.parse_args()
    raise SystemExit("market_snapshot: implement per docs/plan/BIDDING.md (Market reference).")


if __name__ == "__main__":
    main()
