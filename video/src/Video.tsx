import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { C, manifest, SANS } from './theme.ts';
import { Captions } from './ui.tsx';
import { Architecture } from './scenes/Architecture.tsx';
import { Bidding } from './scenes/Bidding.tsx';
import { Close, Problem, Title } from './scenes/Story.tsx';
import { ClipScene } from './scenes/ClipScene.tsx';
import { FPS, SCENES, type Scene } from './timeline.ts';

const VIEWS: Record<string, (props: { scene: Scene }) => React.ReactNode> = { problem: Problem, title: Title, shop: ClipScene, shopper: ClipScene, bidding: Bidding, money: ClipScene, hood: Architecture, close: Close };

export function Video() {
  return <AbsoluteFill style={{ background: C.ground, color: C.ink, fontFamily: SANS, fontSynthesis: 'none' }}>
    {SCENES.map(scene => {
      const View = VIEWS[scene.id];
      return <Sequence key={scene.id} from={scene.start * FPS} durationInFrames={scene.duration * FPS} name={scene.id}><View scene={scene} /></Sequence>;
    })}
    <Captions scenes={SCENES} />
    {manifest.voiceover && <Audio src={staticFile('generated/voiceover.wav')} />}
    {manifest.music && <Audio src={staticFile(`generated/${manifest.music}`)} volume={manifest.voiceover ? 0.15 : 0.5} />}
  </AbsoluteFill>;
}
