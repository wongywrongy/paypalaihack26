// The one place to re-time the video. The voice drives it: every cue starts GAP seconds after the previous one ends,
// and each scene is its cues plus LEAD and TAIL. Shot and camera times hang off cues, so nothing here is in seconds
// except clip in/out points. {name} in a text is filled from run.json and order.json (see buildFacts in schema.ts).
export const FPS = 30;
export const MAX_SECONDS = 175;
// Silence between lines, at the start of a scene and at its end. LEAD + TAIL and GAP stay under MAX_SILENCE.
export const GAP = 0.3, LEAD = 0.2, TAIL = 0.3, MAX_SILENCE = 0.6;

export const CLIPS = {
  '02-products-edit': "Products: Cica Barrier Cream's lowest price edited, saved",
  '03-agent-goal': 'Agent: suggestion, Review rules, From your goal, Apply',
  '04-storefront-bag': 'Storefront, four products, bag, Total, all in',
  '05-paypal-hold': 'PayPal sandbox approval',
  '06-bidding': 'The live bidding board, start to award',
  '07-receipt': 'Receipt: You paid, One box from N shops, Duties included',
  '08-handoff-payout': 'Orders: Record hand-off, Won · Handed off · Payout sent · Paid',
} as const;
export type ClipName = keyof typeof CLIPS;

// Whose screen this is. Shown top left whenever footage of that side is on screen.
export const ROLES = { shop: 'Haneul Beauty · shop owner in Seoul', shopper: 'Shopper · California' } as const;
export type Role = keyof typeof ROLES;

// say: what Kokoro reads, when the caption's spelling would trip it. anchor: the auction event this line lands on.
// pause: extra silence before the line, only for the planned beat before the close (0.5 s here, plus TAIL and LEAD: 1 s).
// step: in the demo, the step this line shows, filled on the rail. 'before' is the shop's setup ahead of step 3.
export type Step = 1 | 2 | 3 | 4 | 5 | 'before';
export type Cue = { text: string; say?: string; anchor?: 'reject' | 'agent' | 'haneul' | 'award'; pause?: number; step?: Step };
// A camera keyframe in clip pixels of the 1440×900 window: the point to centre and a zoom over full-bleed (1 to 1.8).
// It fires at a cue's start (scene cue index, plus delay seconds) or at a clip second.
export type Key = { cue?: number; clip?: number; delay?: number; x: number; y: number; zoom: number };
// A spotlight: everything outside `rect` (clip pixels) dims, so one row or one rule is all there is to read.
export type Spot = { cue?: number; clip?: number; delay?: number; rect: { x: number; y: number; width: number; height: number } };
// A clip from `in` to `out` seconds, starting at a scene cue and running to the next shot. If the shot is shorter
// than the span, the clip ramps up to speed in the middle and back to 1×; if longer, it holds the last frame.
// `bag` is the shopper's bag rebuilt from the run, since the app's bag page does not name the shops.
export type Shot = { clip: ClipName | 'bag'; cue: number; delay?: number; in: number; out: number; role: Role; keys: Key[]; spots?: Spot[] };
// act: the five-part spine. Act 3 is the demo, where every line carries a step.
export type Scene = { id: string; criterion: string; act: 1 | 2 | 3 | 4 | 5; cues: Cue[]; shots?: Shot[] };

// The step rail, word for word.
export const STEPS = ['One bag', 'PayPal holds', 'Agents bid', 'Seoul hub', "Everyone's paid"] as const;

// Measured on the recorded run, in 1440×900 window pixels.
const CICA_ROW = { x: 300, y: 424, height: 52 }, GOAL_SENTENCE = { x: 322, y: 197, width: 376, height: 32 };
const GOAL_RULES = { x: 830, y: 260, width: 560, height: 146 }, APPLY = { x: 1266, y: 660, width: 118, height: 56 };

