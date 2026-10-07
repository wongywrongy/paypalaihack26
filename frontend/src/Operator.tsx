import { useEffect, useState } from "react";
import { api, type Config, type Terms } from "./api";
import Icon from "./components/Icon";
interface Run {
  id: string;
  group_id: string;
  status: string;
  scenario: string;
  mode: string;
  deadline: string | null;
  activated: boolean;
  demo: boolean;
  needs_attention: boolean;
}
interface Evidence {
  offer?: Terms | null;
  negotiations?: { id: string; status: string; error: string | null }[];
  rounds?: { id: number; public_summary: string; valid: boolean; private_error: string | null }[];
  requests?: { id: string; status: string; error: string | null }[];
  group: {
    id: string;
    run_id: string;
    status: string;
    mode: string;
    scenario: string;
    deadline: string | null;
    failure_reason: string | null;
    activated: boolean;
    inventory_reserved: number;
    preparation_expires_at: string;
    needs_attention: boolean;
  };
  buyers: {
    id: string;
    name: string;
    prepared: boolean;
    admitted: boolean;
    withdrawn: boolean;
    decision_status: string;
    decision_error: string | null;
    result: {
      decision: string;
      explanation: string;
      guardrail_override?: boolean;
      model_result?: { decision: string };
    } | null;
    commitment_id: string | null;
    authorization_id: string | null;
    authorization_status: string | null;
    capture_status: string | null;
    refund_status: string | null;
    void_status: string | null;
    error: string | null;
  }[];
  jobs: {
    id: number;
    kind: string;
    status: string;
    attempts: number;
    error: string | null;
  }[];
  operations: {
    id: string;
    kind: string;
    status: string;
    response: { id?: string; status?: string };
    error: string | null;
  }[];
  observations: {
    kind: string;
    provider_status: string;
    source: string;
    observed_at: string;
    event_id: string | null;
    resource_id: string | null;
  }[];
  events: {
    id: string;
    verified: boolean;
    processed_at: string | null;
    received_at: string;
    event_type: string;
  }[];
}
interface Created {
  run_id: string;
  judge_url: string;
  preparation_links: { name: string; url: string; buyer_id: string }[];
}
export default function Operator({ config }: { config: Config | null }) {
  const assistantEnabled = config?.mode === "fixture" || !!config?.llm_configured;
  const [demo, setDemo] = useState(true);
  const [profile,setProfile]=useState("small"),[closeSeconds,setCloseSeconds]=useState(600);
  const [token, setToken] = useState(""),
    [runs, setRuns] = useState<Run[]>([]),
    [selected, setSelected] = useState(""),
    [evidence, setEvidence] = useState<Evidence | null>(null),
    [created, setCreated] = useState<Created | null>(null),
    [scenario, setScenario] = useState("success"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [recoveryId, setRecoveryId] = useState(""),
    [recoveryCommitment, setRecoveryCommitment] = useState("");
  async function refresh(runId = selected) {
    const data = await api<Run[]>("/operator/runs", undefined, token);
    setRuns(data);
    if (runId) {
      const detail = await api<Evidence>(
        "/operator/runs/" + runId,
        undefined,
        token,
      );
      setEvidence(detail);
    }
  }
  async function action(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMessage(success);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!connected || !selected) return;
    const timer = setInterval(() => {
      refresh().catch((e) => setError(e.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [connected, selected, token]);
  async function authenticate() {
    setError("");
    try {
      const list = await api<Run[]>("/operator/runs", undefined, token);
      setRuns(list);
      setConnected(true);
      if (list[0]) {
        setSelected(list[0].id);
        setEvidence(
          await api("/operator/runs/" + list[0].id, undefined, token),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const confirmed =
    evidence?.buyers.filter(
      (b) =>
        b.admitted &&
        !b.withdrawn &&
        b.authorization_id &&
        ["CREATED", "CAPTURED"].includes(b.authorization_status || "") &&
        b.void_status !== "VOIDED" &&
        b.refund_status !== "COMPLETED",
    ).length || 0;
  return (
    <div className="operator-page">
      <header>
        <a href="/" className="store-logo">
          <Icon name="users" size={28} />
          coalition
        </a>
        <a href="/">
          Back to storefront
          <Icon name="arrow" size={17} />
        </a>
      </header>
      <main>
        <h1>Prepare a run. Track every payment.</h1>
        <p>
          Negotiate an immutable quote, prepare buyer approvals, and inspect settlement or recovery. Every payment state stays visible.
        </p>
        <div className="operator-mode">
          <strong>
            {config?.mode === "fixture"
              ? "Fixture mode"
              : "Connected sandbox mode"}
          </strong>
          <span>
            {config?.mode === "fixture"
              ? "Payments and AI are simulated. No service verification."
              : `PayPal ${config?.paypal_configured ? "configured" : "credentials missing"} · AI recommendations ${config?.llm_configured ? "enabled" : "disabled"}. Configuration is not proof of verification.`}
          </span>
        </div>
        {!connected ? (
          <form
            className="operator-login"
            onSubmit={(e) => {
              e.preventDefault();
              void authenticate();
            }}
          >
            <label>
              Operator token
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Backend OPERATOR_TOKEN"
                required
              />
            </label>
            <button className="add-to-bag" type="submit">
              Open operator controls
              <Icon name="arrow" size={17} />
            </button>
            <p>
              The token stays in this page’s memory. It is never saved to
              browser storage.
            </p>
          </form>
        ) : (
          <>
            <p className="merchant-offer-terms">
              Prepare requests, negotiate a permitted merchant quote, then approve real sandbox payments. Inventory is reserved only on quote acceptance. Shipping included · simulated tax $0. Existing obligations remain recorded.
            </p>
            <div className="operator-toolbar">
              <label className="demo-toggle">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => setDemo(e.target.checked)}
                />{" "}
                Prepare sandbox participants before activation
              </label>
              <label>Profile<select value={profile} onChange={e=>setProfile(e.target.value)}><option value="small">Small live · capacity 5 · tiers 3/5</option><option value="large">Large illustrative · capacity 60 · tiers 25/50</option><option value="legacy">Preserved calculator · fixed $65</option></select></label>
              {profile!=="legacy" && <label>Closing window · seconds<input className="operator-deadline" type="number" min={90} max={1800} value={closeSeconds} onChange={e=>setCloseSeconds(Number(e.target.value))}/></label>}
              <label>
                Scenario
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                >
                  <option value="success">Five buyers · success</option>
                  <option value="deadline">Deadline · below minimum</option>
                  {config?.mode === "fixture" && (
                    <>
                      <option value="partial">
                        Fixture · fifth capture fails
                      </option>
                      <option value="refund_pending">
                        Fixture · refund stays pending
                      </option>
                    </>
                  )}
                </select>
              </label>
              <button
                className="add-to-bag"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const r = await api<Created>(
                      "/operator/runs",
                      { scenario, demo, profile, close_seconds: closeSeconds },
                      token,
                    );
                    setCreated(r);
                    setSelected(r.run_id);
                    setEvidence(
                      await api("/operator/runs/" + r.run_id, undefined, token),
                    );
                  }, "Run prepared. Review requests and negotiate before approving payments.")
                }
              >
                Prepare run
                <Icon name="plus" size={17} />
              </button>
            </div>
            <div className="run-selection">
              <label>
                Demo run
                <select
                  value={selected}
                  onChange={async (e) => {
                    setSelected(e.target.value);
                    setCreated(null);
                    setEvidence(
                      await api(
                        "/operator/runs/" + e.target.value,
                        undefined,
                        token,
                      ),
                    );
                  }}
                >
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id.slice(0, 8)} · {r.scenario} · {r.status}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                onClick={() =>
                  action(async () => {
                    const links = await api<Created>(
                      "/operator/runs/" + selected + "/preparation-links",
                      {},
                      token,
                    );
                    setCreated(links);
                  }, "Preparation links refreshed. Existing approvals retained.")
                }
              >
                Get preparation links
                <Icon name="external" size={15} />
              </button>
            </div>
            {created && (
              <div className="preparation">
                <h2>Prepare sandbox buyers</h2>
                <p>
                  {config?.mode === "fixture"
                    ? "Open each invitation to explicitly simulate approval, or use the fixture preparation control below."
                    : "Prepare four genuine sandbox approvals using distinct buyer accounts, then let the judge approve the fifth. Preparation expires after 30 minutes."}
                  {config?.mode === "connected" &&
                    (assistantEnabled
                      ? " Sam’s live recommendation should reject the two-day delivery requirement. Recommendations do not restrict ordinary checkout."
                      : " AI recommendations are disabled for this payment demo.")}
                </p>
                <ul>
                  {created.preparation_links.map((p) => (
                    <li key={p.buyer_id}>
                      <strong>{p.name}</strong>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Open buyer invitation
                        <Icon name="external" size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
                <a
                  className="judge-link"
                  href={created.judge_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open judge shopping session
                  <Icon name="arrow" size={17} />
                </a>
                <small>
                  Disclose that these authorizations were prepared before the
                  presentation. A preparation persona is never a payment approval.
                </small>
              </div>
            )}
            {evidence && (
              <>
                <section className="operator-group">
                  <div>
                    <h2>{evidence.group.status.replace("_", " ")}</h2>
                    <p>
                      <strong>{confirmed}/{evidence.offer?.capacity ?? 5}</strong> confirmed authorizations ·{" "}
                      {
                        evidence.buyers.filter(
                          (b) =>
                            b.capture_status === "COMPLETED" &&
                            b.refund_status !== "COMPLETED",
                        ).length
                      }
                      /{evidence.offer?.capacity ?? 5} completed captures
                    </p>
                    <small>
                      {evidence.group.deadline
                        ? "Deadline: " +
                          new Date(evidence.group.deadline).toLocaleTimeString()
                        : "Timer not started"}
                    </small>
                    <p>
                      {evidence.group.inventory_reserved} units reserved ·
                      simulated inventory
                    </p>
                    {evidence.group.needs_attention && (
                      <p role="alert">
                        Operations need merchant attention. Workflow state
                        remains {evidence.group.status}.
                      </p>
                    )}
                    {!evidence.group.activated && (
                      <small>
                        Preparation expires{" "}
                        {new Date(
                          evidence.group.preparation_expires_at,
                        ).toLocaleString()}
                      </small>
                    )}
                    {evidence.group.failure_reason && (
                      <p>{evidence.group.failure_reason}</p>
                    )}
                  </div>
                  <div className="operator-actions">
                    {config?.mode === "fixture" &&
                      evidence.group.status === "OPEN" &&
                      !evidence.group.activated && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() =>
                            action(
                              () =>
                                api(
                                  "/operator/runs/" +
                                    selected +
                                    "/fixture-prepare",
                                  {},
                                  token,
                                ),
                              "Explicit fixture approval requested for four prepared buyers. No PayPal calls.",
                            )
                          }
                        >
                          Simulate four buyer approvals
                        </button>
                      )}
                    <button
                      className="coalition-button"
                      disabled={
                        busy ||
                        evidence.group.status !== "OPEN" ||
                        evidence.group.activated
                      }
                      onClick={() =>
                        action(
                          () =>
                            api(
                              "/operator/runs/" + selected + "/activate",
                              {},
                              token,
                            ),
                          "Run activated. Tiered quotes retain their accepted deadline.",
                        )
                      }
                    >
                      Activate prepared run
                      <Icon name="clock" size={17} />
                    </button>
                    {evidence.group.status === "OPEN" && (
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () =>
                              api(
                                "/operator/runs/" + selected + "/cancel",
                                {},
                                token,
                              ),
                            "Cancellation requested; inventory stays reserved until all payment obligations resolve.",
                          )
                        }
                      >
                        Cancel open offer
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      disabled={busy || evidence.group.status === "SETTLING"}
                      onClick={() =>
                        action(
                          () =>
                            api(
                              "/operator/runs/" +
                                selected +
                                (evidence.group.status === "SUCCEEDED"
                                  ? "/refund-cleanup"
                                  : "/cleanup"),
                              {},
                              token,
                            ),
                          "Cleanup requested. Wait for provider-confirmed voids and refunds before archiving.",
                        )
                      }
                    >
                      Reconcile & clean up
                    </button>
                    {config?.mode === "fixture" &&
                      evidence.buyers.some(
                        (b) => b.refund_status === "PENDING",
                      ) && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() =>
                            action(
                              () =>
                                api(
                                  "/operator/runs/" +
                                    selected +
                                    "/fixture-refunds",
                                  {},
                                  token,
                                ),
                              "Fixture pending refunds marked completed. This is simulated evidence only.",
                            )
                          }
                        >
                          Simulate pending refunds completing
                        </button>
                      )}
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        action(
                          () =>
                            api(
                              "/operator/runs/" + selected + "/archive",
                              {},
                              token,
                            ),
                          "Run archived; payment records retained.",
                        )
                      }
                    >
                      Archive resolved run
                    </button>
                  </div>
                </section>
                <section className="evidence-table">
                  <h2>Buyer decisions & payment evidence</h2>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Buyer</th>
                          <th>Decision</th>
                          <th>Authorization</th>
                          <th>Capture</th>
                          <th>Refund / void</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evidence.buyers.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.name}</strong>
                              <small>
                                {b.prepared
                                  ? "Preparation persona"
                                  : "Judge session"}
                              </small>
                            </td>
                            <td>
                              {!assistantEnabled
                                ? "Not enabled"
                                : b.result?.guardrail_override
                                  ? "Code rejected (model: " +
                                    b.result.model_result?.decision +
                                    ")"
                                  : b.result?.decision ||
                                    (b.decision_status === "failed"
                                      ? "Assistant unavailable"
                                      : b.decision_status)}
                              {assistantEnabled && (
                                <small>{b.result?.explanation || b.decision_error}</small>
                              )}
                            </td>
                            <td>
                              {b.authorization_status || "Not authorized"}
                              <small>{b.authorization_id}</small>
                            </td>
                            <td>{b.capture_status || "Not captured"}</td>
                            <td>
                              {b.refund_status
                                ? "Refund: " + b.refund_status
                                : b.void_status || "—"}
                              {b.error && (
                                <small className="error-text">{b.error}</small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="operator-ledger">
                  <h2>Durable operations</h2>
                  {evidence.operations.length ? (
                    <ul>
                      {evidence.operations.map((o) => (
                        <li key={o.id}>
                          <strong>{o.kind}</strong>
                          <span>{o.status}</span>
                          <code>{o.response?.id || o.id}</code>
                          <small>{o.response?.status || o.error}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No payment operations yet.</p>
                  )}
                  <h3>Worker jobs</h3>
                  {evidence.requests && <details><summary>Request evaluations</summary><ul>{evidence.requests.map(r=><li key={r.id}><strong>{r.status}</strong><small>{r.error}</small></li>)}</ul></details>}
                  {evidence.negotiations && <details><summary>Negotiation attempts and validation</summary><ul>{evidence.negotiations.map(n=><li key={n.id}><strong>{n.status}</strong><small>{n.error}</small></li>)}{evidence.rounds?.map(r=><li key={r.id}><strong>{r.public_summary}</strong><small>{r.valid?"Validated":"Invalid output"}{r.private_error?": "+r.private_error:""}</small></li>)}</ul></details>}
                  <ul>
                    {evidence.jobs.map((j) => (
                      <li key={j.id}>
                        <strong>{j.kind}</strong>
                        <span>
                          {j.status} · {j.attempts} attempts
                        </span>
                        <small>{j.error}</small>
                        {j.status === "recovery" && (
                          <button
                            className="text-button"
                            onClick={() =>
                              action(
                                () =>
                                  api(
                                    "/operator/jobs/" + j.id + "/retry",
                                    {},
                                    token,
                                  ),
                                "Recovery job retried with the same operation keys. Expired idempotency windows remain blocked.",
                              )
                            }
                          >
                            Retry job #{j.id}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {config?.mode === "connected" &&
                    evidence.buyers.some(
                      (b) => b.commitment_id && b.capture_status,
                    ) && (
                      <form
                        className="refund-recovery"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action(
                            () =>
                              api(
                                "/operator/commitments/" +
                                  recoveryCommitment +
                                  "/confirm-refund",
                                { refund_id: recoveryId },
                                token,
                              ),
                            "Provider refund proof queued. The worker verifies completion, amount, and ownership before updating the receipt.",
                          );
                        }}
                      >
                        <h3>Confirm a manually recovered refund</h3>
                        <p>
                          After a failed refund, recover it with PayPal first.
                          Enter the completed refund ID; this control checks
                          proof and never requests another refund.
                        </p>
                        <label>
                          Captured buyer
                          <select
                            required
                            value={recoveryCommitment}
                            onChange={(e) =>
                              setRecoveryCommitment(e.target.value)
                            }
                          >
                            <option value="">Select buyer</option>
                            {evidence.buyers
                              .filter(
                                (b) => b.commitment_id && b.capture_status,
                              )
                              .map((b) => (
                                <option key={b.id} value={b.commitment_id!}>
                                  {b.name} ·{" "}
                                  {b.refund_status || "refund unresolved"}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Completed PayPal refund ID
                          <input
                            required
                            value={recoveryId}
                            onChange={(e) => setRecoveryId(e.target.value)}
                            pattern="[A-Za-z0-9]{1,100}"
                          />
                        </label>
                        <button
                          type="submit"
                          className="secondary-button"
                          disabled={busy}
                        >
                          Verify refund proof
                        </button>
                      </form>
                    )}
                  <h3>Provider observations with provenance</h3>
                  <ul>
                    {evidence.observations?.map((o, i) => (
                      <li key={i}>
                        <strong>
                          {o.kind}: {o.provider_status}
                        </strong>
                        <span>{o.source}</span>
                        <code>{o.resource_id}</code>
                        <time>{new Date(o.observed_at).toLocaleString()}</time>
                        {o.event_id && <small>Receipt {o.event_id}</small>}
                      </li>
                    ))}
                  </ul>
                  <h3>Verified webhook receipts</h3>
                  {evidence.events.length ? (
                    <ul>
                      {evidence.events.map((e) => (
                        <li key={e.id}>
                          <code>{e.id}</code>
                          <span>
                            {e.event_type} ·{" "}
                            {e.verified ? "Signature verified" : "Unverified"} ·{" "}
                            {e.processed_at ? "processed" : "queued"} ·{" "}
                            {new Date(e.received_at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No processed webhook matched to this run. The simulator
                      cannot prove postback verification.
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </main>
    </div>
  );
}
