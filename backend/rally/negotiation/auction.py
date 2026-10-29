"""Bounded open bidding. Models choose indexes; code owns terms and the award."""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from pathlib import Path
from time import monotonic, sleep
from uuid import uuid4

from .. import llm, market
from ..fx import convert
from . import award, bids, buyer
from .schema import AskChoice, Bid, Choice

ROUNDS = 3
MAX_SECONDS = 30
CALL_TIMEOUT_SECONDS = 4
ROUND_SECONDS = 3.5
logger = logging.getLogger(__name__)
RULE_KEYS = frozenset({"old_packaging_ok", "bundles_ok"})


def rules_checked(rules):
    if not isinstance(rules, dict) or set(rules) != RULE_KEYS or any(type(v) is not bool for v in rules.values()):
        raise ValueError("Choose both shopping permissions explicitly.")
    return rules


def run_auction(start, destination, catalog, rules, *, choose=None, emit=None, max_seconds=MAX_SECONDS, pace=False, recorded_review=False):
    rules_checked(rules)
    started = monotonic()
    deadline = started + max(0, min(MAX_SECONDS, max_seconds))
    currency, rate = start["breakdown"]["currency"], start.get("rate")
    product_ids = [catalog.offers[line.offer_id]["product_id"] for line in start["lines"]]
    offers = bids.eligible(product_ids, destination, catalog, rules)
    shops = sorted({o["shop_id"] for rows in offers.values() if len({o["shop_id"] for o in rows}) > 1 for o in rows})
    current, events = {}, []
    best = award.best_allocation(current, start, destination, catalog, rules)
    calls, tokens = 0, 60000
    failures = {"buyer": 0, "shop": 0}
    executor = ThreadPoolExecutor(max_workers=4)

    def event(kind, note="", chosen_by="CODE", **fields):
        row = {"id": str(uuid4()), "seq": len(events) + 1, "t": round(monotonic() - started, 3),
               "kind": kind, "actor": "shop" if kind in ("bid", "pass") else "rally",
               "note": note.replace("\n", " ")[:240], "total": best["breakdown"]["total"], "chosen_by": chosen_by, **fields}
        events.append(row)
        if emit:
            emit(dict(row))

    def failed(role, exc, shop=None):
        failures[role] += 1
        logger.warning("Auction model fallback: role=%s shop=%s reason=%s", role, shop, type(exc).__name__)

    def submit(schema, role, payload):
        nonlocal calls, tokens
        remaining = min(CALL_TIMEOUT_SECONDS, deadline - monotonic())
        if remaining <= 0:
            raise TimeoutError()
        if choose:
            return executor.submit(choose, role, payload), remaining
        allowance = min(tokens, 5000)
        if allowance < 1000:
            raise RuntimeError("Model budget exhausted.")
        tokens -= allowance
        calls += 1
        return executor.submit(llm.complete, schema,
                               "You represent " + ("the shopper" if role == "buyer" else "a fictional shop") + ". Pick only candidate indexes and write one short public line. You cannot accept or move money.",
                               payload, timeout=remaining, max_tokens=250, remaining_tokens=allowance, model_role=role), remaining

    def resolve(future, schema, timeout):
        response = future.result(timeout=max(0, min(timeout, deadline - monotonic())))
        value = response if choose else response[0]
        return value if isinstance(value, schema) else schema.model_validate(value)

    def public_leaders():
        return {catalog.offers[line.offer_id]["product_id"]: {"shop": catalog.offers[line.offer_id]["shop_id"], "unit": line.unit_usd_cents} for line in best["lines"]}

    # Only explicit recorded review with a fixture selector reads the recording. Every recorded
    # candidate still crosses the same authority validator as a connected bid.
    recording = None
    if recorded_review and choose is None:
        raise ValueError("Recorded review requires an explicit fixture selector.")
    if recorded_review:
        data = json.loads((Path(__file__).resolve().parents[3] / "design/scenario/auction.json").read_text())
        if set(product_ids) == set(data["cart"]) and all(rules.values()):
            recording = data
    event("start", "Shops are bidding on your bag.", v=3, items=product_ids,
          shops={pid: sorted({o["shop_id"] for o in rows}) for pid, rows in offers.items()},
          listed={pid: {o["shop_id"]: convert(o["list_usd"], currency, rate) for o in rows if o["variant"] == "current"} for pid, rows in offers.items()})
    rounds = 0
    try:
        for round_no in range(1, ROUNDS + 1):
            if monotonic() >= deadline:
                logger.info("Auction deadline reached; returning best complete award")
                break
            round_started = monotonic()
            asks = buyer.candidate_asks(round_no, public_leaders(), current, offers, rules, market=market.reference)
            selected, by = asks[:3], "CODE"
            note = buyer.round_note(round_no, best["breakdown"]["total"], currency)
            if asks:
                try:
                    future, timeout = submit(AskChoice, "buyer", {"round": round_no, "market": {pid: value for pid in product_ids if (value := market.reference(pid))}, "leaders": public_leaders(), "options": [a.model_dump() for a in asks]})
                    choice = resolve(future, AskChoice, timeout)
                    if len(set(choice.indexes)) != len(choice.indexes) or any(i < 0 or i >= len(asks) for i in choice.indexes):
                        raise ValueError("Unknown ask.")
                    selected = asks if round_no == 1 else [asks[i] for i in choice.indexes]
                    note, by = choice.note, "FIXTURE" if choose else "LLM"
                except Exception as exc:
                    failed("buyer", exc)
            for ask in selected:
                event("ask", note if round_no > 1 else ask.note, chosen_by=by, round=round_no, shop=ask.shop_id, items=ask.product_ids)
            pending = []
            for shop in shops:
                options = bids.candidates(shop, round_no, offers, current.get(shop), public_leaders(), selected, catalog, rules, current=current, start=start, destination=destination)
                recorded = None
                if recording:
                    recorded = next(row for row in recording["bids"] if row["shop"] == shop and row["round"] == round_no)
                    candidate = Bid.model_validate({"shop_id": shop, "round": round_no, "items": [{"offer_id": o, "unit_usd_cents": u} for o, u in recorded["items"].items()],
                                                    "bundle": recorded.get("bundle"), "extras": recorded.get("extras", []), "free_domestic": recorded.get("free_domestic", False), "pass": recorded.get("pass", []), "note": recorded["note"]})
                    try:
                        bids.validate(candidate, current.get(shop), offers, catalog, rules)
                        options = [candidate] + options[:2]
                    except ValueError:
                        recorded = None
                if not options:
                    event("error", "This shop has no valid bid.", shop=shop, round=round_no)
                    continue
                payload = {"shop": catalog.shops[shop]["name"], "goals": bids.PUBLIC_GOALS[shop], "round": round_no,
                           "market": {pid: value for pid in product_ids if (value := market.reference(pid))}, "leaders": public_leaders(), "asks": [a.model_dump() for a in selected],
                           "options": [{**b.model_dump(by_alias=True), "utility_rank": rank + 1,
                                        "wins": bids.assessment(b, current.get(shop), current, start, destination, catalog, rules)[1]} for rank, b in enumerate(options)]}
                future, timeout = None, 0
                try:
                    future, timeout = submit(Choice, "shop", payload)
                except Exception as exc:
                    failed("shop", exc, shop)
                pending.append((shop, options, future, timeout, monotonic(), recorded))
            # Resolve in stable display order. Calls were started in parallel.
            pending.sort(key=lambda row: (row[0] != "bada", row[0] != "dalbit", row[0]))
            for shop, options, future, timeout, submitted, recorded in pending:
                bid, by = options[0], "CODE"
                if future is not None:
                    try:
                        choice = resolve(future, Choice, timeout - (monotonic() - submitted))
                        if not 0 <= choice.index < len(options):
                            raise ValueError("Unknown bid.")
                        bid = options[choice.index].model_copy(update={"note": choice.note.replace("\n", " ")})
                        by = "FIXTURE" if choose else "LLM"
                    except Exception as exc:
                        failed("shop", exc, shop)
                bids.validate(bid, current.get(shop), offers, catalog, rules)
                current[shop] = bids.merge(current.get(shop), bid)
                perks = {}
                units = {}
                for item in bid.items:
                    o = catalog.offers[item.offer_id]
                    pid = o["product_id"]
                    units[pid + (":older" if o["variant"] == "older" else "")] = convert(item.unit_usd_cents, currency, rate)
                    perks[pid] = (["older"] if o["variant"] == "older" else []) + (["kit"] if current[shop].extras else []) + (["bundle"] if bid.bundle and item.offer_id in bid.bundle.offer_ids else []) + (["freeship"] if current[shop].free_domestic else [])
                bundle = {"items": [catalog.offers[o]["product_id"] for o in bid.bundle.offer_ids], "price": convert(bid.bundle.price_usd_cents, currency, rate)} if bid.bundle else None
                event("bid", bid.note, chosen_by=by, round=round_no, shop=shop, items=units, bundle=bundle, perks=perks)
                if bid.pass_offers:
                    event("pass", "This shop passes on these items.", shop=shop, round=round_no, items=[catalog.offers[o]["product_id"] for o in bid.pass_offers])
            best = award.best_allocation(current, start, destination, catalog, rules)
            if pace:
                sleep(max(0, min(round_started + ROUND_SECONDS, deadline) - monotonic()))
            event("round", note, round=round_no, leaders=best["leaders"])
            rounds = round_no
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
    assert best["breakdown"]["total"] <= start["breakdown"]["total"]
    winners = {catalog.offers[line.offer_id]["product_id"]: {"shop": catalog.offers[line.offer_id]["shop_id"], "unit": convert(line.unit_usd_cents, currency, rate), "bundle": catalog.offers[line.offer_id]["product_id"] in best["bundled"], "variant": "older" if catalog.offers[line.offer_id]["variant"] == "older" else None} for line in best["lines"]}
    event("award", "Your best complete delivered total is ready.", winners=winners, extras=list(best["extras"]), domestic={s: convert(v, currency, rate) for s, v in best["domestic_usd"].items()})
    event("done", "Bidding is complete.")
    best.pop("bundled", None)
    return {**best, "events": events, "winners": winners, "rounds": rounds, "model_calls": calls, "model_failures": sum(failures.values()), "model_failures_by_role": failures, "elapsed_seconds": round(monotonic() - started, 3)}