export const SCENES: Scene[] = [
  // Act 1: the problem, in Korea, concrete and sourced.
  {
    id: 'korea', criterion: 'impact', act: 1,
    cues: [{ text: 'Korean skincare sold a record $11.4 billion abroad in 2025, and small shops are a fast-growing share of it.', say: 'Korean skincare sold a record eleven point four billion dollars abroad in twenty twenty-five, and small shops are a fast-growing share of it.' }],
  },
  {
    id: 'split', criterion: 'impact', act: 1,
    cues: [
      { text: 'Say you want {item_count_words} products. The one shop that stocks all {item_count_words} only ships inside Korea.' },
      { text: 'So you split what you can across other shops: more checkouts, more parcels, and since August 2025, US duties on each parcel.', say: 'So you split what you can across other shops: more checkouts, more parcels, and since August twenty twenty-five, US duties on each parcel.' },
      { text: 'And when two shops sell the same {compare_item} at different prices, you compare.' },
    ],
  },
  // Act 2: how Rally works, five steps, no UI.
  {
    id: 'steps', criterion: 'innovation, PayPal', act: 2,
    cues: [
      { text: 'Rally turns that into one order, in five steps.' },
      { text: "One: you fill one bag and see one price, with shipping, duties, tax and Rally's small fee already in it.", step: 1 },
      { text: "Two: you approve that price with PayPal. PayPal holds it, so it's the most you can be charged.", step: 2 },
      { text: "Three: each shop's AI agent bids to win your bag, inside limits its owner set. Bids can only bring the price down.", step: 3 },
      { text: "Four: the winning shops drop their items at Rally's hub in Seoul, a local delivery they already make.", step: 4 },
      { text: 'Rally ships one box to you, duties paid.' },
      { text: 'Five: PayPal charges the final price, releases the rest, and pays each shop once it hands off.', step: 5 },
    ],
  },
  // Act 3: the demo, the same five steps.
  {
    id: 'haneul', criterion: 'innovation, design', act: 3,
    shots: [
      // One row: the public price first, then the private lowest price beside it.
      { clip: '02-products-edit', cue: 0, in: 0, out: 6.3, role: 'shop', keys: [{ cue: 0, x: 640, y: 450, zoom: 1.8 }],
        spots: [{ cue: 0, rect: { ...CICA_ROW, width: 453 } }, { cue: 0, delay: 2.4, rect: { ...CICA_ROW, width: 653 } }] },
      // One take, after the goal reads 20%: its first sentence, then the two rules from it, then Apply.
      { clip: '03-agent-goal', cue: 1, in: 3.3, out: 9.8, role: 'shop', keys: [{ cue: 1, x: 520, y: 300, zoom: 1.8 }, { cue: 1, delay: 2.4, x: 1110, y: 420, zoom: 1.6 }],
        spots: [{ cue: 1, rect: GOAL_SENTENCE }, { cue: 1, delay: 2.4, rect: GOAL_RULES }, { clip: 7.4, rect: APPLY }] },
    ],
    cues: [
      { text: 'First, a shop owner. Haneul Beauty sets a private lowest price that no rival ever sees.', step: 'before' },
      { text: 'Then a goal for her agent: win two-item bundles. Nothing changes until she applies it.', step: 'before' },
    ],
  },
  {
    id: 'shopper', criterion: 'design, PayPal', act: 3,
    shots: [
      { clip: '04-storefront-bag', cue: 0, in: 5.2, out: 8.2, role: 'shopper', keys: [{ cue: 0, x: 760, y: 500, zoom: 1.5 }] },
      { clip: 'bag', cue: 0, delay: 3, in: 0, out: 0, role: 'shopper', keys: [] },
      // Just before the approve click and just after.
      { clip: '05-paypal-hold', cue: 1, in: 2.4, out: 4.6, role: 'shopper', keys: [{ cue: 1, x: 720, y: 640, zoom: 1.6 }] },
    ],
    cues: [
      { text: 'A shopper in California fills a bag: {item_count_words} products, one price of {held}, everything included.', say: 'A shopper in California fills a bag: {item_count_words} products, one price of {held_say}, everything included.', step: 1 },
      { text: "They approve it in PayPal. That's the ceiling.", step: 2 },
    ],
  },
  {
    id: 'bidding', criterion: 'innovation, tech', act: 3,
    cues: [
      { text: 'The agents bid over {rounds_words} rounds. Each item goes to whichever shop makes the whole box cheapest.', step: 3 },
      { text: '{reject_line}', anchor: 'reject', step: 3 },
      { text: '{haneul_line}', anchor: 'haneul', step: 3 },
      { text: '{why_line}', say: '{why_say}', anchor: 'award', step: 3 },
    ],
  },
  {
    id: 'result', criterion: 'PayPal, impact', act: 3,
    shots: [{ clip: '07-receipt', cue: 0, in: 0, out: 11.3, role: 'shopper', keys: [{ cue: 0, x: 720, y: 330, zoom: 1.8 }, { cue: 1, x: 720, y: 640, zoom: 1.8 }] }],
    cues: [
      { text: '{capture_line}', say: '{capture_say}', step: 5 },
      { text: '{box_line}', step: 4 },
    ],
  },
  {
    id: 'payout', criterion: 'PayPal, impact', act: 3,
    shots: [
      { clip: '08-handoff-payout', cue: 0, in: 0, out: 10.5, role: 'shop', keys: [{ cue: 0, x: 900, y: 300, zoom: 1.5 }, { clip: 1.6, x: 1010, y: 330, zoom: 1.8 }, { clip: 6.2, x: 1080, y: 330, zoom: 1.8 }] },
    ],
    cues: [
      { text: '{handoff_line}', step: 4 },
      { text: 'and PayPal pays her {payout} right after.', say: 'and PayPal pays her {payout_say} right after.', step: 5 },
    ],
  },
  // Act 4: why it matters, and where it goes.
  {
    id: 'why', criterion: 'impact, PayPal', act: 4,
    cues: [
      { text: 'Shoppers get one box and a price that can only go down.' },
      { text: 'Small shops sell abroad with no export logistics, and are paid once they hand off.' },
      { text: "And PayPal's hold gives AI agents a hard spending limit they can't cross." },
    ],
  },
  {
    id: 'where', criterion: 'impact', act: 4,
    cues: [{ text: 'Seoul is the first hub. The same pattern can work wherever small shops cluster.' }],
  },
  // Act 5: technical, last.
  {
    id: 'close', criterion: 'tech, presentation', act: 5,
    cues: [{ text: 'Rally. Agents bargain. PayPal keeps it honest.', pause: 0.5 }],
  },
];

