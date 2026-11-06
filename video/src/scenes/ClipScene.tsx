// A demo scene: its product panels in turn, and any proof shot of the real recording over them.
import { Sequence, useVideoConfig } from 'remotion';
import { C, manifest, MONO } from '../theme.ts';
import { DUR, ease, enter, MOTION_FPS, useFrame } from '../motion.ts';
import { Flight, Photo } from '../ui.tsx';
import { shotSpan } from '../plan.ts';
import { cueAt, type Laid, type Panel } from '../timeline.ts';
import { GoalPanel, HoldPanel, ORDER_ROWS, OrderPanel, PAID_SPOT, PricePanel, ProductPanel, ReceiptPanel, type PanelProps } from '../ui/panels.tsx';
import { BagCard, BOARD_TOTAL, boardRow, ROWS } from './Bidding.tsx';
import { RAIL_PILL } from './Rail.tsx';

// The bag holds, then shrinks into the rail's "One bag" pill as the shopper moves on to approve it.
function Bag({ length }: PanelProps) {
  const frame = useFrame(), end = length * MOTION_FPS;
  const p = ease((frame - (end - 16)) / 16), s = 1 + 0.01 * frame / MOTION_FPS;
  const dx = (RAIL_PILL.x - 960) * p, dy = (RAIL_PILL.y - 500) * p;
  return <div style={{ position: 'absolute', inset: 0, transformOrigin: '960px 500px', transform: `translate(${dx}px, ${dy}px) scale(${s * (1 - 0.92 * p)})`, opacity: 1 - p * 0.8 }}><BagCard /></div>;
}

const VIEWS: Record<Panel, (props: PanelProps) => React.ReactNode> = { price: PricePanel, goal: GoalPanel, product: ProductPanel, bag: Bag, hold: HoldPanel, receipt: ReceiptPanel, order: OrderPanel };

export function ClipScene({ laid }: { laid: Laid }) {
  const { fps } = useVideoConfig();
  return <>
    <div style={{ position: 'absolute', inset: 0 }}>
      {laid.scene.shots!.map((shot, i) => {
        const { from, length } = shotSpan(laid, i), View = VIEWS[shot.panel];
        const at = (cue: number) => (cueAt(laid, cue) - from) * MOTION_FPS;
        return <Sequence key={i} from={Math.round(from * fps)} durationInFrames={i + 1 < laid.scene.shots!.length ? Math.max(1, Math.round(length * fps)) : undefined} layout="none">
          <View at={at} length={length} />
        </Sequence>;
      })}
      {laid.id === 'result' && <Flight from={BOARD_TOTAL} to={PAID_SPOT} frames={DUR.camera}><span style={{ fontFamily: MONO, color: C.saving, letterSpacing: '-.03em' }}>{manifest.vars.charged}</span></Flight>}
      {laid.id === 'payout' && <WinsIntoOrder />}
    </div>
  </>;
}

// Haneul's winning items slide from the board's rows into her order.
function WinsIntoOrder() {
  const frame = useFrame();
  const won = Object.entries(manifest.run.winners).filter(([, row]) => row.shop === 'haneul').map(([id]) => id);
  return <>{won.map((id, i) => {
    const a = boardRow(ROWS.indexOf(id)), b = ORDER_ROWS(i), p = ease((frame - i * 2) / DUR.camera);
    if (p >= 1) return null;
    return <div key={id} style={{ position: 'absolute', left: a.x + (b.x - a.x) * p, top: a.y + (b.y - a.y) * p, display: 'flex', alignItems: 'center', gap: 16, opacity: 1 - enter(frame, MOTION_FPS, DUR.camera - 4, 6) }}>
      <Photo id={id} size={84 - 28 * p} /><span style={{ fontSize: 34 - 4 * p, fontWeight: 700 }}>{manifest.names[id]}</span>
    </div>;
  })}</>;
}
