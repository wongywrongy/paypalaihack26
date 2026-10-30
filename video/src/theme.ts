import type { CSSProperties } from 'react';
import { Easing, spring } from 'remotion';
import manifestJson from './generated/manifest.json';
import type { Run } from './schema.ts';
import type { AuctionEvent } from './auction.ts';

export const manifest = manifestJson as unknown as {
  run: Run; events: AuctionEvent[]; vars: Record<string, string>; names: Record<string, string>;
  clips: Record<string, { frames: number } | null>; voiceover: boolean; music: string | null;
};

export const C = { ground: '#F7F4F0', surface: '#FFFFFF', ink: '#17161A', muted: '#5C5A60', line: '#E4DFD8', accent: '#B4235A', tint: '#FBE8EF', saving: '#0B5A3C', mint: '#E2F2EA', butter: '#FFE9A8' };
export const SANS = "'Schibsted Grotesk', sans-serif";
export const MONO = "'IBM Plex Mono', monospace";
export const SHADOW = '0 24px 60px rgba(23,22,26,.14), 0 4px 12px rgba(23,22,26,.06)';
export const BANNED = /\b(demo|example|simulated|preview|fixture)\b/i;

export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
export const enter = (frame: number, fps: number, delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.9 } });
export const rise = (progress: number): CSSProperties => ({ opacity: progress, transform: `translateY(${(1 - progress) * 16}px)` });
