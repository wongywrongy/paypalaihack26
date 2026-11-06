import type { ReactNode } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, rise, words } from '../motion.ts';
import { Arc, at, CITIES, FEES, Land, lerpView, mapTransform, onScreen, Parcel, Pin, SHOPS, WORLD, type City, type MapView } from '../map.tsx';
import type { Laid } from '../timeline.ts';

const cue = (laid: Laid, i: number) => (laid.cues[i] ?? laid.cues[laid.cues.length - 1]).start - laid.start;
const SEOUL: MapView = { ...at('seoul'), zoom: 4.2 };

function Map({ v, children, dim = 1 }: { v: MapView; children?: ReactNode; dim?: number }) {
  return <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
    <g transform={mapTransform(v)}><Land opacity={dim} />{children}</g>
  </svg>;
}

// Words arrive 4 frames apart.
function Words({ text, from, size, color = C.ink, weight = 800 }: { text: string; from: number; size: number; color?: string; weight?: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ fontSize: size, fontWeight: weight, letterSpacing: '-.035em', lineHeight: 1.05, color }}>{words(text, frame, fps, from).map(({ word, p }, i) => <span key={i} style={{ display: 'inline-block', marginRight: '.25em', ...rise(p, size * 0.25) }}>{word}</span>)}</div>;
}

