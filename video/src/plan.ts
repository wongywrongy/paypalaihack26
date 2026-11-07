// The timeline laid out with this run's facts and measured voice, plus where each shot and proof lands.
import { manifest } from './theme.ts';
import { layout, startAt, type Laid } from './timeline.ts';
export { wordAt } from './timeline.ts';

export const PLAN = layout(manifest.vars, manifest.spoken);
export const scene = (id: string) => PLAN.scenes.find(row => row.id === id)!;

// A shot's start and length in scene seconds. The first starts with its scene; every shot stays to the scene's end.
export function shotSpan(laid: Laid, i: number) {
  const from = i === 0 ? 0 : startAt(laid, laid.scene.shots![i]);
  return { from, length: laid.duration - from };
}

// A proof window's start in scene seconds; it plays its clip span at 1×, then holds its last frame to the scene's end.
export const proofSpan = (laid: Laid, i: number) => {
  const proof = laid.scene.proofs![i], from = startAt(laid, proof);
  return { from, length: laid.duration - from };
};

// Every proof window in film seconds.
export const PROOFS = PLAN.scenes.flatMap(laid => (laid.scene.proofs ?? []).map((proof, i) => {
  const { from, length } = proofSpan(laid, i);
  return { proof, from: laid.start + from, length };
}));
