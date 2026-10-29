import { money, type MarketReference } from '../fixture';
export default function MarketRange({ reference }: { reference?: MarketReference | null }) {
  if (!reference || !Number.isSafeInteger(reference.low_usd_cents) || !Number.isSafeInteger(reference.high_usd_cents) || reference.low_usd_cents <= 0 || reference.high_usd_cents < reference.low_usd_cents) return null;
  const low = money(reference.low_usd_cents, 'USD').replace(/\.00$/, '');
  const high = money(reference.high_usd_cents, 'USD').replace(/^\$/, '').replace(/\.00$/, '');
  return <p className="fine market-range" title={`Comparable US products · ${reference.n} prices · ${reference.as_of}`}>US market <span className="money">{low}–{high}</span></p>;
}
