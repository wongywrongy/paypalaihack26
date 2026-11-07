// The one place to re-time the video. Each scene has a fixed length and each cue a start in scene seconds (at); the
// voice decides only where a line ends. Shot and proof times hang off cues and their words. {name} in a text is filled from run.json and order.json (see buildFacts in schema.ts).
import { chunks } from './captions.ts';

export const FPS = 60;
export const MAX_SECONDS = 175;
// The cut a judge sits through, exactly: the scenes' seconds add up to it.
export const TOTAL_SECONDS = 150;
// The least silence between two lines, and the least time a caption stays up.
export const GAP = 0.12, MIN_CAPTION = 2.5;
// Kokoro's speaking rate (scripts/voice.ts reads KOKORO_SPEED, default this). 1.0 sounds like someone reading aloud.
export const VOICE_SPEED = 1.12;
// Pacing gates (test/pacing.test.ts and scripts/pace.ts). A line is one breath; the picture changes at least every MAX_HOLD s.
export const MAX_WORDS = 20, MEAN_WORDS = 13, MAX_HOLD = 2.5;

// The real screen recordings, shown only as proof windows inside the frame (src/ui/glass.tsx, Proof).
export const CLIPS = {
  '05-paypal-hold': 'PayPal sandbox approval, around the approve click',
  '06-bidding': 'The live bidding board',
  '08-handoff-payout': 'Orders: Record hand-off, Won · Handed off · Payout sent · Paid',
} as const;
export type ClipName = keyof typeof CLIPS;

// Whose screen this is. Shown top left whenever footage of that side is on screen.
export const ROLES = { shop: 'Haneul Beauty · shop owner in Seoul', shopper: 'Shopper · California' } as const;
export type Role = keyof typeof ROLES;

// say: what Kokoro reads, when the caption's spelling would trip it. anchor: the auction event this line lands on.
// at: when the line starts, in scene seconds; it waits if the line before runs long. Lines leave room for the picture:
// whatever a line brings in lands and holds 1.5 s or more before the next line.
// step: in the demo, the step this line shows, filled on the rail. 'before' is the shop's setup ahead of step 3.
export type Step = 1 | 2 | 3 | 4 | 5 | 'before';
export type Cue = { text: string; say?: string; anchor?: 'reject' | 'agent' | 'haneul' | 'award'; at: number; step?: Step };
// A product moment, drawn natively from the run (src/ui/panels.tsx), starting at a scene cue, or at a word of it
// (word), plus delay seconds. A scene's shots share one frame and stay to its end: each panel has its own place.
export const PANELS = ['price', 'goal', 'product', 'bag', 'hold', 'receipt', 'box', 'order'] as const;
export type Panel = typeof PANELS[number];
export type Shot = { panel: Panel; cue: number; word?: string; delay?: number; role: Role };
// A real screen recording in a window inside the frame, proof that the drawn panels are the running product: clip
// seconds in to out, starting at a scene cue or a word of it (plus delay, which may be negative), then holding its last
// frame to the scene's end. crop is the region shown, in 1440×900 window pixels; box is where the window sits, in frame
// pixels. It rises in its box, grows to near full frame for big seconds, then settles back. The crop is fitted to the
// box but never shown above the recording's own pixel size.
export type Rect = { x: number; y: number; width: number; height: number };
// Where a proof window grows to: near full frame, clear of the role tag and rail above and the captions below.
export const BIG: Rect = { x: 60, y: 100, width: 1800, height: 780 };
export type Proof = { clip: ClipName; cue: number; word?: string; delay?: number; in: number; out: number; big: number; crop: Rect; box: Rect };
export type Scene = { id: string; criterion: string; act: 1 | 2 | 3 | 4 | 5; seconds: number; cues: Cue[]; shots?: Shot[]; proofs?: Proof[] };

// The step rail, word for word.
export const STEPS = ['One bag', 'PayPal holds', 'Agents bid', 'Seoul hub', "Everyone's paid"] as const;

// Measured on the recorded run, in 1440×900 window pixels.

