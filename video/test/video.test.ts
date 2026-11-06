import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepare } from '../scripts/prepare.ts';
import { clipTime, MAX_ZOOM, peakSpeed, view } from '../src/motion.ts';
import { anchored, buildBoard, roundAt, sceneAt, valueAt } from '../src/auction.ts';
import { buildFacts, crossCheck, finalCheck, finalPrices, money, OrderSchema, parse, ReceiptSchema, receiptCheck, RunSchema } from '../src/schema.ts';
import { CLIPS, cueAt, GAP, layout, MAX_SECONDS, MAX_SILENCE, SCENES, spokenText, toScript, toSrt, type ClipName } from '../src/timeline.ts';

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
const run = () => ({ order_id: 'o1', currency: 'USD', held_minor: 3000, charged_minor: 2800, payout_usd_cents: 1300, payout_status: 'completed', payout_shop: 'haneul', winners: { a: { shop: 'haneul', unit: 1300 }, b: { shop: 'dalbit', unit: 1500 } }, goal: 'Win two-item bundles. Keep a margin.', redact: [] });
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

test(`the video stays within ${MAX_SECONDS} s, and the built cut within 2:05 to 2:20`, () => {
  for (const plan of plans()) assert.ok(plan.total <= MAX_SECONDS, `${plan.total} s`);
  if (built?.spoken) { const total = layout(built.vars, built.spoken).total; assert.ok(total >= 125 && total <= 140, `${total} s`); }
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

test('every shot starts on a line, keeps its clip span, and ramps no faster than 3×', () => {
  for (const plan of plans()) for (const scene of plan.scenes) (scene.scene.shots || []).forEach((shot, i, shots) => {
    const from = i === 0 ? 0 : cueAt(scene, shot.cue), to = i + 1 < shots.length ? cueAt(scene, shots[i + 1].cue) : scene.duration;
    assert.ok(to > from, `${scene.id} shot ${i} has no time`);
    assert.ok(shot.out <= ((built?.clips?.[shot.clip]?.frames ?? Infinity) / 30) + 0.05, `${shot.clip} out past its end`);
    assert.ok(peakSpeed(to - from, shot.in, shot.out) <= 3, `${scene.id} ${shot.clip} ramps to ${peakSpeed(to - from, shot.in, shot.out).toFixed(2)}×`);
    for (const key of shot.keys) assert.ok(key.zoom >= 1 && key.zoom <= MAX_ZOOM, `${shot.clip} zoom ${key.zoom}`);
  });
});

test('speed ramp: starts at in, ends at out, never runs backwards, and is 1× at both ends', () => {
  const at = (t: number) => clipTime(t, 4, 2, 9);
  assert.equal(at(0), 2);
  assert.ok(Math.abs(at(4) - 9) < 1e-9);
  for (let t = 0; t < 4; t += 0.05) assert.ok(at(t + 0.05) >= at(t));
  assert.ok(Math.abs((at(0.01) - at(0)) / 0.01 - 1) < 0.01 && Math.abs((at(4) - at(3.99)) / 0.01 - 1) < 0.01);
  assert.equal(clipTime(10, 6, 0, 3), 3, 'a short span holds its last frame');
});

test('camera: never zooms past 1.8 or shows past the clip edge', () => {
  for (const key of [{ x: 0, y: 0, zoom: 3 }, { x: 1440, y: 900, zoom: 1 }, { x: 720, y: 450, zoom: 1.8 }]) for (const s of [0, 0.4, 3, 9]) {
    const v = view([{ ...key, s: 0 }], s), half = 960 / (1920 / 1440 * v.zoom), tall = 540 / (1920 / 1440 * v.zoom);
    assert.ok(v.zoom >= 1 && v.zoom <= MAX_ZOOM);
    assert.ok(v.x - half >= -1e-6 && v.x + half <= 1440 + 1e-6 && v.y - tall >= -1e-6 && v.y + tall <= 900 + 1e-6, JSON.stringify(v));
  }
  const held = [0, 1, 2, 3].map(s => view([{ s: 0, x: 720, y: 450, zoom: 1.4 }], s).zoom);
  assert.ok(held[3] > held[0], 'a held frame drifts');
});

test('no banned word in any on-screen source', () => {
  const words = /\b(demo|example|simulated|preview|fixture)\b/i;
  for (const file of ['src/timeline.ts', 'src/scenes/Story.tsx', 'src/scenes/Bidding.tsx', 'src/scenes/Architecture.tsx', 'src/scenes/ClipScene.tsx']) {
    const strings = readFileSync(file, 'utf8').split('\n').filter(line => !line.trim().startsWith('//'));
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
  assert.match(facts.shop_result, /Haneul Beauty was outbid/);
  assert.match(facts.shop_result, /Dalbit Official won 1 of 2/);
  assert.match(facts.receipt_line, /One box from 2 shops/);
  assert.equal(facts.payout_shop, 'Dalbit Official');
});

test('captions stay true when no bid beats checkout', () => {
  const r = { ...run(), charged_minor: 3000 };
  const o = order();
  o.events[3].total = 3000; o.events[4].total = 3000;
  const facts = factsOf(r, o, { ...receipt(), breakdown: { ...receipt().breakdown, shipping: 200, total: 3000 } });
  assert.match(facts.result_line, /stands/);
  assert.match(facts.capture_line, /exactly the hold/);
  assert.ok(!facts.receipt_line.includes('released'));
});

test('prepare: missing inputs fail with a clear message and no fallback', () => {
  const { root, done } = project({ 'order.json': order() });
  assert.throws(() => prepare(root, { allowPlaceholders: true, probe }), /run\.json is missing/);
  done();
});

test('prepare: placeholders pass for review and fail for the final render', () => {
  const { root, done } = project({ 'run.json': run(), 'order.json': order() }, allClips.slice(0, 6));
  assert.deepEqual(prepare(root, { allowPlaceholders: true, probe }).missing, ['08-handoff-payout.mp4']);
  assert.throws(() => prepare(root, { allowPlaceholders: false, probe }), /Placeholders cannot go in the final render[\s\S]*08-handoff-payout/);
  done();
});

test('prepare: a full set passes, and the wrong size fails', () => {
  const { root, done } = project({ 'run.json': run(), 'order.json': order() }, allClips);
  const { manifest } = prepare(root, { allowPlaceholders: false, probe });
  assert.equal(manifest.clips['06-bidding' as ClipName]?.frames, 300);
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
  assert.match(facts.reject_line, /^Haneul's agent went below what its shop can accept, so Rally's checks threw it out and sent the shop's best valid bid\.$/);
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
  for (const file of ['src/timeline.ts', 'script.md', 'src/scenes/Architecture.tsx']) assert.ok(!/candidate indexes|code-built options/i.test(readFileSync(file, 'utf8')), file);
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
  assert.equal(f.reject_line, "Bada's agent went below what its shop can accept, so Rally's checks threw it out and sent the shop's best valid bid.");
  assert.equal(f.agent_bid_line, "In round 1, Haneul's agent writes its own bid, and it passes.");
  assert.equal(f.haneul_line, "Haneul's agent does what she asked: a two-item bundle with free shipping in Korea.");
  assert.equal(f.goal_quote, 'Win two-item bundles.');
  // A beat the run did not produce drops its line rather than saying something false.
  const plain = layout(facts(), null);
  assert.ok(!plain.lines.some(line => /threw it out/.test(line.text)));
  assert.equal(spokenText(facts()).length, plain.lines.length);
});

test('private covers parse, and blur stays the default for logos', () => {
  const r = parse(RunSchema, { ...run(), redact: [{ clip: '02-products-edit', from: 0, to: 1, rect: { x: 0, y: 0, width: 1, height: 1 }, style: 'private' }, { clip: '05-paypal-hold', from: 0, to: 1, rect: { x: 0, y: 0, width: 1, height: 1 } }] }, 'run.json');
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
  assert.equal(factsOf().why_line, '', "every fixture winner is its row's lowest");
  const o = order();
  (o.events[1] as any).items = { a: 1300, 'b:older': 1400 };
  assert.match(factsOf(run(), o).why_line, /cheapest whole box/);
  assert.equal(finalPrices(parse(OrderSchema, o, 'order.json')).b.haneul, 1400);
});

test('the agent share shows only when agents wrote at least half the bids', () => {
  const o = order();
  (o.events.find(row => row.kind === 'award') as any).agents = { written: 1, options: 1, rejected: 0, code: 2, changed: 1 };
  assert.equal(factsOf(run(), o).agent_line, '');
  (o.events.find(row => row.kind === 'award') as any).agents = { written: 2, options: 1, rejected: 0, code: 1, changed: 1 };
  assert.equal(factsOf(run(), o).agent_line, 'Shop agents wrote 2 of 4 bids.');
});
