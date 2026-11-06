// The timeline laid out with this run's facts and measured voice, plus where each shot and proof lands.
import { manifest } from './theme.ts';
import { layout, startAt, type Laid } from './timeline.ts';
export { wordAt } from './timeline.ts';

export const PLAN = layout(manifest.vars, manifest.spoken);
export const scene = (id: string) => PLAN.scenes.find(row => row.id === id)!;

// A shot's start and length in scene seconds. The first starts with its scene; the last runs to the scene's end.
export function shotSpan(laid: Laid, i: number) {
  const shots = laid.scene.shots!, at = (n: number) => startAt(laid, shots[n]);
  const from = i === 0 ? 0 : at(i), to = i + 1 < shots.length ? at(i + 1) : laid.duration;
  return { from, length: to - from };
}

// A proof cut's start in scene seconds; it lasts as long as its clip span, at 1×.
export const proofSpan = (laid: Laid, i: number) => {
  const proof = laid.scene.proofs![i];
  return { from: startAt(laid, proof), length: proof.out - proof.in };
};

// Every proof cut in film seconds, and whether one is on screen at second t. Proofs cut in and out hard.
export const PROOFS = PLAN.scenes.flatMap(laid => (laid.scene.proofs ?? []).map((proof, i) => {
  const { from, length } = proofSpan(laid, i);
  return { proof, from: laid.start + from, length };
}));
export const proofOn = (t: number) => PROOFS.some(({ from, length }) => t >= from && t < from + length) ? 1 : 0;
