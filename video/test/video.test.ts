import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepare } from '../scripts/prepare.ts';
import { camera } from '../src/motion.ts';
import { buildBoard, pace, roundAt, sceneAt, valueAt } from '../src/auction.ts';
import { buildFacts, crossCheck, finalCheck, money, OrderSchema, parse, RunSchema } from '../src/schema.ts';
import { allCues, CLIPS, MAX_SECONDS, REJECT_AT, SCENES, STEPS, toScript, toSrt, totalSeconds, type ClipName } from '../src/timeline.ts';

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
const run = () => ({ order_id: 'o1', currency: 'USD', held_minor: 3000, charged_minor: 2800, payout_usd_cents: 1300, payout_status: 'completed', payout_shop: 'haneul', winners: { a: { shop: 'haneul', unit: 1300 }, b: { shop: 'dalbit', unit: 1500 } }, redact: [] });
const parsed = (r: unknown = run(), o: unknown = order()) => [parse(RunSchema, r, 'run.json'), parse(OrderSchema, o, 'order.json')] as const;

function project(files: Record<string, unknown>, clips: string[] = []) {
  const repo = mkdtempSync(join(tmpdir(), 'rally-video-'));
  const root = join(repo, 'video');
  mkdirSync(join(root, 'run/clips'), { recursive: true });
  mkdirSync(join(repo, 'design/scenario'), { recursive: true });
  mkdirSync(join(repo, 'frontend/public/assets/products'), { recursive: true });
  writeFileSync(join(repo, 'design/scenario/scenario.json'), JSON.stringify({ catalog: [{ id: 'a', brand: 'X', name: 'Cleanser' }, { id: 'b', brand: 'X', name: 'Cream' }] }));
  for (const id of ['a', 'b']) writeFileSync(join(repo, 'frontend/public/assets/products', `${id}.png`), '');
  for (const [name, value] of Object.entries(files)) writeFileSync(join(root, 'run', name), JSON.stringify(value));
  for (const clip of clips) writeFileSync(join(root, 'run/clips', `${clip}.mp4`), '');
  return { root, done: () => rmSync(repo, { recursive: true }) };
}
const probe = () => ({ width: 1440, height: 900, seconds: 10 });
const allClips = Object.keys(CLIPS);

test(`timeline stays within ${MAX_SECONDS} s`, () => assert.ok(totalSeconds() <= MAX_SECONDS, `${totalSeconds()} s`));

test('scenes are contiguous and every shot and cue stays inside its scene', () => {
  let end = 0;
  for (const scene of SCENES) {
    assert.equal(scene.start, end, scene.id);
    end += scene.duration;
    for (const row of [...scene.cues, ...(scene.shots || []), ...(scene.callouts || [])]) assert.ok(row.at + row.dur <= scene.duration, `${scene.id}: ${JSON.stringify(row)}`);
  }
});

test('callouts: at most 6 words and one on screen', () => {
  for (const scene of SCENES) for (const callout of scene.callouts || []) {
    assert.ok(callout.text.split(/\s+/).filter(word => word !== '→').length <= 6, callout.text);
    const overlapping = scene.callouts!.filter(other => other.at < callout.at + callout.dur && callout.at < other.at + other.dur);
    assert.equal(overlapping.length, 1, scene.id);
  }
});

test('captions fit 2 lines, can be spoken in time and never overlap', () => {
  const cues = allCues();
  cues.forEach((cue, i) => {
    assert.ok(cue.text.length <= 120, cue.text);
    assert.ok(cue.text.split(/\s+/).length / cue.dur <= 3.5, `too fast: ${cue.text}`);
    if (cues[i + 1]) assert.ok(cue.start + cue.dur <= cues[i + 1].start + 1e-9, cue.text);
  });
});

test('no banned word in any on-screen source', () => {
  const words = /\b(demo|example|simulated|preview|fixture)\b/i;
  for (const file of ['src/timeline.ts', 'src/scenes/Story.tsx', 'src/scenes/Bidding.tsx', 'src/scenes/Architecture.tsx', 'src/scenes/ClipScene.tsx']) {
    const strings = readFileSync(file, 'utf8').split('\n').filter(line => !line.trim().startsWith('//'));
    assert.ok(!words.test(strings.join('\n')), file);
  }
});

test('the disclosure line appears only on the title', () => {
  for (const file of ['src/timeline.ts', 'src/scenes/Bidding.tsx', 'src/scenes/Architecture.tsx', 'src/scenes/ClipScene.tsx', 'src/ui.tsx']) assert.ok(!readFileSync(file, 'utf8').includes('fictional shops'), file);
});

