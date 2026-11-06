import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { C } from '../theme.ts';
import { clamp, DUR, ease, enter, rise, typed } from '../motion.ts';
import type { Laid } from '../timeline.ts';

// High level only: no logos and no tech names on the boxes.
const BOXES = [
  { title: 'Shopper', line: 'approves one total with PayPal' },
  { title: 'Shop agents', line: "write bids, follow their owner's goals" },
  { title: "Rally's checks", line: 'private limits, stock, the hold', checks: true },
  { title: 'PayPal', line: 'captures the final amount, pays the shops', paypal: true },
];
const W = 380, H = 210, GAP = 60, LEFT = (1920 - (4 * W + 3 * GAP)) / 2, TOP = 250, TRACK = TOP - 46;
const centre = (i: number) => LEFT + i * (W + GAP) + W / 2;
const MOTTO = "Agents propose. Rally's checks decide. PayPal moves the money.";
const STACK = 'FastAPI · PostgreSQL · PayPal Orders v2, Payouts, webhooks · open-weight models on Bitdeer';

// The dot's path as fractions of the first line: it lingers on Rally's checks, where the decision is made.
const DOT: [number, number][] = [[0.1, centre(0)], [0.35, centre(1)], [0.5, centre(2) - 30], [0.85, centre(2) + 30], [1.05, centre(3)]];

export function Architecture({ laid }: { laid: Laid }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const s = frame / fps, motto = laid.cues[1].start - laid.start;
  const path = DOT.map(([at, x]): [number, number] => [0.4 + at * (motto - 0.4), x]);
  const x = interpolate(s, path.map(row => row[0]), path.map(row => row[1]), { ...clamp, easing: ease });
  const dot = enter(frame, fps, path[0][0] * fps - DUR.micro, DUR.micro) * (1 - enter(frame, fps, path[path.length - 1][0] * fps, DUR.micro));
  const d = `M ${centre(0)} ${TRACK} H ${centre(3)}`;
  const line = evolvePath(interpolate(frame, [4, 4 + 3 * DUR.micro + DUR.standard], [0, 1], { ...clamp, easing: ease }), d);
  const mottoAt = motto * fps, stackAt = (motto + 1.6) * fps;
  return <div style={{ position: 'absolute', inset: 0 }}>
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      <path d={d} stroke={C.line} strokeWidth={3} fill="none" strokeDasharray={line.strokeDasharray} strokeDashoffset={line.strokeDashoffset} />
    </svg>
    {BOXES.map((box, i) => {
      const at = 4 + i * DUR.micro, lit = Math.abs(x - centre(i)) < W / 2 && dot > 0.5;
      return <div key={box.title} style={{ position: 'absolute', left: LEFT + i * (W + GAP), top: TOP, width: W, height: H, boxSizing: 'border-box', borderRadius: 16, padding: '28px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10,
        background: box.checks ? C.mint : box.paypal ? C.tint : C.surface, border: `2px solid ${lit ? (box.checks ? C.saving : box.paypal ? C.accent : C.ink) : box.checks ? C.mint : box.paypal ? C.tint : C.line}`, ...rise(enter(frame, fps, at)) }}>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-.025em', color: box.checks ? C.saving : box.paypal ? C.accentHover : C.ink }}>{box.title}</div>
        <div style={{ fontSize: 27, lineHeight: 1.3, color: box.checks ? C.saving : box.paypal ? C.accentHover : C.muted }}>{box.line}</div>
      </div>;
    })}
    <div style={{ position: 'absolute', left: x - 13, top: TRACK - 13, width: 26, height: 26, borderRadius: 13, background: C.accent, opacity: dot }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 590, textAlign: 'center', fontSize: 54, fontWeight: 800, letterSpacing: '-.03em' }}>{typed(MOTTO, frame, mottoAt, fps)}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', fontSize: 24, color: C.muted, ...rise(enter(frame, fps, stackAt)) }}>{STACK}</div>
  </div>;
}
