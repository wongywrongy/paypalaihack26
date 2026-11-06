// The film's kit (STYLE.md): canvas, glass panels, word reveals, odometer numbers, the shimmer, cursor and keycaps.
import type { CSSProperties, ReactNode } from 'react';
import { Audio, interpolate, OffthreadVideo, Freeze, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FIELDS, LIGHT, manifest, MONO, SANS } from '../theme.ts';
import { clamp, DUR, ease, enter, MOTION_FPS, reveal, smooth, useFrame, words } from '../motion.ts';
import { Redactions } from '../ui.tsx';
import type { ClipName } from '../timeline.ts';

// Near-black, with large soft colour fields drifting slowly behind everything, and grain so they never band.
// money: 0 to 1, how much of the green field shows.
export function Canvas({ money = 0, light = 0 }: { money?: number; light?: number }) {
  const frame = useFrame(), t = frame / MOTION_FPS;
  const field = (color: string, x: number, y: number, r: number, a: number) => `radial-gradient(${r}px ${r * 0.8}px at ${x}% ${y}%, ${color}${Math.round(a * 255).toString(16).padStart(2, '0')}, transparent 70%)`;
  const bg = [
    field(FIELDS.raspberry, 22 + 6 * Math.sin(t / 9), 28 + 5 * Math.cos(t / 11), 1100, 0.34),
    field(FIELDS.blue, 78 + 5 * Math.cos(t / 10), 70 + 6 * Math.sin(t / 8), 1200, 0.42),
    field(FIELDS.green, 60 + 8 * Math.sin(t / 7), 35 + 4 * Math.cos(t / 9), 900, 0.3 * money),
  ].join(', ');
  return <div style={{ position: 'absolute', inset: 0, background: C.ground }}>
    <div style={{ position: 'absolute', inset: -100, backgroundImage: bg, filter: 'blur(40px)' }} />
    {light > 0 && <div style={{ position: 'absolute', inset: 0, background: LIGHT.ground, opacity: light }} />}
  </div>;
}

// 2–3% film grain over the full frame, a new pattern every frame.
export function Grain() {
  const frame = useCurrentFrame();
  return <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05, mixBlendMode: 'overlay' }}>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 97} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>;
}

export const glass: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.04))',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12), 0 1px 2px rgba(0,0,0,.45), 0 30px 80px rgba(0,0,0,.5)',
  backdropFilter: 'blur(28px) saturate(1.3)', borderRadius: 24, color: C.ink, fontFamily: SANS,
};

export function Glass({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...glass, ...style }}>{children}</div>;
}

// A headline or line, revealed word by word.
export function Words({ text, from, size, color = C.ink, weight = 800, style }: { text: string; from: number; size: number; color?: string; weight?: number; style?: CSSProperties }) {
  const frame = useFrame();
  return <div style={{ fontSize: size, fontWeight: weight, letterSpacing: '-.02em', lineHeight: 1.06, color, ...style }}>{words(text, frame, MOTION_FPS, from).map(({ word, p }, i) => <span key={i} style={{ display: 'inline-block', marginRight: '.24em', ...reveal(p) }}>{word}</span>)}</div>;
}

