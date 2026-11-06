// The step rail: five numbered labels across the top, the current one filled. Introduced in act 2, kept through the demo.
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../theme.ts';
import { pop } from '../motion.ts';
import { STEPS, type Step } from '../timeline.ts';

// Centred right of the role tag, which holds the top left.
export const RAIL_X = 1250, RAIL_Y = 40;

// shown: how many labels are drawn (act 2 adds one per step). from: the frame each label pops in.
// filled: the step on screen. before: step 3 outlined, for the shop's setup ahead of any order.
export function Rail({ shown = 5, filled, from, before = false }: { shown?: number; filled: Step | null; from?: number[]; before?: boolean }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', left: RAIL_X, top: RAIL_Y, transform: 'translateX(-50%)', display: 'flex', gap: 10, padding: 8, borderRadius: 999, background: 'rgba(255,255,255,.94)', border: `1px solid ${C.line}`, boxShadow: '0 6px 24px rgba(23,22,26,.10)', opacity: shown ? 1 : 0 }}>
    {STEPS.map((label, i) => {
      const n = (i + 1) as Step, on = filled === n, outlined = before && n === 3;
      const p = from ? Math.min(1, pop(frame, fps, from[i])) : 1;
      return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap',
        background: on ? C.ink : C.surface, color: on ? C.surface : outlined ? C.accentHover : i < shown ? C.ink : C.line, border: `2px solid ${on ? C.ink : outlined ? C.accent : 'transparent'}`,
        opacity: i < shown ? 0.35 + 0.65 * p : 0.35, transform: `scale(${i < shown ? 0.9 + 0.1 * p : 0.9})` }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>{label}{outlined && <span style={{ fontSize: 18, fontWeight: 600 }}>· before any order</span>}
      </div>;
    })}
  </div>;
}
