import { useEffect, useState } from 'react';
import { request } from '../../connected';
import { money, type ShopId } from '../../fixture';
import { Icon } from '../../components/Controls';
export type Strategy = { max_round_discount_bp: number; min_margin_over_floor_cents: number; prefer_older: boolean; bundles: 'off'|'allow'|'prefer'; free_domestic: 'never'|'to_win'|'always'; kit: boolean };
type Goal = { goal_text: string; summary: string; strategy: Strategy; applied_at?: string | null; draft_id?: string; draft?: Goal | null };
const suggestions = ['Win two-item bundles with free shipping in Korea. Up to 8% off a round, but keep $1.50 above my lowest price.', 'Sell my older packaging first this month. Up to 10% off a round is fine.', 'Protect my margins: keep at least $3 above my lowest price and no free shipping.'];
const suggestionLabels = ['Win two-item bundles', 'Clear older stock first', 'Protect my margins'];

export function ruleChips(value: Strategy) {
  return [`Up to ${value.max_round_discount_bp / 100}% off a round`, `${money(value.min_margin_over_floor_cents)} above lowest, at least`, value.bundles === 'prefer' ? 'Prefers bundles' : value.bundles === 'allow' ? 'Bundles allowed' : 'No bundles', value.free_domestic === 'always' ? 'Always free Korea shipping' : value.free_domestic === 'to_win' ? 'Free Korea shipping to win' : 'Charges Korea shipping', ...(value.prefer_older ? ['Older packaging first'] : [])];
}

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
  const locked = readOnly || busy || !applied;
  const shown = draft || applied;
  const changed = (key: keyof Strategy) => !!draft && !!applied && draft.strategy[key] !== applied.strategy[key];
  const count = draft && applied ? (Object.keys(draft.strategy) as (keyof Strategy)[]).filter(changed).length : 0;
  return <div className="goal-columns">
    <form className="card goal-card" onSubmit={compile}>
      <label htmlFor="merchant-goal" className="card-title">Your shop goal</label>
      <textarea id="merchant-goal" rows={5} minLength={3} maxLength={1000} required value={text} disabled={locked} onChange={event => setText(event.target.value)} />
      <div className="suggestions"><span>Try</span>{suggestionLabels.map((label, index) => <button type="button" key={label} className={`chip-button${text === suggestions[index] ? ' selected' : ''}`} disabled={locked} onClick={() => setText(suggestions[index])}>{label}</button>)}</div>
      <div className="form-actions"><button className="button accent" disabled={locked}>{busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="agent" size={17} />}{busy ? 'Reading your goal…' : 'Review rules'}</button><span className="muted">Nothing changes until you apply.</span></div>
      <p role="status" className="form-status">{message}</p>
      <p className="privacy"><Icon name="lock" size={16} />Your lowest prices and costs stay private. Shoppers and other shops never see them, and your agent never goes below them.</p>
    </form>
    <section className={`card rules-card${draft ? ' has-draft' : ''}`} aria-labelledby="rules-title">
      <h2 id="rules-title">{draft ? 'Rules to apply' : 'Rules your agent follows'}</h2>
      <div className="rule-row"><div><strong>Never below your lowest price</strong><small>Set per product in Products</small></div><span className="pill pill-neutral"><Icon name="lock" size={14} />Always on</span></div>
      {shown && <>
        <Rule label="Discount per round" sub="At most · Rally caps this at 20%" isNew={changed('max_round_discount_bp')}><span className="meter" role="img" aria-label={`${shown.strategy.max_round_discount_bp / 100}% at most`}><span className="meter-track"><span style={{ width: `${Math.min(100, shown.strategy.max_round_discount_bp / 20)}%` }} /></span><b className="money">{shown.strategy.max_round_discount_bp / 100}%</b></span></Rule>
        <Rule label="Keep above your lowest price" sub="Your agent never bids closer than this" isNew={changed('min_margin_over_floor_cents')}><span className="value-box money">{money(shown.strategy.min_margin_over_floor_cents)}</span></Rule>
        <Rule label="Bundles" sub="Two of your items sold together, one price" isNew={changed('bundles')}><Segments value={shown.strategy.bundles} options={[['off', 'Off'], ['allow', 'Allow'], ['prefer', 'Prefer']]} label="Bundles" /></Rule>
        <Rule label="Free shipping in Korea" sub="Covers your parcel to the Seoul hub" isNew={changed('free_domestic')}><Segments value={shown.strategy.free_domestic} options={[['never', 'Never'], ['to_win', 'To win'], ['always', 'Always']]} label="Free shipping in Korea" /></Rule>
        <Rule label="Sell older packaging first" sub="Only when the shopper allows it" isNew={changed('prefer_older')}><span className={`switch${shown.strategy.prefer_older ? ' on' : ''}`} role="img" aria-label={shown.strategy.prefer_older ? 'On' : 'Off'}><span /></span></Rule>
      </>}
      <div className="rules-foot">{draft ? <><p>{count ? `${count} ${count === 1 ? 'rule' : 'rules'} from your goal. ` : 'Your goal matches the rules you already have. '}{draft.summary}</p><div className="foot-actions"><button type="button" className="button ghost" disabled={busy} onClick={() => setDraft(null)}>Discard</button><button type="button" className="button primary-dark" disabled={readOnly || busy || draft.goal_text !== text} onClick={() => void apply()}><Icon name="check" size={17} />Apply</button></div></> : <p>{applied?.applied_at ? 'Applied. Your agent uses these on every new order.' : 'Launch rules. Write a goal to change them.'}</p>}</div>
    </section>
  </div>;
}

function Rule({ label, sub, isNew, children }: { label: string; sub: string; isNew: boolean; children: React.ReactNode }) {
  return <div className={`rule-row${isNew ? ' is-new' : ''}`}><div><strong>{label}</strong><small>{sub}{isNew && <em className="new-tag">From your goal</em>}</small></div>{children}</div>;
}
function Segments({ value, options, label }: { value: string; options: [string, string][]; label: string }) {
  return <span className="segments" role="img" aria-label={`${label}: ${options.find(([key]) => key === value)?.[1]}`}>{options.map(([key, text]) => <span key={key} className={key === value ? 'on' : ''}>{text}</span>)}</span>;
}
