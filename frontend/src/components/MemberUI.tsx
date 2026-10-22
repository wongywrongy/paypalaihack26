import type { ReactNode } from 'react';
import { fixture as f, money, type Product } from '../fixture';
export function Arrow({ back = false }: { back?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={back ? 'm14 6-6 6 6 6M8 12h12' : 'M4 12h15m-5-6 6 6-6 6'} /></svg>;
}
export function Photo({ product }: { product: Product }) {
  return <div className={`photo photo-${product.photo}`}><img src="/assets/dalbit-products.png" alt={`Dalbit ${product.name}, ${product.detail}`} width="1254" height="1254" /></div>;
}
export function Products({ agreed = false }: { agreed?: boolean }) {
  return <ul className="products">{(agreed ? f.basket : f.catalog).map(product => <li key={product.id}>
    <Photo product={product} /><div className="product-copy"><strong>{product.name}</strong><span>{agreed && product.id === 'ess_old' ? 'Old bottle · same formula' : `Dalbit · ${product.detail}`}</span></div><span className="money product-price">{money(agreed ? product.agreed : product.list)}</span>
  </li>)}{agreed && <li className="extra"><div className="sample-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 9h16v11H4zM3 6h18v4H3zM12 6v14" /><path d="M12 6C6-2 3 7 12 6Zm0 0c6-8 9 1 0 0Z" /></svg></div><div className="product-copy"><strong>Sample kit</strong><span>Five little things to try</span></div><span className="saving">Free</span></li>}</ul>;
}
export function Breakdown() {
  return <details className="breakdown"><summary>See full breakdown</summary><dl>{f.costs.map(cost => <div key={cost.label}><dt>{cost.label}</dt><dd className="money">{money(cost.cents)}</dd></div>)}<div className="total-row"><dt>Total</dt><dd className="money">{money(f.total)}</dd></div></dl><p className="fine">Duty, customs fee and tax are estimates. If customs costs less, you get the difference back.</p></details>;
}
export function Action({ href, children, note }: { href: string; children: ReactNode; note?: ReactNode }) {
  return <footer className="actions"><a className="primary" href={href}>{children}<Arrow /></a>{note && <p className="fine">{note}</p>}</footer>;
}
export function Header({ back, title }: { back?: string; title?: string }) {
  return <header className="header">{back ? <a className="back" href={back} aria-label="Go back"><Arrow back /></a> : <a className="wordmark" href="/invite">rally<span aria-hidden="true">.</span></a>}{title ? <span className="header-title">{title}</span> : <span className="community">{f.community}</span>}<span className="example">Example</span></header>;
}
export function Screen({ children, back, title, className = '' }: { children: ReactNode; back?: string; title?: string; className?: string }) {
  return <main className={`member ${className}`}><Header back={back} title={title} /><div className="screen-content">{children}</div><p className="preview-note">An example group order. No money moves.</p></main>;
}
