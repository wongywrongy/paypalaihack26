import { useEffect, useRef, useState } from 'react';
import { countries, money, price, cents, quote, recordedMode, shops } from '../fixture';
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
  if (!value) return <Screen title="Bag" back="/shop"><h1>Your skincare.<br />One box.</h1><p role="status">{error || 'Finding your all-in price…'}</p>{error && <><ul className="product-rows">{bag.items.map(id => { const item = store?.products.find(item => item.id === id); return <li key={id}>{item && <Photo item={item} />}<div className="product-copy"><strong>{item?.name || id}</strong><button className="text-link remove" onClick={() => setBag({ ...bag, items: bag.items.filter(item => item !== id) })}>Remove {item?.name || 'item'}</button></div></li>; })}</ul><button className="primary" onClick={() => setRetry(value => value + 1)}>Refresh your bag</button></>}</Screen>;
  const shopIds = [...new Set(value.lines.map(line => line.shop))];
  return <Screen title={`Bag · ${bag.items.length} ${bag.items.length === 1 ? 'item' : 'items'}`} back="/shop"><h1>Your skincare.<br />One box.</h1>{shopIds.map(id => <section className="shop-group" key={id}><div className="section-heading"><h2>{shops[id].name}<small>{shops[id].city}</small></h2><span>{shops[id].ships_abroad ? shops[id].kind : 'Ships inside Korea'}</span></div><ProductRows lines={value.lines.filter(line => line.shop === id)} country={bag.country} remove={id => setBag({ ...bag, items: bag.items.filter(item => item !== id) })} /><p className="fine">{recordedMode() ? <>Shipping in Korea {Number(shops[id].domestic) ? price(cents(shops[id].domestic), bag.country) : 'free'} · free over {price(cents(shops[id].free_over), bag.country)}</> : 'Shipping in Korea is included in your total.'}</p></section>)}<p className="delivery-note">One box from Seoul to {countries[bag.country].region || countries[bag.country].name}. Duty and tax are included before it ships.</p><fieldset className="rules"><legend>Let Rally get a better price</legend><label><input type="checkbox" role="switch" checked={bag.rules.old_packaging_ok} onChange={event => setBag({ ...bag, rules: { ...bag.rules, old_packaging_ok: event.target.checked } })} /><span><strong>Older packaging is fine</strong><small>Same formula, if it costs less</small></span></label><label><input type="checkbox" role="switch" checked={bag.rules.add_small_extras_if_cheaper} onChange={event => setBag({ ...bag, rules: { ...bag.rules, add_small_extras_if_cheaper: event.target.checked } })} /><span><strong>Add a small extra if it lowers my total</strong><small>Like a mask that unlocks free shipping</small></span></label></fieldset><section className="total-card"><div className="checkout-total"><h2>Total, all in</h2><strong className="money">{!recordedMode() && !current ? "Updating…" : money(value.breakdown.total, value.breakdown.currency)}</strong></div><Breakdown value={value.breakdown} /></section><div className="actions">{recordedMode() ? <><button className="primary" disabled>Checkout unavailable</button><p className="fine">Your bag and choices are saved.</p></> : <>{error && <p role="alert">{error}</p>}{!current ? <p role="status">Updating your all-in price…</p> : clientId ? <PayPalApproval clientId={clientId} currency={value.breakdown.currency} createOrder={async () => {
    const checkout = await request<Checkout>(`/bags/${server!.value.id}/checkout`, { method: 'POST', body: { quote_id: server!.value.quote.id } });
    return { orderId: checkout.paypal_order_id };
  }} approveOrder={async orderId => {
    const order = await request<Order>(`/bags/${server!.value.id}/checkout/approve`, { method: 'POST', body: { order_id: orderId } });
    rememberOrder(order.id); location.assign(orderHref('/deal', order.id));
  }} onError={setError} /> : <p>PayPal checkout is unavailable. Your bag and choices are saved.</p>}<p className="fine">PayPal holds {money(value.breakdown.total, value.breakdown.currency)}. You’re charged after Rally’s deal, never more than this.</p><button className="text-link" onClick={() => setRetry(value => value + 1)}>Refresh your price</button></>}</div></Screen>;
}
