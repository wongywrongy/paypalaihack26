// Every product moment, drawn natively from the run's data and shown as a glass panel (STYLE.md). Each shows only
// what its line is about. Times are motion frames (30 a second) from the start of the shot.
import { interpolate } from 'remotion';
import { money, SHOP_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, pop, reveal, rise, tiltIn, useFrame } from '../motion.ts';
import { Lock, Photo } from '../ui.tsx';
import { Cursor, Glass, Keycap, Odometer, Shimmer, Words } from './glass.tsx';

const cash = (value: number) => money(value, manifest.run.currency);
const start = manifest.events.find(row => row.kind === 'start')!;
const listed = start.listed as Record<string, Record<string, number>>;
const digits = String(manifest.run.held_minor).length;
// at: the frame a cue starts; word: the frame a word of a cue is spoken. Both from the start of the shot.
export type PanelProps = { at: (cue: number) => number; word: (cue: number, word: string) => number; length: number };

const Centre = ({ children, width, top = 230, left = (1920 - width) / 2 }: { children: React.ReactNode; width: number; top?: number; left?: number }) =>
  <div style={{ position: 'absolute', left, top, width }}>{children}</div>;
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: '.01em' }}>{children}</div>;
const Button = ({ children, pressed, tone = 'ink' }: { children: React.ReactNode; pressed?: boolean; tone?: 'ink' | 'accent' }) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 30px', borderRadius: 16, fontSize: 30, fontWeight: 700, color: tone === 'ink' ? C.onLight : '#fff', background: tone === 'ink' ? 'rgba(255,255,255,.92)' : C.accent, transform: `scale(${pressed ? 0.96 : 1})`, boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>{children}</span>;

