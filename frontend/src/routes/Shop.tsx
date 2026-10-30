import { Icon } from '../components/Controls';
import MarketRange from '../components/MarketRange';
import { useState } from 'react';
import { allowed, catalog, cents, countries, href, money, price, recordedMode, shops, type Currency, type Product } from '../fixture';
import { Action, Photo, Screen } from '../components/MemberUI';
import { useBag } from '../state';
import ShipTo from './ShipTo';
export default function Shop({ sheet = false }: { sheet?: boolean }) {
  const { bag, setBag, setNotice, store, storeError, retryStore } = useBag();
  const products = recordedMode() ? catalog : store?.products || [];
  const [category, setCategory] = useState('All');
  const [open, setOpen] = useState(sheet);
  const categories = ['All', ...new Set(products.map(item => item.category))];
  function add(item: Product) {
    if (bag.items.includes(item.id)) { setNotice(`${item.name} is already in your bag.`); return; }
    if (bag.items.length === 8) { setNotice('Your bag can hold eight different items. Remove one to add another.'); return; }
    setBag({ ...bag, items: [...bag.items, item.id] }); setNotice(`${item.name} added to your bag.`);
  }
  return <Screen wide><button className="destination" onClick={() => setOpen(true)} aria-haspopup="dialog">Ship to {countries[bag.country].name} · {countries[bag.country].currency}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button><div className="shop-intro"><h1>Korean skincare,<br />straight from Seoul.</h1><p>{products.length ? `${products.length} products from ${store ? Object.keys(store.shops).length : 3} Korean shops.` : 'Choose your skincare.'} One box, one price in your currency, nothing to pay at your door.</p></div>{store?.facts && <p className="market-facts">Shops bid on {store.facts.completed_orders} completed orders · typical saving {store.facts.median_saving_bp / 100}% vs the checkout hold</p>}<a className="ask-bar" href={href('/ask')}>Ask for a routine: “dry, sensitive skin”<span aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></svg></span></a>{!recordedMode() && !store && <p role="status">{storeError || 'Loading your Korean shops…'}</p>}{storeError && <button className="button secondary small" onClick={retryStore}><Icon name="refresh" size={15} />Try again</button>}<nav className="categories" aria-label="Product categories">{categories.map(name => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</nav><div className="section-heading"><h2>{category === 'All' ? 'Find your next favorite' : category}</h2><span>{products.filter(item => category === 'All' || item.category === category).length} products</span></div><ul className="catalog">{products.filter(item => category === 'All' || item.category === category).map((item, index) => {
    const available = 'available' in item ? !!item.available : allowed(item, bag.country), inBag = bag.items.includes(item.id);
    return <li key={item.id}><Photo item={item} priority={index < 4} /><div className="tile-copy"><span className="brand">{item.brand}</span><h3>{item.name}</h3><small>{item.size}</small><div className="tile-price"><strong className="money">{'price' in item ? item.price === null ? 'Unavailable' : 'from ' + money(item.price as number, countries[bag.country].currency as Currency) : 'from ' + price(Math.min(...Object.values(item.prices).map(value => cents(value!))), bag.country)}</strong><span>{Object.keys(item.prices).length} shops</span></div><MarketRange reference={item.market} />{'low_stock' in item && (item.low_stock as { shop: keyof typeof shops; stock: number }[]).map(row => <p className="fine low-stock" key={row.shop}>Only {row.stock} left at {shops[row.shop].name}</p>)}<button className="add-product" disabled={!available || inBag} onClick={() => add(item)} aria-label={`${inBag ? 'In bag' : 'Add'} ${item.name}`}>{!available ? item.aerosol ? 'Cannot ship by air' : item.not_to?.includes(bag.country) ? `Not available in ${bag.country}` : 'Out of stock' : inBag ? 'In your bag' : 'Add to bag'}</button></div></li>;
  })}</ul><Action to={bag.items.length ? '/bag' : '/ask'}>{bag.items.length ? `View bag · ${bag.items.length} ${bag.items.length === 1 ? 'item' : 'items'}` : 'Find my routine'}</Action>{open && <ShipTo onClose={() => setOpen(false)} />}</Screen>;
}
