// After a preview or render: does the picture keep moving? The drifting colour fields and grain always change, so a
// plain freeze check passes a scene where nothing happens. This compares edges instead (text, panels, chips: what a
// viewer reads), with the captions band cropped out, and fails on any stretch where they hold still past MAX_HOLD.
// Usage: node scripts/pace.ts out/preview.mp4
import { spawnSync } from 'node:child_process';
import { MAX_HOLD } from '../src/timeline.ts';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/pace.ts <video.mp4>'); process.exit(1); }
// Captions sit in the bottom 22%; they change with every phrase and would hide a still picture.
const filter = `fps=10,crop=iw:ih*0.78:0:0,scale=640:-1,format=gray,edgedetect=low=0.15:high=0.35,freezedetect=n=-42dB:d=${MAX_HOLD}`;
// Remotion's bundled ffmpeg lacks edgedetect and freezedetect, so this needs a full ffmpeg (macOS: brew install ffmpeg).
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const result = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-an', '-vf', filter, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (result.error) { console.error(`No ffmpeg at "${FFMPEG}". Install it (macOS: brew install ffmpeg) or set FFMPEG.`); process.exit(1); }
const out = `${result.stdout}${result.stderr}`;
if (result.status !== 0 || !/freezedetect|frame=|video:/.test(out)) { console.error(`ffmpeg failed on ${file}:\n${out.slice(-800)}`); process.exit(1); }
const starts = [...out.matchAll(/freeze_start: ([\d.]+)/g)].map(m => Number(m[1]));
const lengths = [...out.matchAll(/freeze_duration: ([\d.]+)/g)].map(m => Number(m[1]));
const holds = starts.map((at, i) => ({ at, length: lengths[i] ?? NaN }));
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
for (const hold of holds) console.log(Number.isNaN(hold.length) ? `still from ${clock(hold.at)} to the end` : `still ${hold.length.toFixed(1)} s from ${clock(hold.at)}`);
if (holds.length) { console.error(`${holds.length} stretch${holds.length === 1 ? '' : 'es'} where the picture holds still past ${MAX_HOLD} s. Give each something to do, or cut it.`); process.exit(1); }
console.log(`Moving throughout: no still stretch past ${MAX_HOLD} s.`);
