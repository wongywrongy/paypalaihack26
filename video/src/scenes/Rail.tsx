// The step rail: five numbered labels across the top, the current one filled. Introduced in act 2, kept through the demo.
import { C } from '../theme.ts';
import { MOTION_FPS, pop, useFrame } from '../motion.ts';
import { STEPS, type Step } from '../timeline.ts';

// Top centre; in the demo the role tag holds the top left and the total the top right.
export const RAIL_X = 960, RAIL_Y = 36;
// Where the "1 One bag" pill sits, for the bag that shrinks into it.
export const RAIL_PILL = { x: 848, y: 68 };

// shown: how many labels are drawn (act 2 adds one per step). from: the frame each label pops in.
// filled: the step on screen. before: step 3 outlined, for the shop's setup ahead of any order.
// compact: in the demo only the current step keeps its label, so the rail fits between the role tag and the total.
export function Rail({ shown = 5, filled, from, before = false, compact = false, x = RAIL_X }: { shown?: number; filled: Step | null; from?: number[]; before?: boolean; compact?: boolean; x?: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  return <div style={{ position: 'absolute', left: x, top: RAIL_Y, transform: 'translateX(-50%)', display: 'flex', gap: 10, padding: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12), 0 10px 30px rgba(0,0,0,.35)', backdropFilter: 'blur(20px)', opacity: shown ? 1 : 0 }}>
    {STEPS.map((label, i) => {
      const n = (i + 1) as Step, on = filled === n, outlined = before && n === 3;
      const p = from ? Math.min(1, pop(frame, fps, from[i])) : 1;
      const named = !compact || on || outlined;
      return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: named ? '8px 18px' : '8px 0', minWidth: named ? undefined : 44, justifyContent: 'center', borderRadius: 999, fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap',
        background: on ? 'rgba(255,255,255,.92)' : 'transparent', color: on ? C.onLight : outlined ? C.accentHover : i < shown ? C.ink : 'rgba(255,255,255,.3)', border: `2px solid ${on ? C.ink : outlined ? C.accent : 'transparent'}`,
        opacity: i < shown ? 0.35 + 0.65 * p : 0.35, transform: `scale(${i < shown ? 0.9 + 0.1 * p : 0.9})` }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>{named && label}{outlined && <span style={{ fontWeight: 600 }}>· before any order</span>}
      </div>;
    })}
  </div>;
}
