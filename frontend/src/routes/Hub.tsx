import { useEffect, useState } from 'react';
import { Screen } from '../components/MemberUI';
import { cents, money } from '../fixture';
import { request, type Order, type Session } from '../connected';
import Access from './shops/Access';
import HubRecovery from './HubRecovery';
export default function Hub() {
  const [orders, setOrders] = useState<Order[] | null>(null), [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<Session>('/session', { signal: controller.signal }).then(async session => {
      if (session.role !== 'hub') { setSignedIn(false); return; }
      setSignedIn(true);
      const result = await request<{ orders: Order[] }>('/hub/orders', { signal: controller.signal }); setOrders(result.orders);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [revision]);
  if (signedIn === false) return <Access hub />;
  return <Screen title="Seoul hub" back="/shop"><h1>Your Seoul hub</h1>{signedIn && <button className="text-link" onClick={async () => { try { await request('/logout', { method: 'POST', body: {} }); location.assign('/hub'); } catch (error) { setError((error as Error).message); } }}>Sign out</button>}{error && <p role="alert">{error}</p>}{!orders ? <p role="status">Loading orders…</p> : !orders.length ? <p>No boxes waiting at the hub.</p> : orders.map(order => <HubOrder key={order.id} order={order} refresh={() => setRevision(value => value + 1)} />)}<button className="text-link" onClick={() => setRevision(value => value + 1)}>Refresh orders</button>{signedIn && <HubRecovery />}</Screen>;
}
function HubOrder({ order, refresh }: { order: Order; refresh: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  async function mutate(path: 'ship' | 'true-up', event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const body = path === 'ship' ? { carrier: fields.get('carrier'), tracking: fields.get('tracking') } : { actual_minor: cents(String(fields.get('actual'))) };
      await request(`/hub/orders/${order.id}/${path}`, { method: 'POST', body }); setStatus(path === 'ship' ? 'Shipment saved. PayPal tracking is being updated.' : 'Customs cost saved. Any refund appears on the order.'); refresh();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="shop-group"><h2>Order {order.id}</h2><p>{order.country} · {order.fulfillment_state.replaceAll('_', ' ')}</p><strong className="money">{money(order.charged_minor ?? order.maximum_minor, order.currency)}</strong>{order.payment_state === 'CHARGED' && !['SHIPPED', 'DELIVERED'].includes(order.fulfillment_state) && <form className="request-form" onSubmit={event => mutate('ship', event)}><label htmlFor={`hub-carrier-${order.id}`}>International carrier</label><input id={`hub-carrier-${order.id}`} name="carrier" required maxLength={64} disabled={busy} /><label htmlFor={`hub-tracking-${order.id}`}>Tracking number</label><input id={`hub-tracking-${order.id}`} name="tracking" required maxLength={64} disabled={busy} /><button className="primary" disabled={busy}>Ship box from Seoul</button><p className="fine">Every shop’s parcel must be at the hub and its PayPal payout complete.</p></form>}{['SHIPPED', 'DELIVERED'].includes(order.fulfillment_state) && <form className="request-form" onSubmit={event => mutate('true-up', event)}><label htmlFor={`actual-${order.id}`}>Actual duty and tax ({order.currency})</label><input id={`actual-${order.id}`} name="actual" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required placeholder="0.00" disabled={busy} /><button className="primary" disabled={busy}>Reconcile customs cost</button><p className="fine">A lower actual cost refunds the difference to the shopper’s PayPal.</p></form>}{error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}</section>;
}
