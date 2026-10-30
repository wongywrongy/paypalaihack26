import React, { useState } from 'react';
import { hero, href, money, localizeNote, product, quote, recordedMode, shops } from '../fixture';
import { Action, Photo, Screen } from '../components/MemberUI';
import { useBag } from '../state';
import { checkedQuote, request, type Routine } from '../connected';
const reasons = ['A gentle first cleanse.', 'A light layer of hydration.', 'An essence for dry-feeling skin.', 'Finish with a barrier cream.'];
export default function Ask() { return recordedMode() ? <RecordedAsk /> : <ConnectedAsk />; }
function RecordedAsk() {
  const { bag, setBag } = useBag();
  const routine = quote(hero.cart, bag.country);
  const mergedItems = [...new Set([...bag.items, ...hero.cart])];
  const excess = mergedItems.length - 8;
  return <Screen title="Ask Rally" back="/shop"><h1>A little care,<br />picked for you.</h1><blockquote className="request-bubble">{localizeNote(hero.request, bag.country)}</blockquote><h2>A gentle four-step routine from two shops.</h2><p className="muted">Each item matched with a Korean shop.</p><ol className="routine">{routine.lines.map((line, index) => <li key={line.id} style={{ '--i': index } as React.CSSProperties}><Photo item={product(line.id)} /><div><span className="routine-step">{['Cleanse', 'Tone', 'Treat', 'Moisturize'][index]}</span><h3>{product(line.id).brand} {product(line.id).name}</h3><p>{reasons[index]}</p><small>{shops[line.shop].name} · {product(line.id).size}</small></div></li>)}</ol><section className="total-card routine-total"><p className="delivery-note">Bada Market only ships inside Korea. We collect your items at our Seoul hub and send everything in one box.</p><div className="checkout-total"><span>Routine, all in, delivered</span><strong className="money">{money(routine.breakdown.total, routine.breakdown.currency)}</strong></div></section>{excess > 0 ? <div className="actions"><button className="primary" disabled aria-describedby="routine-limit">Add routine to bag</button><p className="fine" id="routine-limit">This routine would make {mergedItems.length} items. Your bag can hold eight. Remove {excess} {excess === 1 ? 'item' : 'items'} before adding it.</p><a className="button secondary small" href={href('/bag')}>Edit bag</a></div> : <Action to="/bag" onClick={() => setBag({ ...bag, items: mergedItems })}>Add routine to bag</Action>}</Screen>;
}
function ConnectedAsk() {
  const { bag, setBag, store } = useBag();
  const [text, setText] = useState(''), [routine, setRoutine] = useState<Routine | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await request<Routine>('/assist', { method: 'POST', body: { text, country: bag.country, rules: bag.rules } }); checkedQuote(result.quote); setRoutine(result); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const merged = [...new Set([...bag.items, ...(routine?.items.map(item => item.id) || [])])];
  return <Screen title="Ask Rally" back="/shop"><h1>A little care,<br />picked for you.</h1><form onSubmit={submit} className="request-form"><label htmlFor="routine-request">What would you like your routine to do?</label><textarea id="routine-request" value={text} onChange={event => setText(event.target.value)} placeholder="Dry, sensitive skin. A gentle four-step routine." required minLength={3} maxLength={1000} rows={3} /><button className={routine ? 'text-link' : 'primary'} disabled={busy}>{busy ? 'Finding your routine…' : routine ? 'Ask again' : 'Find my routine'}</button></form>{error && <p role="alert">{error}</p>}{routine && <><blockquote className="request-bubble">{routine.request || text}</blockquote><h2>Your routine, from Korean shops.</h2><ol className="routine">{routine.items.map((line, index) => {
    const item = store?.products.find(item => item.id === line.id);
    if (!item) return null;
    return <li key={line.id} style={{ '--i': index } as React.CSSProperties}><Photo item={item} /><div><span className="routine-step">{line.step || `Step ${index + 1}`}</span><h3>{item.brand} {item.name}</h3><p>{line.reason}</p><small>{(store?.shops[line.shop] || shops[line.shop]).name} · {item.size}</small></div></li>;
  })}</ol><section className="total-card routine-total"><p className="delivery-note">We collect your items at our Seoul hub and send everything in one box.</p><div className="checkout-total"><span>Routine, all in, delivered</span><strong className="money">{money(routine.quote.breakdown.total, routine.quote.currency)}</strong></div></section>{merged.length > 8 ? <><button className="primary" disabled>Add routine to bag</button><p>This routine would make {merged.length} items. Your bag can hold eight. Remove {merged.length - 8} {merged.length - 8 === 1 ? 'item' : 'items'} before adding it.</p><a href="/bag" className="text-link">Edit bag</a></> : <Action to="/bag" onClick={() => setBag({ ...bag, items: merged })}>Add routine to bag</Action>}</>}</Screen>;
}
