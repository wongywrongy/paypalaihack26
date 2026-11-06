// The board item first, like the app's Deal screen: one row per bag item, one price chip per shop that sells it.
import { interpolate } from 'remotion';
import { anchored, buildBoard, onScene, valueAt, type AuctionEvent, type Board, type Knot } from '../auction.ts';
import { money, SHOP_NAMES, SHORT_NAMES } from '../schema.ts';
import { BANNED, C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, MOTION_FPS, pop, rise, shake, typed, useFrame } from '../motion.ts';
import { glass, Odometer } from '../ui/glass.tsx';
import { Photo, Rich } from '../ui.tsx';
import { proofSpan, scene } from '../plan.ts';
import type { Laid } from '../timeline.ts';

type Shop = keyof typeof SHOP_NAMES;
const REASONS: Record<string, string> = { limit: 'went below what its shop can accept', raise: 'raised a price its shop had already offered', rules: 'broke a rule its owner set', invalid: "asked for something its shop doesn't allow" };
// Shown word for word; a long note keeps only its first sentence.
const clip110 = (note: string) => note.length > 110 ? note.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? note : note;

const raw = buildBoard(manifest.events);
const hold = manifest.run.held_minor;
const cash = (value: number) => money(value, manifest.run.currency);
const reject = raw.rejected[0];
const replace = reject && raw.bids.find(row => row.shop === reject.shop && row.t > reject.t);
const agentBid = raw.bids.find(row => row.authored === 'agent');
const haneulBid = [...raw.bids].reverse().find(row => row.shop === 'haneul' && Object.values(row.perks as Record<string, string[]>).some(perks => perks.includes('bundle')));
const bundle: string[] = haneulBid?.bundle?.items ?? [];
// Bundled items sit next to each other so one bracket can hold them.
export const ROWS = [...raw.items].sort((a, b) => Number(!bundle.includes(a.id)) - Number(!bundle.includes(b.id))).map(item => item.id);

// Layout, in frame pixels. The bag card and the board share item sizes, so items only move between them.
export const PHOTO = 84;
export const ROW_X = 140, ROW_Y = 362, ROW_H = 108, CHIP_X = 700, CHIP_W = 264, BRACKET_X = 1504;
const BAG_X = 450, BAG_Y = 250, BAG_H = 116;
export const boardRow = (i: number) => ({ x: ROW_X, y: ROW_Y + i * ROW_H });
const bagRow = (i: number) => ({ x: BAG_X, y: BAG_Y + i * BAG_H });
// The header grid: role tag top left with the title on its own row under it, the rail top centre, the total top right
// under its label. Every block keeps 32 px or more from the next.
const HEADER = { x: 1589, y: 128, size: 110 }, BAG_TOTAL = { x: 1352, y: 752, size: 64 };
export const BOARD_TOTAL = HEADER;
const FLY = 26, FROM = 1.4;

function pace(laid: Laid) {
  const knots: Knot[] = [];
  const events: Record<string, AuctionEvent | undefined> = { reject, agent: agentBid, haneul: haneulBid };
  let whyAt = Infinity;
  for (const line of laid.cues) {
    const at = line.start - laid.start;
    // The cheaper single price comes back once each row has collapsed to its winner.
    if (line.anchor === 'award') { knots.push({ t: raw.awardAt, s: at + 0.25 }); if (manifest.vars.why_shown) whyAt = at + 1.6; }
    else if (line.anchor && events[line.anchor]) knots.push({ t: events[line.anchor]!.t, s: at + 0.25 });
    // The replacement lands as the line says the checks sent it.
    if (line.anchor === 'reject' && replace) knots.push({ t: replace.t, s: line.end - laid.start - 0.8 });
  }
  return { knots: knots.sort((a, b) => a.t - b.t), whyAt };
}
const laid = scene('bidding');
const { knots, whyAt } = pace(laid);
const board: Board = onScene(raw, anchored(raw, FROM, knots));
// On the scene's clock: onScene moves bids and rejections, not the raw event list.
const at = (event: AuctionEvent | undefined) => event ? [...board.bids, ...board.rejected].find(row => row.seq === event.seq)?.t ?? Infinity : Infinity;
const onBoard = { reject: board.rejected[0] ? board.rejected[0].t : Infinity, agent: at(agentBid), haneul: at(haneulBid) };
const winners = manifest.run.winners as Record<string, { shop: Shop; unit: number }>;
const wonCount = Object.keys(winners).length;

