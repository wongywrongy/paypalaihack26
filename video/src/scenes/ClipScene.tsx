import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, enter, manifest, MONO, rise } from '../theme.ts';
import { ClipFrame, Ribbon, Rich } from '../ui.tsx';
import { fill, type Scene, type Shot } from '../timeline.ts';

const FULL = { left: 456, top: 40, width: 1400 }, WITH_TILES = { left: 456, top: 110, width: 1050 };

function Tile({ label, value, delay, saving }: { label: string; value: string; delay: number; saving?: boolean }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ background: saving ? C.mint : C.surface, border: `1px solid ${saving ? C.mint : C.line}`, borderRadius: 20, padding: '20px 24px', ...rise(enter(frame, fps, delay)) }}>
    <div style={{ fontSize: 24, color: saving ? C.saving : C.muted }}>{label}</div>
    <div style={{ fontFamily: MONO, fontSize: 52, letterSpacing: '-.025em', color: saving ? C.saving : C.ink }}>{value}</div>
  </div>;
}

const Tiles = () => <div style={{ position: 'absolute', left: 1530, top: 110, width: 330, display: 'flex', flexDirection: 'column', gap: 20 }}>
  <Tile label="Held" value={manifest.vars.held} delay={6} />
  <Tile label="Charged" value={manifest.vars.charged} delay={16} />
  <Tile label="Released" value={manifest.vars.released} delay={26} saving />
</div>;

function ShotView({ shot, scene }: { shot: Shot; scene: Scene }) {
  const box = shot.layout === 'tiles' ? WITH_TILES : FULL;
  const callouts = (scene.callouts || []).filter(row => row.at >= shot.at && row.at < shot.at + shot.dur).map(row => ({ ...row, at: row.at - shot.at }));
  return <>
    <ClipFrame name={shot.clip} seconds={shot.dur} fit={shot.fit} {...box} callouts={callouts} />
    {shot.layout === 'tiles' && <Tiles />}
  </>;
}

function Band({ text }: { text: string }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 736, background: C.accent, color: C.surface, fontSize: 42, fontWeight: 700, letterSpacing: '-.015em', textAlign: 'center', padding: '30px 40px', ...rise(enter(frame, fps)) }}><Rich text={fill(text, manifest.vars)} /></div>;
}

export function ClipScene({ scene }: { scene: Scene }) {
  const { fps } = useVideoConfig();
  return <>
    <Ribbon scene={scene} />
    {scene.shots!.map(shot => <Sequence key={shot.clip} from={shot.at * fps} durationInFrames={shot.dur * fps} layout="none"><ShotView shot={shot} scene={scene} /></Sequence>)}
    {scene.band && <Sequence from={scene.band.at * fps} durationInFrames={scene.band.dur * fps} layout="none"><Band text={scene.band.text} /></Sequence>}
  </>;
}
