"""Resumable real-sandbox G1 check. Each command makes only its named mutations.

PYTHONPATH=backend python scripts/paypal_sandbox.py --help
Load credentials privately with --env-file; never put secrets on the command line.
This script does not start servers, register webhooks, or alter provider settings.
"""

import argparse
import json
import os
import shlex
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4


def load_env(path):
    if not path:
        return
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:]
        key, separator, value = line.partition("=")
        if not separator or not key.isidentifier():
            raise ValueError("Environment file must contain KEY=value assignments.")
        tokens = shlex.split(value, comments=True)
        if len(tokens) > 1:
            raise ValueError("Quote environment values containing spaces.")
        os.environ.setdefault(key, tokens[0] if tokens else "")


def key(run_id, step):
    return f"g1:{run_id}:{step}"


def approval(data):
    from urllib.parse import urlsplit

    for link in data.get("links", []):
        url = urlsplit(link.get("href", ""))
        if (
            link.get("rel") in ("approve", "payer-action")
            and url.scheme == "https"
            and url.hostname in ("www.sandbox.paypal.com", "sandbox.paypal.com")
        ):
            return link["href"]
    raise RuntimeError("Provider did not return a sandbox approval link.")


def setup(db, run_id):
    from psycopg.types.json import Jsonb

    email = os.environ.get("PAYPAL_SHOP_EMAIL", "")
    if "@" not in email:
        raise ValueError(
            "Set PAYPAL_SHOP_EMAIL to Haneul Beauty's sandbox business email."
        )
    now = datetime.now(timezone.utc)
    shop_id = "g1-" + str(run_id)
    db.execute(
        "INSERT INTO shops(id,name,country,payout_email) VALUES(%s,'Haneul Beauty','KR',%s)",
        (shop_id, email),
    )
    db.execute(
        "INSERT INTO pools(id,shop_id,organizer_id,lock_at,ship_by,deliver_to) VALUES(%s,%s,'g1-check',%s,%s,%s)",
        (
            run_id,
            shop_id,
            now + timedelta(hours=1),
            now + timedelta(days=7),
            Jsonb({"sandbox_check": True}),
        ),
    )
    members = []
    for name in ("Capture check", "Void check"):
        member_id = uuid4()
        db.execute(
            "INSERT INTO members(id,pool_id,display_name,raw_text,max_cents) VALUES(%s,%s,%s,'Real sandbox G1 check',200)",
            (member_id, run_id, name),
        )
        members.append(member_id)
    db.commit()
    return members


def members(db, run_id):
    rows = db.execute(
        "SELECT id,display_name FROM members WHERE pool_id=%s", (run_id,)
    ).fetchall()
    selected = {row["display_name"]: row["id"] for row in rows}
    if not {"Capture check", "Void check"} <= set(selected) or set(selected) - {
        "Capture check",
        "Void check",
        "CAD check",
    }:
        raise ValueError("This is not a G1 sandbox run.")
    return selected["Capture check"], selected["Void check"]


def cad_member(db, run_id):
    from rally.payments.ledger import payment_lock

    with payment_lock(db, run_id):
        row = db.execute(
            "SELECT id FROM members WHERE pool_id=%s AND display_name='CAD check'",
            (run_id,),
        ).fetchone()
        if row:
            return row["id"]
        member_id = uuid4()
        db.execute(
            "INSERT INTO members(id,pool_id,display_name,raw_text,max_cents) VALUES(%s,%s,'CAD check','Real sandbox CAD check',200)",
            (member_id, run_id),
        )
        return member_id


def result(db, run_id, step):
    from rally.payments.ledger import operation

    op = operation(db, key(run_id, step))
    if not op or op["status"] != "completed":
        raise RuntimeError(
            f"Complete {step} first; if interrupted or pending, run --run {run_id} reconcile {step}, then repeat this command."
        )
    return op


