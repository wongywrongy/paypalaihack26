import type { CSSProperties, ReactNode } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { money, SHOP_NAMES, SHORT_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, pop, rise, smooth } from '../motion.ts';
import { Land, lerpView, mapTransform, onScreen, project, WORLD, type MapView } from '../map.tsx';
import { Lock, Photo } from '../ui.tsx';
import { Rail } from './Rail.tsx';
import type { Laid } from '../timeline.ts';

type Shop = keyof typeof SHOP_NAMES;
type Point = { x: number; y: number };
const cue = (laid: Laid, i: number) => (laid.cues[i] ?? laid.cues[laid.cues.length - 1]).start - laid.start;
const SEOUL_AT = project(37.5, 127), CALIFORNIA_AT = project(36.8, -119.4);
const KOREA: MapView = { ...SEOUL_AT, zoom: 4.2 };
// Korea and California both in frame, the Pacific between them.
const PACIFIC: MapView = { x: (SEOUL_AT.x + CALIFORNIA_AT.x) / 2, y: SEOUL_AT.y + 60, zoom: 1.45 };
// The three shops sit around Seoul. Their spread is screen pixels at Korea's zoom, shrinking as the map pulls out.
const SHOP_SPOTS: Record<Shop, { dx: number; dy: number; left?: boolean }> = { haneul: { dx: -230, dy: -40, left: true }, bada: { dx: 190, dy: -120 }, dalbit: { dx: 110, dy: 130 } };
const SHOPS = Object.keys(SHOP_SPOTS) as Shop[];
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

const halo = `0 0 6px ${C.ground}, 0 0 6px ${C.ground}, 0 0 10px ${C.ground}`;

function ShopPin({ v, shop, from, note }: { v: MapView; shop: Shop; from: number; note?: ReactNode }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  if (frame < from) return null;
  const p = shopAt(v, shop), s = Math.min(1.15, pop(frame, fps, from));
  return <div style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${s})` }}>
    <div style={{ width: 26, height: 26, borderRadius: 13, background: C.accent, border: `4px solid ${C.surface}`, boxShadow: '0 2px 8px rgba(23,22,26,.25)' }} />
    <div style={{ position: 'absolute', [SHOP_SPOTS[shop].left ? 'right' : 'left']: 36, top: -6, whiteSpace: 'nowrap', fontSize: 30, fontWeight: 800, color: C.ink, textShadow: halo }}>{SHOP_NAMES[shop]}</div>
    {note && <div style={{ position: 'absolute', left: 36, top: 34, whiteSpace: 'nowrap' }}>{note}</div>}
  </div>;
}

const Tag = ({ children, tone = 'fee', style }: { children: ReactNode; tone?: 'fee' | 'stop' | 'ok'; style?: CSSProperties }) =>
  <span style={{ display: 'inline-block', fontSize: 24, fontWeight: 700, borderRadius: 999, padding: '5px 14px', background: C.surface, whiteSpace: 'nowrap', color: tone === 'ok' ? C.saving : C.accentHover, border: `2px solid ${tone === 'ok' ? C.saving : C.accent}`, ...style }}>{children}</span>;

const bend = (a: Point, b: Point, lift: number) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * lift });
const along = (a: Point, b: Point, u: number, lift = 0.3) => {
  const c = bend(a, b, lift), q = 1 - u;
  return { x: q * q * a.x + 2 * q * u * c.x + u * u * b.x, y: q * q * a.y + 2 * q * u * c.y + u * u * b.y };
};

// An arc in screen pixels, drawn to `until` of its length.
function ScreenArc({ a, b, from, until = 1, color = C.ink, dashed = true, width = 3, id }: { a: Point; b: Point; from: number; until?: number; color?: string; dashed?: boolean; width?: number; id: string }) {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const c = bend(a, b, 0.3), path = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  const draw = evolvePath(until * ease(interpolate(frame, [from, from + DUR.camera], [0, 1], clamp)), path);
  return <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    <mask id={id}><path d={path} stroke="#fff" strokeWidth={width + 6} fill="none" strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} /></mask>
    <path d={path} stroke={color} strokeWidth={width} fill="none" strokeDasharray={dashed ? '9 10' : undefined} strokeLinecap="round" mask={`url(#${id})`} />
  </svg>;
}

