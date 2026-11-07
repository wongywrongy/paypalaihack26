import manifestJson from './generated/manifest.json';
import type { Run } from './schema.ts';
import type { AuctionEvent } from './auction.ts';

export const manifest = manifestJson as unknown as {
  run: Run; events: AuctionEvent[]; vars: Record<string, string>; names: Record<string, string>;
  clips: Record<string, { frames: number } | null>; voice: string[] | null; spoken: number[] | null; music: string | null;
};

// The app's tokens, from frontend/src/styles.css: used for the real recordings and anything drawn over them.
export const LIGHT = { ground: '#F7F4F0', surface: '#FFFFFF', ink: '#17161A', muted: '#5C5A60', line: '#E4DFD8', accent: '#B4235A', accentHover: '#8E1A47', tint: '#FBE8EF', saving: '#0B5A3C', mint: '#E2F2EA', butter: '#FFE9A8' };
// The film's tokens: the same roles on a near-black canvas (STYLE.md). surface is glass, so never use it to cover anything.
export const C = { ground: '#0B0B0F', surface: 'rgba(255,255,255,.06)', ink: 'rgba(255,255,255,.94)', muted: 'rgba(255,255,255,.62)', line: 'rgba(255,255,255,.12)', accent: '#E0457F', accentHover: '#F58AB3', tint: 'rgba(224,69,127,.16)', saving: '#5BE3A2', mint: 'rgba(91,227,162,.14)', butter: '#FFE08A', onLight: '#0B0B0F' };
// Fields behind the glass: raspberry, blue-grey, and green for money.
export const FIELDS = { raspberry: '#B4235A', blue: '#3A4A66', green: '#2BB673' };
export const SANS = "'Schibsted Grotesk', sans-serif";
export const MONO = "'IBM Plex Mono', monospace";
export const BANNED = /\b(demo|example|simulated|preview|fixture)\b/i;
