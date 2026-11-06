// The one motion kit. Every scene moves with these springs and durations so the cut reads as one product.
import type { CSSProperties } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Motion is written in frames of a 30 fps clock and rendered at 60 fps: useFrame() gives the 30 fps frame, as a
// fraction between whole frames, so every spring and glide gets 60 smooth steps a second. At 60 fps a beat is
// 10 to 20 frames (micro to standard) and a camera move 36.
export const MOTION_FPS = 30;
export const useFrame = () => useCurrentFrame() * MOTION_FPS / useVideoConfig().fps;
export const DUR = { micro: 5, standard: 10, scene: 12, camera: 18 } as const;
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

// Words in one at a time, three 60 fps frames apart.
export const words = (text: string, frame: number, fps: number, from: number, stagger = 1.5) =>
  text.split(' ').map((word, i) => ({ word, p: enter(frame, fps, from + i * stagger, DUR.standard) }));
// A word's reveal: from 8 px blur and 14 px below to sharp and in place.
export const reveal = (p: number): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, filter: p < 0.999 ? `blur(${(1 - p) * 8}px)` : undefined });

// A panel arriving: tilted back in 3D, flattening as it becomes the subject.
export const tiltIn = (p: number): CSSProperties => ({ opacity: Math.min(1, p * 1.4), transform: `perspective(1600px) rotateX(${(1 - p) * 8}deg) translateY(${(1 - p) * 40}px) scale(${0.96 + 0.04 * p})`, transformOrigin: '50% 100%' });
// Depth of field for every layer that is not the subject.
export const behind = (on: number): CSSProperties => ({ opacity: 1 - 0.6 * on, filter: on > 0.001 ? `blur(${8 * on}px)` : undefined });
