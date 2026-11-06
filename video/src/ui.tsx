import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Img, interpolate, staticFile } from 'remotion';
import { C, LIGHT, manifest, MONO, SANS } from './theme.ts';
import { clamp, DUR, ease, enter, MOTION_FPS, useFrame } from './motion.ts';
import { captionEnd, ROLES, type ClipName, type Role } from './timeline.ts';
import { PLAN } from './plan.ts';

const MONEY = /((?:[AC]\$|[$£€])\d[\d,.]*\d[BM]?(?: billion)?)/;

// Money is always in the mono font, wherever a sentence happens to contain it.
export const Rich = ({ text }: { text: string }) => <>{text.split(MONEY).map((part, i) => i % 2 ? <span key={i} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{part}</span> : <Fragment key={i}>{part}</Fragment>)}</>;

export const Photo = ({ id, size }: { id: string; size: number }) => <Img src={staticFile(`generated/products/${id}.png`)} style={{ width: size, height: size, flex: 'none', objectFit: 'cover', borderRadius: size / 6, background: C.ground }} />;

export const Lock = ({ size, color }: { size: number; color: string }) => <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}><rect x="5" y="11" width="14" height="10" rx="2.5" fill="none" stroke={color} strokeWidth="2.2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke={color} strokeWidth="2.2" /></svg>;

// A private value is covered from the first frame it could show: the viewer sees that it is set, never what it is.
export function Redactions({ name, seconds }: { name: ClipName; seconds: number }) {
  return <>{manifest.run.redact.filter(area => area.clip === name && seconds >= area.from && seconds <= area.to).map((area, i) => {
    const r = area.rect, box: CSSProperties = { position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height };
    if (area.style !== 'private') return <div key={i} style={{ ...box, backdropFilter: 'blur(14px)', background: 'rgba(247,244,240,.4)', borderRadius: 6 }} />;
    const h = Math.min(26, r.height - 8);
    return <div key={i} style={{ ...box, background: LIGHT.surface, display: 'grid', placeItems: 'center' }}>
      <div style={{ height: h, display: 'flex', alignItems: 'center', gap: h * 0.2, padding: `0 ${h * 0.45}px`, borderRadius: h, border: `1.5px solid ${LIGHT.accent}`, color: LIGHT.accentHover, fontFamily: SANS, fontSize: h * 0.56, fontWeight: 600 }}><Lock size={h * 0.62} color={LIGHT.accent} />Private</div>
    </div>;
  })}</>;
}

// "Whose screen is this": top left, cross-fading when the side changes.
export function RoleTag({ role, since }: { role: Role | null; since: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  if (!role) return null;
  const p = enter(frame, fps, since, DUR.standard);
  return <div style={{ position: 'absolute', left: 40, top: 36, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px 12px 18px', borderRadius: 999, background: 'rgba(255,255,255,.07)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12)', backdropFilter: 'blur(20px)', fontSize: 26, fontWeight: 600, color: C.ink, opacity: p, transform: `translateY(${(1 - p) * -10}px)` }}>
    <div style={{ width: 14, height: 14, borderRadius: 7, background: role === 'shop' ? C.accent : '#fff' }} />{ROLES[role]}
  </div>;
}

// Captions: short chunks of up to six words, bottom centre, no box; the word being spoken is a little brighter.
// Word times are spread over the line's spoken length by word length, since the voice gives one length per line.
const CHUNK = 6;
export function chunks(text: string, start: number, end: number) {
  const list = text.split(' '), weight = list.map(word => word.length + 2), total = weight.reduce((a, b) => a + b, 0);
  let t = start;
  const timed = list.map((word, i) => { const from = t; t += (end - start) * weight[i] / total; return { word, from, to: t }; });
  const out: { words: typeof timed; from: number; to: number }[] = [];
  for (let i = 0; i < timed.length; i += CHUNK) {
    const part = timed.slice(i, i + CHUNK);
    // Never strand one word: fold a lone last word into the chunk before it.
    if (part.length === 1 && out.length) { out[out.length - 1].words.push(part[0]); out[out.length - 1].to = part[0].to; continue; }
    out.push({ words: part, from: part[0].from, to: part[part.length - 1].to });
  }
  return out;
}
export function Captions() {
  const frame = useFrame(), fps = MOTION_FPS, s = frame / fps;
  const i = PLAN.lines.findIndex((line, n) => s >= line.start - 0.1 && s < captionEnd(PLAN, n));
  const line = PLAN.lines[i];
  if (!line) return null;
  const parts = chunks(line.text, line.start, line.end);
  const part = parts.find((row, n) => s < (parts[n + 1]?.from ?? captionEnd(PLAN, i))) ?? parts[parts.length - 1];
  const fade = Math.min(interpolate(s, [part.from - 0.1, part.from + 0.05], [0, 1], clamp), interpolate(s, [captionEnd(PLAN, i) - 0.15, captionEnd(PLAN, i)], [1, 0], clamp));
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 64, display: 'flex', justifyContent: 'center', opacity: fade }}>
    <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.005em', textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>
      {part.words.map((w, n) => <span key={n} style={{ color: s >= w.from && s < w.to + 0.05 ? '#fff' : 'rgba(255,255,255,.78)' }}><Rich text={w.word} />{n < part.words.length - 1 ? ' ' : ''}</span>)}
    </div>
  </div>;
}

// A number (or card) moving from one place on screen to another across a cut, so the eye follows it.
export type Spot = { x: number; y: number; size: number };
export function Flight({ from, to, at = 0, frames = DUR.camera, out, children }: { from: Spot; to: Spot; at?: number; frames?: number; out?: number; children: ReactNode }) {
  const frame = useFrame();
  const p = ease(interpolate(frame, [at, at + frames], [0, 1], clamp));
  const gone = out === undefined ? 0 : interpolate(frame, [out, out + DUR.micro], [0, 1], clamp);
  if (gone >= 1) return null;
  const x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p, size = from.size + (to.size - from.size) * p;
  return <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', fontSize: size, lineHeight: 1, opacity: 1 - gone, whiteSpace: 'nowrap' }}>{children}</div>;
}