// The shopper's bag, rebuilt from the run: the items, who sells each, and the one price PayPal holds.
export function BagCard({ fly = 0 }: { fly?: number }) {
  const chrome = 1 - Math.min(1, fly * 1.6);
  const start = manifest.events.find(row => row.kind === 'start') as AuctionEvent;
  const lerp = (a: number, b: number) => a + (b - a) * fly;
  return <>
    <div style={{ position: 'absolute', left: BAG_X - 50, top: 150, width: 1120, height: 680, ...glass, borderRadius: 28, opacity: chrome }}>
      <div style={{ position: 'absolute', left: 50, top: 34, fontSize: 34, fontWeight: 800, letterSpacing: '-.02em' }}>Your bag · {ROWS.length} items</div>
      <div style={{ position: 'absolute', left: 50, right: 50, top: 568, height: 1, background: C.line }} />
      <div style={{ position: 'absolute', left: 50, top: 586, fontSize: 30, color: C.muted }}>Total, all in</div>
      <div style={{ position: 'absolute', left: 50, top: 630, fontSize: 24, color: C.accentHover }}>Shipping, duties and tax included</div>
    </div>
    {ROWS.map((id, i) => {
      const a = bagRow(i), b = boardRow(i);
      return <div key={id} style={{ position: 'absolute', left: lerp(a.x, b.x), top: lerp(a.y, b.y), display: 'flex', alignItems: 'center', gap: 22 }}>
        <Photo id={id} size={PHOTO} />
        <div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.015em' }}>{manifest.names[id]}</div>
          <div style={{ fontSize: 25, color: C.muted, opacity: chrome }}>{(start.shops[id] as Shop[]).map(shop => SHOP_NAMES[shop]).join(' · ')}</div>
        </div>
      </div>;
    })}
    <div style={{ position: 'absolute', left: lerp(BAG_TOTAL.x, HEADER.x), top: lerp(BAG_TOTAL.y, HEADER.y), transform: 'translate(-50%, -50%)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: lerp(BAG_TOTAL.size, HEADER.size), letterSpacing: '-.03em', lineHeight: 1 }}>{cash(hold)}</div>
  </>;
}

function Chip({ shop, price, filled, won, cheaper, x, opacity }: { shop: Shop; price: number; filled: boolean; won: boolean; cheaper: boolean; x: number; opacity: number }) {
  const bg = won ? C.mint : filled ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.06)', fg = won ? C.saving : filled ? C.onLight : C.ink;
  return <div style={{ position: 'absolute', left: x, top: 12, width: CHIP_W - 16, height: 64, boxSizing: 'border-box', borderRadius: 32, background: bg, color: fg, border: `2px solid ${cheaper ? C.accent : won ? C.saving : filled ? 'transparent' : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 22px', opacity }}>
    <span style={{ fontSize: 25, fontWeight: 600 }}>{SHORT_NAMES[shop]}</span>
    <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 32, letterSpacing: '-.02em', fontWeight: won ? 600 : 400 }}>{cash(Math.round(price))}</span>
  </div>;
}

function Row({ id, i, s }: { id: string; i: number; s: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const item = board.items.find(row => row.id === id)!;
  const lanes = item.lanes.filter(lane => lane.steps.length);
  const prices = lanes.map(lane => valueAt(lane.steps, s, DUR.standard / fps, ease) ?? Infinity);
  const low = prices.indexOf(Math.min(...prices));
  const awardF = Math.round(board.awardAt * fps) + i * 4;
  const collapse = ease(interpolate(frame, [awardF, awardF + DUR.standard], [0, 1], clamp));
  const winner = winners[id]?.shop, whyF = Math.round(whyAt * fps);
  const why = interpolate(frame, [whyF, whyF + DUR.standard], [0, 1], clamp);
  const { x, y } = boardRow(i), chips = CHIP_X - ROW_X;
  const appear = enter(frame, fps, 6 + FLY);
  const undercut = lanes.some((lane, n) => lane.shop !== winner && prices[n] < (winners[id]?.unit ?? 0));
  return <div style={{ position: 'absolute', left: x, top: y, width: 1500, height: ROW_H }}>
    <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 22 }}>
      <Photo id={id} size={PHOTO} />
      <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.015em' }}>{manifest.names[id]}</span>
    </div>
    {lanes.map((lane, n) => {
      const shop = lane.shop as Shop, isWinner = shop === winner;
      // The cheaper single price comes back next to the winner when the line explains why it lost.
      const cheaper = !isWinner && prices[n] < (winners[id]?.unit ?? 0);
      const slot = chips + n * CHIP_W;
      const left = isWinner ? slot + (chips - slot) * collapse : cheaper ? slot + (chips + CHIP_W - slot) * why : slot;
      const opacity = isWinner ? 1 : cheaper ? Math.max(1 - collapse, why) : 1 - collapse;
      return <Chip key={shop} shop={shop} price={prices[n]} filled={n === low && collapse < 0.5} won={isWinner && collapse > 0.5} cheaper={cheaper && why > 0} x={left} opacity={opacity * appear} />;
    })}
    {winner && collapse > 0 && <span style={{ position: 'absolute', left: chips + CHIP_W * (1 + (undercut ? why : 0)) + 6, top: 30, fontSize: 26, fontWeight: 700, color: C.saving, opacity: collapse }}>{SHOP_NAMES[winner]} wins</span>}
  </div>;
}

// One shop note at a time, attributed, with what happened to it.
function Notes({ s }: { s: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const note = s >= onBoard.haneul ? null
    : s >= onBoard.agent && agentBid?.note && !BANNED.test(agentBid.note) ? { shop: agentBid.shop as Shop, text: `“${clip110(agentBid.note)}”`, tag: 'agent' as const, from: onBoard.agent }
    : s >= onBoard.reject && reject ? { shop: reject.shop as Shop, text: `Its agent ${REASONS[reject.reason]}.`, tag: 'rejected' as const, from: onBoard.reject }
    : null;
  if (!note) return null;
  const f = Math.round(note.from * fps), p = enter(frame, fps, f);
  return <div key={note.from} style={{ position: 'absolute', left: ROW_X, right: 760, top: 254, minHeight: 64, display: 'flex', alignItems: 'center', gap: 18, padding: '10px 24px', ...glass, borderRadius: 18, background: note.tag === 'rejected' ? C.tint : glass.background, boxShadow: `inset 0 0 0 1px ${note.tag === 'rejected' ? C.accent : 'rgba(255,255,255,.12)'}`, transform: `translateX(${note.tag === 'rejected' ? shake(frame, f + 14) : 0}px)`, ...rise(p, 12) }}>
    <span style={{ fontSize: 26, fontWeight: 800, whiteSpace: 'nowrap' }}>{SHOP_NAMES[note.shop]}:</span>
    <span style={{ flex: 1, fontSize: 26, lineHeight: 1.25 }}><Rich text={note.tag === 'agent' ? typed(note.text, frame, f + 6, fps) : note.text} /></span>
    <span style={{ fontSize: 22, fontWeight: 700, borderRadius: 999, padding: '6px 14px', whiteSpace: 'nowrap', transform: `scale(${note.tag === 'rejected' ? 1.2 - 0.2 * Math.min(1, pop(frame, fps, f + 8)) : 1})`, ...(note.tag === 'agent' ? { background: C.butter, color: C.onLight } : { background: 'transparent', color: C.accentHover, border: `2px solid ${C.accent}` }) }}>{note.tag === 'agent' ? 'Written by agent' : "Rejected by Rally's checks"}</span>
  </div>;
}

// Haneul's bundle: a bracket over its two rows, carrying the goal it came from.
function Bracket({ s }: { s: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const rows = bundle.map(id => ROWS.indexOf(id)).filter(i => i >= 0);
  if (rows.length < 2 || s < onBoard.haneul) return null;
  const p = enter(frame, fps, Math.round(onBoard.haneul * fps));
  const top = boardRow(Math.min(...rows)).y + 44, bottom = boardRow(Math.max(...rows)).y + 44;
  return <div style={{ opacity: p }}>
    <div style={{ position: 'absolute', left: BRACKET_X, top, width: 18, height: (bottom - top) * p, borderTop: `3px solid ${C.accent}`, borderBottom: `3px solid ${C.accent}`, borderRight: `3px solid ${C.accent}`, borderRadius: '0 10px 10px 0' }} />
    <div style={{ position: 'absolute', left: BRACKET_X + 34, top: (top + bottom) / 2 - 76, width: 270, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ alignSelf: 'flex-start', fontSize: 23, fontWeight: 700, color: '#fff', background: C.accent, borderRadius: 999, padding: '5px 14px' }}>Haneul bundle</span>
      <span style={{ fontSize: 24, lineHeight: 1.25, color: C.accentHover, background: C.tint, borderRadius: 12, padding: '8px 14px' }}>Her goal: “{manifest.vars.goal_quote}”</span>
    </div>
  </div>;
}

const Money = ({ v, strong }: { v: string; strong?: boolean }) => <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', fontSize: strong ? 44 : 34, fontWeight: strong ? 600 : 400, color: strong ? C.saving : C.ink }}>{v}</span>;

export function Bidding() {
  const frame = useFrame(), fps = MOTION_FPS;
  const s = frame / fps;
  const fly = ease(interpolate(frame, [6, 6 + FLY], [0, 1], clamp));
  const shown = interpolate(frame, [6 + FLY * 0.5, 6 + FLY], [0, 1], clamp), landed = frame >= 6 + FLY;
  const total = valueAt(board.totals, s, DUR.scene / fps, ease) ?? hold;
  const awarded = s >= board.awardAt;
  const round = board.rounds.filter(step => step.t <= s).length;
  // The arithmetic lands after the rows collapse and the cheaper toner is explained, 0.9 s before the real board cuts in.
  const sumAt = Math.max(Math.round(board.awardAt * fps) + ROWS.length * 4 + DUR.standard, Math.round((proofSpan(laid, 0).from - 0.9) * fps));
  const sum = enter(frame, fps, sumAt);
  return <div style={{ position: 'absolute', inset: 0 }}>
    <div style={{ opacity: shown }}>
      <div style={{ position: 'absolute', left: ROW_X, top: 124, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-.03em' }}>{awarded ? 'Bidding complete' : 'Shops are bidding'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[1, 2, 3].map(n => {
            const done = round >= n, active = !awarded && round + 1 === n, t = board.rounds.find(step => step.value === n)?.t;
            const p = t === undefined ? 0 : pop(frame, fps, Math.round(t * fps));
            return <div key={n} style={{ width: 20, height: 20, borderRadius: 10, background: done ? C.accent : C.surface, border: `2px solid ${done || active ? C.accent : C.line}`, transform: `scale(${done ? 0.85 + 0.15 * p : 1})` }} />;
          })}
          <span style={{ fontSize: 26, color: C.muted, marginLeft: 8 }}>Round {Math.min(3, round + (awarded ? 0 : 1))} of 3</span>
          {manifest.vars.agent_line && awarded && <span style={{ fontSize: 24, color: C.saving, marginLeft: 20 }}>{manifest.vars.agent_line}</span>}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 100, top: 36, width: 520, textAlign: 'right' }}>
        <div style={{ fontSize: 26, color: C.muted, lineHeight: '34px' }}>Total, all in</div>
        <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: HEADER.size, lineHeight: 1.05, letterSpacing: '-.03em', color: awarded ? C.saving : C.ink, opacity: landed ? 1 : 0 }}><Odometer cents={Math.min(hold, total)} digits={String(hold).length} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: C.accentHover, marginTop: 6, whiteSpace: 'nowrap' }}>
          <div style={{ flex: 1, height: 2, background: C.accent }} />
          <span>PayPal holds <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{cash(hold)}</span> · can only go down</span>
        </div>
      </div>
      <Notes s={s} />
      {landed && ROWS.map((id, i) => <Row key={id} id={id} i={i} s={s} />)}
      <Bracket s={s} />
      {frame >= sumAt && <div style={{ position: 'absolute', left: 0, right: 0, top: boardRow(ROWS.length).y + 6, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 22, fontSize: 34, ...rise(sum, 16) }}>
        <span style={{ color: C.muted }}>{wonCount} items</span><Money v={manifest.vars.items_total} />
        <span style={{ color: C.muted }}>+ shipping, duties, tax and fee</span><Money v={manifest.vars.extras_total} />
        <span style={{ color: C.muted }}>=</span><Money v={manifest.vars.charged} strong />
      </div>}
    </div>
    {!landed && <BagCard fly={fly} />}
  </div>;
}
