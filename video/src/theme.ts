import manifestJson from './generated/manifest.json';
import type { Run } from './schema.ts';
import type { AuctionEvent } from './auction.ts';

export const manifest = manifestJson as unknown as {
  run: Run; events: AuctionEvent[]; vars: Record<string, string>; names: Record<string, string>;
  clips: Record<string, { frames: number } | null>; voice: string[] | null; spoken: number[] | null; music: string | null;
};

// The app's tokens, from frontend/src/styles.css.
export const C = { ground: '#F7F4F0', surface: '#FFFFFF', ink: '#17161A', muted: '#5C5A60', line: '#E4DFD8', accent: '#B4235A', accentHover: '#8E1A47', tint: '#FBE8EF', saving: '#0B5A3C', mint: '#E2F2EA', butter: '#FFE9A8' };
export const SANS = "'Schibsted Grotesk', sans-serif";
export const MONO = "'IBM Plex Mono', monospace";
export const BANNED = /\b(demo|example|simulated|preview|fixture)\b/i;
