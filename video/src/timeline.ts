// The one place to re-time the video. Seconds. Cue, shot and callout `at` values are relative to their scene.
// {name} in a text is filled from run.json and order.json (see buildFacts in schema.ts).
export const FPS = 30;
export const MAX_SECONDS = 175;

export const CLIPS = {
  '01-home-guide': 'Home: "Get your first Rally payout", 0 of 5',
  '02-products-edit': "Products: Cica Barrier Cream's lowest price edited, saved",
  '03-agent-goal': 'Agent: suggestion, Review rules, From your goal, Apply',
  '04-storefront-bag': 'Open your storefront, cleanser + cream, Total, all in',
  '05-paypal-hold': 'PayPal sandbox approval',
  '06-bidding': 'The full live bidding board, start to award',
  '07-receipt': 'Receipt: One box from N shops, Duties included, Your shop bid on this order',
  '08-handoff-payout': 'Hand off in Rally for shops, Record hand-off, Won · Handed off · Payout sent · Paid',
  '09-home-done': 'Home at 5 of 5',
} as const;
export type ClipName = keyof typeof CLIPS;

export type Cue = { at: number; dur: number; text: string };
// x/y: the UI point the line lands on. px/py: the pill's centre. Fractions of the clip; set them against real footage.
export type Callout = { at: number; dur: number; text: string; x: number; y: number; px: number; py: number };
// fit: stretch the clip to the shot's full length. Otherwise a short clip holds its last frame.
export type Shot = { clip: ClipName; at: number; dur: number; layout?: 'tiles'; fit?: boolean };
export type Scene = {
  id: string;
  criterion: string;
  chapter?: string;
  start: number;
  duration: number;
  cues: Cue[];
  shots?: Shot[];
  callouts?: Callout[];
  ribbon?: { done: number[]; ticks: { step: number; at: number }[] };
  band?: { at: number; dur: number; text: string };
};

// Word for word from frontend/src/routes/shops/Home.tsx. test/video.test.ts fails if they drift.
export const STEPS = ['Set your prices', 'Give your agent a goal', 'Win a Rally order', 'Hand off the parcel', 'Get paid by PayPal'];

