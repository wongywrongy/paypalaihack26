// Every product moment, drawn natively from the run's data and shown as a glass panel (STYLE.md). Each shows only
// what its line is about. Times are motion frames (30 a second) from the start of the shot.
import { interpolate } from 'remotion';
import { money, SHOP_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, pop, reveal, rise, smooth, tiltIn, useFrame } from '../motion.ts';
import { Lock, Photo } from '../ui.tsx';
import { Cursor, Glass, Keycap, Odometer, Shimmer } from './glass.tsx';
import { bagRow, PHOTO, ROWS } from '../scenes/Bidding.tsx';

const cash = (value: number) => money(value, manifest.run.currency);
const start = manifest.events.find(row => row.kind === 'start')!;
const listed = start.listed as Record<string, Record<string, number>>;
const digits = String(manifest.run.held_minor).length;
// at: the frame a cue starts; word: the frame a word of a cue is spoken. Both from the start of the shot.
export type PanelProps = { at: (cue: number) => number; word: (cue: number, word: string) => number; length: number };

// The demo's frame is two columns: a scene's panels share it and stay up, so nothing cuts inside a scene. The one not
// being spoken about dims (STYLE.md, depth of field).
export const COLS = { left: { x: 70, width: 860 }, right: { x: 990, width: 860 }, center: { x: 530, width: 860 } } as const;
const Column = ({ side, x = COLS[side].x, top = 180, dim = 0, children }: { side: keyof typeof COLS; x?: number; top?: number; dim?: number; children: React.ReactNode }) =>
  <div style={{ position: 'absolute', left: x, top, width: COLS[side].width, opacity: 1 - 0.55 * dim }}>{children}</div>;
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: '.01em' }}>{children}</div>;
const Button = ({ children, pressed, tone = 'ink' }: { children: React.ReactNode; pressed?: boolean; tone?: 'ink' | 'accent' }) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 30px', borderRadius: 16, fontSize: 30, fontWeight: 700, whiteSpace: 'nowrap', color: tone === 'ink' ? C.onLight : '#fff', background: tone === 'ink' ? 'rgba(255,255,255,.92)' : C.accent, transform: `scale(${pressed ? 0.96 : 1})`, boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>{children}</span>;

