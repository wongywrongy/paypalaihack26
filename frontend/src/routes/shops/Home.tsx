import { useEffect, useState } from 'react';
import { orderNumber, request } from '../../connected';
import { money, product, type Currency, type ShopId } from '../../fixture';
import { Photo } from '../../components/MemberUI';
import { Icon, Notice, Pill } from '../../components/Controls';
import { ruleChips, type Strategy } from './GoalsForm';

type Step = { key: 'prices' | 'goal' | 'order' | 'handoff' | 'paid'; done: boolean; product_id?: string | null; floor_usd?: number | null; summary?: string | null; order_id?: string | null; won?: string[] | null; status?: string | null; amount_usd?: number | null };
type Auction = { id: string; created_at: string; items: string[]; won: string[]; total: number; currency: Currency; reason: string; payout_status: string };
type HomeData = { steps: Step[]; goal: { goal_text?: string; summary?: string; strategy?: Strategy; applied_at?: string | null }; recent: Auction[]; payouts: { total_usd: number; count: number } };

const titles = { prices: 'Set your prices', goal: 'Give your agent a goal', order: 'Win a Rally order', handoff: 'Hand off the parcel', paid: 'Get paid by PayPal' };

function detail(step: Step) {
  if (step.key === 'prices') return step.done && step.product_id ? `${product(step.product_id).name}: lowest price ${money(step.floor_usd || 0)}` : 'Check the lowest price your agent may bid on each product.';
  if (step.key === 'goal') return step.done && step.summary ? step.summary : 'Say what you want in plain words. You approve the rules before they apply.';
  if (step.key === 'order') return step.done && step.order_id ? `Won ${step.won?.length || 0} ${step.won?.length === 1 ? 'item' : 'items'} in ${orderNumber(step.order_id)}` : 'Your agent bids when a shopper’s bag includes your products. Shop it yourself to see.';
  if (step.key === 'handoff') return step.done ? 'Your parcel is with the Seoul hub. Rally ships one box abroad.' : 'Send what you won to the Seoul hub.';
  return step.done ? `${money(step.amount_usd || 0)} paid to your PayPal account` : step.status ? `PayPal is sending ${money(step.amount_usd || 0)}` : 'Your payout is sent as soon as you record the hand-off.';
}

function action(step: Step) {
  if (step.key === 'prices') return <a className="button secondary" href="/shops/products"><Icon name="products" size={17} />Open products</a>;
  if (step.key === 'goal') return <a className="button secondary" href="/shops/settings"><Icon name="agent" size={17} />Set a goal</a>;
  if (step.key === 'order') return <a className="button accent" href="/shop"><Icon name="store" />Open your storefront<Icon name="external" size={15} /></a>;
  if (step.key === 'handoff') return <a className="button accent" href={`/shops/orders?order=${encodeURIComponent(step.order_id || '')}`}><Icon name="truck" />Hand off {orderNumber(step.order_id || '')}</a>;
  return <a className="button secondary" href="/shops/payouts"><Icon name="payouts" size={17} />See payouts</a>;
}

export default function Home({ shop, revision }: { shop: ShopId; revision: number }) {
  const [data, setData] = useState<HomeData | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    const load = () => request<HomeData>(`/shops/${shop}/home`, { signal: controller.signal }).then(setData).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    void load();
    const timer = setInterval(load, 4000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [shop, revision, retry]);
  if (error && !data) return <Notice onRetry={() => setRetry(value => value + 1)}>{error}</Notice>;
  if (!data) return <p role="status" className="loading">Loading your shop…</p>;
  const done = data.steps.filter(step => step.done).length;
  const active = data.steps.findIndex(step => !step.done);
  const chips = data.goal.strategy ? ruleChips(data.goal.strategy) : [];
  return <div className="home-grid">
    <div className="stack">
      <section className="card setup-card" aria-labelledby="setup-title">
        <div className="card-head"><h2 id="setup-title">{active < 0 ? 'You’re set up on Rally' : 'Get your first Rally payout'}</h2><span className="money muted">{done} of 5</span></div>
        <div className="setup-progress" aria-hidden="true">{data.steps.map((step, index) => <span key={step.key} className={step.done ? 'done' : index === active ? 'active' : ''} />)}</div>
        <ol className="setup-steps">{data.steps.map((step, index) => <li key={step.key} className={step.done ? 'done' : index === active ? 'active' : 'todo'} aria-current={index === active ? 'step' : undefined}>
          <span className="step-mark" aria-hidden="true">{step.done ? <Icon name="check" size={15} /> : index === active ? <span /> : index + 1}</span>
          <div><strong>{titles[step.key]}</strong><p>{detail(step)}</p>{index === active && <div className="step-actions">{action(step)}</div>}</div>
        </li>)}</ol>
      </section>
      <section className="card list-card" aria-labelledby="recent-title">
        <div className="card-head"><h2 id="recent-title">Recent auctions</h2><a className="button ghost small" href="/shops/activity">All activity<Icon name="right" size={16} /></a></div>
        {data.recent.length ? <ul className="row-list">{data.recent.map(row => <li key={row.id}><a href={`/shops/orders?order=${encodeURIComponent(row.id)}`}>
          <span className="thumbs">{row.items.slice(0, 2).map(id => <Photo key={id} item={product(id)} />)}</span>
          <span className="row-main"><strong>{row.items.map(id => product(id).name).join(' + ')}</strong><small><span className="money">{orderNumber(row.id)}</span> · {row.reason}</small></span>
          {row.won.length ? <Pill tone="won">Won {row.won.length} of {row.items.length}</Pill> : <Pill>Outbid</Pill>}
        </a></li>)}</ul> : <p className="empty">No auctions yet. Your first one appears here.</p>}
      </section>
    </div>
    <div className="stack">
      <section className="card agent-card" aria-labelledby="agent-title">
        <div className="card-head"><span className="agent-mark" aria-hidden="true"><Icon name="agent" size={19} /></span><h2 id="agent-title">Your agent</h2><Pill tone="won" dot>Bidding</Pill></div>
        {data.goal.applied_at && data.goal.goal_text ? <blockquote className="goal-quote">“{data.goal.goal_text}”</blockquote> : <p className="muted">Using launch rules. Give it a goal in your own words.</p>}
        <ul className="chips">{chips.map(chip => <li key={chip}>{chip}</li>)}</ul>
        <a className="button secondary" href="/shops/settings"><Icon name="agent" size={17} />{data.goal.applied_at ? 'Edit goal' : 'Set a goal'}</a>
      </section>
      <section className="card stat-card"><span>Paid to you by PayPal</span><strong className="money">{money(data.payouts.total_usd, 'USD')}</strong><small>{data.payouts.count} {data.payouts.count === 1 ? 'payout' : 'payouts'} completed</small></section>
    </div>
  </div>;
}
