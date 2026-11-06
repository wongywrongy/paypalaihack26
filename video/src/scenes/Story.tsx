import type { CSSProperties, ReactNode } from 'react';
import { interpolate } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { money, SHOP_NAMES, SHORT_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, MOTION_FPS, pop, rise, shake, smooth, tiltIn, useFrame } from '../motion.ts';
import { glass, Odometer, Words } from '../ui/glass.tsx';
import { Land, lerpView, mapTransform, onScreen, project, WORLD, type MapView } from '../map.tsx';
import { Lock, Photo } from '../ui.tsx';
import { Rail } from './Rail.tsx';
import { wordAt } from '../plan.ts';
import type { Laid } from '../timeline.ts';

type Shop = keyof typeof SHOP_NAMES;
type Point = { x: number; y: number };
const cue = (laid: Laid, i: number) => (laid.cues[i] ?? laid.cues[laid.cues.length - 1]).start - laid.start;
const SEOUL_AT = project(37.5, 127), CALIFORNIA_AT = project(36.8, -119.4);
// The opening frame: Korea, its neighbours and the three shop pins, close enough to place them, far enough to read as a map.
const KOREA: MapView = { ...SEOUL_AT, zoom: 2.6 };
// Korea and California both in frame, the Pacific between them.
const PACIFIC: MapView = { x: (SEOUL_AT.x + CALIFORNIA_AT.x) / 2, y: SEOUL_AT.y + 60, zoom: 1.45 };
// The whole world for the close, framed so every hub and label sits inside the 80% safe area.
const WORLD_SAFE: MapView = { x: 796, y: 300, zoom: 0.95 };
// The only two camera moves in the film, both on the map, each one continuous ease-in-out.
const OPEN_MOVE = 2.2, CLOSE_MOVE = 2.6;
// The three shops sit around Seoul. Their spread is screen pixels at Korea's zoom, shrinking as the map pulls out.
// Bada, which ships only in Korea, sits lowest, so its tags hang into open sea below the arcs.
// Dalbit's label hangs below its pin, clear of the arc it sends up toward California.
const SHOP_SPOTS: Record<Shop, { dx: number; dy: number; left?: boolean; below?: boolean }> = { haneul: { dx: -230, dy: -60, left: true }, dalbit: { dx: 170, dy: -130, below: true }, bada: { dx: 90, dy: 150 } };
const SHOPS = Object.keys(SHOP_SPOTS) as Shop[];
const FEES = ['+ checkout', '+ shipping', '+ duties'];
const start = manifest.events.find(row => row.kind === 'start')!;
const items: string[] = start.items;
const cash = (value: number) => money(value, manifest.run.currency);

function Map({ v, dim = 1 }: { v: MapView; dim?: number }) {
  return <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}><g transform={mapTransform(v)}><Land opacity={dim} /></g></svg>;
}

const shopAt = (v: MapView, shop: Shop) => {
  const p = onScreen(v, SEOUL_AT), k = Math.max(0.8, v.zoom / KOREA.zoom);
  return { x: p.x + SHOP_SPOTS[shop].dx * k, y: p.y + SHOP_SPOTS[shop].dy * k };
};

const halo = '0 0 8px rgba(11,11,15,.9), 0 0 14px rgba(11,11,15,.8)';

