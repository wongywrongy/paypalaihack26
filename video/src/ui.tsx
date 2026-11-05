import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { C, manifest, MONO } from './theme.ts';
import { camera, clamp, DUR, enter, pop, rise } from './motion.ts';
import { CLIPS, fill, shownFor, STEPS, allCues, type Callout, type ClipName, type Focus, type Scene } from './timeline.ts';
import type { Knot } from './auction.ts';

const MONEY = /((?:[AC]\$|[$£€])\d[\d,.]*\d[BM]?)/;
// Clip pixels: rects and redactions are measured on a 1440×900 window, whatever the recording's pixel ratio.
const CLIP_W = 1440, CLIP_H = 900;

// Money is always in the mono font, wherever a sentence happens to contain it.
export const Rich = ({ text }: { text: string }) => <>{text.split(MONEY).map((part, i) => i % 2 ? <span key={i} style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{part}</span> : <Fragment key={i}>{part}</Fragment>)}</>;

export const Photo = ({ id, size }: { id: string; size: number }) => <Img src={staticFile(`generated/products/${id}.png`)} style={{ width: size, height: size, flex: 'none', objectFit: 'cover', borderRadius: 10, background: C.ground }} />;

export function Pill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: C.ink, color: C.surface, borderRadius: 999, padding: '10px 20px', fontSize: 24, fontWeight: 600, whiteSpace: 'nowrap', ...style }}>{children}</div>;
}

// A drawn tick, so it matches the stroke of the rest of the frame.
export function Tick({ size = 22, color = C.saving, progress = 1 }: { size?: number; color?: string; progress?: number }) {
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, 'M 4 12.5 L 9.5 18 L 20 6');
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}><path d="M 4 12.5 L 9.5 18 L 20 6" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} /></svg>;
}

type Picture = { name: ClipName; frames: number; rate: number; warp?: Knot[] };

function Redactions({ name, seconds }: { name: ClipName; seconds: number }) {
  return <>{manifest.run.redact.filter(area => area.clip === name && seconds >= area.from && seconds <= area.to).map((area, i) => <div key={i} style={{ position: 'absolute', left: `${area.rect.x / CLIP_W * 100}%`, top: `${area.rect.y / CLIP_H * 100}%`, width: `${area.rect.width / CLIP_W * 100}%`, height: `${area.rect.height / CLIP_H * 100}%`, backdropFilter: 'blur(28px)', background: 'rgba(247,244,240,.35)', borderRadius: 8 }} />)}</>;
}

const clipSrc = (name: ClipName) => staticFile(`generated/clips/${name}.mp4`);
const fill100: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

function ClipPicture({ name, frames, rate, warp }: Picture) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  if (warp) {
    // One segment per pair of knots: the footage keeps pace with the board built from the same events.
    const last = warp[warp.length - 1];
    const segments = [...warp.slice(1).map((knot, i) => ({ a: warp[i], b: knot })), { a: last, b: { t: last.t + 3600, s: last.s + 3600 } }];
    const clipSeconds = (s: number) => {
      const seg = segments.find(row => s < row.b.s) ?? segments[segments.length - 1];
      return seg.a.t + (seg.b.t - seg.a.t) * Math.min(1, (s - seg.a.s) / Math.max(1e-6, seg.b.s - seg.a.s));
    };
    const at = clipSeconds(frame / fps);
    const end = (frames - 2) / fps;
    return <>
      {at >= end ? <Freeze frame={0}><OffthreadVideo src={clipSrc(name)} muted trimBefore={frames - 2} style={fill100} /></Freeze> : segments.map(({ a, b }, i) => {
        const from = Math.round(a.s * fps), length = Math.round(b.s * fps) - from;
        if (length <= 0 || frame < from || frame >= from + length) return null;
        return <Sequence key={i} from={from} durationInFrames={length} layout="none"><OffthreadVideo src={clipSrc(name)} muted trimBefore={Math.round(a.t * fps)} playbackRate={Math.max(0.01, (b.t - a.t) / Math.max(1e-6, b.s - a.s))} style={fill100} /></Sequence>;
      })}
      <Redactions name={name} seconds={at} />
    </>;
  }
  const lastFrame = Math.floor((frames - 2) / rate);
  return <>
    <Freeze frame={lastFrame} active={frame >= lastFrame}><OffthreadVideo src={clipSrc(name)} muted playbackRate={rate} style={fill100} /></Freeze>
    <Redactions name={name} seconds={frame * rate / fps} />
  </>;
}

