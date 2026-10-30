// Stand-in AI narration for judging flow. Each caption is spoken at its own cue time, sped up only if it overruns.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allCues, fill, totalSeconds } from '../src/timeline.ts';

const VOICE = process.env.AI_VOICE || 'en-US-AndrewMultilingualNeural', TTS = process.env.EDGE_TTS || 'edge-tts', RATE = 24000, MAX_SPEEDUP = 15;
const vars = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')).vars;
const temp = mkdtempSync(join(tmpdir(), 'rally-voice-'));

function speak(text: string, speedup: number) {
  const file = join(temp, 'cue.mp3');
  execFileSync(TTS, ['--voice', VOICE, `--rate=+${speedup}%`, '--text', text, '--write-media', file], { stdio: 'ignore' });
  const wav = join(temp, 'cue.wav');
  execFileSync('node_modules/.bin/remotion', ['ffmpeg', '-y', '-v', 'error', '-i', file, '-ar', String(RATE), '-ac', '1', '-c:a', 'pcm_s16le', wav], { stdio: 'ignore' });
  const data = readFileSync(wav);
  return data.subarray(data.indexOf('data') + 8);
}

const seconds = (pcm: Buffer) => pcm.length / 2 / RATE;
const track = Buffer.alloc(totalSeconds() * RATE * 2);
const cues = allCues();
cues.forEach((cue, i) => {
  const text = fill(cue.text, vars);
  const room = (cues[i + 1]?.start ?? totalSeconds()) - cue.start;
  let pcm = speak(text, 0), speedup = 0;
  if (seconds(pcm) > room) { speedup = Math.min(MAX_SPEEDUP, Math.ceil((seconds(pcm) / room - 1) * 100) + 2); pcm = speak(text, speedup); }
  pcm.copy(track, Math.round(cue.start * RATE) * 2);
  console.log(`${cue.start.toFixed(1).padStart(6)}s  ${seconds(pcm).toFixed(1)}s of ${room.toFixed(1)}s${speedup ? ` at +${speedup}%` : ''}${seconds(pcm) > room ? '  OVERRUN' : ''}`);
});

const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + track.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(track.length, 40);
writeFileSync('run/voiceover.wav', Buffer.concat([header, track]));
rmSync(temp, { recursive: true });
console.log('Wrote run/voiceover.wav');