// One product row: the public price, then the lowest price beside it, which is never shown. On "lowest" a masked
// field is filled in, on "no one else" a Private pill springs on in its place, and what rivals see is written out.
// It opens centre frame and large, and glides left to size, making room for her goal on the right; then it dims.
export function PricePanel({ at, word }: PanelProps) {
  const frame = useFrame(), id = 'sae-cica-cream';
  const panel = enter(frame, 30, 0, DUR.camera), maskAt = word(0, 'lowest'), pillAt = word(0, 'no'), rivals = pillAt + 2;
  const pill = pop(frame, 30, pillAt), dots = Math.max(0, Math.min(4, Math.floor((frame - maskAt) / 5)));
  const glide = smooth(frame / at(1));
  return <Column side="left" x={COLS.center.x + (COLS.left.x - COLS.center.x) * glide} dim={enter(frame, 30, at(1))}>
    <div style={{ transformOrigin: '50% 0', transform: `scale(${1.3 - 0.3 * glide})` }}><div style={tiltIn(panel)}><Glass style={{ padding: '34px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 220px', alignItems: 'end', gap: 20, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <Label>Product</Label><Label>Listed price</Label><Label>Lowest price</Label>
      </div>
      {/* The row, then its listed price, come in after the panel: the price is set before the lowest price is. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 220px', alignItems: 'center', gap: 20, paddingTop: 22, height: 100, ...rise(enter(frame, 30, 15), 24) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><Photo id={id} size={88} /><span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{manifest.names[id]}</span></div>
        <span style={{ fontFamily: MONO, fontSize: 42, ...rise(enter(frame, 30, 36), 24) }}>{cash(listed[id].haneul)}</span>
        {frame >= pillAt
          ? <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderRadius: 999, border: `2px solid ${C.accent}`, background: C.tint, color: C.accentHover, fontSize: 32, fontWeight: 700, transform: `scale(${0.5 + 0.5 * Math.min(1.1, pill)})`, opacity: Math.min(1, pill * 1.5) }}><Lock size={28} color={C.accentHover} />Private</span>
          : frame >= maskAt && <span style={{ justifySelf: 'start', width: 200, padding: '12px 20px', boxSizing: 'border-box', borderRadius: 14, boxShadow: `inset 0 0 0 2px ${C.accent}`, fontFamily: MONO, fontSize: 40, letterSpacing: '.1em', opacity: enter(frame, 30, maskAt, DUR.micro) }}>{'•'.repeat(dots)}<span style={{ color: C.accent }}>|</span></span>}
      </div>
    </Glass></div>
    {/* What the other shops' agents see of the same row: the listed price, nothing else. */}
    {frame >= rivals && <div style={{ marginTop: 30, ...tiltIn(enter(frame, 30, rivals, DUR.standard)) }}><Glass style={{ padding: '30px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Label>What rival shops see</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Photo id={id} size={72} /><span style={{ flex: 1, fontSize: 32, fontWeight: 700 }}>{manifest.names[id]}</span>
        <span style={{ fontFamily: MONO, fontSize: 40 }}>{cash(listed[id].haneul)}</span>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 28, color: C.muted }}><Lock size={26} color={C.muted} />Lowest price hidden</span>
    </Glass></div>}
  </div></Column>;
}

// The goal typed over about 2.5 s, then the two rules Rally made from it, each on its own beat, then Apply. On the right,
// beside the price it protects.
const APPLY_AT = { x: 1736, y: 652 };
export function GoalPanel({ length }: PanelProps) {
  const frame = useFrame(), goal = manifest.vars.goal_quote;
  const typeFrom = 3, perChar = 72 / goal.length, typedTo = typeFrom + goal.length * perChar;
  const n = Math.max(0, Math.min(goal.length, Math.floor((frame - typeFrom) / perChar)));
  const key = n > 0 && n < goal.length ? goal[n - 1] : '';
  const rules = manifest.run.rules;
  const rulesAt = typedTo + 12, ruleGap = 24, applyAt = Math.min(length * 30 - 60, rulesAt + rules.length * ruleGap + 36);
  const applied = frame >= applyAt;
  return <><Column side="right"><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '34px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
    <Label>Your shop goal</Label>
    <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.25, minHeight: 100 }}>{goal.slice(0, n)}<span style={{ opacity: frame < typedTo + 6 && Math.floor(frame / 8) % 2 === 0 ? 1 : 0, color: C.accent }}>|</span></div>
    {frame < rulesAt && <div style={{ display: 'flex', gap: 12, minHeight: 58 }}>{key && <Keycap label={key === ' ' ? 'space' : key.toUpperCase()} down={Math.floor((frame - typeFrom) / perChar * 2) % 2 === 0} />}</div>}
    {frame >= rulesAt && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rules.map((rule, i) => {
        const p = enter(frame, 30, rulesAt + i * ruleGap);
        return <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px', borderRadius: 18, background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', ...rise(p, 30) }}>
          <span style={{ flex: 1, fontSize: 30, fontWeight: 700 }}>{rule.label}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.accentHover, background: C.tint, borderRadius: 999, padding: '6px 14px', whiteSpace: 'nowrap' }}>From your goal</span>
          <span style={{ fontFamily: MONO, fontSize: 30, minWidth: 150, textAlign: 'right', whiteSpace: 'nowrap' }}>{rule.value}</span>
        </div>;
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 6, opacity: enter(frame, 30, rulesAt + rules.length * ruleGap) }}>
        <span style={{ fontSize: 24, fontWeight: applied ? 700 : 400, color: applied ? C.saving : C.muted }}>{applied ? 'Her agent bids inside these rules.' : 'Nothing changes until you apply.'}</span>
        <Button pressed={frame >= applyAt && frame < applyAt + 6} tone={applied ? 'ink' : 'accent'}>{applied ? 'Applied' : 'Apply'}</Button>
      </div>
    </div>}
  </Glass></div></Column>
    {frame >= applyAt - 20 && <Cursor from={{ x: 1500, y: 980 }} to={APPLY_AT} start={applyAt - 20} click={applyAt} />}
  </>;
}

// The shopper's side: the bag on the left, the product being added and then the hold on the right.
const SHOPPER_RIGHT = { x: 1130, width: 700 };
const PRODUCT = { left: SHOPPER_RIGHT.x + (SHOPPER_RIGHT.width - 480) / 2, top: 170, photo: 420 };

