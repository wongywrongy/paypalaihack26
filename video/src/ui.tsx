import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, EASE, enter, manifest, MONO, rise, SHADOW } from './theme.ts';
import { CLIPS, fill, STEPS, type Callout, type ClipName, type Scene } from './timeline.ts';

const MONEY = /((?:[AC]\$|[$£€])\d[\d,.]*\d[BM]?)/;

// Money is always in the mono font, wherever a sentence happens to contain it.
export const Rich = ({ text }: { text: string }) => <>{text.split(MONEY).map((part, i) => i % 2 ? <span key={i} style={{ fontFamily: MONO, letterSpacing: '-.025em' }}>{part}</span> : <Fragment key={i}>{part}</Fragment>)}</>;

export const Photo = ({ id, size }: { id: string; size: number }) => <Img src={staticFile(`generated/products/${id}.png`)} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 10, background: C.ground }} />;

export function Pill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: C.ink, color: C.surface, borderRadius: 999, padding: '10px 20px', fontSize: 24, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(23,22,26,.2)', ...style }}>{children}</div>;
}

function ClipPicture({ name, frames, rate }: { name: ClipName; frames: number; rate: number }) {
  const frame = useCurrentFrame();
  const lastFrame = Math.floor((frames - 2) / rate);
  const seconds = frame * rate / 30;
  return <>
    <Freeze frame={lastFrame} active={frame >= lastFrame}><OffthreadVideo src={staticFile(`generated/clips/${name}.mp4`)} muted playbackRate={rate} style={{ width: '100%', height: '100%' }} /></Freeze>
    {manifest.run.redact.filter(area => area.clip === name && seconds >= area.from && seconds <= area.to).map((area, i) => <div key={i} style={{ position: 'absolute', left: `${area.rect.x / 14.4}%`, top: `${area.rect.y / 9}%`, width: `${area.rect.width / 14.4}%`, height: `${area.rect.height / 9}%`, backdropFilter: 'blur(28px)', background: 'rgba(247,244,240,.35)', borderRadius: 8 }} />)}
  </>;
}

function Placeholder({ name, width }: { name: ClipName; width: number }) {
  return <div style={{ position: 'absolute', inset: 0, background: '#D5D2CD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.muted, textAlign: 'center', padding: 24 }}>
    <div style={{ fontFamily: MONO, fontSize: width / 28, color: C.ink }}>{name}.mp4</div>
    <div style={{ fontSize: width / 46 }}>{CLIPS[name]}</div>
    <div style={{ fontSize: width / 60 }}>Placeholder until the recording exists</div>
  </div>;
}

function CalloutMark({ callout, frameBox, scale }: { callout: Callout; frameBox: { width: number; height: number }; scale: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const shown = enter(frame, fps);
  const fade = interpolate(frame, [callout.dur * fps - 8, callout.dur * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const draw = interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
  // The target sits on the zoomed clip, so it follows the push-in. The pill does not.
  const x = frameBox.width * (0.5 + (callout.x - 0.5) * scale), y = frameBox.height * (0.5 + (callout.y - 0.5) * scale);
  const px = frameBox.width * callout.px, py = frameBox.height * callout.py;
  return <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
    <svg width={frameBox.width} height={frameBox.height} style={{ position: 'absolute', inset: 0 }}>
      <line x1={px} y1={py} x2={px + (x - px) * draw} y2={py + (y - py) * draw} stroke={C.ink} strokeWidth={2} />
      <circle cx={x} cy={y} r={7 * draw} fill={C.accent} stroke={C.surface} strokeWidth={2} />
    </svg>
    <Pill style={{ position: 'absolute', left: px, top: py, transform: `translate(-50%, calc(-50% + ${(1 - shown) * 12}px))`, opacity: shown }}>{callout.text}</Pill>
  </div>;
}

export function ClipFrame({ name, seconds, fit, left, top, width, callouts = [] }: { name: ClipName; seconds: number; fit?: boolean; left: number; top: number; width: number; callouts?: Callout[] }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const meta = manifest.clips[name];
  const shotFrames = seconds * fps, height = width * 900 / 1440;
  const scale = interpolate(frame, [0, shotFrames], [1, 1.06], { extrapolateRight: 'clamp' });
  const rate = meta ? (fit ? meta.frames / shotFrames : Math.max(1, meta.frames / shotFrames)) : 1;
  const label = rate > 1.1 ? 'Sped up' : rate < 0.9 ? 'Slowed' : null;
  return <div style={{ position: 'absolute', left, top, width, height, ...rise(enter(frame, fps)) }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', boxShadow: SHADOW, background: C.surface }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})` }}>
        {meta ? <ClipPicture name={name} frames={meta.frames} rate={rate} /> : <Placeholder name={name} width={width} />}
      </div>
    </div>
    {label && <div style={{ position: 'absolute', right: 16, top: 16, background: C.butter, color: C.ink, borderRadius: 999, padding: '4px 14px', fontSize: 20 }}>{label}</div>}
    {callouts.map(callout => {
      const from = callout.at * fps;
      return frame >= from && frame < from + callout.dur * fps && <FrameShift key={callout.text} by={from}><CalloutMark callout={callout} frameBox={{ width, height }} scale={scale} /></FrameShift>;
    })}
  </div>;
}

const FrameShift = ({ by, children }: { by: number; children: ReactNode }) => <Sequence from={by} layout="none">{children}</Sequence>;

export function Ribbon({ scene, compact }: { scene: Scene; compact?: boolean }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const ribbon = scene.ribbon!;
  const tickFrame = (step: number) => ribbon.done.includes(step) ? -60 : (ribbon.ticks.find(row => row.step === step)?.at ?? Infinity) * fps;
  return <div style={{ position: 'absolute', left: compact ? 22 : 44, top: compact ? 64 : 150, width: compact ? 48 : 350, display: 'flex', flexDirection: 'column', gap: compact ? 22 : 18 }}>
    {!compact && <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 22 }}>{scene.chapter}</div>}
    {STEPS.map((label, i) => {
      const from = tickFrame(i + 1), done = Number.isFinite(from) ? enter(frame, fps, from) : 0;
      return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 21, fontWeight: 700, color: done > 0.5 ? C.saving : C.muted, border: `2px solid ${done > 0.5 ? C.saving : C.line}`, background: done > 0.5 ? C.mint : C.surface }}>{done > 0.5 ? '✓' : i + 1}</div>
        {!compact && <div style={{ fontSize: 25, color: done > 0.5 ? C.ink : C.muted, fontWeight: done > 0.5 ? 600 : 400 }}>{label}</div>}
      </div>;
    })}
  </div>;
}

export function Captions({ scenes }: { scenes: Scene[] }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const seconds = frame / fps;
  const scene = scenes.find(row => seconds >= row.start && seconds < row.start + row.duration);
  const cue = scene?.cues.find(row => seconds >= scene.start + row.at && seconds < scene.start + row.at + row.dur);
  if (!cue) return null;
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, display: 'flex', justifyContent: 'center' }}>
    <div style={{ maxWidth: 1560, textAlign: 'center', fontSize: 37, fontWeight: 500, lineHeight: 1.26, color: C.ink, background: 'rgba(247,244,240,.92)', borderRadius: 14, padding: '6px 22px', textWrap: 'balance' as CSSProperties['textWrap'] }}><Rich text={fill(cue.text, manifest.vars)} /></div>
  </div>;
}
