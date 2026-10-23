import { useEffect, useState } from 'react';
import { request } from '../connected';
import { money, type Currency } from '../fixture';
type Operation = { id: string; kind: string; status: string; provider_ref?: string | null; request_id?: string; order_id?: string | null; amount_minor?: number; currency?: Currency };
type SavedJob = { id: number; kind: string; status: string; error: string | null };
type Recovery = { operations: Operation[]; actions?: string; jobs?: SavedJob[]; tracking?: { order_id: string; status: string; request_id: string }[] };
export default function HubRecovery() {
  const [current, setCurrent] = useState<Recovery | null>(null), [earlier, setEarlier] = useState<Recovery | null>(null);
  const [error, setError] = useState(''), [earlierError, setEarlierError] = useState('');
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(''), [status, setStatus] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setError(''); setEarlierError('');
    Promise.allSettled([
      request<Recovery>('/hub/recovery', { signal: controller.signal }),
      request<Recovery>('/hub/legacy/recovery', { signal: controller.signal }),
    ]).then(([modern, legacy]) => {
      if (controller.signal.aborted) return;
      if (modern.status === 'fulfilled') setCurrent(modern.value); else setError(modern.reason.message);
      if (legacy.status === 'fulfilled') setEarlier(legacy.value); else setEarlierError(legacy.reason.message);
    });
    return () => controller.abort();
  }, [revision]);
  async function reconcile(operation: Operation) {
    if (!operation.request_id) return;
    setBusy(operation.id); setStatus('');
    try {
      await request(`/hub/recovery/${encodeURIComponent(operation.request_id)}/reconcile`, { method: 'POST', body: {} });
      setStatus('PayPal status checked. The saved operation result appears below.'); setRevision(value => value + 1);
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(''); }
  }
  async function resume(job: SavedJob) {
    setBusy(`job:${job.id}`); setStatus('');
    try {
      await request(`/hub/jobs/${job.id}/resume`, { method: 'POST', body: {} });
      setStatus('The saved job is queued with its original operation references.'); setRevision(value => value + 1);
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(''); }
  }
  return <section className="recovery"><h2>Payment recovery</h2><p>Check saved payment results before taking another action.</p>{current?.actions && <p className="fine">{current.actions}</p>}{error ? <p role="alert">{error}</p> : !current ? <p role="status">Loading payment operations…</p> : !current.operations.length ? <p>No payments need a check.</p> : <ul className="order-history">{current.operations.map(operation => <li className="shop-group" key={operation.id}><h3>{operation.kind.replaceAll('_', ' ')}</h3><p>{operation.status.replaceAll('_', ' ')}{operation.order_id ? ` · Order ${operation.order_id}` : ''}</p><OperationReference operation={operation} />{operation.provider_ref && operation.request_id ? <button className="text-link" disabled={!!busy} onClick={() => reconcile(operation)}>{busy === operation.id ? 'Checking PayPal…' : 'Check PayPal status'}</button> : <p className="fine">Review the original PayPal activity. A provider reference is needed for automatic reconciliation.</p>}</li>)}</ul>}
    {!!current?.jobs?.length && <section><h3>Saved jobs</h3><p className="fine">Reconcile unresolved PayPal operations first. Resuming keeps the original operation references and payment limits.</p><ul className="order-history">{current.jobs.map(job => <li className="shop-group" key={job.id}><h4>{job.kind.replaceAll('_', ' ')}</h4><p>{job.status.replaceAll('_', ' ')}</p>{job.status === 'recovery' && <button className="text-link" disabled={!!busy} onClick={() => resume(job)}>{busy === `job:${job.id}` ? 'Resuming saved job…' : 'Resume saved job'}</button>}</li>)}</ul></section>}
    {!!current?.tracking?.length && <section><h3>PayPal tracking updates</h3><ul className="order-history">{current.tracking.map(item => <li className="shop-group" key={item.request_id}><h4>Order {item.order_id}</h4><p>{item.status.replaceAll('_', ' ')}</p><p className="fine">Request: {item.request_id}</p></li>)}</ul></section>}
    <h3>Earlier payment operations</h3>{earlier?.actions && <p className="fine">{earlier.actions}</p>}{earlierError ? <p role="alert">{earlierError}</p> : !earlier ? <p role="status">Loading earlier operations…</p> : !earlier.operations.length ? <p>No earlier operations need a check.</p> : <ul className="order-history">{earlier.operations.map(operation => <li className="shop-group" key={operation.id}><h4>{operation.kind.replaceAll('_', ' ')}</h4><p>{operation.status.replaceAll('_', ' ')}</p>{operation.currency && operation.amount_minor !== undefined && <strong className="money">{money(operation.amount_minor, operation.currency)}</strong>}<OperationReference operation={operation} /><p className="fine">Read-only. Review the original PayPal activity before resolving this payment.</p></li>)}</ul>}
    {status && <p role="status">{status}</p>}<button className="text-link" onClick={() => setRevision(value => value + 1)}>Refresh recovery</button>
  </section>;
}
function OperationReference({ operation }: { operation: Operation }) {
  return <details className="breakdown"><summary>Operation references</summary><dl><div><dt>Operation</dt><dd>{operation.id}</dd></div>{operation.request_id && <div><dt>Request</dt><dd>{operation.request_id}</dd></div>}{operation.provider_ref && <div><dt>PayPal reference</dt><dd>{operation.provider_ref}</dd></div>}</dl></details>;
}
