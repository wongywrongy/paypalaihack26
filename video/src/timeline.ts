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
// A camera push toward `rect`, in clip pixels of a 1440×900 window. at/dur are relative to the shot.
export type Focus = { at: number; dur: number; rect: { x: number; y: number; width: number; height: number } };
// fit: stretch the clip to the shot's full length. Otherwise a short clip holds its last frame.
export type Shot = { clip: ClipName; at: number; dur: number; layout?: 'tiles'; fit?: boolean; focus?: Focus };
export type Scene = {
  id: string;
  criterion: string;
  chapter?: string;
  start: number;
  duration: number;
  // How this scene arrives. Omitted means a hard cut, used where the story jumps sides.
  enter?: 'fade' | 'slide';
  cues: Cue[];
  shots?: Shot[];
  callouts?: Callout[];
  ribbon?: { done: number[]; ticks: { step: number; at: number }[] };
};

// Word for word from frontend/src/routes/shops/Home.tsx. test/video.test.ts fails if they drift.
export const STEPS = ['Set your prices', 'Give your agent a goal', 'Win a Rally order', 'Hand off the parcel', 'Get paid by PayPal'];

// Seconds into the bidding scene where the first rejection lands, so its narration and its picture meet.
export const REJECT_AT = 13.6;

export const SCENES: Scene[] = [
  {
    id: 'problem', criterion: 'impact', start: 0, duration: 12,
    cues: [
      { at: 0.3, dur: 6.2, text: 'Buying from three Korean shops means three checkouts, three parcels and three customs bills.' },
      { at: 6.8, dur: 5, text: "Many don't ship abroad at all, and fees can surprise you at the door." },
    ],
  },
  {
    id: 'promise', criterion: 'presentation', start: 12, duration: 6, enter: 'fade',
    cues: [{ at: 0.3, dur: 5.4, text: 'Rally turns that into one checkout, and the shops compete for your order.' }],
  },
  {
    id: 'shopper', criterion: 'design, PayPal', start: 18, duration: 20, enter: 'slide',
    shots: [
      { clip: '04-storefront-bag', at: 0, dur: 12, focus: { at: 7.6, dur: 4.4, rect: { x: 490, y: 478, width: 460, height: 138 } } },
      { clip: '05-paypal-hold', at: 12, dur: 8, focus: { at: 0.8, dur: 7.2, rect: { x: 820, y: 4, width: 190, height: 60 } } },
    ],
    callouts: [{ at: 6.4, dur: 5, text: 'All in: shipping, duties, tax', x: 0.5, y: 0.608, px: 0.24, py: 0.12 }],
    cues: [
      { at: 0.3, dur: 5.4, text: 'A shopper fills one bag with {item_count} from Korean shops.' },
      { at: 6, dur: 5.6, text: 'One price covers it all: shipping, duties and tax, in their own currency.' },
      { at: 12.2, dur: 7.4, text: "PayPal holds this total. It's the ceiling. The shops can only bid it down." },
    ],
  },
  {
    id: 'bidding', criterion: 'innovation, tech', start: 38, duration: 40, enter: 'fade',
    shots: [{ clip: '06-bidding', at: 0, dur: 40, fit: true }],
    cues: [
      { at: 0.3, dur: 5.6, text: 'Now the shops bid for this order, over {rounds} rounds.' },
      { at: 6.3, dur: 7, text: "Each shop's agent writes its own bid: a lower price, a bundle, free shipping in Korea or a sample kit." },
      { at: REJECT_AT, dur: 6.6, text: '{check_line}' },
      { at: 20.6, dur: 6.4, text: 'The checks test each bid against the private limits, the stock and the hold.' },
      { at: 27.6, dur: 5.4, text: 'Round by round, the total only goes down.' },
      { at: 33.4, dur: 6.2, text: '{result_line}' },
    ],
  },
  {
    id: 'result', criterion: 'PayPal, impact', start: 78, duration: 12, enter: 'fade',
    shots: [{ clip: '07-receipt', at: 0, dur: 12, layout: 'tiles' }],
    cues: [
      { at: 0.3, dur: 6.2, text: '{capture_line}' },
      { at: 6.8, dur: 4.9, text: '{receipt_line}' },
    ],
  },
  {
    id: 'shop', criterion: 'innovation, design', chapter: 'The shop side', start: 90, duration: 28,
    shots: [
      { clip: '01-home-guide', at: 0, dur: 5 },
      { clip: '02-products-edit', at: 5, dur: 9 },
      { clip: '03-agent-goal', at: 14, dur: 14, focus: { at: 4, dur: 6, rect: { x: 830, y: 260, width: 580, height: 140 } } },
    ],
    // Points at the edited cell; its value is blurred, since lowest prices are private.
    callouts: [{ at: 2.6, dur: 6, text: 'Private: no one else sees it', x: 0.59, y: 0.583, px: 0.62, py: 0.2 }],
    ribbon: { done: [], ticks: [{ step: 1, at: 13 }, { step: 2, at: 26 }] },
    cues: [
      { at: 0.3, dur: 4.4, text: 'Behind each shop is a person who set two things.' },
      { at: 5, dur: 6, text: 'At Haneul Beauty, a Seoul shop, the owner first sets a private lowest price.' },
      { at: 11.3, dur: 5.4, text: 'No shopper, other shop or agent ever sees it.' },
      { at: 17.2, dur: 5, text: 'Then a goal in plain words, like winning two-item bundles.' },
      { at: 22.5, dur: 5.3, text: 'Rally turns it into rules, and nothing changes until the owner presses Apply.' },
    ],
  },
  {
    id: 'payout', criterion: 'PayPal, impact', chapter: 'Hand off and get paid', start: 118, duration: 14, enter: 'slide',
    shots: [
      { clip: '08-handoff-payout', at: 0, dur: 10, focus: { at: 5, dur: 5, rect: { x: 1055, y: 265, width: 320, height: 262 } } },
      { clip: '09-home-done', at: 10, dur: 4 },
    ],
    ribbon: { done: [1, 2], ticks: [{ step: 3, at: 0.6 }, { step: 4, at: 5.4 }, { step: 5, at: 10.4 }] },
    cues: [
      { at: 0.3, dur: 5.6, text: '{shop_result}' },
      { at: 6, dur: 5.2, text: 'PayPal pays {payout_shop} {payout} as soon as it hands off.' },
      { at: 11.3, dur: 2.6, text: 'Price, goal, order, hand-off, payout.' },
    ],
  },
  {
    id: 'how', criterion: 'tech', start: 132, duration: 15,
    cues: [
      { at: 0.3, dur: 6, text: "The shopper approves one total. Each shop's agent writes bids that follow its owner's goals." },
      { at: 6.5, dur: 3.2, text: "Rally's checks guard the limits, the stock and the hold." },
      { at: 9.8, dur: 4.8, text: "Agents propose. Rally's checks decide. PayPal moves the money." },
    ],
  },
  {
    id: 'close', criterion: 'impact, presentation', start: 147, duration: 12, enter: 'fade',
    cues: [
      { at: 0.3, dur: 5.6, text: 'Korean skincare exports hit a record last year, and small shops are moving online.' },
      { at: 6.3, dur: 5.4, text: 'Rally. Korean skincare, one box, your currency. Open source, MIT licensed.' },
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

// A caption stays up while its line is spoken, plus a short tail, never past its cue.
export const shownFor = (cue: Cue, index: number, spoken?: number[]) => spoken?.[index] === undefined ? cue.dur : Math.min(cue.dur, spoken[index] + 0.4);

export const toSrt = (vars: Record<string, string>, spoken?: number[]) =>
  allCues().map((cue, i) => `${i + 1}\n${stamp(cue.start, ',')} --> ${stamp(cue.start + shownFor(cue, i, spoken), ',')}\n${fill(cue.text, vars)}\n`).join('\n');

export const toScript = () =>
  ['# Rally video narration', '', 'Generated from src/timeline.ts: edit cues and timings there. {name} is filled from the run data.', ''].concat(
    SCENES.flatMap(scene => [
      `## ${scene.id} (${scene.start}s to ${scene.start + scene.duration}s, ${scene.criterion})`, '',
      ...scene.cues.map(cue => `- ${stamp(scene.start + cue.at, '.').slice(3, 8)} ${cue.text}`), '',
    ])).join('\n');
