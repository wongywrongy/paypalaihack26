import { useState } from 'react';
import { fixture as f, money } from '../fixture';
import { Arrow, Photo, Screen } from '../components/MemberUI';
export default function Ask() {
  const [choice, setChoice] = useState('new');
  const [answered, setAnswered] = useState(false);
  return <Screen back="/live" title={`${f.question.member}’s question`}><h1>Same formula.<br />Old bottle for less?</h1><p className="intro">{f.question.member}, it’s your choice. Your order stays the same unless you say so.</p><fieldset className="bottle-options"><legend className="sr-only">Choose your bottle</legend>{f.products.slice(0, 2).map((product, index) => <label key={product.id} className={choice === (index ? 'old' : 'new') ? 'selected' : ''}><Photo product={product} /><strong>{index ? 'Old bottle' : 'New bottle'}</strong><span className="money">{money(index ? f.question.oldPrice : f.question.newPrice)}</span><span className="muted">{index ? 'Same formula' : 'Your original pick'}</span><input name="bottle" type="radio" value={index ? 'old' : 'new'} checked={choice === (index ? 'old' : 'new')} onChange={event => setChoice(event.target.value)} disabled={answered} /></label>)}</fieldset>
    <p className="explanation">Switching saves {money(f.question.newPrice - f.question.oldPrice)} before duty and tax. Prices may still move a little.</p>
    <footer className="actions">{answered ? <><p role="status">{choice === 'new' ? 'You kept the new bottle.' : 'You chose the old bottle for this preview. The example deal still shows Aisha’s original answer: keep new.'}</p><button className="text-link change-choice" onClick={() => setAnswered(false)}>Change this preview choice</button><a href="/live" className="primary">Back to the example deal<Arrow /></a></> : <><button className="primary" onClick={() => setAnswered(true)}>{choice === 'new' ? 'Keep the new bottle' : 'Switch to the old bottle'}<Arrow /></button><p className="fine">No answer in {f.question.minutes} minutes keeps the new bottle.</p></>}</footer>
  </Screen>;
}
