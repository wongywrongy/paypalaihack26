import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, manifest, SANS } from './theme.ts';
import { clamp, DUR } from './motion.ts';
import { Captions, RoleTag } from './ui.tsx';
import { PLAN } from './plan.ts';
import { captionEnd, FPS, railAt, type Laid, type Role } from './timeline.ts';
import { Bidding } from './scenes/Bidding.tsx';
import { ClipScene } from './scenes/ClipScene.tsx';
import { Close, Korea, Split, Steps, Where, Why } from './scenes/Story.tsx';
import { Rail } from './scenes/Rail.tsx';

const VIEWS: Record<string, (props: { laid: Laid }) => React.ReactNode> = { korea: Korea, split: Split, steps: Steps, haneul: ClipScene, shopper: ClipScene, bidding: Bidding, result: ClipScene, payout: ClipScene, why: Why, where: Where, close: Close };
// -24 dB under the voice, a little louder between lines.
const DUCKED = 10 ** (-24 / 20), OPEN = 10 ** (-14 / 20);

// The five-step explainer is the only crossfade: the scene before it runs on under the fade.
function Faded({ laid, children }: { laid: Laid; children: React.ReactNode }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const fade = laid.id === 'steps' ? interpolate(frame, [0, DUR.scene], [0, 1], clamp) : 1;
  const drift = 1;
  return <AbsoluteFill style={{ background: C.ground, opacity: fade, transform: `scale(${drift})` }}>{children}</AbsoluteFill>;
}

// Whose screen: the bidding board is what the shopper sees; map and diagram scenes have no side.
const roleAt = (laid: Laid): Role | null => laid.id === 'bidding' ? 'shopper' : laid.scene.shots?.[0].role ?? null;

export function Video() {
  const frames = (s: number) => Math.round(s * FPS);
  const lines = PLAN.lines.map((line, i) => [line.start * FPS, captionEnd(PLAN, i) * FPS]);
  const music = (frame: number) => !manifest.voice ? 0.5 : lines.some(([a, b]) => frame >= a - 6 && frame < b + 6) ? DUCKED : OPEN;
  return <AbsoluteFill style={{ background: C.ground, color: C.ink, fontFamily: SANS, fontSynthesis: 'none' }}>
    {PLAN.scenes.map((laid, i) => {
      const next = PLAN.scenes[i + 1], overlap = next?.id === 'steps' ? DUR.scene : 0, View = VIEWS[laid.id];
      return <Sequence key={laid.id} name={laid.id} from={frames(laid.start)} durationInFrames={frames(laid.start + laid.duration) - frames(laid.start) + overlap}>
        <Faded laid={laid}><View laid={laid} /></Faded>
      </Sequence>;
    })}
    {PLAN.scenes.map((laid, i) => {
      const role = roleAt(laid), prev = PLAN.scenes[i - 1];
      // The tag only animates in when the side changes, so a cut between two shop screens keeps it steady.
      const fresh = !prev || roleAt(prev) !== role;
      return role && <Sequence key={`role-${laid.id}`} from={frames(laid.start)} durationInFrames={frames(laid.start + laid.duration) - frames(laid.start)} layout="none"><RoleTag role={role} since={fresh ? 0 : -60} /></Sequence>;
    })}
    <DemoRail />
    <Captions />
    {manifest.voice?.map((file, i) => <Sequence key={file} from={frames(PLAN.lines[i].start)} layout="none"><Audio src={staticFile(`generated/voice/${file}`)} /></Sequence>)}
    {manifest.music && <Audio src={staticFile(`generated/${manifest.music}`)} volume={music} />}
  </AbsoluteFill>;
}

// During the demo the rail sits at the top with the current step filled; the demo opens on a lower-third.
function DemoRail() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const step = railAt(PLAN, frame / fps);
  const first = PLAN.scenes.find(row => row.scene.act === 3)!, from = Math.round(first.start * fps);
  const lower = Math.min(interpolate(frame, [from, from + DUR.standard], [0, 1], clamp), interpolate(frame, [from + 3 * fps, from + 3 * fps + DUR.standard], [1, 0], clamp));
  if (step === null) return null;
  return <>
    <Rail filled={step === 'before' ? null : step} before={step === 'before'} />
    {lower > 0 && <div style={{ position: 'absolute', left: 40, bottom: 190, padding: '12px 24px', borderRadius: 14, background: C.ink, color: C.surface, fontSize: 28, fontWeight: 600, opacity: lower, transform: `translateY(${(1 - lower) * 12}px)` }}>Live demo · PayPal sandbox · fictional shops and hub</div>}
  </>;
}