function ShopPin({ v, shop, from, note }: { v: MapView; shop: Shop; from: number; note?: ReactNode }) {
  const frame = useFrame(), fps = MOTION_FPS;
  if (frame < from) return null;
  const p = shopAt(v, shop), s = Math.min(1.15, pop(frame, fps, from));
  return <div style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${s})` }}>
    <div style={{ width: 26, height: 26, borderRadius: 13, background: C.accent, border: `4px solid ${C.surface}`, boxShadow: '0 2px 8px rgba(23,22,26,.25)' }} />
    <div style={{ position: 'absolute', ...(SHOP_SPOTS[shop].below ? { left: 13, top: 40, transform: 'translateX(-50%)' } : { [SHOP_SPOTS[shop].left ? 'right' : 'left']: 36, top: -6 }), whiteSpace: 'nowrap', fontSize: 30, fontWeight: 800, color: C.ink, textShadow: halo }}>{SHOP_NAMES[shop]}</div>
    {note && <div style={{ position: 'absolute', left: 36, top: 34, whiteSpace: 'nowrap' }}>{note}</div>}
  </div>;
}

const Tag = ({ children, tone = 'fee', style }: { children: ReactNode; tone?: 'fee' | 'stop' | 'ok'; style?: CSSProperties }) =>
  <span style={{ display: 'inline-block', fontSize: 28, fontWeight: 700, borderRadius: 999, padding: '5px 14px', background: C.surface, whiteSpace: 'nowrap', color: tone === 'ok' ? C.saving : C.accentHover, border: `2px solid ${tone === 'ok' ? C.saving : C.accent}`, ...style }}>{children}</span>;

const bend = (a: Point, b: Point, lift: number) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * lift });
const along = (a: Point, b: Point, u: number, lift = 0.3) => {
  const c = bend(a, b, lift), q = 1 - u;
  return { x: q * q * a.x + 2 * q * u * c.x + u * u * b.x, y: q * q * a.y + 2 * q * u * c.y + u * u * b.y };
};

// An arc in screen pixels, drawn to `until` of its length.
function ScreenArc({ a, b, from, until = 1, color = C.ink, dashed = true, width = 3, id }: { a: Point; b: Point; from: number; until?: number; color?: string; dashed?: boolean; width?: number; id: string }) {
  const frame = useFrame();
  if (frame < from) return null;
  const c = bend(a, b, 0.3), path = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  const draw = evolvePath(until * ease(interpolate(frame, [from, from + DUR.camera], [0, 1], clamp)), path);
  return <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    <mask id={id}><path d={path} stroke="#fff" strokeWidth={width + 6} fill="none" strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} /></mask>
    <path d={path} stroke={color} strokeWidth={width} fill="none" strokeDasharray={dashed ? '9 10' : undefined} strokeLinecap="round" mask={`url(#${id})`} />
    {/* A point of light travels each finished arc, so a held map is never still. */}
    {until === 1 && frame > from + DUR.camera && (() => { const p = along(a, b, ((frame - from - DUR.camera) / 50) % 1); return <circle cx={p.x} cy={p.y} r={5} fill={color === C.ink ? '#fff' : color} />; })()}
  </svg>;
}

const Source = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div style={{ fontSize: 22, color: C.muted, textShadow: halo, ...style }}>{children}</div>;

