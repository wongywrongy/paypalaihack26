import { z } from 'zod';
import { CLIPS, type ClipName } from './timeline.ts';

const minor = z.number().int().nonnegative();
const shop = z.enum(['haneul', 'bada', 'dalbit']);
export const SHOP_NAMES = { haneul: 'Haneul Beauty', bada: 'Bada Market', dalbit: 'Dalbit Official' } as const;
// How narration and the board's price chips name a shop.
export const SHORT_NAMES = { haneul: 'Haneul', bada: 'Bada', dalbit: 'Dalbit' } as const;
const currency = z.enum(['USD', 'CAD', 'GBP', 'EUR', 'AUD']);

const redact = z.object({
  clip: z.enum(Object.keys(CLIPS) as [ClipName, ...ClipName[]]),
  from: z.number().nonnegative(),
  to: z.number().positive(),
  rect: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
  // blur for logos; private covers a price with a "Private" pill, so the viewer sees that it is set, never what it is.
  style: z.enum(['blur', 'private']).default('blur'),
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
  // Haneul's goal exactly as typed in clip 03. Its first sentence is quoted beside her lane.
  goal: z.string().min(1),
  redact: z.array(redact),
});

const base = { seq: z.number().int(), t: z.number().nonnegative(), note: z.string().optional(), total: minor.optional(), chosen_by: z.enum(['CODE', 'LLM', 'FIXTURE']).optional() };
const perk = z.enum(['older', 'kit', 'bundle', 'freeship']);
const count = z.number().int().nonnegative();
export const AGENT_COUNTS = z.object({ written: count, options: count, rejected: count, code: count, changed: count });
const event = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('start'), v: z.literal(3), items: z.array(z.string()).min(1), shops: z.record(z.string(), z.array(shop)), listed: z.record(z.string(), z.record(z.string(), minor)) }),
  z.object({ ...base, kind: z.literal('ask'), round: z.number().int(), shop: shop.nullable(), items: z.array(z.string()) }),
  z.object({ ...base, kind: z.literal('bid'), round: z.number().int(), shop, items: z.record(z.string(), minor), bundle: z.object({ items: z.array(z.string()), price: minor }).nullable(), perks: z.record(z.string(), z.array(perk)), authored: z.enum(['agent', 'option', 'code']) }),
  // The agent's own bid failed a check. Its terms are never saved; the shop's best valid bid follows.
  z.object({ ...base, kind: z.literal('rejected'), round: z.number().int(), shop, reason: z.enum(['limit', 'raise', 'rules', 'invalid']) }),
  z.object({ ...base, kind: z.literal('pass'), round: z.number().int(), shop, items: z.array(z.string()) }),
  z.object({ ...base, kind: z.literal('round'), round: z.number().int(), leaders: z.unknown() }),
  z.object({ ...base, kind: z.literal('award'), winners: z.record(z.string(), z.object({ shop, unit: minor })), extras: z.array(z.string()), domestic: z.unknown(), agents: AGENT_COUNTS }),
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

// The shopper's side of the same order (/api/orders/{id}): what was charged, line by line and term by term.
export const ReceiptSchema = z.object({
  breakdown: z.object({ currency, goods: minor, domestic: minor, shipping: minor, duty: minor, tax: minor, fee: minor, total: minor }),
  lines: z.array(z.object({ id: z.string().min(1), shop, unit: minor })).min(1),
});

export type Run = z.infer<typeof RunSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

export function parse<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const lines = result.error.issues.map(issue => `  ${issue.path.join('.') || '(top level)'}: ${issue.message}`);
  throw new Error(`${file} is not valid:\n${lines.join('\n')}`);
}