function Placeholder({ name, width }: { name: ClipName; width: number }) {
  return <div style={{ position: 'absolute', inset: 0, background: '#D5D2CD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.muted, textAlign: 'center', padding: 24 }}>
    <div style={{ fontFamily: MONO, fontSize: width / 28, color: C.ink }}>{name}.mp4</div>
    <div style={{ fontSize: width / 46 }}>{CLIPS[name]}</div>
    <div style={{ fontSize: width / 60 }}>Placeholder until the recording exists</div>
  </div>;
}

function CalloutMark({ callout, box, cam }: { callout: Callout; box: { width: number; height: number }; cam: (frame: number) => { scale: number; x: number; y: number } }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const fade = interpolate(frame, [callout.dur * fps - DUR.micro, callout.dur * fps], [1, 0], clamp);
  // The line draws first, then the pill pops at its end.
  const draw = interpolate(frame, [0, 10], [0, 1], clamp);
  const shown = pop(frame, fps, 10);
  // The target sits on the moving clip, so it follows the camera. The pill does not.
  const c = cam(frame);
  const x = box.width * callout.x * c.scale + c.x, y = box.height * callout.y * c.scale + c.y;
  const px = box.width * callout.px, py = box.height * callout.py;
  const d = `M ${px} ${py} L ${x} ${y}`;
  const line = evolvePath(draw, d);
  return <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
    <svg width={box.width} height={box.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d={d} stroke={C.ink} strokeWidth={2} fill="none" strokeDasharray={line.strokeDasharray} strokeDashoffset={line.strokeDashoffset} />
      <circle cx={x} cy={y} r={7 * draw} fill={C.accent} stroke={C.surface} strokeWidth={2} />
    </svg>
    <Pill style={{ position: 'absolute', left: px, top: py, transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * shown})`, opacity: Math.min(1, shown * 1.4) }}><Rich text={fill(callout.text, manifest.vars)} /></Pill>
  </div>;
}

export function ClipFrame({ name, seconds, fit, left, top, width, callouts = [], focus, warp, tag }: { name: ClipName; seconds: number; fit?: boolean; left: number; top: number; width: number; callouts?: Callout[]; focus?: Focus; warp?: Knot[]; tag?: string | null }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const meta = manifest.clips[name];
  const shotFrames = seconds * fps, height = width * CLIP_H / CLIP_W;
  const rate = meta ? (fit ? meta.frames / shotFrames : Math.max(1, meta.frames / shotFrames)) : 1;
  const label = tag !== undefined ? tag : rate > 1.1 ? 'Sped up' : rate < 0.9 ? 'Slowed' : null;
  const cam = (at: number) => camera(focus, at, fps, width);
  const c = cam(frame);
  return <div style={{ position: 'absolute', left, top, width, height }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', background: C.surface, border: `1px solid ${C.line}` }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${c.x}px, ${c.y}px) scale(${c.scale})` }}>
        {meta ? <ClipPicture name={name} frames={meta.frames} rate={rate} warp={warp} /> : <Placeholder name={name} width={width} />}
      </div>
    </div>
    {label && <div style={{ position: 'absolute', right: 16, top: 16, background: C.butter, color: C.ink, borderRadius: 999, padding: '4px 14px', fontSize: 20, fontWeight: 600 }}>{label}</div>}
    {callouts.map(callout => {
      const from = Math.round(callout.at * fps);
      return frame >= from && frame < from + callout.dur * fps && <Sequence key={callout.text} from={from} layout="none"><CalloutMark callout={callout} box={{ width, height }} cam={local => cam(local + from)} /></Sequence>;
    })}
  </div>;
}

export function Ribbon({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const ribbon = scene.ribbon!;
  const tickFrame = (step: number) => ribbon.done.includes(step) ? -60 : (ribbon.ticks.find(row => row.step === step)?.at ?? Infinity) * fps;
  const doneCount = STEPS.filter((_, i) => tickFrame(i + 1) <= frame).length;
  return <div style={{ position: 'absolute', left: 44, top: 140, width: 350, display: 'flex', flexDirection: 'column', gap: 18, ...rise(enter(frame, fps)) }}>
    <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1 }}>{scene.chapter}</div>
    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 24, color: C.muted, marginBottom: 14 }}>{doneCount} of 5</div>
    {STEPS.map((label, i) => {
      const from = tickFrame(i + 1), done = Number.isFinite(from) ? pop(frame, fps, from) : 0, on = frame >= from;
      return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 21, fontWeight: 700, color: on ? C.saving : C.muted, border: `2px solid ${on ? C.saving : C.line}`, background: on ? C.mint : C.surface, transform: `scale(${on ? 0.9 + 0.1 * done : 1})` }}>{on ? <Tick size={24} progress={Math.min(1, done)} /> : i + 1}</div>
        <div style={{ fontSize: 25, color: on ? C.ink : C.muted, fontWeight: on ? 600 : 400 }}>{label}</div>
      </div>;
    })}
  </div>;
}

export function Captions() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const seconds = frame / fps;
  const cues = allCues();
  const index = cues.findIndex((cue, i) => seconds >= cue.start && seconds < cue.start + shownFor(cue, i, manifest.spoken ?? undefined));
  if (index < 0) return null;
  const cue = cues[index];
  const shown = enter(frame, fps, Math.round(cue.start * fps), DUR.micro);
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, display: 'flex', justifyContent: 'center' }}>
    <div style={{ maxWidth: 1480, textAlign: 'center', fontSize: 36, fontWeight: 500, lineHeight: 1.28, color: C.ink, background: 'rgba(247,244,240,.94)', borderRadius: 14, padding: '6px 22px', textWrap: 'balance' as CSSProperties['textWrap'], opacity: shown }}><Rich text={fill(cue.text, manifest.vars)} /></div>
  </div>;
}