// One product row: the public price, then the lowest price beside it, which is never shown. On "lowest" a masked
// field is filled in, on "no one else" a Private pill springs on in its place, and what rivals see is written out.
export function PricePanel({ word }: PanelProps) {
  const frame = useFrame(), id = 'sae-cica-cream';
  const panel = enter(frame, 30, 0, DUR.camera), maskAt = word(0, 'lowest'), pillAt = word(0, 'no'), rivals = pillAt + 2;
  const pill = pop(frame, 30, pillAt), dots = Math.max(0, Math.min(4, Math.floor((frame - maskAt) / 3)));
  return <><Centre width={1180} top={200}><div style={tiltIn(panel)}><Glass style={{ padding: '34px 44px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 260px', alignItems: 'end', gap: 24, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
      <Label>Product</Label><Label>Listed price</Label><Label>Lowest price</Label>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 260px', alignItems: 'center', gap: 24, paddingTop: 22, height: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}><Photo id={id} size={96} /><span style={{ fontSize: 40, fontWeight: 700 }}>{manifest.names[id]}</span></div>
      <span style={{ fontFamily: MONO, fontSize: 44 }}>{cash(listed[id].haneul)}</span>
      {frame >= pillAt
        ? <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderRadius: 999, border: `2px solid ${C.accent}`, background: C.tint, color: C.accentHover, fontSize: 34, fontWeight: 700, transform: `scale(${0.5 + 0.5 * Math.min(1.1, pill)})`, opacity: Math.min(1, pill * 1.5) }}><Lock size={30} color={C.accentHover} />Private</span>
        : frame >= maskAt && <span style={{ justifySelf: 'start', width: 220, padding: '12px 20px', borderRadius: 14, boxShadow: `inset 0 0 0 2px ${C.accent}`, fontFamily: MONO, fontSize: 40, letterSpacing: '.1em', opacity: enter(frame, 30, maskAt, DUR.micro) }}>{'•'.repeat(dots)}<span style={{ color: C.accent }}>|</span></span>}
    </div>
  </Glass></div></Centre>
    {/* What the other shops' agents see of the same row: the listed price, nothing else. */}
    {frame >= rivals && <Centre width={1180} top={530}><div style={tiltIn(enter(frame, 30, rivals, DUR.standard))}><Glass style={{ padding: '30px 44px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Label>What rival shops see</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <Photo id={id} size={80} /><span style={{ flex: 1, fontSize: 38, fontWeight: 700 }}>{manifest.names[id]}</span>
        <span style={{ fontFamily: MONO, fontSize: 42 }}>{cash(listed[id].haneul)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginLeft: 40, fontSize: 30, color: C.muted }}><Lock size={26} color={C.muted} />Lowest price hidden</span>
      </div>
    </Glass></div></Centre>}
  </>;
}

// The goal typed in a second, then the two rules Rally made from it, each on its own beat, then Apply.
export function GoalPanel({ length }: PanelProps) {
  const frame = useFrame(), goal = manifest.vars.goal_quote;
  const typeFrom = 3, perChar = Math.min(1.1, 30 / goal.length), typedTo = typeFrom + goal.length * perChar;
  const n = Math.max(0, Math.min(goal.length, Math.floor((frame - typeFrom) / perChar)));
  const key = n > 0 && n < goal.length ? goal[n - 1] : '';
  const rules = manifest.run.rules;
  const rulesAt = typedTo + 6, ruleGap = 12, applyAt = Math.min(length * 30 - 12, rulesAt + rules.length * ruleGap + 16);
  const applied = frame >= applyAt;
  return <><Centre width={1240} top={230}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '36px 46px', display: 'flex', flexDirection: 'column', gap: 26 }}>
    <Label>Your shop goal</Label>
    <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.25, minHeight: 110 }}>{goal.slice(0, n)}<span style={{ opacity: frame < typedTo + 6 && Math.floor(frame / 8) % 2 === 0 ? 1 : 0, color: C.accent }}>|</span></div>
    {frame < rulesAt && <div style={{ display: 'flex', gap: 12, minHeight: 58 }}>{key && <Keycap label={key === ' ' ? 'space' : key.toUpperCase()} down={Math.floor((frame - typeFrom) / perChar * 2) % 2 === 0} />}</div>}
    {frame >= rulesAt && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rules.map((rule, i) => {
        const p = enter(frame, 30, rulesAt + i * ruleGap);
        return <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 24px', borderRadius: 18, background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', ...rise(p, 30) }}>
          <span style={{ flex: 1, fontSize: 34, fontWeight: 700 }}>{rule.label}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.accentHover, background: C.tint, borderRadius: 999, padding: '6px 14px' }}>From your goal</span>
          <span style={{ fontFamily: MONO, fontSize: 34, minWidth: 150, textAlign: 'right' }}>{rule.value}</span>
        </div>;
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 6, opacity: enter(frame, 30, rulesAt + rules.length * ruleGap) }}>
        <span style={{ fontSize: 28, fontWeight: applied ? 700 : 400, color: applied ? C.saving : C.muted }}>{applied ? 'Applied. Her agent bids inside these rules.' : 'Nothing changes until you apply.'}</span>
        <Button pressed={frame >= applyAt && frame < applyAt + 6} tone={applied ? 'ink' : 'accent'}>{applied ? 'Applied' : 'Apply'}</Button>
      </div>
    </div>}
  </Glass></div></Centre>
    {frame >= applyAt - 20 && <Cursor from={{ x: 1300, y: 960 }} to={{ x: 1480, y: 760 }} start={applyAt - 20} click={applyAt} />}
  </>;
}

// The last product going into the bag, added on "fill".
export function ProductPanel({ word }: PanelProps) {
  const frame = useFrame(), id = start.items.find((item: string) => Object.keys(listed[item]).length === 1) ?? start.items[0];
  const clickAt = Math.max(DUR.camera, word(0, 'fill')), added = frame >= clickAt;
  const best = Math.min(...Object.values(listed[id]));
  return <><Centre width={560} top={200}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Photo id={id} size={500} />
    <div style={{ fontSize: 38, fontWeight: 800 }}>{manifest.names[id]}</div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: MONO, fontSize: 34, color: C.muted }}>from {cash(best)}</span>
      <Button tone={added ? 'ink' : 'accent'} pressed={frame >= clickAt && frame < clickAt + 6}>{added ? 'In your bag' : 'Add to bag'}</Button>
    </div>
  </Glass></div></Centre>
    <Cursor from={{ x: 1500, y: 960 }} to={{ x: 1090, y: 862 }} start={clickAt - 16} click={clickAt} />
  </>;
}

