// v3 shop bidding view model (docs/plan/BIDDING.md, "Events" and "Frontend").
// Pure reducer shared by the live stream, replay and the shop workspace. No payment or network capability.
// Amounts are shopper-currency minor units, as in the existing deal events.

export type AuctionShop = 'haneul' | 'bada' | 'dalbit';
export type Perk = 'older' | 'kit' | 'bundle' | 'freeship';

export type AuctionEvent = {
  id: string; seq: number; t: number; actor?: 'rally' | 'shop'; note?: string; total?: number; chosen_by?: 'CODE' | 'LLM' | 'FIXTURE';
} & (
  | { kind: 'start'; v: 3; items: string[]; shops: Record<string, AuctionShop[]>; listed: Record<string, Partial<Record<AuctionShop, number>>> }
  | { kind: 'ask'; actor: 'rally'; round: number; shop: AuctionShop | null; items: string[] }
  | { kind: 'bid'; actor: 'shop'; round: number; shop: AuctionShop; items: Record<string, number>; bundle: { items: string[]; price: number } | null; perks: Record<string, Perk[]> }
  | { kind: 'pass'; actor: 'shop'; round: number; shop: AuctionShop; items: string[] }
  | { kind: 'round'; actor: 'rally'; round: number; leaders: Record<string, AuctionShop> }
  | { kind: 'award'; actor: 'rally'; winners: Record<string, { shop: AuctionShop; unit: number; variant: 'older' | null; bundle?: boolean }>; extras: string[]; domestic: Partial<Record<AuctionShop, number>> }
  | { kind: 'error'; actor?: 'rally'; shop?: AuctionShop }
  | { kind: 'done' }
);

export type Lane = { shop: AuctionShop; price: number | null; passed: boolean; perks: Perk[]; bidAt: number; leading: boolean; won: boolean; lost: boolean };
export type ItemState = { id: string; bestListed: number; lanes: Lane[]; winner: AuctionShop | null };
export type FeedLine = { t: number; who: 'rally' | AuctionShop; text: string };
export type AuctionState = {
  started: boolean; round: number; elapsed: number; maximum: number; total: number; done: boolean; awarded: boolean;
  items: Record<string, ItemState>; feed: FeedLine[]; applied: string[];
};

export function isAuction(events: { kind: string; v?: number }[]): boolean {
  return events[0]?.kind === 'start' && events[0]?.v === 3;
}

export function initialAuction(maximum: number): AuctionState {
  return { started: false, round: 0, elapsed: 0, maximum, total: maximum, done: false, awarded: false, items: {}, feed: [], applied: [] };
}

// Contract: idempotent by event id; throws if an event total exceeds `maximum` (the PayPal hold);
// leaders follow the latest `round` event, winners follow `award`.
export function applyAuctionEvent(previous: AuctionState, event: AuctionEvent): AuctionState {
  if (previous.applied.includes(event.id)) return previous;
  if (event.total !== undefined && (!Number.isSafeInteger(event.total) || event.total < 0 || event.total > previous.maximum)) throw new Error('Event total exceeds checkout');
  const next = structuredClone(previous);
  next.applied.push(event.id); next.elapsed = event.t;
  if (event.total !== undefined) next.total = event.total;
  if ('round' in event) next.round = event.round;
  if (event.note && ['bid', 'ask', 'round', 'award'].includes(event.kind)) next.feed.push({ t: event.t, who: 'shop' in event && event.shop ? event.shop : 'rally', text: event.note });
  if (event.kind === 'start') {
    if (previous.started) throw new Error('Bidding already started');
    next.started = true;
    for (const id of event.items) {
      const listed = event.listed[id];
      const prices = Object.values(listed);
      if (!prices.length || prices.some(price => !Number.isSafeInteger(price) || price! <= 0)) throw new Error('Invalid listed price');
      next.items[id] = { id, bestListed: Math.min(...prices as number[]), winner: null, lanes: event.shops[id].map(shop => ({ shop, price: listed[shop] ?? null, passed: false, perks: [], bidAt: -1, leading: false, won: false, lost: false })) };
    }
  } else if (event.kind === 'bid') {
    for (const [key, price] of Object.entries(event.items)) {
      const id = key.split(':')[0], lane = next.items[id]?.lanes.find(lane => lane.shop === event.shop);
      if (!lane || !Number.isSafeInteger(price) || price <= 0 || price > (lane.price ?? Infinity)) throw new Error('Invalid shop price');
      lane.price = price; lane.passed = false; lane.bidAt = event.seq;
      lane.perks = [...new Set([...lane.perks, ...(event.perks[id] || [])])];
    }
  } else if (event.kind === 'pass') {
    for (const id of event.items) {
      const lane = next.items[id]?.lanes.find(lane => lane.shop === event.shop);
      if (!lane) throw new Error('Unknown lane');
      lane.passed = true;
    }
  } else if (event.kind === 'round') {
    for (const [id, shop] of Object.entries(event.leaders)) {
      if (!next.items[id]?.lanes.some(lane => lane.shop === shop)) throw new Error('Unknown leader');
      for (const lane of next.items[id].lanes) lane.leading = lane.shop === shop;
    }
  } else if (event.kind === 'award') {
    if (Object.keys(event.winners).length !== Object.keys(next.items).length) throw new Error('Incomplete award');
    next.awarded = true;
    for (const [id, winner] of Object.entries(event.winners)) {
      const item = next.items[id];
      if (!item?.lanes.some(lane => lane.shop === winner.shop)) throw new Error('Unknown winner');
      item.winner = winner.shop;
      for (const lane of item.lanes) {
        lane.won = lane.shop === winner.shop; lane.lost = !lane.won; lane.leading = lane.won;
        if (lane.won) {
          lane.perks = winner.bundle ? ['bundle'] : [];
          lane.passed = false;
          lane.price = winner.unit;
          if (winner.variant === 'older' && !lane.perks.includes('older')) lane.perks.push('older');
          if (event.extras.some(extra => extra.startsWith(lane.shop)) && !lane.perks.includes('kit')) lane.perks.push('kit');
          if (event.domestic[lane.shop] === 0 && !lane.perks.includes('freeship')) lane.perks.push('freeship');
        }
      }
    }
  } else if (event.kind === 'done') next.done = true;
  return next;
}
