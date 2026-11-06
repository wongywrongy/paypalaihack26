// Narration with Kokoro, run locally: one WAV per line, never sped up. The timeline is laid out from these lengths,
// so a longer line simply makes its scene longer.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { layout, spokenText } from '../src/timeline.ts';

const VOICE = process.env.KOKORO_VOICE || 'af_heart', PYTHON = process.env.KOKORO_PYTHON || '.venv/bin/python';
for (const path of [PYTHON, 'models/kokoro-v1.0.onnx', 'models/voices-v1.0.bin']) if (!existsSync(path)) {
  console.error(`Missing ${path}. See README.md, "Audio".`);
  process.exit(1);
}
const vars = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')).vars;
const texts = spokenText(vars);
mkdirSync('run/voice', { recursive: true });
const files = texts.map(text => `${createHash('sha1').update(`${VOICE}\n${text}`).digest('hex').slice(0, 12)}.wav`);
const job = { voice: VOICE, lines: texts.map((text, i) => ({ text, out: `run/voice/${files[i]}` })) };
const spoken: number[] = JSON.parse(execFileSync(PYTHON, ['scripts/kokoro.py'], { input: JSON.stringify(job), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim().split('\n').at(-1)!);
writeFileSync('run/voiceover.json', JSON.stringify({ voice: VOICE, lines: texts.map((text, i) => ({ text, file: files[i], spoken: spoken[i] })) }, null, 1));
const plan = layout(vars, spoken);
plan.lines.forEach((line, i) => console.log(`${line.start.toFixed(1).padStart(6)}s  ${spoken[i].toFixed(2)}s  ${line.text}`));
console.log(`Wrote ${texts.length} lines with ${VOICE}: ${plan.total.toFixed(1)} s in all.`);
