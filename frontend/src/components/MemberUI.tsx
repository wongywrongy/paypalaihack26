import MarketRange from './MarketRange';
import React, { useState, type ReactNode } from 'react';
import { currency, href, money, price, product, recordedMode, shops, type Breakdown as Costs, type CountryCode, type Line, type Product } from '../fixture';
import { useBag } from '../state';
import { request } from '../connected';
export function Arrow({ back = false }: { back?: boolean }) { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={back ? 'm14 6-6 6 6 6M8 12h12' : 'M4 12h15m-5-6 6 6-6 6'} /></svg>; }
export function Photo({ item, older = false, priority = false }: { item: Product; older?: boolean; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const fallback = item.category === 'Cleanser' ? 'cleanser' : item.category === 'Toner' ? 'toner' : item.category === 'Moisturizer' || item.category === 'Eye' || item.category === 'Lip' ? 'cream' : item.category === 'Mask' || item.category === 'Care' ? 'masks' : item.category === 'Essence' ? older ? 'essence-old' : 'essence' : 'serum';
  return <img className="product-photo" src={failed ? `/assets/product-fallback/${fallback}.svg` : `/assets/products/${item.id}${older ? '-older' : ''}.png`} onError={() => setFailed(true)} alt={`${item.brand} ${item.name}, ${item.size}${older ? ', older packaging' : ''}`} loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'auto'} width="320" height="320" />;
}
export function Header({ title, back }: { title?: string; back?: string }) {
  const { bag } = useBag();
  return <header className="header">{back ? <a href={href(back)} className="back" aria-label="Go back"><Arrow back /></a> : <a href={href('/shop')} className="wordmark">rally<span aria-hidden="true">.</span></a>}{title && <span className="header-title">{title}</span>}<span className="test-mode">Test mode</span>{!title && <a className="bag-link" href={href('/bag')} aria-label={`Bag, ${bag.items.length} ${bag.items.length === 1 ? 'item' : 'items'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 7h14l-1 14H6L5 7Zm4 0V5a3 3 0 0 1 6 0v2" /></svg><span key={bag.items.length} className="bag-count">{bag.items.length}</span></a>}</header>;
}
export function SiteFooter() {
  const { setBag, setNotice } = useBag(); const [busy, setBusy] = useState(false);
  async function reset() {
    setBusy(true);
    try {
      if (!recordedMode()) await request('/reset', { method: 'POST', body: {} });
      setBag({ country: 'US', items: [], rules: { old_packaging_ok: true, bundles_ok: true } });
      location.assign(href('/shop'));
    } catch (error) { setNotice((error as Error).message); setBusy(false); }
  }
  return <footer className="site-footer"><a href="/orders">Your orders</a><a href="/shops/orders">Sell on Rally</a><button className="text-link" onClick={reset} disabled={busy}>{busy ? 'Clearing bag…' : 'Start over'}</button><a href="/assets/dependency-notices.txt">Licenses</a></footer>;
}
export function Screen({ children, title, back, wide = false }: { children: ReactNode; title?: string; back?: string; wide?: boolean }) { const { notice } = useBag(); return <main className={wide ? 'shop-screen' : 'member'}><Header title={title} back={back} /><div className="screen-content">{notice && <p className="status-note" role="status">{notice}</p>}{children}</div><SiteFooter /></main>; }
export function Action({ to, children, onClick }: { to?: string; children: ReactNode; onClick?: () => void }) { return <div className="actions">{to ? <a className="primary" href={href(to)} onClick={onClick}>{children}<Arrow /></a> : <button className="primary" onClick={onClick}>{children}<Arrow /></button>}</div>; }
export function Breakdown({ value }: { value: Costs }) { return <details className="breakdown"><summary>See breakdown</summary><dl>{(['goods', 'domestic', 'shipping', 'duty', 'tax', 'fee'] as const).map((key, index) => <div key={key}><dt>{['Items', 'Shipping in Korea', 'Shipping to you', 'Import duty (est.)', 'Tax (est.)', 'Rally fee'][index]}</dt><dd className="money">{money(value[key], value.currency)}</dd></div>)}<div className="total-row"><dt>Total</dt><dd className="money">{money(value.total, value.currency)}</dd></div></dl></details>; }
export function ProductRows({ lines, country, remove, aside }: { lines: Line[]; country: CountryCode; remove?: (id: string) => void; aside?: (line: Line) => ReactNode }) {
  const { store } = useBag();
  return <ul className="product-rows">{lines.map((line, index) => {
    const item = store?.products.find(item => item.id === line.id) || product(line.id);
    return <li key={line.id} style={{ '--i': index } as React.CSSProperties}><Photo item={item} older={line.variant === 'older'} /><div className="product-copy"><strong>{item.name}</strong><span>{item.brand} · {item.size}</span><small>{(store?.shops[line.shop] || shops[line.shop]).name}{line.variant === 'older' ? ' · Older packaging' : ''}{line.bundle ? ' · Bundle' : ''}{line.added ? ' · added for free shipping' : ''}</small><MarketRange reference={item.market} />{remove && <button className="text-link remove" aria-label={`Remove ${item.name}`} onClick={() => remove(line.id)}>Remove</button>}</div><span className="item-side"><span className="money item-price">{line.bestListed !== undefined && line.bestListed > line.unit && <del>{recordedMode() ? price(line.bestListed, country) : money(line.bestListed, currency(country))}</del>}{recordedMode() ? price(line.unit, country) : money(line.unit, currency(country))}</span>{aside && <small className="item-aside">{aside(line)}</small>}</span></li>;
  })}</ul>;
}
export function Unavailable({ title = 'Your order is not available', shop = false }: { title?: string; shop?: boolean }) { return <Screen title={shop ? 'Rally for shops' : 'Your order'} back="/shop"><h1>{title}</h1><p>{shop ? 'Sign in to your shop account to see orders, products and agent settings.' : 'Complete checkout to see your order here.'}</p><Action to="/shop">Back to the shop</Action></Screen>; }

export function PaymentStrip({ hold, charged, code }: { hold: number; charged: number; code: import('../fixture').Currency }) {
  return <dl className="payment-strip">{[['PayPal held', hold], ['Charged', charged], ['Released', hold - charged]].map(([label, amount], index) => <div key={label} className={index === 2 ? 'released' : ''} style={{ '--i': index } as React.CSSProperties}><dt>{label}</dt><dd className="money">{money(amount as number, code)}</dd></div>)}</dl>;
}
