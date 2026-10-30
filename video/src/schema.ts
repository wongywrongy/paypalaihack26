import { z } from 'zod';
import { CLIPS, type ClipName } from './timeline.ts';

const minor = z.number().int().nonnegative();
const shop = z.enum(['haneul', 'bada', 'dalbit']);
export const SHOP_NAMES = { haneul: 'Haneul Beauty', bada: 'Bada Market', dalbit: 'Dalbit Official' } as const;
const currency = z.enum(['USD', 'CAD', 'GBP', 'EUR', 'AUD']);

const redact = z.object({
  clip: z.enum(Object.keys(CLIPS) as [ClipName, ...ClipName[]]),
  from: z.number().nonnegative(),
  to: z.number().positive(),
  rect: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
}).refine(value => value.to > value.from, 'to must be after from');

export const RunSchema = z.object({
  order_id: z.string().min(1),
  currency,
  held_minor: minor,
  charged_minor: minor,
  payout_usd_cents: minor,
  payout_status: z.string().min(1),
  payout_shop: shop,
  winners: z.record(z.string(), z.object({ shop, unit: minor })),
  redact: z.array(redact),
});

const base = { seq: z.number().int(), t: z.number().nonnegative(), note: z.string().optional(), total: minor.optional(), chosen_by: z.enum(['CODE', 'LLM', 'FIXTURE']).optional() };
const perk = z.enum(['older', 'kit', 'bundle', 'freeship']);
const event = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('start'), v: z.literal(3), items: z.array(z.string()).min(1), shops: z.record(z.string(), z.array(shop)), listed: z.record(z.string(), z.record(z.string(), minor)) }),
  z.object({ ...base, kind: z.literal('ask'), round: z.number().int(), shop: shop.nullable(), items: z.array(z.string()) }),
  z.object({ ...base, kind: z.literal('bid'), round: z.number().int(), shop, items: z.record(z.string(), minor), bundle: z.object({ items: z.array(z.string()), price: minor }).nullable(), perks: z.record(z.string(), z.array(perk)) }),
  z.object({ ...base, kind: z.literal('pass'), round: z.number().int(), shop, items: z.array(z.string()) }),
  z.object({ ...base, kind: z.literal('round'), round: z.number().int(), leaders: z.unknown() }),
  z.object({ ...base, kind: z.literal('award'), winners: z.record(z.string(), z.object({ shop, unit: minor })), extras: z.array(z.string()), domestic: z.unknown() }),
  z.object({ ...base, kind: z.literal('error'), shop: shop.optional() }),
  z.object({ ...base, kind: z.literal('done') }),
]);

// One element of /api/shops/haneul/orders. Parsing drops the private `lowest` map and `gain_minor`.
export const OrderSchema = z.object({
  id: z.string().min(1),
  currency,
  payment_state: z.string().min(1),
  maximum_minor: minor,
  events: z.array(event).min(1),
  payout: z.object({ status: z.string().min(1), amount_minor: minor, currency: z.literal('USD') }),
});

export type Run = z.infer<typeof RunSchema>;
export type Order = z.infer<typeof OrderSchema>;

export function parse<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const lines = result.error.issues.map(issue => `  ${issue.path.join('.') || '(top level)'}: ${issue.message}`);
  throw new Error(`${file} is not valid:\n${lines.join('\n')}`);
}

const SYMBOLS = { USD: '$', CAD: 'C$', GBP: '£', EUR: '€', AUD: 'A$' };
export const money = (value: number, code: keyof typeof SYMBOLS) => SYMBOLS[code] + (value / 100).toFixed(2);

