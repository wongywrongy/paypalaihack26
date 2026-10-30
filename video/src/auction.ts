// Rebuilds the board from saved events, following frontend/src/auction.ts: bids only lower a lane, leaders follow
// `round`, winners follow `award`. Keyed by event time so the video can scrub it.
export type Perk = 'older' | 'kit' | 'bundle' | 'freeship';
export type AuctionEvent = { seq: number; t: number; kind: string; note?: string; total?: number; chosen_by?: string; [key: string]: any };
export type Step = { t: number; value: number };
export type Lane = { shop: string; steps: Step[]; perks: { t: number; perk: Perk }[]; passedAt: number | null; wonAt: number | null };
export type Item = { id: string; lanes: Lane[]; listed: number };
export type Board = { items: Item[]; totals: Step[]; rounds: Step[]; bids: AuctionEvent[]; awardAt: number; end: number };

// Saved events can carry t=0 after a retained award, so time never runs backwards.
export function buildBoard(raw: AuctionEvent[]): Board {
  let last = 0;
  const events: AuctionEvent[] = [...raw].sort((a, b) => a.seq - b.seq).map(event => ({ ...event, t: (last = Math.max(last, event.t)) }));
  const start = events.find(event => event.kind === 'start')!;
  const items: Item[] = start.items.map((id: string) => {
    const listed = Object.values(start.listed[id] as Record<string, number>);
    return { id, listed: Math.min(...listed), lanes: start.shops[id].map((shop: string) => ({ shop, steps: start.listed[id][shop] === undefined ? [] : [{ t: start.t, value: start.listed[id][shop] }], perks: [], passedAt: null, wonAt: null })) };
  });
  const lane = (id: string, shop: string) => items.find(item => item.id === id)?.lanes.find(row => row.shop === shop);
  const totals: Step[] = [], rounds: Step[] = [], bids: AuctionEvent[] = [];
  let awardAt = events[events.length - 1].t;
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
    if (event.kind === 'pass') for (const id of event.items) { const row = lane(id, event.shop); if (row) row.passedAt = event.t; }
    if (event.kind === 'round') rounds.push({ t: event.t, value: event.round });
    if (event.kind === 'award') {
      awardAt = event.t;
      for (const [id, winner] of Object.entries(event.winners as Record<string, { shop: string }>)) { const row = lane(id, winner.shop); if (row) row.wonAt = event.t; }
    }
  }
  return { items, totals, rounds, bids, awardAt, end: events[events.length - 1].t };
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

// Up to 3 notes a model wrote, one per shop. Banned words stay off screen even in a model's sentence.
export function bidNotes(board: Board, banned: RegExp) {
  const seen = new Set<string>(), notes: AuctionEvent[] = [];
  for (const bid of board.bids) {
    if (bid.chosen_by === 'CODE' || !bid.note || seen.has(bid.shop) || notes.length === 3 || banned.test(bid.note)) continue;
    seen.add(bid.shop);
    notes.push(bid);
  }
  return notes;
}
