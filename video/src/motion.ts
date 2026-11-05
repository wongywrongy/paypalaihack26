// The one motion kit. Every scene moves with these springs and durations so the cut reads as one product.
import type { CSSProperties } from 'react';
import { interpolate, spring } from 'remotion';
import { springTiming } from '@remotion/transitions';
import type { Focus } from './timeline.ts';

const CLIP_W = 1440, CLIP_H = 900, MAX_ZOOM = 1.6;

export const DUR = { micro: 8, standard: 14, scene: 18, camera: 20 } as const;
const SOFT = { damping: 200 }, POP = { damping: 18, stiffness: 120 };

// Entrances. Settles in `standard` frames; `delay` is in frames.
export const enter = (frame: number, fps: number, delay = 0, frames: number = DUR.standard) =>
  spring({ frame: frame - delay, fps, config: SOFT, durationInFrames: frames });
// Emphasis only: a price landing, a rejection stamp.
export const pop = (frame: number, fps: number, delay = 0) => spring({ frame: frame - delay, fps, config: POP });
// The same soft spring as an easing curve, for glides driven by interpolate.
export const ease = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : spring({ frame: x * 60, fps: 60, config: SOFT, durationInFrames: 60 });

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

// Holds 1 between `from` and `to` (frames), easing in and out over `frames`.
export const hold = (frame: number, from: number, to: number, frames: number = DUR.camera) =>
  Math.min(ease(interpolate(frame, [from, from + frames], [0, 1], clamp)), ease(interpolate(frame, [to - frames, to], [1, 0], clamp)));

export const transition = springTiming({ config: SOFT, durationInFrames: DUR.scene });

// How far the camera has pushed toward a focus rect: a scale and an offset, in frame pixels.
export function camera(focus: Focus | undefined, frame: number, fps: number, width: number) {
  if (!focus) return { scale: 1, x: 0, y: 0 };
  const k = width / CLIP_W, height = CLIP_H * k, r = focus.rect;
  const full = Math.max(1, Math.min(MAX_ZOOM, 0.62 * CLIP_W / r.width, 0.62 * CLIP_H / r.height));
  const p = hold(frame, focus.at * fps, (focus.at + focus.dur) * fps);
  const cx = (r.x + r.width / 2) * k, cy = (r.y + r.height / 2) * k;
  // Never pull an edge of the clip inside the frame.
  const tx = Math.min(0, Math.max(width - full * width, width / 2 - full * cx));
  const ty = Math.min(0, Math.max(height - full * height, height / 2 - full * cy));
  return { scale: 1 + (full - 1) * p, x: tx * p, y: ty * p };
}

