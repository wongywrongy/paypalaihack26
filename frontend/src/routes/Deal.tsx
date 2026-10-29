import { isAuction } from '../auction';
import { AuctionPlayback, ConnectedAuction } from '../components/AuctionDeal';
import AnimatedTotal from '../components/DealTotal';
import { auctionEvents } from '../fixture';
import { useEffect, useState } from 'react';
import { applyEvent, initialDeal, reconcileDeal } from '../deal';
import { money, recordedMode, recordedOrder } from '../fixture';
import { Action, Screen, Unavailable } from '../components/MemberUI';
import DealCard from '../components/DealCard';
import { apiUrl, checkedEvent, loadSession, orderHref, paymentComplete, request, type PublicDealEvent } from '../connected';
import { useOrder } from '../order-state';
import PayPalApproval from '../components/PayPalApproval';
export default function Deal() { return recordedMode() ? <AuctionPlayback events={auctionEvents} maximum={11882} country={recordedOrder.country} id={recordedOrder.id} paid /> : <ConnectedDeal />; }
function ConnectedDeal() {
  const value = useOrder();
  return value.order && isAuction(value.order.events) ? <ConnectedAuction order={value.order} refresh={value.refresh} /> : <ExchangeDeal value={value} />;
}
function ExchangeDeal({ value }: { value: ReturnType<typeof useOrder> }) {
  const { id, order, error, refresh } = value;
  const [state, setState] = useState<ReturnType<typeof initialDeal> | null>(null);
  const [playing, setPlaying] = useState(true), [replaying, setReplaying] = useState(false);
  const [queue, setQueue] = useState<PublicDealEvent[]>([]), [connection, setConnection] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [clientId, setClientId] = useState('');
  useEffect(() => {
    if (order?.payment_state !== 'AWAITING_APPROVAL') return;
    loadSession().then(session => setClientId(session.paypal_client_id)).catch(error => setConnection(error.message));
  }, [order?.payment_state]);
  useEffect(() => {
    if (!order || state) return;
    try {
      const start = initialDeal(order.checkout.lines, order.maximum_minor);
      if (new URLSearchParams(location.search).get('replay') === '1') { setState(start); setQueue(order.events); setReplaying(true); }
      else setState(order.events.reduce(applyEvent, start));
    }
    catch (error) { setConnection((error as Error).message); }
  }, [order, state]);
  useEffect(() => {
    if (!order || !state || replaying) return;
    setQueue(previous => {
      const missing = order.events.filter(event => !state.applied.includes(event.id) && !previous.some(value => value.id === event.id));
      return missing.length ? [...previous, ...missing] : previous;
    });
  }, [order, state, replaying]);
  useEffect(() => {
    if (!order || replaying || order.payment_state === 'VOIDED' || order.events.some(event => event.kind === 'done')) return;
    const last = Math.max(0, ...order.events.map(event => event.seq));
    const stream = new EventSource(apiUrl(`/orders/${encodeURIComponent(order.id)}/deal/stream?after=${last}`), { withCredentials: true });
    stream.onopen = () => setConnection('');
    stream.onerror = () => setConnection('Connection interrupted. Rally is reconnecting; your deal keeps running.');
    const receive = (message: MessageEvent) => {
      try { const event = checkedEvent(JSON.parse(message.data), order.maximum_minor); if (event.kind === 'start' && event.v === 3) { stream.close(); value.setOrder({ ...order, events: [event] }); return; } if (event.kind === 'done') stream.close(); setQueue(previous => previous.some(value => value.id === event.id) ? previous : [...previous, event]); }
      catch (error) { setConnection((error as Error).message); stream.close(); }
    };
    stream.addEventListener('deal', receive as EventListener);
    stream.addEventListener('status', () => { stream.close(); refresh(); });
    return () => stream.close();
  }, [order?.id, order?.payment_state, replaying]);
  useEffect(() => {
    if (!playing || !queue.length || !state) return;
    const timer = setTimeout(() => {
      try { setState(previous => previous && applyEvent(previous, queue[0])); }
      catch (error) { setConnection((error as Error).message); }
      if (queue[0].kind === 'done' && !replaying) refresh();
      setQueue(previous => previous.slice(1));
    }, 600);
    return () => clearTimeout(timer);
  }, [queue, playing, state, replaying]);
  useEffect(() => {
    if (!order || paymentComplete(order) || ['VOIDED', 'NEEDS_REVIEW'].includes(order.payment_state)) return;
    const timer = setInterval(refresh, 2000); return () => clearInterval(timer);
  }, [order?.id, order?.payment_state]);
  if (!id) return <Unavailable />;
  if (!order || !state) return <Screen title="Your order"><h1>Your deal</h1><p role="status">{error || connection || 'Loading your deal…'}</p>{(error || connection) && <button className="text-link" onClick={refresh}>Try again</button>}</Screen>;
  function replay() { setState(initialDeal(order!.checkout.lines, order!.maximum_minor)); setQueue(order!.events); setPlaying(true); setReplaying(true); }
  const paid = paymentComplete(order), canceled = order.payment_state === 'VOIDED';
  const view = reconcileDeal(state, order);
  return <Screen title={`Order ${order.id}`}><div className="deal-progress"><h1>{canceled ? 'Order canceled' : order.payment_state === 'CANCELLING' ? 'Canceling your order' : order.payment_state === 'AWAITING_APPROVAL' ? 'Complete PayPal approval' : order.payment_state === 'APPROVING' ? 'Confirming your PayPal hold' : view.done ? 'Deal done' : playing ? `Rally is talking to ${Object.keys(view.shops).length} shops` : 'Updates paused'}</h1><div className="playback-controls"><span className="clock money">{view.done ? `${view.elapsed} seconds` : `0:${String(Math.floor(view.elapsed)).padStart(2, '0')}`}</span>{!view.done && !canceled && <button className="text-link playback-toggle" onClick={() => setPlaying(!playing)}>{playing ? 'Pause updates' : 'Resume updates'}</button>}</div></div>{!playing && <p className="fine" role="status">{replaying ? 'Only the replay is paused. Your saved order is unchanged.' : 'Only your view is paused. Rally keeps working on your deal.'}</p>}<p className="fine order-context">{order.country} · {order.currency} · order choices saved at checkout{replaying ? ' · replay' : ''}</p><p className="muted">Your total, all in</p><div className="total-display"><AnimatedTotal amount={view.totalUsd} currency={order.currency} settled={view.done} />{view.totalUsd < order.maximum_minor && <del className="money">{money(order.maximum_minor, order.currency)}</del>}</div><p className="hold-line">{order.payment_state === 'CANCELLING' ? 'Rally is confirming cancellation with PayPal. We’ll show the result here.' : order.payment_state === 'AWAITING_APPROVAL' ? 'PayPal has not placed a hold yet. Complete approval before Rally starts your deal.' : order.payment_state === 'APPROVING' ? 'Rally is confirming your PayPal approval. Your deal starts after the hold is confirmed.' : order.payment_state === 'NEEDS_REVIEW' ? 'Your payment result is being checked. Keep this order number.' : canceled ? 'Rally canceled your PayPal hold. You have not been charged. Your bank’s release timing varies.' : paid ? `You paid ${money(order.charged_minor!, order.currency)}. The remaining ${money(order.uncaptured_minor, order.currency)} was not captured. PayPal’s release timing varies.` : view.done ? 'Your deal is complete. Rally is confirming your payment with PayPal.' : `PayPal is holding ${money(order.maximum_minor, order.currency)}. You pay the final price, never more.`}</p>{order.payment_state === 'NEEDS_REVIEW' && <p role="alert">Your payment needs a check. Please keep this order number; Rally will confirm the result here.</p>}{(connection || error) && <p role="status">{connection || error}</p>}{order.payment_state === 'AWAITING_APPROVAL' && <>{clientId && order.bag_id && <PayPalApproval clientId={clientId} currency={order.currency} resumeOnly createOrder={async () => { throw new Error('Return to your bag to start checkout.'); }} approveOrder={async paypalId => { await request(`/bags/${order.bag_id}/checkout/approve`, { method: 'POST', body: { order_id: paypalId } }); refresh(); }} onError={setConnection} />}<Action to="/bag">Return to checkout</Action></>}<div className="track-legend"><span><i className="legend-rally" />Rally’s offer</span><span><i className="legend-shop" />Shop’s price</span><span><i className="legend-save" />You save</span></div>{Object.values(view.shops).map(shop => <DealCard key={shop.id} value={shop} country={order.country} />)}{paid && view.done && <Action to={orderHref('/paid', order.id)}>See your order</Action>}{view.done && <button className="text-link centered" onClick={replay}>Watch the deal again</button>}{!replaying && ['AWAITING_APPROVAL', 'AUTHORIZED', 'NEGOTIATING'].includes(order.payment_state) && <button className="text-link centered" disabled={canceling} onClick={async () => {
    setCanceling(true);
    try { await request(`/orders/${order.id}/cancel`, { method: 'POST', body: {} }); refresh(); }
    catch (error) { setConnection((error as Error).message); }
    finally { setCanceling(false); }
  }}>{canceling ? 'Canceling order…' : 'Cancel order'}</button>}</Screen>;
}
