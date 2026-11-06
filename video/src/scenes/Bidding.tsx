import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { anchored, buildBoard, onScene, valueAt, type AuctionEvent, type Board, type Knot } from '../auction.ts';
import { money, SHOP_NAMES } from '../schema.ts';
import { BANNED, C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, pop, rise, shake, toFrame, typed, view } from '../motion.ts';
import { Clip, Flight, Photo, Rich, Tick } from '../ui.tsx';
import { scene, spotAt } from '../plan.ts';
import type { Laid } from '../timeline.ts';

// The first seconds are the real board from the app; then the rebuilt board, full frame, takes over.
const LIVE = 2.2, SWAP = 0.4, FROM = LIVE + SWAP;
const CHECKS = ["within the shop's limits", 'in stock', 'total under the hold'];
const REASONS: Record<string, string> = { limit: 'Went below what the shop can accept', raise: 'Raised a price the shop had already offered', rules: 'Broke a rule the shop set for its agent', invalid: 'Offered terms the shop cannot give' };
// Where the real board's total sits in clip 06, and the camera on it.
const LIVE_TOTAL = { x: 330, y: 259, h: 54 }, LIVE_KEYS = [{ s: 0, x: 420, y: 300, zoom: 1.6 }];
const HEADER = { x: 1629, y: 201, size: 110 };

const raw = buildBoard(manifest.events);
const hold = manifest.run.held_minor;
const shopName = (id: string) => SHOP_NAMES[id as keyof typeof SHOP_NAMES];
const cash = (value: number) => money(value, manifest.run.currency);
const ticker = (value: number) => cash(Math.min(hold, Math.round(value)));
// Shown word for word; a long note keeps only its first sentence.
const clip110 = (note: string) => note.length > 110 ? note.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? note : note;

// The events each narrated line lands on.
function anchorsFor(laid: Laid, board: Board) {
  const reject = board.rejected[0];
  const replace = reject && board.bids.find(row => row.shop === reject.shop && row.t > reject.t);
  const agent = board.bids.find(row => row.authored === 'agent');
  const haneul = [...board.bids].reverse().find(row => row.shop === 'haneul' && Object.values(row.perks as Record<string, string[]>).some(perks => perks.includes('bundle')));
  const events: Record<string, AuctionEvent | undefined> = { reject, replace, agent, haneul };
  const knots: Knot[] = [];
  for (const line of laid.cues) {
    if (!line.anchor) continue;
    const t = line.anchor === 'award' ? board.awardAt : events[line.anchor]?.t;
    if (t !== undefined) knots.push({ t, s: line.start - laid.start + 0.25 });
  }
  return { knots, cards: { agent, haneul } };
}

const laid = scene('bidding');
const { knots, cards: narrated } = anchorsFor(laid, raw);
const board: Board = onScene(raw, anchored(raw, FROM, knots));
const cards = [...board.bids, ...board.rejected].sort((a, b) => a.t - b.t || a.seq - b.seq);
const winners = board.shops.filter(shop => board.items.some(item => item.lanes.some(lane => lane.shop === shop && lane.wonAt !== null)));
const isNarrated = (card: AuctionEvent | undefined, key: 'agent' | 'haneul') => !!card && narrated[key]?.seq === card.seq;

function Chip({ kind }: { kind: 'agent' | 'checks' }) {
  return <span style={{ fontSize: 20, fontWeight: 600, borderRadius: 999, padding: '4px 13px', whiteSpace: 'nowrap', ...(kind === 'agent' ? { background: C.butter, color: C.ink } : { background: C.mint, color: C.saving }) }}>{kind === 'agent' ? 'Written by agent' : 'Sent by the checks'}</span>;
}

function CheckRow({ from }: { from: number }) {
  const frame = useCurrentFrame();
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 19, color: C.saving }}>{CHECKS.map((label, i) => {
    const on = interpolate(frame, [from + i * 4, from + i * 4 + DUR.micro], [0, 1], clamp);
    return <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.25 + 0.75 * on }}><Tick size={20} progress={on} />{label}</span>;
  })}</div>;
}

