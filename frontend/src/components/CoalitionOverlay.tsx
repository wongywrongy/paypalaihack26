import { useEffect, useState } from "react";
import { api, money, type ProductContext, type Status, type Config } from "../api";
import Icon from "./Icon";
import { NumberTicker } from "./magicui/number-ticker";

export default function CoalitionOverlay({ context, config, ready, initialError, status, onStatus, requestEntry }: {
  context: ProductContext; config: Config | null; ready: boolean; initialError: string;
  status: Status | null; onStatus: (status: Status) => void;
  requestEntry: boolean;
}) {
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const key = JSON.stringify(context);
  useEffect(() => {
    setAvailable(false);
    setError("");
    if (!ready) return;
    let ignore = false;
    api<Status & { available: boolean }>("/opportunity", context).then(data => {
      if (!ignore) { setAvailable(data.available); if (data.available) onStatus(data); }
    }).catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
    // The exact product selection is the eligibility boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  const matches = status && context.product_id === status.offer.product_id && context.selected_variant === status.offer.variant && context.quantity === status.offer.quantity;
  if (ready && !error && !available) return <div className="no-opportunity"><Icon name="users" /><span>No exact group offer for this selection.</span>{requestEntry && <a href={"/?product="+encodeURIComponent(context.product_id)+"&run="+encodeURIComponent(new URLSearchParams(location.search).get("run")||"")}>Evaluate this product with your requirements</a>}</div>;
  const offer = matches && available ? status.offer : null;
  const price = offer ? money(offer.total_minor) : "—";
  const joined = !!status?.commitment;
  return <section className="merchant-widget" aria-label="Coalition group offer">
    <div className="checkout-brand-row"><div className="coalition-brand"><span className="coalition-symbol"><Icon name="users" size={20} /></span><strong>coalition<span className="brand-period">.</span></strong></div><span className="checkout-label">Buy together</span></div>
    <div className="widget-price"><strong>{price}</strong><span>per buyer</span>{offer && status?.ordinary_price_minor !== undefined && <b>Save {money(Math.max(0, status.ordinary_price_minor - offer.total_minor))}</b>}</div>
    <div className="widget-count">{offer ? <><strong><NumberTicker value={status!.confirmed_count} /> of {offer.capacity} committed</strong><span>Confirmed authorizations</span></> : "Checking group offer…"}</div>
    {offer ? <a className="coalition-button" href={"/checkout?run=" + encodeURIComponent(status!.group.run_id)}>{joined ? "View your checkout" : status!.group.status === "OPEN" && status!.confirmed_count < offer.capacity ? `Join for ${price}` : "View group progress"}<Icon name="arrow" size={18} /></a> : <button className="coalition-button" disabled>Checking offer…</button>}
    <p className="approval-caption"><Icon name="shield" size={14} />{offer?.tier_schedule ? "Approve the maximum. Settle at closing." : "Approve a hold. Pay when the group fills."}</p>
    <p className="widget-disclosure">{config?.mode === "fixture" ? "Fixture demo · simulated payments" : "PayPal sandbox · test payments"}</p>
    {(error || initialError) && <p className="error-message" role="alert">{error || initialError}</p>}
  </section>;
}
