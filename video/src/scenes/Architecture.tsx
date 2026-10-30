import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, EASE, enter, MONO, rise } from '../theme.ts';

type Node = { id: string; x: number; y: number; w: number; h: number; at: number; title: string; sub?: string; api?: string; kind?: 'paypal' | 'code' | 'side' };

// Each PayPal path is the one backend/rally/payments calls.
const NODES: Node[] = [
  { id: 'shopper', x: 40, y: 56, w: 230, h: 140, at: 0.3, title: 'Shopper', sub: 'Approves in PayPal' },
  { id: 'authorize', x: 340, y: 56, w: 500, h: 140, at: 1.5, title: 'PayPal Orders v2: authorize', api: 'POST /v2/checkout/orders/{id}/authorize', kind: 'paypal' },
  { id: 'api', x: 910, y: 56, w: 340, h: 140, at: 3.5, title: 'Rally API', sub: 'FastAPI' },
  { id: 'worker', x: 1320, y: 56, w: 560, h: 140, at: 6.5, title: 'Worker', sub: 'PostgreSQL, idempotent ledger' },
  { id: 'agents', x: 40, y: 300, w: 250, h: 176, at: 12, title: 'Buyer agent + 3 shop agents', sub: 'Bitdeer models' },
  { id: 'indexes', x: 320, y: 300, w: 200, h: 176, at: 13.5, title: 'Candidate indexes', sub: 'Models pick only these' },
  { id: 'award', x: 550, y: 300, w: 190, h: 176, at: 15.5, title: 'Code award', sub: 'Lowest complete total', kind: 'code' },
  { id: 'capture', x: 770, y: 300, w: 400, h: 176, at: 18, title: 'PayPal partial capture ≤ hold', api: 'POST /v2/payments/authorizations/\n{id}/capture', kind: 'paypal' },
  { id: 'payouts', x: 1200, y: 300, w: 320, h: 176, at: 19.2, title: 'PayPal Payouts', api: 'POST /v1/payments/payouts', kind: 'paypal' },
  { id: 'webhooks', x: 1550, y: 300, w: 330, h: 176, at: 20.4, title: 'Webhooks verified and reconciled', api: 'POST /v1/notifications/\nverify-webhook-signature', kind: 'paypal' },
  { id: 'channel3', x: 40, y: 560, w: 580, h: 84, at: 21, title: 'Channel3 market medians', sub: 'Display filter', kind: 'side' },
  { id: 'grid', x: 670, y: 560, w: 580, h: 84, at: 21.3, title: 'AG Grid merchant listings', kind: 'side' },
  { id: 'render', x: 1300, y: 560, w: 580, h: 84, at: 21.6, title: 'Render hosting', kind: 'side' },
];
const EDGES: [string, string][] = [['shopper', 'authorize'], ['authorize', 'api'], ['api', 'worker'], ['worker', 'agents'], ['agents', 'indexes'], ['indexes', 'award'], ['award', 'capture'], ['capture', 'payouts'], ['payouts', 'webhooks']];

const find = (id: string) => NODES.find(node => node.id === id)!;

function edgePath(from: Node, to: Node) {
  if (from.y === to.y) return `M ${from.x + from.w} ${from.y + from.h / 2} H ${to.x}`;
  // Row change: down from the worker, across the gutter, into the agents.
  const mid = (from.y + from.h + to.y) / 2, x = to.x + to.w / 2;
  return `M ${from.x + from.w / 2} ${from.y + from.h} V ${mid} H ${x} V ${to.y}`;
}

function NodeBox({ node }: { node: Node }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const paypal = node.kind === 'paypal', code = node.kind === 'code', side = node.kind === 'side';
  return <div style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h, boxSizing: 'border-box', background: code ? C.mint : paypal ? C.tint : C.surface, border: `2px ${side ? 'dashed' : 'solid'} ${code ? C.saving : paypal ? C.accent : C.line}`, borderRadius: 16, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, ...rise(enter(frame, fps, node.at * fps)) }}>
    <div style={{ fontSize: side ? 25 : 26, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.015em' }}>{node.title}</div>
    {node.sub && <div style={{ fontSize: 22, color: C.muted, lineHeight: 1.2 }}>{node.sub}</div>}
    {node.api && <div style={{ fontFamily: MONO, fontSize: 18, lineHeight: 1.25, color: C.accent, whiteSpace: 'pre-line' }}>{node.api}</div>}
  </div>;
}

export function Architecture() {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: 0 }}>
    <svg width={1920} height={760} style={{ position: 'absolute', inset: 0 }}>
      {EDGES.map(([a, b]) => {
        const from = find(a), to = find(b), begin = (to.at - 0.8) * fps;
        const draw = interpolate(frame, [begin, begin + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
        return <path key={a + b} d={edgePath(from, to)} fill="none" stroke={C.ink} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />;
      })}
    </svg>
    {NODES.map(node => <NodeBox key={node.id} node={node} />)}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 716, textAlign: 'center', fontSize: 64, fontWeight: 800, letterSpacing: '-.03em', ...rise(enter(frame, fps, 22 * fps)) }}>Models propose. Code decides. PayPal moves the money.</div>
  </div>;
}
