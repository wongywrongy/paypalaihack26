import { money, type MarketReference } from '../fixture';
export default function MarketRange({ reference }: { reference?: MarketReference | null }) {
  if (!reference || !Number.isSafeInteger(reference.median_usd_cents) || reference.median_usd_cents <= 0 || reference.n < 5) return null;
  if (reference.low_usd_cents !== undefined && reference.high_usd_cents !== undefined && reference.high_usd_cents * 2 > reference.low_usd_cents * 5) return null;
  return <p className="fine market-range" title={`Comparable US products · ${reference.n} prices · ${reference.as_of}`}>Typical US price <span className="money">{money(reference.median_usd_cents, 'USD').replace(/\.00$/, '')}</span></p>;
}
