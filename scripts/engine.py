"""Reproduce the bounded engine without creating payment operations."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="US", choices=("US", "CA", "GB", "DE", "AU"))
    parser.add_argument("--fixture", action="store_true", help="Explicit deterministic candidate selector; never provider evidence.")
    parser.add_argument("--env-file", type=Path)
    args = parser.parse_args()
    from paypal_sandbox import load_env

    load_env(args.env_file)
    from rally.catalog import Catalog
    from rally.config import settings
    from rally.negotiation.auction import run_auction
    from rally.negotiation.engine import negotiate
    from rally.sourcing import source
    catalog = Catalog()
    quote = source(catalog.data["hero"]["cart"], args.country, catalog)
    print("Checkout:", json.dumps(quote["breakdown"]))
    choose = (lambda role, payload: {"indexes": [0], "note": "Please bid on these items."} if role == "buyer" else {"index": 0, "note": "Please consider these public terms."}) if args.fixture else None
    engine = run_auction if settings.deal_mode == "auction" else negotiate
    rules = {"old_packaging_ok": True, "bundles_ok": True} if settings.deal_mode == "auction" else catalog.data["hero"]["rules"]
    result = engine(quote, args.country, catalog, rules, choose=choose, emit=lambda row: print(json.dumps(row)))
    print("Result:", json.dumps({**result, "lines": [asdict(line) for line in result["lines"]]}))


if __name__ == "__main__":
    main()
