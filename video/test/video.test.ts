import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepare } from '../scripts/prepare.ts';
import { anchored, buildBoard, roundAt, sceneAt, valueAt } from '../src/auction.ts';
import { buildFacts, crossCheck, finalCheck, finalPrices, money, OrderSchema, parse, ReceiptSchema, receiptCheck, RunSchema, spokenMoney } from '../src/schema.ts';
import { phrases } from '../src/captions.ts';
import { CLIPS, cueAt, GAP, layout, MAX_SECONDS, MAX_SILENCE, railAt, SCENES, spokenText, STEPS, toScript, toSrt, type ClipName } from '../src/timeline.ts';

// Test data only: nothing here reaches a build.
const events = () => [
  { seq: 1, t: 0, kind: 'start', v: 3, total: 3000, items: ['a', 'b'], shops: { a: ['haneul', 'bada'], b: ['haneul', 'dalbit'] }, listed: { a: { haneul: 1500, bada: 1400 }, b: { haneul: 1600, dalbit: 1700 } } },
  { seq: 2, t: 1, kind: 'bid', round: 1, shop: 'haneul', total: 3000, note: 'Together for less.', chosen_by: 'LLM', authored: 'agent', items: { a: 1300, 'b:older': 1500 }, bundle: null, perks: { a: ['bundle'], b: ['older'] } },
  { seq: 3, t: 2, kind: 'pass', round: 1, shop: 'bada', total: 3000, items: ['a'] },
  { seq: 4, t: 3, kind: 'round', round: 1, total: 2800, leaders: {} },
  { seq: 5, t: 4, kind: 'award', total: 2800, winners: { a: { shop: 'haneul', unit: 1300 }, b: { shop: 'dalbit', unit: 1500 } }, extras: [], domestic: {}, agents: { written: 1, options: 0, rejected: 0, code: 0, changed: 1 } },
  { seq: 6, t: 0, kind: 'done' },
];
const order = () => ({ id: 'o1', currency: 'USD', payment_state: 'CHARGED', maximum_minor: 3000, lowest: { a: 900 }, events: events(), payout: { status: 'completed', amount_minor: 1300, currency: 'USD' } });
const run = () => ({ order_id: 'o1', currency: 'USD', held_minor: 3000, charged_minor: 2800, payout_usd_cents: 1300, payout_status: 'completed', payout_shop: 'haneul', winners: { a: { shop: 'haneul', unit: 1300 }, b: { shop: 'dalbit', unit: 1500 } }, goal: 'Win two-item bundles. Keep a margin.', rules: [{ label: 'Discount per round', value: 'Up to 20%' }], redact: [] });
const receipt = () => ({ breakdown: { currency: 'USD', goods: 2800, domestic: 0, shipping: 0, duty: 0, tax: 0, fee: 0, total: 2800 }, lines: [{ id: 'a', shop: 'haneul', unit: 1300 }, { id: 'b', shop: 'dalbit', unit: 1500 }] });
const parsed = (r: unknown = run(), o: unknown = order()) => [parse(RunSchema, r, 'run.json'), parse(OrderSchema, o, 'order.json')] as const;
const factsOf = (r: unknown = run(), o: unknown = order(), rc: unknown = receipt()) => buildFacts(...parsed(r, o), parse(ReceiptSchema, rc, 'receipt.json'));

function project(files: Record<string, unknown>, clips: string[] = []) {
  const repo = mkdtempSync(join(tmpdir(), 'rally-video-'));
  const root = join(repo, 'video');
  mkdirSync(join(root, 'run/clips'), { recursive: true });
  mkdirSync(join(repo, 'design/scenario'), { recursive: true });
  mkdirSync(join(repo, 'frontend/public/assets/products'), { recursive: true });
  writeFileSync(join(repo, 'design/scenario/scenario.json'), JSON.stringify({ catalog: [{ id: 'a', brand: 'X', name: 'Cleanser' }, { id: 'b', brand: 'X', name: 'Cream' }] }));
  for (const id of ['a', 'b']) writeFileSync(join(repo, 'frontend/public/assets/products', `${id}.png`), '');
  if (!('receipt.json' in files) && 'run.json' in files) files = { ...files, 'receipt.json': receipt() };
  for (const [name, value] of Object.entries(files)) writeFileSync(join(root, 'run', name), JSON.stringify(value));
  for (const clip of clips) writeFileSync(join(root, 'run/clips', `${clip}.mp4`), '');
  return { root, done: () => rmSync(repo, { recursive: true }) };
}
const probe = () => ({ width: 1440, height: 900, seconds: 10 });
const allClips = Object.keys(CLIPS);

