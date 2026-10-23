import { useEffect, useRef, useState } from 'react';
import { allowed, countryCodes, countries, hero, money, quote, rates, type CountryCode } from '../fixture';
import { useBag } from '../state';
export default function ShipTo({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { bag, setBag, setNotice } = useBag();
  const [selected, setSelected] = useState<CountryCode>(bag.country);
  useEffect(() => { ref.current?.showModal(); }, []);
  function done() {
    const retained = bag.items.filter(id => { try { return quote([id], selected).lines.length > 0; } catch { return false; } });
    const removed = bag.items.length - retained.length;
    setBag({ ...bag, country: selected, items: retained });
    setNotice(removed ? `${removed} item${removed === 1 ? '' : 's'} removed because it cannot ship to ${countries[selected].name}.` : `Shipping to ${countries[selected].name}. Prices are in ${countries[selected].currency}.`);
    ref.current?.close();
  }
  return <dialog ref={ref} className="ship-sheet" aria-labelledby="ship-title" onClose={onClose}><div className="sheet-header"><h1 id="ship-title">Ship to</h1><button className="close" aria-label="Close ship to" onClick={() => ref.current?.close()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div><p>{bag.items.length ? 'Your bag' : 'A four-step routine'}, all in, in each country. Duty and tax are included before it ships.</p><fieldset><legend className="sr-only">Destination country</legend>{countryCodes.map(code => {
    const ids = (bag.items.length ? bag.items : hero.cart).filter(id => { try { return quote([id], code).lines.length > 0; } catch { return false; } });
    const total = quote(ids, code).breakdown;
    return <label className={`country-option ${selected === code ? 'selected' : ''}`} key={code}><input type="radio" name="country" value={code} checked={selected === code} onChange={() => setSelected(code)} /><span><strong>{countries[code].name}</strong><small>{rates[code].summary}</small></span><strong className="money">{money(total.total, total.currency)}</strong></label>;
  })}</fieldset><p className="fine">Import duty and tax are estimates. You pay in your chosen currency.</p><div className="actions"><button className="primary" onClick={done}>Done</button></div></dialog>;
}
