import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, manifest, MONO } from '../theme.ts';
import { enter, rise } from '../motion.ts';
import { ClipFrame, Ribbon } from '../ui.tsx';
import type { Scene, Shot } from '../timeline.ts';

// The ribbon only sits beside the shop's loop. Shopper scenes centre the clip.
const WITH_RIBBON = { left: 456, top: 40, width: 1400 }, CENTRED = { left: 260, top: 40, width: 1400 }, WITH_TILES = { left: 120, top: 70, width: 1240 };

function Tile({ label, value, delay, saving }: { label: string; value: string; delay: number; saving?: boolean }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ background: saving ? C.mint : C.surface, border: `1px solid ${saving ? C.mint : C.line}`, borderRadius: 16, padding: '20px 24px', ...rise(enter(frame, fps, delay)) }}>
    <div style={{ fontSize: 24, color: saving ? C.saving : C.muted }}>{label}</div>
    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 52, letterSpacing: '-.02em', color: saving ? C.saving : C.ink }}>{value}</div>
  </div>;
}

// Charged and released come from the run; the box line is the receipt's own words.
const Tiles = () => <div style={{ position: 'absolute', left: 1400, top: 70, width: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
  <Tile label="PayPal held" value={manifest.vars.held} delay={8} />
  <Tile label="Charged" value={manifest.vars.charged} delay={22} />
  <Tile label="Not charged" value={manifest.vars.released} delay={36} saving />
  <Tile label="Shops in the box" value={manifest.vars.box_shops} delay={50} />
</div>;

function ShotView({ shot, scene }: { shot: Shot; scene: Scene }) {
  const box = shot.layout === 'tiles' ? WITH_TILES : scene.ribbon ? WITH_RIBBON : CENTRED;
  const callouts = (scene.callouts || []).filter(row => row.at >= shot.at && row.at < shot.at + shot.dur).map(row => ({ ...row, at: row.at - shot.at }));
  return <>
    <ClipFrame name={shot.clip} seconds={shot.dur} fit={shot.fit} {...box} callouts={callouts} focus={shot.focus} />
    {shot.layout === 'tiles' && <Tiles />}
  </>;
}

export function ClipScene({ scene }: { scene: Scene }) {
  const { fps } = useVideoConfig();
  return <>
    {scene.ribbon && <Ribbon scene={scene} />}
    {/* The last shot runs on into the outgoing transition rather than leaving an empty frame. */}
    {scene.shots!.map((shot, i) => <Sequence key={shot.clip} from={shot.at * fps} durationInFrames={i === scene.shots!.length - 1 ? undefined : shot.dur * fps} layout="none"><ShotView shot={shot} scene={scene} /></Sequence>)}
  </>;
}