export const SCENES: Scene[] = [
  // Open on the result, then the mess it replaces. The first picture is the product, not a map.
  {
    id: 'cold', criterion: 'presentation, impact', act: 1, seconds: 12,
    cues: [
      { text: '{hook_line}', say: '{hook_say}', at: 0.4 },
      { text: "You didn't haggle. {shop_count_cap} shops' AI agents did.", at: 5.6 },
    ],
  },
  {
    id: 'split', criterion: 'impact', act: 2, seconds: 18,
    cues: [
      { text: 'Normally? The shop with all {item_count_words} only ships in Korea.', at: 0.6 },
      { text: 'So you split it: more checkouts, more shipping, and US duties on every parcel.', at: 7.6 },
      // The compare chips flash on this line: two shops, two prices, and now they compete.
      { text: 'Rally makes the shops compete for it instead.', at: 13.5 },
    ],
  },
  // The demo. One step on the rail per line; the shop's setup comes before the order.
  {
    id: 'haneul', criterion: 'innovation, design', act: 3, seconds: 15,
    shots: [{ panel: 'price', cue: 0, role: 'shop' }, { panel: 'goal', cue: 1, role: 'shop' }],
    cues: [
      { text: "In Seoul, Haneul's shop sets a lowest price no one else can see.", step: 'before', at: 0.2 },
      { text: 'Her AI agent gets one goal: win two-item bundles.', step: 'before', at: 5.6 },
    ],
  },
  {
    id: 'shopper', criterion: 'design, PayPal', act: 3, seconds: 15,
    // The bag fills on the left; on the right the product is added, then the hold is approved, on "approve".
    shots: [{ panel: 'product', cue: 0, role: 'shopper' }, { panel: 'bag', cue: 0, word: 'fill', role: 'shopper' }, { panel: 'hold', cue: 1, role: 'shopper' }],
    // The real approval, logos blurred, in the right-hand column right after the drawn click.
    proofs: [{ clip: '05-paypal-hold', cue: 1, word: 'approve', delay: 0.35, in: 0.4, out: 4.9, big: 4, crop: { x: 436, y: 0, width: 568, height: 770 }, box: { x: 1130, y: 150, width: 700, height: 700 } }],
    cues: [
      { text: 'Then you fill one bag and see one price: {held}, shipping and duties in.', say: 'Then you fill one bag and see one price: {held_say}, shipping and duties in.', step: 1, at: 0.4 },
      { text: "You approve it with PayPal. That's the most you can pay.", step: 2, at: 7.4 },
    ],
  },
  {
    id: 'bidding', criterion: 'innovation, tech', act: 3, seconds: 40,
    // The real board, round 1 to the final total, after the drawn board's arithmetic appears; then back to the board.
    proofs: [{ clip: '06-bidding', cue: 3, delay: 7, in: 9.8, out: 16.3, big: 6, crop: { x: 190, y: 90, width: 1060, height: 470 }, box: { x: 110, y: 330, width: 1700, height: 540 } }],
    cues: [
      { text: 'Now the agents fight for your bag. {rounds_phrase}, and prices only go down.', step: 3, at: 0.6 },
      { text: '{reject_line}', anchor: 'reject', step: 3, at: 8.5 },
      { text: '{haneul_line}', anchor: 'haneul', step: 3, at: 17 },
      { text: '{why_line}', say: '{why_say}', anchor: 'award', step: 3, at: 23 },
    ],
  },
  {
    id: 'result', criterion: 'PayPal, impact', act: 3, seconds: 12,
    shots: [{ panel: 'receipt', cue: 0, role: 'shopper' }],
    cues: [{ text: '{capture_line}', say: '{capture_say}', step: 5, at: 0.5 }],
  },
  {
    id: 'payout', criterion: 'PayPal, impact', act: 3, seconds: 18,
    // The box on the left; the shop's order comes in on the right.
    shots: [{ panel: 'box', cue: 0, role: 'shopper' }, { panel: 'order', cue: 1, role: 'shop' }],
    // The real stepper turning from Payout sent to Paid, over the box, as the payout that just landed is said.
    proofs: [{ clip: '08-handoff-payout', cue: 2, word: '$', in: 4, out: 7.6, big: 3, crop: { x: 598, y: 122, width: 802, height: 410 }, box: { x: 70, y: 170, width: 860, height: 640 } }],
    cues: [
      { text: '{box_line}', step: 4, at: 0.5 },
      { text: '{handoff_line}', step: 4, at: 4.4 },
      { text: 'and PayPal pays {payout_who} {payout} on the spot.', say: 'and PayPal pays {payout_who} {payout_say} on the spot.', step: 5, at: 9 },
    ],
  },
  // Why it matters, one card each; out to the map for where it goes; then the title.
  {
    id: 'close', criterion: 'impact, PayPal, tech, presentation', act: 4, seconds: 20,
    cues: [
      { text: 'You pay less, and get one box.', at: 0.4 },
      { text: 'Small shops sell abroad without shipping abroad.', at: 3.3 },
      { text: "And AI agents get a spending limit they can't break.", at: 6.2 },
      { text: 'Seoul is first. The same setup can work anywhere small shops cluster.', at: 10.6 },
      { text: 'Rally. Agents bargain. PayPal keeps it honest.', at: 15 },
    ],
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

// Rough Kokoro length at VOICE_SPEED, for builds before npm run voice has measured the real lengths.
export const estimate = (text: string) => (0.25 + text.split(/\s+/).length * 0.37) / VOICE_SPEED;

export function layout(vars: Record<string, string>, spoken?: number[] | null): Plan {
  let t = 0, n = 0;
  const lines: Line[] = [];
  const scenes = SCENES.map(scene => {
    const start = t, cues: Line[] = [];
    scene.cues.forEach((cue, index) => {
      const text = fill(cue.text, vars), say = fill(cue.say ?? cue.text, vars);
      if (!text) return;
      const length = spoken?.[n] ?? estimate(say), last = cues.at(-1);
      n++;
      const from = Math.max(start + cue.at, last ? Math.max(last.end + GAP, last.start + MIN_CAPTION) : start);
      const line = { scene: scene.id, index, text, say, anchor: cue.anchor, step: cue.step, start: from, end: from + length };
      if (Math.max(line.end, from + MIN_CAPTION) > start + scene.seconds) throw new Error(`${scene.id}: "${text}" runs past the scene's ${scene.seconds} s. Start it earlier or lengthen the scene.`);
      cues.push(line);
      lines.push(line);
    });
    t += scene.seconds;
    return { id: scene.id, start, duration: scene.seconds, cues, scene };
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

// Scene seconds when a word of a cue is spoken, timed like the captions, so the picture lands with the word.
export function wordAt(laid: Laid, index: number, word: string) {
  const line = laid.cues.find(row => row.index >= index) ?? laid.cues[laid.cues.length - 1];
  const hit = chunks(line.text, line.start, line.end).flatMap(part => part.words).find(row => row.word.toLowerCase().replace(/[^a-z0-9$']/g, '').startsWith(word.toLowerCase()));
  return (hit?.from ?? line.start) - laid.start;
}

// Scene seconds when a shot or proof starts: its cue, or a word of it, plus its delay.
export const startAt = (laid: Laid, row: { cue: number; word?: string; delay?: number }) => (row.word ? wordAt(laid, row.cue, row.word) : cueAt(laid, row.cue)) + (row.delay ?? 0);

const stamp = (seconds: number, sep: string) => {
  const ms = Math.round(seconds * 1000), pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
};

// A caption stays up while its line is spoken plus a short tail, and at least MIN_CAPTION; never into the next line.
export const captionEnd = (plan: Plan, i: number) => Math.min(Math.max(plan.lines[i].end + 0.25, plan.lines[i].start + MIN_CAPTION), plan.lines[i + 1]?.start ?? plan.total);

export const toSrt = (plan: Plan) => plan.lines.map((line, i) => `${i + 1}\n${stamp(line.start, ',')} --> ${stamp(captionEnd(plan, i), ',')}\n${line.text}\n`).join('\n');

export const toScript = (plan: Plan) =>
  ['# Rally video narration', '', 'Generated from src/timeline.ts and the measured voice: edit cues there. Times are from this run.', ''].concat(
    plan.scenes.flatMap(scene => [
      `## ${scene.id} (${scene.start.toFixed(1)}s to ${(scene.start + scene.duration).toFixed(1)}s, ${scene.scene.criterion})`, '',
      ...scene.cues.map(line => `- ${stamp(line.start, '.').slice(3, 8)} ${line.text}`), '',
    ])).join('\n');
