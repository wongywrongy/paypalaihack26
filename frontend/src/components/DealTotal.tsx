import { useEffect, useState } from 'react';
import { money } from '../fixture';
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const listener = () => setReduced(media.matches); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, []);
  return reduced;
}
export default function AnimatedTotal({ amount, currency, settled }: { amount: number; currency: 'USD'|'CAD'|'GBP'|'EUR'|'AUD'; settled: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(amount);
  useEffect(() => {
    if (reduced || settled) { setShown(amount); return; }
    const start = performance.now(), from = shown;
    let frame: number;
    const tick = (now: number) => { const progress = Math.min(1, (now - start) / 500); setShown(Math.round(from + (amount - from) * progress)); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount, reduced, settled]);
  return <><strong className="hero-money money" aria-hidden="true">{money(settled || reduced ? amount : shown, currency)}</strong><span className="sr-only" role="status">Your total, all in: {money(amount, currency)}</span></>;
}