// The run this build was prepared from, when there is one; tests on it check the cut actually being rendered.
const built = (() => { try { return JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')); } catch { return null; } })();
const facts = () => factsOf();
const plans = () => [layout(facts(), null), ...(built ? [layout(built.vars, built.spoken)] : [])];

test(`the video stays within ${MAX_SECONDS} s, and the built cut within 2:20 to 2:30`, () => {
  for (const plan of plans()) assert.ok(plan.total <= MAX_SECONDS, `${plan.total} s`);
  if (built?.spoken) { const total = layout(built.vars, built.spoken).total; assert.ok(total >= 140 && total <= 150, `${total} s`); }
});

test(`no silence over ${MAX_SILENCE} s except the planned pause before the close`, () => {
  for (const plan of plans()) {
    assert.ok(plan.lines[0].start <= MAX_SILENCE);
    plan.lines.slice(1).forEach((line, i) => {
      const gap = line.start - plan.lines[i].end, planned = SCENES.find(row => row.id === line.scene)!.cues[line.index].pause;
      if (planned) assert.ok(gap <= planned + MAX_SILENCE, `${line.text}: ${gap}`);
      else assert.ok(gap <= MAX_SILENCE + 1e-9, `${gap.toFixed(2)} s of silence before: ${line.text}`);
    });
    assert.ok(plan.total - plan.lines.at(-1)!.end <= MAX_SILENCE);
  }
  assert.ok(GAP <= MAX_SILENCE);
});

test('scenes are contiguous and each lasts its lines plus half a second', () => {
  for (const plan of plans()) {
    let end = 0;
    for (const scene of plan.scenes) {
      assert.ok(Math.abs(scene.start - end) < 1e-9, scene.id);
      end += scene.duration;
      const spoken = scene.cues.reduce((sum, line) => sum + line.end - line.start, 0), gaps = (scene.cues.length - 1) * GAP + scene.cues.reduce((sum, line) => sum + (SCENES.find(row => row.id === scene.id)!.cues[line.index].pause ?? 0), 0);
      assert.ok(Math.abs(scene.duration - spoken - gaps - 0.5) < 1e-6, scene.id);
    }
  }
});

test('captions fit two lines and never overlap', () => {
  for (const plan of plans()) plan.lines.forEach((line, i) => {
    assert.ok(line.text.length <= 140, line.text);
    if (plan.lines[i + 1]) assert.ok(line.end <= plan.lines[i + 1].start, line.text);
  });
});

test('every shot starts on a line and has time on screen', () => {
  for (const plan of plans()) for (const scene of plan.scenes) (scene.scene.shots || []).forEach((shot, i, shots) => {
    const at = (n: number) => cueAt(scene, shots[n].cue) + (shots[n].delay ?? 0);
    const from = i === 0 ? 0 : at(i), to = i + 1 < shots.length ? at(i + 1) : scene.duration;
    assert.ok(to - from >= 1.5, `${scene.id} ${shot.panel} has ${(to - from).toFixed(2)} s`);
  });
});

// Panels are drawn from the run; these prove they are the running product. The build fails without them.
test('proof cuts: the real approval, board and payout recordings each cut in full frame, never above their own pixels', () => {
  const proofs = SCENES.flatMap(scene => (scene.proofs ?? []).map(proof => ({ ...proof, scene: scene.id })));
  for (const [scene, clip, seconds] of [['shopper', '05-paypal-hold', 2], ['bidding', '06-bidding', 2.5], ['payout', '08-handoff-payout', 2.5]] as const) {
    const proof = proofs.find(row => row.scene === scene && row.clip === clip);
    assert.ok(proof, `no proof cut of ${clip} in ${scene}`);
    assert.ok(Math.abs(proof.out - proof.in - seconds) < 1e-9, `${clip} runs ${proof.out - proof.in} s, not ${seconds}`);
    const { x, y, width, height } = proof.crop;
    assert.ok(x >= 0 && y >= 0 && x + width <= 1440 && y + height <= 900, `${clip} crop leaves the window`);
    const frames = built?.clips?.[clip]?.frames;
    if (built) assert.ok(frames && proof.out <= frames / 60 + 0.05, `${clip} proof runs past its recording`);
  }
  const glass = readFileSync('src/ui/glass.tsx', 'utf8');
  // Window pixels are 2 recorded pixels (2880×1800), so a window-to-frame scale above 2 would upscale.
  assert.match(glass, /export const proofScale = \(crop: Rect\) => Math\.min\(2,/);
  assert.match(glass, /fontSize: 26[^\n]*>Screen recording · PayPal sandbox</);
});

// The frame stays still. The only camera moves are the two map pull-backs, in Split and Where; nothing else scales or
// moves a scene's root layer over time.
test('camera: only the two map pull-backs move the frame', () => {
  const body = (file: string, name: string) => {
    const source = readFileSync(file, 'utf8'), start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${file}: ${name}`);
    const next = source.indexOf('\nexport function ', start + 1), rest = source.indexOf('\nfunction ', start + 1);
    return source.slice(start, Math.min(...[next, rest, source.length].filter(n => n > 0)));
  };
  const root = (code: string) => code.slice(code.indexOf('return <'), code.indexOf('>', code.indexOf('return <')) + 1);
  const moving = /transform|scale\(|zoom/;
  const scenes = { 'src/scenes/Story.tsx': ['Korea', 'Split', 'Steps', 'Why', 'Where', 'Close'], 'src/scenes/Bidding.tsx': ['Bidding'], 'src/scenes/ClipScene.tsx': ['ClipScene'], 'src/Video.tsx': ['Shot'] };
  for (const [file, names] of Object.entries(scenes)) for (const name of names) {
    const code = body(file, name);
    assert.ok(!moving.test(root(code)), `${name} transforms its root layer`);
    const views = [...code.matchAll(/<Map v=\{([^}]*\}?)\}/g)].map(match => match[1]);
    const moves = ['Split', 'Where'].includes(name);
    if (!moves) for (const view of views) assert.ok(/^[A-Z_]+$|^v$/.test(view) && !/frame/.test(code.match(new RegExp(`const v = [^;]*`))?.[0] ?? ''), `${name} moves the map camera: ${view}`);
    else assert.match(code, /lerpView\([A-Z_]+, [A-Z_]+, smooth\(frame \//, `${name}: one continuous ease-in-out move`);
  }
  assert.ok(!/useCurrentFrame|frame/.test(readFileSync('src/scenes/Story.tsx', 'utf8').match(/const KOREA[^\n]*/)![0]));
});

test('captions: phrase chunks of up to seven words, never split inside an amount or a name', () => {
  for (const plan of plans()) for (const line of plan.lines) {
    const parts = phrases(line.text);
    assert.equal(parts.flat().join(' '), line.text);
    for (const [i, part] of parts.entries()) {
      assert.ok(part.length <= 7, `${part.join(' ')}`);
      const next = parts[i + 1]?.[0];
      if (next) {
        const last = part[part.length - 1];
        assert.ok(!(/^\$[\d.,]*\d/.test(last) && /^(billion|million)/.test(next)), `amount split: ${last} | ${next}`);
        assert.ok(!(/^[A-Z]/.test(last) && /^[A-Z]/.test(next) && !/[,.:;?!]$/.test(last)), `name split: ${last} | ${next}`);
      }
    }
  }
  assert.deepEqual(phrases('Korean skincare sold a record $11.4 billion abroad in 2025, and small shops grow.').map(row => row.join(' ')).filter(row => row.includes('$11.4')), ['a record $11.4 billion abroad in 2025,']);
});

// An amount said in a caption is written exactly as the screen shows it, whole, and shown in the same scene.
test('caption amounts are whole and appear on screen in their scene', { skip: !built }, () => {
  const files: Record<string, string[]> = { korea: ['src/scenes/Story.tsx'], shopper: ['src/scenes/Bidding.tsx', 'src/ui/panels.tsx'], bidding: ['src/scenes/Bidding.tsx'], result: ['src/ui/panels.tsx'], payout: ['src/ui/panels.tsx'] };
  // How each run amount is drawn, in the scene source.
  const drawn: Record<string, RegExp> = { held: /cash\(hold\)|cash\(held\)/, charged: /vars\.charged|cents=\{charged\}/, released: /held - charged/, payout: /payout_usd_cents/ };
  const amount = /\$[\d,]*\d(?:\.\d+)?(?: billion| million)?/g;
  for (const line of layout(built.vars, built.spoken).lines) for (const value of line.text.match(amount) ?? []) {
    for (const part of phrases(line.text)) {
      const text = part.join(' ');
      if (text.includes(value.split(' ')[0])) assert.ok(text.includes(value), `${value} is split across captions`);
    }
    const source = (files[line.scene] ?? []).map(file => readFileSync(file, 'utf8')).join('\n');
    assert.ok(source, `${line.scene} says ${value} but shows no amounts`);
    const key = Object.keys(drawn).find(name => built.vars[name] === value);
    assert.ok(key ? drawn[key].test(source) : source.includes(`>${value}<`), `${value} in "${line.text}" is not on screen in ${line.scene}`);
  }
});

test('no banned word in any on-screen source', () => {
  const words = /\b(demo|example|simulated|preview|fixture)\b/i;
  // The one exception is the demo's own disclosure lower-third, which says what is a test and what is fictional.
  for (const file of ['src/timeline.ts', 'src/scenes/Story.tsx', 'src/scenes/Bidding.tsx', 'src/scenes/Rail.tsx', 'src/scenes/ClipScene.tsx', 'src/Video.tsx']) {
    const strings = readFileSync(file, 'utf8').split('\n').filter(line => !line.trim().startsWith('//') && !line.includes('Live demo · PayPal sandbox · fictional shops and hub'));
    assert.ok(!words.test(strings.join('\n')), file);
  }
});

test('script.md matches the laid-out timeline', { skip: !built }, () => assert.equal(readFileSync('script.md', 'utf8'), toScript(layout(built.vars, built.spoken))));

test('srt numbers cues and uses comma timestamps', () => {
  const [r, o] = parsed();
  const srt = toSrt(layout(factsOf(), null));
  assert.match(srt, /^1\n00:00:00,200 --> 00:00:0\d,\d{3}\n/);
  assert.ok(srt.includes('$28.00'));
  assert.ok(!srt.includes('{'));
});

test('names match the app word for word', () => {
  const source = (file: string) => readFileSync(join('../frontend/src/routes', file), 'utf8');
  for (const [file, strings] of Object.entries({
    'shops/GoalsForm.tsx': ['Review rules', 'From your goal', 'Apply'],
    'Paid.tsx': ['Your shop bid on this order', 'Hand off in Rally for shops', 'One box from', 'Duties included'],
    'shops/OrdersView.tsx': ['Rally pickup', 'Record hand-off', "'Won', 'Handed off', 'Payout sent', 'Paid'"],
  })) for (const text of strings) assert.ok(source(file).includes(text), `${file}: ${text}`);
  const readme = readFileSync('README.md', 'utf8');
  for (const text of ['Review rules', 'From your goal', 'Hand off in Rally for shops', 'Record hand-off', 'Rally pickup', 'Won · Handed off · Payout sent · Paid', 'Your shop bid on this order', 'Duties included']) assert.ok(readme.includes(text), `README: ${text}`);
});

test('no value from `lowest` reaches rendered text', () => {
  // Distinct from every bid, so a hit can only be a leak. A shop's real bid can equal its floor: that is a public bid.
  const lowest = { a: 987, 'a:older': 654, b: 1234 };
  const forms = Object.values(lowest).flatMap(value => [String(value), (value / 100).toFixed(2), money(value, 'USD')]);
  const withReject = order();
  withReject.events.splice(1, 0, { seq: 1.5, t: 0.5, kind: 'rejected', round: 1, shop: 'bada', total: 3000, chosen_by: 'CODE', reason: 'limit', note: 'Agent bid went below what Bada Market can accept.' } as any);
  withReject.events.forEach((row, i) => { row.seq = i + 1; });
  (withReject.events.find(row => row.kind === 'award') as any).agents.rejected = 1;
  const { root, done } = project({ 'run.json': run(), 'order.json': { ...withReject, lowest } }, allClips);
  prepare(root, { allowPlaceholders: false, probe });
  // The manifest is the only run data in the bundle, so whatever it lacks cannot be rendered.
  const rendered = readFileSync(join(root, 'src/generated/manifest.json'), 'utf8') + readFileSync(join(root, 'out/captions.srt'), 'utf8');
  for (const form of forms) assert.ok(!rendered.includes(form), `floor value ${form} leaked`);
  done();
  for (const file of ['src/scenes/Bidding.tsx', 'src/auction.ts', 'src/ui.tsx', 'src/scenes/ClipScene.tsx']) assert.ok(!/\.lowest|\bfloors\b/.test(readFileSync(file, 'utf8')), `${file} reads floors`);
});

test('the rejection beat says why in words only, so no amount can appear there', () => {
  const source = readFileSync('src/scenes/Bidding.tsx', 'utf8') + readFileSync('src/schema.ts', 'utf8');
  for (const line of source.match(/const REASONS[^\n]*/g)!) assert.ok(!/\d/.test(line), line);
});

test('private lowest prices are dropped on parse', () => assert.ok(!JSON.stringify(parsed()[1]).includes('lowest')));

test('a missing field names the file and the field', () => {
  const { held_minor, ...partial } = run();
  assert.throws(() => parse(RunSchema, partial, 'video/run/run.json'), /video\/run\/run\.json[\s\S]*held_minor/);
});

test('cross-checks catch a hand-typed mismatch', () => {
  for (const [change, message] of [
    [{ order_id: 'other' }, /same order/], [{ held_minor: 2900 }, /held_minor/], [{ charged_minor: 2700 }, /award total/],
    [{ payout_shop: 'bada' }, /won no items/], [{ payout_usd_cents: 1 }, /Haneul's payout/],
    [{ winners: { a: { shop: 'haneul', unit: 1 }, b: { shop: 'dalbit', unit: 1500 } } }, /winners/],
  ] as const) {
    const [r, o] = parsed({ ...run(), ...change });
    assert.throws(() => crossCheck(r, o), message);
  }
  const [r, o] = parsed({ ...run(), held_minor: 2800, charged_minor: 2800 }, { ...order(), maximum_minor: 2800 });
  assert.throws(() => crossCheck(r, o), /above the hold/);
  crossCheck(...parsed());
});

test('the final render refuses fixture events and unfinished payouts', () => {
  const swapped = order();
  swapped.events[1].chosen_by = 'FIXTURE';
  assert.throws(() => finalCheck(...parsed(run(), swapped)), /fixture run/);
  swapped.events[1].chosen_by = 'CODE';
  assert.throws(() => finalCheck(...parsed(run(), swapped)), /chosen by a model/);
  assert.throws(() => finalCheck(...parsed({ ...run(), payout_status: 'pending' })), /not completed/);
  const picked = order();
  (picked.events[4] as any).agents = { written: 0, options: 1, rejected: 0, code: 0, changed: 0 };
  assert.throws(() => finalCheck(...parsed(run(), picked)), /No shop agent wrote its own bid/);
  finalCheck(...parsed());
});

test('captions adapt when Haneul is outbid', () => {
  const r = { ...run(), payout_shop: 'dalbit', payout_usd_cents: 1500, winners: { a: { shop: 'bada', unit: 1300 }, b: { shop: 'dalbit', unit: 1500 } } };
  const o = order();
  o.payout = { status: 'outbid', amount_minor: 0, currency: 'USD' };
  (o.events[4] as any).winners = r.winners;
  const [run2, order2] = parsed(r, o);
  crossCheck(run2, order2);
  const facts = factsOf(r, o, { ...receipt(), lines: [{ id: 'a', shop: 'bada', unit: 1300 }, { id: 'b', shop: 'dalbit', unit: 1500 }] });
  assert.match(facts.handoff_line, /^Haneul was outbid\. Dalbit Official hands its items/);
  assert.match(facts.box_line, /One box from two shops/);
  assert.equal(facts.payout_shop, 'Dalbit Official');
});

test('captions stay true when no bid beats checkout', () => {
  const r = { ...run(), charged_minor: 3000 };
  const o = order();
  o.events[3].total = 3000; o.events[4].total = 3000;
  const facts = factsOf(r, o, { ...receipt(), breakdown: { ...receipt().breakdown, shipping: 200, total: 3000 } });
  assert.match(facts.why_line, /^The cheapest whole box wins\. Final price: \$30\.00\.$/);
  assert.match(facts.capture_line, /exactly the hold/);
  assert.ok(!facts.capture_line.includes('releases'));
});

test('prepare: missing inputs fail with a clear message and no fallback', () => {
  const { root, done } = project({ 'order.json': order() });
  assert.throws(() => prepare(root, { allowPlaceholders: true, probe }), /run\.json is missing/);
  done();
});

test('prepare: placeholders pass for review and fail for the final render', () => {
  const { root, done } = project({ 'run.json': run(), 'order.json': order() }, allClips.slice(0, 2));
  assert.deepEqual(prepare(root, { allowPlaceholders: true, probe }).missing, ['08-handoff-payout.mp4']);
  assert.throws(() => prepare(root, { allowPlaceholders: false, probe }), /Placeholders cannot go in the final render[\s\S]*08-handoff-payout/);
  done();
});

test('prepare: a full set passes, and the wrong size fails', () => {
  const { root, done } = project({ 'run.json': run(), 'order.json': order() }, allClips);
  const { manifest } = prepare(root, { allowPlaceholders: false, probe });
  assert.equal(manifest.clips['06-bidding' as ClipName]?.frames, 600);
  assert.ok(!readFileSync(join(root, 'src/generated/manifest.json'), 'utf8').includes('lowest'));
  assert.throws(() => prepare(root, { allowPlaceholders: false, probe: () => ({ width: 1920, height: 1080, seconds: 1 }) }), /must be 1440×900/);
  done();
});

test('board: bids lower lanes, perks land on their bid and award marks winners', () => {
  const board = buildBoard(events() as any);
  const lane = board.items[0].lanes[0];
  assert.equal(valueAt(lane.steps, 0.5, 0.1), 1500);
  assert.equal(valueAt(lane.steps, 2, 0.1), 1300);
  assert.equal(lane.perks[0].t, 1);
  assert.equal(board.items[1].lanes[0].steps.at(-1)!.value, 1500);
  assert.equal(board.items[0].lanes[1].passedAt, 2);
  assert.equal(roundAt(board, 2.9), 0);
  assert.equal(roundAt(board, 3), 1);
  assert.equal(lane.wonAt, 4);
  assert.equal(board.items[1].lanes[0].wonAt, null);
  assert.equal(board.end, 4.001, 'a t=0 tail event never rewinds time, and keeps its own instant');
});

test('board: a glide past its last step lands on the exact saved value', () => {
  assert.equal(valueAt([{ t: 0, value: 11882 }, { t: 10, value: 10307 }], 10.5, 0.5, x => 1 - (1 - x) ** 3), 10307);
});

test('schema: rejected events and agent counts parse, and the counts must match', () => {
  const o = order();
  o.events.splice(1, 0, { seq: 1.5, t: 0.5, kind: 'rejected', round: 1, shop: 'haneul', total: 3000, chosen_by: 'CODE', reason: 'limit' } as any);
  o.events.forEach((row, i) => { row.seq = i + 1; });
  assert.throws(() => factsOf(run(), o), /1 rejected events but the award counts 0/);
  (o.events.find(row => row.kind === 'award') as any).agents.rejected = 1;
  const facts = factsOf(run(), o);
  assert.equal(facts.reject_line, "Haneul's agent goes below what its shop can accept. Rally's checks throw it out.");
  assert.equal(facts.agent_line, "Shop agents wrote 1 of 1 bid · Rally's checks rejected 1.");
  assert.equal(factsOf().reject_line, '', 'no rejection, no line');
  const bad = order();
  (bad.events[1] as any).authored = 'model';
  assert.throws(() => parse(OrderSchema, bad, 'order.json'), /authored/);
});

test('pacing: each anchored event lands on its line, and time between pins runs evenly forward', () => {
  const board = buildBoard(events() as any);
  const p = anchored(board, 2, [{ t: 1, s: 6 }, { t: 0.5, s: 8 }, { t: 4, s: 12 }]);
  assert.deepEqual(p.knots, [{ t: 0, s: 2 }, { t: 1, s: 6 }, { t: 4, s: 12 }], 'an anchor that runs time backwards is dropped');
  assert.equal(sceneAt(p, 2.5), 9);
  assert.equal(sceneAt(p, 5), 13, 'after the last pin the board keeps real time');
});

test('narration: plain words for a judge outside tech', () => {
  const jargon = /\b(LLM|schema|endpoint|idempotent|SSE|code|model|candidate index(es)?)\b/i;
  const salesy = /\b(revolutionary|seamless(ly)?|unlock|empower|game-changer)\b/i;
  for (const cue of plans().flatMap(plan => plan.lines)) {
    assert.ok(!jargon.test(cue.text), `jargon: ${cue.text}`);
    assert.ok(!salesy.test(cue.text), `sounds like an ad: ${cue.text}`);
    assert.ok(!/\b(I|I'm|my|me)\b/.test(cue.text), `third person only: ${cue.text}`);
  }
  for (const file of ['src/timeline.ts', 'script.md', 'src/scenes/Story.tsx']) assert.ok(!/candidate indexes|code-built options/i.test(readFileSync(file, 'utf8')), file);
  const [r, o] = parsed();
  for (const text of Object.values(factsOf())) assert.ok(!jargon.test(text), `jargon in a fact: ${text}`);
});

test('the rejection, agent and Haneul lines come from the run, in plain words', () => {
  const o = order();
  o.events.splice(1, 0, { seq: 1.5, t: 0.5, kind: 'rejected', round: 1, shop: 'bada', total: 3000, chosen_by: 'CODE', reason: 'limit' } as any);
  o.events.forEach((row, i) => { row.seq = i + 1; });
  (o.events.find(row => row.kind === 'award') as any).agents.rejected = 1;
  (o.events.find(row => row.kind === 'bid') as any).perks = { a: ['bundle', 'freeship'] };
  (o.events.find(row => row.kind === 'bid') as any).bundle = { items: ['a', 'b'], price: 2800 };
  const f = factsOf(run(), o);
  assert.equal(f.reject_line, "Bada's agent goes below what its shop can accept. Rally's checks throw it out.");
  assert.equal(f.haneul_line, "Haneul's agent does what she asked: a two-item bundle.");
  assert.equal(f.goal_quote, 'Win two-item bundles.');
  // A beat the run did not produce drops its line rather than saying something false.
  const plain = layout(facts(), null);
  assert.ok(!plain.lines.some(line => /throw it out/.test(line.text)));
  assert.equal(spokenText(facts()).length, plain.lines.length);
});

test('private covers parse, and blur stays the default for logos', () => {
  const r = parse(RunSchema, { ...run(), redact: [{ clip: '08-handoff-payout', from: 0, to: 1, rect: { x: 0, y: 0, width: 1, height: 1 }, style: 'private' }, { clip: '05-paypal-hold', from: 0, to: 1, rect: { x: 0, y: 0, width: 1, height: 1 } }] }, 'run.json');
  assert.deepEqual(r.redact.map(row => row.style), ['private', 'blur']);
});

test('arithmetic: the winning prices plus the rest of the bill equal the charged total, or the build stops', () => {
  const [r] = parsed();
  receiptCheck(r, parse(ReceiptSchema, receipt(), 'receipt.json'));
  for (const [change, message] of [
    [{ breakdown: { ...receipt().breakdown, total: 2900 } }, /charged/],
    [{ breakdown: { ...receipt().breakdown, shipping: 100 } }, /sum to its total/],
    [{ lines: [{ id: 'a', shop: 'haneul', unit: 1200 }, { id: 'b', shop: 'dalbit', unit: 1600 }] }, /winners/],
  ] as const) assert.throws(() => receiptCheck(r, parse(ReceiptSchema, { ...receipt(), ...change }, 'receipt.json')), message);
  if (!built) return;
  // The board shows the winners' prices and one "shipping, duties, tax and fee" term; they must add up on screen.
  const cents = (text: string) => Math.round(Number(text.replace(/[^\d.]/g, '')) * 100);
  const units = Object.values(built.run.winners as Record<string, { unit: number }>).reduce((sum, row) => sum + row.unit, 0);
  assert.equal(cents(built.vars.items_total), units);
  assert.equal(units + cents(built.vars.extras_total), built.run.charged_minor);
  assert.equal(cents(built.vars.charged), built.run.charged_minor);
});

test('the cheaper-item line appears only when a winner is not the lowest single price in its row', () => {
  assert.equal(factsOf().why_shown, '', "every fixture winner is its row's lowest");
  const o = order();
  (o.events[1] as any).items = { a: 1300, 'b:older': 1400 };
  assert.equal(factsOf(run(), o).why_shown, 'yes');
  assert.equal(finalPrices(parse(OrderSchema, o, 'order.json')).b.haneul, 1400);
});

test('the agent share shows only when agents wrote at least half the bids', () => {
  const o = order();
  (o.events.find(row => row.kind === 'award') as any).agents = { written: 1, options: 1, rejected: 0, code: 2, changed: 1 };
  assert.equal(factsOf(run(), o).agent_line, '');
  (o.events.find(row => row.kind === 'award') as any).agents = { written: 2, options: 1, rejected: 0, code: 1, changed: 1 };
  assert.equal(factsOf(run(), o).agent_line, 'Shop agents wrote 2 of 4 bids.');
});

test('rail: every demo moment has exactly one step, the one its line is about', () => {
  assert.deepEqual([...STEPS], ['One bag', 'PayPal holds', 'Agents bid', 'Seoul hub', "Everyone's paid"]);
  for (const plan of plans()) {
    const demo = plan.scenes.filter(scene => scene.scene.act === 3);
    for (const line of plan.lines.filter(row => demo.some(scene => scene.id === row.scene))) {
      assert.ok(line.step, `no step for: ${line.text}`);
      for (const t of [line.start, (line.start + line.end) / 2, line.end - 0.01]) assert.equal(railAt(plan, t), line.step, line.text);
    }
    for (const scene of demo) for (let t = scene.start; t < scene.start + scene.duration; t += 0.25) assert.ok(railAt(plan, t) !== null, `no step at ${t}`);
    for (const scene of plan.scenes.filter(row => row.scene.act !== 3)) assert.equal(railAt(plan, scene.start + scene.duration / 2), null, scene.id);
  }
});

test('spoken amounts are generated from the numbers', () => {
  assert.equal(spokenMoney(9330, 'USD'), 'ninety-three dollars thirty');
  assert.equal(spokenMoney(10431, 'USD'), 'one hundred four dollars thirty-one');
  assert.equal(spokenMoney(1101, 'USD'), 'eleven dollars and one cent');
  assert.equal(spokenMoney(3900, 'USD'), 'thirty-nine dollars');
  if (built) for (const line of layout(built.vars, built.spoken).lines) assert.ok(!/\$\d/.test(line.say), `the voice would read digits: ${line.say}`);
});
