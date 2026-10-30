import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { bidNotes, buildBoard, roundAt, valueAt, type Lane, type Perk } from '../auction.ts';
import { money, SHOP_NAMES } from '../schema.ts';
import { BANNED, C, EASE, enter, manifest, MONO, rise } from '../theme.ts';
import { ClipFrame, Photo, Ribbon, Rich } from '../ui.tsx';
import type { Scene } from '../timeline.ts';

const PERKS: Record<Perk, string> = { bundle: 'Bundle', freeship: 'Ships free in Korea', older: 'Older packaging', kit: 'Sample kit' };
// Seconds of the scene that the saved events are spread across, leaving the award on screen at the end.
const FROM = 1.5, UNTIL = 35;
const GLIDE_FRAMES = 14;

const board = buildBoard(manifest.events);
const notes = bidNotes(board, BANNED);
const shopName = (id: string) => SHOP_NAMES[id as keyof typeof SHOP_NAMES];
const cash = (value: number) => money(Math.round(value), manifest.run.currency);
const prices = board.items.flatMap(item => item.lanes.flatMap(lane => lane.steps.map(step => step.value)));
const high = Math.max(...prices), low = Math.min(...prices) * 0.85;

function LaneRow({ lane, t, glide, sceneFrame, big }: { lane: Lane; t: number; glide: number; sceneFrame: (t: number) => number; big: boolean }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const price = valueAt(lane.steps, t, glide, EASE);
  const started = lane.steps.length > 1 && t >= lane.steps[1].t;
  const won = lane.wonAt !== null && t >= lane.wonAt, passed = lane.passedAt !== null && t >= lane.passedAt;
  const at = price === null ? 100 : (price - low) / (high - low) * 100;
  return <div style={{ display: 'grid', gridTemplateColumns: big ? '168px 150px 100px 1fr' : '150px 170px 92px 1fr', alignItems: 'center', gap: 10, height: big ? 58 : 34, padding: '0 8px', borderRadius: 8, background: won ? C.mint : 'transparent', fontSize: big ? 22 : 18 }}>
    <span style={{ color: won ? C.saving : C.muted, fontWeight: won ? 700 : 400, whiteSpace: 'nowrap' }}>{shopName(lane.shop)}</span>
    <div style={{ position: 'relative', height: 2, background: C.line }}>
      {price !== null && <div style={{ position: 'absolute', left: `${at}%`, top: -7, width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: won ? C.saving : started ? C.accent : C.surface, border: `2px solid ${won ? C.saving : C.accent}` }} />}
    </div>
    <span style={{ fontFamily: MONO, fontSize: big ? 24 : 19, letterSpacing: '-.025em', textAlign: 'right', color: passed ? C.muted : C.ink }}>{passed ? 'Pass' : price === null ? '' : cash(price)}</span>
    <div style={{ display: 'flex', gap: 5, overflow: 'hidden' }}>{lane.perks.filter(row => t >= row.t).map(row => {
      const pop = enter(frame, fps, sceneFrame(row.t));
      return <span key={row.perk} style={{ background: row.perk === 'older' || row.perk === 'bundle' ? C.butter : C.tint, borderRadius: 999, padding: '2px 9px', fontSize: big ? 16 : 14, whiteSpace: 'nowrap', opacity: pop, transform: `scale(${0.8 + pop * 0.2})` }}>{PERKS[row.perk]}</span>;
    })}</div>
  </div>;
}

