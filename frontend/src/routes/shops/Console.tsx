import { lazy, Suspense, useEffect, useState } from 'react';
import { Action } from '../../components/MemberUI';
import DealCard from '../../components/DealCard';
import { applyEvent, initialDeal, reconcileDeal } from '../../deal';
import { request, type Session } from '../../connected';
import { money, shops, type Line, type ShopId } from '../../fixture';
import type { AgentSettings, MerchantOrder, ShopProduct } from '../../shop-api';
import Access from './Access';
const ProductsGrid = lazy(() => import('./ProductsGrid'));
type Data = { session: Session; orders: MerchantOrder[]; products: ShopProduct[]; settings: AgentSettings };
export default function Console({ tab }: { tab: 'orders' | 'products' | 'settings' | 'payouts' }) {
  const [data, setData] = useState<Data | null>(null), [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    request<Session>('/session', { signal: controller.signal }).then(async session => {
      if (session.role !== 'shop' || !session.shop_id) { setSignedIn(false); return; }
      setSignedIn(true);
      const path = `/shops/${session.shop_id}`;
      const [orders, products, settings] = await Promise.all([
        request<{ orders: MerchantOrder[] }>(path + '/orders', { signal: controller.signal }),
        request<{ products: ShopProduct[] }>(path + '/products', { signal: controller.signal }),
        request<AgentSettings>(path + '/settings', { signal: controller.signal }),
      ]);
      setData({ session, orders: orders.orders, products: products.products, settings });
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [revision]);
  if (signedIn === false) return <Access />;
  const refresh = () => setRevision(value => value + 1);
  return <main className="workspace"><header className="shop-header"><a href="/shop" className="wordmark">rally<span>.</span><small>for shops</small></a><nav aria-label="Shop workspace">{(['orders', 'products', 'payouts', 'settings'] as const).map(key => <a key={key} href={`/shops/${key}`} aria-current={tab === key ? 'page' : undefined}>{key === 'settings' ? 'Agent settings' : key[0].toUpperCase() + key.slice(1)}</a>)}</nav>{data && <strong>{shops[data.session.shop_id!].name}</strong>}<span className="test-mode">Test mode</span>{signedIn && <button className="text-link" onClick={async () => { try { await request('/logout', { method: 'POST', body: {} }); location.assign('/shops/orders'); } catch (error) { setError((error as Error).message); } }}>Sign out</button>}</header><h1>{tab === 'settings' ? 'Agent settings' : tab[0].toUpperCase() + tab.slice(1)}</h1>{error && <p role="alert">{error}</p>}{!data ? <><p role="status">{error ? 'Your workspace could not load.' : 'Loading your workspace…'}</p>{error && <button className="text-link" onClick={refresh}>Try again</button>}</> : <>{data.session.read_only && <p className="status-note">Your account is read-only.</p>}{tab === 'orders' ? <><p>Your agent works within your prices. PayPal pays you when your parcel reaches the Seoul hub.</p>{!data.orders.length && <p>No orders yet. New Rally orders will appear here.</p>}{data.orders.map(order => <MerchantOrderCard key={order.id} order={order} shop={data.session.shop_id!} readOnly={!!data.session.read_only} refresh={refresh} />)}</> : tab === 'products' ? <><p className="privacy-note">Lowest prices and costs are private. Shoppers and Rally’s buying agent never see them. Prices are in USD.</p><p className="table-scroll-hint fine">Scroll sideways to see all private prices.</p><Suspense fallback={<p role="status">Loading product grid…</p>}><ProductsGrid rows={data.products} /></Suspense></> : tab === 'settings' ? <SettingsForm shop={data.session.shop_id!} value={data.settings} readOnly={!!data.session.read_only} /> : <><p>Shop payouts are in USD and begin after your parcel reaches the Seoul hub.</p><ul className="order-history">{data.orders.map(order => <li className="shop-group" key={order.id}><h2>Order {order.id}</h2>{order.payout.status !== 'awaiting_handoff' && <strong className="money">{money(order.payout.amount_minor, 'USD')}</strong>}<p>{order.payout.status === 'awaiting_handoff' ? 'Awaiting hand-off to the hub' : order.payout.status.replaceAll('_', ' ')}</p></li>)}</ul>{!data.orders.length && <p>No payouts yet.</p>}</>}</>}</main>;
}
function MerchantOrderCard({ order, shop, readOnly, refresh }: { order: MerchantOrder; shop: ShopId; readOnly: boolean; refresh: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const extended = order as MerchantOrder & { checkout_lines?: Line[]; lowest?: Record<string, number> };
  const initial = initialDeal(extended.checkout_lines || order.lines, Number.MAX_SAFE_INTEGER);
  const received = order.events.reduce(applyEvent, initial);
  const terminal = ['CHARGED', 'REFUND_PENDING', 'REFUNDED'].includes(order.payment_state);
  const state = reconcileDeal({ ...received, done: terminal }, { ...order, checkout: { lines: extended.checkout_lines || order.lines } }).shops[shop];
  async function handoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await request(`/shops/${shop}/orders/${order.id}/handoff`, { method: 'POST', body: { carrier: fields.get('carrier'), tracking: fields.get('tracking') } }); setStatus('Hand-off saved. Your PayPal payout status updates here.'); refresh(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="order-sheet"><div className="section-heading"><div><h2>Order {order.id}</h2><p>{order.country} · {order.payment_state.replaceAll('_', ' ')}</p></div>{order.gain_minor !== undefined && <span className="money saving">{money(order.gain_minor, order.gain_currency || order.currency)} over your lowest prices</span>}</div><div className="order-columns"><div>{state && <DealCard value={state} country={order.country} floors={extended.lowest} />}<p>{order.payout.status === 'awaiting_handoff' ? 'Your payout begins after hand-off to the hub.' : <>PayPal payout: <strong className="money">{money(order.payout.amount_minor, 'USD')}</strong> · {order.payout.status.replaceAll('_', ' ')}</>}</p>{order.payment_state === 'CHARGED' && <form className="request-form" onSubmit={handoff}><label htmlFor={`carrier-${order.id}`}>Carrier to Seoul hub</label><input id={`carrier-${order.id}`} name="carrier" required maxLength={64} disabled={readOnly || busy} /><label htmlFor={`tracking-${order.id}`}>Tracking number</label><input id={`tracking-${order.id}`} name="tracking" required maxLength={64} disabled={readOnly || busy} /><button className="primary" disabled={readOnly || busy}>{busy ? 'Saving hand-off…' : 'Mark handed to the hub'}</button></form>}{error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}</div><section className="messages"><h2>Messages</h2><ol>{order.events.filter(event => event.note).map(event => <li key={event.id} className={`agent-message ${event.actor === 'rally' ? 'rally-message' : ''}`}><strong>{event.actor === 'rally' ? 'Rally' : 'Your agent'} · {event.t}s</strong><p>{event.note}</p></li>)}</ol></section></div></section>;
}
function SettingsForm({ shop, value, readOnly }: { shop: ShopId; value: AgentSettings; readOnly: boolean }) {
  const [settings, setSettings] = useState(value), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('');
    try { await request(`/shops/${shop}/settings`, { method: 'PATCH', body: settings }); setStatus('Your agent settings are saved.'); }
    catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="request-form" onSubmit={save}><p>Your agent works within these limits and never goes below your lowest prices.</p><label htmlFor="maximum-discount">Maximum discount (%)</label><input id="maximum-discount" type="number" min={0} max={30} step={1} required value={settings.discount_bp / 100} disabled={readOnly || busy} onChange={event => setSettings({ ...settings, discount_bp: Number(event.target.value) * 100 })} /><label className="checkbox-field"><input type="checkbox" checked={settings.sample_kit} disabled={readOnly || busy} onChange={event => setSettings({ ...settings, sample_kit: event.target.checked })} />Offer a sample kit when the order qualifies</label><button className="primary" disabled={readOnly || busy}>{busy ? 'Saving…' : 'Save agent settings'}</button><p role="status">{status}</p></form>;
}
