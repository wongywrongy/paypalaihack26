import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Freeze, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { C, manifest, MONO, SANS } from './theme.ts';
import { BASE, clamp, CLIP_H, CLIP_W, clipTime, DUR, ease, enter, view, type TimedKey, type View } from './motion.ts';
import { CLIPS, captionEnd, ROLES, type ClipName, type Role } from './timeline.ts';
import { PLAN } from './plan.ts';

const MONEY = /((?:[AC]\$|[$£€])\d[\d,.]*\d[BM]?(?: billion)?)/;

// Money is always in the mono font, wherever a sentence happens to contain it.
export const Rich = ({ text }: { text: string }) => <>{text.split(MONEY).map((part, i) => i % 2 ? <span key={i} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{part}</span> : <Fragment key={i}>{part}</Fragment>)}</>;

export const Photo = ({ id, size }: { id: string; size: number }) => <Img src={staticFile(`generated/products/${id}.png`)} style={{ width: size, height: size, flex: 'none', objectFit: 'cover', borderRadius: size / 6, background: C.ground }} />;

export function Pill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: C.ink, color: C.surface, borderRadius: 999, padding: '10px 20px', fontSize: 24, fontWeight: 600, whiteSpace: 'nowrap', ...style }}>{children}</div>;
}

// A drawn tick, so it matches the stroke of the rest of the frame.
export function Tick({ size = 22, color = C.saving, progress = 1 }: { size?: number; color?: string; progress?: number }) {
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, 'M 4 12.5 L 9.5 18 L 20 6');
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}><path d="M 4 12.5 L 9.5 18 L 20 6" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} /></svg>;
}

export const Lock = ({ size, color }: { size: number; color: string }) => <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}><rect x="5" y="11" width="14" height="10" rx="2.5" fill="none" stroke={color} strokeWidth="2.2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke={color} strokeWidth="2.2" /></svg>;

// A private value is covered from the first frame it could show: the viewer sees that it is set, never what it is.
function Redactions({ name, seconds }: { name: ClipName; seconds: number }) {
  return <>{manifest.run.redact.filter(area => area.clip === name && seconds >= area.from && seconds <= area.to).map((area, i) => {
    const r = area.rect, box: CSSProperties = { position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height };
    if (area.style !== 'private') return <div key={i} style={{ ...box, backdropFilter: 'blur(14px)', background: 'rgba(247,244,240,.4)', borderRadius: 6 }} />;
    const h = Math.min(26, r.height - 8);
    return <div key={i} style={{ ...box, background: C.surface, display: 'grid', placeItems: 'center' }}>
      <div style={{ height: h, display: 'flex', alignItems: 'center', gap: h * 0.2, padding: `0 ${h * 0.45}px`, borderRadius: h, border: `1.5px solid ${C.accent}`, color: C.accentHover, fontFamily: SANS, fontSize: h * 0.56, fontWeight: 600 }}><Lock size={h * 0.62} color={C.accent} />Private</div>
    </div>;
  })}</>;
}

function Placeholder({ name }: { name: ClipName }) {
  return <div style={{ position: 'absolute', inset: 0, background: '#D5D2CD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted, textAlign: 'center' }}>
    <div style={{ fontFamily: MONO, fontSize: 40, color: C.ink }}>{name}.mp4</div>
    <div style={{ fontSize: 26 }}>{CLIPS[name]}</div>
    <div style={{ fontSize: 20 }}>Placeholder until the recording exists</div>
  </div>;
}

// Full-bleed footage under a moving camera. `from`/`to` are clip seconds, `length` the shot's seconds.
export type TimedSpot = { s: number; rect: { x: number; y: number; width: number; height: number } };
export function Clip({ name, from, to, length, keys, spots = [] }: { name: ClipName; from: number; to: number; length: number; keys: TimedKey[]; spots?: TimedSpot[] }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const meta = manifest.clips[name];
  const s = frame / fps, v = view(keys, s);
  const at = Math.min(clipTime(s, length, from, to), meta ? (meta.frames - 2) / fps : Infinity);
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: C.ground }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: CLIP_W, height: CLIP_H, transformOrigin: '0 0', transform: cameraTransform(v) }}>
      {meta
        // One clip frame per video frame: the clock above decides which, so ramps and holds need no re-encode.
        ? <Freeze frame={0}><OffthreadVideo src={staticFile(`generated/clips/${name}.mp4`)} muted trimBefore={Math.round(at * fps)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /></Freeze>
        : <Placeholder name={name} />}
      <Redactions name={name} seconds={at} />
      <Spotlight spots={spots} s={s} />
    </div>
  </div>;
}