// Act 1, beat 1: Korea, three small shops around Seoul, and the sourced figure.
export function Korea({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const v = KOREA;
  const c0 = cue(laid, 0) * fps;
  return <>
    <Map v={v} />
    {SHOPS.map(shop => <ShopPin key={shop} v={v} shop={shop} from={-30} />)}
    <div style={{ position: 'absolute', left: 130, top: 640, display: 'flex', flexDirection: 'column', gap: 6, padding: '22px 30px', borderRadius: 20, ...glass, ...rise(enter(frame, fps, c0 + 30)) }}>
      <div style={{ fontFamily: MONO, fontSize: 92, letterSpacing: '-.03em', color: C.accent, lineHeight: 1 }}>$11.4 billion</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>Korean skincare sold abroad in 2025, a record</div>
      <Source>Ministry of Food and Drug Safety via Korea JoongAng Daily</Source>
    </div>
  </>;
}

// Act 1, beats 2 and 3: the four products, the one shop that has them all and doesn't ship abroad, and the split order.
export function Split({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const c0 = cue(laid, 0) * fps, c1 = cue(laid, 1) * fps, c2 = cue(laid, 2) * fps;
  // Camera move 1 of 2: the pull-back from Korea to California.
  const v = lerpView(KOREA, PACIFIC, smooth(frame / (OPEN_MOVE * fps)));
  const shopper = onScreen(v, CALIFORNIA_AT);
  const bada = shopAt(v, 'bada'), haneul = shopAt(v, 'haneul'), dalbit = shopAt(v, 'dalbit');
  const listed = start.listed as Record<string, Record<string, number>>;
  const compare = items.find(id => new Set(Object.values(listed[id] ?? {})).size > 1) ?? items[0];
  const flash = frame >= c2 ? Math.floor((frame - c2) / 12) % 2 : -1;
  const meIn = enter(frame, fps, Math.round(1.2 * fps));
  const fees = ['checkouts', 'shipping', 'duties'].map(word => Math.round(wordAt(laid, 1, word) * fps)), sourceAt = fees[2] + 24;
  return <>
    <Map v={v} />
    <ScreenArc id="bada" a={bada} b={shopper} from={c0 + 40} until={0.16} color={C.accent} />
    <ScreenArc id="haneul" a={haneul} b={shopper} from={c1} />
    <ScreenArc id="dalbit" a={dalbit} b={shopper} from={c1 + 8} />
    {SHOPS.map(shop => <ShopPin key={shop} v={v} shop={shop} from={-30}
      note={shop === 'bada' && frame >= c0 + 20 ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <Tag tone="ok" style={rise(enter(frame, fps, c0 + 20), 8)}>Stocks all {items.length}</Tag>
        {frame >= c0 + 40 + DUR.camera && <Tag tone="stop" style={rise(enter(frame, fps, c0 + 40 + DUR.camera), 8)}>Ships only in Korea</Tag>}
      </div> : undefined} />)}
    {/* What each extra parcel adds, each fee on its word, beside the shopper and clear of the arcs; the source under everything. */}
    {frame >= fees[0] && <div style={{ position: 'absolute', left: shopper.x + 44, top: shopper.y - 210, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.muted, textShadow: halo, ...rise(enter(frame, fps, fees[0]), 8) }}>Each parcel</div>
      {FEES.map((fee, i) => frame >= fees[i] && <Tag key={fee} style={{ transform: `scale(${Math.min(1.1, pop(frame, fps, fees[i]))})`, transformOrigin: 'left center' }}>{fee}</Tag>)}
    </div>}
    {frame >= sourceAt && <Source style={{ position: 'absolute', left: shopper.x - 300, width: 600, textAlign: 'center', top: shopper.y + 300, ...rise(enter(frame, fps, sourceAt), 6) }}>US de minimis suspended Aug 29, 2025 · CBP</Source>}
    <div style={{ position: 'absolute', left: shopper.x, top: shopper.y, transform: 'translate(-50%, -50%)', width: 26, height: 26, borderRadius: 13, background: C.ink, border: `4px solid ${C.surface}`, opacity: meIn }} />
    <div style={{ position: 'absolute', left: shopper.x - 170, top: shopper.y + 30, width: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: meIn }}>
      <div style={{ fontSize: 30, fontWeight: 800, textShadow: halo }}>You, in California</div>
      <div style={{ display: 'flex', gap: 10 }}>{items.map((id, i) => <div key={id} style={rise(enter(frame, fps, Math.round(1.2 * fps) + i * 5), 10)}><Photo id={id} size={60} /></div>)}</div>
    </div>
    {frame >= c2 && <div style={{ position: 'absolute', left: shopper.x - 400, top: shopper.y + 190, width: 800, display: 'flex', justifyContent: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', ...glass, borderRadius: 18, ...rise(enter(frame, fps, c2), 10) }}>
      <Photo id={compare} size={60} />
      {Object.entries(listed[compare]).map(([shop, unit], i) => <span key={shop} style={{ fontFamily: MONO, fontSize: 30, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', border: `2px solid ${flash === i ? C.accent : C.line}`, background: flash === i ? C.tint : C.surface }}>{SHORT_NAMES[shop as Shop]} {cash(unit)}</span>)}
    </div></div>}
  </>;
}

// --- Act 2: the five steps, drawn as they are spoken. No UI, the same background. ---
// Across the full width: the shops in the left third, the hub in the middle, the shopper and the price in the right third.
const SHOP_Y: Record<Shop, number> = { haneul: 380, bada: 580, dalbit: 780 };
const SHOP_X = 330, HUB = { x: 960, y: 640 }, BAG = { x: 1560, y: 790 }, TAG = { x: 1560, y: 430 };
const winnerShops = [...new Set(Object.values(manifest.run.winners).map(row => row.shop))] as Shop[];

function Node({ x, y, label, sub, color = C.accent, from, children }: { x: number; y: number; label: string; sub?: string; color?: string; from: number; children?: ReactNode }) {
  const frame = useFrame(), fps = MOTION_FPS;
  if (frame < from) return null;
  const p = Math.min(1.1, pop(frame, fps, from));
  return <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${p})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ position: 'relative', width: 76, height: 76, borderRadius: 38, background: color, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 34, fontWeight: 800, boxShadow: '0 6px 24px rgba(0,0,0,.45)' }}>{label[0]}{children}</div>
    <div style={{ fontSize: 32, fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</div>
    {sub && <div style={{ fontSize: 26, color: C.muted, whiteSpace: 'nowrap' }}>{sub}</div>}
  </div>;
}

// Something travelling from a to b over `frames`, starting at `from`, then fading.
function Mover({ a, b, from, frames = 24, children, lift = 0.25 }: { a: Point; b: Point; from: number; frames?: number; children: ReactNode; lift?: number }) {
  const frame = useFrame();
  if (frame < from || frame > from + frames + 6) return null;
  const p = along(a, b, smooth((frame - from) / frames), lift);
  return <div style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)', opacity: frame > from + frames ? 1 - (frame - from - frames) / 6 : 1 }}>{children}</div>;
}

const Parcel = ({ size }: { size: number }) => <div style={{ width: size, height: size * 0.86, borderRadius: size / 7, background: C.butter, border: `3px solid ${C.ink}`, boxSizing: 'border-box' }} />;

export function Steps({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS;
  // The frame each step's line starts, found by its step, so a step can run over more than one line.
  const at = [1, 2, 3, 4, 5].map(n => Math.round((laid.cues.find(line => line.step === n)!.start - laid.start) * fps)), end = Math.round(laid.duration * fps);
  const step = at.filter(f => frame >= f).length;
  const held = manifest.run.held_minor, charged = manifest.run.charged_minor;
  // The price: the hold until bidding, ticking down through step 3, landing on the final price in step 5.
  const price = frame < at[2] ? held
    : frame < at[4] ? held - (held - charged) * 0.7 * smooth((frame - at[2]) / (at[3] - at[2]))
    : held - (held - charged) * (0.7 + 0.3 * ease(interpolate(frame, [at[4], at[4] + DUR.camera], [0, 1], clamp)));
  const tagIn = enter(frame, fps, at[0] + 24), bracket = ease(interpolate(frame, [at[1], at[1] + DUR.camera], [0, 1], clamp));
  const released = ease(interpolate(frame, [at[4] + DUR.camera, at[4] + DUR.camera * 2], [0, 1], clamp));
  return <>
    <Map v={WORLD} dim={0.28} />
    <Rail shown={step} filled={step ? step as 1 : null} from={at} x={960} />
    {/* Seoul side: the three shops, then their agents and the owner's limits. */}
    <div style={{ position: 'absolute', left: SHOP_X, top: 236, transform: 'translateX(-50%)', fontSize: 30, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap', opacity: enter(frame, fps, 0) }}>Shops in Seoul</div>
    {SHOPS.map((shop, i) => <Node key={shop} x={SHOP_X} y={SHOP_Y[shop]} label={SHOP_NAMES[shop]} from={6 + i * 5}>
      {frame >= at[2] && <span style={{ position: 'absolute', left: 60, top: -14, fontSize: 24, fontWeight: 800, color: C.onLight, background: C.butter, borderRadius: 999, padding: '4px 14px', whiteSpace: 'nowrap', transform: `scale(${Math.min(1, pop(frame, fps, at[2] + i * 5))})` }}>AI agent</span>}
    </Node>)}
    {frame >= at[2] + 20 && <div style={{ position: 'absolute', left: SHOP_X + 130, top: SHOP_Y.haneul + 30, display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 700, color: C.accentHover, border: `2px solid ${C.accent}`, borderRadius: 999, padding: '6px 18px', background: C.surface, whiteSpace: 'nowrap', ...rise(enter(frame, fps, at[2] + 20), 8) }}><Lock size={24} color={C.accent} />owner's limits</div>}
    {/* California side: the shopper's bag and its one price. */}
    <Node x={BAG.x} y={BAG.y} label="Shopper" sub="California" color={C.ink} from={6} />
    {frame >= at[0] && items.map((id, i) => <Mover key={id} a={{ x: BAG.x - 330 + i * 110, y: BAG.y + 160 }} b={BAG} from={at[0] + i * 4} frames={22} lift={0.6}><Photo id={id} size={72} /></Mover>)}
    {frame >= at[0] + 24 && <div style={{ position: 'absolute', left: TAG.x - 240, width: 480, top: TAG.y, transform: `translateY(calc(-50% + ${(1 - tagIn) * 12}px))`, opacity: tagIn }}>
      <div style={{ position: 'relative', padding: '18px 30px', ...glass, borderRadius: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.muted }}>One bag, all in</div>
        <div style={{ fontFamily: MONO, fontSize: 84, letterSpacing: '-.03em', lineHeight: 1.05, color: step >= 5 ? C.saving : C.ink }}>{cash(Math.round(price))}</div>
        <div style={{ fontSize: 26, color: C.muted, whiteSpace: 'nowrap', lineHeight: 1.3 }}>items · shipping · duties<br />tax · Rally's fee</div>
        {/* PayPal's hold: a bracket around the price, with the ceiling above it. */}
        <div style={{ position: 'absolute', inset: -14, borderRadius: 26, border: `4px solid ${C.accent}`, opacity: bracket, transform: `scale(${1.08 - 0.08 * bracket})` }} />
        <div style={{ position: 'absolute', left: -40, right: -40, top: -50, height: 3, background: C.accent, opacity: bracket }} />
        <div style={{ position: 'absolute', left: -100, right: -100, top: -132, fontSize: 28, lineHeight: 1.25, fontWeight: 700, color: C.accentHover, opacity: bracket, textAlign: 'center' }}>PayPal holds it<br />the most you can pay</div>
        {step >= 5 && <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 26, fontSize: 26, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap', opacity: released * (1 - 0.5 * ease(interpolate(frame, [at[4] + DUR.camera * 2, end], [0, 1], clamp))) }}>released {cash(held - charged)}</div>}
      </div>
    </div>}
    {/* Step 3: bids fly from the shops to the bag, again and again. */}
    {step === 3 && [0, 1, 2, 3, 4, 5, 6, 7].map(n => {
      const shop = SHOPS[n % 3], f = at[2] + 10 + n * 14;
      return <Mover key={n} a={{ x: SHOP_X + 110, y: SHOP_Y[shop] }} b={{ x: TAG.x - 290, y: TAG.y + 20 }} from={f} frames={36} lift={0.12}><span style={{ display: 'inline-block', fontSize: 28, fontWeight: 800, color: C.onLight, background: C.butter, borderRadius: 999, padding: '8px 20px', boxShadow: '0 6px 20px rgba(0,0,0,.4)' }}>bid</span></Mover>;
    })}
    {/* Step 4: winning items go a short way to the Seoul hub; one box goes on to California, duties paid. */}
    <Node x={HUB.x} y={HUB.y} label="Rally hub" sub="Seoul" color={C.saving} from={at[3]} />
    {step >= 4 && winnerShops.map((shop, i) => <Mover key={shop} a={{ x: SHOP_X, y: SHOP_Y[shop] }} b={HUB} from={at[3] + 10 + i * 6} frames={22} lift={0.1}><Parcel size={40} /></Mover>)}
    {step >= 4 && <ScreenArc id="box" a={HUB} b={BAG} from={at[3] + 44} dashed={false} color={C.saving} width={4} />}
    {step >= 4 && <Mover a={HUB} b={BAG} from={at[3] + 44} frames={36} lift={0.3}><Parcel size={56} /></Mover>}
    {frame >= at[3] + 60 && <div style={{ position: 'absolute', left: along(HUB, BAG, 0.5).x, top: along(HUB, BAG, 0.5).y - 80, transform: 'translateX(-50%)', ...rise(enter(frame, fps, at[3] + 60), 8) }}><Tag tone="ok">one box · duties paid</Tag></div>}
    {/* Step 5: PayPal pays each winning shop. */}
    {step >= 5 && winnerShops.map((shop, i) => <Mover key={shop} a={{ x: TAG.x - 120, y: TAG.y }} b={{ x: SHOP_X + 40, y: SHOP_Y[shop] }} from={at[4] + DUR.camera + 6 + i * 8} frames={36} lift={0.2}><div style={{ width: 52, height: 52, borderRadius: 26, background: C.saving, color: C.onLight, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800 }}>$</div></Mover>)}
  </>;
}

// --- Act 4 ---
// One card per line, cut in on the line's first word, each with its own small motion: the price ticks down, a parcel
// lands in the hub's box, a lock closes on a spending bar.
const CARDS = [
  { who: 'Shoppers', line: 'Pay less, get one box' },
  { who: 'Small shops', line: 'Sell abroad without shipping abroad' },
  { who: 'PayPal', line: "A spending limit AI agents can't break" },
];
function PriceDown({ from }: { from: number }) {
  const frame = useFrame(), { held_minor: held, charged_minor: charged } = manifest.run;
  const p = ease(interpolate(frame, [from, from + 24], [0, 1], clamp));
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
    <div style={{ fontFamily: MONO, fontSize: 30, color: C.muted, textDecoration: p >= 1 ? 'line-through' : undefined }}>{cash(held)}</div>
    <div style={{ fontSize: 96, color: p >= 1 ? C.saving : C.ink }}><Odometer cents={held - (held - charged) * p} digits={String(held).length} /></div>
  </div>;
}
function ParcelIn({ from }: { from: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const fall = interpolate(frame, [from, from + 14], [0, 1], { ...clamp, easing: x => x * x }), landed = frame >= from + 14;
  return <div style={{ position: 'relative', width: 300, height: 260 }}>
    <div style={{ position: 'absolute', left: 105, top: 150 * fall - 20, opacity: Math.min(1, (frame - from + 4) / 4) }}><Parcel size={90} /></div>
    <div style={{ position: 'absolute', left: 40, top: 150, width: 220, height: 100, borderRadius: 14, border: `4px solid ${C.saving}`, borderTop: 'none', boxSizing: 'border-box', transform: `scaleX(${landed ? 1 + 0.06 * Math.sin(Math.PI * Math.min(1, (frame - from - 14) / 8)) : 1})` }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 262, textAlign: 'center', fontSize: 26, fontWeight: 700, color: C.saving, opacity: enter(frame, fps, from + 14) }}>Seoul hub</div>
  </div>;
}
function LockedBar({ from }: { from: number }) {
  const frame = useFrame();
  const fill = ease(interpolate(frame, [from, from + 20], [0, 1], clamp)), shut = ease(interpolate(frame, [from + 18, from + 26], [0, 1], clamp));
  const push = frame > from + 26 ? 6 * Math.sin((frame - from - 26) / 3) * Math.max(0, 1 - (frame - from - 26) / 24) : 0;
  return <div style={{ position: 'relative', width: 340, height: 220 }}>
    <div style={{ position: 'absolute', left: 0, top: 130, width: 300, height: 40, borderRadius: 20, background: C.surface, boxShadow: `inset 0 0 0 2px ${C.line}` }} />
    <div style={{ position: 'absolute', left: 0, top: 130, width: 300 * fill + push, height: 40, borderRadius: 20, background: C.accent }} />
    <div style={{ position: 'absolute', left: 300, top: 90, width: 4, height: 120, background: C.ink }} />
    {/* The lock: its shackle drops shut as the bar reaches the limit. */}
    <div style={{ position: 'absolute', left: 280, top: 6 + 14 * shut, width: 44, height: 40, borderRadius: '22px 22px 0 0', border: `6px solid ${C.ink}`, borderBottom: 'none', boxSizing: 'border-box' }} />
    <div style={{ position: 'absolute', left: 270, top: 40, width: 64, height: 50, borderRadius: 10, background: C.ink }} />
  </div>;
}
const VISUALS = [PriceDown, ParcelIn, LockedBar];
export function Why({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const starts = CARDS.map((_, i) => Math.round(cue(laid, i) * fps)), i = Math.max(0, starts.filter(f => frame >= f).length - 1);
  const card = CARDS[i], Visual = VISUALS[i], from = starts[i], hit = Math.round(wordAt(laid, 2, 'break') * fps);
  return <>
    <Map v={WORLD} dim={0.28} />
    {/* "can't break": the limit holds, and the card takes the knock. */}
    <div key={i} style={{ position: 'absolute', left: 260 + (i === 2 ? 2 * shake(frame, hit) : 0), top: 250, width: 1400, height: 440, boxSizing: 'border-box', padding: '50px 64px', borderRadius: 32, ...glass, background: i === 2 ? C.tint : glass.background, display: 'flex', alignItems: 'center', gap: 60, ...tiltIn(enter(frame, fps, from, DUR.standard)) }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: i === 2 ? C.accentHover : C.accent }}>{card.who}</div>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.08 }}>{card.line}</div>
      </div>
      <Visual from={from + 6} />
    </div>
  </>;
}

// Seoul's hub is live; the others are illustrations, outlined and marked Next.
// Tokyo is drawn down and right of its spot, so its label clears Seoul's.
const NEXT_HUBS = [{ name: 'Tokyo', lat: 35.7, lon: 139.7, dx: 110, dy: 70 }, { name: 'Milan', lat: 45.5, lon: 9.2, dx: 0, dy: 0 }, { name: 'Mexico City', lat: 19.4, lon: -99.1, dx: 0, dy: 0 }];
function Hub({ x, y, name, live, from }: { x: number; y: number; name: string; live: boolean; from: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  if (frame < from) return null;
  const p = Math.min(1.1, pop(frame, fps, from)), ring = live ? 0 : ((frame - from) % 45) / 45;
  return <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -20px) scale(${p})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, background: live ? C.saving : C.surface, border: `4px solid ${live ? C.saving : C.muted}`, boxSizing: 'border-box' }}>
      {!live && <div style={{ position: 'absolute', inset: -10 - 16 * ring, borderRadius: 14, border: `2px solid ${C.muted}`, opacity: 1 - ring }} />}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, textShadow: halo, whiteSpace: 'nowrap' }}>{name}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: live ? C.saving : C.ink, textShadow: halo }}>{live ? 'Live' : 'Next'}</div>
  </div>;
}
export function Where({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS, anywhere = Math.round(wordAt(laid, 0, 'anywhere') * fps);
  // Camera move 2 of 2: the pull-back from Seoul to the world.
  const v = lerpView(KOREA, WORLD_SAFE, smooth(frame / (CLOSE_MOVE * fps)));
  const seoul = onScreen(v, SEOUL_AT);
  return <>
    <Map v={v} />
    {NEXT_HUBS.map((hub, i) => { const p = onScreen(v, project(hub.lat, hub.lon)); return <ScreenArc key={hub.name} id={`next-${i}`} a={seoul} b={{ x: p.x + hub.dx, y: p.y + hub.dy }} from={anywhere + i * 4} color={C.saving} />; })}
    <Hub x={seoul.x} y={seoul.y} name="Seoul hub" live from={0} />
    {NEXT_HUBS.map((hub, i) => { const p = onScreen(v, project(hub.lat, hub.lon)); return <Hub key={hub.name} x={p.x + hub.dx} y={p.y + hub.dy} name={hub.name} live={false} from={anywhere + i * 4} />; })}
  </>;
}

// Act 5: one technical line, then the title.
export function Close() {
  const frame = useFrame(), fps = MOTION_FPS;
  return <div style={{ position: 'absolute', inset: '0 0 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
    <div style={{ fontSize: 28, color: C.muted, marginBottom: 56, ...rise(enter(frame, fps, 0), 12) }}>FastAPI · PostgreSQL · PayPal Orders v2, Payouts, webhooks · open-weight models on Bitdeer</div>
    <div style={{ fontSize: 170, fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1, ...rise(enter(frame, fps, 10), 20) }}>Rally.</div>
    <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-.02em', marginTop: 24, ...rise(enter(frame, fps, 18), 16) }}>Agents bargain. <span style={{ color: C.accent }}>PayPal keeps it honest.</span></div>
    <div style={{ fontFamily: MONO, fontSize: 34, marginTop: 40, ...rise(enter(frame, fps, 26), 12) }}>github.com/wongywrongy/paypalaihack26</div>
    <div style={{ fontSize: 28, color: C.muted, marginTop: 12, ...rise(enter(frame, fps, 30), 12) }}>Open source, MIT</div>
  </div>;
}