function Stamp({ at }: { at: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const p = pop(frame, fps, at);
  if (frame < at) return null;
  return <div style={{ position: 'absolute', right: 20, top: 18, border: `2px solid ${C.accent}`, color: C.accentHover, background: C.surface, borderRadius: 10, padding: '6px 14px', fontSize: 22, fontWeight: 700, transform: `rotate(-3deg) scale(${1.25 - 0.25 * p})`, opacity: Math.min(1, p * 1.5) }}>Rejected by Rally's checks</div>;
}

// A price glides to its new value; the lane never swaps content in one frame.
function Price({ steps, s, winner }: { steps: { t: number; value: number }[]; s: number; winner: boolean }) {
  const price = valueAt(steps, s, DUR.standard / 30, ease);
  return <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 30, letterSpacing: '-.02em', color: winner ? C.saving : C.ink, fontWeight: winner ? 600 : 400 }}>{price === null ? '' : cash(Math.round(price))}</span>;
}

function Lane({ shop, s, awarded, index }: { shop: string; s: number; awarded: boolean; index: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const card = [...cards].reverse().find(row => row.shop === shop && row.t <= s);
  const at = card ? Math.round(card.t * fps) : 0;
  const rejected = card?.kind === 'rejected';
  const agent = card?.kind === 'bid' && card.authored === 'agent';
  const fromChecks = card?.kind === 'bid' && card.authored === 'code' && board.rejected.some(row => row.shop === shop && row.t <= card.t);
  // Notes only on the lane being narrated: the agent's own bid, word for word, or the reason for a rejection.
  const note = isNarrated(card, 'agent') && card?.note && !BANNED.test(card.note) ? clip110(card.note) : '';
  const quote = isNarrated(card, 'haneul');
  const items = board.items.filter(item => item.lanes.some(lane => lane.shop === shop));
  // The winning highlight sweeps left to right across the lanes.
  const winAt = Math.round(board.awardAt * fps) + index * 5;
  const won = awarded && winners.includes(shop), dim = awarded && !winners.includes(shop);
  const sweep = won ? ease(interpolate(frame, [winAt, winAt + DUR.standard], [0, 1], clamp)) : 0;
  const latest = card && cards.filter(row => row.t <= s).at(-1) === card && !awarded;
  const bodyIn = enter(frame, fps, at + 4);
  return <div style={{ position: 'relative', flex: 1, minWidth: 0, borderRadius: 20, padding: '22px 24px', overflow: 'hidden', background: C.surface, border: `2px solid ${sweep > 0.5 ? C.saving : rejected ? C.accent : latest ? C.ink : C.line}`, opacity: dim ? interpolate(frame, [winAt, winAt + DUR.standard], [1, 0.45], clamp) : 1, transform: `translateX(${rejected ? shake(frame, at + 16) : 0}px)`, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ position: 'absolute', inset: 0, background: C.mint, clipPath: `inset(0 ${100 - sweep * 100}% 0 0)` }} />
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', color: sweep > 0.5 ? C.saving : C.ink }}>{shopName(shop)}</span>
      {(agent || rejected) && <Chip kind="agent" />}
      {fromChecks && <Chip kind="checks" />}
    </div>
    <div style={{ position: 'relative', minHeight: 100 }}>
      {rejected && <div style={{ fontSize: 26, lineHeight: 1.3, color: C.accentHover, ...rise(bodyIn, 10) }}>{REASONS[card.reason]}</div>}
      {note && <div style={{ fontSize: 26, lineHeight: 1.3, ...rise(bodyIn, 10) }}><Rich text={typed(`“${note}”`, frame, at + 6, fps)} /></div>}
      {quote && <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, background: C.tint, borderRadius: 14, padding: '10px 16px', ...rise(bodyIn, 10) }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.accentHover }}>Her goal, from Agent</span>
        <span style={{ fontSize: 25, lineHeight: 1.25 }}>“{manifest.vars.goal_quote}”</span>
      </div>}
    </div>
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(item => {
        const lane = item.lanes.find(row => row.shop === shop)!;
        const perks = lane.perks.filter(perk => perk.t <= s).map(perk => perk.perk);
        const passed = lane.passedAt !== null && s >= lane.passedAt;
        return <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: passed ? 0.5 : 1 }}>
          <Photo id={item.id} size={48} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 22, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{manifest.names[item.id]}{perks.includes('bundle') ? ' · bundle' : ''}</span>
          {passed ? <span style={{ fontSize: 24, color: C.muted }}>Pass</span> : <Price steps={lane.steps} s={s} winner={awarded && lane.wonAt !== null} />}
        </div>;
      })}
    </div>
    <div style={{ position: 'relative', marginTop: 'auto', minHeight: 26 }}>{card?.kind === 'bid' && <CheckRow from={at + 8} />}</div>
    {rejected && <Stamp at={at + 10} />}
  </div>;
}

