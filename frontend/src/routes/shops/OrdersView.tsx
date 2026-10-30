import { useState } from 'react';
import { isAuction, applyAuctionEvent, initialAuction, type AuctionEvent } from '../../auction';
import { AuctionBoard } from '../../components/AuctionBoard';
import DealCard from '../../components/DealCard';
import { applyEvent, initialDeal, reconcileDeal } from '../../deal';
import { orderNumber, request } from '../../connected';
import { money, product, shops, type Line, type ShopId } from '../../fixture';
import type { MerchantOrder } from '../../shop-api';
import { Icon, Notice, Pill } from '../../components/Controls';

export function payoutPill(order: MerchantOrder) {
  const status = order.payout.status;
  if (status === 'outbid') return <Pill>Outbid</Pill>;
  if (status === 'completed') return <Pill tone="won">Paid by PayPal</Pill>;
  if (status === 'awaiting_handoff') return order.payment_state === 'CHARGED' ? <Pill tone="waiting">Awaiting hand-off</Pill> : <Pill tone="live">Bidding</Pill>;
  if (['failed', 'unknown', 'needs_review'].includes(status)) return <Pill tone="info">Payout under review</Pill>;
  return <Pill tone="live">Payout sent</Pill>;
}

export default function OrdersView({ orders, shop, readOnly, refresh }: { orders: MerchantOrder[]; shop: ShopId; readOnly: boolean; refresh: () => void }) {
  const wanted = new URLSearchParams(location.search).get('order');
  const fallback = orders.find(order => order.payout.status === 'awaiting_handoff' && order.payment_state === 'CHARGED' && order.lines.length) || orders[0];
  const [picked, setPicked] = useState<string | null>(wanted);
  const selected = orders.find(order => order.id === picked) || fallback;
  if (!orders.length) return <section className="card empty-card"><Icon name="orders" size={28} /><h2>No orders yet</h2><p>When a shopper’s bag includes your products, your agent bids and the order appears here.</p><a className="button accent" href="/shop"><Icon name="store" />Open your storefront<Icon name="external" size={15} /></a></section>;
  return <div className="orders-layout">
    <section className="card order-list" aria-label="Orders">
      <ul>{orders.map(order => <li key={order.id}><button type="button" className={order.id === selected?.id ? 'selected' : ''} aria-current={order.id === selected?.id ? 'true' : undefined} onClick={() => { setPicked(order.id); history.replaceState(null, '', `/shops/orders?order=${encodeURIComponent(order.id)}`); }}>
        <span className="order-line"><strong className="money">{orderNumber(order.id)}</strong><span className="money">{order.lines.length ? money(order.lines.reduce((sum, line) => sum + line.unit, 0), order.currency) : '—'}</span></span>
        <span className="order-line"><small>{order.country} · {order.lines.length} won</small>{payoutPill(order)}</span>
      </button></li>)}</ul>
    </section>
    {selected && <OrderDetail key={selected.id} order={selected} shop={shop} readOnly={readOnly} refresh={refresh} />}
  </div>;
}

