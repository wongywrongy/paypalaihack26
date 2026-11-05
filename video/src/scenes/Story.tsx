import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, MONO } from '../theme.ts';
import { clamp, DUR, ease, enter, pop, rise } from '../motion.ts';
import type { Scene } from '../timeline.ts';

const Center = ({ children }: { children: React.ReactNode }) => <div style={{ position: 'absolute', inset: '0 0 140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>;
const LINES = ['checkouts.', 'parcels.', 'customs bills.'];
// Frame the narration reaches "three checkouts"; the lines stack in from here.
const FIRST = 52, STAGGER = 6;

// "Three" pulses once in the accent as its line lands, then settles back to ink.
function Three({ at }: { at: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const p = pop(frame, fps, at);
  const glow = interpolate(frame, [at, at + DUR.standard, at + DUR.standard * 2], [0, 1, 0], clamp);
  return <span style={{ display: 'inline-block', color: glow > 0.5 ? C.accent : C.ink, transform: `scale(${1 + 0.06 * Math.sin(Math.min(1, p) * Math.PI)})` }}>Three</span>;
}

export function Problem({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const end = scene.duration * fps;
  // The last 14 frames fold the three lines into one word, which the title picks up.
  const fold = ease(interpolate(frame, [end - DUR.standard - 6, end - 6], [0, 1], clamp));
  const one = enter(frame, fps, end - DUR.micro - 4, DUR.micro);
  const after = enter(frame, fps, 7 * fps);
  return <Center>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', transform: `scaleY(${1 - fold})`, opacity: 1 - fold }}>
      {LINES.map((line, i) => {
        const at = FIRST + i * STAGGER;
        return <div key={line} style={{ fontSize: 150, fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.02, ...rise(enter(frame, fps, at), 40) }}><Three at={at} /> {line}</div>;
      })}
      <div style={{ fontSize: 46, fontWeight: 600, color: C.muted, marginTop: 30, ...rise(after) }}>And fees at the door.</div>
    </div>
    <div style={{ position: 'absolute', fontSize: 150, fontWeight: 800, letterSpacing: '-.035em', color: C.accent, opacity: one, transform: `scale(${0.9 + 0.1 * one})` }}>one</div>
  </Center>;
}

export function PromiseCard() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <Center>
    <div style={{ fontSize: 200, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, ...rise(enter(frame, fps, 4)) }}>Rally.</div>
    <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: '-.02em', marginTop: 34, ...rise(enter(frame, fps, 12)) }}>Korean skincare, <span style={{ color: C.accent }}>one</span> box, your currency.</div>
    <div style={{ fontSize: 26, color: C.muted, marginTop: 30, ...rise(enter(frame, fps, 22)) }}>PayPal sandbox · fictional shops</div>
  </Center>;
}

// Cited from docs/SUBMISSION.md, "Potential impact".
const FOOD_DRUG = 'Ministry of Food and Drug Safety, via Korea JoongAng Daily';
const STATS = [
  { value: '$11.4B', label: 'Korean cosmetics exports in 2025, a record', source: FOOD_DRUG },
  { value: '$2.2B', label: 'of it to the US, up 15%', source: FOOD_DRUG },
  { value: '+38.2%', label: 'small-business online exports, Q1 2026, mostly cosmetics', source: 'Ministry of SMEs and Startups, via Korea JoongAng Daily' },
];

export function Close() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const END = 6 * fps;
  if (frame >= END) return <Center>
    <div style={{ fontSize: 160, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, ...rise(enter(frame, fps, END, DUR.micro)) }}>Rally.</div>
    <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 48, ...rise(enter(frame, fps, END + DUR.micro)) }}>github.com/wongywrongy/paypalaihack26</div>
    <div style={{ fontSize: 30, color: C.muted, marginTop: 18, ...rise(enter(frame, fps, END + DUR.standard)) }}>Open source, MIT license</div>
  </Center>;
  const out = 1 - enter(frame, fps, END - DUR.micro, DUR.micro);
  return <Center>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 500px)', gap: 60, textAlign: 'left', opacity: out }}>{STATS.map((stat, i) => <div key={stat.value} style={{ borderTop: `2px solid ${C.ink}`, paddingTop: 26, ...rise(enter(frame, fps, 6 + i * DUR.micro)) }}>
      <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 96, letterSpacing: '-.03em', lineHeight: 1.05, color: C.accent }}>{stat.value}</div>
      <div style={{ fontSize: 32, fontWeight: 600, marginTop: 14, lineHeight: 1.25 }}>{stat.label}</div>
      <div style={{ fontSize: 20, color: C.muted, marginTop: 14 }}>{stat.source}</div>
    </div>)}</div>
  </Center>;
}
