import { useEffect, useState } from 'react';
import { checkedEvent, checkedQuote, loadSession, request, selectedOrder, type Order } from './connected';

export function checkedOrder(order: Order) {
  checkedQuote(order.checkout);
  checkedQuote({ ...order.checkout, lines: order.lines, breakdown: order.breakdown });
  const refunded = order.refunded_minor ?? 0, refundPending = order.refund_pending_minor ?? 0;
  if (![refunded, refundPending].every(value => Number.isSafeInteger(value) && value >= 0) || refunded + refundPending > (order.charged_minor || 0)) throw new Error('Rally could not verify this refund. Please reload to try again.');
  if (order.currency !== order.checkout.currency || !Number.isSafeInteger(order.maximum_minor) || order.maximum_minor !== order.checkout.breakdown.total || order.breakdown.total > order.maximum_minor || order.charged_minor !== null && (!Number.isSafeInteger(order.charged_minor) || order.charged_minor < 0 || order.charged_minor > order.maximum_minor)) throw new Error('Rally could not verify this order. Please reload to try again.');
  for (const event of order.events) checkedEvent(event, order.maximum_minor);
  return order;
}
export function useOrder() {
  const id = selectedOrder();
  const [order, setOrder] = useState<Order | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setError('');
    loadSession().then(() => request<Order>(`/orders/${encodeURIComponent(id)}`, { signal: controller.signal })).then(checkedOrder).then(setOrder).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id, revision]);
  useEffect(() => {
    if (!order || !order.refund_pending_minor && order.payment_state !== 'REFUND_PENDING') return;
    const timer = setInterval(() => setRevision(value => value + 1), 2000);
    return () => clearInterval(timer);
  }, [order?.refund_pending_minor, order?.payment_state]);
  return { id, order, error, setOrder, refresh: () => setRevision(value => value + 1) };
}
