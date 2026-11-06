// The timeline laid out with this run's facts and measured voice, plus where each shot and proof lands.
import { manifest } from './theme.ts';
import { cueAt, layout, type Laid } from './timeline.ts';

export const PLAN = layout(manifest.vars, manifest.spoken);
export const scene = (id: string) => PLAN.scenes.find(row => row.id === id)!;

// A shot's start and length in scene seconds. The first starts with its scene; the last runs to the scene's end.
export function shotSpan(laid: Laid, i: number) {
  const shots = laid.scene.shots!, at = (n: number) => cueAt(laid, shots[n].cue) + (shots[n].delay ?? 0);
  const from = i === 0 ? 0 : at(i), to = i + 1 < shots.length ? at(i + 1) : laid.duration;
  return { from, length: to - from };
}

// A proof shot's start in scene seconds; it lasts as long as its clip span, at 1×.
export const proofSpan = (laid: Laid, i: number) => {
  const proof = laid.scene.proofs![i];
  return { from: cueAt(laid, proof.cue) + (proof.delay ?? 0), length: proof.out - proof.in };
};
