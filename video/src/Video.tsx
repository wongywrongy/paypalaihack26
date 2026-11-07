import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { C, manifest, SANS } from './theme.ts';
import { clamp, DUR, ease, enter, MOTION_FPS, useFrame } from './motion.ts';
import { Captions, RoleTag } from './ui.tsx';
import { PLAN, PROOFS, shotSpan } from './plan.ts';
import { BIG, captionEnd, FPS, railAt, type Laid, type Rect, type Role } from './timeline.ts';
import { Bidding } from './scenes/Bidding.tsx';
import { ClipScene } from './scenes/ClipScene.tsx';
import { Finale, Split } from './scenes/Story.tsx';
import { Cold } from './scenes/Cold.tsx';
import { Rail } from './scenes/Rail.tsx';
import { Canvas, Grain, Proof, Sfx } from './ui/glass.tsx';

const VIEWS: Record<string, (props: { laid: Laid }) => React.ReactNode> = { cold: Cold, split: Split, haneul: ClipScene, shopper: ClipScene, bidding: Bidding, result: ClipScene, payout: ClipScene, close: Finale };
// Music at −22 dB, another 4 dB down under the voice.
const OPEN = 10 ** (-22 / 20), DUCKED = 10 ** (-26 / 20);
// A proof window rises in beside or over the drawn panels it proves, grows to near full frame while it plays, and
// settles back into its box. If more than a second of its scene is left it then steps away, back to the drawn panels;
// otherwise it holds its last frame to the cut.
const GROW = 15, GLIDE = 18;
const mix = (a: Rect, b: Rect, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, width: a.width + (b.width - a.width) * k, height: a.height + (b.height - a.height) * k });
function ProofCut({ index }: { index: number }) {
  const { proof, length } = PROOFS[index], frame = useFrame(), shrink = GROW + GLIDE + proof.big * MOTION_FPS, settled = shrink + GLIDE;
  const k = ease(interpolate(frame, [GROW, GROW + GLIDE], [0, 1], clamp)) - ease(interpolate(frame, [shrink, settled], [0, 1], clamp));
  const out = length * MOTION_FPS - settled > MOTION_FPS ? enter(frame, MOTION_FPS, settled + 6, DUR.standard) : 0;
  return <Proof name={proof.clip} from={proof.in} to={proof.out} crop={proof.crop} box={mix(proof.box, BIG, k)} p={enter(frame, MOTION_FPS, 0, DUR.standard) - out} />;
}

// Whose screen, from each shot's start: the bidding board is what the shopper sees; map and diagram scenes have no side.
// A side that carries on across a cut keeps one steady tag.
const ROLE_SPANS = PLAN.scenes.flatMap(laid => laid.id === 'bidding' ? [{ from: laid.start, role: 'shopper' as Role | null }]
  : laid.scene.shots ? laid.scene.shots.map((shot, i) => ({ from: laid.start + shotSpan(laid, i).from, role: shot.role as Role | null }))
  : [{ from: laid.start, role: null }]).filter((span, i, all) => i === 0 || span.role !== all[i - 1].role)
  .map((span, i, all) => ({ ...span, to: all[i + 1]?.from ?? PLAN.total }));
// The green field shows only in money moments.
const MONEY = ['result', 'payout'];

function Background() {
  const s = useFrame() / MOTION_FPS;
  const money = Math.max(0, ...PLAN.scenes.filter(row => MONEY.includes(row.id)).map(row => Math.min(ease((s - row.start) / 0.8), ease((row.start + row.duration - s) / 0.8))));
  return <Canvas money={money} />;
}

// Every scene pushes in slowly, 4% over its length, so a held picture is never still.
function Drift({ seconds, children }: { seconds: number; children: React.ReactNode }) {
  const s = useFrame() / MOTION_FPS;
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.04 * s / seconds})` }}>{children}</div>;
}

export function Video() {
  const frames = (s: number) => Math.round(s * FPS);
  const lines = PLAN.lines.map((line, i) => [line.start * FPS, captionEnd(PLAN, i) * FPS]);
  const music = (frame: number) => lines.some(([a, b]) => frame >= a - 12 && frame < b + 12) ? DUCKED : OPEN;
  return <AbsoluteFill style={{ background: C.ground, color: C.ink, fontFamily: SANS, fontSynthesis: 'none' }}>
    <Background />
    {PLAN.scenes.map(laid => {
      const View = VIEWS[laid.id];
      return <Sequence key={laid.id} name={laid.id} from={frames(laid.start)} durationInFrames={frames(laid.start + laid.duration) - frames(laid.start)}>
        <Drift seconds={laid.duration}><View laid={laid} /></Drift>
        {laid.scene.act === 3 && <Sfx at={0} kind="whoosh" />}
      </Sequence>;
    })}
    {ROLE_SPANS.map(({ from, to, role }) => role && <Sequence key={`role-${from}`} from={frames(from)} durationInFrames={frames(to) - frames(from)} layout="none"><RoleTag role={role} since={0} /></Sequence>)}
    <DemoRail />
    {PROOFS.map(({ from, length }, i) => <Sequence key={`proof-${i}`} name={`proof ${PROOFS[i].proof.clip}`} from={frames(from)} durationInFrames={frames(from + length) - frames(from)} layout="none"><ProofCut index={i} /></Sequence>)}
    <Captions />
    <Grain />
    {manifest.voice?.map((file, i) => <Sequence key={file} from={frames(PLAN.lines[i].start)} layout="none"><Audio src={staticFile(`generated/voice/${file}`)} /></Sequence>)}
    {manifest.music && <Audio src={staticFile(`generated/${manifest.music}`)} volume={music} />}
  </AbsoluteFill>;
}

// During the demo the rail sits at the top with the current step filled; the demo opens on a lower-third.
function DemoRail() {
  const frame = useFrame(), s = frame / MOTION_FPS;
  const step = railAt(PLAN, s);
  const first = PLAN.scenes.find(row => row.scene.act === 3)!, from = first.start * MOTION_FPS;
  const lower = Math.min(interpolate(frame, [from, from + DUR.standard], [0, 1], clamp), interpolate(frame, [from + 3 * MOTION_FPS, from + 3 * MOTION_FPS + DUR.standard], [1, 0], clamp));
  if (step === null) return null;
  return <>
    <Rail filled={step === 'before' ? null : step} before={step === 'before'} compact />
    {lower > 0 && <div style={{ position: 'absolute', left: 40, bottom: 150, padding: '12px 22px', borderRadius: 14, background: 'rgba(255,255,255,.07)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)', backdropFilter: 'blur(20px)', color: C.ink, fontSize: 26, fontWeight: 600, opacity: lower, transform: `translateY(${(1 - lower) * 12}px)` }}>Live demo · PayPal sandbox · fictional shops and hub</div>}
  </>;
}
