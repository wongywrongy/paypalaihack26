import { useEffect, useRef, useState } from 'react';
import { money } from '../fixture';
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const listener = () => setReduced(media.matches); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, []);
  return reduced;
}
// Counts toward `amount` with an ease-out. `from` lets a receipt count down from the hold once.
export default function AnimatedTotal({ amount, currency, settled, from }: { amount: number; currency: 'USD'|'CAD'|'GBP'|'EUR'|'AUD'; settled: boolean; from?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(from ?? amount);
  const shownRef = useRef(shown);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (reduced || (settled && from === undefined)) { shownRef.current = amount; setShown(amount); return; }
    const start = performance.now(), origin = shownRef.current, duration = 900;
    if (origin === amount) return;
    setMoving(true);
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(origin + (amount - origin) * eased);
      shownRef.current = value; setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick); else setMoving(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount, reduced, settled]);
  return <><strong className={`hero-money money${moving ? ' counting' : ''}`} aria-hidden="true">{money(shown, currency)}</strong><span className="sr-only" role="status">Your total, all in: {money(amount, currency)}</span></>;
}
