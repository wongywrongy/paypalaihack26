import { useEffect, useRef, useState } from 'react';
import { allowed, countryCodes, countries, hero, money, quote, rates, recordedMode, type CountryCode } from '../fixture';
import { useBag } from '../state';
import { checkedQuote, request, type Quote } from '../connected';
export default function ShipTo({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { bag, setBag, setNotice, store, destinations } = useBag();
  const [selected, setSelected] = useState<CountryCode>(bag.country);
  const [quotes, setQuotes] = useState<Partial<Record<CountryCode, Quote>>>({});
  const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    if (recordedMode() || !bag.items.length) return;
    const controller = new AbortController();
    Promise.all(countryCodes.map(async country => {
      const items = bag.items.filter(id => { const item = store?.products.find(item => item.id === id); return item && allowed(item, country); });
      const result = checkedQuote(await request<Quote>('/quotes', { method: 'POST', body: { country, items, rules: bag.rules }, signal: controller.signal }));
      return [country, result] as const;
    })).then(values => setQuotes(Object.fromEntries(values))).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [store]);
  function done() {
    const retained = bag.items.filter(id => {
      if (!recordedMode()) { const item = store?.products.find(item => item.id === id); return item && allowed(item, selected); }
      try { return quote([id], selected).lines.length > 0; } catch { return false; }
    });
    const removed = bag.items.length - retained.length;
    setBag({ ...bag, country: selected, items: retained });
    setNotice(removed ? `${removed} item${removed === 1 ? '' : 's'} removed because it cannot ship to ${countries[selected].name}.` : `Shipping to ${countries[selected].name}. Prices are in ${countries[selected].currency}.`);
    ref.current?.close();
  }
  return <dialog ref={ref} className="ship-sheet" aria-labelledby="ship-title" onClose={onClose}><div className="sheet-header"><h1 id="ship-title">Ship to</h1><button className="close" aria-label="Close ship to" onClick={() => ref.current?.close()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div><p>{bag.items.length ? 'Your bag, all in, in each country.' : 'Choose your destination.'} Duty and tax are included before your order ships.</p><fieldset><legend className="sr-only">Destination country</legend>{countryCodes.map(code => {
    const ids = (recordedMode() ? (bag.items.length ? bag.items : hero.cart) : bag.items).filter(id => { try { return quote([id], code).lines.length > 0; } catch { return false; } });
    const total = recordedMode() ? quote(ids, code).breakdown : quotes[code]?.breakdown;
    const destination = destinations.find(item => item.code === code);
    return <label className={`country-option ${selected === code ? 'selected' : ''}`} key={code}><input type="radio" name="country" value={code} checked={selected === code} onChange={() => setSelected(code)} /><span><strong>{destination?.name || countries[code].name}</strong><small>{destination?.summary || (recordedMode() ? rates[code].summary : countries[code].currency)}</small></span><strong className="money">{total ? money(total.total, total.currency) : bag.items.length ? '…' : countries[code].currency}</strong></label>;
  })}</fieldset>{error && <p role="status">Country prices could not load. You can still choose where to ship.</p>}<p className="fine">Import duty and tax are estimates. You pay in your chosen currency.</p><div className="actions"><button className="primary" onClick={done} disabled={!recordedMode() && !store}>Done</button></div></dialog>;
}
