import { useEffect, useRef, useState } from "react";
import { api, money, type Commitment, type Config, type PaymentMember, type Product, type Status } from "../api";
import Icon from "./Icon";
import ProductPhoto from "./ProductPhoto";
import CommitmentTrack from "./CommitmentTrack";
import PayPalApproval from "./PayPalApproval";
import { AnimatedList } from "./magicui/animated-list";
import { BlurFade } from "./magicui/blur-fade";

export function captureLabel(member: PaymentMember) {
  if (member.refund_status === "COMPLETED") return "Refunded";
  if (member.refund_status === "FAILED") return "Refund needs attention";
  if (member.refund_status) return "Refund pending";
  if (member.capture_status === "REVERSED") return "Payment reversed";
  if (member.capture_status === "COMPLETED") return "Payment completed";
  if (member.capture_status === "PENDING") return "Payment pending";
  if (member.capture_status && ["DECLINED", "DENIED", "FAILED"].includes(member.capture_status)) return "Payment failed";
  if (member.void_status === "VOIDED") return "Authorization canceled";
  if (["unknown", "inflight"].includes(member.capture_operation_status || "")) return "Verifying outcome";
  if (member.capture_operation_status === "declined") return "Payment declined";
  return "Awaiting capture";
}

export default function Checkout({ status, config, onStatus, products, initialError, notice, onRetry }: {
  status: Status | null; config: Config | null; onStatus: (status: Status) => void;
  products: Product[]; initialError: string; notice: string; onRetry: () => Promise<void>;
}) {
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false),
    [error, setError] = useState(""), [approvalQueued, setApprovalQueued] = useState(false),
    [now, setNow] = useState(Date.now());
  const restored = useRef<string | null>(null);
  const previousStatus = useRef<Status | null>(null);
  const previousEvent = useRef<string | null>(null);
  const c = status?.commitment;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (c && restored.current !== c.id) {
      restored.current = c.id;
      // Restore only terms recorded for this session-owned commitment.
      if (c.accepted_terms && status && Object.entries(status.offer).every(([key, value]) => JSON.stringify(c.accepted_terms![key]) === JSON.stringify(value))) setAccepted(true);
    }
    if (c?.authorization_id || c?.error || c?.withdrawn || (c && !c.active)) setApprovalQueued(false);
  }, [c, status?.offer]);
  const offer = status?.offer;
  const price = offer ? money(offer.total_minor) : "—";
  const paid = c?.captured_minor ?? c?.settlement_minor ?? offer?.total_minor ?? 0;
  const paidPrice = money(paid);
  const selectedCount = status?.selected_count || status?.offer.capacity || 0;
  const total = offer ? new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(paid / 100) : "—";
  const product = products.find(p => p.id === offer?.product_id);
  const expired = !!status && now >= new Date(status.group.deadline || status.group.preparation_expires_at).getTime();
  const joinable = !!status && status.group.status === "OPEN" && !expired && status.confirmed_count < status.offer.capacity;
  const pending = !!status?.authorization_pending || approvalQueued;
  const authorized = !!c?.admitted && !!c.authorization_id && c.active && !c.withdrawn && c.void_status !== "VOIDED" && !c.refund_status;
  const success = !!status && status.group.status === "SUCCEEDED" && status.completed_captures === selectedCount &&
    status.members.length === selectedCount && status.members.every(m => m.capture_status === "COMPLETED" && !m.refund_status && m.void_status !== "VOIDED") &&
    c?.capture_status === "COMPLETED" && !c.refund_id && !c.refund_status;
  const latest = status?.evidence?.[0];
  // Reconciliation timestamps alone are not a new payment event.
  const eventKey = latest ? `${latest.kind}:${latest.resource_id}:${latest.status}:${latest.evidence_source}:${latest.evidence_event_id || ""}` : null;
  const eventChanged = !!previousStatus.current && eventKey !== previousEvent.current;
  const receiptKey = c ? `coalition-receipt:${c.id}:${c.capture_id}` : "";
  let seenReceipt = true;
  try { seenReceipt = sessionStorage.getItem(receiptKey) === "seen"; } catch { /* Storage is optional for presentation. */ }
  const celebrate = success && !!previousStatus.current && previousStatus.current.group.status !== "SUCCEEDED" && !seenReceipt;
  useEffect(() => {
    if (status) previousStatus.current = status;
    previousEvent.current = eventKey;
    if (success) { try { sessionStorage.setItem(receiptKey, "seen"); } catch { /* Payment state is always server-owned. */ } }
  }, [status, eventKey, success, receiptKey]);
  let title = "Review your checkout", copy = "Approve your individual authorization. Only a verified hold confirms your place.";
  if (status?.group.status === "SETTLING") { title = "Completing payments"; copy = "Selected members and the tier price are frozen. Each payment is being captured and verified."; }
  else if (authorized && status?.group.status === "OPEN") { title = "Your place is confirmed."; copy = `Your ${price} hold is authorized. The final tier is selected at the fixed closing time.`; }
  else if (pending) { title = "Verifying authorization"; copy = "PayPal approval was received. Your place counts only after the server confirms the authorization."; }
  else if (status && (status.group.status !== "OPEN" || !joinable)) { title = status.group.status === "SUCCEEDED" ? success || !c ? "This group is complete" : "Verifying final payments" : status.group.status === "UNWINDING" ? "Resolving payments" : "This group has closed."; copy = c ? "The latest provider outcome is shown below. Unresolved payments remain under reconciliation." : "You have not joined this group. No payment was requested for you."; }
  if (c?.withdrawn && status?.group.status === "OPEN") { title = "Cancellation in progress"; copy = "Your place is no longer committed. Any confirmed hold is being canceled; release timing depends on PayPal and your bank."; }
  if (success) { title = "Your group made it."; copy = `All ${selectedCount} selected payments are complete. Your ${paidPrice} payment is confirmed.`; }
  else if (c?.refund_status === "COMPLETED") { title = "Your refund is confirmed."; copy = `${paidPrice} was refunded by the provider. Your bank may take time to display it.`; }
  else if (c?.refund_status === "FAILED") { title = "Refund needs attention"; copy = "The refund has not completed. The merchant can recover this payment."; }
  else if (c?.refund_id || c?.refund_status) { title = "Refund is pending"; copy = `${paidPrice} was captured. The refund is not confirmed yet.`; }
  else if (c?.capture_status === "REVERSED") { title = "Your payment was reversed."; copy = "The provider confirmed that your captured payment was reversed."; }
  else if (["COMPLETED", "REFUNDED"].includes(c?.capture_status || "") && status?.group.status === "UNWINDING") { title = "Your refund is being arranged"; copy = "Payment was captured. Its refund remains unconfirmed."; }
  else if (c?.void_status === "VOIDED") { title = "Authorization canceled."; copy = "The provider confirmed the hold was voided. No capture was confirmed. Hold release timing varies."; }
  else if (c?.capture_status === "PENDING" && status?.group.status !== "SETTLING") { title = "Payment is still pending"; copy = "The provider has not confirmed the capture outcome. Reconciliation is continuing."; }
  const canReview = !!status && joinable && status.group.status === "OPEN" && !authorized && !c?.withdrawn && (!c || c.active);
  async function refresh() { const data = await api<Status>("/status"); onStatus(data); return data; }
  async function createCommitment(): Promise<Commitment> {
    if (!status || !product) throw new Error("Exact offer details are unavailable. Please retry.");
    await api("/commitments", { group_id: status.group.id,
      context: { product_id: product.id, title: product.title, selected_variant: status.offer.variant, quantity: status.offer.quantity, displayed_price_minor: product.price_minor, currency: product.currency },
      accepted_terms: status.offer });
    for (let i = 0; i < 30; i++) {
      const data = await refresh();
      if (data.commitment?.error) throw new Error(data.commitment.error);
      if (data.commitment?.order_id) return data.commitment;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error("Your order is still being prepared. Your reserved place and payment state are saved; retry when the order is ready.");
  }
  async function startApproval() {
    setBusy(true); setError("");
    try {
      const commitment = c?.order_id ? c : await createCommitment();
      if (config?.mode === "fixture") {
        await api("/commitments/" + commitment.id + "/authorize", { order_id: commitment.order_id });
        setApprovalQueued(true); await refresh();
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const storeURL = "/?" + new URLSearchParams({ ...(status ? { run: status.group.run_id, product: status.offer.product_id } : {}) });
  return <div className="checkout-page">
    <header className="checkout-header">
      <a className="coalition-brand" href={storeURL}><span className="coalition-symbol"><Icon name="users" size={20} /></span><strong>Coalition <span className="header-checkout">checkout</span></strong></a>
      <span className="checkout-merchant"><Icon name="logo" size={16} />{offer?.merchant || "Commonplace Supply"}</span>
      <a className="return-store" href={storeURL}><Icon name="arrow" size={15} />Return to storefront</a>
    </header>
    <main className="checkout-main">
      <div className="checkout-disclosure"><span className="mode-label">{config?.mode === "fixture" ? "FIXTURE DEMO · SIMULATED PAYMENTS" : "PAYPAL SANDBOX · TEST PAYMENTS"}</span><span>Fictional merchant · no real fulfillment</span></div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {initialError && <div className="connection-notice" role="alert"><span>{initialError}</span><button onClick={() => void onRetry()}>Retry connection</button></div>}
      {!status ? <section className="checkout-loading"><h1>Restoring your checkout</h1><p>Checking the offer and your payment record…</p></section> : <div className="checkout-layout">
        <BlurFade delay={0} duration={0.25} className="checkout-summary">
          <section aria-label="Order summary">
            <div className="offer-item">{product?.image && <ProductPhoto product={product}/>}<div><h1>{offer!.title}</h1><span>{offer!.variant} · Quantity {offer!.quantity}</span><small>Sold by {offer!.merchant}</small></div></div>
            <div className="checkout-offer-price"><strong>{price}</strong><span>per buyer</span>{status.ordinary_price_minor !== undefined && <b>Save {money(Math.max(0, status.ordinary_price_minor - offer!.total_minor))}</b>}</div>
            <dl className="receipt"><div><dt>Item · {offer!.variant}</dt><dd>{price}</dd></div><div><dt>Shipping</dt><dd>Included</dd></div><div><dt>Tax · simulation</dt><dd>{money(Number(offer!.tax_minor ?? 0))}</dd></div><div className="receipt-total"><dt>Maximum delivered total</dt><dd>{price} <span>{offer!.currency}</span></dd></div></dl>
            <div className="checkout-logistics"><div><Icon name="truck" size={18} /><span><strong>{offer!.delivery_by ? "Delivery by " + new Date(offer!.delivery_by).toLocaleDateString("en-US",{timeZone:"UTC"}) + " UTC" : `Delivery within ${offer!.delivery_days} days`}</strong><small>By the accepted delivery date · simulated fulfillment</small></span></div><div><Icon name="clock" size={18} /><span><strong>{status.group.deadline ? new Date(status.group.deadline).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }) : "Deadline starts on activation"}</strong><small>{status.group.status !== "OPEN" ? "Participation closed" : expired ? "Deadline reached · checking group" : status.group.deadline ? "Join before the deadline" : "Operator activates the demo window"}</small></span></div></div>
            <div className="payment-terms"><Icon name="shield" size={20} /><div><strong>Approve the maximum. Settle at closing.</strong><p>Approve a temporary {price} PayPal sandbox hold. At closing, at least {offer!.minimum} valid authorizations are required. The reached tier is frozen before capture. If the group expires, holds are voided. Failed settlement triggers refunds; pending refunds stay visible. Hold release timing depends on PayPal and your bank.</p></div></div>
          </section>

        </BlurFade>
        <BlurFade delay={0.07} duration={0.25} className="checkout-payment">
          <aside aria-label="Coalition group purchase">
            <div className="checkout-status" role="status"><h2>{title}</h2><p>{copy}</p></div>
            <CommitmentTrack key={status.group.id} count={status.confirmed_count} capacity={offer!.capacity} members={status.members} pending={pending || (!!c?.active && !!c.order_id && !c.authorization_id)} closed={status.group.status !== "OPEN" || expired} />
            <div className="checkout-actions" aria-label="Payment controls">
              {offer!.tier_schedule && <ul className="tier-ladder">{offer!.tier_schedule.map(t=><li key={t.minimum_buyers}><strong>{money(t.total_each_cents)}</strong><span>{t.minimum_buyers} buyers</span></li>)}</ul>}
              <p>Quote {offer!.version ?? 1} · exact {offer!.variant} variant</p>
              <div className="consent-slot">{canReview ? <label className="terms-check"><input type="checkbox" checked={accepted} disabled={busy || pending} onChange={e => setAccepted(e.target.checked)} /><span>I accept this exact item, seller, {price} delivered total, {offer!.delivery_days}-day simulated delivery, and conditional payment terms.</span></label> : <div className="authorization-state"><Icon name={authorized || success ? "check" : "shield"} size={19} /><span>{success ? "All required captures confirmed" : authorized ? `${price} authorization confirmed` : "Your payment record is saved"}<small>{c?.authorization_id ? "Authorization …" + c.authorization_id.slice(-6) : "Only your session can access your payment."}</small></span></div>}</div>
              <div className="primary-control">{canReview && !pending && accepted && !initialError && c?.order_id && c.active && joinable && config?.mode === "connected" && config.paypal_client_id ? <PayPalApproval clientId={config.paypal_client_id} commitment={c} onApproved={() => { setApprovalQueued(true); void refresh().catch(e => setError(e.message)); }} onError={setError} /> : <button className="coalition-button" onClick={startApproval} disabled={!canReview || !accepted || !joinable || busy || pending || !!initialError || (config?.mode === "connected" && !config.paypal_configured)}>{busy ? "Preparing your order…" : pending ? "Verifying authorization…" : !canReview ? success ? "Payment complete" : status.group.status === "SETTLING" ? "Completing payments…" : authorized ? "Waiting for the group" : "Participation closed" : !joinable ? "Group closed" : config?.mode === "fixture" ? `Simulate ${price} authorization` : "Continue with PayPal"}<Icon name={busy || pending ? "clock" : success ? "check" : "arrow"} size={18} /></button>}</div>
              <p className="payment-control-note">{success ? "Payment is confirmed. Your receipt is saved below." : status.group.status !== "OPEN" || c?.withdrawn || (c && !c.active) ? "Your payment record is saved. Outcomes update after provider verification." : authorized ? "Your hold is confirmed. Keep this link to follow the group." : pending ? "Approval received. Waiting for a verified authorization." : config?.mode === "fixture" ? "Fixture approval · no PayPal call or money movement." : "PayPal opens for approval. Your checkout is saved here."}</p>
              <p><a href="/">Find another deal</a></p>
              <p><a href="/how-group-pricing-works">How group pricing works</a></p>
              <div className="cancel-slot">{c && status.group.status === "OPEN" && c.active && !c.withdrawn && <button className="text-button" disabled={busy || !!initialError} onClick={async () => { setBusy(true); setError(""); try { await api("/commitments/" + c.id + "/leave", {}); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Leave group</button>}</div>
            </div>
            {(error || c?.error || status.group.failure_reason) && <p className="error-message" role="alert">{error || c?.error || status.group.failure_reason}</p>}
            {status.members.length > 0 && status.group.status !== "OPEN" && <section className="capture-progress" aria-label="Payment progress"><div className="activity-heading"><strong>Payment progress</strong><span>{status.completed_captures} of {selectedCount} selected captures completed</span></div><ol>{status.members.map(m => <li key={m.position}><span>Buyer {m.position}{m.is_you ? " · You" : ""}</span><strong className={m.capture_status === "COMPLETED" && !m.refund_status ? "capture-complete" : ""}>{captureLabel(m)}</strong></li>)}</ol></section>}
            {success && <BlurFade disabled={!celebrate} duration={0.3} offset={4} className="final-receipt"><section aria-label="Payment receipt"><div className="receipt-success"><Icon name="check" size={21} /><strong>Paid {total} {offer!.currency}</strong></div><p>{offer!.title} · {offer!.variant} · Quantity {offer!.quantity}</p><dl><div><dt>Authorized</dt><dd>{money(c!.authorized_minor ?? offer!.total_minor)}</dd></div><div><dt>Captured</dt><dd>{paidPrice}</dd></div><div><dt>Not captured</dt><dd>{money(Math.max(0,(c!.authorized_minor ?? offer!.total_minor)-paid))}</dd></div><div><dt>Merchant</dt><dd>{offer!.merchant}</dd></div><div><dt>Method</dt><dd>{config?.mode === "fixture" ? "Simulated fixture" : "PayPal sandbox"}</dd></div><div><dt>Capture</dt><dd>…{c!.capture_id?.slice(-6)}</dd></div><div><dt>Delivery</dt><dd>Within {offer!.delivery_days} days · simulated</dd></div></dl></section></BlurFade>}
            {!success && c && status.group.status !== "OPEN" && <div className="payment-record"><strong>Payment record</strong><p>Capture: {c.capture_status || "not confirmed"}{c.refund_status ? " · Refund: " + c.refund_status : ""}{c.void_status ? " · Void: " + c.void_status : ""}</p><small>{c.capture_id || c.authorization_id ? "Resource …" + (c.capture_id || c.authorization_id)?.slice(-6) : "No payment authorization confirmed"}</small></div>}
            <section className="latest-payment" aria-label="Payment activity"><div className="activity-heading"><strong>Latest payment event</strong><span>Provider observations</span></div>{latest ? <AnimatedList animate={eventChanged}><div key={eventKey} className="payment-event"><Icon name={latest.status === "PENDING" ? "clock" : "shield"} size={17} /><div><strong>{latest.kind.replaceAll("_", " ")} · {latest.status.toLowerCase().replaceAll("_", " ")}</strong><small>{latest.evidence_source === "fixture" ? "Simulated fixture" : latest.evidence_source} · {latest.resource_id || "Resource recorded"}</small></div><time dateTime={latest.updated_at}>{new Date(latest.updated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time></div></AnimatedList> : <p className="activity-empty">No payment events recorded yet.</p>}<details className="activity payment-history"><summary>Activity &amp; payment evidence</summary><ul>{status.evidence?.map((e, i) => <li key={i}><strong>{e.kind} · {e.status}</strong><span>{e.evidence_source} · {e.resource_id}</span><time>{new Date(e.updated_at).toLocaleString()}</time></li>)}</ul>{!status.evidence?.length && <p>No provider observations recorded.</p>}<p>Group: {status.group.status}{status.group.needs_attention ? " · merchant attention required" : ""}</p><strong>Sandbox webhook receipts</strong>{status.webhooks?.length ? <ul>{status.webhooks.map(e => <li key={e.id}><strong>{e.event_type}</strong><span>{e.verified ? "Signature verified" : "Verification pending"} · {e.processed_at ? "Processed" : "Queued"}</span><time>{new Date(e.received_at).toLocaleString()}</time></li>)}</ul> : <p>No genuine webhook receipt has been matched to this group.</p>}<p>Fixture results are simulated. API, reconciliation, and webhook observations retain their recorded source.</p></details></section>
          </aside>
        </BlurFade>
      </div>}
      <footer className="checkout-footnote"><Icon name="shield" size={14} /><span>{config?.mode === "fixture" ? "Payments and recommendations are simulated." : "Real PayPal sandbox operations. No live charges."} Prices, inventory, tax, and fulfillment are simulated.</span></footer>
    </main>
  </div>;
}
