// The timeline laid out with this run's facts and measured voice, plus where each shot and camera key lands.
import { manifest } from './theme.ts';
import { clipTime, toFrame, view, type TimedKey } from './motion.ts';
import { cueAt, layout, type Laid, type Shot } from './timeline.ts';

export const PLAN = layout(manifest.vars, manifest.spoken);
export const scene = (id: string) => PLAN.scenes.find(row => row.id === id)!;

// A shot's start and length in scene seconds. The last shot runs to the end of its scene.
export function shotSpan(laid: Laid, i: number) {
  const shots = laid.scene.shots!, at = (n: number) => cueAt(laid, shots[n].cue) + (shots[n].delay ?? 0);
  const from = i === 0 ? 0 : at(i), to = i + 1 < shots.length ? at(i + 1) : laid.duration;
  return { from, length: to - from };
}

// When a key or spot fires, in shot seconds: at a line's start (plus delay), or at a clip second, found by searching
// the shot's monotone clip clock.
type Timed = { cue?: number; clip?: number; delay?: number };
function fires(laid: Laid, shot: Shot, from: number, length: number, key: Timed) {
  if (key.clip === undefined) return Math.max(0, cueAt(laid, key.cue ?? shot.cue) - from + (key.delay ?? 0));
  let lo = 0, hi = length;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (clipTime(mid, length, shot.in, shot.out) < key.clip) lo = mid; else hi = mid; }
  return hi;
}

export const shotKeys = (laid: Laid, shot: Shot, from: number, length: number): TimedKey[] =>
  shot.keys.map(key => ({ x: key.x, y: key.y, zoom: key.zoom, s: fires(laid, shot, from, length, key) })).sort((a, b) => a.s - b.s);

export const shotSpots = (laid: Laid, shot: Shot, from: number, length: number) =>
  (shot.spots ?? []).map(spot => ({ rect: spot.rect, s: fires(laid, shot, from, length, spot) })).sort((a, b) => a.s - b.s);

// Where a point of a shot's clip sits on screen at scene second s, for numbers that fly across a cut.
export function spotAt(id: string, shotIndex: number, s: number, x: number, y: number, height: number) {
  const laid = scene(id), shot = laid.scene.shots![shotIndex], { from, length } = shotSpan(laid, shotIndex);
  const p = toFrame(view(shotKeys(laid, shot, from, length), s - from), x, y);
  return { x: p.x, y: p.y, size: height * p.k };
}
