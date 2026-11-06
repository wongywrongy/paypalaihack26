// Every product moment, drawn natively from the run's data and shown as a glass panel (STYLE.md). Each shows only
// what its line is about. Times are motion frames (30 a second) from the start of the shot.
import { interpolate } from 'remotion';
import { money, SHOP_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, enter, pop, reveal, tiltIn, useFrame } from '../motion.ts';
import { Lock, Photo } from '../ui.tsx';
import { SCENES } from '../timeline.ts';
import { Cursor, Glass, Keycap, Odometer, Shimmer } from './glass.tsx';

const cash = (value: number) => money(value, manifest.run.currency);
const start = manifest.events.find(row => row.kind === 'start')!;
const listed = start.listed as Record<string, Record<string, number>>;
const digits = String(manifest.run.held_minor).length;
const PLAN_PROOF = SCENES.find(row => row.id === 'shopper')!.proofs![0];
export type PanelProps = { at: (cue: number) => number; length: number };

const Centre = ({ children, width, top = 230, left = (1920 - width) / 2 }: { children: React.ReactNode; width: number; top?: number; left?: number }) =>
  <div style={{ position: 'absolute', left, top, width }}>{children}</div>;
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: '.01em' }}>{children}</div>;
const Button = ({ children, pressed, tone = 'ink' }: { children: React.ReactNode; pressed?: boolean; tone?: 'ink' | 'accent' }) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 30px', borderRadius: 16, fontSize: 30, fontWeight: 700, color: tone === 'ink' ? C.onLight : '#fff', background: tone === 'ink' ? 'rgba(255,255,255,.92)' : C.accent, transform: `scale(${pressed ? 0.96 : 1})`, boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>{children}</span>;

// One product row: the public price, then the lowest price beside it, which is never shown: a Private pill springs on.
export function PricePanel({ at }: PanelProps) {
  const frame = useFrame(), id = 'sae-cica-cream';
  const panel = enter(frame, 30, 0, DUR.camera), pill = pop(frame, 30, at(0) + 66);
  return <Centre width={1180} top={390}><div style={tiltIn(panel)}><Glass style={{ padding: '34px 44px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 260px', alignItems: 'end', gap: 24, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
      <Label>Product</Label><Label>Listed price</Label><Label>Lowest price</Label>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 260px', alignItems: 'center', gap: 24, paddingTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}><Photo id={id} size={96} /><span style={{ fontSize: 40, fontWeight: 700 }}>{manifest.names[id]}</span></div>
      <span style={{ fontFamily: MONO, fontSize: 44 }}>{cash(listed[id].haneul)}</span>
      {frame >= at(0) + 66 && <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderRadius: 999, border: `2px solid ${C.accent}`, color: C.accentHover, fontSize: 32, fontWeight: 700, transform: `scale(${0.6 + 0.4 * Math.min(1.08, pill)})`, opacity: Math.min(1, pill * 1.5) }}><Lock size={30} color={C.accentHover} />Private</span>}
    </div>
  </Glass></div></Centre>;
}

// The goal typed key by key, then the two rules Rally made from it, then Apply.
export function GoalPanel({ at, length }: PanelProps) {
  const frame = useFrame(), goal = manifest.vars.goal_quote;
  const typeFrom = 14, perChar = 1.1, typedTo = typeFrom + goal.length * perChar;
  const n = Math.max(0, Math.min(goal.length, Math.floor((frame - typeFrom) / perChar)));
  const key = n > 0 && n < goal.length ? goal[n - 1] : '';
  const rulesAt = Math.max(typedTo + 12, at(0) + 72), applyAt = length * 30 - 48;
  const rules = manifest.run.rules;
  const applied = frame >= applyAt;
  return <><Centre width={1240} top={250}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: '36px 46px', display: 'flex', flexDirection: 'column', gap: 26 }}>
    <Label>Your shop goal</Label>
    <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.25, minHeight: 110 }}>{goal.slice(0, n)}<span style={{ opacity: frame < typedTo + 10 && Math.floor(frame / 8) % 2 === 0 ? 1 : 0, color: C.accent }}>|</span></div>
    {frame < typedTo + 14 && <div style={{ display: 'flex', gap: 12, minHeight: 58 }}>{key && <Keycap label={key === ' ' ? 'space' : key.toUpperCase()} down={Math.floor((frame - typeFrom) / perChar * 2) % 2 === 0} />}</div>}
    {frame >= rulesAt && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rules.map((rule, i) => {
        const p = enter(frame, 30, rulesAt + i * 6);
        return <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 24px', borderRadius: 18, background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)', ...reveal(p) }}>
          <span style={{ flex: 1, fontSize: 34, fontWeight: 700 }}>{rule.label}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.accentHover, background: C.tint, borderRadius: 999, padding: '6px 14px' }}>From your goal</span>
          <span style={{ fontFamily: MONO, fontSize: 34, minWidth: 150, textAlign: 'right' }}>{rule.value}</span>
        </div>;
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 6, opacity: enter(frame, 30, rulesAt + 14) }}>
        <span style={{ fontSize: 26, color: applied ? C.saving : C.muted }}>{applied ? 'Applied. Her agent bids inside these rules.' : 'Nothing changes until you apply.'}</span>
        <Button pressed={frame >= applyAt && frame < applyAt + 6}>Apply</Button>
      </div>
    </div>}
  </Glass></div></Centre>
    {frame >= applyAt - 30 && <Cursor from={{ x: 1300, y: 960 }} to={{ x: 1490, y: 750 }} start={applyAt - 30} click={applyAt} />}
  </>;
}

