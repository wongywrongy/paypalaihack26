import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { orderNumber, request, type Session } from '../../connected';
import { money, shops, type ShopId } from '../../fixture';
import type { MerchantOrder, ShopProduct, ListingChange } from '../../shop-api';
import { ConfirmMenu, Icon, Notice, type IconName } from '../../components/Controls';
import Access from './Access';
import GoalsForm from './GoalsForm';
import Activity from './Activity';
import Home from './Home';
import OrdersView, { payoutPill } from './OrdersView';
const ProductsGrid = lazy(() => import('./ProductsGrid'));

export type Tab = 'home' | 'orders' | 'products' | 'settings' | 'payouts' | 'activity';
type Data = { session: Session; orders: MerchantOrder[]; products: ShopProduct[]; changes: ListingChange[] };
const tabs: { key: Tab; label: string; icon: IconName; path: string; sub: string }[] = [
  { key: 'home', label: 'Home', icon: 'home', path: '/shops', sub: 'Your agent bids for you on every Rally order that includes your products.' },
  { key: 'orders', label: 'Orders', icon: 'orders', path: '/shops/orders', sub: 'Hand off what you won. PayPal pays you right after.' },
  { key: 'products', label: 'Products', icon: 'products', path: '/shops/products', sub: 'Shoppers and other shops never see your lowest prices or costs.' },
  { key: 'settings', label: 'Agent', icon: 'agent', path: '/shops/settings', sub: 'Tell your agent what you want. It bids only inside these rules.' },
  { key: 'activity', label: 'Activity', icon: 'activity', path: '/shops/activity', sub: 'Your last 20 auctions, from saved bids and awards.' },
  { key: 'payouts', label: 'Payouts', icon: 'payouts', path: '/shops/payouts', sub: 'PayPal sandbox payouts in USD, sent after each hand-off.' },
];

export default function Console({ tab }: { tab: Tab }) {
  const [data, setData] = useState<Data | null>(null), [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    request<Session>('/session', { signal: controller.signal }).then(async session => {
      if (session.role !== 'shop' || !session.shop_id) { setSignedIn(false); return; }
      setSignedIn(true);
      const path = `/shops/${session.shop_id}`;
      const [orders, products] = await Promise.all([
        request<{ orders: MerchantOrder[] }>(path + '/orders', { signal: controller.signal }),
        request<{ products: ShopProduct[]; changes?: ListingChange[] }>(path + '/products', { signal: controller.signal }),
      ]);
      setData({ session, orders: orders.orders, products: products.products, changes: products.changes || [] });
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (tab !== 'orders' || !data?.session.shop_id) return;
    const controller = new AbortController(), shop = data.session.shop_id;
    const timer = setInterval(() => { request<{ orders: MerchantOrder[] }>(`/shops/${shop}/orders`, { signal: controller.signal }).then(value => setData(current => current ? { ...current, orders: value.orders } : current)).catch(error => { if (!controller.signal.aborted) setError(error.message); }); }, 2000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [tab, data?.session.shop_id]);
  if (signedIn === false) return <Access />;
  const refresh = () => setRevision(value => value + 1);
  const shop = data?.session.shop_id as ShopId | undefined;
  const readOnly = !!data?.session.read_only;
  const current = tabs.find(item => item.key === tab)!;
  const awaiting = data?.orders.filter(order => order.payout.status === 'awaiting_handoff' && order.payment_state === 'CHARGED' && order.lines.length).length || 0;
  async function signOut() { try { await request('/logout', { method: 'POST', body: {} }); location.assign('/shops'); } catch (error) { setError((error as Error).message); } }
  async function reset() { try { await request(`/shops/${shop}/reset`, { method: 'POST', body: {} }); refresh(); } catch (error) { setError((error as Error).message); } }
  const resetMenu = shop && !readOnly && (tab === 'home' || tab === 'products' || tab === 'settings') ? <ConfirmMenu label="More shop actions" title="Reset to launch settings?" body="Restores your listings and your agent’s rules. Orders and payouts stay as they are." confirm="Reset" onConfirm={reset} /> : null;
  let body: ReactNode = null;
  if (data && shop) body = tab === 'home' ? <Home shop={shop} revision={revision} />
    : tab === 'orders' ? <OrdersView orders={data.orders} shop={shop} readOnly={readOnly} refresh={refresh} />
    : tab === 'products' ? <Suspense fallback={<p role="status">Loading product grid…</p>}><ProductsGrid rows={data.products} changes={data.changes} shop={shop} readOnly={readOnly} refresh={refresh} /></Suspense>
    : tab === 'activity' ? <Activity shop={shop} />
    : tab === 'settings' ? <GoalsForm shop={shop} readOnly={readOnly} />
    : <Payouts orders={data.orders} />;
  return <div className="shop-app">
    <aside className="shop-sidebar">
      <a href="/shops" className="wordmark">rally<span>.</span><small>for shops</small></a>
      {shop && <div className="shop-identity"><span className="shop-avatar" aria-hidden="true">{shops[shop].name[0]}</span><span><strong>{shops[shop].name}</strong><small>{shops[shop].city} · {shops[shop].kind}</small></span></div>}
      <nav aria-label="Shop workspace">{tabs.map(item => <a key={item.key} href={item.path} aria-current={tab === item.key ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.key === 'orders' && awaiting > 0 && <span className="nav-badge" aria-label={`${awaiting} to hand off`}>{awaiting}</span>}</a>)}</nav>
      <div className="sidebar-foot">
        <a className="button secondary" href="/shop"><Icon name="store" /><span className="wide-only">View storefront</span><span className="narrow-only">Store</span><Icon name="external" size={15} /></a>
        <div className="account-row"><span className="test-mode">Test mode</span>{signedIn && <button type="button" className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><Icon name="logout" size={17} /></button>}</div>
      </div>
    </aside>
    <main className="shop-main">
      <header className="page-head"><div><h1>{current.label}</h1><p>{current.sub}</p></div>{resetMenu}</header>
      {error && <Notice onRetry={refresh}>{error}</Notice>}
      {!data ? !error && <p role="status" className="loading">Loading your workspace…</p> : <>{readOnly && <p className="status-note">Your account is read-only.</p>}{body}</>}
    </main>
  </div>;
}

function Payouts({ orders }: { orders: MerchantOrder[] }) {
  const rows = orders.filter(order => order.payout.status !== 'outbid');
  const paid = rows.filter(order => order.payout.status === 'completed').reduce((sum, order) => sum + order.payout.amount_minor, 0);
  return <div className="stack">
    <section className="card stat-card"><span>Paid to you by PayPal</span><strong className="money">{money(paid, 'USD')}</strong><small>{rows.filter(order => order.payout.status === 'completed').length} payouts completed</small></section>
    <section className="card list-card">{rows.length ? <ul className="row-list">{rows.map(order => <li key={order.id}><a href={`/shops/orders?order=${encodeURIComponent(order.id)}`}><span className="row-main"><strong className="money">{orderNumber(order.id)}</strong><small>{order.country} · {order.lines.length} {order.lines.length === 1 ? 'item' : 'items'}</small></span>{payoutPill(order)}<span className="money row-amount">{order.payout.status === 'awaiting_handoff' ? '—' : money(order.payout.amount_minor, 'USD')}</span></a></li>)}</ul> : <p className="empty">No payouts yet. Win an order and hand it off to get paid.</p>}</section>
  </div>;
}