// PayPal's hold, drawn abstractly: the price in a bracket under a ceiling line. No PayPal interface. Approve is clicked
// on "approve" and the ceiling draws at once; the real approval then cuts in. One label at a time over the price.
export const HOLD_PRICE = { x: 960, y: 506, size: 120 };
export function HoldPanel({ word }: PanelProps) {
  const frame = useFrame(), held = manifest.run.held_minor;
  const clickAt = word(1, 'approve'), approved = frame >= clickAt;
  const bracket = enter(frame, 30, clickAt + 2, DUR.standard);
  return <><Centre width={900} top={300}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '44px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}>
    {approved ? <div style={{ fontSize: 28, fontWeight: 700, color: C.accentHover, ...reveal(enter(frame, 30, clickAt, DUR.micro)) }}>The most you can be charged</div> : <Label>Your bag, all in</Label>}
    <div style={{ position: 'relative', padding: '18px 40px' }}>
      <div style={{ position: 'absolute', left: -30, right: -30, top: -14, height: 3, background: C.accent, transformOrigin: 'left center', transform: `scaleX(${bracket})` }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: `inset 0 0 0 4px ${C.accent}`, opacity: bracket, transform: `scale(${1.08 - 0.08 * bracket})` }} />
      <span style={{ fontFamily: MONO, fontSize: HOLD_PRICE.size, letterSpacing: '-.03em' }}>{cash(held)}</span>
    </div>
    {approved ? <span style={{ fontSize: 30, fontWeight: 700, color: C.ink, ...reveal(enter(frame, 30, clickAt)) }}>Approved with PayPal · sandbox</span> : <Button tone="accent">Approve</Button>}
  </Glass></div></Centre>
    <Cursor from={{ x: 1400, y: 980 }} to={{ x: 970, y: 750 }} start={clickAt - 20} click={clickAt} />
  </>;
}