// Five shops, five separate trips to one shopper, each with its own cost.
export function Problem({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const c0 = cue(laid, 0) * fps, c1 = cue(laid, 1) * fps;
  const v = { ...WORLD, zoom: 0.97 + 0.03 * (frame / (laid.duration * fps)) };
  return <Map v={v}>
    <Pin city="california" from={c0} color={C.ink} label="Shopper" />
    {SHOPS.map((city, i) => <Pin key={city} city={city} from={c0 + 10 + i * 5} label={CITIES[city].name} />)}
    {SHOPS.map((city, i) => <Arc key={city} from={city} at={c1 + i * 6} />)}
    {SHOPS.map((city, i) => <Fee key={city} city={city} from={c1 + DUR.camera + i * 6} />)}
  </Map>;
}

function Fee({ city, from }: { city: City; from: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const p = enter(frame, fps, from, DUR.standard);
  if (frame < from) return null;
  const { x, y } = arcMid(city), text = FEES[city], w = text.length * 12.5 + 32;
  return <g transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * p})`} opacity={p}>
    <rect x={-w / 2} y={-21} width={w} height={42} rx={21} fill={C.surface} stroke={C.accent} strokeWidth={2} />
    <text x={0} y={8} textAnchor="middle" fontSize={23} fontWeight={700} fill={C.accentHover}>{text}</text>
  </g>;
}
// Where along its arc each tag sits, so tags on near-identical arcs (Seoul, Tokyo) do not collide.
const ALONG: Record<string, number> = { seoul: 0.28, tokyo: 0.62, milan: 0.5, mexico: 0.5, lagos: 0.3 };
const arcMid = (city: City) => {
  const a = at(city), b = at('california'), d = Math.hypot(b.x - a.x, b.y - a.y), u = ALONG[city], q = 1 - u;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - d * 0.28 };
  return { x: q * q * a.x + 2 * q * u * c.x + u * u * b.x, y: q * q * a.y + 2 * q * u * c.y + u * u * b.y };
};

// The five dashed trips fade and one solid arc carries one box, as the question is asked.
export function PromiseCard({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const fade = 1 - ease(interpolate(frame, [0, DUR.scene], [0, 1], clamp));
  const v = { ...WORLD, zoom: 1 + 0.03 * (frame / (laid.duration * fps)) };
  return <>
    <OneTrip v={v} fade={fade} parcel={DUR.scene} frames={Math.max(40, Math.round(laid.duration * fps) - DUR.scene - 10)} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ maxWidth: 1500 }}><Words text="What if those shops' AI agents competed for your whole cart?" from={4} size={72} /></div>
    </div>
  </>;
}

function OneTrip({ v, fade, parcel, frames }: { v: MapView; fade: number; parcel: number; frames: number }) {
  return <Map v={v}>
    {SHOPS.map(city => <Arc key={city} from={city} at={-60} fade={fade} />)}
    <Arc from="seoul" at={fade < 1 ? 6 : -60} dashed={false} color={C.accent} width={4} />
    <Pin city="california" from={-30} color={C.ink} label="Shopper" />
    {SHOPS.map(city => <Pin key={city} city={city} from={-30} label={CITIES[city].name} />)}
    <Parcel from="seoul" at={parcel} frames={frames} />
  </Map>;
}

// The safety that makes the idea work, over the same single trip.
export function Title({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const v = { ...WORLD, zoom: 1.03 + 0.03 * (frame / (laid.duration * fps)) };
  const len = laid.cues[0].end - laid.cues[0].start, c0 = (laid.cues[0].start - laid.start) * fps;
  return <>
    <OneTrip v={v} fade={0} parcel={-200} frames={60} />
    <Card top={150}>
      <Words text="You approve one price." from={c0} size={64} />
      <Words text="PayPal holds it." from={c0 + Math.round(len * 0.3 * fps)} size={64} color={C.accent} />
      <Words text="The agents can only bid it down." from={c0 + Math.round(len * 0.55 * fps)} size={64} />
    </Card>
  </>;
}

function Card({ children, top, left = 0, width }: { children: ReactNode; top: number; left?: number; width?: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', top, left: width ? left : 0, right: width ? undefined : 0, display: 'flex', justifyContent: 'center', ...rise(enter(frame, fps, 0)) }}>
    <div style={{ width, background: 'rgba(255,255,255,.95)', border: `1px solid ${C.line}`, borderRadius: 24, padding: '30px 44px', boxShadow: '0 20px 60px rgba(23,22,26,.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
  </div>;
}

// Beat 4. Into Seoul; the Seoul pin then becomes the dot on the shop's role tag.
export function Market({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const end = laid.duration * fps;
  const v = lerpView(WORLD, SEOUL, ease(interpolate(frame, [0, 1.4 * fps], [0, 1], clamp)));
  const drift = { ...v, zoom: v.zoom * (1 + 0.04 * (frame / end)) };
  const fly = ease(interpolate(frame, [end - 20, end], [0, 1], clamp));
  const pin = onScreen(drift, at('seoul')), tag = { x: 66, y: 65 };
  return <>
    <Map v={drift} />
    <Card top={250} left={150} width={760}>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.accent }}>The first market</div>
      <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.05 }}>Korean skincare</div>
      <div style={{ fontSize: 34, color: C.muted, lineHeight: 1.3 }}>Loved abroad, made by small brands</div>
      <div style={{ height: 1, background: C.line, margin: '14px 0' }} />
      <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 96, letterSpacing: '-.03em', color: C.accent, lineHeight: 1 }}>$11.4B</div>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Korean cosmetics exports in 2025, a record</div>
      <div style={{ fontSize: 20, color: C.muted }}>Ministry of Food and Drug Safety, via Korea JoongAng Daily</div>
    </Card>
    <div style={{ position: 'absolute', left: pin.x + (tag.x - pin.x) * fly - 14 + 6 * fly, top: pin.y + (tag.y - pin.y) * fly - 14 + 6 * fly, width: 28 - 12 * fly, height: 28 - 12 * fly, borderRadius: 14, background: C.accent, border: `${4 - 4 * fly}px solid ${C.surface}`, boxSizing: 'border-box' }} />
    <div style={{ position: 'absolute', left: pin.x + 26, top: pin.y - 20, fontSize: 30, fontWeight: 700, opacity: 1 - fly }}>Seoul</div>
  </>;
}

const NEXT: { city: City; what: string }[] = [{ city: 'tokyo', what: 'stationery' }, { city: 'milan', what: 'leather goods' }, { city: 'mexico', what: 'ceramics' }];

// Beat 11. Back out to the world: Seoul is live, other places are illustrations marked Next.
export function Where({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const c1 = cue(laid, 1) * fps, c2 = cue(laid, 2) * fps;
  const v0 = lerpView(SEOUL, WORLD, ease(interpolate(frame, [0, 1.6 * fps], [0, 1], clamp)));
  const v = { ...v0, zoom: v0.zoom * (1 + 0.06 * (frame / (laid.duration * fps))) };
  const s = 1 / v.zoom, end = enter(frame, fps, c2, DUR.scene);
  return <>
    <Map v={v} dim={1 - 0.5 * end}>
      <Arc from="seoul" at={c1} dashed={false} color={C.accent} width={4 * s} />
      <Parcel from="seoul" at={c1 + 10} frames={60} />
      <Pin city="california" from={0} color={C.ink} label="Shopper" scale={s} />
      <Pin city="seoul" from={0} label="Seoul" sub="Live" scale={s} />
      {NEXT.map((row, i) => <Pin key={row.city} city={row.city} from={Math.round(1.2 * fps) + i * 6} color={C.muted} label={CITIES[row.city].name} sub={`Next · ${row.what}`} pulse scale={s} />)}
    </Map>
    {frame >= c2 && <div style={{ position: 'absolute', inset: '0 0 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', ...rise(end, 24) }}>
      <div style={{ background: C.ground, border: `1px solid ${C.line}`, boxShadow: '0 24px 80px rgba(23,22,26,.12)', borderRadius: 32, padding: '56px 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${1 + 0.012 * Math.max(0, frame - c2) / fps})` }}>
        <div style={{ fontSize: 170, fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1 }}>Rally.</div>
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-.02em', marginTop: 24 }}>Agents bargain. <span style={{ color: C.accent }}>PayPal keeps it honest.</span></div>
        <div style={{ fontFamily: MONO, fontSize: 34, marginTop: 40 }}>github.com/wongywrongy/paypalaihack26</div>
        <div style={{ fontSize: 28, color: C.muted, marginTop: 12 }}>Open source, MIT</div>
      </div>
    </div>}
  </>;
}
