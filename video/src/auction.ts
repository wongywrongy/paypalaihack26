// Rebuilds the board from saved events, following frontend/src/auction.ts: bids only lower a lane, leaders follow
// `round`, winners follow `award`. Keyed by event time so the video can scrub it.
export type Perk = 'older' | 'kit' | 'bundle' | 'freeship';
export type AuctionEvent = { seq: number; t: number; kind: string; note?: string; total?: number; chosen_by?: string; [key: string]: any };
export type Step = { t: number; value: number };
export type Lane = { shop: string; steps: Step[]; perks: { t: number; perk: Perk }[]; passedAt: number | null; wonAt: number | null };
export type Item = { id: string; lanes: Lane[]; listed: number };
export type Agents = { written: number; options: number; rejected: number; code: number; changed: number };
export type Board = { events: AuctionEvent[]; items: Item[]; shops: string[]; totals: Step[]; rounds: Step[]; bids: AuctionEvent[]; rejected: AuctionEvent[]; awardAt: number; end: number; agents: Agents | null };

const ORDER = ['haneul', 'bada', 'dalbit'];

// Saved events can carry t=0 after a retained award, so time never runs backwards. Bids resolved in the same
// millisecond still get their own instant (1 ms apart), so each can have its own beat on screen.
export function buildBoard(raw: AuctionEvent[]): Board {
  let last = -1;
  const events: AuctionEvent[] = [...raw].sort((a, b) => a.seq - b.seq).map(event => ({ ...event, t: (last = Math.max(last + 0.001, event.t)) }));
  const start = events.find(event => event.kind === 'start')!;
  const items: Item[] = start.items.map((id: string) => {
    const listed = Object.values(start.listed[id] as Record<string, number>);
    return { id, listed: Math.min(...listed), lanes: start.shops[id].map((shop: string) => ({ shop, steps: start.listed[id][shop] === undefined ? [] : [{ t: start.t, value: start.listed[id][shop] }], perks: [], passedAt: null, wonAt: null })) };
  });
  const lane = (id: string, shop: string) => items.find(item => item.id === id)?.lanes.find(row => row.shop === shop);
  const totals: Step[] = [], rounds: Step[] = [], bids: AuctionEvent[] = [], rejected: AuctionEvent[] = [];
  let awardAt = events[events.length - 1].t, agents: Agents | null = null;
  for (const event of events) {
    if (event.total !== undefined) totals.push({ t: event.t, value: event.total });
    if (event.kind === 'bid') {
      bids.push(event);
      for (const [key, price] of Object.entries(event.items as Record<string, number>)) {
        const id = key.split(':')[0], row = lane(id, event.shop);
        if (!row) continue;
        row.steps.push({ t: event.t, value: price });
        for (const perk of (event.perks[id] || []) as Perk[]) if (!row.perks.some(seen => seen.perk === perk)) row.perks.push({ t: event.t, perk });
      }
    }
    if (event.kind === 'rejected') rejected.push(event);
    if (event.kind === 'pass') for (const id of event.items) { const row = lane(id, event.shop); if (row) row.passedAt = event.t; }
    if (event.kind === 'round') rounds.push({ t: event.t, value: event.round });
    if (event.kind === 'award') {
      awardAt = event.t;
      agents = event.agents ?? null;
      for (const [id, winner] of Object.entries(event.winners as Record<string, { shop: string }>)) { const row = lane(id, winner.shop); if (row) row.wonAt = event.t; }
    }
  }
  const shops = ORDER.filter(shop => items.some(item => item.lanes.some(row => row.shop === shop)));
  return { events, items, shops, totals, rounds, bids, rejected, awardAt, end: events[events.length - 1].t, agents };
}

// The value at time t, gliding `glide` seconds from each step to the next.
export function valueAt(steps: Step[], t: number, glide: number, ease: (x: number) => number = x => x) {
  if (!steps.length || t < steps[0].t) return steps[0]?.value ?? null;
  let value = steps[0].value;
  for (const step of steps.slice(1)) {
    if (t < step.t) break;
    value += (step.value - value) * ease(Math.min(1, (t - step.t) / glide));
  }
  return value;
}

export const roundAt = (board: Board, t: number) => board.rounds.filter(step => step.t <= t).length;

// --- Pacing: maps auction seconds onto scene seconds. ---
export type Knot = { t: number; s: number };
export type Pace = { knots: Knot[] };

// The board starts at `from`; each anchor pins an event to the moment its line is spoken, and time runs evenly
// between pins. Anchors that would run time backwards are dropped. After the last pin the board keeps real time.
export function anchored(board: Board, from: number, anchors: Knot[]): Pace {
  const knots: Knot[] = [{ t: board.events[0].t, s: from }];
  for (const anchor of anchors) {
    const last = knots[knots.length - 1];
    if (anchor.t > last.t && anchor.s > last.s) knots.push(anchor);
  }
  return { knots };
}

export function sceneAt({ knots }: Pace, t: number) {
  const last = knots[knots.length - 1];
  if (t >= last.t) return last.s + (t - last.t);
  if (t <= knots[0].t) return knots[0].s;
  const i = knots.findIndex(knot => knot.t > t) - 1;
  const a = knots[i], b = knots[i + 1];
  return a.s + (b.s - a.s) * (b.t === a.t ? 1 : (t - a.t) / (b.t - a.t));
}

// The board with every time moved onto the scene's clock.
export function onScene(board: Board, p: Pace): Board {
  const at = (t: number) => sceneAt(p, t);
  const steps = (rows: Step[]) => rows.map(row => ({ ...row, t: at(row.t) }));
  const event = (row: AuctionEvent) => ({ ...row, t: at(row.t) });
  return {
    ...board,
    items: board.items.map(item => ({ ...item, lanes: item.lanes.map(lane => ({ ...lane, steps: steps(lane.steps), perks: lane.perks.map(perk => ({ ...perk, t: at(perk.t) })), passedAt: lane.passedAt === null ? null : at(lane.passedAt), wonAt: lane.wonAt === null ? null : at(lane.wonAt) })) })),
    totals: steps(board.totals), rounds: steps(board.rounds), bids: board.bids.map(event), rejected: board.rejected.map(event),
    awardAt: at(board.awardAt), end: at(board.end),
  };
}
