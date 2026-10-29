import type { Breakdown, CountryCode, Currency, DealEvent, Line, Product, Rules, ShopId } from './fixture';

export type Destination = { code: CountryCode; name: string; currency: Currency; region: string | null; summary: string };
export type CatalogProduct = Product & { price: number | null; currency: Currency; available: boolean };
export type PublicShop = { name: string; city: string; kind: string; ships_abroad: boolean };
export type CatalogResponse = { products: CatalogProduct[]; shops: Record<ShopId, PublicShop>; prices_currency: 'USD' };
export type Quote = { id: string; country: CountryCode; currency: Currency; lines: Line[]; breakdown: Breakdown; expires_at: string };
export type ServerBag = { id: string; quote: Quote };
export type Checkout = { paypal_order_id: string; approval_url: string; client_id: string; currency: Currency; order_id: string };
export type PublicDealEvent = Omit<DealEvent, 'kind'> & { seq: number; kind: DealEvent['kind'] | 'decline' | 'error' | 'start' | 'ask' | 'bid' | 'pass' | 'round' | 'award'; v?: 3 };
export type TrackingStep = { title: string; note: string; complete: boolean; current?: boolean; tracking?: string; carrier?: string };
export type Order = {
  id: string; bag_id?: string; country: CountryCode; state: string; currency: Currency; maximum_minor: number;
  charged_minor: number | null; uncaptured_minor: number; payment_state: string; fulfillment_state: string;
  checkout: Quote; lines: Line[]; breakdown: Breakdown; events: PublicDealEvent[]; tracking: TrackingStep[];
  ship_by?: string; saved_vs_direct_minor?: number;
  refunded_minor?: number; refund_pending_minor?: number;
  extras?: string[];
  auction?: { rounds: number; winners: Record<string, { shop: ShopId; unit: number; variant: string | null }> };
};
export type Routine = { request: string; items: { id: string; reason: string; step: string; shop: ShopId }[]; quote: Quote };
export type Session = { csrf_token: string; paypal_client_id: string; role?: 'shop' | 'hub' | null; shop_id?: ShopId; read_only?: boolean };

export const apiUrl = (path: string) => (import.meta.env?.VITE_API_URL || '') + '/api' + path;
let session: Promise<Session> | undefined;
export function loadSession(): Promise<Session> {
  return session ||= request<Session>('/session').then(value => {
    if (typeof value.csrf_token !== 'string' || !value.csrf_token) throw new Error('Your session could not load. Refresh this page to try again.');
    return value;
  }).catch(error => { session = undefined; throw error; });
}
export async function request<T>(path: string, options: { body?: unknown; method?: 'POST' | 'PATCH'; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.method) {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = (await loadSession()).csrf_token;
  }
  const response = await fetch(apiUrl(path), {
    method: options.method || 'GET', credentials: 'include', signal: options.signal, headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  }).catch(error => { if (error.name === 'AbortError') throw error; throw new Error('Rally could not be reached. Check your connection and try again.'); });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== 'object') throw new Error(typeof data?.detail === 'string' ? data.detail : 'Rally could not load this page. Please try again.');
  return data;
}
const minor = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export function checkedQuote(quote: Quote): Quote {
  const keys = ['goods', 'domestic', 'shipping', 'duty', 'tax', 'fee'] as const;
  if (!quote || !quote.id || !quote.breakdown || !Array.isArray(quote.lines) || quote.lines.some(line => !minor(line.unit)) || quote.breakdown.currency !== quote.currency || !minor(quote.breakdown.total) || keys.some(key => !minor(quote.breakdown[key])) || keys.reduce((sum, key) => sum + quote.breakdown[key], 0) !== quote.breakdown.total || !Number.isFinite(Date.parse(quote.expires_at))) throw new Error('Rally could not verify this price. Refresh your bag to try again.');
  return quote;
}
export function saveBag(bag: { country: CountryCode; items: string[]; rules: Rules }, signal?: AbortSignal, id?: string) {
  return request<ServerBag>(id ? `/bags/${encodeURIComponent(id)}` : '/bags', { method: id ? 'PATCH' : 'POST', body: bag, signal }).then(value => ({ ...value, quote: checkedQuote(value.quote) }));
}
export function checkedEvent(value: PublicDealEvent, maximum: number): PublicDealEvent {
  if (!value || typeof value.id !== 'string' || !value.id || !Number.isSafeInteger(value.seq) || value.seq < 0 || !Number.isFinite(value.t) || value.t < 0 || !['offer', 'counter', 'accept', 'done', 'decline', 'error', 'start', 'ask', 'bid', 'pass', 'round', 'award'].includes(value.kind) || value.total !== undefined && (!minor(value.total) || value.total > maximum) || value.lines && Object.values(value.lines).some(amount => !minor(amount))) throw new Error('Rally could not read the latest deal update. Reconnect to try again.');
  const event = value as unknown as import('./auction').AuctionEvent;
  if (event.kind === 'start' && (event.v !== 3 || !Array.isArray(event.items) || !event.shops || !event.listed || event.items.some(id => !Array.isArray(event.shops[id]) || !event.shops[id].length || !event.listed[id] || Object.values(event.listed[id]).some(amount => !minor(amount))))) throw new Error('Invalid bidding start. Reload your order.');
  if (event.kind === 'bid' && (!event.shop || !event.items || Array.isArray(event.items) || !event.perks || Object.values(event.items).some(amount => !minor(amount) || amount === 0))) throw new Error('Invalid shop bid. Reload your order.');
  if (event.kind === 'round' && (!event.leaders || !Number.isInteger(event.round) || event.round < 1 || event.round > 3)) throw new Error('Invalid bidding update. Reload your order.');
  if (event.kind === 'award' && (!event.winners || !event.domestic || !Array.isArray(event.extras) || Object.values(event.winners).some(winner => !winner.shop || !minor(winner.unit)))) throw new Error('Invalid bidding award. Reload your order.');
  return value;
}
export function orderHref(path: string, id: string) { return `${path}?order=${encodeURIComponent(id)}`; }
export function selectedOrder() {
  const fromUrl = new URLSearchParams(location.search).get('order');
  if (fromUrl) return fromUrl;
  try { return localStorage.getItem('rally-order-v2'); } catch { return null; }
}
export const paymentComplete = (order: Order) => order.charged_minor !== null && ['CHARGED', 'REFUND_PENDING', 'REFUNDED'].includes(order.payment_state.toUpperCase());
export function rememberOrder(id: string) { try { localStorage.setItem('rally-order-v2', id); } catch { /* The order remains reachable by its URL. */ } }
