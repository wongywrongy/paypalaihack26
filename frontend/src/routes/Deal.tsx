import { useEffect, useState } from 'react';
import { applyEvent, initialDeal, recordedDealSource } from '../deal';
import { type ShopId, events, finalLines, hero, href, landed, listedLines, local, money, recordedMode, recordedOrder } from '../fixture';
import { Action, Screen, Unavailable } from '../components/MemberUI';
import DealCard from '../components/DealCard';
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const listener = () => setReduced(media.matches); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, []);
  return reduced;
}
function AnimatedTotal({ amount, currency }: { amount: number; currency: 'USD'|'CAD'|'GBP'|'EUR'|'AUD' }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(amount);
  useEffect(() => {
    if (reduced) { setShown(amount); return; }
    const start = performance.now(), from = shown;
    let frame: number;
    const tick = (now: number) => { const progress = Math.min(1, (now - start) / 500); setShown(Math.round(from + (amount - from) * progress)); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount, reduced]);
  return <><strong className="hero-money money" aria-hidden="true">{money(shown, currency)}</strong><span className="sr-only" role="status">Your total, all in: {money(amount, currency)}</span></>;
}
export default function Deal() { return recordedMode() ? <RecordedDeal /> : <Unavailable />; }
function RecordedDeal() {
  const country = recordedOrder.country;
  const [state, setState] = useState(initialDeal);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || state.done) return;
    return recordedDealSource(event => setState(previous => applyEvent(previous, event)), state.applied.length);
  }, [playing, state.done]);
  const checkout = landed(listedLines, country);
  const currentLines = state.shops.dalbit?.accepted ? finalLines : state.shops.bada?.accepted ? [...listedLines, finalLines.find(line => line.added)!] : listedLines;
  const exact = state.done || state.shops.dalbit?.accepted ? landed(finalLines, country, 50) : state.shops.bada?.accepted ? landed(currentLines, country) : checkout;
  function replay() { setState(initialDeal()); setPlaying(true); }
  return <Screen title="Order RL-24817"><div className="deal-progress"><h1>{state.done ? 'Deal done' : playing ? 'Rally is talking to 2 shops' : 'Deal paused'}</h1><span className="clock money">{state.done ? `${state.elapsed} seconds` : `0:${String(state.elapsed).padStart(2,'0')}`}</span></div><p className="fine order-context">{recordedOrder.destination} · {recordedOrder.currency} · order choices saved at checkout</p><p className="muted">Your total, all in</p><div className="total-display"><AnimatedTotal amount={exact.total} currency={exact.currency} />{exact.total < checkout.total && <del className="money">{money(checkout.total, checkout.currency)}</del>}</div><p className="hold-line">{state.done ? `You pay ${money(exact.total, exact.currency)}. PayPal releases the other ${money(checkout.total - exact.total, exact.currency)}.` : `PayPal is holding ${money(checkout.total, checkout.currency)}. You pay the final price, never more.`}</p><div className="track-legend"><span><i className="legend-rally" />Rally’s offer</span><span><i className="legend-shop" />Shop’s price</span><span><i className="legend-save" />You save</span></div>{(['dalbit','bada'] as ShopId[]).map(id => <DealCard key={id} value={state.shops[id]!} country={country} />)}{state.done ? <><Action to="/paid">See your order</Action><button className="text-link centered" onClick={replay}>Watch the deal again</button></> : <button className="text-link centered" onClick={() => setPlaying(!playing)}>{playing ? 'Pause deal' : 'Resume deal'}</button>}</Screen>;
}