function OrderDetail({ order, shop, readOnly, refresh }: { order: MerchantOrder; shop: ShopId; readOnly: boolean; refresh: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [carrier, setCarrier] = useState('Rally pickup');
  const initial = initialDeal(order.checkout_lines || order.lines, Number.MAX_SAFE_INTEGER);
  const auction = isAuction(order.events) ? order.events.reduce((state, event) => applyAuctionEvent(state, event as unknown as AuctionEvent), initialAuction(order.maximum_minor || Number.MAX_SAFE_INTEGER)) : null;
  const received = auction ? initial : order.events.reduce(applyEvent, initial);
  const terminal = ['CHARGED', 'REFUND_PENDING', 'REFUNDED'].includes(order.payment_state);
  const legacy = reconcileDeal({ ...received, done: terminal }, { ...order, checkout: { lines: order.checkout_lines || order.lines } }).shops[shop];
  const status = order.payout.status, won = order.lines.length > 0;
  const steps = [won, status !== 'awaiting_handoff' && status !== 'outbid', !['awaiting_handoff', 'outbid'].includes(status), status === 'completed'];
  const canHandOff = order.payment_state === 'CHARGED' && won && status === 'awaiting_handoff';
  async function handoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    const tracking = carrier === 'Rally pickup' ? `PICKUP-${orderNumber(order.id)}` : String(fields.get('tracking') || '');
    try { await request(`/shops/${shop}/orders/${order.id}/handoff`, { method: 'POST', body: { carrier, tracking } }); refresh(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card order-detail" aria-labelledby={`order-${order.id}`}>
    <header className="detail-head"><div><h2 id={`order-${order.id}`} className="money">{orderNumber(order.id)}</h2><p>Shopper in {order.country} · {order.payment_state === 'CHARGED' ? 'paid' : order.payment_state.replaceAll('_', ' ').toLowerCase()}</p></div>{payoutPill(order)}</header>
    {won && <ol className="stepper" aria-label="Order progress">{['Won', 'Handed off', 'Payout sent', 'Paid'].map((label, index) => <li key={label} className={steps[index] ? 'done' : steps[index - 1] ? 'current' : ''}><span aria-hidden="true">{steps[index] && <Icon name="check" size={13} />}</span>{label}</li>)}</ol>}
    <div className="detail-columns">
      <div className="detail-main">
        <h3>{won ? `You won ${order.lines.length} ${order.lines.length === 1 ? 'item' : 'items'}` : 'Another shop won this order'}</h3>
        {won && <ul className="won-items">{order.lines.map((line: Line) => <li key={line.id + (line.variant || '')}><span className="row-main"><strong>{product(line.id).name}</strong><small>{line.variant === 'older' ? 'Older packaging · ' : ''}{product(line.id).size}</small></span><span className="money">{money(line.unit, order.currency)}</span></li>)}</ul>}
      </div>
      <aside className="detail-side">
        {canHandOff ? <form className="handoff-card" onSubmit={handoff}>
          <h3><span className="soft-icon"><Icon name="truck" /></span>Hand off to the Seoul hub</h3>
          <label htmlFor={`carrier-${order.id}`}>Carrier</label>
          <select id={`carrier-${order.id}`} value={carrier} onChange={event => setCarrier(event.target.value)} disabled={readOnly || busy}><option>Rally pickup</option><option>Hangang Express</option><option>Other carrier</option></select>
          {carrier !== 'Rally pickup' && <><label htmlFor={`tracking-${order.id}`}>Tracking number</label><input id={`tracking-${order.id}`} name="tracking" required maxLength={64} disabled={readOnly || busy} autoComplete="off" /></>}
          <button className="button primary-dark" disabled={readOnly || busy}><Icon name="box" />{busy ? 'Saving hand-off…' : 'Record hand-off'}</button>
          <small>PayPal pays you right after.</small>
        </form> : won && status !== 'awaiting_handoff' ? <div className="payout-card">
          <span className="payout-label">PayPal payout</span>
          <strong className="money">{money(order.payout.amount_minor, 'USD')}</strong>
          <ol className="timeline"><li className="done">Handed off to the Seoul hub</li><li className="done">PayPal payout sent</li><li className={status === 'completed' ? 'done' : 'current'}>{status === 'completed' ? 'Paid to your PayPal account' : 'Waiting for PayPal to confirm'}</li></ol>
        </div> : won ? <div className="payout-card waiting"><span className="payout-label">Next</span><p>Hand off opens when the shopper’s payment is confirmed.</p></div> : <div className="payout-card waiting"><span className="payout-label">No payout due</span><p>The lowest complete delivered total wins. See how the bidding went below.</p></div>}
        {error && <Notice>{error}</Notice>}
      </aside>
    </div>
    <div className="detail-board">
        <h3>How your agent bid</h3>
        {auction ? <AuctionBoard state={auction} currency={order.currency} ownShop={shop} floors={order.lowest} /> : legacy && <DealCard value={legacy} country={order.country} floors={order.lowest} />}
        <details className="bid-notes"><summary>Bid notes</summary><ol>{order.events.filter(event => event.note).map(event => <li key={event.id}><strong>{event.actor === 'rally' ? 'Rally' : auction && event.shop ? shops[event.shop].name : 'Your agent'} · {event.t}s</strong><p>{event.note}</p></li>)}</ol></details>
      </div>
  </section>;
}