// An amount whose digits roll like an odometer, each column on its own. `cents` may be fractional mid-roll.
// `digits` fixes the width (from the largest amount shown) so nothing shifts as columns disappear.
export function Odometer({ cents, digits, symbol = '$', style }: { cents: number; digits: number; symbol?: string; style?: CSSProperties }) {
  const v = Math.max(0, cents);
  const columns = Array.from({ length: digits }, (_, i) => digits - 1 - i);
  return <span style={{ display: 'inline-flex', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em', lineHeight: 1, ...style }}>
    <span>{symbol}</span>
    {columns.map(k => {
      const unit = 10 ** k, digit = Math.floor(v / unit) % 10;
      // A column turns over only while the column below it rolls through its last step.
      const roll = k === 0 ? v - Math.floor(v) : Math.min(1, Math.max(0, (v % unit) - (unit - 1)));
      const shown = k <= 2 || v >= unit - 0.5 ? 1 : Math.max(0, v - (unit - 1));
      return <span key={k} style={{ display: 'inline-flex' }}>
        {k === 1 && <span>.</span>}
        <span style={{ display: 'inline-block', height: '1em', overflow: 'hidden', width: `${0.6 * Math.min(1, shown * 1.5)}em`, opacity: shown }}>
          <span style={{ display: 'flex', flexDirection: 'column', transform: `translateY(${-(digit + roll)}em)` }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => <span key={i} style={{ height: '1em' }}>{n}</span>)}</span>
        </span>
      </span>;
    })}
  </span>;
}

// A sound effect at a motion frame, at −18 dB (sfx/LICENSE.txt).
export function Sfx({ at, kind }: { at: number; kind: 'click' | 'whoosh' | 'tick' }) {
  const { fps } = useVideoConfig();
  return <Sequence from={Math.max(0, Math.round(at * fps / MOTION_FPS))} layout="none"><Audio src={staticFile(`generated/sfx/${kind}.wav`)} volume={10 ** (-18 / 20)} /></Sequence>;
}

// The one highlight in the film: a single sweep of light across the final price.
export function Shimmer({ at, children }: { at: number; children: ReactNode }) {
  const frame = useFrame();
  const p = interpolate(frame, [at, at + 24], [0, 1], clamp);
  return <span style={{ position: 'relative', display: 'inline-block' }}>
    <Sfx at={at} kind="tick" />
    {children}
    {p > 0 && p < 1 && <span aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${p * 140 - 30}%, rgba(255,255,255,.75) ${p * 140 - 15}%, transparent ${p * 140}%)`, mixBlendMode: 'overlay', pointerEvents: 'none' }} />}
  </span>;
}

type Point = { x: number; y: number };
// A drawn cursor gliding along a curve to `to`, clicking at `click` (motion frames). Only for clicks that matter.
export function Cursor({ from, to, start, click }: { from: Point; to: Point; start: number; click: number }) {
  const frame = useFrame();
  if (frame < start) return null;
  const sound = <Sfx at={click} kind="click" />;
  const u = smooth((frame - start) / Math.max(1, click - start - 3)), q = 1 - u;
  const c = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.25, y: (from.y + to.y) / 2 - (to.x - from.x) * 0.15 };
  const x = q * q * from.x + 2 * q * u * c.x + u * u * to.x, y = q * q * from.y + 2 * q * u * c.y + u * u * to.y;
  const press = frame >= click && frame < click + 6 ? 0.88 : 1;
  const ring = interpolate(frame, [click, click + DUR.standard * 1.6], [0, 1], clamp);
  const gone = interpolate(frame, [click + 30, click + 40], [1, 0], clamp);
  return <div style={{ position: 'absolute', left: 0, top: 0, opacity: gone, pointerEvents: 'none' }}>
    {sound}
    {ring > 0 && ring < 1 && <div style={{ position: 'absolute', left: to.x - 40 * ring, top: to.y - 40 * ring, width: 80 * ring, height: 80 * ring, borderRadius: '50%', border: `2px solid rgba(255,255,255,${0.7 * (1 - ring)})` }} />}
    <svg width={34} height={34} viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 4, top: y - 3, transform: `scale(${press})`, transformOrigin: '4px 3px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))' }}>
      <path d="M4 3 L19 12 L12.5 13.6 L9.6 20 Z" fill="#fff" stroke="#0B0B0F" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  </div>;
}

// A keycap, pressed when `down`.
export const Keycap = ({ label, down }: { label: string; down: boolean }) => <span style={{ display: 'inline-grid', placeItems: 'center', minWidth: 58, height: 58, padding: '0 14px', boxSizing: 'border-box', borderRadius: 14, fontFamily: MONO, fontSize: 28, color: C.ink,
  background: down ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)', boxShadow: down ? 'inset 0 0 0 1px rgba(255,255,255,.3)' : 'inset 0 0 0 1px rgba(255,255,255,.16), 0 4px 0 rgba(0,0,0,.45)', transform: `translateY(${down ? 3 : 0}px)` }}>{label}</span>;

// The real recording, small, in a light frame: proof the drawn panels are the running product. It is only ever
// scaled down (a 1440×900 window shown 540 px wide), and its redactions travel with it.
export const PROOF_W = 540;
export function Proof({ name, from, to }: { name: ClipName; from: number; to: number }) {
  const frame = useFrame(), { fps } = useVideoConfig();
  const s = frame / MOTION_FPS, meta = manifest.clips[name];
  const at = Math.min(from + s, to, meta ? (meta.frames - 2) / fps : Infinity);
  const p = enter(frame, MOTION_FPS, 0, DUR.standard), out = 1 - enter(frame, MOTION_FPS, (to - from) * MOTION_FPS - DUR.standard, DUR.standard);
  const k = PROOF_W / 1440;
  return <div style={{ position: 'absolute', right: 48, bottom: 200, width: PROOF_W + 20, padding: 10, borderRadius: 20, background: LIGHT.ground, boxShadow: '0 30px 80px rgba(0,0,0,.55)', opacity: Math.min(p, out), transform: `translateY(${(1 - p) * 24}px)` }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: LIGHT.ink, padding: '2px 6px 10px' }}>Screen recording · PayPal sandbox</div>
    <div style={{ position: 'relative', width: PROOF_W, height: 900 * k, overflow: 'hidden', borderRadius: 12 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1440, height: 900, transformOrigin: '0 0', transform: `scale(${k})` }}>
        {meta && <Freeze frame={0}><OffthreadVideo src={staticFile(`generated/clips/${name}.mp4`)} muted trimBefore={Math.round(at * fps)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /></Freeze>}
        <Redactions name={name} seconds={at} />
      </div>
    </div>
  </div>;
}