// The last product going into the bag: Add to bag is clicked on "bag" and its photo flies into the bag's last row.
// It leaves as the PayPal line starts.
export const productId: string = start.items.find((item: string) => Object.keys(listed[item]).length === 1) ?? start.items[0];
// Frames from the click until the photo lands in the bag.
export const ADDED = 14;
export const addedAt = (word: PanelProps['word']) => word(0, 'bag');
export function ProductPanel({ at, word }: PanelProps) {
  const frame = useFrame(), id = productId;
  const clickAt = addedAt(word), added = frame >= clickAt;
  const best = Math.min(...Object.values(listed[id]));
  const out = frame >= at(1) ? enter(frame, 30, at(1), DUR.standard) : 0;
  const a = { x: PRODUCT.left + 30 + PRODUCT.photo / 2, y: PRODUCT.top + 30 + PRODUCT.photo / 2, size: PRODUCT.photo };
  const row = bagRow(ROWS.indexOf(id)), b = { x: row.x + PHOTO / 2, y: row.y + PHOTO / 2, size: PHOTO };
  const fly = ease(interpolate(frame, [clickAt + 2, clickAt + ADDED], [0, 1], clamp));
  return <>
    {out < 0.99 && <div style={{ position: 'absolute', left: PRODUCT.left, top: PRODUCT.top, width: 480, opacity: 1 - out, transform: `translateY(${40 * out}px)` }}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Photo id={id} size={PRODUCT.photo} />
      <div style={{ fontSize: 36, fontWeight: 800 }}>{manifest.names[id]}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: 30, color: C.muted }}>from {cash(best)}</span>
        <Button tone={added ? 'ink' : 'accent'} pressed={frame >= clickAt && frame < clickAt + 6}>{added ? 'In your bag' : 'Add to bag'}</Button>
      </div>
    </Glass></div></div>}
    {fly > 0 && fly < 1 && <div style={{ position: 'absolute', left: a.x + (b.x - a.x) * fly, top: a.y + (b.y - a.y) * fly - 120 * Math.sin(Math.PI * fly), transform: 'translate(-50%, -50%)' }}><Photo id={id} size={a.size + (b.size - a.size) * fly} /></div>}
    <Cursor from={{ x: 1700, y: 980 }} to={{ x: 1590, y: 732 }} start={clickAt - 16} click={clickAt} />
  </>;
}

// PayPal's hold, drawn abstractly: no PayPal interface. Approve is clicked on "approve"; the bag's total on the left
// takes the ceiling, and the real approval rises into this column right after.
export const approvedAt = (word: PanelProps['word']) => word(1, 'approve');
export function HoldPanel({ word }: PanelProps) {
  const frame = useFrame(), held = manifest.run.held_minor;
  const clickAt = approvedAt(word), approved = frame >= clickAt;
  // It steps back as the real approval rises in over it.
  const gone = frame >= clickAt + 8 ? enter(frame, 30, clickAt + 8, DUR.standard) : 0;
  return <><div style={{ position: 'absolute', left: SHOPPER_RIGHT.x + 50, top: 300, width: 600, opacity: 1 - gone }}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: 22 }}>
    <Label>Pay with PayPal</Label>
    <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15 }}>PayPal holds <span style={{ fontFamily: MONO, fontWeight: 400 }}>{cash(held)}</span></div>
    <div style={{ fontSize: 28, color: C.muted, lineHeight: 1.3 }}>The agents can only bring it down.</div>
    <div>{approved ? <span style={{ fontSize: 30, fontWeight: 700, color: C.saving, ...reveal(enter(frame, 30, clickAt)) }}>Approved · sandbox</span> : <Button tone="accent">Approve</Button>}</div>
  </Glass></div></div>
    <Cursor from={{ x: 1600, y: 980 }} to={{ x: 1290, y: 596 }} start={clickAt - 20} click={clickAt} />
  </>;
}

// A shipping box: the items drop in one after another, then the lid comes down on them.
export function Carton({ from, ids, size, gap = 5 }: { from: number; ids: string[]; size: number; gap?: number }) {
  const frame = useFrame(), w = size, top = size * 0.42, h = size * 0.6, photo = size * 0.32;
  const shut = from + ids.length * gap + 10, lid = ease(interpolate(frame, [shut, shut + 8], [0, 1], clamp));
  const edge = `3px solid ${C.ink}`, tape = <div style={{ position: 'absolute', left: '43%', width: '14%', top: 0, bottom: 0, background: 'rgba(0,0,0,.1)' }} />;
  return <div style={{ position: 'relative', width: w, height: top + h, flex: 'none' }}>
    <div style={{ position: 'absolute', left: w * 0.05, top: top - size * 0.08, width: w * 0.9, height: size * 0.1, background: '#B89A45', borderRadius: '10px 10px 0 0' }} />
    {ids.map((id, i) => {
      const p = interpolate(frame, [from + i * gap, from + i * gap + 12], [0, 1], { ...clamp, easing: x => x * x });
      const x = w * 0.1 + (w * 0.8 - photo) * (ids.length > 1 ? i / (ids.length - 1) : 0.5);
      return <div key={id} style={{ position: 'absolute', left: x, top: -photo + (top - photo * 0.35 + photo) * p, opacity: Math.min(1, p * 4) }}><Photo id={id} size={photo} /></div>;
    })}
    <div style={{ position: 'absolute', left: 0, top, width: w, height: h, boxSizing: 'border-box', borderRadius: 12, background: C.butter, border: edge }}>{tape}</div>
    {lid > 0 && <div style={{ position: 'absolute', left: -w * 0.03, top: top - size * 0.12 - size * 0.3 * (1 - lid), width: w * 1.06, height: size * 0.14, boxSizing: 'border-box', borderRadius: 10, background: C.butter, border: edge, opacity: Math.min(1, lid * 3) }}>{tape}</div>}
  </div>;
}