export const SCENES: Scene[] = [
  {
    id: 'problem', criterion: 'impact', start: 0, duration: 12,
    cues: [
      { at: 0.3, dur: 6.5, text: 'Three Korean shops means three checkouts, three parcels and three customs bills.' },
      { at: 7, dur: 4.8, text: 'Many shops never ship abroad, and import fees can surprise you at the door.' },
    ],
  },
  {
    id: 'title', criterion: 'presentation', start: 12, duration: 6,
    cues: [{ at: 0.3, dur: 5.4, text: 'Rally turns them into one checkout. Korean shops compete for your order.' }],
  },
  {
    id: 'shop', criterion: 'innovation, design', chapter: 'The shop side', start: 18, duration: 30,
    shots: [
      { clip: '01-home-guide', at: 0, dur: 7 },
      { clip: '02-products-edit', at: 7, dur: 11 },
      { clip: '03-agent-goal', at: 18, dur: 12 },
    ],
    callouts: [
      { at: 9, dur: 8.5, text: 'Private lowest price: hidden from models', x: 0.592, y: 0.333, px: 0.72, py: 0.09 },
      { at: 19, dur: 5, text: 'Plain words → bounded rules', x: 0.722, y: 0.342, px: 0.72, py: 0.085 },
      { at: 24.5, dur: 5, text: 'Nothing applies until Apply', x: 0.884, y: 0.814, px: 0.62, py: 0.925 },
    ],
    ribbon: { done: [], ticks: [{ step: 1, at: 17 }, { step: 2, at: 29 }] },
    cues: [
      { at: 0.2, dur: 6.6, text: "I'm Haneul Beauty, a Seoul shop. Rally walks me through five steps to my first payout." },
      { at: 7, dur: 5.8, text: 'In Products, an AG Grid sheet, I edit my lowest price and save.' },
      { at: 13, dur: 4.8, text: 'My lowest price is private: no shopper, shop or model sees it.' },
      { at: 18, dur: 5.8, text: 'On Agent, I say what I want in plain words and press Review rules.' },
      { at: 24, dur: 5.8, text: 'A model writes bounded rules, marked From your goal. Nothing applies until I press Apply.' },
    ],
  },
  {
    id: 'shopper', criterion: 'design, PayPal', chapter: 'The shopper side', start: 48, duration: 18,
    shots: [
      { clip: '04-storefront-bag', at: 0, dur: 11 },
      { clip: '05-paypal-hold', at: 11, dur: 7 },
    ],
    callouts: [{ at: 6, dur: 4.8, text: 'All-in: shipping, duty, tax', x: 0.575, y: 0.575, px: 0.17, py: 0.68 }],
    ribbon: { done: [1, 2], ticks: [] },
    band: { at: 11.4, dur: 6.4, text: 'PayPal authorizes {held} — a hard ceiling. Shops can only bid it down.' },
    cues: [
      { at: 0.2, dur: 5.6, text: 'I press Open your storefront. Now I am the shopper, with {item_count} in my bag.' },
      { at: 6, dur: 4.8, text: 'One price for everything, delivered, duties included.' },
      { at: 11, dur: 6.8, text: 'PayPal holds {held}. That total is the ceiling. The agents can only bid it down.' },
    ],
  },
  {
    id: 'bidding', criterion: 'innovation, tech', chapter: 'Agentic bidding', start: 66, duration: 40,
    shots: [{ clip: '06-bidding', at: 0, dur: 40, fit: true }],
    ribbon: { done: [1, 2], ticks: [] },
    cues: [
      { at: 0.2, dur: 6.6, text: 'Every shop that stocks an item now bids for it, over {rounds} open rounds.' },
      { at: 7, dur: 6.8, text: 'Each round, a buyer agent asks for better terms and {shop_count} shop agents answer.' },
      { at: 14, dur: 6.8, text: 'Models choose among code-built options. Code awards the order.' },
      { at: 21, dur: 6.8, text: 'A shop can win on price, a bundle, free shipping in Korea or older packaging.' },
      { at: 28, dur: 5.8, text: "Code checks every bid against each shop's private limits, live stock and the hold." },
      { at: 34, dur: 5.8, text: '{result_line}' },
    ],
  },
  {
    id: 'money', criterion: 'PayPal, impact', chapter: 'Money and fulfillment', start: 106, duration: 22,
    shots: [
      { clip: '07-receipt', at: 0, dur: 9, layout: 'tiles' },
      { clip: '08-handoff-payout', at: 9, dur: 9 },
      { clip: '09-home-done', at: 18, dur: 4 },
    ],
    callouts: [{ at: 14.2, dur: 3.6, text: 'PayPal payout to the shop', x: 0.84, y: 0.37, px: 0.62, py: 0.075 }],
    ribbon: { done: [1, 2], ticks: [{ step: 3, at: 2 }, { step: 4, at: 12 }, { step: 5, at: 17 }] },
    cues: [
      { at: 0.2, dur: 4.2, text: '{capture_line}' },
      { at: 4.6, dur: 4.3, text: '{receipt_line}' },
      { at: 9, dur: 4.8, text: '{shop_result}' },
      { at: 13.9, dur: 3.9, text: 'PayPal pays {payout_shop} {payout}.' },
      { at: 18, dur: 3.9, text: "Price, goal, order, hand-off, payout. That's the whole loop." },
    ],
  },
  {
    id: 'hood', criterion: 'tech', start: 128, duration: 25,
    cues: [
      { at: 0.2, dur: 5.2, text: 'A PayPal approval becomes an Orders v2 authorization in FastAPI.' },
      { at: 5.6, dur: 5.2, text: 'A worker runs the auction, with every PayPal step in an idempotent ledger.' },
      { at: 11, dur: 5.2, text: 'Bitdeer models pick only candidate indexes. Code makes the award.' },
      { at: 16.2, dur: 4.6, text: 'Capture stays within the hold, Payouts pay shops, webhooks reconcile.' },
      { at: 21, dur: 3.9, text: 'Models propose. Code decides. PayPal moves the money.' },
    ],
  },
  {
    id: 'close', criterion: 'impact, presentation', start: 153, duration: 17,
    cues: [
      { at: 0.2, dur: 5.6, text: 'Korean cosmetics exports hit a record, and small shops are moving online.' },
      { at: 6, dur: 4.8, text: 'Rally works for any multi-merchant, cross-border cart.' },
      { at: 11, dur: 5.8, text: 'Rally. Korean skincare, one box, your currency. Open source, MIT licensed.' },
    ],
  },
];

export const totalSeconds = () => Math.max(...SCENES.map(scene => scene.start + scene.duration));

export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, name) => {
    if (!(name in vars)) throw new Error(`timeline.ts uses {${name}}, which run.json and order.json do not provide.`);
    return vars[name];
  });
}

export const allCues = () => SCENES.flatMap(scene => scene.cues.map(cue => ({ ...cue, start: scene.start + cue.at, scene: scene.id })));

const stamp = (seconds: number, sep: string) => {
  const ms = Math.round(seconds * 1000), pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
};

export const toSrt = (vars: Record<string, string>) =>
  allCues().map((cue, i) => `${i + 1}\n${stamp(cue.start, ',')} --> ${stamp(cue.start + cue.dur, ',')}\n${fill(cue.text, vars)}\n`).join('\n');

export const toScript = () =>
  ['# Rally video narration', '', 'Generated from src/timeline.ts: edit cues and timings there. {name} is filled from the run data.', ''].concat(
    SCENES.flatMap(scene => [
      `## ${scene.id} (${scene.start}s to ${scene.start + scene.duration}s, ${scene.criterion})`, '',
      ...scene.cues.map(cue => `- ${stamp(scene.start + cue.at, '.').slice(3, 8)} ${cue.text}`), '',
    ])).join('\n');