const Source = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div style={{ fontSize: 20, color: C.muted, textShadow: halo, ...style }}>{children}</div>;

// Act 1, beat 1: Korea, three small shops around Seoul, and the sourced figure.
export function Korea({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const v = { ...KOREA, zoom: KOREA.zoom * (1 + 0.012 * frame / fps) };
  const c0 = cue(laid, 0) * fps;
  return <>
    <Map v={v} />
    {SHOPS.map((shop, i) => <ShopPin key={shop} v={v} shop={shop} from={c0 + 12 + i * 8} />)}
    <div style={{ position: 'absolute', left: 130, top: 640, display: 'flex', flexDirection: 'column', gap: 6, padding: '22px 30px', borderRadius: 20, background: 'rgba(247,244,240,.92)', ...rise(enter(frame, fps, c0 + 30)) }}>
      <div style={{ fontFamily: MONO, fontSize: 92, letterSpacing: '-.03em', color: C.accent, lineHeight: 1 }}>$11.4B</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>Korean skincare sold abroad in 2025, a record</div>
      <Source>Ministry of Food and Drug Safety via Korea JoongAng Daily</Source>
    </div>
  </>;
}

// Act 1, beats 2 and 3: the four products, the one shop that has them all and doesn't ship abroad, and the split order.
export function Split({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const c0 = cue(laid, 0) * fps, c1 = cue(laid, 1) * fps, c2 = cue(laid, 2) * fps;
  const out = ease(interpolate(frame, [0, 1.6 * fps], [0, 1], clamp));
  const v0 = lerpView(KOREA, PACIFIC, out), v = { ...v0, zoom: v0.zoom * (1 + 0.01 * frame / fps) };
  const shopper = onScreen(v, CALIFORNIA_AT);
  const bada = shopAt(v, 'bada'), haneul = shopAt(v, 'haneul'), dalbit = shopAt(v, 'dalbit');
  const listed = start.listed as Record<string, Record<string, number>>;
  const compare = items.find(id => new Set(Object.values(listed[id] ?? {})).size > 1) ?? items[0];
  const flash = frame >= c2 ? Math.floor((frame - c2) / 12) % 2 : -1;
  const meIn = enter(frame, fps, Math.round(1.2 * fps));
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
    {frame >= c1 + DUR.camera && [haneul, dalbit].map((shop, i) => {
      const m = along(shop, shopper, i ? 0.6 : 0.72);
      return <div key={i} style={{ position: 'absolute', left: m.x, top: m.y + (i ? 26 : -64), display: 'flex', gap: 10, transform: 'translateX(-50%)', ...rise(enter(frame, fps, c1 + DUR.camera + i * 6), 8) }}><Tag>+ shipping</Tag><Tag>+ duties</Tag></div>;
    })}
    {frame >= c1 + DUR.camera + 20 && <Source style={{ position: 'absolute', left: along(dalbit, shopper, 0.6).x - 120, top: along(dalbit, shopper, 0.6).y + 80, ...rise(enter(frame, fps, c1 + DUR.camera + 20), 6) }}>US de minimis suspended Aug 29, 2025 · CBP</Source>}
    <div style={{ position: 'absolute', left: shopper.x, top: shopper.y, transform: 'translate(-50%, -50%)', width: 26, height: 26, borderRadius: 13, background: C.ink, border: `4px solid ${C.surface}`, opacity: meIn }} />
    <div style={{ position: 'absolute', left: shopper.x - 170, top: shopper.y + 30, width: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: meIn }}>
      <div style={{ fontSize: 30, fontWeight: 800, textShadow: halo }}>You, in California</div>
      <div style={{ display: 'flex', gap: 10 }}>{items.map((id, i) => <div key={id} style={rise(enter(frame, fps, Math.round(1.2 * fps) + i * 5), 10)}><Photo id={id} size={60} /></div>)}</div>
    </div>
    {frame >= c2 && <div style={{ position: 'absolute', left: shopper.x - 250, top: shopper.y + 190, width: 500, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, ...rise(enter(frame, fps, c2), 10) }}>
      <Photo id={compare} size={60} />
      {Object.entries(listed[compare]).map(([shop, unit], i) => <span key={shop} style={{ fontFamily: MONO, fontSize: 30, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', border: `2px solid ${flash === i ? C.accent : C.line}`, background: flash === i ? C.tint : C.surface }}>{SHORT_NAMES[shop as Shop]} {cash(unit)}</span>)}
    </div>}
  </>;
}

// --- Act 2: the five steps, drawn as they are spoken. No UI, the same background. ---
const SHOP_Y: Record<Shop, number> = { haneul: 420, bada: 600, dalbit: 780 };
const SHOP_X = 330, HUB = { x: 880, y: 660 }, BAG = { x: 1440, y: 720 }, TAG = { x: 1440, y: 450 };
const winnerShops = [...new Set(Object.values(manifest.run.winners).map(row => row.shop))] as Shop[];

function Node({ x, y, label, sub, color = C.accent, from, children }: { x: number; y: number; label: string; sub?: string; color?: string; from: number; children?: ReactNode }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  if (frame < from) return null;
  const p = Math.min(1.1, pop(frame, fps, from));
  return <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${p})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ position: 'relative', width: 70, height: 70, borderRadius: 35, background: color, display: 'grid', placeItems: 'center', color: C.surface, fontSize: 30, fontWeight: 800, boxShadow: '0 6px 20px rgba(23,22,26,.15)' }}>{label[0]}{children}</div>
    <div style={{ fontSize: 28, fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</div>
    {sub && <div style={{ fontSize: 22, color: C.muted, whiteSpace: 'nowrap' }}>{sub}</div>}
  </div>;
}

// Something travelling from a to b over `frames`, starting at `from`, then fading.
function Mover({ a, b, from, frames = 24, children, lift = 0.25 }: { a: Point; b: Point; from: number; frames?: number; children: ReactNode; lift?: number }) {
  const frame = useCurrentFrame();
  if (frame < from || frame > from + frames + 6) return null;
  const p = along(a, b, smooth((frame - from) / frames), lift);
  return <div style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)', opacity: frame > from + frames ? 1 - (frame - from - frames) / 6 : 1 }}>{children}</div>;
}

const Parcel = ({ size }: { size: number }) => <div style={{ width: size, height: size * 0.86, borderRadius: size / 7, background: C.butter, border: `3px solid ${C.ink}`, boxSizing: 'border-box' }} />;

export function Steps({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
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
    <Map v={{ ...WORLD, zoom: 1 + 0.01 * frame / fps }} dim={0.28} />
    <Rail shown={step} filled={step ? step as 1 : null} from={at} />
    {/* Seoul side: the three shops, then their agents and the owner's limits. */}
    <div style={{ position: 'absolute', left: SHOP_X - 110, top: 310, fontSize: 24, fontWeight: 700, color: C.muted, opacity: enter(frame, fps, 0) }}>Shops in Seoul</div>
    {SHOPS.map((shop, i) => <Node key={shop} x={SHOP_X} y={SHOP_Y[shop]} label={SHOP_NAMES[shop]} from={6 + i * 5}>
      {frame >= at[2] && <span style={{ position: 'absolute', left: 52, top: -10, fontSize: 19, fontWeight: 800, color: C.ink, background: C.butter, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', transform: `scale(${Math.min(1, pop(frame, fps, at[2] + i * 5))})` }}>AI agent</span>}
    </Node>)}
    {frame >= at[2] + 20 && <div style={{ position: 'absolute', left: SHOP_X + 150, top: SHOP_Y.haneul + 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, fontWeight: 700, color: C.accentHover, border: `2px solid ${C.accent}`, borderRadius: 999, padding: '4px 14px', background: C.surface, ...rise(enter(frame, fps, at[2] + 20), 8) }}><Lock size={20} color={C.accent} />owner's limits</div>}
    {/* California side: the shopper's bag and its one price. */}
    <Node x={BAG.x} y={BAG.y} label="Shopper" sub="California" color={C.ink} from={6} />
    {frame >= at[0] && items.map((id, i) => <Mover key={id} a={{ x: BAG.x - 330 + i * 110, y: BAG.y + 200 }} b={BAG} from={at[0] + i * 4} frames={22} lift={0.6}><Photo id={id} size={64} /></Mover>)}
    {frame >= at[0] + 24 && <div style={{ position: 'absolute', left: TAG.x, top: TAG.y, transform: 'translate(-50%, -50%)', ...rise(tagIn, 12) }}>
      <div style={{ position: 'relative', padding: '18px 30px', borderRadius: 20, background: C.surface, border: `1px solid ${C.line}`, textAlign: 'center', boxShadow: '0 12px 40px rgba(23,22,26,.08)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.muted }}>One bag, all in</div>
        <div style={{ fontFamily: MONO, fontSize: 72, letterSpacing: '-.03em', lineHeight: 1.05, color: step >= 5 ? C.saving : C.ink }}>{cash(Math.round(price))}</div>
        <div style={{ fontSize: 21, color: C.muted, whiteSpace: 'nowrap' }}>items · shipping · duties · tax · Rally's fee</div>
        {/* PayPal's hold: a bracket around the price, with the ceiling above it. */}
        <div style={{ position: 'absolute', inset: -14, borderRadius: 26, border: `4px solid ${C.accent}`, opacity: bracket, transform: `scale(${1.08 - 0.08 * bracket})` }} />
        <div style={{ position: 'absolute', left: -40, right: -40, top: -50, height: 3, background: C.accent, opacity: bracket }} />
        <div style={{ position: 'absolute', left: -100, right: -100, top: -92, fontSize: 24, fontWeight: 700, color: C.accentHover, opacity: bracket, whiteSpace: 'nowrap' }}>PayPal holds it · the most you can pay</div>
        {step >= 5 && <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 26, fontSize: 26, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap', opacity: released * (1 - 0.5 * ease(interpolate(frame, [at[4] + DUR.camera * 2, end], [0, 1], clamp))) }}>released {cash(held - charged)}</div>}
      </div>
    </div>}
    {/* Step 3: bids fly from the shops to the bag, again and again. */}
    {step === 3 && [0, 1, 2, 3, 4, 5, 6, 7].map(n => {
      const shop = SHOPS[n % 3], f = at[2] + 10 + n * 14;
      return <Mover key={n} a={{ x: SHOP_X + 40, y: SHOP_Y[shop] }} b={{ x: TAG.x - 180, y: TAG.y + 20 }} from={f} frames={30} lift={0.15}><span style={{ fontSize: 22, fontWeight: 800, color: C.ink, background: C.butter, borderRadius: 999, padding: '4px 12px' }}>bid</span></Mover>;
    })}
    {/* Step 4: winning items go a short way to the Seoul hub; one box goes on to California, duties paid. */}
    <Node x={HUB.x} y={HUB.y} label="Rally hub" sub="Seoul" color={C.saving} from={at[3]} />
    {step >= 4 && winnerShops.map((shop, i) => <Mover key={shop} a={{ x: SHOP_X, y: SHOP_Y[shop] }} b={HUB} from={at[3] + 10 + i * 6} frames={22} lift={0.1}><Parcel size={28} /></Mover>)}
    {step >= 4 && <ScreenArc id="box" a={HUB} b={BAG} from={at[3] + 44} dashed={false} color={C.saving} width={4} />}
    {step >= 4 && <Mover a={HUB} b={BAG} from={at[3] + 44} frames={36} lift={0.3}><Parcel size={46} /></Mover>}
    {frame >= at[3] + 60 && <div style={{ position: 'absolute', left: along(HUB, BAG, 0.5).x, top: along(HUB, BAG, 0.5).y - 64, transform: 'translateX(-50%)', ...rise(enter(frame, fps, at[3] + 60), 8) }}><Tag tone="ok">one box · duties paid</Tag></div>}
    {/* Step 5: PayPal pays each winning shop. */}
    {step >= 5 && winnerShops.map((shop, i) => <Mover key={shop} a={{ x: TAG.x - 120, y: TAG.y }} b={{ x: SHOP_X + 40, y: SHOP_Y[shop] }} from={at[4] + DUR.camera + 6 + i * 8} frames={30} lift={0.2}><div style={{ width: 36, height: 36, borderRadius: 18, background: C.saving, color: C.surface, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 800 }}>$</div></Mover>)}
  </>;
}

// --- Act 4 ---
const CARDS = [
  { who: 'Shoppers', line: 'One box, and a price that can only go down' },
  { who: 'Small shops', line: 'Sell abroad with no export logistics, paid once they hand off' },
  { who: 'PayPal', line: 'A hard spending limit AI agents cannot cross' },
];
export function Why({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <>
    <Map v={{ ...WORLD, zoom: 1 + 0.01 * frame / fps }} dim={0.28} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 290, display: 'flex', justifyContent: 'center', gap: 40, transform: `scale(${1 + 0.008 * frame / fps})` }}>
      {CARDS.map((card, i) => {
        const p = enter(frame, fps, Math.round(cue(laid, i) * fps));
        return <div key={card.who} style={{ width: 480, minHeight: 300, boxSizing: 'border-box', padding: '36px 40px', borderRadius: 24, background: i === 2 ? C.tint : C.surface, border: `1px solid ${i === 2 ? C.accent : C.line}`, boxShadow: '0 16px 50px rgba(23,22,26,.08)', display: 'flex', flexDirection: 'column', gap: 18, ...rise(p, 24) }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: i === 2 ? C.accentHover : C.accent }}>{card.who}</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.12 }}>{card.line}</div>
        </div>;
      })}
    </div>
  </>;
}

// Seoul's hub is live; the others are illustrations, outlined and marked Next.
const NEXT_HUBS = [{ name: 'Tokyo', lat: 35.7, lon: 139.7, dy: 70 }, { name: 'Milan', lat: 45.5, lon: 9.2, dy: 0 }, { name: 'Mexico City', lat: 19.4, lon: -99.1, dy: 0 }];
function Hub({ x, y, name, live, from }: { x: number; y: number; name: string; live: boolean; from: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
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
export function Where() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const v0 = lerpView(PACIFIC, WORLD, ease(interpolate(frame, [0, 1.4 * fps], [0, 1], clamp))), v = { ...v0, zoom: v0.zoom * (1 + 0.012 * frame / fps) };
  const seoul = onScreen(v, SEOUL_AT);
  return <>
    <Map v={v} />
    <Hub x={seoul.x} y={seoul.y} name="Seoul hub" live from={0} />
    {NEXT_HUBS.map((hub, i) => { const p = onScreen(v, project(hub.lat, hub.lon)); return <Hub key={hub.name} x={p.x} y={p.y + hub.dy} name={hub.name} live={false} from={Math.round(1.6 * fps) + i * 8} />; })}
  </>;
}

// Act 5: one technical line, then the title.
export function Close() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: '0 0 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', transform: `scale(${1 + 0.01 * frame / fps})` }}>
    <div style={{ fontSize: 22, color: C.muted, marginBottom: 56, ...rise(enter(frame, fps, 0), 12) }}>FastAPI · PostgreSQL · PayPal Orders v2, Payouts, webhooks · open-weight models on Bitdeer</div>
    <div style={{ fontSize: 170, fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1, ...rise(enter(frame, fps, 10), 20) }}>Rally.</div>
    <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-.02em', marginTop: 24, ...rise(enter(frame, fps, 18), 16) }}>Agents bargain. <span style={{ color: C.accent }}>PayPal keeps it honest.</span></div>
    <div style={{ fontFamily: MONO, fontSize: 34, marginTop: 40, ...rise(enter(frame, fps, 26), 12) }}>github.com/wongywrongy/paypalaihack26</div>
    <div style={{ fontSize: 28, color: C.muted, marginTop: 12, ...rise(enter(frame, fps, 30), 12) }}>Open source, MIT</div>
  </div>;
}
