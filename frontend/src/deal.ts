import { events, listedLines, cents, hero, type DealEvent, type ShopId } from './fixture';
export type PriceState = { id: string; listed: number; offer?: number; asking: number; agreed: boolean; held: boolean; older: boolean; added: boolean };
export type ShopState = { id: ShopId; status: string; lines: Record<string, PriceState>; message: string; actor: 'rally' | 'shop'; kit: boolean; domesticFree: boolean; accepted: boolean };
export type DealState = { elapsed: number; totalUsd: number; done: boolean; applied: string[]; shops: Partial<Record<ShopId, ShopState>> };
export function initialDeal(): DealState {
  const state: DealState = { elapsed: 0, totalUsd: cents(hero.hold), done: false, applied: [], shops: {} };
  for (const line of listedLines) {
    const shop = state.shops[line.shop] ||= { id: line.shop, status: 'Waiting', lines: {}, message: 'Ready to talk.', actor: 'rally', kit: false, domesticFree: false, accepted: false };
    shop.lines[line.id] = { id: line.id, listed: line.unit, asking: line.unit, agreed: false, held: false, older: false, added: false };
  }
  return state;
}
// The stream and replay share this pure reducer. It has no payment or network capability.
export function applyEvent(previous: DealState, event: DealEvent): DealState {
  if (previous.applied.includes(event.id)) return previous;
  const next = structuredClone(previous);
  next.applied.push(event.id); next.elapsed = event.t;
  if (event.total !== undefined) {
    if (event.total > cents(hero.hold)) throw new Error('Event total exceeds checkout');
    next.totalUsd = event.total;
  }
  if (event.kind === 'done') { next.done = true; return next; }
  if (!event.shop || !next.shops[event.shop]) throw new Error('Unknown shop event');
  const shop = next.shops[event.shop]!;
  shop.actor = event.actor!; shop.message = event.note || shop.message;
  shop.status = event.kind === 'accept' ? 'Deal agreed' : event.final ? 'Final offer' : event.kind === 'offer' ? 'Offer sent' : event.shop === 'bada' ? 'Holding prices' : 'Countered';
  if (event.actor === 'shop' && event.extras?.includes('dalbit-sample-kit')) shop.kit = true;
  if (event.domestic === 0) shop.domesticFree = true;
  for (const [key, unit] of Object.entries(event.lines || {})) {
    const [id, variant] = key.split(':');
    const line = shop.lines[id] ||= { id, listed: unit, asking: unit, agreed: false, held: false, older: false, added: true };
    if (variant === 'older') line.older = true;
    if (event.actor === 'rally') line.offer = unit;
    else { line.asking = unit; line.held = event.shop === 'bada' && unit === line.listed; }
  }
  if (event.kind === 'accept') {
    shop.accepted = true;
    for (const line of Object.values(shop.lines)) {
      // Acceptance uses the last counter, or the last proposal for a shop-side acceptance.
      const accepted = event.actor === 'shop' ? line.offer ?? line.asking : line.asking;
      line.offer = accepted; line.asking = accepted; line.agreed = true;
    }
  }
  return next;
}
export type DealSource = (receive: (event: DealEvent) => void, from?: number) => () => void;
export const recordedDealSource: DealSource = (receive, from = 0) => {
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  function schedule(index: number) {
    if (stopped || index >= events.length) return;
    const delay = Math.max(600, (events[index].t - (index === from ? (from ? events[from - 1].t : 0) : events[index - 1].t)) * 1000);
    timer = setTimeout(() => { if (!stopped) { receive(events[index]); schedule(index + 1); } }, delay);
  }
  schedule(from);
  return () => { stopped = true; clearTimeout(timer); };
};
