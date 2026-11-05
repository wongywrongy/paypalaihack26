import { Fragment } from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { C, manifest, SANS } from './theme.ts';
import { DUR, transition } from './motion.ts';
import { Captions } from './ui.tsx';
import { Architecture } from './scenes/Architecture.tsx';
import { Bidding } from './scenes/Bidding.tsx';
import { Close, Problem, PromiseCard } from './scenes/Story.tsx';
import { ClipScene } from './scenes/ClipScene.tsx';
import { allCues, FPS, SCENES, shownFor, type Scene } from './timeline.ts';

const VIEWS: Record<string, (props: { scene: Scene }) => React.ReactNode> = { problem: Problem, promise: PromiseCard, shopper: ClipScene, bidding: Bidding, result: ClipScene, shop: ClipScene, payout: ClipScene, how: Architecture, close: Close };
const PRESENT = { fade: fade(), slide: slide({ direction: 'from-right' }) };
// -24 dB under the voice, a little louder between lines.
const DUCKED = 10 ** (-24 / 20), OPEN = 10 ** (-14 / 20);

// A scene that hands over with a transition runs DUR.scene frames longer, so the next scene still starts at its
// timeline second and captions and voice stay where timeline.ts puts them.
export function Video() {
  const cues = allCues().map((cue, i) => [cue.start * FPS, (cue.start + shownFor(cue, i, manifest.spoken ?? undefined)) * FPS]);
  const music = (frame: number) => !manifest.voiceover ? 0.5 : cues.some(([a, b]) => frame >= a - 6 && frame < b + 6) ? DUCKED : OPEN;
  return <AbsoluteFill style={{ background: C.ground, color: C.ink, fontFamily: SANS, fontSynthesis: 'none' }}>
    <TransitionSeries>
      {SCENES.map((scene, i) => {
        const View = VIEWS[scene.id], next = SCENES[i + 1];
        return <Fragment key={scene.id}>
          <TransitionSeries.Sequence durationInFrames={scene.duration * FPS + (next?.enter ? DUR.scene : 0)} name={scene.id}><AbsoluteFill style={{ background: C.ground }}><View scene={scene} /></AbsoluteFill></TransitionSeries.Sequence>
          {next?.enter && <TransitionSeries.Transition presentation={PRESENT[next.enter]} timing={transition} />}
        </Fragment>;
      })}
    </TransitionSeries>
    <Captions />
    {manifest.voiceover && <Audio src={staticFile('generated/voiceover.wav')} />}
    {manifest.music && <Audio src={staticFile(`generated/${manifest.music}`)} volume={music} />}
  </AbsoluteFill>;
}
