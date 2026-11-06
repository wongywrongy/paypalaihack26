// Narration, one WAV per line. The timeline is laid out from these lengths, so a longer line makes its scene longer.
//
// Kokoro (default): spoken locally at KOKORO_SPEED (default VOICE_SPEED in src/timeline.ts), never sped up after.
// Your own voice: RECORDED_DIR=run/recorded npm run voice. Record each line of run/read-this.md as its own file,
// 01.wav, 02.wav, … in that folder; they are trimmed, levelled and measured like Kokoro's.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { layout, spokenText, VOICE_SPEED } from '../src/timeline.ts';

const RECORDED = process.env.RECORDED_DIR;
const VOICE = RECORDED ? 'recorded' : process.env.KOKORO_VOICE || 'af_heart', PYTHON = process.env.KOKORO_PYTHON || '.venv/bin/python';
const SPEED = Number(process.env.KOKORO_SPEED || VOICE_SPEED);
const vars = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')).vars;
const texts = spokenText(vars);
const number = (i: number) => String(i + 1).padStart(2, '0');

// The reading script: what to say, line by line, in the order the files are numbered.
mkdirSync('run', { recursive: true });
writeFileSync('run/read-this.md', ['# Read each line as its own take', '', 'Save each as run/recorded/NN.wav. Talk, don\'t read: as if telling a friend across a table. Leave no pause at the start or end.', '',
  ...texts.map((text, i) => `${number(i)}. ${text}`), ''].join('\n'));

for (const path of RECORDED ? [PYTHON] : [PYTHON, 'models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin']) if (!existsSync(path)) {
  console.error(`Missing ${path}. See README.md, "Audio".`);
  process.exit(1);
}
if (RECORDED) {
  const missing = texts.map((_, i) => join(RECORDED, `${number(i)}.wav`)).filter(path => !existsSync(path));
  if (missing.length) {
    console.error(`Missing recordings (see run/read-this.md for what each says):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

mkdirSync('run/voice', { recursive: true });
const files = texts.map((text, i) => `${createHash('sha1').update(`${VOICE}\n${RECORDED ? readFileSync(join(RECORDED, `${number(i)}.wav`)).length : SPEED}\n${text}`).digest('hex').slice(0, 12)}.wav`);
if (RECORDED) texts.forEach((_, i) => copyFileSync(join(RECORDED, `${number(i)}.wav`), `run/voice/${files[i]}`));
const job = { voice: VOICE, speed: SPEED, recorded: !!RECORDED, lines: texts.map((text, i) => ({ text, out: `run/voice/${files[i]}` })) };
const spoken: number[] = JSON.parse(execFileSync(PYTHON, ['scripts/kokoro.py'], { input: JSON.stringify(job), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim().split('\n').at(-1)!);
writeFileSync('run/voiceover.json', JSON.stringify({ voice: VOICE, speed: RECORDED ? null : SPEED, lines: texts.map((text, i) => ({ text, file: files[i], spoken: spoken[i] })) }, null, 1));
const plan = layout(vars, spoken);
const words = texts.join(' ').split(/\s+/).length, talking = spoken.reduce((a, b) => a + b, 0);
plan.lines.forEach((line, i) => console.log(`${line.start.toFixed(1).padStart(6)}s  ${spoken[i].toFixed(2)}s  ${line.text}`));
console.log(`Wrote ${texts.length} lines with ${VOICE}: ${plan.total.toFixed(1)} s in all, ${Math.round(words / talking * 60)} words a minute while talking.`);