// The receipt: what was held rolls down to what was paid, the three tiles pop in on "hands back", then the box.
const items: string[] = start.items;
export function ReceiptPanel({ at, word }: PanelProps) {
  const frame = useFrame(), { held_minor: held, charged_minor: charged } = manifest.run;
  const roll = ease(interpolate(frame, [4, 4 + 24], [0, 1], clamp)), rolled = frame >= 28;
  const tilesAt = word(0, 'hands'), box = at(1), duties = word(1, 'duties');
  const shops = Number(manifest.vars.box_shops), gone = ease(interpolate(frame, [box, box + 10], [0, 1], clamp));
  const tiles = [['PayPal held', cash(held), false], ['Charged', cash(charged), false], ['Released', cash(held - charged), true]] as const;
  return <Centre width={1100} top={190}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '40px 52px', display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' }}>
    <Label>{rolled ? 'You paid' : 'PayPal held'}</Label>
    <span style={{ fontSize: 150, lineHeight: 1, color: rolled ? C.saving : C.ink }}><Shimmer at={30}><Odometer cents={held - (held - charged) * roll} digits={digits} /></Shimmer></span>
    <div style={{ display: 'flex', gap: 18, width: '100%', height: 104 * (1 - gone), opacity: 1 - gone, transform: `translateY(${-40 * gone}px)` }}>
      {tiles.map(([label, value, isMoney], i) => {
        const from = tilesAt + i * 4, p = pop(frame, 30, from);
        return <div key={label} style={{ flex: 1, padding: '18px 22px', borderRadius: 18, background: isMoney ? C.mint : 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', opacity: frame < from ? 0 : Math.min(1, p * 1.5), transform: `scale(${0.6 + 0.4 * Math.min(1.08, p)})` }}>
          <div style={{ fontSize: 24, color: isMoney ? C.saving : C.muted, fontWeight: 600 }}>{label}</div>
          <div style={{ fontFamily: MONO, fontSize: 40, color: isMoney ? C.saving : C.ink }}>{value}</div>
        </div>;
      })}
    </div>
    {/* The bag's items drop into one box as the line says it. */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, width: '100%', height: 130 * gone, opacity: frame >= box ? 1 : 0 }}>
      <div style={{ position: 'relative', width: 360, height: 110 }}>
        {items.map((id, i) => {
          const p = ease(interpolate(frame, [box + i * 4, box + i * 4 + 14], [0, 1], clamp));
          return <div key={id} style={{ position: 'absolute', left: i * 66 * (1 - p) + 250 * p, top: 20 - 40 * Math.sin(p * Math.PI) + 10 * p, opacity: 1 - 0.9 * Math.max(0, p - 0.85) / 0.15, transform: `scale(${1 - 0.4 * p})` }}><Photo id={id} size={64} /></div>;
        })}
        <div style={{ position: 'absolute', left: 250, top: 34, width: 84, height: 72, borderRadius: 12, background: C.butter, border: `3px solid ${C.ink}`, boxSizing: 'border-box', transform: `scale(${0.9 + 0.1 * Math.min(1.1, pop(frame, 30, box + 18))})` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 40, fontWeight: 800, ...reveal(enter(frame, 30, box)) }}>One box from {shops} {shops === 1 ? 'shop' : 'shops'}</div>
        <div style={{ fontSize: 30, color: C.muted, ...reveal(enter(frame, 30, duties)) }}>Duties included. Nothing to pay at the door.</div>
      </div>
    </div>
  </Glass></div></Centre>;
}

// The winning shop's order: what it won, the hand-off, then the payout stepper, one step every 0.4 s, the amount
// rolling up and landing just before it is said.
const STEPS = ['Won', 'Handed off', 'Payout sent', 'Paid'];
export const ORDER_ROWS = (i: number) => ({ x: 356, y: 316 + i * 98 });
export const PAID_SHOP = manifest.run.payout_shop as keyof typeof SHOP_NAMES;
export function OrderPanel({ at, word }: PanelProps) {
  const frame = useFrame();
  const won = Object.entries(manifest.run.winners).filter(([, row]) => row.shop === PAID_SHOP);
  const clickAt = Math.max(DUR.camera + 6, word(0, 'at')), paidAt = word(1, '$') - 16, sentAt = Math.min(paidAt - 12, at(1));
  const turns = [0, clickAt, sentAt, paidAt];
  const step = turns.filter(f => frame >= f).length;
  const payout = manifest.run.payout_usd_cents * ease(interpolate(frame, [paidAt, paidAt + 14], [0, 1], clamp));
  const code = `RL-${manifest.run.order_id.slice(0, 5).toUpperCase()}`;
  return <><Centre width={1300} top={210}><div style={tiltIn(enter(frame, 30, 0, DUR.standard))}><Glass style={{ padding: '40px 46px', display: 'flex', gap: 48 }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, height: 52 }}><span style={{ fontFamily: MONO, fontSize: 42 }}>{code}</span><Label>{SHOP_NAMES[PAID_SHOP]} won {won.length} {won.length === 1 ? 'item' : 'items'}</Label></div>
      {/* On the hand-off each item ticks off and steps aside, one after another. */}
      {won.map(([id, row], i) => { const off = ease(interpolate(frame, [clickAt + 2 + i * 4, clickAt + 12 + i * 4], [0, 1], clamp)); return <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 84, opacity: frame >= 20 ? 1 - 0.35 * off : 0, transform: `translateX(${36 * off}px)` }}>
        <span style={{ width: 34 * off, height: 34, borderRadius: 17, background: C.saving, color: C.onLight, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, overflow: 'hidden', marginRight: -20 * (1 - off) }}>✓</span>
        <Photo id={id} size={72} /><span style={{ flex: 1, fontSize: 36, fontWeight: 700 }}>{manifest.names[id]}</span><span style={{ fontFamily: MONO, fontSize: 36 }}>{cash(row.unit)}</span>
      </div>; })}
      <div style={{ marginTop: 18 }}><Button tone={frame >= clickAt ? 'ink' : 'accent'} pressed={frame >= clickAt && frame < clickAt + 6}>{frame >= clickAt ? 'Handed off to the Seoul hub' : 'Record hand-off'}</Button></div>
    </div>
    <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {STEPS.map((label, i) => {
        const on = step > i, last = i === 3;
        return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700, color: on ? (last ? C.saving : C.ink) : C.muted }}>
          <span style={{ width: 34, height: 34, borderRadius: 17, boxShadow: `inset 0 0 0 3px ${on ? C.saving : 'rgba(255,255,255,.25)'}`, background: on ? C.saving : 'transparent', transform: `scale(${on ? 0.8 + 0.2 * Math.min(1.2, pop(frame, 30, turns[i])) : 1})` }} />{label}
        </div>;
      })}
      <div style={{ marginTop: 18, padding: '20px 24px', borderRadius: 18, background: C.mint, opacity: interpolate(frame, [paidAt, paidAt + 4], [0, 1], clamp) }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.saving }}>PayPal payout</div>
        <div style={{ fontSize: 84, color: C.saving }}><Odometer cents={payout} digits={String(manifest.run.payout_usd_cents).length} /></div>
      </div>
    </div>
  </Glass></div></Centre>
    <Cursor from={{ x: 1100, y: 980 }} to={{ x: 500, y: 664 }} start={clickAt - 20} click={clickAt} />
  </>;
}
