import { useEffect, useRef, useState } from 'react';
import { fixture as f, money } from '../fixture';
import { Arrow, Photo, Screen } from '../components/MemberUI';

export default function Ask() {
  const [choice, setChoice] = useState('new');
  const [answered, setAnswered] = useState(false);
  const interacted = useRef(false);
  const continuation = useRef<HTMLAnchorElement>(null);
  const newBottle = useRef<HTMLInputElement>(null);
  const oldBottle = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!interacted.current) return;
    if (answered) continuation.current?.focus();
    else (choice === 'old' ? oldBottle : newBottle).current?.focus();
  }, [answered, choice]);

  const answer = choice === 'new'
    ? 'You kept the new bottle.'
    : 'You chose the old bottle for this preview. The example deal still shows Aisha’s original answer: keep new.';

  return <Screen back="/live" title={`${f.question.member}’s question`}>
    <h1>Same formula.<br />Old bottle for less?</h1>
    <p className="intro">{f.question.member}, it’s your choice. Your order stays the same unless you say so.</p>
    <fieldset className="bottle-options">
      <legend className="sr-only">Choose your bottle</legend>
      {f.products.slice(0, 2).map((product, index) => {
        const value = index ? 'old' : 'new';
        const label = index ? 'Old bottle' : 'New bottle';
        return <label key={product.id} className={choice === value ? 'selected' : ''}>
          <Photo product={product} />
          <strong>{label}</strong>
          <span id={`${value}-price`} className="money">{money(index ? f.question.oldPrice : f.question.newPrice)}</span>
          <span id={`${value}-detail`} className="muted">{index ? 'Same formula' : 'Your original pick'}</span>
          <input ref={index ? oldBottle : newBottle} name="bottle" type="radio" value={value}
            aria-label={label} aria-describedby={`${value}-price ${value}-detail`}
            checked={choice === value} onChange={event => setChoice(event.target.value)} disabled={answered} />
        </label>;
      })}
    </fieldset>
    <p className="explanation">Switching saves {money(f.question.newPrice - f.question.oldPrice)} before duty and tax. Prices may still move a little.</p>
    <footer className="actions">
      <p id="answer-status" role="status" aria-atomic="true">{answered ? answer : ''}</p>
      {answered ? <>
        <button className="text-link change-choice" onClick={() => setAnswered(false)}>Change this preview choice</button>
        <a ref={continuation} href="/live" className="primary" aria-describedby="answer-status">Back to the example deal<Arrow /></a>
      </> : <>
        <button className="primary" onClick={() => { interacted.current = true; setAnswered(true); }}>
          {choice === 'new' ? 'Keep the new bottle' : 'Switch to the old bottle'}<Arrow />
        </button>
        <p className="fine">No answer in {f.question.minutes} minutes keeps the new bottle.</p>
      </>}
    </footer>
  </Screen>;
}
