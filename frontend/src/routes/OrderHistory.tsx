import { useEffect, useState } from 'react';
import { Action, Screen } from '../components/MemberUI';
import { money, type Currency } from '../fixture';
import { loadSession, orderHref, paymentComplete, request, type Order } from '../connected';
type EarlierPurchase = {
  id: string; group_id: string; run_id: string; group_status: string; terms: Record<string, unknown>;
  amount_minor: number; currency: Currency; captured_minor: number | null; created_at: string;
  authorization_status: string | null; capture_status: string | null; refund_status: string | null; void_status: string | null;
};
const status = (value: string | null) => value ? value.toLowerCase().replaceAll('_', ' ') : 'Not recorded';
export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[] | null>(null), [earlier, setEarlier] = useState<EarlierPurchase[] | null>(null);
  const [error, setError] = useState(''), [earlierError, setEarlierError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setEarlierError('');
    Promise.allSettled([
      loadSession().then(() => request<{ orders: Order[] }>('/orders', { signal: controller.signal })),
      request<{ purchases: EarlierPurchase[] }>('/legacy/purchases', { signal: controller.signal }),
    ]).then(([current, previous]) => {
      if (controller.signal.aborted) return;
      if (current.status === 'fulfilled') setOrders(current.value.orders); else setError(current.reason.message);
      if (previous.status === 'fulfilled') setEarlier(previous.value.purchases); else setEarlierError(previous.reason.message);
    });
    return () => controller.abort();
  }, [retry]);
  const retryButton = <button className="text-link" onClick={() => setRetry(value => value + 1)}>Try again</button>;
  return <Screen title="Your orders" back="/shop"><h1>Your orders</h1>
    {error ? <><p role="alert">{error}</p>{retryButton}</> : !orders ? <p role="status">Loading your orders…</p> : orders.length ? <ul className="order-history">{orders.map(order => <li className="shop-group" key={order.id}><a href={orderHref(paymentComplete(order) ? '/paid' : '/deal', order.id)}><h2>Order {order.id}</h2><strong className="money">{money(order.payment_state === 'REFUNDED' ? order.refunded_minor || 0 : order.charged_minor ?? order.maximum_minor, order.currency)}</strong><p>{paymentComplete(order) ? order.payment_state === 'REFUNDED' ? 'Refunded to PayPal' : 'Paid with PayPal' : order.payment_state === 'VOIDED' ? 'Canceled · hold release timing varies' : 'Your checkout and deal'}</p></a></li>)}</ul> : <p>No recent orders.</p>}
    {earlierError ? <section><h2>Earlier purchases</h2><p role="alert">Earlier receipts could not load. {earlierError}</p>{retryButton}</section> : earlier === null ? <p role="status">Loading earlier receipts…</p> : !!earlier.length && <section><h2>Earlier purchases</h2><ul className="order-history">{earlier.map(purchase => <EarlierReceipt key={purchase.id} purchase={purchase} />)}</ul></section>}
    {orders?.length === 0 && earlier?.length === 0 && <Action to="/shop">Explore the shop</Action>}
  </Screen>;
}
function EarlierReceipt({ purchase }: { purchase: EarlierPurchase }) {
  const paid = purchase.captured_minor !== null;
  const refunded = ['COMPLETED', 'REFUNDED'].includes((purchase.refund_status || '').toUpperCase());
  const title = typeof purchase.terms?.title === 'string' ? purchase.terms.title : `Order ${purchase.id}`;
  return <li className="shop-group"><h3>{title}</h3><p className="fine">{new Date(purchase.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</p><strong className="money">{money(purchase.captured_minor ?? purchase.amount_minor, purchase.currency)}</strong><p>{refunded ? 'Refund confirmed with PayPal' : paid ? 'Paid with PayPal' : 'Saved checkout amount'}</p><details className="breakdown"><summary>Original receipt and terms</summary><dl><div><dt>Order</dt><dd>{purchase.id}</dd></div><div><dt>Checkout amount</dt><dd className="money">{money(purchase.amount_minor, purchase.currency)}</dd></div>{paid && <div><dt>Confirmed charge</dt><dd className="money">{money(purchase.captured_minor!, purchase.currency)}</dd></div>}<div><dt>PayPal hold</dt><dd>{status(purchase.authorization_status)}</dd></div><div><dt>Payment</dt><dd>{status(purchase.capture_status)}</dd></div><div><dt>Refund</dt><dd>{status(purchase.refund_status)}</dd></div><div><dt>Hold cancellation</dt><dd>{status(purchase.void_status)}</dd></div></dl><h4>Original agreed terms</h4><pre className="agreed-terms" aria-label="Original agreed terms">{JSON.stringify(purchase.terms, null, 2)}</pre></details></li>;
}
