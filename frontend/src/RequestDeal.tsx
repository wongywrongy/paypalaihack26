import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { api, money, type Config, type Product, type Status } from "./api";
import { AnimatedBeam } from "./components/magicui/animated-beam";
import { AnimatedList } from "./components/magicui/animated-list";
import { NumberTicker } from "./components/magicui/number-ticker";

interface Constraints { max_total_minor: number; latest_arrival: string; required_features: string[]; device: string | null; flexibility: string[] }
interface Journey {
  request: { id: string; raw_text: string; status: string; constraints: Constraints | null; error: string | null } | null;
  assessments: { product_id: string; eligible: boolean; available: number; requirements: { requirement: string; verdict: string; rationale: string; source: string }[] }[];
  negotiation: { id: string; status: string; error: string | null } | null;
  rounds: { id: number; role: string; valid: boolean; public_summary: string }[];
  group: { id: string; run_id: string; profile: string; status: string };
  status: Status | null; eligible: boolean; compatible_count: number; products: Product[];
}
const initial = "Noise-canceling headphones for flights, under $100, works with my iPhone 12. I can wait a week.";

export default function RequestDeal() {
  const [config,setConfig]=useState<Config|null>(null), [data,setData]=useState<Journey|null>(null), [error,setError]=useState("");
  const [raw,setRaw]=useState(initial),[edits,setEdits]=useState<Constraints|null>(null),[selected,setSelected]=useState(new URLSearchParams(location.search).get("product")||""),[busy,setBusy]=useState(false);
  const [beam,setBeam]=useState<string|false>(false);
  const container=useRef<HTMLDivElement>(null),buyer=useRef<HTMLSpanElement>(null),merchant=useRef<HTMLSpanElement>(null),previous=useRef<number|null>(null);
  const reduced=useReducedMotion();
  const form=useRef<HTMLFormElement>(null);
  async function refresh() { const next=await api<Journey>("/journey");setData(next);return next; }
  async function boot() {
    setError("");
    try {
      const c=await api<Config>("/config");setConfig(c);
      const params=new URLSearchParams(location.search);
      const s=await api<{run_id:string}>("/session",{run_id:params.get("run")||undefined,invite:params.get("invite")||undefined});
      const url=new URL(location.href);url.searchParams.set("run",s.run_id);url.searchParams.delete("invite");history.replaceState(null,"",url);
      await refresh();
    } catch(e) { setError((e as Error).message); }
  }
  useEffect(()=>{void boot();},[]);
  useEffect(()=>{
    if(!data)return;
    let stopped=false;
    const active=data.request?.status==="queued"||["queued","running"].includes(data.negotiation?.status||"")||data.status&&!['SUCCEEDED','FAILED'].includes(data.status.group.status);
    const timer=setTimeout(()=>{if(!stopped)void refresh().catch(e=>setError(e.message));},active?2000:10000);
    return()=>{stopped=true;clearTimeout(timer);};
  },[data]);
  useEffect(()=>{if(data?.request){setRaw(data.request.raw_text);if(data.request.constraints)setEdits(data.request.constraints);}},[data?.request?.id,data?.request?.status]);
  useEffect(()=>{const a=data?.assessments.find(a=>a.eligible&&a.available>0);if(a&&!selected)setSelected(a.product_id);},[data?.assessments,selected]);
  useEffect(()=>{
    const count=data?.rounds.length??0;
    if(previous.current!==null&&count>previous.current&&!reduced) {
      const emitted=data?.rounds.slice(previous.current).filter(r=>r.valid&&r.public_summary.includes(": Proposed ")).at(-1);
      if(emitted)setBeam(emitted.role);
    }
    previous.current=count;
    const timer=setTimeout(()=>setBeam(false),800);return()=>clearTimeout(timer);
  },[data?.rounds.length,reduced]);
  async function evaluate(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try { await api("/requests",{raw_text:raw,edits:edits||undefined});await refresh(); }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const offer=data?.status?.offer, count=data?.status?.confirmed_count??0;
  const nextTier=offer?.tier_schedule?.find(t=>t.minimum_buyers>count);
  const evaluating=data?.request?.status==="queued";
  const negotiating=["queued","running"].includes(data?.negotiation?.status||"");
  const locked=!!data?.status?.commitment?.active;
  return <div className="request-page">
    <header className="request-header"><a href="/" className="coalition-brand">Coalition</a><nav aria-label="Main"><a href="/how-group-pricing-works">How group pricing works</a><a href={"/shop?product="+encodeURIComponent(offer?.product_id||selected||"cabin-one")+(data?"&run="+data.group.run_id:"")}>Merchant widget</a></nav></header>
    <main>
      <p className="request-disclosure">{config?.mode==="fixture"?"Simulated buyers, merchant offers, AI and payments · fixture demo":"Simulated buyers and merchant offers. Live AI decisions. Real PayPal sandbox operations."} One sandbox business account · no physical fulfillment.</p>
      <h1>Find a group purchase that fits.</h1><p className="request-intro">Tell us what you need. Review the exact agreement before approving a payment.</p>
      {error&&<div role="alert" className="connection-notice"><p>{error}</p><button onClick={()=>void boot()}>Retry connection</button><a href="/operator">Operator controls</a></div>}
      {data?.group.profile==="legacy"&&<p>This is a preserved calculator run. <a href={"/shop?run="+data.group.run_id}>Open its merchant widget</a>. Prepare a headphone run in <a href="/operator">operator controls</a>.</p>}
      <div className="request-layout">
        <section className="requirements-panel" aria-labelledby="requirements-heading"><h2 id="requirements-heading">Your requirements</h2>
          {data?.products.find(p=>p.id===new URLSearchParams(location.search).get("product"))&&<p>Merchant entry: {data.products.find(p=>p.id===new URLSearchParams(location.search).get("product"))!.title} · Graphite · one unit.</p>}
          <form ref={form} onSubmit={evaluate}>
            <label htmlFor="request-text">What are you looking for?</label><textarea id="request-text" value={raw} disabled={locked||negotiating||busy||evaluating} maxLength={1200} minLength={3} required onChange={e=>{setRaw(e.target.value);setEdits(null);}} />
            {edits&&<fieldset disabled={locked||negotiating||busy||evaluating}><legend>Edit extracted requirements</legend>
              <label htmlFor="request-budget">Maximum delivered total · USD</label><input id="request-budget" type="number" min="0.01" max="10000" step="0.01" required value={edits.max_total_minor/100} onChange={e=>setEdits({...edits,max_total_minor:Math.round(Number(e.target.value)*100)})}/>
              <label htmlFor="request-date">Latest arrival · UTC</label><input id="request-date" type="date" required value={edits.latest_arrival} onChange={e=>setEdits({...edits,latest_arrival:e.target.value})}/>
              <label htmlFor="request-device">Required device compatibility</label><input id="request-device" maxLength={80} value={edits.device||""} onChange={e=>setEdits({...edits,device:e.target.value||null})}/>
              {edits.required_features.map((f,i)=><label className="requirement-check" key={f}><input type="checkbox" checked onChange={()=>setEdits({...edits,required_features:edits.required_features.filter((_,j)=>j!==i),flexibility:[...edits.flexibility,"Explicitly removed requirement: "+f]})}/>{f} <small>Uncheck to explicitly relax</small></label>)}
              <p>Flexibility: {edits.flexibility.length?edits.flexibility.join("; "):"None explicitly stated"}</p>
            </fieldset>}
            <button className="coalition-button" disabled={!data||busy||locked||negotiating||data.request?.status==="queued"}>{busy||data?.request?.status==="queued"?"Evaluating requirements…":edits?"Re-evaluate edited requirements":"Find compatible offers"}</button>
          </form>
          {data?.request?.error&&<p role="alert">{data.request.error}</p>}
          {locked&&<p>Your approved agreement is fixed. <a href={"/checkout?run="+data?.group.run_id}>View your saved payment</a>.</p>}
        </section>
        <div className="deal-column">
          {offer&&<section className="accepted-deal" aria-labelledby="accepted-heading"><h2 id="accepted-heading">Accepted quote · version {offer.version}</h2><h3>{offer.title} · {offer.variant}</h3><p>{offer.merchant} · Inventory reserved: {offer.capacity} units</p>
            <div className="deal-price"><strong>{money(offer.total_minor)}</strong><span>maximum authorized total per buyer</span></div>
            <ul className="tier-ladder">{offer.tier_schedule?.map(t=><li key={t.minimum_buyers}><strong>{money(t.total_each_cents)}</strong><span>{t.minimum_buyers} verified authorizations</span></li>)}</ul>
            <p><NumberTicker value={data!.compatible_count}/> compatible requests · <NumberTicker value={count}/> authorized payments</p>
            <div className="tier-progress"><progress aria-label="Verified authorization progress" value={count} max={offer.capacity}/>{offer.tier_schedule?.map(t=><span key={t.minimum_buyers} className="tier-tick" aria-hidden="true" style={{left:`${100*t.minimum_buyers/offer.capacity}%`}}/>)}</div>
            <p>{nextTier?`${nextTier.minimum_buyers-count} more authorizations to reach ${money(nextTier.total_each_cents)}`:"Highest tier reached; final price is selected at closing."}</p>
            <dl><div><dt>Delivery by · simulated</dt><dd>{new Date(offer.delivery_by!).toLocaleString(undefined,{timeZone:"UTC",timeZoneName:"short"})}</dd></div><div><dt>Closes</dt><dd>{new Date(offer.close_at!).toLocaleString(undefined,{timeZone:"UTC",timeZoneName:"short"})}</dd></div></dl>
            {data!.eligible||data!.status?.commitment?<a className="coalition-button" href={"/checkout?run="+data!.group.run_id}>Review exact terms &amp; checkout</a>:<p role="status">This accepted quote does not meet your requirements. Edit your request to explicitly revise them.</p>}
            <p className="small-profile">{data!.group.profile==="small"?"Scaled demo terms: capacity 5, thresholds 3 and 5.":"Illustrative large profile; payment counts are actual recorded authorizations."} Shipping included · simulated tax $0.</p>
          </section>}
          <section className="candidate-offers" aria-labelledby="candidates-heading"><h2 id="candidates-heading">Compatible offers</h2>
            {!data?.assessments.length?<p>{data?.request?.status==="queued"?"Evaluating supplied product evidence…":"Enter your requirements to compare six simulated headphone offers."}</p>:<ul>{data.assessments.map(a=>{const p=data.products.find(p=>p.id===a.product_id)!;return <li key={a.product_id} className={a.eligible?"candidate-compatible":"candidate-excluded"}>
              <div className="candidate-heading"><label><input type="radio" name="offer" value={a.product_id} checked={selected===a.product_id} disabled={!a.eligible||!a.available||!!offer||negotiating||evaluating} onChange={()=>setSelected(a.product_id)}/><strong>{p.title}</strong></label><span>{a.eligible?a.available?"Compatible":"Inventory unavailable":a.requirements.some(r=>r.verdict==="unknown")?"Requirement unknown":"Excluded"}</span></div>
              <p>{p.delivery_days}-day simulated delivery · {a.available} available units · demo retail {money(p.price_minor)}</p>
              <details><summary>Why this offer {a.eligible?"fits":"was excluded"}</summary><ul>{a.requirements.map((r,i)=><li key={i} className={"verdict-"+r.verdict}><strong>{r.requirement}: {r.verdict}</strong><p>{r.rationale}</p><small>Source: {r.source} · catalog version 1</small></li>)}</ul></details>
            </li>;})}</ul>}
          </section>
          <section className="negotiation-panel" aria-labelledby="negotiation-heading"><h2 id="negotiation-heading">Agent negotiation</h2>
            <div ref={container} className="agent-connection"><span ref={buyer}>Buyer agent</span><span ref={merchant}>Merchant agent</span>{beam&&<AnimatedBeam containerRef={container} fromRef={buyer} toRef={merchant} reverse={beam==="merchant"} duration={0.65} repeat={0} pathColor="transparent" gradientStartColor="#4338ca" gradientStopColor="#4338ca"/>}</div>
            <div role="status" aria-live="polite">{negotiating?"Evaluating offer…":data?.negotiation?.status==="failed"?"No agreement reached":offer?"Validated merchant agreement accepted":"Merchant controls the permitted quantity discounts."}</div>
            <AnimatedList animate={!!beam}>{data?.rounds.map(r=><div key={r.id} className={"proposal-round "+r.role}><strong>{r.role==="buyer"?"Buyer agent":"Merchant agent"}</strong><p>{r.public_summary.replace(/^(Buyer|Merchant) agent: /,"")}</p></div>)}</AnimatedList>
            {data?.negotiation?.error&&<p>{data.negotiation.error}</p>}
            {!offer&&<button className="coalition-button" disabled={!data||!selected||!data.assessments.some(a=>a.product_id===selected&&a.eligible&&a.available>0)||busy||negotiating||evaluating} onClick={async()=>{setBusy(true);setError("");try{await api("/negotiations",{product_id:selected});await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{negotiating?"Evaluating offer…":"Negotiate selected offer"}</button>}
            {data?.negotiation?.status==="failed"&&<button className="text-button" onClick={()=>form.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus()}>Edit request</button>}
          </section>
        </div>
      </div>
    </main>
  </div>;
}

export function PricingHelp() {
  return <div className="request-page"><header className="request-header"><a href="/">Coalition</a></header><main className="pricing-help"><h1>How group pricing works</h1><ol><li>Review the exact product, delivery promise and maximum total. Approve that maximum through PayPal.</li><li>Wait for verified buyer commitments. You can leave before the fixed closing time. Shoppers need not stay on this page.</li><li>At closing, Coalition freezes the qualifying members and tier price. All selected payments must complete; otherwise completed captures are refunded and eligible holds voided.</li></ol><table><caption>Canonical small demo · approved maximum $89</caption><thead><tr><th>Valid authorizations at closing</th><th>Outcome</th></tr></thead><tbody><tr><td>Below 3</td><td>Cancel and unwind</td></tr><tr><td>3–4</td><td>Capture $89 per buyer</td></tr><tr><td>5</td><td>Capture $85 per buyer</td></tr></tbody></table><p>Your accepted quote supplies the actual tier schedule. A reached tier is provisional until closing. Pending approvals and expired holds do not count. Unknown captures and pending refunds stay visible until resolved.</p><p>Shipping is included; tax and fulfillment are simulated. One sandbox business account receives settlement. Bank hold release and refund availability follow provider and bank timing.</p><a href="/">Return to your request</a></main></div>;
}