const SYMBOLS = { USD: '$', CAD: 'C$', GBP: '£', EUR: '€', AUD: 'A$' };
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// Whole numbers below a million in words, for the voice.
export function words(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${UNITS[n % 10]}` : '');
  if (n < 1000) return `${UNITS[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;
  return `${words(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${words(n % 1000)}` : ''}`;
}
// An amount as Kokoro should say it: "ninety-three dollars thirty", "eleven dollars and one cent".
const NAMES = { USD: ['dollar', 'dollars'], CAD: ['Canadian dollar', 'Canadian dollars'], AUD: ['Australian dollar', 'Australian dollars'], GBP: ['pound', 'pounds'], EUR: ['euro', 'euros'] } as const;
export function spokenMoney(value: number, code: keyof typeof SYMBOLS) {
  const major = Math.floor(value / 100), minor = value % 100, unit = NAMES[code][major === 1 ? 0 : 1];
  const whole = `${words(major)} ${unit}`;
  if (!minor) return whole;
  return minor < 10 ? `${whole} and ${words(minor)} ${minor === 1 ? 'cent' : 'cents'}` : `${whole} ${words(minor)}`;
}
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

// The board adds the winning prices and the rest of the bill up to the charged total, so they must add up exactly.
export function receiptCheck(run: Run, receipt: Receipt) {
  const wrong = (message: string) => { throw new Error(`receipt.json does not add up: ${message}`); };
  const b = receipt.breakdown;
  if (b.currency !== run.currency) wrong(`currency ${b.currency} is not ${run.currency}.`);
  if (b.total !== run.charged_minor) wrong(`total ${b.total} is not the charged ${run.charged_minor}.`);
  if (b.goods + b.domestic + b.shipping + b.duty + b.tax + b.fee !== b.total) wrong('its terms do not sum to its total.');
  if (receipt.lines.reduce((sum, line) => sum + line.unit, 0) !== b.goods) wrong('its lines do not sum to goods.');
  const left = JSON.stringify(receipt.lines.map(line => [line.id, line.shop, line.unit]).sort());
  const right = JSON.stringify(Object.entries(run.winners).map(([id, row]) => [id, row.shop, row.unit]).sort());
  if (left !== right) wrong(`its lines ${left} are not the winners ${right}.`);
}

// Each shop's last public price for each item: its listing, lowered by every bid after.
export function finalPrices(order: Order) {
  const start = order.events.find(row => row.kind === 'start');
  const prices: Record<string, Record<string, number>> = {};
  if (start?.kind !== 'start') return prices;
  for (const id of start.items) prices[id] = { ...start.listed[id] };
  for (const row of order.events) if (row.kind === 'bid') for (const [key, unit] of Object.entries(row.items)) {
    const id = key.split(':')[0];
    if (prices[id]?.[row.shop] !== undefined) prices[id][row.shop] = Math.min(prices[id][row.shop], unit);
  }
  return prices;
}

// Refused only by `npm run render`. These prove the footage's story is the one the numbers tell.
export function finalCheck(run: Run, order: Order) {
  const bids = order.events.filter(row => row.kind === 'bid');
  if (order.events.some(row => row.chosen_by === 'FIXTURE')) throw new Error('order.json comes from a fixture run. Record a genuine hosted run.');
  if (!bids.some(row => row.chosen_by === 'LLM')) throw new Error('No bid in order.json was chosen by a model, so the narration would be false.');
  const award = order.events.find(row => row.kind === 'award');
  if (award?.kind === 'award' && award.agents.written === 0) throw new Error('No shop agent wrote its own bid in this order. The video tells that story, so record a run where one did.');
  if (order.payment_state !== 'CHARGED') throw new Error(`Order payment_state is ${order.payment_state}, not CHARGED.`);
  if (run.payout_status !== 'completed') throw new Error(`payout_status is ${run.payout_status}, not completed. Clip 08 must reach Paid.`);
}

// Plain words for a rejection, from backend REASONS.
const REASONS = { limit: 'goes below what its shop can accept', raise: 'raises a price its shop already offered', rules: 'breaks a rule its owner set', invalid: "asks for something its shop doesn't allow" };
type Bid = Extract<Order['events'][number], { kind: 'bid' }>;
const firstSentence = (text: string) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;

export function buildFacts(run: Run, order: Order, receipt: Receipt, names: Record<string, string> = {}) {
  const cash = (value: number) => money(value, run.currency), say = (value: number) => spokenMoney(value, run.currency);
  // "Low-pH Gel Cleanser" is "cleanser" in a sentence.
  const kind = (id: string) => (names[id] ?? id).split(/[\s-]+/).at(-1)!.toLowerCase();
  const start = order.events.find(row => row.kind === 'start');
  const award = order.events.find(row => row.kind === 'award');
  if (!start || start.kind !== 'start' || !award || award.kind !== 'award') throw new Error('order.json needs a start and an award event.');
  const won = (id: string) => Object.values(run.winners).filter(row => row.shop === id).length;
  const payoutShop = SHOP_NAMES[run.payout_shop];
  const rounds = Math.max(0, ...order.events.map(row => row.kind === 'round' ? row.round : 0));
  const boxShops = new Set(Object.values(run.winners).map(row => row.shop)).size;
  const released = run.held_minor - run.charged_minor;
  const { written, options, code, rejected } = award.agents;
  const bids = written + options + code;
  const rejections = order.events.filter(row => row.kind === 'rejected');
  if (rejections.length !== rejected) throw new Error(`order.json has ${rejections.length} rejected events but the award counts ${rejected}.`);
  const reject = rejections[0]?.kind === 'rejected' ? rejections[0] : null;
  const allBids = order.events.filter((row): row is Bid => row.kind === 'bid');
  const agentBid = allBids.find(row => row.authored === 'agent');
  // Haneul's last bid that carries what her goal asked for: a bundle or free shipping in Korea.
  const asked = [...allBids].reverse().find(row => row.shop === 'haneul' && Object.values(row.perks).some(perks => perks.includes('bundle')));
  const has = (perk: string) => !!asked && Object.values(asked.perks).some(perks => perks.includes(perk as never));
  const terms = ['a two-item bundle', has('freeship') && 'free shipping in Korea'].filter(Boolean).join(' with ');
  // A winner that is not the lowest single price in its row: the whole box, not the item, decides.
  const prices = finalPrices(order);
  const undercut = Object.entries(run.winners).map(([id, row]) => {
    const cheaper = Object.entries(prices[id] ?? {}).filter(([shop, unit]) => shop !== row.shop && unit < row.unit).sort((a, b) => a[1] - b[1])[0];
    return cheaper && { id, winner: row.shop, cheaper: cheaper[0] as keyof typeof SHORT_NAMES };
  }).find(Boolean);
  // The winner's own last bid says whether that item went as part of a bundle.
  const bundled = undercut && [...allBids].reverse().find(row => row.shop === undercut.winner)?.perks[undercut.id]?.includes('bundle');
  const listed = start.listed as Record<string, Record<string, number>>;
  const compare = start.items.find(id => new Set(Object.values(listed[id] ?? {})).size > 1) ?? start.items[0];
  const sellers = new Set(Object.values(start.shops).flat()).size;
  const why = undercut
    ? bundled ? `${SHORT_NAMES[undercut.cheaper]}'s ${kind(undercut.id)} was cheaper alone, but ${SHORT_NAMES[undercut.winner]}'s bundle made the whole box cheaper.` : 'Rally picks the cheapest whole box, not the cheapest single item.'
    : 'The cheapest whole box wins.';
  const extras = receipt.breakdown.total - receipt.breakdown.goods;
  const haneulWon = won('haneul');
  return {
    held: cash(run.held_minor),
    held_say: say(run.held_minor),
    charged: cash(run.charged_minor),
    released: cash(released),
    payout: money(run.payout_usd_cents, 'USD'),
    payout_say: spokenMoney(run.payout_usd_cents, 'USD'),
    payout_shop: payoutShop,
    rounds: String(rounds),
    rounds_words: words(rounds),
    item_count_words: words(start.items.length),
    shop_count_words: words(sellers),
    compare_item: kind(compare),
    box_shops: String(boxShops),
    goal_quote: firstSentence(run.goal),
    reject_line: reject ? `${SHORT_NAMES[reject.shop]}'s agent ${REASONS[reject.reason]}. Rally's checks throw it out.` : '',
    haneul_line: asked ? `Haneul's ${asked.authored === 'code' ? 'bid' : 'agent'} does what she asked: ${terms.split(' with ')[0]}.` : '',
    // Shown only when agents wrote at least half the bids; a small share undercuts the scene without adding to it.
    agent_line: written * 2 >= bids ? `Shop agents wrote ${written} of ${bids} ${bids === 1 ? 'bid' : 'bids'}${rejected ? ` · Rally's checks rejected ${rejected}` : ''}.` : '',
    why_line: `${why} Final price: ${cash(run.charged_minor)}.`,
    why_say: `${why} Final price: ${say(run.charged_minor)}.`,
    why_shown: undercut ? 'yes' : '',
    items_total: cash(receipt.breakdown.goods),
    extras_total: cash(extras),
    capture_line: released ? `PayPal charges that and releases the other ${cash(released)}.` : `PayPal charges ${cash(run.charged_minor)}, exactly the hold.`,
    capture_say: released ? `PayPal charges that and releases the other ${say(released)}.` : `PayPal charges ${say(run.charged_minor)}, exactly the hold.`,
    box_line: `One box from ${words(boxShops)} ${boxShops === 1 ? 'shop' : 'shops'}, duties already paid.`,
    handoff_line: haneulWon
      ? `Haneul hands her ${words(haneulWon)} items to the Seoul hub,`
      : `Haneul was outbid. ${payoutShop} hands its items to the Seoul hub,`,
  };
}
