"""Reproduce the bounded engine without creating payment operations."""

import argparse
import json
from dataclasses import asdict

from rally.catalog import Catalog
from rally.negotiation.engine import negotiate
from rally.sourcing import source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="US", choices=("US", "CA", "GB", "DE", "AU"))
    parser.add_argument("--fixture", action="store_true", help="Explicit deterministic candidate selector; never provider evidence.")
    args = parser.parse_args()
    catalog = Catalog()
    quote = source(catalog.data["hero"]["cart"], args.country, catalog)
    print("Checkout:", json.dumps(quote["breakdown"]))
    choose = (lambda role, payload: {"index": 0, "note": "Please consider these public terms."}) if args.fixture else None
    result = negotiate(quote, args.country, catalog, catalog.data["hero"]["rules"], choose=choose, emit=lambda row: print(json.dumps(row)))
    print("Result:", json.dumps({**result, "lines": [asdict(line) for line in result["lines"]]}))


if __name__ == "__main__":
    main()
