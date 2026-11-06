import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { C, manifest, SANS } from './theme.ts';
import { clamp, DUR, ease, MOTION_FPS, smooth, useFrame } from './motion.ts';
import { Captions, RoleTag } from './ui.tsx';
import { DISSOLVE_S, PLAN, PROOFS } from './plan.ts';
import { captionEnd, FPS, railAt, type Laid, type Role } from './timeline.ts';
import { Bidding } from './scenes/Bidding.tsx';
import { ClipScene } from './scenes/ClipScene.tsx';
import { Close, Korea, Split, Steps, Where, Why } from './scenes/Story.tsx';
import { Rail } from './scenes/Rail.tsx';
import { Canvas, Grain, Proof, Sfx } from './ui/glass.tsx';

const VIEWS: Record<string, (props: { laid: Laid }) => React.ReactNode> = { korea: Korea, split: Split, steps: Steps, haneul: ClipScene, shopper: ClipScene, bidding: Bidding, result: ClipScene, payout: ClipScene, why: Why, where: Where, close: Close };
// Music at −22 dB, another 4 dB down under the voice.
const OPEN = 10 ** (-22 / 20), DUCKED = 10 ** (-26 / 20);
// Between acts the picture blurs up and the next blurs down: 12 frames each at 60 fps.
const DISSOLVE = 6;

// The camera never moves here: an act's first and last moments blur, and everything else moves inside the scene.
function Shot({ laid, enters, leaves, children }: { laid: Laid; enters: boolean; leaves: boolean; children: React.ReactNode }) {
  const frame = useFrame(), end = laid.duration * MOTION_FPS;
  const inP = enters ? interpolate(frame, [0, DISSOLVE * 2], [1, 0], clamp) : 0, outP = leaves ? interpolate(frame, [end - DISSOLVE * 2, end], [0, 1], clamp) : 0;
  const blur = 12 * Math.max(inP, outP);
  return <AbsoluteFill style={{ filter: blur > 0.01 ? `blur(${blur}px)` : undefined, opacity: 1 - 0.6 * Math.max(inP, outP) }}>{children}</AbsoluteFill>;
}

// A proof cut covers the whole frame, the rail and role tag included; only the captions stay over it.
function ProofCut({ index }: { index: number }) {
  const { proof, length } = PROOFS[index], s = useFrame() / MOTION_FPS;
  return <Proof name={proof.clip} from={proof.in} to={proof.out} crop={proof.crop} p={smooth(Math.min(s / DISSOLVE_S, (length - s) / DISSOLVE_S))} />;
}

// Whose screen: the bidding board is what the shopper sees; map and diagram scenes have no side.
const roleAt = (laid: Laid): Role | null => laid.id === 'bidding' ? 'shopper' : laid.scene.shots?.[0].role ?? null;
// The green field shows only in money moments.
const MONEY = ['result', 'payout'];

function Background() {
  const s = useFrame() / MOTION_FPS;
  const money = Math.max(0, ...PLAN.scenes.filter(row => MONEY.includes(row.id)).map(row => Math.min(ease((s - row.start) / 0.8), ease((row.start + row.duration - s) / 0.8))));
  return <Canvas money={money} />;
}

export function Video() {
  const frames = (s: number) => Math.round(s * FPS);
  const lines = PLAN.lines.map((line, i) => [line.start * FPS, captionEnd(PLAN, i) * FPS]);
  const music = (frame: number) => lines.some(([a, b]) => frame >= a - 12 && frame < b + 12) ? DUCKED : OPEN;
  return <AbsoluteFill style={{ background: C.ground, color: C.ink, fontFamily: SANS, fontSynthesis: 'none' }}>
    <Background />
    {PLAN.scenes.map((laid, i) => {
      const View = VIEWS[laid.id], prev = PLAN.scenes[i - 1], next = PLAN.scenes[i + 1];
      return <Sequence key={laid.id} name={laid.id} from={frames(laid.start)} durationInFrames={frames(laid.start + laid.duration) - frames(laid.start)}>
        <Shot laid={laid} enters={!!prev && prev.scene.act !== laid.scene.act} leaves={!!next && next.scene.act !== laid.scene.act}><View laid={laid} /></Shot>
        {laid.scene.act === 3 && <Sfx at={0} kind="whoosh" />}
      </Sequence>;
    })}
    {PLAN.scenes.map((laid, i) => {
      const role = roleAt(laid), prev = PLAN.scenes[i - 1];
      // The tag only animates in when the side changes, so a cut between two shop screens keeps it steady.
      const fresh = !prev || roleAt(prev) !== role;
      return role && <Sequence key={`role-${laid.id}`} from={frames(laid.start)} durationInFrames={frames(laid.start + laid.duration) - frames(laid.start)} layout="none"><RoleTag role={role} since={fresh ? 0 : -60} /></Sequence>;
    })}
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
