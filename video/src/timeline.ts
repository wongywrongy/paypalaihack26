// The one place to re-time the video. The voice drives it: every cue starts GAP seconds after the previous one ends,
// and each scene is its cues plus LEAD and TAIL. Shot and camera times hang off cues, so nothing here is in seconds
// except clip in/out points. {name} in a text is filled from run.json and order.json (see buildFacts in schema.ts).
export const FPS = 60;
export const MAX_SECONDS = 175;
// The cut a judge sits through: aim here, and the tests hold the built cut to it.
export const TARGET_SECONDS = [60, 95] as const;
// Silence between lines, at the start of a scene and at its end. Conversation, not a reading: lines nearly touch.
export const GAP = 0.12, LEAD = 0.1, TAIL = 0.15, MAX_SILENCE = 0.6;
// Kokoro's speaking rate (scripts/voice.ts reads KOKORO_SPEED, default this). 1.0 sounds like someone reading aloud.
export const VOICE_SPEED = 1.12;
// Pacing gates (test/pacing.test.ts and scripts/pace.ts). A line is one breath; the picture changes at least every MAX_HOLD s.
export const MAX_WORDS = 20, MEAN_WORDS = 13, MAX_HOLD = 2.5;

// The real screen recordings, shown only as short full-frame proof cuts (src/ui/glass.tsx, Proof).
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
// pause: extra silence before the line, only for the planned beat before the close (0.5 s here, plus TAIL and LEAD: 1 s).
// step: in the demo, the step this line shows, filled on the rail. 'before' is the shop's setup ahead of step 3.
export type Step = 1 | 2 | 3 | 4 | 5 | 'before';
export type Cue = { text: string; say?: string; anchor?: 'reject' | 'agent' | 'haneul' | 'award'; pause?: number; step?: Step };
// A product moment, drawn natively from the run (src/ui/panels.tsx), starting at a scene cue (plus delay seconds)
// and running to the next shot.
export const PANELS = ['price', 'goal', 'product', 'bag', 'hold', 'receipt', 'order'] as const;
export type Panel = typeof PANELS[number];
export type Shot = { panel: Panel; cue: number; delay?: number; role: Role };
// A real screen recording as a full-frame cut, proof that the drawn panels are the running product: clip seconds in
// to out, starting at a scene cue (plus delay, which may be negative). crop is the region shown, in 1440×900 window
// pixels; it is fitted to the frame but never shown above the recording's own pixel size.
export type Rect = { x: number; y: number; width: number; height: number };
export type Proof = { clip: ClipName; cue: number; delay?: number; in: number; out: number; crop: Rect };
export type Scene = { id: string; criterion: string; act: 1 | 2 | 3 | 4 | 5; cues: Cue[]; shots?: Shot[]; proofs?: Proof[] };

// The step rail, word for word.
export const STEPS = ['One bag', 'PayPal holds', 'Agents bid', 'Seoul hub', "Everyone's paid"] as const;

// Measured on the recorded run, in 1440×900 window pixels.

export const SCENES: Scene[] = [
  // Act 1: open on the result, then the mess it replaces. The first picture is the product, not a map.
  {
    id: 'cold', criterion: 'presentation, impact', act: 1,
    cues: [
      { text: '{hook_line}', say: '{hook_say}' },
      { text: "You didn't haggle. {shop_count_cap} shops' AI agents did." },
    ],
  },
  {
    id: 'split', criterion: 'impact', act: 1,
    cues: [
      { text: 'Normally? The shop with all {item_count_words} only ships in Korea.' },
      { text: 'So you split it: more checkouts, more shipping, and US duties on every parcel.' },
      // The compare chips flash on this line: two shops, two prices, and now they compete.
      { text: 'Rally makes the shops compete for it instead.' },
    ],
  },
  // Act 3: the demo. One step on the rail per line; the shop's setup comes before the order.
  {
    id: 'haneul', criterion: 'innovation, design', act: 3,
    shots: [{ panel: 'price', cue: 0, role: 'shop' }, { panel: 'goal', cue: 1, role: 'shop' }],
    cues: [
      { text: "In Seoul, Haneul's shop sets a lowest price no one else can see.", step: 'before' },
      { text: 'Her AI agent gets one goal: win two-item bundles.', step: 'before' },
    ],
  },
  {
    id: 'shopper', criterion: 'design, PayPal', act: 3,
    // The hold card arrives on the PayPal line, ready to approve; the approval itself is the real one.
    shots: [{ panel: 'product', cue: 0, role: 'shopper' }, { panel: 'bag', cue: 0, delay: 1.6, role: 'shopper' }, { panel: 'hold', cue: 1, delay: -0.8, role: 'shopper' }],
    // The real approval, logos blurred: just before the approve click and just after.
    proofs: [{ clip: '05-paypal-hold', cue: 1, in: 2.4, out: 4.4, crop: { x: 436, y: 0, width: 568, height: 770 } }],
    cues: [
      { text: 'Then you fill one bag and see one price: {held}, shipping and duties in.', say: 'Then you fill one bag and see one price: {held_say}, shipping and duties in.', step: 1 },
      { text: "You approve it with PayPal. That's the most you can pay.", step: 2 },
    ],
  },
  {
    id: 'bidding', criterion: 'innovation, tech', act: 3,
    // The real board landing on the final total, right after the drawn board's arithmetic appears.
    proofs: [{ clip: '06-bidding', cue: 3, delay: 2.4, in: 14.3, out: 16.3, crop: { x: 190, y: 90, width: 1060, height: 470 } }],
    cues: [
      { text: 'Now the agents fight for your bag. {rounds_phrase}, and prices only go down.', step: 3 },
      { text: '{reject_line}', anchor: 'reject', step: 3 },
      { text: '{haneul_line}', anchor: 'haneul', step: 3 },
      { text: '{why_line}', say: '{why_say}', anchor: 'award', step: 3 },
    ],
  },
  {
    id: 'result', criterion: 'PayPal, impact', act: 3,
    shots: [{ panel: 'receipt', cue: 0, role: 'shopper' }],
    cues: [
      { text: '{capture_line}', say: '{capture_say}', step: 5 },
      { text: '{box_line}', step: 4 },
    ],
  },
  {
    id: 'payout', criterion: 'PayPal, impact', act: 3,
    shots: [{ panel: 'order', cue: 0, role: 'shop' }],
    // The real stepper turning from Payout sent to Paid, right after the payout lands.
    proofs: [{ clip: '08-handoff-payout', cue: 1, delay: 1.2, in: 5, out: 7, crop: { x: 598, y: 122, width: 802, height: 410 } }],
    cues: [
      { text: '{handoff_line}', step: 4 },
      { text: 'and PayPal pays {payout_who} {payout} on the spot.', say: 'and PayPal pays {payout_who} {payout_say} on the spot.', step: 5 },
    ],
  },
  // Act 4: why it matters, one breath each, then where it goes.
  {
    id: 'why', criterion: 'impact, PayPal', act: 4,
    cues: [
      { text: 'You pay less, and get one box.' },
      { text: 'Small shops sell abroad without shipping abroad.' },
      { text: "And AI agents get a spending limit they can't break." },
    ],
  },
  {
    id: 'where', criterion: 'impact', act: 4,
    cues: [{ text: 'Seoul is first. The same setup can work anywhere small shops cluster.' }],
  },
  {
    id: 'close', criterion: 'tech, presentation', act: 5,
    cues: [{ text: 'Rally. Agents bargain. PayPal keeps it honest.', pause: 0.3 }],
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
