import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, manifest, MONO } from '../theme.ts';
import { DUR, ease } from '../motion.ts';
import { Clip, Flight } from '../ui.tsx';
import { shotKeys, shotSpan, shotSpots, spotAt } from '../plan.ts';
import { BagCard, BOARD_TOTAL } from './Bidding.tsx';
import type { Laid } from '../timeline.ts';

// Measured on the recorded run, in 1440×900 window pixels: the receipt's "You paid" amount and Haneul's order row.
const PAID = { x: 610, y: 274, h: 58 }, ORDER_ROW = { x: 432, y: 171, w: 262 };

// The rebuilt bag drifts closer while it holds, like footage under the camera.
function Bag() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.012 * frame / fps})` }}><BagCard /></div>;
}

export function ClipScene({ laid }: { laid: Laid }) {
  const { fps } = useVideoConfig();
  return <>
    {laid.scene.shots!.map((shot, i) => {
      const { from, length } = shotSpan(laid, i);
      return <Sequence key={i} from={Math.round(from * fps)} durationInFrames={i + 1 < laid.scene.shots!.length ? Math.max(1, Math.round(length * fps)) : undefined} layout="none">
        {shot.clip === 'bag' ? <Bag /> : <Clip name={shot.clip} from={shot.in} to={shot.out} length={length} keys={shotKeys(laid, shot, from, length)} spots={shotSpots(laid, shot, from, length)} />}
      </Sequence>;
    })}
    {laid.id === 'result' && <Flight from={BOARD_TOTAL} to={spotAt('result', 0, DUR.camera / fps, PAID.x, PAID.y, PAID.h)} out={DUR.camera}><span style={{ fontFamily: MONO, color: C.saving, letterSpacing: '-.03em' }}>{manifest.vars.charged}</span></Flight>}
    {laid.id === 'payout' && <WinsToRow />}
  </>;
}

// Haneul's wins shrink into her order's row on the Orders page.
function WinsToRow() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const row = spotAt('payout', 0, DUR.camera / fps, ORDER_ROW.x, ORDER_ROW.y, ORDER_ROW.w);
  const won = Object.values(manifest.run.winners).filter(item => item.shop === 'haneul').length;
  const p = ease(frame / DUR.camera);
  return <Flight from={{ x: 960, y: 520, size: 40 }} to={{ x: row.x, y: row.y, size: row.size / 14 }} out={DUR.camera}>
    <div style={{ width: '14em', boxSizing: 'border-box', padding: '.9em 1.1em', borderRadius: '.6em', background: C.mint, border: `.08em solid ${C.saving}`, color: C.saving, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1em', opacity: 1 - 0.3 * p }}>
      <span style={{ fontWeight: 800, fontSize: '.8em' }}>Haneul Beauty · won {won}</span>
      <span style={{ fontFamily: MONO, fontSize: '.8em' }}>{manifest.vars.payout}</span>
    </div>
  </Flight>;
}