export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, name) => {
    if (!(name in vars)) throw new Error(`timeline.ts uses {${name}}, which run.json and order.json do not provide.`);
    return vars[name];
  });
}

// A cue whose filled text is empty (a beat the run did not produce) is left out, and its shots and keys move with it.
export type Line = { scene: string; index: number; text: string; say: string; anchor?: Cue['anchor']; step?: Step; start: number; end: number };
export type Laid = { id: string; start: number; duration: number; cues: Line[]; scene: Scene };
export type Plan = { scenes: Laid[]; lines: Line[]; total: number };

export const spokenText = (vars: Record<string, string>) => SCENES.flatMap(scene => scene.cues.map(cue => fill(cue.say ?? cue.text, vars)).filter(Boolean));

// Rough Kokoro speed at 1.0, for builds before npm run voice has measured the real lengths.
export const estimate = (text: string) => 0.25 + text.split(/\s+/).length * 0.37;

export function layout(vars: Record<string, string>, spoken?: number[] | null): Plan {
  let t = 0, n = 0;
  const lines: Line[] = [];
  const scenes = SCENES.map(scene => {
    const start = t;
    t += LEAD;
    const cues: Line[] = [];
    scene.cues.forEach((cue, index) => {
      const text = fill(cue.text, vars), say = fill(cue.say ?? cue.text, vars);
      if (!text) return;
      if (cues.length) t += GAP;
      t += cue.pause ?? 0;
      const length = spoken?.[n] ?? estimate(say);
      n++;
      const line = { scene: scene.id, index, text, say, anchor: cue.anchor, step: cue.step, start: t, end: t + length };
      cues.push(line);
      lines.push(line);
      t = line.end;
    });
    t += TAIL;
    return { id: scene.id, start, duration: t - start, cues, scene };
  });
  return { scenes, lines, total: t };
}

// The step filled on the rail at second t: the demo line being spoken, or the last one before it. Outside the demo, none.
export function railAt(plan: Plan, t: number): Step | null {
  const laid = plan.scenes.find(row => t >= row.start && t < row.start + row.duration);
  if (!laid || laid.scene.act !== 3) return null;
  const spoken = plan.lines.filter(line => line.start <= t && plan.scenes.find(row => row.id === line.scene)!.scene.act === 3);
  return spoken.at(-1)?.step ?? laid.cues[0].step ?? null;
}

// Scene seconds when a scene cue starts. A dropped cue falls back to the next one that was kept.
export function cueAt(laid: Laid, index: number) {
  const line = laid.cues.find(row => row.index >= index) ?? laid.cues[laid.cues.length - 1];
  return line.start - laid.start;
}

const stamp = (seconds: number, sep: string) => {
  const ms = Math.round(seconds * 1000), pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
};

// A caption stays up while its line is spoken, plus a short tail that never reaches the next line.
export const captionEnd = (plan: Plan, i: number) => Math.min(plan.lines[i].end + 0.25, plan.lines[i + 1]?.start ?? Infinity);

export const toSrt = (plan: Plan) => plan.lines.map((line, i) => `${i + 1}\n${stamp(line.start, ',')} --> ${stamp(captionEnd(plan, i), ',')}\n${line.text}\n`).join('\n');

export const toScript = (plan: Plan) =>
  ['# Rally video narration', '', 'Generated from src/timeline.ts and the measured voice: edit cues there. Times are from this run.', ''].concat(
    plan.scenes.flatMap(scene => [
      `## ${scene.id} (${scene.start.toFixed(1)}s to ${(scene.start + scene.duration).toFixed(1)}s, ${scene.scene.criterion})`, '',
      ...scene.cues.map(line => `- ${stamp(line.start, '.').slice(3, 8)} ${line.text}`), '',
    ])).join('\n');