// The receipt, centre frame: what was held rolls down to what was paid, then the three tiles come in left to right, one
// a beat, from "hands back"; the released amount stays lit. The camera pushes in on it the whole scene.
const items: string[] = start.items;
const TILE_BEAT = 48;
export function ReceiptPanel({ word, length }: PanelProps) {
  const frame = useFrame(), { held_minor: held, charged_minor: charged } = manifest.run;
  const roll = ease(interpolate(frame, [12, 66], [0, 1], clamp)), rolled = frame >= 66;
  const tilesAt = word(0, 'hands');
  const tiles = [['PayPal held', cash(held), false], ['Charged', cash(charged), false], ['Released', cash(held - charged), true]] as const;
  const lit = tilesAt + 2 * TILE_BEAT, ring = frame >= lit + 12 ? ((frame - lit - 12) % 54) / 54 : 0;
  return <Column side="center" top={200}><div style={{ transformOrigin: '50% 40%', transform: `scale(${1 + 0.2 * frame / (length * 30)})` }}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '44px 44px', display: 'flex', flexDirection: 'column', gap: 30 }}>
    <Label>{rolled ? 'You paid' : 'PayPal held'}</Label>
    {/* The price makes room for the tiles as they come in. */}
    <span style={{ fontSize: 200 - 50 * ease(interpolate(frame, [tilesAt, tilesAt + 10], [0, 1], clamp)), lineHeight: 1, color: rolled ? C.saving : C.ink }}><Shimmer at={68}><Odometer cents={held - (held - charged) * roll} digits={digits} /></Shimmer></span>
    <div style={{ display: 'flex', gap: 16, height: 110 }}>
      {tiles.map(([label, value, isMoney], i) => {
        const from = tilesAt + i * TILE_BEAT, p = pop(frame, 30, from);
        return <div key={label} style={{ position: 'relative', flex: 1, padding: '18px 20px', borderRadius: 18, background: isMoney ? C.mint : 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', opacity: frame < from ? 0 : Math.min(1, p * 1.5), transform: `scale(${0.6 + 0.4 * Math.min(1.08, p)})` }}>
          <div style={{ fontSize: 24, color: isMoney ? C.saving : C.muted, fontWeight: 600 }}>{label}</div>
          <div style={{ fontFamily: MONO, fontSize: 40, color: isMoney ? C.saving : C.ink }}>{value}</div>
          {isMoney && ring > 0 && <div style={{ position: 'absolute', inset: -6 - 40 * ring, borderRadius: 22 + 24 * ring, border: `5px solid ${C.saving}`, opacity: 1 - ring * ring }} />}
        </div>;
      })}
    </div>
  </Glass></div></div></Column>;
}

// The box, on the left: the bag's items drop in one by one and the lid shuts; Duties paid is stamped on it as it is
// said. It dims when the shop's order comes in on the right.
export function BoxPanel({ at, word }: PanelProps) {
  const frame = useFrame(), duties = word(0, 'duties'), shops = Number(manifest.vars.box_shops), stamp = pop(frame, 30, duties);
  return <Column side="left" top={200} dim={enter(frame, 30, at(1))}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
    <div style={{ position: 'relative' }}>
      <Carton from={8} ids={items} size={320} gap={9} />
      {frame >= duties && <div style={{ position: 'absolute', left: '50%', top: '62%', padding: '10px 22px', borderRadius: 12, border: `4px solid ${C.saving}`, background: 'rgba(11,11,15,.85)', color: C.saving, fontSize: 34, fontWeight: 800, whiteSpace: 'nowrap', opacity: Math.min(1, stamp * 1.5), transform: `translate(-50%, -50%) rotate(-8deg) scale(${1.6 - 0.6 * Math.min(1.05, stamp)})` }}>Duties paid</div>}
    </div>
    <div style={{ fontSize: 44, fontWeight: 800, ...reveal(enter(frame, 30, word(0, 'box'))) }}>One box from {shops} {shops === 1 ? 'shop' : 'shops'}</div>
    <div style={{ fontSize: 28, color: C.muted, ...reveal(enter(frame, 30, duties + 12)) }}>Nothing to pay at the door.</div>
  </Glass></div></Column>;
}

// The winning shop's order, on the right: what it won, the hand-off, then the payout stepper, one step at a time (Won
// as it comes in, Handed off on the click, Payout sent as the payout line starts, Paid just before the amount is said).
const STEPS = ['Won', 'Handed off', 'Payout sent', 'Paid'];
export const PAID_SHOP = manifest.run.payout_shop as keyof typeof SHOP_NAMES;
export function OrderPanel({ at, word }: PanelProps) {
  const frame = useFrame();
  const won = Object.entries(manifest.run.winners).filter(([, row]) => row.shop === PAID_SHOP);
  const clickAt = Math.max(DUR.camera + 6, word(1, 'at')), paidAt = word(2, '$') - 16, sentAt = Math.min(paidAt - 12, at(2));
  const turns = [0, clickAt, sentAt, paidAt];
  const step = turns.filter(f => frame >= f).length;
  const payout = manifest.run.payout_usd_cents * ease(interpolate(frame, [paidAt, paidAt + 14], [0, 1], clamp));
  const code = `RL-${manifest.run.order_id.slice(0, 5).toUpperCase()}`;
  return <><Column side="right" top={170}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '34px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, height: 52 }}><span style={{ fontFamily: MONO, fontSize: 40 }}>{code}</span><Label>{SHOP_NAMES[PAID_SHOP]} won {won.length} {won.length === 1 ? 'item' : 'items'}</Label></div>
    {/* On the hand-off each item ticks off and steps aside, one after another. */}
    {won.map(([id, row], i) => { const off = ease(interpolate(frame, [clickAt + 2 + i * 4, clickAt + 12 + i * 4], [0, 1], clamp)), p = enter(frame, 30, 6 + i * 4); return <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 76, opacity: p * (1 - 0.35 * off), transform: `translate(${36 * off}px, ${(1 - p) * 24}px)` }}>
      <span style={{ width: 34 * off, height: 34, borderRadius: 17, background: C.saving, color: C.onLight, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, overflow: 'hidden', marginRight: -20 * (1 - off) }}>✓</span>
      <Photo id={id} size={68} /><span style={{ flex: 1, fontSize: 34, fontWeight: 700 }}>{manifest.names[id]}</span><span style={{ fontFamily: MONO, fontSize: 34 }}>{cash(row.unit)}</span>
    </div>; })}
    <div style={{ marginTop: 8 }}><Button tone={frame >= clickAt ? 'ink' : 'accent'} pressed={frame >= clickAt && frame < clickAt + 6}>{frame >= clickAt ? 'Handed off to the Seoul hub' : 'Record hand-off'}</Button></div>
    {/* The stepper, left to right, joined by a line that fills as it turns. */}
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
      {STEPS.map((label, i) => {
        const on = step > i, last = i === 3;
        return <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i ? 1 : undefined }}>
          {i > 0 && <div style={{ flex: 1, height: 3, margin: '0 10px', background: on ? C.saving : 'rgba(255,255,255,.18)' }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap', color: on ? (last ? C.saving : C.ink) : C.muted }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, boxShadow: `inset 0 0 0 3px ${on ? C.saving : 'rgba(255,255,255,.25)'}`, background: on ? C.saving : 'transparent', transform: `scale(${on ? 0.8 + 0.2 * Math.min(1.2, pop(frame, 30, turns[i])) : 1})` }} />{label}
          </div>
        </div>;
      })}
    </div>
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 18, background: C.mint, opacity: interpolate(frame, [paidAt, paidAt + 4], [0, 1], clamp) }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.saving }}>PayPal payout</div>
      <div style={{ fontSize: 76, color: C.saving }}><Odometer cents={payout} digits={String(manifest.run.payout_usd_cents).length} /></div>
    </div>
  </Glass></div></Column>
    <Cursor from={{ x: 1500, y: 990 }} to={{ x: 1200, y: 596 }} start={clickAt - 20} click={clickAt} />
  </>;
}
