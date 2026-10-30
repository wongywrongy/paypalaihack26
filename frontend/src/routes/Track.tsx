import React from 'react';
import { auctionBreakdown, money, recordedMode, recordedOrder } from '../fixture';
import { Action, Screen, Unavailable } from '../components/MemberUI';
import { useOrder } from '../order-state';
import { orderHref, paymentComplete } from '../connected';
export default function Track() { return recordedMode() ? <RecordedTrack /> : <ConnectedTrack />; }
function RecordedTrack() { const country = recordedOrder.country; const total = auctionBreakdown(country); return <Screen title="Order RL-24817" back="/paid"><p className="fine order-context">{recordedOrder.destination} · {recordedOrder.currency}</p><h1>Packing in Seoul</h1><p className="intro">Arrives Oct 30 to Nov 2</p><section className="shop-group timeline-card"><ol className="timeline">{[
  [`Paid ${money(total.total, total.currency)}`, 'Oct 22 · PayPal released the rest of your hold'],
  ['Shops shipped to our Seoul hub', 'Oct 23 · Haneul Beauty and Dalbit Official'],
  ['Packed into one box', 'Checked against your order'],
  ['Leaves Seoul', 'Oct 26 · tracking appears in PayPal'],
  ['Customs cleared, duty paid', 'About Oct 29'],
  ['Delivered', 'Oct 30 to Nov 2'],
].map(([title, note], index) => <li key={title} style={{ '--i': index } as React.CSSProperties} className={index < 2 ? 'complete' : index === 2 ? 'current' : ''} aria-current={index === 2 ? 'step' : undefined}><h2>{title}</h2><p>{note}</p></li>)}</ol></section><section className="shop-group"><h2>You’re covered</h2><p>Not shipped by Oct 29? Full refund to your PayPal.</p><p>Customs charged less than estimated? We refund the difference.</p></section><Action to="/shop">Keep exploring</Action></Screen>; }
function ConnectedTrack() {
  const { id, order, error, refresh } = useOrder();
  if (!id) return <Unavailable />;
  if (!order) return <Screen title="Your order"><h1>Your box</h1><p role="status">{error || 'Loading your tracking…'}</p>{error && <button className="text-link" onClick={refresh}>Try again</button>}</Screen>;
  if (!paymentComplete(order)) return <Screen title={`Order ${order.id}`}><h1>Your deal comes first</h1><p>Tracking appears after your payment is confirmed.</p><Action to={orderHref('/deal', order.id)}>See your deal</Action></Screen>;
  const titles: Record<string, string> = { MERCHANT_CONFIRMED: 'Your shops are packing', AT_HUB: 'Packing in Seoul', SHIPPED: 'Your box is on its way', DELIVERED: 'Your box has arrived', DELIVERY_ISSUE: 'Your delivery needs a check' };
  return <Screen title={`Order ${order.id}`} back={orderHref('/paid', order.id)}><p className="fine order-context">{order.country} · {order.currency}</p><h1>{order.payment_state === 'REFUNDED' ? 'Refunded to PayPal' : titles[order.fulfillment_state] || 'Getting your box ready'}</h1><section className="shop-group timeline-card"><ol className="timeline">{order.tracking.map((step, index) => <li key={index} style={{ '--i': index } as React.CSSProperties} className={step.complete ? 'complete' : step.current ? 'current' : ''} aria-current={step.current ? 'step' : undefined}><h2>{step.title}</h2><p>{step.note}</p>{step.tracking && <p>{step.carrier} · <span className="money">{step.tracking}</span></p>}</li>)}</ol></section><button className="text-link" onClick={refresh}>Refresh tracking</button>{error && <p role="alert">{error}</p>}<section className="shop-group"><h2>You’re covered</h2><p>{order.ship_by ? `Not shipped by ${new Date(order.ship_by).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}? Full refund to your PayPal.` : 'If your box misses its ship-by date, you get a full refund to your PayPal.'}</p><p>Customs charged less than estimated? We refund the difference.</p></section><Action to="/shop">Keep exploring</Action></Screen>;
}