export function Bidding({ laid: here }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const s = frame / fps;
  const total = valueAt(board.totals, s, DUR.scene / fps, ease) ?? hold;
  const awarded = s >= board.awardAt;
  const round = board.rounds.filter(step => step.t <= s).length;
  const summaryAt = Math.round(board.awardAt * fps) + winners.length * 5 + DUR.standard;
  // The bag's total arrives from PayPal's window, then from the real board into this one.
  const shopper = scene('shopper'), paypal = spotAt('shopper', 2, shopper.duration, 960, 25, 13.5);
  const live = toFrame(view(LIVE_KEYS, 0.7), LIVE_TOTAL.x, LIVE_TOTAL.y), liveTotal = { x: live.x, y: live.y, size: LIVE_TOTAL.h * live.k };
  const boardIn = interpolate(frame, [LIVE * fps, FROM * fps], [0, 1], clamp);
  const landed = frame >= LIVE * fps + DUR.camera;
  // The whole board drifts very slightly closer, so a held moment is never a still frame.
  const drift = 1 + 0.0008 * s + 0.006 * Math.max(0, s - board.awardAt);
  return <>
    {frame < FROM * fps + 2 && <Clip name="06-bidding" from={0} to={FROM} length={FROM} keys={LIVE_KEYS} />}
    {frame < LIVE * fps && <div style={{ position: 'absolute', right: 40, top: 40, background: C.ink, color: C.surface, borderRadius: 999, padding: '10px 22px', fontSize: 26, fontWeight: 600 }}>Live in the app</div>}
    <div style={{ position: 'absolute', inset: 0, background: C.ground, opacity: boardIn, transform: `scale(${drift})` }}>
      <div style={{ position: 'absolute', left: 60, top: 128, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-.03em' }}>{awarded ? 'Bidding complete' : 'Shops are bidding'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[1, 2, 3].map(n => {
            const done = round >= n, active = !awarded && round + 1 === n;
            const t = board.rounds.find(step => step.value === n)?.t;
            const p = t === undefined ? 0 : pop(frame, fps, Math.round(t * fps));
            return <div key={n} style={{ width: 20, height: 20, borderRadius: 10, background: done ? C.accent : C.surface, border: `2px solid ${done || active ? C.accent : C.line}`, transform: `scale(${done ? 0.85 + 0.15 * p : 1})` }} />;
          })}
          <span style={{ fontSize: 26, color: C.muted, marginLeft: 8 }}>Round {Math.min(3, round + (awarded ? 0 : 1))} of 3</span>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 60, top: 112, width: 620, textAlign: 'right' }}>
        <div style={{ fontSize: 26, color: C.muted }}>Total, all in</div>
        <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: HEADER.size, lineHeight: 1.05, letterSpacing: '-.03em', color: awarded ? C.saving : C.ink, opacity: landed ? 1 : 0 }}>{ticker(total)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, color: C.accentHover, marginTop: 6 }}>
          <div style={{ flex: 1, height: 2, background: C.accent }} />
          <span>PayPal holds <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{cash(hold)}</span> · can only go down</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 330, bottom: 190, display: 'flex', gap: 28 }}>
        {board.shops.map((shop, i) => <Lane key={shop} shop={shop} s={s} awarded={awarded} index={i} />)}
      </div>
      <div style={{ position: 'absolute', left: 60, top: 262, display: 'flex', ...rise(enter(frame, fps, summaryAt), 16), visibility: frame >= summaryAt ? 'visible' : 'hidden' }}>
        <div style={{ borderRadius: 999, background: C.mint, color: C.saving, fontSize: 26, fontWeight: 700, padding: '8px 26px' }}>{manifest.vars.agent_line}</div>
      </div>
    </div>
    {frame < LIVE * fps + DUR.camera + 2 && <>
      <Flight from={paypal} to={liveTotal} frames={20} out={20}><span style={{ fontFamily: MONO, color: C.ink, letterSpacing: '-.02em' }}>{cash(hold)}</span></Flight>
      {frame >= LIVE * fps && <Flight from={liveTotal} to={HEADER} at={Math.round(LIVE * fps)}><span style={{ fontFamily: MONO, color: C.ink, letterSpacing: '-.03em' }}>{cash(hold)}</span></Flight>}
    </>}
  </>;
}

export const BOARD_TOTAL = HEADER;
