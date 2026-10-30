import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepare } from '../scripts/prepare.ts';
import { bidNotes, buildBoard, roundAt, valueAt } from '../src/auction.ts';
import { buildFacts, crossCheck, finalCheck, OrderSchema, parse, RunSchema } from '../src/schema.ts';
import { allCues, CLIPS, MAX_SECONDS, SCENES, toScript, toSrt, totalSeconds, type ClipName } from '../src/timeline.ts';

// Test data only: nothing here reaches a build.
const events = () => [
  { seq: 1, t: 0, kind: 'start', v: 3, total: 3000, items: ['a', 'b'], shops: { a: ['haneul', 'bada'], b: ['haneul', 'dalbit'] }, listed: { a: { haneul: 1500, bada: 1400 }, b: { haneul: 1600, dalbit: 1700 } } },
  { seq: 2, t: 1, kind: 'bid', round: 1, shop: 'haneul', total: 3000, note: 'Together for less.', chosen_by: 'LLM', items: { a: 1300, 'b:older': 1500 }, bundle: null, perks: { a: ['bundle'], b: ['older'] } },
  { seq: 3, t: 2, kind: 'pass', round: 1, shop: 'bada', total: 3000, items: ['a'] },
  { seq: 4, t: 3, kind: 'round', round: 1, total: 2800, leaders: {} },
  { seq: 5, t: 4, kind: 'award', total: 2800, winners: { a: { shop: 'haneul', unit: 1300 }, b: { shop: 'dalbit', unit: 1500 } }, extras: [], domestic: {} },
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

test('callouts: at most 6 words and 2 on screen', () => {
  for (const scene of SCENES) for (const callout of scene.callouts || []) {
    assert.ok(callout.text.split(/\s+/).filter(word => word !== '→').length <= 6, callout.text);
    const overlapping = scene.callouts!.filter(other => other.at < callout.at + callout.dur && callout.at < other.at + other.dur);
    assert.ok(overlapping.length <= 2, scene.id);
  }
});

test('captions fit 2 lines, can be spoken in time and never overlap', () => {
  const cues = allCues();
  cues.forEach((cue, i) => {
    assert.ok(cue.text.length <= 110, cue.text);
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
  assert.ok(srt.startsWith('1\n00:00:00,400 --> 00:00:06,000\n'));
  assert.ok(srt.includes('$30.00'));
  assert.ok(!srt.includes('{'));
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
  assert.equal(facts.payout_shop, 'Dalbit Official');
});

test('captions stay true when no bid beats checkout', () => {
  const r = { ...run(), charged_minor: 3000 };
  const o = order();
  o.events[3].total = 3000; o.events[4].total = 3000;
  assert.match(buildFacts(...parsed(r, o), { a: 'A', b: 'B' }).result_line, /stands/);
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
  assert.equal(board.end, 4, 'a t=0 tail event never rewinds time');
});

test('board: a glide past its last step lands on the exact saved value', () => {
  assert.equal(valueAt([{ t: 0, value: 11882 }, { t: 10, value: 10307 }], 10.5, 0.5, x => 1 - (1 - x) ** 3), 10307);
});

test('board: only model notes appear, at most 3, one per shop', () => {
  const bid = (seq: number, shop: string, chosen_by: string, note: string) => ({ seq, t: seq, kind: 'bid', shop, chosen_by, note, items: {}, perks: {}, round: 1 });
  const rows = [events()[0], bid(2, 'haneul', 'CODE', 'code wrote this'), bid(3, 'haneul', 'LLM', 'first'), bid(4, 'haneul', 'LLM', 'second'), bid(5, 'bada', 'LLM', 'a demo line'), bid(6, 'bada', 'LLM', 'clean'), bid(7, 'dalbit', 'LLM', 'third')];
  assert.deepEqual(bidNotes(buildBoard(rows as any), /\bdemo\b/).map(row => row.note), ['first', 'clean', 'third']);
});
