import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildBoard, onScene, pace, valueAt, type Board } from '../auction.ts';
import { money, SHOP_NAMES } from '../schema.ts';
import { BANNED, C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, pop, rise, shake, typed } from '../motion.ts';
import { ClipFrame, Photo, Rich, Tick } from '../ui.tsx';
import { REJECT_AT, type Scene } from '../timeline.ts';

// Seconds of the scene the saved events are spread across, leaving the award on screen at the end.
const FROM = 1.5, UNTIL = 33;
// An agent-written bid holds 2 s when the scene has room, never less than 1.2 s; the first rejection gets its own beat.
const GAPS = [2, 1.2], REJECT_BEAT = 3;
const CHECKS = ["within the shop's limits", 'in stock', 'total under the hold'];
// Plain words for each rejection reason. No amount: the limit itself is private.
const REASONS: Record<string, string> = { limit: 'Bid below what the shop can accept', raise: 'Raised a price the shop had already offered', rules: "Broke a rule from the owner's goal", invalid: 'Offered terms the shop cannot give' };

const raw = buildBoard(manifest.events);
const timing = pace(raw, { from: FROM, until: UNTIL, gaps: GAPS, rejectAt: REJECT_AT, rejectBeat: REJECT_BEAT });
const board: Board = onScene(raw, timing);
const hold = manifest.run.held_minor;
const shopName = (id: string) => SHOP_NAMES[id as keyof typeof SHOP_NAMES];
const cash = (value: number) => money(value, manifest.run.currency);
// Whole minor units every frame, and never above the hold.
const ticker = (value: number) => cash(Math.min(hold, Math.round(value)));
const firstReject = board.rejected[0];
// The latest card per shop: its bid, or the rejection that came just before code's replacement.
const cards = [...board.bids, ...board.rejected].sort((a, b) => a.t - b.t || a.seq - b.seq);
// Honest about the footage's speed: the real auction is usually shorter than the scene.
const slowed = raw.awardAt / (UNTIL - FROM) < 0.9;
const winners = board.shops.filter(shop => board.items.some(item => item.lanes.some(lane => lane.shop === shop && lane.wonAt !== null)));

function Chip({ kind }: { kind: 'agent' | 'checks' }) {
  return <span style={{ fontSize: 17, fontWeight: 600, borderRadius: 999, padding: '3px 11px', whiteSpace: 'nowrap', ...(kind === 'agent' ? { background: C.butter, color: C.ink } : { background: C.mint, color: C.saving }) }}>{kind === 'agent' ? 'Written by agent' : 'Sent by the checks'}</span>;
}

function CheckRow({ from }: { from: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ display: 'flex', gap: 20, fontSize: 18, color: C.saving }}>{CHECKS.map((label, i) => {
    const on = interpolate(frame, [from + i * 4, from + i * 4 + DUR.micro], [0, 1], clamp);
    return <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.3 + 0.7 * on }}><Tick size={20} progress={on} />{label}</span>;
  })}</div>;
}

function Stamp({ at }: { at: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const p = pop(frame, fps, at);
  if (frame < at) return null;
  return <div style={{ position: 'absolute', right: 18, top: 16, border: `2px solid ${C.accent}`, color: C.accentHover, background: C.surface, borderRadius: 10, padding: '6px 14px', fontSize: 21, fontWeight: 700, transform: `rotate(-3deg) scale(${1.25 - 0.25 * p})`, opacity: Math.min(1, p * 1.5) }}>Rejected by Rally's checks</div>;
}

function Lane({ shop, s, awarded }: { shop: string; s: number; awarded: boolean }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const card = [...cards].reverse().find(row => row.shop === shop && row.t <= s);
  const at = card ? Math.round(card.t * fps) : 0;
  const rejected = card?.kind === 'rejected';
  const agent = card?.kind === 'bid' && card.authored === 'agent';
  const fromChecks = card?.kind === 'bid' && card.authored === 'code' && board.rejected.some(row => row.shop === shop && row.t <= card.t);
  // Name and chip first, the note about 6 frames later, then prices and checks once the note is typed.
  const note = card?.note && !rejected && !BANNED.test(card.note) ? card.note : '';
  const noteAt = at + 6;
  const priceAt = agent ? noteAt + Math.min(fps, Math.ceil(note.length / 40 * fps)) : at;
  const items = board.items.filter(item => item.lanes.some(lane => lane.shop === shop));
  const winAt = Math.round(board.awardAt * fps) + winners.indexOf(shop) * 4;
  const won = awarded && winners.includes(shop), dim = awarded && !winners.includes(shop);
  const green = won ? enter(frame, fps, winAt, DUR.micro) : 0;
  const isFirstReject = rejected && card === firstReject;
  const latest = card && cards.filter(row => row.t <= s).at(-1) === card && !awarded;
  return <div style={{ position: 'relative', borderRadius: 16, padding: '16px 20px', background: green > 0.5 ? C.mint : C.surface, border: `1px solid ${green > 0.5 ? C.mint : rejected ? C.accent : latest ? C.ink : C.line}`, opacity: dim ? interpolate(frame, [winAt, winAt + DUR.standard], [1, 0.4], clamp) : 1, transform: `translateX(${rejected ? shake(frame, at + 16) : 0}px)`, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div key={card?.seq} style={{ display: 'flex', alignItems: 'center', gap: 12, ...rise(card ? enter(frame, fps, at) : 1, 10) }}>
      <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.015em', color: green > 0.5 ? C.saving : C.ink }}>{shopName(shop)}</span>
      {(agent || rejected) && <Chip kind="agent" />}
      {fromChecks && <Chip kind="checks" />}
    </div>
    {rejected
      ? <div style={{ fontSize: 22, color: C.accentHover, minHeight: 56 }}>{frame >= noteAt ? REASONS[card.reason] : ''}</div>
      : <div style={{ fontSize: 22, lineHeight: 1.3, color: C.ink, minHeight: 56, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note ? <Rich text={agent ? typed(note, frame, noteAt, fps) : note} /> : <span style={{ color: C.muted }}>{card ? '' : 'Getting ready to bid'}</span>}</div>}
    <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
      {items.map(item => {
        const lane = item.lanes.find(row => row.shop === shop)!;
        // The glide starts once the note is typed, so the price lands after the agent has spoken.
        const steps = lane.steps.map(step => step.t === card?.t ? { ...step, t: priceAt / fps } : step);
        const price = valueAt(steps, s, DUR.standard / fps, ease);
        const passed = lane.passedAt !== null && s >= lane.passedAt;
        const winner = awarded && lane.wonAt !== null;
        return <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: passed ? 0.5 : 1 }}>
          <Photo id={item.id} size={40} />
          <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 26, letterSpacing: '-.02em', color: winner ? C.saving : C.ink, fontWeight: winner ? 600 : 400 }}>{passed ? 'Pass' : price === null ? '' : cash(Math.round(price))}</span>
        </div>;
      })}
    </div>
    {/* Space for the checks is kept from the start, so lanes never jump when a bid lands. */}
    <div style={{ height: 24 }}>{card?.kind === 'bid' && <CheckRow from={priceAt} />}</div>
    {rejected && <Stamp at={at + (isFirstReject ? 26 : 8)} />}
  </div>;
}

