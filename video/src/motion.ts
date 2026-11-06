// The one motion kit. Every scene moves with these springs and durations so the cut reads as one product.
import type { CSSProperties } from 'react';
import { interpolate, spring } from 'remotion';

export const DUR = { micro: 6, standard: 14, scene: 18, camera: 27 } as const;
const SOFT = { damping: 200 }, POP = { damping: 18, stiffness: 120 };

// Entrances. Settles in `standard` frames; `delay` is in frames.
export const enter = (frame: number, fps: number, delay = 0, frames: number = DUR.standard) =>
  spring({ frame: frame - delay, fps, config: SOFT, durationInFrames: frames });
// Emphasis only: a price landing, a rejection stamp.
export const pop = (frame: number, fps: number, delay = 0) => spring({ frame: frame - delay, fps, config: POP });
// The same soft spring as an easing curve, for glides driven by interpolate.
export const ease = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : spring({ frame: x * 60, fps: 60, config: SOFT, durationInFrames: 60 });
// Starts and ends at rest: used for drifts and speed ramps.
export const smooth = (x: number) => { const u = Math.min(1, Math.max(0, x)); return u * u * u * (u * (6 * u - 15) + 10); };

export const rise = (progress: number, by = 16): CSSProperties => ({ opacity: progress, transform: `translateY(${(1 - progress) * by}px)` });
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// ±6 px, 3 cycles over 10 frames, then still.
export const shake = (frame: number, from: number) => {
  const local = frame - from;
  return local < 0 || local > 10 ? 0 : 6 * Math.sin(local / 10 * Math.PI * 6) * (1 - local / 10);
};

// About 40 characters a second, never longer than a second.
export const typed = (text: string, frame: number, from: number, fps: number) => {
  const perFrame = Math.max(40, text.length) / fps;
  return text.slice(0, Math.max(0, Math.floor((frame - from) * perFrame)));
};

// Words in one at a time, `stagger` frames apart.
export const words = (text: string, frame: number, fps: number, from: number, stagger = 4) =>
  text.split(' ').map((word, i) => ({ word, p: enter(frame, fps, from + i * stagger, DUR.standard) }));

// --- Camera over full-bleed footage. A 1440×900 window fills 1920 wide, so 1080 of its 1200 rows show. ---
export const CLIP_W = 1440, CLIP_H = 900, BASE = 1920 / CLIP_W, MAX_ZOOM = 1.8;
export type View = { x: number; y: number; zoom: number };
// Keys in shot seconds. Each key arrives 8% wide of its zoom and closes in at a steady 1.2% a second, so a held
// frame never sits still and a key at the 1.8 cap still moves.
export type TimedKey = View & { s: number };
const MOVE = 0.9, DRIFT = 0.08, RATE = 0.012;

const fit = ({ x, y, zoom }: View): View => {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom)), hw = 960 / (BASE * z), hh = 540 / (BASE * z);
  return { x: Math.min(CLIP_W - hw, Math.max(hw, x)), y: Math.min(CLIP_H - hh, Math.max(hh, y)), zoom: z };
};

function drifted(keys: TimedKey[], i: number, s: number): View {
  const key = keys[i];
  return { x: key.x, y: key.y, zoom: key.zoom * (1 - DRIFT + Math.min(DRIFT, RATE * Math.max(0, s - key.s))) };
}

export function view(keys: TimedKey[], s: number): View {
  if (!keys.length) return fit({ x: CLIP_W / 2, y: CLIP_H / 2, zoom: 1 + Math.min(DRIFT, RATE * s) });
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].s <= s) i++;
  const here = fit(drifted(keys, i, s));
  if (i === 0 || s < keys[i].s) return here;
  // Glide from where the previous key had drifted to when this one fired.
  const was = fit(drifted(keys, i - 1, keys[i].s)), p = ease((s - keys[i].s) / MOVE);
  return fit({ x: was.x + (here.x - was.x) * p, y: was.y + (here.y - was.y) * p, zoom: was.zoom + (here.zoom - was.zoom) * p });
}

// A point on the clip, in frame pixels, under a view.
export const toFrame = (v: View, x: number, y: number) => ({ x: (x - v.x) * BASE * v.zoom + 960, y: (y - v.y) * BASE * v.zoom + 540, k: BASE * v.zoom });

// Clip seconds at shot second t. A span longer than the shot speeds up in the middle and is back to 1× at both ends.
export const clipTime = (t: number, length: number, from: number, to: number) => {
  const span = to - from;
  if (span <= length) return from + Math.min(Math.max(0, t), span);
  return from + t + (span - length) * smooth(t / length) - Math.max(0, t - length);
};
// The ramp's fastest moment, for the test that keeps it at 3× or less.
export const peakSpeed = (length: number, from: number, to: number) => Math.max(1, 1 + 1.875 * (to - from - length) / length);
