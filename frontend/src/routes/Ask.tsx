import { hero, href, money, localizeNote, product, quote, shops } from '../fixture';
import { Action, Photo, Screen } from '../components/MemberUI';
import { useBag } from '../state';
const reasons = ['A gentle first cleanse.', 'A light layer of hydration.', 'An essence for dry-feeling skin.', 'Finish with a barrier cream.'];
export default function Ask() {
  const { bag, setBag } = useBag();
  const routine = quote(hero.cart, bag.country);
  const mergedItems = [...new Set([...bag.items, ...hero.cart])];
  const excess = mergedItems.length - 8;
  return <Screen title="Ask Rally" back="/shop"><h1>A little care,<br />picked for you.</h1><blockquote className="request-bubble">{localizeNote(hero.request, bag.country)}</blockquote><h2>A gentle four-step routine from two shops.</h2><p className="muted">Each item matched with a Korean shop.</p><ol className="routine">{routine.lines.map((line, index) => <li key={line.id}><Photo item={product(line.id)} /><div><span className="routine-step">{['Cleanse', 'Tone', 'Treat', 'Moisturize'][index]}</span><h3>{product(line.id).brand} {product(line.id).name}</h3><p>{reasons[index]}</p><small>{shops[line.shop].name} · {product(line.id).size}</small></div></li>)}</ol><p className="delivery-note">Bada Market only ships inside Korea. We collect your items at our Seoul hub and send everything in one box.</p><div className="checkout-total"><span>Routine, all in, delivered</span><strong className="money">{money(routine.breakdown.total, routine.breakdown.currency)}</strong></div>{excess > 0 ? <div className="actions"><button className="primary" disabled aria-describedby="routine-limit">Add routine to bag</button><p className="fine" id="routine-limit">This routine would make {mergedItems.length} items. Your bag can hold eight. Remove {excess} {excess === 1 ? 'item' : 'items'} before adding it.</p><a className="text-link" href={href('/bag')}>Edit bag</a></div> : <Action to="/bag" onClick={() => setBag({ ...bag, items: mergedItems })}>Add routine to bag</Action>}</Screen>;
}
