// A demo scene: its product panels sharing one frame, each coming in on its line and staying to the scene's end.
import { Sequence, useVideoConfig } from 'remotion';
import { enter, MOTION_FPS, pop, useFrame } from '../motion.ts';
import { shotSpan, wordAt } from '../plan.ts';
import { cueAt, type Laid, type Panel } from '../timeline.ts';
import { addedAt, ADDED, approvedAt, BoxPanel, GoalPanel, HoldPanel, OrderPanel, PricePanel, productId, ProductPanel, ReceiptPanel, type PanelProps } from '../ui/panels.tsx';
import { BagCard, ROWS } from './Bidding.tsx';

// The bag fills row by row, half a second apart, the product added on the right landing last; its one price lands and
// is lit as it is said, and PayPal's ceiling draws over it on "approve".
function Bag({ word }: PanelProps) {
  const frame = useFrame(), fps = MOTION_FPS, added = ROWS.indexOf(productId);
  const others = ROWS.map((_, i) => i).filter(i => i !== added);
  const arrive = (i: number) => i === added ? Math.max(addedAt(word) + ADDED, 2 + others.length * 15) : 2 + others.indexOf(i) * 15;
  const totalAt = Math.max(...ROWS.map((_, i) => arrive(i)), word(0, '$'));
  const approve = approvedAt(word);
  return <BagCard row={i => enter(frame, fps, arrive(i))} total={pop(frame, fps, totalAt)} note={enter(frame, fps, Math.max(totalAt + 6, word(0, 'shipping')))} ceiling={frame >= approve ? enter(frame, fps, approve, 12) : 0} lit={frame >= totalAt ? enter(frame, fps, totalAt) * (1 - enter(frame, fps, approve)) : 0} />;
}

const VIEWS: Record<Panel, (props: PanelProps) => React.ReactNode> = { price: PricePanel, goal: GoalPanel, product: ProductPanel, bag: Bag, hold: HoldPanel, receipt: ReceiptPanel, box: BoxPanel, order: OrderPanel };

// A panel's timing functions, in frames from the start of its shot.
const timing = (laid: Laid, from: number) => ({
  at: (cue: number) => (cueAt(laid, cue) - from) * MOTION_FPS,
  word: (cue: number, text: string) => (wordAt(laid, cue, text) - from) * MOTION_FPS,
});

export function ClipScene({ laid }: { laid: Laid }) {
  const { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: 0 }}>
    {laid.scene.shots!.map((shot, i) => {
      const { from, length } = shotSpan(laid, i), View = VIEWS[shot.panel];
      return <Sequence key={i} from={Math.round(from * fps)} layout="none">
        <View {...timing(laid, from)} length={length} />
      </Sequence>;
    })}
  </div>;
}
