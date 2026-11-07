// A demo scene: its product panels sharing one frame, each coming in on its line and staying to the scene's end.
import { Freeze, Sequence, useVideoConfig } from 'remotion';
import { DUR, enter, MOTION_FPS, pop, useFrame } from '../motion.ts';
import { proofSpan, scene, shotSpan, wordAt } from '../plan.ts';
import { cueAt, type Laid, type Panel } from '../timeline.ts';
import { addedAt, ADDED, approvedAt, GoalPanel, HoldPanel, OrderPanel, PricePanel, productId, ProductPanel, ReceiptPanel, type PanelProps } from '../ui/panels.tsx';
import { BagCard, ROWS } from './Bidding.tsx';
import { Quiet } from '../ui/glass.tsx';

// The bag fills row by row, the product added on the right landing last; its one price lands as it is said, and
// PayPal's ceiling draws over it on "approve".
function Bag({ word }: PanelProps) {
  const frame = useFrame(), fps = MOTION_FPS, added = ROWS.indexOf(productId);
  const others = ROWS.map((_, i) => i).filter(i => i !== added);
  const arrive = (i: number) => i === added ? addedAt(word) + ADDED : 2 + others.indexOf(i) * 7;
  const totalAt = Math.max(...ROWS.map((_, i) => arrive(i)), word(0, '$'));
  const approve = approvedAt(word);
  return <BagCard row={i => enter(frame, fps, arrive(i))} total={pop(frame, fps, totalAt)} note={enter(frame, fps, Math.max(totalAt + 6, word(0, 'shipping')))} ceiling={frame >= approve ? enter(frame, fps, approve, 12) : 0} />;
}

const VIEWS: Record<Panel, (props: PanelProps) => React.ReactNode> = { price: PricePanel, goal: GoalPanel, product: ProductPanel, bag: Bag, hold: HoldPanel, receipt: ReceiptPanel, order: OrderPanel };

// A panel's timing functions, in frames from the start of its shot.
const timing = (laid: Laid, from: number) => ({
  at: (cue: number) => (cueAt(laid, cue) - from) * MOTION_FPS,
  word: (cue: number, text: string) => (wordAt(laid, cue, text) - from) * MOTION_FPS,
});

// The receipt as the result scene left it: it stays on the left, dimmed, while the shop is paid, until the real
// payout rises in over it.
function Receipt({ laid }: { laid: Laid }) {
  const { fps } = useVideoConfig(), frame = useFrame(), result = scene('result'), { from, length } = shotSpan(result, 0);
  const proof = Math.round(proofSpan(laid, 0).from * MOTION_FPS);
  return <div style={{ position: 'absolute', inset: 0, opacity: 0.45 * (1 - enter(frame, MOTION_FPS, proof, DUR.standard)) }}>
    <Quiet.Provider value><Freeze frame={Math.round(result.duration * fps) - 1}><ReceiptPanel {...timing(result, from)} length={length} boxed={false} /></Freeze></Quiet.Provider>
  </div>;
}

export function ClipScene({ laid }: { laid: Laid }) {
  const { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: 0 }}>
    {laid.id === 'payout' && <Receipt laid={laid} />}
    {laid.scene.shots!.map((shot, i) => {
      const { from, length } = shotSpan(laid, i), View = VIEWS[shot.panel];
      return <Sequence key={i} from={Math.round(from * fps)} layout="none">
        <View {...timing(laid, from)} length={length} />
      </Sequence>;
    })}
  </div>;
}
