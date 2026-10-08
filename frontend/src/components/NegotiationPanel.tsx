import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { money, type Negotiation, type NegotiationRound, type Product, type Terms } from "../api";
import Icon from "./Icon";
import { AnimatedBeam } from "./magicui/animated-beam";
import { AnimatedList } from "./magicui/animated-list";

function date(value: string | undefined) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString(undefined, { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : null;
}

export default function NegotiationPanel({ product, negotiation, rounds: received, offer, compatible, authorized, run, ready, busy, closed, hasCommitment, shared = false, onNegotiate, onAdjust, onChoose }: {
  product: Product; negotiation: Negotiation | null; rounds: NegotiationRound[]; offer: Terms | null;
  compatible: number | undefined; authorized: number; run?: string; ready: boolean; busy: boolean;
  closed: boolean; hasCommitment: boolean; shared?: boolean; onNegotiate: () => void; onAdjust: () => void; onChoose: () => void;
}) {
  const reduced = useReducedMotion();
  const rounds = useMemo(() => [...new Map(received.map(r => [r.id, r])).values()].sort((a, b) => a.sequence - b.sequence), [received]);
  const [beam, setBeam] = useState<NegotiationRound | null>(null);
  const observed = useRef<{ id: string | null | undefined; seen: Set<number>; pending: NegotiationRound[] }>({ id: undefined, seen: new Set(), pending: [] });
  const container = useRef<HTMLDivElement>(null), buyer = useRef<HTMLSpanElement>(null), merchant = useRef<HTMLSpanElement>(null);
  const transcript = useRef<HTMLDetailsElement>(null);
  const active = negotiation?.state === "negotiating" || ["queued", "running"].includes(negotiation?.status || "");
  const state = offer ? "agreed" : active ? "negotiating" : negotiation?.state === "agreed" ? "ready" : negotiation?.state || "ready";
  const merchantName = product.public_policy?.merchant || product.brand;
  const buyerName = shared ? "Group buying agent" : "Your buying agent";
  useEffect(() => {
    const id = negotiation?.id || null;
    if (observed.current.id !== id) {
      const restoring = observed.current.id === undefined;
      observed.current = { id, seen: new Set(restoring ? rounds.map(r => r.id) : []), pending: [] };
      setBeam(null);
      if (restoring) return;
    }
    for (const round of rounds) {
      if (observed.current.seen.has(round.id)) continue;
      observed.current.seen.add(round.id);
      if (!reduced && round.valid && round.tiers.length && ["offered", "countered", "accepted"].includes(round.action)) observed.current.pending.push(round);
    }
    if (reduced) { observed.current.pending = []; setBeam(null); }
    else if (!beam && observed.current.pending.length) setBeam(observed.current.pending.shift()!);
  }, [negotiation?.id, rounds, reduced, beam]);
  useEffect(() => { if (active && transcript.current) transcript.current.open = true; }, [active, negotiation?.id]);
  const phase = negotiation?.phase || "preparing";
  const status = state === "agreed" ? "Agreement reached · payment approval still needed"
    : state === "declined" ? "No agreement reached"
    : state === "interrupted" ? "Negotiation interrupted"
    : state === "negotiating" ? phase === "waiting_for_merchant" ? "Waiting for the merchant" : phase === "evaluating_offer" ? "Evaluating the merchant offer" : "Preparing your offer"
    : "Your agent is ready to negotiate";
  const lower = offer?.tier_schedule?.at(-1);
  const changed = rounds.filter(r => r.valid && r.action === "countered");
  const merchantAccepted = rounds.some(r => r.speaker === "merchant" && r.action === "accepted");
  const summary = changed.length ? `${changed.length} counteroffer${changed.length === 1 ? "" : "s"}; tier prices changed, purchase requirements stayed fixed.` : merchantAccepted ? `The merchant accepted ${shared ? "the group agent’s" : "your agent’s"} offer within its published ranges.` : "Both agents agreed to the merchant’s validated terms.";
  return <section className="negotiation-panel" aria-label="Agent negotiation" data-state={state}>
    <div className="agent-connection" ref={container} data-active-round={beam?.id}>
      <span ref={buyer}>{buyerName}</span><Icon name="arrow" size={16}/><span ref={merchant}>{merchantName}’s agent</span>
      {beam && !reduced && <AnimatedBeam key={beam.id} containerRef={container} fromRef={buyer} toRef={merchant} reverse={beam.speaker === "merchant"} duration={.5} repeat={0} pathColor="transparent" gradientStartColor="#4338ca" gradientStopColor="#4338ca" onAnimationComplete={() => setBeam(null)}/>}
    </div>
    <p className="negotiation-status" role="status" aria-live="polite" aria-atomic="true">{status}</p>
    <p className="interest-count">{compatible === undefined ? "Compatible interest being checked" : `${compatible} compatible request${compatible === 1 ? "" : "s"}`} · {authorized} payments authorized</p>
    <p className="progress-note">Interest is not a payment commitment.</p>
    {shared && <p className="progress-note">You matched an existing negotiated agreement. Review its terms before approving payment.</p>}
    {state === "ready" && <>
      {product.public_policy && <p className="indicative-price">Indicative group range {money(product.public_policy.ranges[0][0])}–{money(product.public_policy.ranges[0][1])}. At least {product.public_policy.thresholds[0]} authorizations needed. No price agreed yet.</p>}
      <button className="coalition-button" onClick={onNegotiate} disabled={!ready || busy}>Negotiate for me<Icon name="arrow" size={17}/></button>
      {!ready && <p className="progress-note">Check your requirements above to find a compatible offer.</p>}
    </>}
    {offer && <motion.div className="negotiated-agreement" initial={reduced ? false : { opacity: .75 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .2 }}>
      <h3>Agreement reached</h3>
      <div className="agreement-price"><strong>{money(offer.total_minor)}</strong><span>accepted maximum per person · {offer.currency}</span></div>
      <p>{money(Math.max(0, product.price_minor - offer.total_minor))} less than the simulated list price.</p>
      {lower && lower.total_each_cents < offer.total_minor && <p className="conditional-price">Could drop to <strong>{money(lower.total_each_cents)}</strong> with {lower.minimum_buyers} authorizations — an additional {money(offer.total_minor - lower.total_each_cents)} saved.</p>}
      <ul className="shopping-logistics"><li><Icon name="users" size={18}/><span>Minimum {offer.minimum} authorizations needed · capacity {offer.capacity}</span></li><li><Icon name="truck" size={18}/><span>Shipping included{date(offer.delivery_by) ? ` · delivery by ${date(offer.delivery_by)}` : ""}</span></li>{date(offer.close_at) && <li><Icon name="clock" size={18}/><span>Closes {date(offer.close_at)}</span></li>}</ul>
      <p className="agreement-summary">{summary}</p>
      <p className="progress-note">Agent acceptance is not your payment approval. Final payment is confirmed only after settlement.</p>
      <a className="coalition-button" href={`/checkout?run=${run}`}>{hasCommitment ? "View purchase" : closed ? "View closed deal" : "Review agreement & authorize"}<Icon name="arrow" size={17}/></a>
    </motion.div>}
    {(state === "declined" || state === "interrupted") && <div className="negotiation-recovery">
      <p>{state === "declined" ? "Your maximum and the merchant’s permitted terms did not produce an accepted offer." : negotiation?.error_kind === "requirements_changed" ? "Your requirements changed. Check them before another negotiation." : "The exchange could not finish safely. Your requirements and completed rounds are saved."}</p>
      {state === "interrupted" && <button className="coalition-button" disabled={!ready || busy} onClick={onNegotiate}>{negotiation?.error_kind === "provider_failure" ? "Retry connection" : "Retry negotiation"}</button>}
      <div className="recovery-actions"><button className="text-button" onClick={onAdjust}>Adjust requirements</button><button className="text-button" onClick={onChoose}>Choose another product</button></div>
    </div>}
    {(rounds.length > 0 || active) && <details className="negotiation-transcript" ref={transcript}>
      <summary>View negotiation · {rounds.length} exchange{rounds.length === 1 ? "" : "s"}</summary>
      <AnimatedList animate={active || !!beam} className="proposal-list">{rounds.map(round => <article key={round.id} className={`proposal-round ${round.speaker}`} data-round-id={round.id} data-action={round.action}>
        <div className="proposal-heading"><strong>{round.speaker === "buyer" ? buyerName : `${merchantName}’s agent`}</strong><span>{round.action === "invalid" || round.action === "unavailable" ? "No validated offer" : round.action}</span></div>
        {round.tiers.length > 0 && <ul className="proposal-prices">{round.tiers.map(tier => <li key={tier.minimum_buyers}><motion.span key={tier.total_each_cents} initial={reduced ? false : { opacity: .7 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .18 }}><strong>{money(tier.total_each_cents)}</strong> each</motion.span><span>with {tier.minimum_buyers} authorizations</span></li>)}</ul>}
        {round.changes.map(change => <p className="offer-change" key={change.minimum_buyers}>{change.minimum_buyers}-buyer price: {change.from_minor === null ? "New tier" : money(change.from_minor)} → {money(change.to_minor)}</p>)}
        <p>{round.explanation}</p>
      </article>)}</AnimatedList>
      {active && <p className="progress-note">Offers appear as each validated round is saved.</p>}
    </details>}
  </section>;
}