function CodeCheck({ t, sceneFrame }: { t: number; sceneFrame: (t: number) => number }) {
  const frame = useCurrentFrame();
  const bid = [...board.bids].reverse().find(row => row.t <= t);
  const award = t >= board.awardAt;
  if (!bid || award) return <div style={{ height: 64 }} />;
  const since = frame - sceneFrame(bid.t);
  const checks = ["≥ shop's private floor", 'in stock', 'total ≤ hold'];
  return <div style={{ height: 64, borderTop: `1px solid ${C.line}`, paddingTop: 10, fontSize: 20 }}>
    <div style={{ color: C.muted, fontSize: 17 }}>Code check · {shopName(bid.shop)}</div>
    <div>{checks.map((label, i) => <span key={label} style={{ opacity: since >= i * 3 ? 1 : 0.25 }}>{i > 0 && ' · '}{label} <span style={{ color: C.saving, fontWeight: 700 }}>✓</span></span>)}</div>
  </div>;
}

function Note({ shop, note, delay }: { shop: string; note: string; delay: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return frame >= delay ? <div style={{ alignSelf: 'flex-start', maxWidth: '100%', background: C.surface, border: `1px solid ${C.line}`, borderRadius: '16px 16px 16px 4px', padding: '8px 16px', fontSize: 22, lineHeight: 1.25, ...rise(enter(frame, fps, delay)) }}>
    <span style={{ fontWeight: 700 }}>{shopName(shop)}: </span><Rich text={note} />
  </div> : null;
}

export function Bidding({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const start = FROM * fps, end = UNTIL * fps;
  const span = Math.max(board.awardAt, 0.001);
  // Runs past the award on purpose: clamping at `span` would freeze the last glide short of the real total.
  const t = interpolate(frame, [start, end], [0, span], { extrapolateLeft: 'clamp' });
  const sceneFrame = (at: number) => start + at / span * (end - start);
  const glide = GLIDE_FRAMES / (end - start) * span;
  const round = roundAt(board, t);
  const total = valueAt(board.totals, t, glide * 2, EASE) ?? manifest.run.held_minor;
  const awarded = t >= board.awardAt;
  const rows = Math.max(1, board.items.length), big = rows <= 2;
  return <>
    <Ribbon scene={scene} compact />
    <ClipFrame name="06-bidding" seconds={scene.duration} fit left={86} top={32} width={950} />
    <div style={{ position: 'absolute', left: 86, top: 646, width: 950, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {notes.map(note => <Note key={note.seq} shop={note.shop} note={note.note!} delay={sceneFrame(note.t)} />)}
    </div>
    <div style={{ position: 'absolute', left: 1064, top: 32, width: 824, height: 884, background: C.surface, borderRadius: 20, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10, ...rise(enter(frame, fps)) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 20, color: C.muted, marginBottom: 8 }}>Round</div>
          <div style={{ display: 'flex', gap: 8 }}>{board.rounds.map(step => <div key={step.t} style={{ width: 44, height: 44, borderRadius: 22, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700, background: step.value <= round ? C.accent : C.surface, color: step.value <= round ? C.surface : C.muted, border: `2px solid ${step.value <= round ? C.accent : C.line}` }}>{step.value}</div>)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, color: C.muted }}>All-in total</div>
          <div style={{ fontFamily: MONO, fontSize: 76, lineHeight: 1.05, letterSpacing: '-.03em', color: awarded ? C.saving : C.ink }}>{cash(total)}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', minHeight: 0 }}>
        {board.items.map(item => <div key={item.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: big ? 14 : 10, marginBottom: big ? 8 : 2 }}><Photo id={item.id} size={big ? 72 : rows > 3 ? 34 : 48} /><div style={{ fontSize: big ? 28 : 20, fontWeight: 700, letterSpacing: '-.015em' }}>{manifest.names[item.id]}</div></div>
          {item.lanes.map(lane => <LaneRow key={lane.shop} lane={lane} t={t} glide={glide} sceneFrame={sceneFrame} big={big} />)}
        </div>)}
      </div>
      {awarded ? <div style={{ height: 64, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 700, color: C.saving, background: C.mint, borderRadius: 12, ...rise(enter(frame, fps, sceneFrame(board.awardAt))) }}>Lowest complete delivered total wins</div> : <CodeCheck t={t} sceneFrame={sceneFrame} />}
    </div>
  </>;
}