def verify_run(db, run_id, *, require_cad=True):
    from rally.payments.ledger import checked_result, operation, reconcile
    from rally.payments.paypal import amount_matches, paypal, resource_path

    ids = {"run": str(run_id)}
    steps = (
        ("order", "order"),
        ("authorize", "authorize"),
        ("capture", "capture"),
        ("void-order", "order"),
        ("void-authorize", "authorize"),
        ("void", "void"),
        ("refund", "refund"),
        ("payout", "payout"),
    )
    if require_cad:
        steps += (
            ("cad-order", "order"),
            ("cad-authorize", "authorize"),
            ("cad-capture", "capture"),
        )
    for step, kind in steps:
        pending = operation(db, key(run_id, step))
        db.commit()
        if pending and pending["status"] == "pending":
            reconcile(db, key(run_id, step))
        op = result(db, run_id, step)
        currency = "CAD" if step.startswith("cad-") else "USD"
        if op["request"].get("currency", "USD") != currency:
            raise RuntimeError(
                "Recorded payment currency does not match the proof step."
            )
        db.commit()
        ref = op["provider_ref"]
        if ref.startswith("FIXTURE"):
            raise RuntimeError("Fixture IDs cannot establish G1.")
        data = paypal("GET", resource_path(kind, ref))
        if kind == "authorize":
            if (
                data.get("id") != ref
                or data.get("status")
                not in ("CREATED", "CAPTURED", "VOIDED", "PARTIALLY_CAPTURED")
                or not amount_matches(data.get("amount", {}), 200, currency)
            ):
                raise RuntimeError("Authorization could not be independently verified.")
        else:
            checked_result(op, data)
        if kind == "capture" and (
            data.get("status") not in ("COMPLETED", "REFUNDED")
            or op["request"]["amount_cents"] != 100
        ):
            raise RuntimeError("Lower final capture has not completed.")
        if kind == "refund" and data.get("status") != "COMPLETED":
            raise RuntimeError("Refund has not completed.")
        if kind == "payout":
            items = data.get("items", [])
            expected = op["request"]["body"]["items"][0]
            if (
                data["batch_header"].get("batch_status") != "SUCCESS"
                or len(items) != 1
                or items[0].get("transaction_status") != "SUCCESS"
            ):
                raise RuntimeError(
                    "Payout batch and item must both reach SUCCESS; run verify again later."
                )
            actual = items[0].get("payout_item", {})
            if (
                actual.get("receiver") != expected["receiver"]
                or not amount_matches(
                    {
                        "currency_code": actual.get("amount", {}).get("currency"),
                        "value": actual.get("amount", {}).get("value"),
                    },
                    op["request"]["amount_cents"],
                )
                or actual.get("sender_item_id") != expected["sender_item_id"]
            ):
                raise RuntimeError(
                    "Payout receiver, amount, or item identity mismatch."
                )
            ids["payout-item"] = items[0]["payout_item_id"]
        ids[step] = ref
    events = db.execute(
        "SELECT event_id FROM webhook_events WHERE verified AND processed_at IS NOT NULL AND provider_ref=ANY(%s)",
        (list(ids.values()),),
    ).fetchall()
    if not events:
        raise RuntimeError(
            "Await a genuine signature-verified, reconciled webhook for this run; simulator events are insufficient."
        )
    ids["webhooks"] = [e["event_id"] for e in events]
    return ids


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--env-file", type=Path)
    parser.add_argument(
        "--run", type=UUID, help="Reuse the printed run UUID when resuming."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    start = commands.add_parser(
        "start", help="Create a $2 hold order; prints buyer approval URL."
    )
    start.add_argument("--return-url", required=True)
    start.add_argument("--cancel-url", required=True)
    commands.add_parser(
        "charge",
        help="After first approval: authorize $2, final capture $1, create second $2 order.",
    )
    commands.add_parser(
        "void-refund",
        help="After second approval: authorize and void it, refund first capture $1.",
    )
    payout = commands.add_parser(
        "payout", help="Record sandbox tracking and pay the shop $0.50."
    )
    payout.add_argument("--carrier", required=True)
    payout.add_argument("--tracking", required=True)
    commands.add_parser(
        "verify",
        help="Verify full v2 G1: USD lifecycle, payout, genuine verified webhook and completed CAD payment.",
    )
    commands.add_parser(
        "verify-usd",
        help="Verify legacy USD lifecycle only; this does not establish v2 G1.",
    )
    cad_start = commands.add_parser(
        "cad-start",
        help="After USD payout succeeds: create a C$2 hold; buyer approval required.",
    )
    cad_start.add_argument("--return-url", required=True)
    cad_start.add_argument("--cancel-url", required=True)
    commands.add_parser(
        "cad-charge",
        help="After CAD approval: authorize C$2 and final capture C$1.",
    )
    reconcile = commands.add_parser(
        "reconcile",
        help="Reconcile an interrupted operation by GET; never repeats a mutation.",
    )
    reconcile.add_argument(
        "step",
        choices=(
            "order",
            "authorize",
            "capture",
            "void-order",
            "void-authorize",
            "void",
            "refund",
            "payout",
            "cad-order",
            "cad-authorize",
            "cad-capture",
        ),
    )
    args = parser.parse_args(argv)
    load_env(args.env_file)
    from rally.config import settings
    from rally.db import connect
    from rally.payments.ledger import perform, reconcile

    required = (
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
        "PAYPAL_MERCHANT_ID",
        "PAYPAL_WEBHOOK_ID",
        "PAYPAL_SHOP_EMAIL",
    )
    missing = [name for name in required if not os.environ.get(name)]
    if settings.mode != "connected" or missing:
        raise ValueError("Connected sandbox required; missing: " + ", ".join(missing))
    if args.command != "start" and not args.run:
        parser.error("--run is required when resuming.")
    run_id = args.run or uuid4()
    print("Sandbox run:", run_id, flush=True)
    with connect() as db:
        if args.command == "start":
            existing = db.execute(
                "SELECT 1 FROM pools WHERE id=%s", (run_id,)
            ).fetchone()
            capture_member, void_member = (
                members(db, run_id) if existing else setup(db, run_id)
            )
            data = perform(
                db,
                "order",
                key(run_id, "order"),
                pool_id=run_id,
                member_id=capture_member,
                return_url=args.return_url,
                cancel_url=args.cancel_url,
            )
            print(
                "Approve this $2.00 sandbox hold with a personal buyer account:",
                approval(data),
            )
            print(
                "Then run --run",
                run_id,
                "charge. It final-captures $1.00 and prints the second approval URL.",
            )
            return
        capture_member, void_member = members(db, run_id)
        if args.command == "reconcile":
            reconcile(db, key(run_id, args.step))
            print("Reconciled", args.step)
            return
        if args.command == "cad-start":
            result(db, run_id, "payout")
            data = perform(
                db,
                "order",
                key(run_id, "cad-order"),
                pool_id=run_id,
                member_id=cad_member(db, run_id),
                currency="CAD",
                return_url=args.return_url,
                cancel_url=args.cancel_url,
            )
            print(
                "Approve this C$2.00 sandbox hold with a CAD buyer account:",
                approval(data),
            )
            print("Then run --run", run_id, "cad-charge. It final-captures C$1.00.")
            return
        if args.command == "cad-charge":
            cad_order = result(db, run_id, "cad-order")
            member_id = cad_member(db, run_id)
            data = perform(
                db,
                "authorize",
                key(run_id, "cad-authorize"),
                pool_id=run_id,
                member_id=member_id,
                resource_id=cad_order["provider_ref"],
            )
            auth = data["purchase_units"][0]["payments"]["authorizations"][0]["id"]
            perform(
                db,
                "capture",
                key(run_id, "cad-capture"),
                pool_id=run_id,
                member_id=member_id,
                resource_id=auth,
                amount_cents=100,
            )
            result(db, run_id, "cad-capture")
            print("CAD capture completed. Run verify for the complete v2 G1 proof.")
            return
        order = result(db, run_id, "order")
        if args.command == "charge":
            data = perform(
                db,
                "authorize",
                key(run_id, "authorize"),
                pool_id=run_id,
                member_id=capture_member,
                resource_id=order["provider_ref"],
            )
            auth = data["purchase_units"][0]["payments"]["authorizations"][0]["id"]
            perform(
                db,
                "capture",
                key(run_id, "capture"),
                pool_id=run_id,
                member_id=capture_member,
                resource_id=auth,
                amount_cents=100,
            )
            result(db, run_id, "capture")
            original = order["request"]["input"]
            data = perform(
                db,
                "order",
                key(run_id, "void-order"),
                pool_id=run_id,
                member_id=void_member,
                return_url=original["return_url"],
                cancel_url=original["cancel_url"],
            )
            print(
                "Approve this second $2.00 sandbox hold; it will be voided:",
                approval(data),
            )
            print("Then run --run", run_id, "void-refund.")
        elif args.command == "void-refund":
            second = result(db, run_id, "void-order")
            data = perform(
                db,
                "authorize",
                key(run_id, "void-authorize"),
                pool_id=run_id,
                member_id=void_member,
                resource_id=second["provider_ref"],
            )
            auth = data["purchase_units"][0]["payments"]["authorizations"][0]["id"]
            perform(
                db,
                "void",
                key(run_id, "void"),
                pool_id=run_id,
                member_id=void_member,
                resource_id=auth,
            )
            capture = result(db, run_id, "capture")
            perform(
                db,
                "refund",
                key(run_id, "refund"),
                pool_id=run_id,
                member_id=capture_member,
                resource_id=capture["provider_ref"],
                amount_cents=100,
            )
            print(
                "Void and $1.00 refund submitted. Next: payout --carrier <sandbox-carrier> --tracking <sandbox-number> pays the shop $0.50."
            )
        elif args.command == "payout":
            result(db, run_id, "refund")
            if not args.carrier.strip() or not args.tracking.strip():
                raise ValueError("Carrier and tracking must be nonempty.")
            db.execute(
                "INSERT INTO shipments(id,pool_id,carrier,tracking_number) VALUES(%s,%s,%s,%s) ON CONFLICT(pool_id) DO NOTHING",
                (uuid4(), run_id, args.carrier, args.tracking),
            )
            db.commit()
            perform(
                db, "payout", key(run_id, "payout"), pool_id=run_id, amount_cents=50
            )
            print(
                "Shop $0.50 payout submitted. After the batch/item succeed, run cad-start --return-url <url> --cancel-url <url>; then verify after the genuine webhook is processed."
            )
        else:
            require_cad = args.command == "verify"
            ids = verify_run(db, run_id, require_cad=require_cad)
            scope = (
                "v2 G1 passed"
                if require_cad
                else "Legacy USD lifecycle verified; v2 G1 still pending"
            )
            print(scope + ":", json.dumps(ids, sort_keys=True))
            print("Append to EVIDENCE.md:")
            print(
                f"- {datetime.now(timezone.utc).isoformat()}: real sandbox {scope}; {json.dumps(ids, sort_keys=True)}"
            )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Provider bodies, access tokens, environment values and buyer details stay private.
        if isinstance(exc, (ValueError, RuntimeError)):
            sys.exit(str(exc))
        sys.exit(
            "Sandbox check stopped: "
            + type(exc).__name__
            + ". Inspect the durable ledger before retrying."
        )
