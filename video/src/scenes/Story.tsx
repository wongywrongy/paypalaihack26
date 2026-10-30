import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SHOP_NAMES } from '../schema.ts';
import { C, EASE, enter, MONO, rise, SHADOW } from '../theme.ts';

const Center = ({ children }: { children: React.ReactNode }) => <div style={{ position: 'absolute', inset: '0 0 130px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>;
const STAGES = ['Checkout', 'Parcel', 'Customs bill'];

function Track({ name, index }: { name: string; index: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const delay = 10 + index * 16;
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...rise(enter(frame, fps, delay)) }}>
    <div style={{ width: 340, background: C.surface, borderRadius: 20, boxShadow: SHADOW, padding: '26px 28px', fontSize: 34, fontWeight: 700, letterSpacing: '-.015em' }}>{name}</div>
    {STAGES.map((stage, i) => {
      const from = delay + 24 + i * 30;
      const line = interpolate(frame, [from, from + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
      return <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 70, height: 3, background: C.line }}><div style={{ width: `${line * 100}%`, height: 3, background: C.accent }} /></div>
        <div style={{ width: 300, textAlign: 'center', background: C.tint, color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: '20px 12px', fontSize: 30, fontWeight: 600, ...rise(enter(frame, fps, from + 12)) }}>{stage}</div>
      </div>;
    })}
  </div>;
}

export function Problem() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: '70px 60px 130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
    {Object.values(SHOP_NAMES).map((name, i) => <Track key={name} name={name} index={i} />)}
    <div style={{ marginTop: 28, textAlign: 'center', ...rise(enter(frame, fps, 170)) }}>
      <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-.03em' }}>3 shops · 3 checkouts · 3 parcels · 3 customs bills</div>
      <div style={{ fontSize: 26, color: C.muted, marginTop: 10 }}>US de minimis suspended Aug 29, 2025</div>
    </div>
  </div>;
}

export function Title() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <Center>
    <div style={{ fontSize: 210, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, ...rise(enter(frame, fps)) }}><span style={{ color: C.accent, fontSize: '.55em', verticalAlign: '.18em' }}>●</span> Rally</div>
    <div style={{ fontSize: 58, fontWeight: 600, letterSpacing: '-.02em', marginTop: 30, ...rise(enter(frame, fps, 10)) }}>Korean shops compete for your order.</div>
    <div style={{ fontSize: 28, color: C.muted, marginTop: 26, ...rise(enter(frame, fps, 20)) }}>PayPal sandbox · fictional shops</div>
  </Center>;
}

// Cited from docs/SUBMISSION.md, "Potential impact".
const FOOD_DRUG = 'Ministry of Food and Drug Safety, via Korea JoongAng Daily';
const STATS = [
  { value: '$11.4B', mono: true, label: 'Korean cosmetics exports, 2025', source: FOOD_DRUG },
  { value: '$2.2B', mono: true, label: 'to the US, +15%', source: FOOD_DRUG },
  { value: '+38.2%', mono: false, label: 'SME online exports, cosmetics +74.2%, Q1 2026', source: 'Ministry of SMEs and Startups, via Korea JoongAng Daily' },
];

export function Close() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const END = 11 * fps;
  if (frame >= END) return <Center>
    <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, ...rise(enter(frame, fps, END)) }}><span style={{ color: C.accent, fontSize: '.55em', verticalAlign: '.18em' }}>●</span> Rally</div>
    <div style={{ fontFamily: MONO, fontSize: 38, marginTop: 44, ...rise(enter(frame, fps, END + 8)) }}>paypalaihack26.onrender.com</div>
    <div style={{ fontFamily: MONO, fontSize: 38, marginTop: 12, ...rise(enter(frame, fps, END + 14)) }}>github.com/wongywrongy/paypalaihack26</div>
    <div style={{ fontSize: 30, color: C.muted, marginTop: 26, ...rise(enter(frame, fps, END + 20)) }}>MIT licensed</div>
  </Center>;
  return <Center>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 540px)', gap: 30 }}>{STATS.map((stat, i) => <div key={stat.value} style={{ background: C.surface, borderRadius: 20, boxShadow: SHADOW, padding: '38px 34px', textAlign: 'left', ...rise(enter(frame, fps, 6 + i * 14)) }}>
      <div style={{ fontFamily: stat.mono ? MONO : undefined, fontSize: 86, fontWeight: stat.mono ? 400 : 800, letterSpacing: '-.03em', lineHeight: 1.1, color: C.accent }}>{stat.value}</div>
      <div style={{ fontSize: 31, fontWeight: 600, marginTop: 10, minHeight: 84, lineHeight: 1.3 }}>{stat.label}</div>
      <div style={{ fontSize: 20, color: C.muted, marginTop: 10, minHeight: 52 }}>{stat.source}</div>
    </div>)}</div>
    <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: '-.02em', marginTop: 56, ...rise(enter(frame, fps, 6 * fps)) }}>Works for any multi-merchant, cross-border cart.</div>
  </Center>;
}
