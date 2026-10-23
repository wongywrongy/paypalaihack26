import { events, listedLines, cents, hero, type DealEvent, type ShopId } from './fixture';
import type { Order, PublicDealEvent } from './connected';
export type PriceState = { id: string; listed: number; opening?: number; offer?: number; asking: number; agreed: boolean; held: boolean; older: boolean; added: boolean };
export type ShopState = { id: ShopId; status: string; lines: Record<string, PriceState>; message: string; actor: 'rally' | 'shop'; kit: boolean; domesticFree: boolean; accepted: boolean };
export type DealState = { elapsed: number; totalUsd: number; maximum: number; done: boolean; applied: string[]; shops: Partial<Record<ShopId, ShopState>> };
export function initialDeal(lines = listedLines, maximum = cents(hero.hold)): DealState {
  const state: DealState = { elapsed: 0, totalUsd: maximum, maximum, done: false, applied: [], shops: {} };
  for (const line of lines) {
    const shop = state.shops[line.shop] ||= { id: line.shop, status: 'Waiting', lines: {}, message: 'Ready to talk.', actor: 'rally', kit: false, domesticFree: false, accepted: false };
    shop.lines[line.id] = { id: line.id, listed: line.unit, asking: line.unit, agreed: false, held: false, older: false, added: false };
  }
  return state;
}
// The stream and replay share this pure reducer. It has no payment or network capability.
export function applyEvent(previous: DealState, event: DealEvent | PublicDealEvent): DealState {
  if (previous.applied.includes(event.id)) return previous;
  const next = structuredClone(previous);
  next.applied.push(event.id); next.elapsed = event.t;
  if (event.total !== undefined) {
    if (event.total > previous.maximum) throw new Error('Event total exceeds checkout');
    next.totalUsd = event.total;
  }
  if (event.kind === 'done') { next.done = true; return next; }
  if (event.kind === 'error' && !event.shop) return next;
  if (!event.shop || !next.shops[event.shop]) throw new Error('Unknown shop event');
  const shop = next.shops[event.shop]!;
  shop.actor = event.actor!; shop.message = event.note || shop.message;
  shop.status = event.kind === 'decline' ? 'Keeping checkout prices' : event.kind === 'error' ? 'Keeping checkout prices' : event.kind === 'accept' ? 'Deal agreed' : event.final ? 'Final offer' : event.kind === 'offer' ? 'Offer sent' : event.shop === 'bada' ? 'Holding prices' : 'Countered';
  if (event.actor === 'shop' && event.extras?.includes('dalbit-sample-kit')) shop.kit = true;
  if (event.domestic === 0) shop.domesticFree = true;
  for (const [key, unit] of Object.entries(event.lines || {})) {
    const [id, variant] = key.split(':');
    const line = shop.lines[id] ||= { id, listed: unit, asking: unit, agreed: false, held: false, older: false, added: true };
    line.older = variant === 'older';
    if (event.actor === 'rally') { line.opening ??= unit; line.offer = unit; }
    else { line.asking = unit; line.held = event.shop === 'bada' && unit === line.listed; }
  }
  if (event.kind === 'accept') {
    shop.accepted = true;
    if (event.extras) shop.kit = event.extras.includes('dalbit-sample-kit');
    if (event.lines && Object.keys(event.lines).length) {
      const acceptedIds = new Set(Object.keys(event.lines).map(id => id.split(':')[0]));
      for (const id of Object.keys(shop.lines)) if (!acceptedIds.has(id)) delete shop.lines[id];
    }
    for (const line of Object.values(shop.lines)) {
      // Acceptance uses the last counter, or the last proposal for a shop-side acceptance.
      const eventPrice = event.lines?.[line.id + (line.older ? ':older' : '')];
      const accepted = eventPrice ?? (event.actor === 'shop' ? line.offer ?? line.asking : line.asking);
      line.offer = accepted; line.asking = accepted; line.agreed = true;
    }
  }
  return next;
}
export function reconcileDeal(state: DealState, order: Pick<Order, 'lines' | 'extras' | 'events'> & { checkout: Pick<Order['checkout'], 'lines'>; breakdown?: Pick<Order['breakdown'], 'total'> }): DealState {
  const shown = Object.values(state.shops).flatMap(shop => Object.values(shop.lines));
  const mismatched = shown.length !== order.lines.length || order.lines.some(line => {
    const visible = state.shops[line.shop]?.lines[line.id];
    return !visible || visible.asking !== line.unit || visible.older !== (line.variant === 'older');
  });
  if (!state.done || !mismatched && !order.events.some(event => event.kind === 'error')) return state;
  const next: DealState = { ...state, totalUsd: order.breakdown?.total ?? state.totalUsd, shops: {} };
  for (const line of order.lines) {
    const original = order.checkout.lines.find(item => item.id === line.id && item.shop === line.shop);
    const listed = original?.unit ?? line.unit;
    const shop = next.shops[line.shop] ||= { id: line.shop, status: 'Saved order confirmed', lines: {}, message: 'The saved order terms are shown here.', actor: 'rally', kit: line.shop === 'dalbit' && !!order.extras?.includes('dalbit-sample-kit'), domesticFree: false, accepted: true };
    shop.lines[line.id] = { id: line.id, listed, asking: line.unit, offer: line.unit, agreed: true, held: line.unit === listed, older: line.variant === 'older', added: !!line.added || !original };
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