// Dims everything but one rectangle of the clip, gliding from one spot to the next.
function Spotlight({ spots, s }: { spots: TimedSpot[]; s: number }) {
  if (!spots.length || s < spots[0].s) return null;
  let i = 0;
  while (i + 1 < spots.length && spots[i + 1].s <= s) i++;
  const p = i === 0 ? 1 : ease((s - spots[i].s) / 0.5), a = spots[Math.max(0, i - 1)].rect, b = spots[i].rect;
  const r = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.width + (b.width - a.width) * p, h: a.height + (b.height - a.height) * p };
  const fade = Math.min(1, (s - spots[0].s) / 0.4), pad = 6;
  return <svg width={CLIP_W} height={CLIP_H} style={{ position: 'absolute', inset: 0, opacity: fade }}>
    <path fillRule="evenodd" fill="rgba(247,244,240,.93)" d={`M0 0H${CLIP_W}V${CLIP_H}H0Z M${r.x - pad} ${r.y - pad}h${r.w + 2 * pad}v${r.h + 2 * pad}h${-(r.w + 2 * pad)}Z`} />
    <rect x={r.x - pad} y={r.y - pad} width={r.w + 2 * pad} height={r.h + 2 * pad} rx={8} fill="none" stroke={C.accent} strokeWidth={2} />
  </svg>;
}

export const cameraTransform = (v: View) => `translate(${960 - v.x * BASE * v.zoom}px, ${540 - v.y * BASE * v.zoom}px) scale(${BASE * v.zoom})`;

// "Whose screen is this": top left, cross-fading when the side changes.
export function RoleTag({ role, since }: { role: Role | null; since: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  if (!role) return null;
  const p = enter(frame, fps, since, DUR.standard);
  return <div style={{ position: 'absolute', left: 40, top: 36, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px 12px 18px', borderRadius: 999, background: 'rgba(255,255,255,.94)', border: `1px solid ${C.line}`, boxShadow: '0 6px 24px rgba(23,22,26,.10)', fontSize: 28, fontWeight: 600, color: C.ink, opacity: p, transform: `translateY(${(1 - p) * -10}px)` }}>
    <div style={{ width: 16, height: 16, borderRadius: 8, background: role === 'shop' ? C.accent : C.ink }} />{ROLES[role]}
  </div>;
}

// One caption style for the whole video: bottom centre, at most two lines, over a steady scrim.
export function Captions() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const s = frame / fps;
  const i = PLAN.lines.findIndex((line, n) => s >= line.start - 0.1 && s < captionEnd(PLAN, n));
  const line = PLAN.lines[i];
  const fade = line ? Math.min(interpolate(frame, [(line.start - 0.1) * fps, (line.start - 0.1) * fps + DUR.micro], [0, 1], clamp), interpolate(frame, [captionEnd(PLAN, i) * fps - DUR.micro, captionEnd(PLAN, i) * fps], [1, 0], clamp)) : 0;
  return <>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 210, background: 'linear-gradient(to top, rgba(247,244,240,.97) 0%, rgba(247,244,240,.94) 55%, rgba(247,244,240,0) 100%)' }} />
    {line && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 1560, textAlign: 'center', fontSize: 40, fontWeight: 500, lineHeight: 1.25, color: C.ink, textWrap: 'balance' as CSSProperties['textWrap'], opacity: fade }}><Rich text={line.text} /></div>
    </div>}
  </>;
}

// A number (or card) moving from one place on screen to another across a cut, so the eye follows it.
export type Spot = { x: number; y: number; size: number };
export function Flight({ from, to, at = 0, frames = DUR.camera, out, children }: { from: Spot; to: Spot; at?: number; frames?: number; out?: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, [at, at + frames], [0, 1], clamp));
  const gone = out === undefined ? 0 : interpolate(frame, [out, out + DUR.micro], [0, 1], clamp);
  if (gone >= 1) return null;
  const x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p, size = from.size + (to.size - from.size) * p;
  return <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', fontSize: size, lineHeight: 1, opacity: 1 - gone, whiteSpace: 'nowrap' }}>{children}</div>;
}