test('script.md matches timeline.ts', () => assert.equal(readFileSync('script.md', 'utf8'), toScript()));

test('srt numbers cues and uses comma timestamps', () => {
  const [r, o] = parsed();
  const srt = toSrt(buildFacts(r, o, { a: 'Cleanser', b: 'Cream' }));
  assert.ok(srt.startsWith('1\n00:00:00,300 --> 00:00:06,500\n'));
  assert.ok(srt.includes('$28.00'));
  assert.ok(!srt.includes('{'));
});

test('names match the app word for word', () => {
  const source = (file: string) => readFileSync(join('../frontend/src/routes', file), 'utf8');
  for (const [file, strings] of Object.entries({
    'shops/Home.tsx': [...STEPS, 'Get your first Rally payout', ' of 5', 'Open your storefront'],
    'shops/GoalsForm.tsx': ['Review rules', 'From your goal', 'Apply'],
    'Paid.tsx': ['Your shop bid on this order', 'Hand off in Rally for shops', 'One box from', 'Duties included'],
    'shops/OrdersView.tsx': ['Rally pickup', 'Record hand-off', "'Won', 'Handed off', 'Payout sent', 'Paid'"],
  })) for (const text of strings) assert.ok(source(file).includes(text), `${file}: ${text}`);
  const readme = readFileSync('README.md', 'utf8');
  for (const text of [...STEPS, 'Open your storefront', 'Review rules', 'From your goal', 'Hand off in Rally for shops', 'Record hand-off', 'Rally pickup', 'Won · Handed off · Payout sent · Paid', 'Your shop bid on this order', 'Duties included']) assert.ok(readme.includes(text), `README: ${text}`);
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

test('the code check row is only labels and ticks', () => {
  const source = readFileSync('src/scenes/Bidding.tsx', 'utf8');
  assert.equal(source.match(/const CHECKS = \[.*\];/)![0], `const CHECKS = ["within the shop's limits", 'in stock', 'total under the hold'];`);
  // The rejection beat says why in words only: no amount can appear there.
  assert.ok(!/\d/.test(source.match(/const REASONS[^\n]*/)![0]), 'a rejection reason carries a number');
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
  const facts = buildFacts(run2, order2, { a: 'Cleanser', b: 'Cream' });
  assert.match(facts.shop_result, /Haneul Beauty was outbid/);
  assert.match(facts.shop_result, /Dalbit Official won 1 of 2/);
  assert.match(facts.receipt_line, /One box from 2 shops/);
  assert.equal(facts.payout_shop, 'Dalbit Official');
});

test('captions stay true when no bid beats checkout', () => {
  const r = { ...run(), charged_minor: 3000 };
  const o = order();
  o.events[3].total = 3000; o.events[4].total = 3000;
  const facts = buildFacts(...parsed(r, o), { a: 'A', b: 'B' });
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
  const { root, done } = project({ 'run.json': run(), 'order.json': order() }, allClips.slice(0, 8));
  assert.deepEqual(prepare(root, { allowPlaceholders: true, probe }).missing, ['09-home-done.mp4']);
  assert.throws(() => prepare(root, { allowPlaceholders: false, probe }), /Placeholders cannot go in the final render[\s\S]*09-home-done/);
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
  assert.throws(() => buildFacts(...parsed(run(), o), {}), /1 rejected events but the award counts 0/);
  (o.events.find(row => row.kind === 'award') as any).agents.rejected = 1;
  const facts = buildFacts(...parsed(run(), o), {});
  assert.match(facts.check_line, /reject it and send the shop's best valid bid instead/);
  assert.equal(facts.agent_line, "Shop agents wrote 1 of 1 bid · Rally's checks rejected 1.");
  assert.equal(buildFacts(...parsed(), {}).check_line, "Every bid passes Rally's checks before it counts.");
  const bad = order();
  (bad.events[1] as any).authored = 'model';
  assert.throws(() => parse(OrderSchema, bad, 'order.json'), /authored/);
});

// Real bids in a round land milliseconds apart, so pacing must hold each agent bid on screen.
const paced = () => {
  const rows: any[] = [{ seq: 1, t: 0, kind: 'start', v: 3, total: 3000, items: ['a'], shops: { a: ['haneul', 'bada', 'dalbit'] }, listed: { a: { haneul: 1500, bada: 1400, dalbit: 1450 } } }];
  let seq = 2;
  for (const round of [1, 2, 3]) {
    const t0 = (round - 1) * 3.5 + 0.2;
    if (round === 1) rows.push({ seq: seq++, t: t0, kind: 'rejected', round, shop: 'bada', reason: 'limit' });
    for (const [i, shop] of ['bada', 'dalbit', 'haneul'].entries()) rows.push({ seq: seq++, t: t0 + (i ? 0.01 : 0), kind: 'bid', round, shop, authored: round === 1 && shop === 'bada' ? 'code' : 'agent', items: { a: 1400 - round * 10 - i }, bundle: null, perks: {} });
    rows.push({ seq: seq++, t: round * 3.5, kind: 'round', round, leaders: {} });
  }
  rows.push({ seq: seq++, t: 10.6, kind: 'award', winners: { a: { shop: 'haneul', unit: 1368 } }, extras: [], domestic: {}, agents: { written: 8, options: 0, rejected: 1, code: 1, changed: 8 } });
  return rows;
};

test('pacing: every agent bid holds 1.2 s and the first rejection lands on its narration', () => {
  const rows = paced(), board = buildBoard(rows);
  const p = pace(board, { from: 1.5, until: 33, gaps: [2, 1.2], rejectAt: REJECT_AT, rejectBeat: 3 });
  assert.equal(p.doubleFrom, null);
  const landed = sceneAt(p, board.rejected[0].t);
  assert.ok(landed <= REJECT_AT && REJECT_AT - landed < 1.5, `rejection lands at ${landed}`);
  assert.ok(Math.abs(sceneAt(p, board.awardAt) - 33) < 1e-6);
  const agent = board.events.filter(row => row.kind === 'bid' && row.authored === 'agent').map(row => sceneAt(p, row.t));
  const all = [...new Set(board.events.map(row => sceneAt(p, row.t)))].sort((x, y) => x - y);
  for (const at of agent) assert.ok(all.find(next => next > at + 1e-9)! - at >= 1.2 - 1e-6, `agent bid at ${at} is cut short`);
  for (let i = 1; i < p.knots.length; i++) assert.ok(p.knots[i].s >= p.knots[i - 1].s, 'time runs backwards');
});

test('pacing: a scene too short for every hold plays later rounds at 2× and says so', () => {
  const rows = paced(), board = buildBoard(rows);
  const p = pace(board, { from: 0, until: 9, gaps: [2, 1.2], rejectAt: 2, rejectBeat: 1 });
  assert.notEqual(p.doubleFrom, null);
  assert.ok(sceneAt(p, board.awardAt) <= 9 + 1e-6);
});

test('narration: plain words for a judge outside tech', () => {
  const jargon = /\b(LLM|schema|endpoint|idempotent|SSE|code|model|candidate index(es)?)\b/i;
  const salesy = /\b(revolutionary|seamless(ly)?|unlock|empower|game-changer)\b/i;
  for (const cue of allCues()) {
    assert.ok(!jargon.test(cue.text), `jargon: ${cue.text}`);
    assert.ok(!salesy.test(cue.text), `sounds like an ad: ${cue.text}`);
    assert.ok(!/\b(I|I'm|my|me)\b/.test(cue.text), `third person only: ${cue.text}`);
  }
  for (const file of ['src/timeline.ts', 'script.md', 'src/scenes/Architecture.tsx']) assert.ok(!/candidate indexes|code-built options/i.test(readFileSync(file, 'utf8')), file);
  const [r, o] = parsed();
  for (const text of Object.values(buildFacts(r, o, {}))) assert.ok(!jargon.test(text), `jargon in a fact: ${text}`);
});

test('the ribbon appears only beside the shop loop', () => assert.deepEqual(SCENES.filter(scene => scene.ribbon).map(scene => scene.id), ['shop', 'payout']));

test('hard cuts only where the story jumps sides', () => {
  const cuts = SCENES.slice(1).filter(scene => !scene.enter).map(scene => scene.id);
  assert.deepEqual(cuts, ['shop', 'how']);
  assert.ok(totalSeconds() >= 150 && totalSeconds() <= 170, `${totalSeconds()} s`);
});

test('camera pushes stay within 1.6× and inside their shot', () => {
  for (const scene of SCENES) for (const shot of scene.shots || []) if (shot.focus) {
    assert.ok(shot.focus.at + shot.focus.dur <= shot.dur + 1e-9, `${shot.clip} focus overruns its shot`);
    const peak = camera(shot.focus, Math.round((shot.focus.at + shot.focus.dur / 2) * 30), 30, 1400);
    assert.ok(peak.scale > 1 && peak.scale <= 1.6, `${shot.clip} zooms ${peak.scale}`);
    assert.ok(peak.x <= 0 && peak.y <= 0 && peak.x >= 1400 - 1400 * peak.scale - 1e-6, `${shot.clip} shows an edge`);
  }
});
