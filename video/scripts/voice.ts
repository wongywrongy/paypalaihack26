// Narration with Kokoro, run locally: one clip per cue, placed at the cue's start. Never sped up: a cue that runs
// past its `dur` fails here, and the fix is a longer cue or fewer words in timeline.ts.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { allCues, fill, totalSeconds } from '../src/timeline.ts';

const VOICE = process.env.KOKORO_VOICE || 'af_heart', PYTHON = process.env.KOKORO_PYTHON || '.venv/bin/python';
for (const path of [PYTHON, 'models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin']) if (!existsSync(path)) {
  console.error(`Missing ${path}. See README.md, "Audio".`);
  process.exit(1);
}
const vars = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')).vars;
const cues = allCues().map(cue => ({ ...cue, text: fill(cue.text, vars) }));
const job = { voice: VOICE, seconds: totalSeconds(), out: 'run/voiceover.wav', cues: cues.map(({ start, text }) => ({ start, text })) };
const spoken: number[] = JSON.parse(execFileSync(PYTHON, ['scripts/kokoro.py'], { input: JSON.stringify(job), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim().split('\n').at(-1)!);
writeFileSync('run/voiceover.json', JSON.stringify({ voice: VOICE, spoken }, null, 1));

let over = 0;
cues.forEach((cue, i) => {
  const long = spoken[i] > cue.dur;
  if (long) over++;
  console.log(`${cue.start.toFixed(1).padStart(6)}s  ${spoken[i].toFixed(2)}s of ${cue.dur.toFixed(1)}s${long ? '  OVERRUNS' : ''}  ${cue.text}`);
});
console.log(`Wrote run/voiceover.wav with ${VOICE}.`);
if (over) {
  console.error(`${over} cues run past their dur. Lengthen them or cut words in src/timeline.ts; the voice is never sped up.`);
  process.exit(1);
}
