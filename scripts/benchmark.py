import argparse
import json
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser(description="Offline fixture benchmark, not real-model or social-impact evidence.")
    parser.add_argument("--seed", type=int, default=20261023)
    parser.add_argument("--count", type=int, default=500)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--env-file", type=Path)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--fixture", action="store_true")
    modes.add_argument("--connected", action="store_true")
    args = parser.parse_args()
    from paypal_sandbox import load_env
    load_env(args.env_file)
    from rally import llm
    from rally.config import settings
    from rally.sim.benchmark import run
    from rally.sim.cache import ModelCache
    cache = ModelCache(llm.complete, ".runtime/benchmark-model-cache")
    with patch.object(llm, "complete", cache):
        report = run(args.seed, args.count, connected=args.connected)
    report["model_failures"] = cache.failures
    endpoint = urlsplit(settings.llm_base_url)
    hosted = endpoint.scheme == "https" and endpoint.hostname not in (None, "localhost", "127.0.0.1", "::1", "api")
    report["hosted_benchmark_verified"] = bool(args.connected and hosted and cache.failures == 0 and report["baseline_b_failed"] == 0 and report["d_model_choices"] > 0 and report["e_model_choices"] > 0 and report["bundle_split_violations"] == 0 and report["charge_above_hold"] == 0 and report["shop_below_authority"] == 0)
    text = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.write_text(text)
    print(text)


if __name__ == "__main__":
    main()
