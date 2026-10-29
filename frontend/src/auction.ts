// v3 shop bidding view model (docs/plan/BIDDING.md, "Events" and "Frontend").
// Pure reducer shared by the live stream, replay and the shop workspace. No payment or network capability.
// Amounts are shopper-currency minor units, as in the existing deal events.

export type AuctionShop = 'haneul' | 'bada' | 'dalbit';
export type Perk = 'older' | 'kit' | 'bundle' | 'freeship';

export type AuctionEvent = {
  id: string; seq: number; t: number; note?: string; total?: number; chosen_by?: 'CODE' | 'LLM' | 'FIXTURE';
} & (
  | { kind: 'start'; v: 3; items: string[]; shops: Record<string, AuctionShop[]>; listed: Record<string, Partial<Record<AuctionShop, number>>> }
  | { kind: 'ask'; actor: 'rally'; round: number; shop: AuctionShop | null; items: string[] }
  | { kind: 'bid'; actor: 'shop'; round: number; shop: AuctionShop; items: Record<string, number>; bundle: { items: string[]; price: number } | null; perks: Record<string, Perk[]> }
  | { kind: 'pass'; actor: 'shop'; round: number; shop: AuctionShop; items: string[] }
  | { kind: 'round'; actor: 'rally'; round: number; leaders: Record<string, AuctionShop> }
  | { kind: 'award'; actor: 'rally'; winners: Record<string, { shop: AuctionShop; unit: number; variant: 'older' | null }>; extras: string[]; domestic: Partial<Record<AuctionShop, number>> }
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
  throw new Error(`v3 auction reducer not implemented (${event.kind})`);
}
