// One PNG per scene, at its midpoint.
import { execFileSync } from 'node:child_process';
import { FPS, SCENES } from '../src/timeline.ts';

SCENES.forEach((scene, i) => {
  const frame = Math.round((scene.start + scene.duration / 2) * FPS);
  execFileSync('node_modules/.bin/remotion', ['still', 'src/index.ts', 'Rally', `out/stills/${i + 1}-${scene.id}.png`, `--frame=${frame}`, '--log=error'], { stdio: 'inherit' });
});
