"""Saved auction outcomes. Private margins stay in the merchant workspace."""
from . import orders, store
from .fx import money
from .payments.ledger import operation


def history(db, shop, limit=20):
    rows = db.execute("SELECT order_id AS id,created_at FROM shop_agent_memory WHERE shop_id=%s ORDER BY created_at DESC,order_id LIMIT %s", (shop, limit)).fetchall()
    catalog = store.catalog(db)
    result = []
    for item in rows:
        row = orders.owned(db, item['id'])
        final = row['final_terms']
        if 'auction' not in final:
            continue
        events = [r['data'] for r in db.execute("SELECT data FROM deal_events WHERE order_id=%s ORDER BY seq", (item['id'],)).fetchall()]
        start = next((e for e in events if e.get('kind')=='start'), {})
        items = [pid for pid, shops in start.get('shops',{}).items() if shop in shops]
        bids = [e for e in events if e.get('shop') == shop and e.get('kind')=='bid']
        winners = final['auction']['winners']
        won = [pid for pid, value in winners.items() if value['shop']==shop]
        bundle_losses = sum(bool(winners.get(pid,{}).get('bundle')) for pid in items if pid not in won)
        floor_total, margin, own_units = 0, 0, 0
        authority = final.get('authority',{}).get('offers',catalog.offers)
        for line in final['lines']:
            offer = authority[line['offer_id']]
            if offer['shop_id']==shop:
                floor_total += offer['floor_usd']
                own_units += line['unit_usd_cents']
        margin = max(0, own_units - floor_total)
        perks = []
        if any(w.get('bundle') for w in winners.values()):
            perks.append('a bundle')
        if any(v==0 for v in final.get('domestic_usd',{}).values()):
            perks.append('free shipping in Korea')
        if final.get('extras'):
            perks.append('a sample kit')
        total = final['breakdown']['total']
        code = final['currency']
        reason = f"Lowest complete delivered total: {money(total, code)}."
        if perks:
            reason += ' Winning terms include ' + ', '.join(perks) + '.'
        payment = operation(db, f"order:{item['id']}:shop:{shop}:payout")
        result.append({'id':str(item['id']), 'created_at':item['created_at'].isoformat(), 'items':items, 'bids':bids, 'won':won, 'winners':winners, 'total':total, 'currency':code, 'margin_usd':margin, 'bundle_losses':bundle_losses, 'reason':reason, 'payout_status':payment['status'] if payment else 'awaiting_handoff' if won else 'outbid'})
    return result


def public_summary(rows):
    # Publishing margin over a public bid would reveal its floor by subtraction.
    return f"Last {len(rows)} auctions: won {sum(len(r['won']) for r in rows)} of {sum(len(r['items']) for r in rows)} items; lost {sum(r['bundle_losses'] for r in rows)} items to winning bundles. Compare complete delivered totals."
