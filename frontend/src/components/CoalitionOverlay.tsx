import { useEffect, useRef, useState } from "react";
import {
  api,
  money,
  type ProductContext,
  type Status,
  type Config,
  type Commitment,
} from "../api";
import Icon from "./Icon";
import { NumberTicker } from "./magicui/number-ticker";
import PayPalApproval from "./PayPalApproval";

type Props = {
  context: ProductContext;
  config: Config | null;
  ready: boolean;
  initialError: string;
  onStatus: (status: Status) => void;
};
export default function CoalitionOverlay({
  context,
  config,
  ready,
  initialError,
  onStatus,
}: Props) {
  const sheetKey =
    "coalition-sheet:" +
    (new URLSearchParams(location.search).get("run") || "latest");
  const [open, setOpen] = useState(sessionStorage.getItem(sheetKey) === "open"),
    [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [approvalQueued, setApprovalQueued] = useState(false);
  const [needs, setNeeds] = useState(""),
    [assistantBusy, setAssistantBusy] = useState(false);
  const [available, setAvailable] = useState(true),
    [now, setNow] = useState(Date.now());
  const panel = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onStatus });
  callbacks.current = { onStatus };
  const key = JSON.stringify(context);
  useEffect(() => {
    setAccepted(false);
    setError("");
    setStatus(null);
    if (!ready) return;
    let ignore = false;
    api<Status & { available: boolean }>("/opportunity", context)
      .then((data) => {
        if (!ignore) {
          setAvailable(data.available);
          if (data.available) {
            setStatus(data);
            callbacks.current.onStatus(data);
          }
        }
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
    // ProductContext is the standalone storefront/extension boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  useEffect(() => {
    if (!ready || !available) return;
    let ignore = false;
    const refresh = () =>
      api<Status>("/status")
        .then((data) => {
          if (!ignore) {
            setStatus(data);
            callbacks.current.onStatus(data);
            setError("");
          }
        })
        .catch((e) => {
          if (!ignore) setError(e.message);
        });
    void refresh();
    const timer = setInterval(
      refresh,
      status && !open && ["SUCCEEDED", "FAILED"].includes(status.group.status)
        ? 30000
        : 2000,
    );
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [ready, available, open, status?.group.status]);
  useEffect(() => {
    sessionStorage.setItem(sheetKey, open ? "open" : "closed");
    if (!open) return;
    panel.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, sheetKey]);
  const c = status?.commitment;
  const hasAuthorization =
    !!c?.admitted &&
    !!c?.authorization_id &&
    ["CREATED", "CAPTURED"].includes(c.authorization_status || "");
  const outcome =
    !!status &&
    (["SUCCEEDED", "FAILED", "UNWINDING"].includes(status.group.status) ||
      c?.void_status === "VOIDED" ||
      !!c?.refund_id ||
      (!!c && !c.active));
  const state = outcome
    ? "outcome"
    : hasAuthorization
      ? "joined"
      : open
        ? "review"
        : "opportunity";
  const seconds = status?.group.deadline
    ? Math.max(
        0,
        Math.ceil((new Date(status.group.deadline).getTime() - now) / 1000),
      )
    : null;
  const decision = status?.decision;
  const assistantEnabled = config?.mode === "fixture" || !!config?.llm_configured;
  const groupJoinable = status && status.group.status === "OPEN";
  async function createCommitment(): Promise<Commitment> {
    if (!status) throw new Error("Group status unavailable.");
    const result = await api<Commitment>("/commitments", {
      group_id: status.group.id,
      context,
      accepted_terms: status.offer,
    });
    for (let i = 0; i < 30; i++) {
      const data = await api<Status>("/status");
      setStatus(data);
      if (data.commitment?.order_id) return data.commitment;
      if (data.commitment?.error) throw new Error(data.commitment.error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      "Order is still being prepared. Keep this panel open and check the worker; your place is reserved.",
    );
  }
  async function startApproval() {
    setBusy(true);
    setError("");
    try {
      const commitment = c?.order_id ? c : await createCommitment();
      if (config?.mode === "fixture") {
        await api("/commitments/" + commitment.id + "/authorize", {
          order_id: commitment.order_id,
        });
        setApprovalQueued(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (
    !available ||
    context.product_id !== "arc-991" ||
    context.selected_variant !== "Graphite" ||
    context.quantity !== 1
  )
    return (
      <div className="no-opportunity">
        <Icon name="users" />
        <span>No exact group offer for this selection.</span>
      </div>
    );
  async function evaluateNeeds() {
    setAssistantBusy(true);
    setError("");
    try {
      await api("/assistant", { request_text: needs });
      setStatus(await api<Status>("/status"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAssistantBusy(false);
    }
  }
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const count = status?.confirmed_count || 0;
  let outcomeTitle = "Checking your payment",
    outcomeCopy =
      "The worker is reconciling the provider result. No final outcome has been confirmed.";
  if (
    c &&
    !c.active &&
    !c.void_status &&
    !c.refund_id &&
    status?.group.status === "OPEN"
  ) {
    outcomeTitle = "Cancellation in progress";
    outcomeCopy =
      "Your place is no longer committed. Any confirmed authorization is being canceled. Hold release timing depends on PayPal and your bank.";
  }
  if (
    status?.group.status === "SUCCEEDED" &&
    c?.capture_status === "COMPLETED" &&
    !c?.refund_id
  ) {
    outcomeTitle = "Your group made it.";
    outcomeCopy =
      "$65 payment captured. All five captures are completed. Simulated delivery is within seven days.";
  } else if (c?.refund_status === "COMPLETED") {
    outcomeTitle = "Your refund is confirmed.";
    outcomeCopy =
      "$65 was captured and has now been refunded by the provider. Your bank may take time to display it.";
  } else if (
    c &&
    ["COMPLETED", "REFUNDED"].includes(c.capture_status || "") &&
    (status?.group.status !== "SUCCEEDED" || c.refund_id)
  ) {
    outcomeTitle =
      c.refund_status === "FAILED"
        ? "Refund needs attention"
        : c.refund_id
          ? "Refund is pending"
          : "Your refund is being arranged";
    outcomeCopy =
      "$65 was captured. The group did not complete. Your refund is not yet confirmed; the operator can recover this payment.";
  } else if (c?.capture_status === "REVERSED") {
    outcomeTitle = "Your payment was reversed.";
    outcomeCopy =
      "The provider confirmed the $65 capture was reversed. This is a returned payment, not an uncaptured authorization.";
  } else if (c?.void_status === "VOIDED") {
    outcomeTitle = "Authorization canceled.";
    outcomeCopy =
      "The provider confirmed the authorization was voided. No capture was confirmed. The visible hold may take time to disappear.";
  } else if (
    c &&
    !c.authorization_id &&
    !c.capture_id &&
    status?.group.status === "FAILED"
  ) {
    outcomeTitle = "This group has closed.";
    outcomeCopy =
      "No authorization was confirmed for your commitment. The group closed before it could complete.";
  } else if (!c && status?.group.status === "FAILED") {
    outcomeTitle = "This group has closed.";
    outcomeCopy =
      "The group did not reach five confirmed authorizations. You did not join this group.";
  } else if (c?.capture_status === "PENDING") {
    outcomeTitle = "Payment is still pending";
    outcomeCopy =
      "The provider has not confirmed the capture outcome. Reconciliation comes before any final decision.";
  }
  const success =
    status?.group.status === "SUCCEEDED" &&
    c?.capture_status === "COMPLETED" &&
    !c?.refund_id;
  return (
    <>
      <div className="opportunity">
        <div className="coalition-brand">
          <span className="coalition-symbol">
            <Icon name="users" size={17} />
          </span>
          <strong>coalition</strong>
          <span className="tiny-label">SHOP TOGETHER</span>
        </div>
        <h3>
          {state === "joined"
            ? "You’re in good company."
            : outcome
              ? "Your group update"
              : "Same calculator. Better together."}
        </h3>
        <div className="opportunity-price">
          <strong>
            $65<span> each</span>
          </strong>
          <span>Save $15 · 18.75%</span>
        </div>
        <p>
          $65 each if five buyers join.
          <br />
          Authorize $65. Captured when all five join; refunded if settlement
          fails.
        </p>
        <div className="group-mini">
          <div className="buyer-dots">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < count ? "confirmed" : ""}>
                {i < count ? <Icon name="check" size={12} /> : null}
              </span>
            ))}
          </div>
          <span>
            {status ? `${count} of 5 authorized` : "Group status unavailable"}
          </span>
        </div>
        <button
          className="coalition-button"
          ref={trigger}
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          {hasAuthorization || outcome || c?.withdrawn
            ? "View group status"
            : "Join for $65"}
          <Icon name="arrow" size={18} />
        </button>
        <small>
          Shipping included · $0 simulated tax · delivery within 7 days
        </small>
        <small>
          {status?.group.demo
            ? "Demo deadline: 90 seconds after activation"
            : "Offer window: 24 hours"}
          {seconds !== null && status?.group.status === "OPEN"
            ? " · " +
              Math.floor(seconds / 3600) +
              "h " +
              Math.floor((seconds % 3600) / 60) +
              "m " +
              (seconds % 60) +
              "s left"
            : ""}
        </small>
        <button
          className="text-button"
          onClick={async () => {
            const url = new URL(location.href);
            url.search = "?run=" + status?.group.run_id;
            try {
              await navigator.clipboard.writeText(url.toString());
              setError("Offer link copied.");
            } catch {
              setError(url.toString());
            }
          }}
          disabled={!status}
        >
          Copy offer link
        </button>
        <small>
          {config?.mode === "fixture"
            ? "Fixture mode · simulated payments"
            : config?.mode === "connected"
              ? "PayPal sandbox · real test payments"
              : "Demo offer · backend unavailable"}
        </small>
      </div>
      {open && (
        <aside
          ref={panel}
          tabIndex={-1}
          className="coalition-panel"
          aria-label="Coalition group purchase"
        >
          <div className="panel-head">
            <div className="coalition-brand">
              <span className="coalition-symbol">
                <Icon name="users" size={18} />
              </span>
              <strong>coalition</strong>
            </div>
            <button
              className="icon-button"
              onClick={dismiss}
              aria-label="Close group offer"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="panel-scroll">
            <span
              className={
                "mode-label " + (config?.mode === "fixture" ? "fixture" : "")
              }
            >
              {config?.mode === "fixture"
                ? "FIXTURE DEMO · PAYMENTS & AI SIMULATED"
                : config?.mode === "connected"
                  ? "CONNECTED DEMO · PAYPAL SANDBOX"
                  : "BACKEND UNAVAILABLE · CATALOG PREVIEW"}
            </span>
            <h2>
              {state === "outcome"
                ? outcomeTitle
                : state === "joined"
                  ? "Your place is confirmed."
                  : "A smarter price. Together."}
            </h2>
            <p className="panel-intro">
              {state === "outcome"
                ? outcomeCopy
                : state === "joined"
                  ? status?.group.status === "SETTLING"
                    ? "Five authorizations confirmed. Captures are now being checked."
                    : "Your $65 authorization is confirmed. The group needs five eligible buyers to complete."
                  : c?.withdrawn || (c && !c.active)
                    ? "Cancellation is in progress. Any confirmed authorization will be voided; hold release timing varies."
                    : "Review the exact offer, then approve your individual PayPal authorization."}
            </p>
            <div className="offer-item">
              <img src="/assets/calculator.svg" alt="" />
              <div>
                <strong>Arc 991 Scientific Calculator</strong>
                <span>Graphite · Quantity 1</span>
                <small>Sold by Commonplace Supply</small>
              </div>
            </div>
            <div className="merchant-note">
              Fictional merchant · 5 reserved units
            </div>
            <div className="group-progress">
              <div>
                <strong>
                  <NumberTicker value={count} /> <span>of 5 authorized</span>
                </strong>
                <span>
                  {status?.group.status === "OPEN" && !status.group.activated
                    ? "Not activated"
                    : seconds !== null && status?.group.status === "OPEN"
                      ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s remaining`
                      : status?.group.status || "Checking group"}
                </span>
              </div>
              <div className="segments">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < count ? "filled" : ""} />
                ))}
              </div>
              <small>
                {status?.group.status === "OPEN" && !status.group.activated
                  ? "Demo mode: the operator starts the 90-second window. Preparation expires after 30 minutes."
                  : status?.group.status === "SETTLING"
                    ? "Membership locked · settling five payments"
                    : status?.group.status === "SUCCEEDED"
                      ? "Five completed captures · group completed"
                      : "Closes at five admitted authorizations or at the deadline. Closure locks participation."}
              </small>
            </div>
            <dl className="receipt">
              <div>
                <dt>Group price</dt>
                <dd>$65.00</dd>
              </div>
              <div>
                <dt>Shipping · within 7 days</dt>
                <dd>Included</dd>
              </div>
              <div>
                <dt>Tax · simulation</dt>
                <dd>$0.00</dd>
              </div>
              <div className="receipt-total">
                <dt>Delivered total</dt>
                <dd>
                  $65.00 <span>USD</span>
                </dd>
              </div>
            </dl>
            {state === "review" && (
              <>
                <div className="payment-terms">
                  <Icon name="shield" size={21} />
                  <div>
                    <strong>Authorize now. Pay if it comes together.</strong>
                    <p>
                      Approve a temporary $65 authorization hold through PayPal
                      sandbox. This is not a purchase. Visible hold release
                      depends on PayPal and your bank. If fewer than five buyers
                      join, authorizations are voided. If settlement fails after
                      a capture, that charge is refunded. Pending refunds stay
                      visible until confirmed.
                    </p>
                  </div>
                </div>
                {!assistantEnabled ? (
                  <div className="assistant-fit agent-note">
                    <div>
                      <strong>AI recommendations coming soon</strong>
                      <p>Review the offer details. PayPal checkout is available.</p>
                    </div>
                  </div>
                ) : (
                  <details className="assistant-fit">
                    <summary>Does this fit my needs?</summary>
                    <form
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await evaluateNeeds();
                      }}
                    >
                      <label htmlFor="buyer-needs">
                        Budget, delivery date, and product requirements
                      </label>
                      <textarea
                        id="buyer-needs"
                        value={needs}
                        onChange={(e) => setNeeds(e.target.value)}
                        maxLength={1200}
                        minLength={3}
                        required
                        placeholder="Below $70, delivery within 2 days, scientific calculator for my course."
                      />
                      <button
                        className="secondary-button"
                        disabled={assistantBusy || decision?.status === "queued"}
                      >
                        {assistantBusy || decision?.status === "queued"
                          ? "Evaluating…"
                          : "Evaluate this offer"}
                      </button>
                    </form>
                    {decision && (
                      <div className="agent-note" role="status">
                        <div>
                          <strong>
                            {decision.mode === "fixture"
                              ? "Simulated recommendation"
                              : "Live recommendation"}
                          </strong>
                          <p>
                            {decision.status === "completed"
                              ? decision.result?.explanation
                              : decision.status === "failed"
                                ? "Assistant unavailable. You can still browse and join."
                                : "Evaluating your constraints…"}
                          </p>
                          {decision.result?.question && (
                            <p>{decision.result.question}</p>
                          )}
                          {decision.result?.extracted_constraints && (
                            <dl>
                              {Object.entries(
                                decision.result.extracted_constraints,
                              )
                                .filter(
                                  ([, v]) =>
                                    v !== null &&
                                    v !== false &&
                                    (!Array.isArray(v) || v.length),
                                )
                                .map(([k, v]) => (
                                  <div key={k}>
                                    <dt>{k.replaceAll("_", " ")}</dt>
                                    <dd>{String(v)}</dd>
                                  </div>
                                ))}
                            </dl>
                          )}
                          {decision.result?.evidence?.map((e) => (
                            <p key={e}>{e}</p>
                          ))}
                          <small>
                            A recommendation never approves payment. Course and
                            exam approval stay unknown without supplied policy.
                          </small>
                        </div>
                      </div>
                    )}
                  </details>
                )}
                <label className="terms-check">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    I accept this exact item, seller, $65 delivered total,
                    seven-day simulated delivery, and conditional payment terms.
                  </span>
                </label>
              </>
            )}
            {state === "joined" && (
              <div className="authorization-receipt">
                <Icon name="check" />
                <div>
                  <strong>$65 authorization confirmed</strong>
                  <span>
                    {c?.capture_status
                      ? "Capture status: " + c.capture_status
                      : "A hold is authorized. Capture has not been confirmed."}
                  </span>
                  <small>Authorization …{c?.authorization_id?.slice(-6)}</small>
                </div>
              </div>
            )}
            {state === "outcome" && (
              <div
                className={
                  "authorization-receipt " + (success ? "success" : "")
                }
              >
                <Icon name={success ? "check" : "shield"} />
                <div>
                  <strong>
                    {success ? "Paid $65.00 USD" : "Payment record"}
                  </strong>
                  <span>
                    {c?.capture_status
                      ? "Capture: " + c.capture_status
                      : "Capture not confirmed"}
                    {c?.refund_status ? " · Refund: " + c.refund_status : ""}
                    {c?.void_status ? " · Void: " + c.void_status : ""}
                  </span>
                  <small>
                    {c?.capture_id || c?.authorization_id
                      ? "Resource …" +
                        (c.capture_id || c.authorization_id)?.slice(-6)
                      : "No payment authorization"}
                  </small>
                </div>
              </div>
            )}
            {status && (
              <details className="activity">
                <summary>Judge evidence · verified backend records</summary>
                <p>
                  Group: {status.group.status}
                  {status.group.needs_attention
                    ? " · merchant attention required"
                    : ""}
                </p>
                <ul>
                  {status.evidence?.map((e, i) => (
                    <li key={i}>
                      {e.kind}: {e.status} · {e.evidence_source} ·{" "}
                      {e.resource_id}
                      <time>{new Date(e.updated_at).toLocaleString()}</time>
                      {e.evidence_event_id && (
                        <small>Receipt {e.evidence_event_id}</small>
                      )}
                    </li>
                  ))}
                </ul>
                <strong>Genuine sandbox webhook receipts</strong>
                {status.webhooks?.length ? (
                  <ul>
                    {status.webhooks.map((e) => (
                      <li key={e.id}>
                        {e.event_type} ·{" "}
                        {e.verified
                          ? "signature verified"
                          : "verification pending"}{" "}
                        · {e.processed_at ? "processed" : "queued"} · {e.id}
                        <time>{new Date(e.received_at).toLocaleString()}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No genuine webhook receipt has been matched to this group.
                  </p>
                )}
                <p>
                  Fixture results are simulated. API confirmation and
                  reconciliation are labeled separately from webhook-driven
                  observations.
                </p>
              </details>
            )}
            <span className="sr-only" role="status" aria-live="polite">
              {status?.group.status} · {count} of 5 admitted authorizations.{" "}
              {c?.capture_status && "Capture " + c.capture_status}.{" "}
              {c?.refund_status && "Refund " + c.refund_status}
            </span>
            {(error ||
              initialError ||
              c?.error ||
              status?.group.failure_reason) && (
              <p role="alert" className="error-message">
                {error ||
                  initialError ||
                  c?.error ||
                  status?.group.failure_reason}
              </p>
            )}
          </div>
          <div className="panel-footer">
            {state === "review" && (
              <>
                {config?.mode === "connected" &&
                c?.order_id &&
                c.active &&
                groupJoinable &&
                accepted &&
                config.paypal_client_id ? (
                  <PayPalApproval
                    clientId={config.paypal_client_id}
                    commitment={c}
                    onApproved={() => setApprovalQueued(true)}
                    onError={setError}
                  />
                ) : (
                  <button
                    className="coalition-button"
                    onClick={startApproval}
                    disabled={
                      !ready ||
                      !accepted ||
                      !groupJoinable ||
                      busy ||
                      approvalQueued ||
                      !!c?.withdrawn ||
                      (!!c && !c.active) ||
                      (config?.mode === "connected" &&
                        !config.paypal_configured)
                    }
                  >
                    {busy
                      ? "Preparing your order…"
                      : approvalQueued
                        ? "Verifying authorization…"
                        : !groupJoinable
                          ? "Group closed"
                          : config?.mode === "fixture"
                            ? "Simulate $65 authorization"
                            : "Continue with PayPal"}
                    <Icon name={busy ? "clock" : "arrow"} size={18} />
                  </button>
                )}
                <small>
                  {config?.mode === "fixture"
                    ? "Fixture approval. No PayPal call or money movement."
                    : "PayPal approval opens outside this storefront. Approval alone does not count as authorization."}
                </small>
              </>
            )}
            {c &&
              status?.group.status === "OPEN" &&
              c.active &&
              !c.withdrawn && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api("/commitments/" + c.id + "/leave", {});
                      setStatus(await api<Status>("/status"));
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Leave group
                </button>
              )}
            {state !== "review" && (
              <button className="secondary-button" onClick={dismiss}>
                Keep browsing
                <Icon name="arrow" size={17} />
              </button>
            )}
            <p>
              {config?.mode === "connected"
                ? "Simulated merchant and buyers; real PayPal sandbox operations. " +
                  (assistantEnabled
                    ? "Live AI recommendations enabled. "
                    : "AI recommendations coming soon. ")
                : "Fixture mode: payments and recommendations are simulated. "}
              Prices, inventory, tax and fulfillment are simulated.
            </p>
          </div>
        </aside>
      )}
    </>
  );
}
