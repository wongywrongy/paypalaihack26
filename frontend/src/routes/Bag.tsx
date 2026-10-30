import { Icon } from '../components/Controls';
import { useEffect, useRef, useState } from 'react';
import { countries, money, quote, recordedMode } from '../fixture';
import { Action, Breakdown, Photo, ProductRows, Screen } from '../components/MemberUI';
import { useBag } from '../state';
import PayPalApproval from '../components/PayPalApproval';
import { loadSession, orderHref, rememberOrder, request, saveBag, type Checkout, type Order, type ServerBag } from '../connected';
export default function Bag() {
  const { bag, setBag, store } = useBag();
  const [server, setServer] = useState<{ key: string; value: ServerBag } | null>(null);
  const [clientId, setClientId] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const bagId = useRef<string | undefined>(undefined);
  const key = JSON.stringify(bag);
  useEffect(() => {
    if (recordedMode() || !bag.items.length) return;
    const controller = new AbortController(); setError('');
    Promise.all([saveBag(bag, controller.signal, bagId.current), loadSession()]).then(([value, session]) => {
      if (!controller.signal.aborted) { bagId.current = value.id; setServer({ key, value }); setClientId(session.paypal_client_id); }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [key, retry]);
  const value = recordedMode() ? quote(bag.items, bag.country) : server?.value.quote;
  const current = server?.key === key;
  if (!bag.items.length) return <Screen title="Bag" back="/shop"><h1>A good routine<br />starts here.</h1><p>Your bag is empty. Find your favorites or start with a four-step routine.</p><Action to="/shop">Explore the shop</Action></Screen>;
  if (!value) return <Screen title="Bag" back="/shop"><h1>Your skincare.<br />One box.</h1><p role="status">{error || 'Finding your all-in price…'}</p>{error && <><ul className="product-rows">{bag.items.map(id => { const item = store?.products.find(item => item.id === id); return <li key={id}>{item && <Photo item={item} />}<div className="product-copy"><strong>{item?.name || id}</strong><button className="icon-button remove" aria-label={`Remove ${item?.name || 'item'}`} onClick={() => setBag({ ...bag, items: bag.items.filter(item => item !== id) })}><Icon name="x" size={16} /></button></div></li>; })}</ul><button className="primary" onClick={() => setRetry(value => value + 1)}>Refresh your bag</button></>}</Screen>;
  return <Screen title={`Bag · ${bag.items.length} ${bag.items.length === 1 ? 'item' : 'items'}`} back="/shop"><h1>Your skincare.<br />One box.</h1><section className="shop-group bag-list bag-item"><ProductRows beforeBidding lines={value.lines} country={bag.country} remove={id => setBag({ ...bag, items: bag.items.filter(item => item !== id) })} /></section><div className="delivery-card"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></svg><p className="delivery-note"><strong>One box from Seoul to {countries[bag.country].region || countries[bag.country].name}</strong>Duty and tax are included before it ships.</p></div><fieldset className="rules"><legend>Let Rally get a better price</legend><label><input type="checkbox" role="switch" checked={bag.rules.old_packaging_ok} onChange={event => setBag({ ...bag, rules: { ...bag.rules, old_packaging_ok: event.target.checked } })} /><span><strong>Older packaging</strong><small>Same formula, if it costs less</small></span></label><label><input type="checkbox" role="switch" checked={bag.rules.bundles_ok} onChange={event => setBag({ ...bag, rules: { ...bag.rules, bundles_ok: event.target.checked } })} /><span><strong>Bundles</strong><small>One shop can price two of your items together</small></span></label></fieldset><section className="total-card"><div className="checkout-total"><h2>Total, all in</h2><strong className="money">{!recordedMode() && !current ? "Updating…" : money(value.breakdown.total, value.breakdown.currency)}</strong></div><Breakdown value={value.breakdown} /></section><div className="actions">{recordedMode() ? <><button className="primary" disabled>Checkout unavailable</button><p className="fine">Your bag and choices are saved.</p></> : <>{error && <p role="alert">{error}</p>}{!current ? <p role="status">Updating your all-in price…</p> : clientId ? <PayPalApproval clientId={clientId} currency={value.breakdown.currency} createOrder={async () => {
    const checkout = await request<Checkout>(`/bags/${server!.value.id}/checkout`, { method: 'POST', body: { quote_id: server!.value.quote.id } });
    return { orderId: checkout.paypal_order_id };
  }} approveOrder={async orderId => {
    const order = await request<Order>(`/bags/${server!.value.id}/checkout/approve`, { method: 'POST', body: { order_id: orderId } });
    rememberOrder(order.id); location.assign(orderHref('/deal', order.id));
  }} onError={setError} /> : <p>PayPal checkout is unavailable. Your bag and choices are saved.</p>}<p className="fine">PayPal holds {money(value.breakdown.total, value.breakdown.currency)}. Shops can only bid it down.</p><button className="button secondary small" onClick={() => setRetry(value => value + 1)}><Icon name="refresh" size={15} />Refresh your price</button></>}</div></Screen>;
}
