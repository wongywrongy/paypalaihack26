import { useEffect, useState } from 'react';
import { request } from '../../connected';
import { money, type ShopId } from '../../fixture';
export type Strategy = { max_round_discount_bp: number; min_margin_over_floor_cents: number; prefer_older: boolean; bundles: 'off'|'allow'|'prefer'; free_domestic: 'never'|'to_win'|'always'; kit: boolean };
type Goal = { goal_text: string; summary: string; strategy: Strategy; applied_at?: string | null; draft_id?: string; draft?: Goal | null };
export default function GoalsForm({ shop, readOnly }: { shop: ShopId; readOnly: boolean }) {
  const [applied, setApplied] = useState<Goal | null>(null), [text, setText] = useState(''), [draft, setDraft] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { const controller = new AbortController(); request<Goal>(`/shops/${shop}/goals`, { signal: controller.signal }).then(goal => { setApplied(goal); setText(goal.goal_text); setDraft(goal.draft || null); }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); }); return () => controller.abort(); }, [shop]);
  async function compile(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { setDraft(await request<Goal>(`/shops/${shop}/goals/compile`, { method: 'POST', body: { text } })); setMessage('Review these rules, then Apply. Your current rules are still active.'); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  async function apply() {
    setBusy(true); setMessage('');
    try { const goal = await request<Goal>(`/shops/${shop}/goals/apply`, { method: 'POST', body: { draft_id: draft?.draft_id } }); setApplied(goal); setDraft(null); setMessage('Your goal is applied to new quotes.'); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  return <><p>Tell your agent what you want to sell. Your lowest prices always apply.</p><div className="goal-columns"><form className="request-form" onSubmit={compile}><label htmlFor="merchant-goal">Your shop goal</label><textarea id="merchant-goal" rows={5} minLength={3} maxLength={1000} required value={text} disabled={readOnly || busy || !applied} onChange={event => setText(event.target.value)} /><button className="primary" disabled={readOnly || busy || !applied}>{busy ? 'Working…' : 'Review rules'}</button><p role="status">{message}</p></form><section className="shop-group"><h2>{draft ? 'Rules to apply' : 'Applied rules'}</h2>{(draft || applied) && <StrategyRules value={(draft || applied)!.strategy} />}{draft && <><p>{draft.summary}</p><button className="primary" disabled={readOnly || busy || draft.goal_text !== text} onClick={() => void apply()}>Apply</button></>}{applied && draft && <p className="fine">Currently applied: {applied.summary}</p>}</section></div></>;
}
function StrategyRules({ value }: { value: Strategy }) {
  return <dl className="payout"><div><dt>Maximum round discount</dt><dd>{value.max_round_discount_bp / 100}%</dd></div><div><dt>Minimum above your lowest price</dt><dd>{money(value.min_margin_over_floor_cents)}</dd></div><div><dt>Packaging priority</dt><dd>{value.prefer_older ? 'Older, when permitted' : 'Current'}</dd></div><div><dt>Bundles</dt><dd>{value.bundles}</dd></div><div><dt>Free shipping in Korea</dt><dd>{value.free_domestic.replaceAll('_', ' ')}</dd></div><div><dt>Sample kit, where available</dt><dd>{value.kit ? 'Allowed' : 'Off'}</dd></div></dl>;
}