// The last product going into the bag.
export function ProductPanel() {
  const frame = useFrame(), id = start.items.find((item: string) => Object.keys(listed[item]).length === 1) ?? start.items[0];
  const clickAt = 46, added = frame >= clickAt;
  const best = Math.min(...Object.values(listed[id]));
  return <><Centre width={560} top={200}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Photo id={id} size={500} />
    <div style={{ fontSize: 38, fontWeight: 800 }}>{manifest.names[id]}</div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: MONO, fontSize: 34, color: C.muted }}>from {cash(best)}</span>
      <Button tone={added ? 'ink' : 'accent'} pressed={frame >= clickAt && frame < clickAt + 6}>{added ? 'In your bag' : 'Add to bag'}</Button>
    </div>
  </Glass></div></Centre>
    <Cursor from={{ x: 1500, y: 960 }} to={{ x: 1090, y: 862 }} start={14} click={clickAt} />
  </>;
}

// PayPal's hold, drawn abstractly: the price in a bracket under a ceiling line. No PayPal interface. Approve is clicked
// as the line starts; the real approval cuts in over it, and the ceiling lands as the cut dissolves back out.
export function HoldPanel({ at }: PanelProps) {
  const frame = useFrame(), held = manifest.run.held_minor;
  const proof = PLAN_PROOF, clickAt = at(1), approved = frame >= clickAt;
  const bracket = enter(frame, 30, clickAt + (proof.out - proof.in) * 30 - 6, DUR.camera);
  return <><Centre width={900} top={300}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: '44px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}>
    <Label>Your bag, all in</Label>
    <div style={{ position: 'relative', padding: '18px 40px' }}>
      <div style={{ position: 'absolute', left: -30, right: -30, top: -26, height: 3, background: C.accent, opacity: bracket, transform: `scaleX(${bracket})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: -64, fontSize: 26, fontWeight: 700, color: C.accentHover, opacity: bracket }}>The most you can be charged</div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: `inset 0 0 0 4px ${C.accent}`, opacity: bracket, transform: `scale(${1.08 - 0.08 * bracket})` }} />
      <span style={{ fontFamily: MONO, fontSize: 120, letterSpacing: '-.03em' }}>{cash(held)}</span>
    </div>
    {approved ? <span style={{ fontSize: 30, fontWeight: 700, color: C.ink, ...reveal(enter(frame, 30, clickAt)) }}>Approved with PayPal · sandbox</span> : <Button>Approve</Button>}
  </Glass></div></Centre>
    <Cursor from={{ x: 1400, y: 980 }} to={{ x: 970, y: 750 }} start={clickAt - 30} click={clickAt} />
  </>;
}

// The receipt: what was paid, against what was held, then the box.
export const PAID_SPOT = { x: 960, y: 401, size: 150 };
export function ReceiptPanel({ at }: PanelProps) {
  const frame = useFrame(), { held_minor: held, charged_minor: charged } = manifest.run;
  const strip = enter(frame, 30, 24), box = enter(frame, 30, at(1));
  const tiles = [['PayPal held', cash(held), false], ['Charged', cash(charged), false], ['Released', cash(held - charged), true]] as const;
  return <Centre width={1100} top={230}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: '40px 52px', display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' }}>
    <Label>You paid</Label>
    <span style={{ fontSize: PAID_SPOT.size, lineHeight: 1, color: C.saving, opacity: frame >= DUR.camera ? 1 : 0 }}><Shimmer at={DUR.camera + 6}><Odometer cents={charged} digits={digits} /></Shimmer></span>
    <div style={{ display: 'flex', gap: 18, width: '100%', ...reveal(strip) }}>
      {tiles.map(([label, value, money]) => <div key={label} style={{ flex: 1, padding: '18px 22px', borderRadius: 18, background: money ? C.mint : 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' }}>
        <div style={{ fontSize: 24, color: money ? C.saving : C.muted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 40, color: money ? C.saving : C.ink }}>{value}</div>
      </div>)}
    </div>
    {frame >= at(1) && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', ...reveal(box) }}>
      <div style={{ fontSize: 36, fontWeight: 800 }}>One box from {manifest.vars.box_shops} shops</div>
      <div style={{ fontSize: 30, color: C.muted }}>Duties included. Nothing to pay at the door.</div>
    </div>}
  </Glass></div></Centre>;
}

// Haneul's order: what she won, the hand-off, then the payout stepper with the amount rolling up.
const STEPS = ['Won', 'Handed off', 'Payout sent', 'Paid'];
export const ORDER_ROWS = (i: number) => ({ x: 356, y: 316 + i * 98 });
export function OrderPanel({ at }: PanelProps) {
  const frame = useFrame();
  const won = Object.entries(manifest.run.winners).filter(([, row]) => row.shop === 'haneul');
  const clickAt = at(0) + 50, paidAt = at(1) + 10;
  const step = frame >= paidAt + 30 ? 4 : frame >= paidAt + 14 ? 3 : frame >= clickAt ? 2 : 1;
  const payout = manifest.run.payout_usd_cents * enter(frame, 30, paidAt, DUR.camera * 1.5);
  const code = `RL-${manifest.run.order_id.slice(0, 5).toUpperCase()}`;
  return <><Centre width={1300} top={210}><div style={tiltIn(enter(frame, 30, 0, DUR.camera))}><Glass style={{ padding: '40px 46px', display: 'flex', gap: 48 }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, height: 52 }}><span style={{ fontFamily: MONO, fontSize: 42 }}>{code}</span><Label>{SHOP_NAMES.haneul} won {won.length} items</Label></div>
      {won.map(([id, row]) => <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 84, opacity: frame >= 20 ? 1 : 0 }}>
        <Photo id={id} size={72} /><span style={{ flex: 1, fontSize: 36, fontWeight: 700 }}>{manifest.names[id]}</span><span style={{ fontFamily: MONO, fontSize: 36 }}>{cash(row.unit)}</span>
      </div>)}
      <div style={{ marginTop: 18 }}><Button pressed={frame >= clickAt && frame < clickAt + 6}>{frame >= clickAt ? 'Handed off to the Seoul hub' : 'Record hand-off'}</Button></div>
    </div>
    <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {STEPS.map((label, i) => {
        const on = step > i, last = i === 3;
        return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700, color: on ? (last ? C.saving : C.ink) : C.muted }}>
          <span style={{ width: 34, height: 34, borderRadius: 17, boxShadow: `inset 0 0 0 3px ${on ? C.saving : 'rgba(255,255,255,.25)'}`, background: on ? C.saving : 'transparent', transform: `scale(${on ? 0.9 + 0.1 * Math.min(1, pop(frame, 30, i === 0 ? 0 : i === 1 ? clickAt : paidAt + (i === 2 ? 14 : 30))) : 1})` }} />{label}
        </div>;
      })}
      <div style={{ marginTop: 18, padding: '20px 24px', borderRadius: 18, background: C.mint, opacity: interpolate(frame, [paidAt, paidAt + 10], [0, 1], clamp) }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.saving }}>PayPal payout</div>
        <div style={{ fontSize: 84, color: C.saving }}><Odometer cents={payout} digits={String(manifest.run.payout_usd_cents).length} /></div>
      </div>
    </div>
  </Glass></div></Centre>
    <Cursor from={{ x: 1100, y: 980 }} to={{ x: 500, y: 664 }} start={clickAt - 30} click={clickAt} />
  </>;
}