export function Bidding({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const s = frame / fps;
  const total = valueAt(board.totals, s, DUR.scene / fps, ease) ?? hold;
  const awarded = s >= board.awardAt;
  const round = board.rounds.filter(step => step.t <= s).length;
  const summaryAt = Math.round(board.awardAt * fps) + winners.length * 4 + DUR.standard;
  const doubled = timing.doubleFrom !== null && s >= timing.doubleFrom && !awarded;
  return <>
    <ClipFrame name="06-bidding" seconds={scene.duration} fit left={40} top={40} width={1000} warp={manifest.clips['06-bidding'] ? timing.knots : undefined} tag={doubled ? '2× speed' : slowed ? 'Slowed' : null} />
    {/* What the shops are bidding on: the bag, with the best price on each item so far. */}
    <div style={{ position: 'absolute', left: 40, top: 700, width: 1000, display: 'flex', gap: 28, ...rise(enter(frame, fps, 6)) }}>
      {board.items.map(item => {
        const best = Math.min(...item.lanes.map(lane => valueAt(lane.steps, s, DUR.standard / fps, ease) ?? Infinity));
        return <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <Photo id={item.id} size={76} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{manifest.names[item.id]}</div>
            <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 24, color: C.muted }}>{Number.isFinite(best) ? cash(Math.round(best)) : ''}</div>
          </div>
        </div>;
      })}
    </div>
    <div style={{ position: 'absolute', left: 1080, top: 40, width: 800, height: 880, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 6 }}>
        <div>
          <div style={{ fontSize: 20, color: C.muted, marginBottom: 10 }}>Round {Math.min(3, round + (awarded ? 0 : 1))} of 3</div>
          <div style={{ display: 'flex', gap: 10 }}>{[1, 2, 3].map(n => {
            const done = round >= n, active = !awarded && round + 1 === n;
            const at = board.rounds.find(step => step.value === n)?.t;
            const p = at === undefined ? 0 : pop(frame, fps, Math.round(at * fps));
            return <div key={n} style={{ width: 18, height: 18, borderRadius: 9, background: done ? C.accent : C.surface, border: `2px solid ${done || active ? C.accent : C.line}`, transform: `scale(${done ? 0.85 + 0.15 * p : 1})` }} />;
          })}</div>
        </div>
        <div style={{ textAlign: 'right', width: 460 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, color: C.accentHover }}>
            <div style={{ flex: 1, height: 1, background: C.accent }} />
            <span>PayPal hold <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{cash(hold)}</span></span>
          </div>
          <div style={{ fontSize: 20, color: C.muted, marginTop: 8 }}>Total, all in</div>
          <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 76, lineHeight: 1.05, letterSpacing: '-.03em', color: awarded ? C.saving : C.ink }}>{ticker(total)}</div>
        </div>
      </div>
      {board.shops.map(shop => <Lane key={shop} shop={shop} s={s} awarded={awarded} />)}
      <div style={{ marginTop: 'auto', minHeight: 64, display: 'grid', placeItems: 'center', borderRadius: 12, background: C.mint, color: C.saving, fontSize: 26, fontWeight: 700, ...rise(enter(frame, fps, summaryAt), 24), visibility: frame >= summaryAt ? 'visible' : 'hidden' }}>{manifest.vars.agent_line}</div>
    </div>
  </>;
}