// run.json is typed by hand, so everything that can be is checked against the saved order.
export function crossCheck(run: Run, order: Order) {
  const wrong = (message: string) => { throw new Error(`run.json and order.json disagree: ${message}`); };
  if (run.order_id !== order.id) wrong(`order_id ${run.order_id} is not ${order.id}. Save both files from the same order.`);
  if (run.currency !== order.currency) wrong(`currency ${run.currency} is not ${order.currency}.`);
  if (run.held_minor !== order.maximum_minor) wrong(`held_minor ${run.held_minor} is not maximum_minor ${order.maximum_minor}.`);
  if (run.charged_minor > run.held_minor) wrong(`charged_minor ${run.charged_minor} is above held_minor ${run.held_minor}.`);
  const award = order.events.find(row => row.kind === 'award');
  if (!award || award.kind !== 'award') return wrong('order.json has no award event.');
  if (order.events[0].kind !== 'start') wrong('the first event is not start. This is not a bidding order.');
  if (award.total !== run.charged_minor) wrong(`charged_minor ${run.charged_minor} is not the award total ${award.total}.`);
  const left = JSON.stringify(Object.entries(run.winners).map(([id, row]) => [id, row.shop, row.unit]).sort());
  const right = JSON.stringify(Object.entries(award.winners).map(([id, row]) => [id, row.shop, row.unit]).sort());
  if (left !== right) wrong(`winners do not match the award: ${left} is not ${right}.`);
  if (!Object.values(run.winners).some(row => row.shop === run.payout_shop)) wrong(`payout_shop ${run.payout_shop} won no items.`);
  if (run.payout_shop === 'haneul' && (order.payout.amount_minor !== run.payout_usd_cents || order.payout.status !== run.payout_status)) wrong(`Haneul's payout is ${order.payout.amount_minor} ${order.payout.status} in order.json.`);
  for (const row of order.events) if (row.total !== undefined && row.total > run.held_minor) wrong(`event ${row.seq} total is above the hold.`);
}

// Refused only by `npm run render`. These prove the footage's story is the one the numbers tell.
export function finalCheck(run: Run, order: Order) {
  const bids = order.events.filter(row => row.kind === 'bid');
  if (order.events.some(row => row.chosen_by === 'FIXTURE')) throw new Error('order.json comes from a fixture run. Record a genuine hosted run.');
  if (!bids.some(row => row.chosen_by === 'LLM')) throw new Error('No bid in order.json was chosen by a model, so the narration would be false.');
  if (order.payment_state !== 'CHARGED') throw new Error(`Order payment_state is ${order.payment_state}, not CHARGED.`);
  if (run.payout_status !== 'completed') throw new Error(`payout_status is ${run.payout_status}, not completed. Clip 08 must reach Paid.`);
}

export function buildFacts(run: Run, order: Order, names: Record<string, string>) {
  const cash = (value: number) => money(value, run.currency);
  const start = order.events.find(row => row.kind === 'start');
  const items = start?.kind === 'start' ? start.items : [];
  const won = (id: string) => Object.values(run.winners).filter(row => row.shop === id).length;
  const payoutShop = SHOP_NAMES[run.payout_shop];
  const count = Object.keys(run.winners).length;
  const shops = new Set(order.events.flatMap(row => row.kind === 'bid' ? [row.shop] : []));
  const rounds = Math.max(0, ...order.events.map(row => row.kind === 'round' ? row.round : 0));
  return {
    held: cash(run.held_minor),
    charged: cash(run.charged_minor),
    released: cash(run.held_minor - run.charged_minor),
    payout: money(run.payout_usd_cents, 'USD'),
    payout_shop: payoutShop,
    rounds: String(rounds),
    shop_count: String(shops.size),
    items: items.length <= 2 ? items.map(id => names[id]).join(' and ') : `${items.length} products`,
    result_line: run.charged_minor < run.held_minor
      ? `Lowest complete delivered total wins: ${cash(run.charged_minor)}, down from ${cash(run.held_minor)}.`
      : `No bid beat the checkout total, so ${cash(run.held_minor)} stands.`,
    shop_result: won('haneul')
      ? `${payoutShop} won ${won(run.payout_shop)} of ${count} items and hands off its parcel.`
      : `Haneul Beauty was outbid this time. ${payoutShop} won ${won(run.payout_shop)} of ${count} items and hands off its parcel.`,
  };
}
