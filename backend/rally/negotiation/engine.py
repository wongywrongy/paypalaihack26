"""Independent shop exchanges; each persisted event comes from validated terms."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic
from uuid import uuid4

from .. import llm
from ..fx import convert
from ..landed import calculate
from . import rally_agent, shop_agent
from .schema import Choice, Offer


def validate(lines, extras, initial, shop, destination, rules, catalog):
    expected = {catalog.offers[line.offer_id]["product_id"] for line in initial}
    seen = set()
    for line in lines:
        offer = catalog.offers.get(line.offer_id)
        if not offer or offer["shop_id"] != shop or line.qty != 1 or offer["stock"] < line.qty:
            raise ValueError("Offer exceeds item authority.")
        pid = offer["product_id"]
        if pid in seen or not catalog.allowed(pid, destination):
            raise ValueError("Offer duplicates or restricts an item.")
        seen.add(pid)
        if offer["variant"] == "older" and not rules["old_packaging_ok"]:
            raise ValueError("Older packaging was not permitted.")
        if pid not in expected and (not rules["add_small_extras_if_cheaper"] or offer["list_usd"] > 500):
            raise ValueError("Extra item was not permitted.")
        if type(line.unit_usd_cents) is not int or not 0 < line.unit_usd_cents <= offer["list_usd"]:
            raise ValueError("Offer price exceeds public terms.")
    if not expected <= seen or len(seen - expected) > 1:
        raise ValueError("Offer changed the requested items.")
    if extras and (shop != "dalbit" or extras != ("dalbit-sample-kit",)):
        raise ValueError("Unknown extra.")


def negotiate(start, destination, catalog, rules, *, choose=None, emit=None, max_seconds=30):
    if set(rules) != {"old_packaging_ok", "add_small_extras_if_cheaper"} or any(type(v) is not bool for v in rules.values()):
        raise ValueError("Explicit shopper rules are required.")
    started = monotonic()
    deadline = started + min(max_seconds, 30)
    initial = tuple(start["lines"])
    ceiling = start["breakdown"]["total"]
    currency = start["breakdown"]["currency"]
    rate = start.get("rate")
    state_lock, budget_lock = Lock(), Lock()
    state = {"lines": initial, "extras": (), "events": [], "seq": 0}
    budget = {"tokens": 60000, "calls": 0}
    groups = {}
    for line in initial:
        groups.setdefault(catalog.offers[line.offer_id]["shop_id"], []).append(line)

    def event(shop, actor, kind, lines=(), extras=(), note="", final=False, chosen_by="CODE"):
        with state_lock:
            state["seq"] += 1
            row = {"id": str(uuid4()), "seq": state["seq"], "t": round(monotonic() - started, 2), "shop": shop, "actor": actor, "kind": kind, "lines": {catalog.offers[line.offer_id]["product_id"] + (":older" if catalog.offers[line.offer_id]["variant"] == "older" else ""): convert(line.unit_usd_cents, currency, rate) for line in lines}, "extras": list(extras), "domestic": convert(rally_agent.shipping(lines, catalog), currency, rate) if lines else None, "note": note[:240], "final": final, "chosen_by": chosen_by, "total": calculate(state["lines"], destination, catalog, extras=state["extras"], rate=rate)["total"]}
            state["events"].append(row)
            if emit:
                emit(dict(row))

    def score_options(options, shop, original):
        scored = []
        for lines, extras in options:
            try:
                validate(lines, extras, original, shop, destination, rules, catalog)
                with state_lock:
                    others = tuple(line for line in state["lines"] if catalog.offers[line.offer_id]["shop_id"] != shop)
                    kits = tuple(e for e in state["extras"] if not e.startswith(shop)) + extras
                total = calculate(others + lines, destination, catalog, extras=kits, rate=rate)["total"]
                # Paid extras and variants must improve the complete obligation.
                if total <= ceiling:
                    scored.append((total, -len(extras), lines, extras))
            except ValueError:
                continue
        return sorted(scored, key=lambda x: (x[0], x[1], tuple(line.offer_id for line in x[2])))[:3]

    def select(options, role, shop, reply):
        payload = {"shop": catalog.shops[shop]["name"], "reply": reply, "currency": currency, "maximum": ceiling, "options": []}
        for total, _, lines, extras in options:
            option = {"lines": [asdict(line) for line in lines], "extras": list(extras), "total": total}
            if role == "shop":
                option["score"] = shop_agent.utility(lines, extras, catalog)
            payload["options"].append(option)
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise TimeoutError("Negotiation time limit.")
        if choose:
            result = choose(role, payload)
            selection = result if isinstance(result, Choice) else Choice.model_validate(result)
            by = "FIXTURE"
        else:
            by = "LLM"
            try:
                with budget_lock:
                    if budget["calls"] >= 18 or budget["tokens"] < 2000:
                        raise RuntimeError("Model budget exhausted.")
                    budget["calls"] += 1
                    remaining_tokens = budget["tokens"]
                    budget["tokens"] -= min(remaining_tokens, 12000)
                selection, _ = llm.complete(Choice, f"You represent {'the shopper' if role == 'rally' else 'the fictional merchant'}. Select one executable candidate and write a short public note. You cannot accept terms or move money. Prefer {'a lower complete total within the shopper permissions' if role == 'rally' else 'a strong permitted commercial score'}. All decisions are revalidated by code.", payload, timeout=min(4, remaining), max_tokens=250, remaining_tokens=remaining_tokens)
            except Exception:
                selection = Choice(index=0, note="Please consider these item and delivery terms." if role == "rally" else "These are our available item and delivery terms.")
                by = "CODE"
        if selection.index >= len(options):
            raise ValueError("Model selected an unknown candidate.")
        if monotonic() > deadline:
            raise TimeoutError("Negotiation time limit.")
        return options[selection.index], selection.note, by

    def accept(shop, original, lines, extras, actor, note, by):
        validate(lines, extras, original, shop, destination, rules, catalog)
        if not shop_agent.permitted(lines, extras, catalog):
            return False
        with state_lock:
            others = tuple(line for line in state["lines"] if catalog.offers[line.offer_id]["shop_id"] != shop)
            combined = others + lines
            kits = tuple(e for e in state["extras"] if not e.startswith(shop)) + extras
            priced = calculate(combined, destination, catalog, extras=kits, rate=rate)
            prior = calculate(state["lines"], destination, catalog, extras=state["extras"], rate=rate)
            if priced["total"] > min(prior["total"], ceiling):
                return False
            changed = any(catalog.offers[line.offer_id]["product_id"] not in {catalog.offers[x.offer_id]["product_id"] for x in original} or catalog.offers[line.offer_id]["variant"] == "older" for line in lines)
            if changed and priced["total"] >= prior["total"]:
                return False
            state["lines"], state["extras"] = combined, kits
        event(shop, actor, "accept", lines, extras, note, True, by)
        return True

    def exchange(shop, original):
        firm = False
        try:
            for reply in range(1, 4):
                scored = score_options(rally_agent.candidates(original, catalog, rules, reply, destination, firm=firm), shop, original)
                if not scored:
                    break
                (_, _, proposed, extras), note, by = select(scored, "rally", shop, reply)
                # Validate the strict executable schema before publishing a proposal.
                Offer.model_validate({"shop_id": shop, "reply": reply, "actor": "rally", "lines": [asdict(line) for line in proposed], "extras": [{"extra_id": e, "qty": 1, "unit_usd_cents": 0} for e in extras], "domestic_shipping_usd_cents": rally_agent.shipping(proposed, catalog), "expires_at": datetime.now(timezone.utc) + timedelta(seconds=max(0, deadline - monotonic())), "note": note})
                event(shop, "rally", "offer", proposed, extras, note, chosen_by=by)
                if shop_agent.permitted(proposed, extras, catalog):
                    if accept(shop, original, proposed, extras, "shop", "Accepted within our permitted terms.", "CODE"):
                        return
                counters = score_options(shop_agent.counters(proposed, extras, catalog, reply), shop, original)
                if not counters:
                    break
                # Preserve merchant preference order: higher first-round counter.
                if reply == 1:
                    counters.sort(key=lambda row: row[0], reverse=True)
                (_, _, counter, kits), note, by = select(counters, "shop", shop, reply)
                event(shop, "shop", "counter", counter, kits, note, reply >= 2, by)
                # A public firm-price counter redirects the next request to delivery terms.
                firm = catalog.policies[shop]["discount_bp"] == 0
                if reply >= 2 and accept(shop, original, counter, kits, "rally", "The complete total fits your saved choices and checkout maximum.", "CODE"):
                    return
        except Exception as exc:
            event(shop, "rally", "error", note="This shop's exchange stopped; your checkout terms remain available.", chosen_by=type(exc).__name__)
            return
        event(shop, "shop", "decline", note="We are keeping the checkout terms for this shop.")

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(exchange, shop, tuple(lines)) for shop, lines in groups.items()]
        for future in futures:
            future.result()
    breakdown = calculate(state["lines"], destination, catalog, extras=state["extras"], rate=rate)
    assert breakdown["total"] <= ceiling
    event(None, None, "done", note="The agreed total is ready for payment processing.")
    return {"lines": state["lines"], "extras": state["extras"], "breakdown": breakdown, "events": state["events"], "model_calls": budget["calls"], "elapsed_seconds": round(monotonic() - started, 3)}
