// One PNG per scene at its midpoint, from the same layout the render uses.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { FPS, layout } from '../src/timeline.ts';

const manifest = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8'));
layout(manifest.vars, manifest.spoken).scenes.forEach((scene, i) => {
  const frame = Math.round((scene.start + scene.duration / 2) * FPS);
  execFileSync('node_modules/.bin/remotion', ['still', 'src/index.ts', 'Rally', `out/stills/${i + 1}-${scene.id}.png`, `--frame=${frame}`, '--log=error'], { stdio: 'inherit' });
});
