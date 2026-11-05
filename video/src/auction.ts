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
const OTHER_BID = 0.6;
export type Pace = { knots: Knot[]; doubleFrom: number | null };
// gaps: the hold for an agent-written bid, preferred first; the last one is the floor before falling back to 2×.
export type PaceOptions = { from: number; until: number; gaps: number[]; rejectAt: number; rejectBeat: number };

// Each event's gap to the next is its share of real time, but an agent-written bid holds at least `minGap` and the
// first rejection holds `rejectBeat`, landing at `rejectAt` or as close before it as the later holds allow. If the holds alone overflow the scene, round 1
// keeps them and later rounds take half, shown as "2× speed".
export function pace(board: Board, options: PaceOptions): Pace {
  const { from, until, gaps, rejectAt, rejectBeat } = options;
  const events = board.events;
  let minGap = gaps[0];
  const first = board.rejected[0];
  const times = [...new Set([events[0].t, ...events.filter(row => row.t <= board.awardAt && row.kind !== 'done').map(row => row.t), board.awardAt])].sort((a, b) => a - b);
  const need = (t: number, half: boolean) => {
    if (first && t === first.t) return rejectBeat;
    const bid = events.find(row => row.kind === 'bid' && row.t === t);
    // Bids the agent did not write still get a moment, so two cards never land in the same frame.
    const hold = !bid ? 0 : bid.authored === 'agent' ? minGap : OTHER_BID;
    return half && bid?.round >= 2 ? hold / 2 : hold;
  };
  const lay = (points: number[], s0: number, s1: number, half: boolean): Knot[] => {
    const gaps = points.slice(1).map((t, i) => ({ dt: t - points[i], need: need(points[i], half) }));
    const fit = (scale: number) => gaps.reduce((sum, gap) => sum + Math.max(gap.dt * scale, gap.need), 0);
    const room = s1 - s0;
    let scale = 0;
    if (fit(0) <= room) {
      let lo = 0, hi = 1;
      while (fit(hi) < room && hi < 1e6) hi *= 2;
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (fit(mid) < room) lo = mid; else hi = mid; }
      scale = hi;
    }
    // Still over (only possible in the 2× fallback): squeeze evenly rather than overrun the scene.
    const squeeze = Math.min(1, room / Math.max(fit(scale), 1e-9));
    const knots = [{ t: points[0], s: s0 }];
    gaps.forEach((gap, i) => knots.push({ t: points[i + 1], s: knots[i].s + Math.max(gap.dt * scale, gap.need) * squeeze }));
    return knots;
  };
  const holds = (points: number[], half: boolean) => points.slice(0, -1).reduce((sum, t) => sum + need(t, half), 0);
  const build = (half: boolean) => {
    if (!first || first.t >= board.awardAt) return lay(times, from, until, half);
    const before = times.filter(t => t <= first.t), after = times.filter(t => t >= first.t);
    // The rejection moves earlier only as far as the holds after it need.
    const anchor = Math.max(from + holds(before, half), Math.min(rejectAt, until - holds(after, half)));
    return [...lay(before, from, anchor, half), ...lay(after, anchor, until, half).slice(1)];
  };
  const fits = (knots: Knot[]) => knots.slice(1).every((knot, i) => knot.s - knots[i].s + 1e-6 >= need(knots[i].t, false));
  for (const gap of gaps) {
    minGap = gap;
    const normal = build(false);
    if (fits(normal)) return { knots: normal, doubleFrom: null };
  }
  const round2 = board.rounds.find(step => step.value === 1)?.t ?? null;
  const knots = build(true);
  return { knots, doubleFrom: round2 === null ? null : sceneAt({ knots, doubleFrom: null }, round2) };
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
